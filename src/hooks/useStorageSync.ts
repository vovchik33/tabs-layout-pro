import { useEffect } from "react";

export function useStorageSync(keys: string[], onChange: () => void): void {
  useEffect(() => {
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName
    ) => {
      if (areaName !== "sync" || !keys.some((key) => key in changes)) return;
      onChange();
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [keys, onChange]);
}
