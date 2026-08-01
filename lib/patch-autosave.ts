import type { PatchDocument } from "./patch-types";
import type { WebPluginModule } from "./web-plugin-registry";
import { repairDuplicateModuleIds } from "./rack-studio-helpers.ts";

export type AutosaveRestoreResult = {
  patch: PatchDocument;
  repaired: number;
};

export function parseAutosavedPatch(raw: string | null): AutosaveRestoreResult | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PatchDocument;
    if (!Array.isArray(value.modules) || !Array.isArray(value.cables)) return null;
    const repaired = repairDuplicateModuleIds(value);
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
