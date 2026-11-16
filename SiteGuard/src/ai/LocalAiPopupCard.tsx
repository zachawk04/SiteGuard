// src/ai/LocalAiPopupCard.tsx
//
// Replaces the old "AI Trust Score" circle in the popup. Shows whether
// Local AI is ready and opens the side panel, where setup and scanning live.
// The popup closes as soon as the user clicks elsewhere, so long-running
// work (downloads, scans) must not happen here.
import { useEffect, useState } from "react";
import { useLocalAiStatus, type LocalAiUiStatus } from "./useLocalAiStatus";

const STATUS_TEXT: Record<LocalAiUiStatus, string> = {
  checking: "Checking Local AI…",
  unsupported: "Local AI needs a newer version of Chrome.",
  unavailable: "This device can't run Local AI.",
  downloadable: "Local AI is off. Set it up to check pages for scams.",
  downloading: "Local AI is downloading.",
  available: "Local AI is ready.",
};

const STATUS_DOT: Record<LocalAiUiStatus, string> = {
  checking: "bg-slate-500",
  unsupported: "bg-slate-500",
  unavailable: "bg-slate-500",
  downloadable: "bg-amber-400",
  downloading: "bg-cyan-400 animate-pulse",
  available: "bg-emerald-400",
};

export default function LocalAiPopupCard({ isSecure }: { isSecure: boolean }) {
  const { status } = useLocalAiStatus();
  const [windowId, setWindowId] = useState<number | null>(null);
  const [openError, setOpenError] = useState("");

  // Look up the window now so the click handler can call sidePanel.open()
  // immediately. Chrome only allows opening the panel during a user gesture,
  // and awaiting other calls first can lose it.
  useEffect(() => {
    chrome.windows?.getCurrent((win) => {
      if (win?.id !== undefined) setWindowId(win.id);
    });
  }, []);

  const openScanner = () => {
    setOpenError("");
    if (windowId === null || !chrome.sidePanel?.open) {
      setOpenError("Chrome couldn't open the side panel. Update Chrome and try again.");
      return;
    }
    chrome.sidePanel
      .open({ windowId })
      .then(() => window.close())
      .catch((err: unknown) => {
        setOpenError(
          `Chrome couldn't open the side panel: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  };

  const buttonLabel =
    status === "downloadable" ? "Set up Local AI" : "Open threat scanner";
  const buttonDisabled = status === "checking";

  return (
    <section className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
      <h2 className="text-base font-semibold text-slate-100">Threat check</h2>

      <p className="mt-2 flex items-start gap-2 text-sm text-slate-300">
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`}
        />
        <span role="status">{STATUS_TEXT[status]}</span>
      </p>

      <p
        className={`mt-1 pl-4 text-xs ${isSecure ? "text-slate-400" : "text-amber-300"}`}
      >
        {isSecure
          ? "This page uses a secure connection."
          : "This page isn't secure. Don't enter passwords or payment details."}
      </p>

      <button
        type="button"
        onClick={openScanner}
        disabled={buttonDisabled}
        className="mt-4 w-full rounded-md bg-cyan-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>

      {openError && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {openError}
        </p>
      )}
    </section>
  );
}
