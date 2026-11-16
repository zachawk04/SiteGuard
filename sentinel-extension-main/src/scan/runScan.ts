// src/scan/runScan.ts
//
// One scan, start to finish:
//   1. Read the page (extractor injected into every frame)
//   2. Ask the model which brand the page presents itself as, and compare
//      that with the real domain using the brand table
//   3. Ask the model for scam patterns, keeping only findings whose quoted
//      evidence really appears on the page
//   4. Compute the verdict in code. The model never assigns a score, so a
//      page can't talk its way to a "safe" result.
import { getLanguageModelApi, MODEL_OPTIONS, type LanguageModelSession } from "../ai/localAi";
import { findBrand, matchOfficialDomain } from "./brands";
import { extractPageData } from "./extractPage";
import { wellKnownSiteFor } from "./trustedSites";
import {
  AI_CATEGORIES,
  buildIdentityPrompt,
  buildPatternsPrompt,
  IDENTITY_SCHEMA,
  IDENTITY_SYSTEM,
  PATTERNS_SCHEMA,
  PATTERNS_SYSTEM,
  type IdentityAnswer,
} from "./prompts";
import type {
  BrandCheck,
  Finding,
  FieldKind,
  FrameData,
  ScanResult,
  ScanStage,
  Severity,
  Verdict,
} from "./types";

// Character budgets. Roughly 4 characters per token, kept well under
// Gemini Nano's input limit. Shrunk automatically if Chrome says it's too much.
const IDENTITY_BUDGET = 2500;
const PATTERNS_BUDGET = 6000;

const SENSITIVE: FieldKind[] = ["password", "card", "cvv", "otp", "ssn"];

/** Returns a reason the page can't be scanned, or null if it can. */
export function unscannableReason(url: string | undefined): string | null {
  if (!url) return "There's no page open in this tab.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Sentinel can't read this page's address.";
  }
  if (parsed.protocol === "file:") return null; // allowed if the user enabled file access
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Chrome doesn't let extensions read its own pages, such as settings and the new tab page. Open a website to check it.";
  }
  if (
    parsed.hostname === "chromewebstore.google.com" ||
    (parsed.hostname === "chrome.google.com" && parsed.pathname.startsWith("/webstore"))
  ) {
    return "Chrome doesn't let extensions read the Chrome Web Store.";
  }
  return null;
}

// ------------------------------------------------------------------
// Step 1: read the page
// ------------------------------------------------------------------
async function collectFrames(tabId: number): Promise<{ top: FrameData; frames: FrameData[] }> {
  let results: chrome.scripting.InjectionResult<FrameData>[];
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: extractPageData,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/file/i.test(msg)) {
      throw new Error(
        "To check files on this computer, turn on \"Allow access to file URLs\" for Sentinel in chrome://extensions.",
      );
    }
    throw new Error(`Sentinel couldn't read this page: ${msg}`);
  }

  const top = results.find((r) => r.frameId === 0)?.result;
  if (!top) throw new Error("Sentinel couldn't read this page. Reload it and try again.");

  // Keep embedded frames that matter: ones with sensitive forms, or big
  // enough with enough text to be part of what the visitor sees. This skips
  // the dozens of tiny ad and tracking frames on most pages.
  const subframes = results
    .filter((r) => r.frameId !== 0 && r.result)
    .map((r) => r.result as FrameData)
    .filter(
      (f) =>
        f.forms.length > 0 ||
        (f.width * f.height >= 200 * 150 && f.text.length >= 200),
    )
    .slice(0, 4);

  return { top, frames: [top, ...subframes] };
}

// ------------------------------------------------------------------
// Prompting
// ------------------------------------------------------------------
async function fitsContext(session: LanguageModelSession, text: string): Promise<boolean> {
  const measure = session.measureContextUsage ?? session.measureInputUsage;
  const quota = session.contextWindow ?? session.inputQuota;
  if (!measure || !quota) return true; // can't measure; rely on character budgets
  const used = session.contextUsage ?? session.inputUsage ?? 0;
  const needed = await measure.call(session, text);
  return needed + 400 <= quota - used; // leave room for the answer
}

