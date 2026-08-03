import { isFiniteNumber, isRecord } from "./runtime-type-guards.ts";

export const CURRENT_VCV_PATCH_VERSION = "2.6.6";

type LegacyModule = Record<string, unknown> & {
  plugin: string;
  model: string;
  params: number[];
};

type MigratedParam = { id: number; value: number };

type LegacyModuleMigration = {
  params?: (module: LegacyModule) => MigratedParam[];
  data?: (module: LegacyModule) => Record<string, unknown> | undefined;
  inputIds?: readonly number[];
  outputIds?: readonly number[];
  ui?: {
    width?: number;
    legacyWidth?: number;
    hidePanelArtwork?: boolean;
    hiddenParamIds?: readonly number[];
    hiddenStateIds?: readonly number[];
  };
};

export type LegacyVcvMigration = {
  id: string;
  matches: (version: string) => boolean;
  modules: Readonly<Record<string, LegacyModuleMigration>>;
};

function indexedParams(values: readonly number[], ids?: readonly number[]): MigratedParam[] {
  return values.flatMap((value, index) => {
    const id = ids?.[index] ?? index;
    return id === undefined ? [] : [{ id, value }];
  });
}

function rack03BraidsParams(module: LegacyModule): MigratedParam[] {
  const [shape, fine, coarse, fm, timbre, modulation, color] = module.params;
  return indexedParams([fine, coarse, fm, timbre, modulation, color, shape / 46]);
}

function rack03VcoParams(module: LegacyModule): MigratedParam[] {
  // Rack 0.3 saved ModuleWidget::params order. PW was inserted before FM even
  // though the module enum placed FM first.
  return indexedParams(module.params, [0, 1, 2, 3, 5, 4, 6]);
}

function rack03Seq3Params(module: LegacyModule): MigratedParam[] {
  const migrated = indexedParams(module.params.slice(0, 4));
  for (let step = 0; step < 8; step += 1) {
    const legacy = 4 + step * 4;
    migrated.push(
      { id: 4 + step, value: module.params[legacy] },
      { id: 12 + step, value: module.params[legacy + 1] },
      { id: 20 + step, value: module.params[legacy + 2] },
      { id: 28 + step, value: module.params[legacy + 3] },
    );
  }
  return migrated.filter((param) => isFiniteNumber(param.value));
}

function legacyBoolean(value: unknown): number {
  return value === true || (isFiniteNumber(value) && value !== 0) ? 1 : 0;
}

function rack03ScopeParams(module: LegacyModule): MigratedParam[] {
  const data = isRecord(module.data) ? module.data : {};
  const values = [...module.params];
  // 0.3 used 512 * 2^TIME seconds per screen. Rack 2 uses 2^-TIME.
  if (isFiniteNumber(values[4])) values[4] = -values[4] - 9;
  // The two buttons were momentary widgets; their durable values lived in data.
  values[5] = legacyBoolean(data.sum ?? data.lissajous);
  values[7] = legacyBoolean(data.ext ?? data.external);
  return indexedParams(values);
}

function rack03ScopeData(module: LegacyModule): Record<string, unknown> | undefined {
  if (!isRecord(module.data)) return undefined;
  return {
    ...module.data,
    lissajous: legacyBoolean(module.data.sum ?? module.data.lissajous),
    external: legacyBoolean(module.data.ext ?? module.data.external),
  };
}

export const LEGACY_VCV_MIGRATIONS: readonly LegacyVcvMigration[] = [
  {
    id: "rack-0.3.x-widget-order-to-v2",
    matches: (version) => /^0\.3(?:\.|$)/.test(version),
    modules: {
      "AudibleInstruments/Braids": { params: rack03BraidsParams },
      "AudibleInstruments/Branches": {
        params: (module) => indexedParams(module.params, [0, 1]),
        inputIds: [0, 2, 1, 3],
        outputIds: [0, 2, 1, 3],
        ui: {
          hiddenParamIds: [2, 3],
          hiddenStateIds: [0, 1],
        },
      },
      "Fundamental/VCF": {
        params: (module) => indexedParams(module.params, [0, 1, 2, 3, 4]),
        ui: { legacyWidth: 120 },
      },
      "Fundamental/VCO": { params: rack03VcoParams, ui: { legacyWidth: 150 } },
      "Fundamental/SEQ3": { params: rack03Seq3Params },
      "Fundamental/Scope": {
        params: rack03ScopeParams,
        data: rack03ScopeData,
      },
    },
  },
];

export function legacyVcvMigration(version: unknown): LegacyVcvMigration | undefined {
  if (typeof version !== "string") return undefined;
  return LEGACY_VCV_MIGRATIONS.find((migration) => migration.matches(version));
}

export function migrateLegacyModule(
  module: LegacyModule,
  migration: LegacyVcvMigration | undefined,
): Record<string, unknown> & { plugin: string; model: string; params: MigratedParam[] } {
  const rule = migration?.modules[`${module.plugin}/${module.model}`];
  const data = rule?.data ? rule.data(module) : isRecord(module.data) ? module.data : undefined;
  const migrated: Record<string, unknown> & {
    plugin: string;
    model: string;
    params: MigratedParam[];
  } = {
    ...module,
    params: rule?.params?.(module) ?? indexedParams(module.params),
  };
  if (data === undefined) delete migrated.data;
  else migrated.data = data;
  if (rule?.ui) migrated.patchworkWebLegacyUi = rule.ui;
  return migrated;
}

export function migrateLegacyPortId(
  module: LegacyModule | undefined,
  direction: "input" | "output",
  legacyId: number,
  migration: LegacyVcvMigration | undefined,
): number {
  if (!module || !migration) return legacyId;
  const rule = migration.modules[`${module.plugin}/${module.model}`];
  return (direction === "input" ? rule?.inputIds : rule?.outputIds)?.[legacyId] ?? legacyId;
}
