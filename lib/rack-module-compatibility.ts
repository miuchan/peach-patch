import type { ModuleInstance } from "./patch-types.ts";
import { isFiniteNumber, isRecord } from "./runtime-type-guards.ts";

type RackLegacyUi = {
  width?: number;
  legacyWidth?: number;
  hidePanelArtwork: boolean;
  hiddenParamIds: number[];
  hiddenStateIds: number[];
};

type RackLegacyUiModule = Pick<ModuleInstance, "rack"> & Partial<Pick<ModuleInstance, "key">>;

export type LegacyModuleLayout = {
  module: ModuleInstance;
  sourceX: number;
  sourceY: number;
  legacyWidth?: number;
};

function integerIds(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => Number.isSafeInteger(item) && item >= 0)
    : [];
}

function deprecatedLegacyWidth(
  module: RackLegacyUiModule,
  value: Record<string, unknown>,
): number | undefined {
  if (isFiniteNumber(value.legacyWidth)) return undefined;
  const rack = module.rack;
  const key =
    module.key ??
    (typeof rack?.plugin === "string" && typeof rack.model === "string"
      ? `${rack.plugin}/${rack.model}`
      : undefined);
  if (key === "Fundamental/VCO" && value.width === 150) return 150;
  if (key === "Fundamental/VCF" && value.width === 120) return 120;
  return undefined;
}

export function rackLegacyUi(module: RackLegacyUiModule): RackLegacyUi {
  const value = module.rack?.patchworkWebLegacyUi;
  if (!isRecord(value)) {
    return { hidePanelArtwork: false, hiddenParamIds: [], hiddenStateIds: [] };
  }
  const migratedWidth = deprecatedLegacyWidth(module, value);
  return {
    width:
      migratedWidth === undefined && isFiniteNumber(value.width) && value.width > 0
        ? value.width
        : undefined,
    legacyWidth:
      isFiniteNumber(value.legacyWidth) && value.legacyWidth > 0
        ? value.legacyWidth
        : migratedWidth,
    hidePanelArtwork: value.hidePanelArtwork === true,
    hiddenParamIds: integerIds(value.hiddenParamIds),
    hiddenStateIds: integerIds(value.hiddenStateIds),
  };
}

export function migrateDeprecatedLegacyUi(module: ModuleInstance): ModuleInstance {
  const value = module.rack?.patchworkWebLegacyUi;
  if (!isRecord(value)) return module;
  const legacyWidth = deprecatedLegacyWidth(module, value);
  if (legacyWidth === undefined) return module;
  const ui = { ...value };
  delete ui.width;
  return {
    ...module,
    rack: {
      ...module.rack,
      patchworkWebLegacyUi: { ...ui, legacyWidth },
    },
  };
}

export function compactLegacyModuleRows(layouts: LegacyModuleLayout[]): ModuleInstance[] {
  return layouts.map((layout) => {
    const precedingWidthDelta = layouts.reduce((total, candidate) => {
      if (
        candidate === layout ||
        candidate.sourceY !== layout.sourceY ||
        candidate.legacyWidth === undefined ||
        candidate.sourceX + candidate.legacyWidth > layout.sourceX
      ) {
        return total;
      }
      return total + candidate.legacyWidth - candidate.module.width;
    }, 0);
    return { ...layout.module, x: layout.sourceX - precedingWidthDelta };
  });
}
