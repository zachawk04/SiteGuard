// src/ai/useLocalAiStatus.ts
import { useCallback, useEffect, useState } from "react";
import { checkLocalAiStatus, type LocalAiStatus } from "./localAi";

export type LocalAiUiStatus = LocalAiStatus | "checking";

const DOWNLOAD_POLL_MS = 3000;

/**
 * Tracks whether Local AI is usable. Re-checks when the page becomes
 * visible again, and polls while Chrome reports a download in progress
 * so the UI flips to "ready" without the user doing anything.
 */
export function useLocalAiStatus() {
  const [status, setStatus] = useState<LocalAiUiStatus>("checking");

  const refresh = useCallback(async () => {
    const next = await checkLocalAiStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkLocalAiStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (status !== "downloading") return;
    const timer = setInterval(() => void refresh(), DOWNLOAD_POLL_MS);
    return () => clearInterval(timer);
  }, [status, refresh]);

  return { status, setStatus, refresh };
}
