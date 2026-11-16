// src/scan/extractPage.ts
//
// Injected into the page with chrome.scripting.executeScript when the user
// clicks "Check this page for threats". It runs in Chrome's isolated world,
// so page scripts can't see or tamper with it.
//
// IMPORTANT: Chrome serializes this function's source and runs it inside
// the page. It must be completely self-contained: no imports, and no
// references to anything defined outside the function body. Type imports
// are fine because they disappear at compile time.
import type { DownloadLink, FieldKind, FormInfo, FrameData } from "./types";

export function extractPageData(): FrameData {
  const MAX_TEXT = 12000;
  const clean = (s: string | null | undefined, max = 200) =>
    (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

  const docEl = document.documentElement;
  const root = document.body ?? docEl;
  const vw = window.innerWidth || docEl.clientWidth;
  const vh = window.innerHeight || docEl.clientHeight;

  // ---------------------------------------------------------------
  // Visibility. Only text a person can actually see is collected:
  // hidden text is where pages put instructions aimed at AI scanners.
  // ---------------------------------------------------------------
  const visCache = new WeakMap<Element, boolean>();
  const isVisible = (el: Element | null): boolean => {
    if (!el) return false;
    const cached = visCache.get(el);
    if (cached !== undefined) return cached;

    let visible = el.checkVisibility
      ? el.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
          contentVisibilityAuto: true,
        })
      : true;

    if (visible) {
      const r = el.getBoundingClientRect();
      const docW = Math.max(docEl.scrollWidth, vw);
      if (r.width < 2 || r.height < 2) visible = false;
      else if (r.right <= 0 || r.left >= docW) visible = false;
      else if (r.bottom + window.scrollY <= 0) visible = false;
      else {
        const cs = getComputedStyle(el);
        if (parseFloat(cs.fontSize) < 6) visible = false;
        if (cs.color === "transparent" || cs.color === "rgba(0, 0, 0, 0)")
          visible = false;
      }
    }
    visCache.set(el, visible);
    return visible;
  };

  // ---------------------------------------------------------------
  // Visible text, in reading order.
  // ---------------------------------------------------------------
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS", "IFRAME", "OBJECT",
  ]);
  const textParts: string[] = [];
  let textLen = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && textLen < MAX_TEXT; node = walker.nextNode()) {
    const t = clean(node.nodeValue, 2000);
    if (!t) continue;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName.toUpperCase())) continue;
    if (!isVisible(parent)) continue;
    textParts.push(t);
    textLen += t.length + 1;
  }
  const text = textParts.join(" ").slice(0, MAX_TEXT);

  // ---------------------------------------------------------------
  // Identity clues: who does the page say it is?
  // ---------------------------------------------------------------
  const meta = (selector: string) =>
    clean(document.querySelector<HTMLMetaElement>(selector)?.content, 200);

  const copyright = Array.from(
    new Set(
      (text.match(/(?:©|\(c\)|copyright)[^|]{0,80}/gi) ?? []).map((m) =>
        clean(m, 90),
      ),
    ),
  ).slice(0, 3);

  const fileName = (url: string) => {
    if (!url || url.startsWith("data:")) return "embedded image";
    try {
      const path = new URL(url, location.href).pathname;
      return decodeURIComponent(path.split("/").pop() ?? "").slice(0, 60);
    } catch {
      return "";
    }
  };

  const logoHints: string[] = [];
  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (logoHints.length >= 8) return;
    const hay = `${img.currentSrc || img.src} ${img.alt} ${img.className} ${img.id}`;
    if (!/logo|brand/i.test(hay) || !isVisible(img)) return;
    const alt = clean(img.alt, 60);
    const file = fileName(img.currentSrc || img.src);
    logoHints.push(alt ? `${alt} (${file})` : file);
  });
  document
    .querySelectorAll<SVGElement>("svg[aria-label], [class*='logo' i][aria-label]")
    .forEach((el) => {
      if (logoHints.length < 8 && isVisible(el))
        logoHints.push(clean(el.getAttribute("aria-label"), 60));
    });
  const icon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (icon?.href) logoHints.push(`favicon: ${fileName(icon.href)}`);

  // ---------------------------------------------------------------
  // Headings, buttons, and links.
  // ---------------------------------------------------------------
  const headings: string[] = [];
  document.querySelectorAll<HTMLElement>("h1, h2, h3").forEach((h) => {
    if (headings.length < 12 && isVisible(h)) {
      const t = clean(h.innerText, 150);
      if (t) headings.push(t);
    }
  });

  const controls = new Set<string>();
  const downloads: DownloadLink[] = [];
  const RISKY_FILE = /\.(exe|msi|bat|cmd|ps1|scr|vbs|js|jar|zip|rar|7z|iso|dmg|pkg|apk|hta|lnk)$/i;
  let linkCount = 0;
  let hasContactLink = false;
  let hasReturnsLink = false;

  document
    .querySelectorAll<HTMLElement>(
      "button, [role='button'], input[type='submit'], input[type='button'], a[href]",
    )
    .forEach((el) => {
      if (!isVisible(el)) return;
      const label = clean(
        el.innerText ||
          (el as HTMLInputElement).value ||
          el.getAttribute("aria-label") ||
          el.title,
        80,
      );
      if (label && controls.size < 60) controls.add(label);

      if (el instanceof HTMLAnchorElement) {
        linkCount++;
        const both = `${label} ${el.href}`;
        if (/contact|customer service|help ?center|support/i.test(both)) hasContactLink = true;
        if (/return|refund|shipping/i.test(both)) hasReturnsLink = true;
        const file = fileName(el.href);
        if ((el.hasAttribute("download") || RISKY_FILE.test(file)) && downloads.length < 10) {
          downloads.push({ label: label || "(no label)", file: file || el.href.slice(0, 60) });
        }
      }
    });

  // ---------------------------------------------------------------
  // Forms that ask for sensitive information.
  // ---------------------------------------------------------------
  const classify = (input: HTMLInputElement): FieldKind | null => {
    const type = input.type.toLowerCase();
    const ac = (input.autocomplete || "").toLowerCase();
    const hay = `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""} ${ac}`.toLowerCase();
    if (type === "password") return "password";
    if (ac === "one-time-code" || /\botp\b|one.?time|verification.?code|2fa|mfa|auth.?code|sms.?code/.test(hay)) return "otp";
    if (/\bssn\b|social.?security/.test(hay)) return "ssn";
    if (/cc-csc|\bcvv|\bcvc|\bcsc\b|security.?code/.test(hay)) return "cvv";
    if (/cc-exp|expir|exp.?(date|month|year)/.test(hay)) return "expiry";
    if (/cc-number|card.?num|cc.?num|credit.?card|cardnumber/.test(hay)) return "card";
    if (type === "email" || /e-?mail|user.?name|userid|login|account/.test(hay)) return "username";
    return null;
  };

  const groups = new Map<HTMLFormElement | null, Set<FieldKind>>();
  document.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    if (!isVisible(input)) return;
    const kind = classify(input);
    if (!kind) return;
    const set = groups.get(input.form) ?? new Set<FieldKind>();
    set.add(kind);
    groups.set(input.form, set);
  });

  // Chrome treats localhost as a secure origin: traffic never leaves the
  // machine, so plain http there isn't an interception risk.
  const isInsecure = (u: URL | Location) =>
    u.protocol === "http:" &&
    !/^(localhost|127(?:\.\d+){3}|\[::1\])$/.test(u.hostname);

  const forms: FormInfo[] = [];
  groups.forEach((kinds, form) => {
    // A lone email box (newsletter signup) isn't interesting.
    if (kinds.size === 1 && kinds.has("username")) return;
    if (forms.length >= 5) return;
    let actionHost: string | null = null;
    let actionIsHttp = isInsecure(location);
    if (form && form.getAttribute("action")) {
      try {
        const action = new URL(form.action, location.href);
        if (action.hostname && action.hostname !== location.hostname) actionHost = action.hostname;
        actionIsHttp = isInsecure(action);
      } catch {
        /* unparsable action: leave defaults */
      }
    }
    const container: HTMLElement | null =
      form ?? document.querySelector("input[type='password']")?.closest("div, section, main") ?? null;
    forms.push({
      kinds: Array.from(kinds),
      actionHost,
      actionIsHttp,
      text: clean(container?.innerText, 300),
    });
  });

  // ---------------------------------------------------------------
  // Pop-ups and overlays: modal dialogs, and any large fixed element
  // sitting on top of the page.
  // ---------------------------------------------------------------
  const overlayEls = new Set<HTMLElement>();
  document
    .querySelectorAll<HTMLElement>("dialog[open], [role='dialog'], [role='alertdialog'], [aria-modal='true']")
    .forEach((el) => {
      if (isVisible(el)) overlayEls.add(el);
    });
  const probes: [number, number][] = [
    [vw / 2, vh / 2],
    [vw / 2, vh / 3],
    [vw / 3, (vh * 2) / 3],
  ];
  for (const [x, y] of probes) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (!(el instanceof HTMLElement) || el === root || el === docEl) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height >= vw * vh * 0.3 && isVisible(el)) overlayEls.add(el);
      break;
    }
  }
  const overlays = Array.from(overlayEls)
    .map((el) => clean(el.innerText, 500))
    .filter(Boolean)
    .slice(0, 3);

  // ---------------------------------------------------------------
  // Phone numbers and crypto wallet addresses shown on the page.
  // ---------------------------------------------------------------
  const unique = (arr: RegExpMatchArray | null, max: number) =>
    Array.from(new Set((arr ?? []).map((s) => s.trim()))).slice(0, max);
  const phones = unique(
    text.match(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g),
    5,
  );
  const wallets = unique(
    text.match(/\b0x[a-fA-F0-9]{40}\b|\bbc1[a-z0-9]{25,59}\b|\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g),
    3,
  );

  return {
    url: location.href,
    hostname: location.hostname,
    protocol: location.protocol,
    secureContext: window.isSecureContext,
    isTopFrame: window === window.top,
    width: vw,
    height: vh,
    title: clean(document.title, 200),
    metaDescription: meta("meta[name='description']"),
    siteName:
      meta("meta[property='og:site_name']") || meta("meta[name='application-name']"),
    ogTitle: meta("meta[property='og:title']"),
    copyright,
    logoHints: logoHints.filter(Boolean),
    headings,
    controls: Array.from(controls),
    overlays,
    forms,
    downloads,
    phones,
    wallets,
    hasContactLink,
    hasReturnsLink,
    linkCount,
    text,
  };
}