function parseJson(raw: string): unknown {
  const stripped = raw.replace(/```(?:json)?/gi, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Local AI returned an answer Sentinel couldn't read. Try again.");
  }
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new Error("Local AI returned an answer Sentinel couldn't read. Try again.");
  }
}

async function runPrompt(
  system: string,
  schema: object,
  build: (budget: number) => { user: string; content: string },
  startBudget: number,
  signal: AbortSignal,
): Promise<{ answer: unknown; content: string }> {
  const api = getLanguageModelApi();
  if (!api) throw new Error("Local AI isn't available in this browser.");

  const session = await api.create({
    ...MODEL_OPTIONS,
    initialPrompts: [{ role: "system", content: system }],
    signal,
  });
  try {
    let budget = startBudget;
    for (let attempt = 0; attempt < 3; attempt++) {
      const built = build(budget);
      if (!(await fitsContext(session, built.user))) {
        budget = Math.floor(budget * 0.6);
        continue;
      }
      try {
        const raw = await session.prompt(built.user, { responseConstraint: schema, signal });
        return { answer: parseJson(raw), content: built.content };
      } catch (err) {
        if (err instanceof DOMException && err.name === "QuotaExceededError") {
          budget = Math.floor(budget * 0.6);
          continue;
        }
        throw err;
      }
    }
    throw new Error("This page has more content than Local AI can read at once.");
  } finally {
    session.destroy();
  }
}

// ------------------------------------------------------------------
// Checking the model's answers
// ------------------------------------------------------------------
const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
const bare = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");

/**
 * True if the quote appears on the page. Small models sometimes invent
 * quotes; findings that fail this check are dropped. Matching ignores case,
 * spacing, and punctuation, and allows "..." to skip words.
 */
function quoteIsOnPage(evidence: string, pageNorm: string, pageBare: string): boolean {
  const parts = norm(evidence)
    .replace(/^["']+|["']+$/g, "")
    .split(/…|\.\.\./)
    .filter((p) => bare(p).length >= 4);
  if (parts.length === 0) return false;
  return parts.every((p) => pageNorm.includes(p.trim()) || pageBare.includes(bare(p)));
}

const SEVERITIES: Severity[] = ["low", "medium", "high"];

function cleanAiFindings(answer: unknown, content: string) {
  const list = (answer as { findings?: unknown })?.findings;
  const raw = Array.isArray(list) ? list : [];
  const pageNorm = norm(content);
  const pageBare = bare(content);
  const kept: Finding[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const item of raw.slice(0, 10)) {
    const f = item as Record<string, unknown>;
    const category = f.category as Finding["category"];
    const severity = f.severity as Severity;
    const evidence = typeof f.evidence === "string" ? f.evidence.slice(0, 240) : "";
    const explanation = typeof f.explanation === "string" ? f.explanation.slice(0, 220) : "";
    if (!AI_CATEGORIES.includes(category) || !SEVERITIES.includes(severity) || !explanation) {
      dropped++;
      continue;
    }
    if (!quoteIsOnPage(evidence, pageNorm, pageBare)) {
      console.info("Sentinel: dropped finding with unverified quote", f);
      dropped++;
      continue;
    }
    const key = `${category}|${bare(evidence)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ category, severity, evidence, explanation, source: "ai" });
  }
  return { findings: kept.slice(0, 6), dropped };
}

const lower = (s: Severity): Severity => (s === "high" ? "medium" : "low");

