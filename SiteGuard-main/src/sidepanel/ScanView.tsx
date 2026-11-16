// src/sidepanel/ScanView.tsx
//
// Shown once Local AI is ready. Follows the active tab: each tab keeps its
// own result until it navigates away, and switching tabs cancels a scan
// that's still running.
import { useEffect, useState, type ReactNode } from "react";
import { runScan, unscannableReason } from "../scan/runScan";
import type {
  BrandCheck,
  Finding,
  FindingCategory,
  ScanResult,
  ScanStage,
  Severity,
  Verdict,
} from "../scan/types";
import { PrimaryButton, SecondaryButton } from "./buttons";
import { samePage, useActiveTab } from "./useActiveTab";

type Running = { tabId: number; url: string; stage: ScanStage; controller: AbortController };
type Stored = { url: string; result: ScanResult };
type ScanFailure = { tabId: number; url: string; message: string };

const STAGES: { id: ScanStage; label: string }[] = [
  { id: "reading", label: "Reading the page" },
  { id: "identity", label: "Working out who the page claims to be" },
  { id: "patterns", label: "Looking for scam patterns" },
];

const CATEGORY_TITLES: Record<FindingCategory, string> = {
  brand_impersonation: "Pretends to be another company",
  insecure_form: "Sensitive details sent without encryption",
  tech_support_scam: "Fake virus or tech support warning",
  fake_captcha: "Fake verification that asks you to run commands",
  fake_update_download: "Fake update or download",
  credential_pressure: "Pressure to sign in or verify your account",
  payment_demand: "Unusual payment request",
  fake_store: "Signs of a fake store",
  investment_crypto_scam: "Investment or crypto scam signs",
  prize_scam: "Prize or giveaway scam signs",
  instructions_to_ai: "Text trying to manipulate scanners",
};

const VERDICTS: Record<Verdict, { title: string; advice: string; panel: string; bar: string }> = {
  danger: {
    title: "Likely scam",
    advice: "Don't sign in, pay, download anything, or call any number on this page.",
    panel: "bg-red-950/50 text-red-100",
    bar: "bg-red-500",
  },
  caution: {
    title: "Some warning signs",
    advice: "Read the findings below before you enter anything on this page.",
    panel: "bg-amber-950/40 text-amber-50",
    bar: "bg-amber-400",
  },
  clear: {
    title: "No warning signs found",
    advice: "Local AI didn't spot anything suspicious. It can still miss things.",
    panel: "bg-emerald-950/40 text-emerald-50",
    bar: "bg-emerald-500",
  },
};

const SEVERITY_STYLE: Record<Severity, { label: string; className: string }> = {
  high: { label: "High", className: "bg-red-500/20 text-red-200 ring-red-500/40" },
  medium: { label: "Medium", className: "bg-amber-500/20 text-amber-100 ring-amber-500/40" },
  low: { label: "Low", className: "bg-slate-500/20 text-slate-200 ring-slate-500/40" },
};

const BADGES: Record<Verdict, { text: string; color: string }> = {
  danger: { text: "!", color: "#dc2626" },
  caution: { text: "?", color: "#d97706" },
  clear: { text: "✓", color: "#16a34a" },
};

