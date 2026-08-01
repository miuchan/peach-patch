import type { ModuleInstance, PatchDocument, SampleAssetRef } from "./patch-types";
import { stateFromData } from "./patch-state.ts";
import { snapRackPosition } from "./patch-operations.ts";
import type { WebPluginModule } from "./web-plugin-registry.ts";

export const emptyPatch: PatchDocument = { modules: [], cables: [] };
export const AUTOSAVE_KEY = "patchwork-web.autosave.v1";

export function newModuleId() { return `module-${crypto.randomUUID()}`; }

export function repairDuplicateModuleIds(patch: PatchDocument) {
  const seen = new Set<string>();
  let repaired = 0;
  const modules = patch.modules.map((module) => {
    if (!seen.has(module.id)) { seen.add(module.id); return module; }
    repaired++;
    const id = newModuleId();
    seen.add(id);
    return { ...module, id };
  });
  return { patch: repaired ? { ...patch, modules } : patch, repaired };
}

export function moduleFromDefinition(definition: WebPluginModule, x: number, y: number): ModuleInstance {
  return {
    id: newModuleId(), key: definition.key, plugin: definition.plugin,
    model: definition.model, version: definition.version, x, y,
    width: definition.width,
    params: definition.params.map((param) => param.initial ?? param.default),
    state: definition.key === "Stoermelder-P1/Stroke"
      ? [0, ...Array.from({ length: 10 }, () => [-1, -1, 0, 1, 0]).flat()]
      : definition.stateKeys?.some((item) => item.default !== undefined)
        ? definition.stateKeys.map((item) => item.default ?? 0) : undefined,
    stateKeys: definition.stateKeys, polyphony: definition.polyphonic ? 1 : undefined,
    bypassed: false, status: "ready", description: definition.description,
    screenshotUrl: definition.screenshotUrl, sourceUrl: definition.sourceUrl,
    license: definition.license,
  };
}

export function findOpenPosition(modules: ModuleInstance[], width: number, origin: { x: number; y: number }) {
  const start = snapRackPosition(origin);
  for (let row = 0; row < 24; row++) for (let column = 0; column < 240; column++) {
    const candidate = { x: start.x + column * 15, y: start.y + row * 380 };
    if (modules.every((module) => candidate.x + width <= module.x || module.x + module.width <= candidate.x || candidate.y + 380 <= module.y || module.y + 380 <= candidate.y)) return candidate;
  }
  return { x: start.x, y: start.y + modules.length * 380 };
}

export async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  }));
}

export function withoutRackId(rack: Record<string, unknown> | undefined) {
  if (!rack) return undefined;
  const copy = { ...rack }; delete copy.id; return copy;
}

function assetFromValue(value: unknown): SampleAssetRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const asset = value as Record<string, unknown>;
  return typeof asset.storageKey === "string" && typeof asset.name === "string" && typeof asset.sampleRate === "number" && typeof asset.channels === "number" && typeof asset.frames === "number" ? asset as SampleAssetRef : undefined;
}
export function sampleAssetFromData(data: Record<string, unknown> | undefined) { return assetFromValue(data?.patchworkWebAsset); }
export function sampleAssetsFromData(data: Record<string, unknown> | undefined) {
  const values = data?.patchworkWebAssets;
  if (!Array.isArray(values)) return undefined;
  const assets = values.map(assetFromValue);
  return assets.some(Boolean) ? assets : undefined;
}
export function polyphonyFromData(data: Record<string, unknown> | undefined) {
  const value = data?.patchworkWebPolyphony;
  return typeof value === "number" && [1, 2, 4, 8, 16].includes(value) ? value : undefined;
}

export function rackKeyFromKeyboard(event: KeyboardEvent) {
  if (event.key.length === 1) return event.key.toUpperCase().charCodeAt(0);
  const modifier: Record<string, number> = { ShiftLeft: 340, ControlLeft: 341, AltLeft: 342, MetaLeft: 343, ShiftRight: 344, ControlRight: 345, AltRight: 346, MetaRight: 347 };
  if (event.code in modifier) return modifier[event.code];
  const named: Record<string, number> = { Escape: 256, Enter: 257, Tab: 258, Backspace: 259, Insert: 260, Delete: 261, ArrowRight: 262, ArrowLeft: 263, ArrowDown: 264, ArrowUp: 265, PageUp: 266, PageDown: 267, Home: 268, End: 269, CapsLock: 280, ScrollLock: 281, NumLock: 282, PrintScreen: 283, Pause: 284 };
  if (event.key in named) return named[event.key];
  const functionKey = /^F([1-9]|1\d|2[0-5])$/.exec(event.key);
  return functionKey ? 289 + Number(functionKey[1]) : -1;
}
export function rackModifiersFromKeyboard(event: KeyboardEvent) { return (event.shiftKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.altKey ? 4 : 0) | (event.metaKey ? 8 : 0); }

export function strokeBindings(module: ModuleInstance) {
  const data = module.rack?.data;
  const values = module.state?.length || !data || typeof data !== "object" ? (module.state ?? []) : stateFromData(module.key, data as Record<string, unknown>, module.stateKeys);
  return Array.from({ length: 10 }, (_, id) => ({
    id, button: Number(values[1 + id * 5] ?? -1), key: Number(values[2 + id * 5] ?? -1),
    mods: Number(values[3 + id * 5] ?? 0), mode: Number(values[4 + id * 5] ?? 1),
    data: data && Array.isArray((data as Record<string, unknown>).keys) && typeof ((data as Record<string, unknown>).keys as unknown[])[id] === "object" ? String((((data as Record<string, unknown>).keys as unknown[])[id] as Record<string, unknown>).data ?? "") : "",
  }));
}
