import type { SampleAssetRef } from "./patch-types";
import { isFiniteNumber, isRecord } from "./runtime-type-guards.ts";

export type StoredSample = { ref: SampleAssetRef; samples: Float32Array };
const DATABASE="patchwork-web-assets",STORE="samples";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open sample storage"));
  });
}

export async function putSample(sample: StoredSample): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put({ ref: sample.ref, samples: sample.samples }, sample.ref.storageKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save sample"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not save sample"));
    });
  } finally {
    database.close();
  }
}

function isStoredSample(value: unknown): value is StoredSample {
  if (!isRecord(value) || !isRecord(value.ref) || !(value.samples instanceof Float32Array)) return false;
  return typeof value.ref.storageKey === "string" && typeof value.ref.name === "string" &&
    isFiniteNumber(value.ref.sampleRate) && isFiniteNumber(value.ref.channels) &&
    isFiniteNumber(value.ref.frames);
}

export async function getSample(storageKey: string): Promise<StoredSample | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise<StoredSample | undefined>((resolve, reject) => {
      const request = database.transaction(STORE).objectStore(STORE).get(storageKey);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(value === undefined ? undefined : isStoredSample(value) ? value : undefined);
      };
      request.onerror = () => reject(request.error ?? new Error("Could not read sample"));
    });
  } finally {
    database.close();
  }
}
