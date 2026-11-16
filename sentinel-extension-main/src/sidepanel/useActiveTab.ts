// src/sidepanel/useActiveTab.ts
import { useEffect, useState } from "react";

export type ActiveTab = { id: number; url: string; title: string };

/**
 * The active tab in the window this side panel belongs to. Updates when the
 * user switches tabs or the page navigates.
 */
export function useActiveTab(): ActiveTab | null {
  const [tab, setTab] = useState<ActiveTab | null>(null);

  useEffect(() => {
    const update = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const t = tabs[0];
        setTab(
          t?.id !== undefined
            ? { id: t.id, url: t.url ?? "", title: t.title ?? "" }
            : null,
        );
      });
    };

    const onUpdated = (
      _tabId: number,
      info: chrome.tabs.OnUpdatedInfo,
      t: chrome.tabs.Tab,
    ) => {
      if (t.active && (info.url || info.title || info.status === "complete")) update();
    };

    update();
    chrome.tabs.onActivated.addListener(update);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(update);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return tab;
}

/** Two URLs are the same page if they differ only by #fragment. */
export function samePage(a: string, b: string): boolean {
  return a.split("#")[0] === b.split("#")[0];
}