function checkBrand(
  identity: IdentityAnswer,
  hostname: string,
  hasSensitiveForm: boolean,
): { brand: BrandCheck; finding?: Finding } {
  const claimed = (identity.brand ?? "").trim();
  if (!claimed || /^(unknown|none)$/i.test(claimed)) return { brand: { status: "none" } };

  const entry = findBrand(claimed);
  if (!entry) {
    // Not in the brand table. Only worth mentioning when the page wants a
    // password or payment details; otherwise it's just noise.
    return hasSensitiveForm
      ? { brand: { status: "unverified", brand: claimed.slice(0, 60) } }
      : { brand: { status: "none" } };
  }

  const official = matchOfficialDomain(entry, hostname);
  if (official) return { brand: { status: "official", brand: entry.name, domain: official } };

  let severity: Severity = hasSensitiveForm ? "high" : "medium";
  if (identity.confidence === "low") severity = lower(severity);
  return {
    brand: { status: "mismatch", brand: entry.name, officialDomains: entry.domains },
    finding: {
      category: "brand_impersonation",
      severity,
      source: "ai",
      explanation: hasSensitiveForm
        ? `This page looks like ${entry.name} and asks for sensitive information, but it isn't on ${entry.name}'s website.`
        : `This page presents itself as ${entry.name}, but it isn't on ${entry.name}'s website.`,
    },
  };
}

/**
 * High severity means "likely scam". Medium means "warning signs". Low
 * findings alone are too weak to turn a page yellow; they're shown as
 * minor notes under a clear verdict.
 */
function computeVerdict(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === "high")) return "danger";
  if (findings.some((f) => f.severity === "medium")) return "caution";
  return "clear";
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

// ------------------------------------------------------------------
// The scan
// ------------------------------------------------------------------
export async function runScan(
  tabId: number,
  onStage: (stage: ScanStage) => void,
  signal: AbortSignal,
): Promise<ScanResult> {
  const started = Date.now();

  onStage("reading");
  const { top, frames } = await collectFrames(tabId);
  signal.throwIfAborted();

  // Well-known sites skip the AI. The check uses the address the page is
  // actually on, so lookalike domains still get the full scan.
  const wellKnown = wellKnownSiteFor(top.hostname);
  if (wellKnown) {
    return {
      url: top.url,
      hostname: top.hostname,
      scannedAt: Date.now(),
      durationMs: Date.now() - started,
      verdict: "clear",
      wellKnown,
      brand: { status: "none" },
      findings: [],
      droppedFindings: 0,
    };
  }

  const allForms = frames.flatMap((f) => f.forms);
  const sensitiveForms = allForms.filter((f) => f.kinds.some((k) => SENSITIVE.includes(k)));
  const totalText = frames.reduce((n, f) => n + f.text.length, 0);
  if (totalText < 20 && allForms.length === 0) {
    throw new Error("This page has almost no readable text, so there's nothing for Local AI to check.");
  }

  const findings: Finding[] = [];

  // Sentinel's own check: sensitive details sent without encryption.
  if (sensitiveForms.some((f) => f.actionIsHttp)) {
    findings.push({
      category: "insecure_form",
      severity: "high",
      source: "page",
      explanation:
        "This page asks for a password or payment details over an insecure connection, so they could be intercepted.",
    });
  }

  onStage("identity");
  const identityRun = await runPrompt(
    IDENTITY_SYSTEM,
    IDENTITY_SCHEMA,
    (budget) => buildIdentityPrompt(top, frames, budget),
    IDENTITY_BUDGET,
    signal,
  );
  const identity = identityRun.answer as IdentityAnswer;

  onStage("patterns");
  const patternsRun = await runPrompt(
    PATTERNS_SYSTEM,
    PATTERNS_SCHEMA,
    (budget) => buildPatternsPrompt(top, frames, budget),
    PATTERNS_BUDGET,
    signal,
  );
  const { findings: aiFindings, dropped } = cleanAiFindings(
    patternsRun.answer,
    patternsRun.content,
  );

  const brandResult = checkBrand(identity, top.hostname, sensitiveForms.length > 0);
  if (brandResult.finding) {
    // A fake brand plus "your account will be suspended" is a classic
    // phishing combination, whatever the individual severities were.
    if (aiFindings.some((f) => f.category === "credential_pressure")) {
      brandResult.finding.severity = "high";
    }
    findings.push(brandResult.finding);
  }
  findings.push(...aiFindings);
  findings.sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  return {
    url: top.url,
    hostname: top.hostname,
    scannedAt: Date.now(),
    durationMs: Date.now() - started,
    verdict: computeVerdict(findings),
    brand: brandResult.brand,
    findings,
    droppedFindings: dropped,
  };
}
