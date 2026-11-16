// src/ai/localAi.ts
//
// Thin wrapper around Chrome's built-in Prompt API (the `LanguageModel`
// global, backed by Gemini Nano). Only extension pages (popup, side panel)
// should import this. Web pages and MAIN-world content scripts don't get the
// API without developer flags.
//
// Chrome reports one of four states for the model:
//   "unavailable"  - this device or browser can't run it
//   "downloadable" - supported, but the model isn't on disk yet
//   "downloading"  - a download is in progress
//   "available"    - ready to use
// We add "unsupported" for browsers where the API doesn't exist at all.

export type LocalAiStatus =
  | "unsupported"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

// Minimal typings for the parts of the Prompt API we use. Written by hand
// because @types/chrome doesn't cover the `LanguageModel` global.
type LanguageDescriptor = { type: "text"; languages: string[] };

type LanguageModelOptions = {
  expectedInputs?: LanguageDescriptor[];
  expectedOutputs?: LanguageDescriptor[];
};

type DownloadProgressEvent = Event & { loaded: number; total?: number };

type CreateMonitor = {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
};

export type LanguageModelSession = {
  prompt(
    input: string,
    options?: { responseConstraint?: object; signal?: AbortSignal },
  ): Promise<string>;
  destroy(): void;
  // Token budget. Chrome renamed these at one point, so both spellings are
  // declared and callers use whichever exists.
  contextWindow?: number;
  contextUsage?: number;
  measureContextUsage?(input: string): Promise<number>;
  inputQuota?: number;
  inputUsage?: number;
  measureInputUsage?(input: string): Promise<number>;
};

type LanguageModelStatic = {
  availability(
    options?: LanguageModelOptions,
  ): Promise<Exclude<LocalAiStatus, "unsupported">>;
  create(
    options?: LanguageModelOptions & {
      monitor?: (monitor: CreateMonitor) => void;
      signal?: AbortSignal;
      initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
    },
  ): Promise<LanguageModelSession>;
};

// The scanner reads and answers in English. Declaring this up front lets
// Chrome report availability for the exact configuration we'll use, and
// avoids the "no output language specified" warning.
export const MODEL_OPTIONS: LanguageModelOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

export function getLanguageModelApi(): LanguageModelStatic | null {
  const api = (globalThis as { LanguageModel?: LanguageModelStatic })
    .LanguageModel;
  return api && typeof api.availability === "function" ? api : null;
}

/**
 * Ask Chrome whether the model can run here. Always call this rather than
 * trusting a saved flag: Chrome deletes the model when disk space runs low.
 */
export async function checkLocalAiStatus(): Promise<LocalAiStatus> {
  const api = getLanguageModelApi();
  if (!api) return "unsupported";
  try {
    return await api.availability(MODEL_OPTIONS);
  } catch {
    return "unavailable";
  }
}

/**
 * Download the model, reporting progress as a fraction from 0 to 1.
 *
 * Must be called directly from a click handler. Chrome refuses to start
 * (or attach to) a download without a recent user gesture.
 *
 * Resolves once the model is installed and loads successfully.
 */
export async function downloadLocalAi(
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const api = getLanguageModelApi();
  if (!api) {
    throw new Error("This version of Chrome doesn't include Local AI.");
  }

  const session = await api.create({
    ...MODEL_OPTIONS,
    signal,
    monitor(m) {
      m.addEventListener("downloadprogress", (event) => {
        // Current Chrome reports `loaded` as a 0–1 fraction. Older builds
        // reported bytes with a separate `total`.
        const fraction =
          event.total && event.total > 1
            ? event.loaded / event.total
            : event.loaded;
        onProgress(Math.min(1, Math.max(0, fraction)));
      });
    },
  });

  // We only created the session to trigger the download.
  session.destroy();
}

/** Turn a Prompt API error into a sentence a user can act on. */
export function describeLocalAiError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
      return "Chrome only starts the download from a click. Select Enable Local AI again.";
    case "NotSupportedError":
      return "This device can't run Local AI with English input and output.";
    case "QuotaExceededError":
      return "There isn't enough free disk space for the model. Free up space and try again.";
    case "NetworkError":
      return "The download was interrupted. Check your connection and try again.";
    case "AbortError":
      return "The download was cancelled.";
    case "InvalidStateError":
      return "Chrome couldn't load the model. Restart Chrome and try again.";
    default:
      return err instanceof Error && err.message
        ? `Local AI setup failed: ${err.message}`
        : "Local AI setup failed for an unknown reason.";
  }
}