function setBadge(tabId: number, verdict: Verdict) {
  const badge = BADGES[verdict];
  chrome.action.setBadgeText({ tabId, text: badge.text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color }).catch(() => {});
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function describeScanError(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotSupportedError") {
    return "Local AI couldn't process this page's language or content.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "The scan failed for an unknown reason. Try again.";
}

export default function ScanView() {
  const tab = useActiveTab();
  const [running, setRunning] = useState<Running | null>(null);
  const [results, setResults] = useState<Map<number, Stored>>(() => new Map());
  const [failure, setFailure] = useState<ScanFailure | null>(null);

  // Leaving the page (switching tabs or navigating) cancels its scan.
  useEffect(() => {
    if (!running || !tab) return;
    if (running.tabId !== tab.id || !samePage(running.url, tab.url)) {
      running.controller.abort();
    }
  }, [tab, running]);

  if (!tab) {
    return <p className="text-sm text-slate-400" role="status">Finding the current tab…</p>;
  }

  const startScan = () => {
    const controller = new AbortController();
    const target = { tabId: tab.id, url: tab.url };
    setFailure(null);
    setRunning({ ...target, stage: "reading", controller });

    runScan(
      target.tabId,
      (stage) =>
        setRunning((r) => (r && r.controller === controller ? { ...r, stage } : r)),
      controller.signal,
    )
      .then((result) => {
        setResults((prev) => new Map(prev).set(target.tabId, { url: target.url, result }));
        setBadge(target.tabId, result.verdict);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({ ...target, message: describeScanError(err) });
      })
      .finally(() => {
        setRunning((r) => (r && r.controller === controller ? null : r));
      });
  };

  const isHere = (x: { tabId: number; url: string } | null) =>
    !!x && x.tabId === tab.id && samePage(x.url, tab.url);

  if (running && isHere(running)) {
    return <Scanning stage={running.stage} onCancel={() => running.controller.abort()} />;
  }

  const stored = results.get(tab.id);
  if (stored && samePage(stored.url, tab.url)) {
    return <Results result={stored.result} onRescan={startScan} />;
  }

  const blocked = unscannableReason(tab.url);
  return (
    <Idle
      host={hostOf(tab.url)}
      blockedReason={blocked}
      error={isHere(failure) ? failure!.message : ""}
      busyElsewhere={running !== null}
      onScan={startScan}
    />
  );
}

// ------------------------------------------------------------------

function Idle(props: {
  host: string;
  blockedReason: string | null;
  error: string;
  busyElsewhere: boolean;
  onScan: () => void;
}) {
  return (
    <section className="space-y-4 text-sm leading-relaxed text-slate-300">
      <h2 className="text-xl font-semibold leading-snug text-slate-50">Check this page</h2>
      {props.blockedReason ? (
        <p>{props.blockedReason}</p>
      ) : (
        <>
          <p>
            Local AI reads <span className="font-medium text-slate-100">{props.host}</span> on
            this device and looks for phishing, fake warnings, and other scams.
          </p>
          <PrimaryButton onClick={props.onScan} disabled={props.busyElsewhere}>
            Check this page for threats
          </PrimaryButton>
          <p className="text-xs text-slate-400">
            {props.busyElsewhere
              ? "Another tab is being checked. Wait for it to finish."
              : "A check usually takes 10 to 60 seconds."}
          </p>
        </>
      )}
      {props.error && (
        <div role="alert" className="rounded-md border border-red-800 bg-red-950/60 p-3 text-red-200">
          {props.error}
        </div>
      )}
    </section>
  );
}

function Scanning({ stage, onCancel }: { stage: ScanStage; onCancel: () => void }) {
  const current = STAGES.findIndex((s) => s.id === stage);
  return (
    <section className="space-y-5 text-sm text-slate-300" aria-live="polite">
      <h2 className="text-xl font-semibold text-slate-50">Checking this page</h2>
      <ol className="space-y-3">
        {STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-cyan-600 text-white"
                    : active
                      ? "border-2 border-cyan-400 text-cyan-300 motion-safe:animate-pulse"
                      : "border border-slate-600 text-slate-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={active ? "font-medium text-slate-50" : done ? "text-slate-300" : "text-slate-500"}>
                {s.label}
                <span className="sr-only">{done ? " (done)" : active ? " (in progress)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
    </section>
  );
}

function Results({ result, onRescan }: { result: ScanResult; onRescan: () => void }) {
  const v = VERDICTS[result.verdict];
  const time = new Date(result.scannedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const secs = Math.max(1, Math.round(result.durationMs / 1000));
  const onlyMinor = result.verdict === "clear" && result.findings.length > 0;

  let title = v.title;
  let advice = v.advice;
  if (result.wellKnown) {
    title = "Well-known website";
    advice = `${result.wellKnown} is an established, widely used website, so Sentinel trusts it without an AI check.`;
  } else if (onlyMinor) {
    advice = "Local AI noted a few minor things below. None of them are strong signs of a scam.";
  }

  return (
    <section className="space-y-5 text-sm leading-relaxed text-slate-300">
      <div className={`relative overflow-hidden rounded-md p-4 pl-5 ${v.panel}`}>
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${v.bar}`} />
        <h2 className="text-2xl font-bold leading-tight">{title}</h2>
        <p className="mt-1 opacity-90">{advice}</p>
      </div>

      {result.wellKnown && (
        <p>
          This applies only to the real {result.wellKnown}. Lookalike addresses, and pages
          that anyone can publish on big sites (such as Google Sites or SharePoint), still
          get a full check.
        </p>
      )}

      <BrandLine brand={result.brand} />

      {result.findings.length > 0 && (
        <div className="space-y-3">
          {onlyMinor && <h3 className="font-semibold text-slate-100">Minor notes</h3>}
          <ul className="space-y-3">
            {result.findings.map((f, i) => (
              <FindingItem key={i} finding={f} />
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 border-t border-slate-700 pt-4">
        <p className="text-xs text-slate-400">
          {result.wellKnown
            ? `Checked ${result.hostname} at ${time}.`
            : `Checked ${result.hostname} at ${time} in ${secs} ${secs === 1 ? "second" : "seconds"}. Local AI can miss scams or flag safe pages, so treat this as a second opinion.`}
        </p>
        <SecondaryButton onClick={onRescan}>Check again</SecondaryButton>
      </div>
    </section>
  );
}

function BrandLine({ brand }: { brand: BrandCheck }) {
  let text: ReactNode;
  switch (brand.status) {
    case "none":
      return null;
    case "official":
      text = <>Presents itself as {brand.brand}, and it's on {brand.brand}'s website ({brand.domain}).</>;
      break;
    case "mismatch":
      text = (
        <>
          Presents itself as {brand.brand}, but {brand.brand}'s real website is{" "}
          {brand.officialDomains.slice(0, 2).join(" or ")}.
        </>
      );
      break;
    case "unverified":
      text = (
        <>
          Presents itself as {brand.brand} and asks for sensitive information. Sentinel
          doesn't have {brand.brand}'s official website on file, so check the address
          yourself before signing in.
        </>
      );
      break;
  }
  return <p className="text-slate-300">{text}</p>;
}

function FindingItem({ finding }: { finding: Finding }) {
  const sev = SEVERITY_STYLE[finding.severity];
  return (
    <li className="rounded-md border border-slate-700 bg-slate-800/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-50">{CATEGORY_TITLES[finding.category]}</h3>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ring-1 ${sev.className}`}>
          {sev.label}
        </span>
      </div>
      <p className="mt-1 text-slate-300">{finding.explanation}</p>
      {finding.evidence && (
        <blockquote className="mt-2 border-l-2 border-slate-500 pl-3 text-slate-400 [overflow-wrap:anywhere]">
          “{finding.evidence}”
        </blockquote>
      )}
    </li>
  );
}
