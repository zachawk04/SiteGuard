// src/sidepanel/SidePanel.tsx
//
// Home of the AI threat scanner:
//   - detect whether Chrome can run its built-in model on this device
//   - let the user opt in and download it, with progress
//   - once ready, hand off to ScanView for page checks
//
// The side panel stays open while the user browses, unlike the popup,
// so a multi-gigabyte download isn't cut off by a stray click.
import { useState, type ReactNode } from "react";
import { describeLocalAiError, downloadLocalAi } from "../ai/localAi";
import { useLocalAiStatus } from "../ai/useLocalAiStatus";
import { PrimaryButton, SecondaryButton } from "./buttons";
import ScanView from "./ScanView";

const MODEL_STATUS_PAGE = "chrome://on-device-internals";

function openModelStatusPage() {
  chrome.tabs.create({ url: MODEL_STATUS_PAGE }).catch(() => {
    // Some managed browsers block chrome:// pages; nothing else to do.
  });
}

export default function SidePanel() {
  const { status, refresh } = useLocalAiStatus();
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  // Called straight from a click: Chrome only permits the download
  // during a user gesture, so nothing may be awaited before it starts.
  const startDownload = () => {
    setError("");
    setProgress(0);
    setInstalling(true);
    downloadLocalAi(setProgress)
      .catch((err: unknown) => setError(describeLocalAiError(err)))
      .finally(() => {
        setInstalling(false);
        void refresh();
      });
  };

  let body: ReactNode;

  if (installing) {
    body = <Installing progress={progress} />;
  } else {
    switch (status) {
      case "checking":
        body = (
          <p className="text-sm text-slate-400" role="status">
            Checking whether this device can run Local AI…
          </p>
        );
        break;

      case "unsupported":
        body = (
          <Screen title="Local AI needs a newer version of Chrome">
            <p>
              Threat checks use the AI model built into Chrome 138 and later on
              Windows, macOS, Linux, and Chromebook Plus. Update Chrome, then
              reopen this panel.
            </p>
            <SecondaryButton onClick={() => void refresh()}>
              Check again
            </SecondaryButton>
          </Screen>
        );
        break;

      case "unavailable":
        body = (
          <Screen title="This device can't run Local AI">
            <p>Chrome decides whether a device can run its built-in model. The usual reasons it can't:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Less than 22 GB of free space on the drive that holds your Chrome profile.</li>
              <li>
                Not enough memory: Chrome needs a graphics card with more than
                4 GB of memory, or 16 GB of RAM and at least 4 CPU cores.
              </li>
              <li>Your organization has turned off Chrome's built-in AI.</li>
            </ul>
            <p>Chrome's model status page shows the exact reason.</p>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={openModelStatusPage}>
                Open model status page
              </SecondaryButton>
              <SecondaryButton onClick={() => void refresh()}>
                Check again
              </SecondaryButton>
            </div>
          </Screen>
        );
        break;

      case "downloadable":
        body = (
          <Screen title="Set up Local AI">
            <p>
              Sentinel can check pages for scams and phishing using an AI model
              that runs on this computer. Page content is never sent anywhere.
            </p>
            <p>
              Setup downloads Chrome's built-in model, which is a few gigabytes.
              Chrome needs at least 22 GB of free disk space and an unmetered
              connection to download it.
            </p>
            <PrimaryButton onClick={startDownload}>Enable Local AI</PrimaryButton>
          </Screen>
        );
        break;

      case "downloading":
        body = (
          <Screen title="Chrome is downloading Local AI">
            <p>
              A download is already in progress. This panel updates when it
              finishes.
            </p>
            <IndeterminateBar />
            <SecondaryButton onClick={startDownload}>
              Show download progress
            </SecondaryButton>
          </Screen>
        );
        break;

      case "available":
        body = <ScanView />;
        break;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6 font-sans">
      <header className="mb-6 border-b border-slate-700 pb-4">
        <h1 className="text-lg font-bold text-cyan-400">Sentinel threat scanner</h1>
      </header>

      {body}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-800 bg-red-950/60 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}
    </main>
  );
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 text-sm leading-relaxed text-slate-300">
      <h2 className="text-xl font-semibold leading-snug text-slate-50">{title}</h2>
      {children}
    </section>
  );
}

function Installing({ progress }: { progress: number }) {
  const percent = Math.round(progress * 100);
  const finishing = progress >= 1;
  return (
    <Screen title={finishing ? "Finishing setup" : "Downloading Local AI"}>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-3xl font-bold tabular-nums text-slate-50">
            {percent}%
          </span>
          <span className="text-xs text-slate-400" role="status">
            {finishing ? "Loading the model…" : "Downloading…"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Local AI download"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-cyan-500 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <p>
        You can keep browsing in other tabs. Keep this panel open until setup
        finishes.
      </p>
    </Screen>
  );
}

function IndeterminateBar() {
  return (
    <div
      role="progressbar"
      aria-label="Local AI download"
      className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
    >
      <div className="h-full w-1/3 rounded-full bg-cyan-500/70 motion-safe:animate-pulse" />
    </div>
  );
}
