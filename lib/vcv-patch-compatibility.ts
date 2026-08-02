import type { VcvPatch } from "./vcv-patch.ts";

export type VcvPatchModuleAvailability = {
  license: string;
};

export type VcvPatchModuleAvailabilityResolver = (
  key: string,
) => VcvPatchModuleAvailability | undefined;

export type BlockedVcvPatchModule = {
  key: string;
  count: number;
  reason: "commercial-license" | "unavailable";
  license?: string;
};

const COMMERCIAL_LICENSE =
  /\b(?:proprietary|commercial|paid|eula|all rights reserved|closed[- ]source)\b/i;

export function blockedVcvPatchModules(
  patch: VcvPatch,
  resolveDefinition: VcvPatchModuleAvailabilityResolver,
): BlockedVcvPatchModule[] {
  const blocked = new Map<string, BlockedVcvPatchModule>();
  for (const module of patch.modules) {
    const key = `${module.plugin}/${module.model}`;
    const definition = resolveDefinition(key);
    const reason = !definition
      ? "unavailable"
      : COMMERCIAL_LICENSE.test(definition.license)
        ? "commercial-license"
        : undefined;
    if (!reason) continue;
    const existing = blocked.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    blocked.set(key, {
      key,
      count: 1,
      reason,
      ...(definition ? { license: definition.license } : {}),
    });
  }
  return [...blocked.values()];
}

export class BlockedVcvPatchError extends Error {
  readonly blocked: BlockedVcvPatchModule[];
  readonly instanceCount: number;

  constructor(blocked: BlockedVcvPatchModule[]) {
    const instanceCount = blocked.reduce((total, module) => total + module.count, 0);
    super(
      `Patch not loaded · ${instanceCount} commercial or unavailable module${instanceCount === 1 ? "" : "s"}`,
    );
    this.name = "BlockedVcvPatchError";
    this.blocked = blocked;
    this.instanceCount = instanceCount;
  }
}

export function assertVcvPatchModulesLoadable(
  patch: VcvPatch,
  resolveDefinition: VcvPatchModuleAvailabilityResolver,
): void {
  const blocked = blockedVcvPatchModules(patch, resolveDefinition);
  if (blocked.length) throw new BlockedVcvPatchError(blocked);
}
