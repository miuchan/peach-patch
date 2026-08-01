import type { PatchDocument } from "./patch-types";
import type { WebPluginModule } from "./web-plugin-registry";
import { repairDuplicateModuleIds } from "./rack-studio-helpers.ts";
import { isFiniteNumber, isRecord, parseJson } from "./runtime-type-guards.ts";

export type AutosaveRestoreResult = {
  patch: PatchDocument;
  repaired: number;
};

function isPatchDocument(value: unknown): value is PatchDocument {
  if (!isRecord(value) || !Array.isArray(value.modules) || !Array.isArray(value.cables)) return false;
  if (value.rack !== undefined && !isRecord(value.rack)) return false;
  if (
    value.rackOrigin !== undefined &&
    (!Array.isArray(value.rackOrigin) || value.rackOrigin.length !== 2 || !value.rackOrigin.every(isFiniteNumber))
  ) return false;
  return value.modules.every((module) => {
    if (!isRecord(module)) return false;
    return typeof module.id === "string" && typeof module.key === "string" &&
      (module.plugin === undefined || typeof module.plugin === "string") &&
      (module.model === undefined || typeof module.model === "string") &&
      (module.x === undefined || isFiniteNumber(module.x)) &&
      (module.y === undefined || isFiniteNumber(module.y)) && isFiniteNumber(module.width) &&
      Array.isArray(module.params) && module.params.every(isFiniteNumber) &&
      (module.status === undefined || module.status === "ready" || module.status === "resolving" || module.status === "source-required" || module.status === "error") &&
      (module.state === undefined || (Array.isArray(module.state) && module.state.every(isFiniteNumber))) &&
      (module.stateKeys === undefined || (Array.isArray(module.stateKeys) && module.stateKeys.every(isRecord))) &&
      (module.rack === undefined || isRecord(module.rack));
  }) && value.cables.every((cable) => {
    if (!isRecord(cable)) return false;
    return typeof cable.id === "string" && typeof cable.fromModule === "string" &&
      typeof cable.toModule === "string" && isFiniteNumber(cable.fromPort) &&
      isFiniteNumber(cable.toPort) && (cable.color === undefined || typeof cable.color === "string") &&
      (cable.rack === undefined || isRecord(cable.rack));
  });
}

function normalizePatch(value: PatchDocument): PatchDocument {
  return {
    ...value,
    modules: value.modules.map((module) => {
      const [plugin = "", model = module.key] = module.key.split("/");
      return {
        ...module,
        plugin: module.plugin ?? plugin,
        model: module.model ?? model,
        x: module.x ?? 0,
        y: module.y ?? 0,
        status: module.status ?? "ready",
      };
    }),
    cables: value.cables.map((cable) => ({ ...cable, color: cable.color ?? "#f8c" })),
  };
}

export function parseAutosavedPatch(raw: string | null): AutosaveRestoreResult | null {
  if (!raw) return null;
  try {
    const value = parseJson(raw);
    if (!isPatchDocument(value)) return null;
    const repaired = repairDuplicateModuleIds(normalizePatch(value));
    return { patch: repaired.patch, repaired: repaired.repaired };
  } catch {
    return null;
  }
}

export function normalizeRestoredPatch(
  patch: PatchDocument,
  getDefinition: (key: string) => WebPluginModule | undefined,
): PatchDocument {
  return {
    ...patch,
    modules: patch.modules.map((module) => {
      if (module.key === "Core/Blank") return module;
      const definition = getDefinition(module.key);
      return definition && module.width !== definition.width
        ? { ...module, width: definition.width }
        : module;
    }),
  };
}

export function serializeAutosavePatch(patch: PatchDocument): string {
  return JSON.stringify(patch);
}
