export type StorageArea = "sync" | "local";

function getStorageArea(area: StorageArea) {
  return area === "local" ? chrome.storage.local : chrome.storage.sync;
}

export function getStorageData<T>(
  key: string,
  defaultValue: T,
  area: StorageArea = "sync"
): Promise<T> {
  return new Promise((resolve, reject) => {
    getStorageArea(area).get({ [key]: defaultValue }, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result[key] as T);
    });
  });
}

export function setStorageData<T>(
  key: string,
  value: T,
  area: StorageArea = "sync"
): Promise<void> {
  return new Promise((resolve, reject) => {
    getStorageArea(area).set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}
