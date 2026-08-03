import type { ModuleInstance } from "./patch-types.ts";
import { stateFromData } from "./patch-state.ts";
import type { WebPluginModule } from "./web-plugin-registry.ts";
import {
  compactLegacyModuleRows,
  migrateDeprecatedLegacyUi,
  rackLegacyUi,
} from "./rack-module-compatibility.ts";

type ModuleMetadata = Partial<
  Pick<ModuleInstance, "description" | "screenshotUrl" | "sourceUrl" | "license" | "version">
>;

function rackData(module: ModuleInstance) {
  const value = module.rack?.data;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

export function hydrateModuleWithDefinition(
  module: ModuleInstance,
  definition: WebPluginModule,
  metadata: ModuleMetadata = {},
): ModuleInstance {
  const compatibilityUi = rackLegacyUi(module),
    params = definition.params.map((param) => param.default),
    savedParams = Array.isArray(module.rack?.params) ? module.rack.params : [];
  for (const value of savedParams) {
    if (!value || typeof value !== "object") continue;
    const param = value as Record<string, unknown>;
    if (
      typeof param.id === "number" &&
      Number.isSafeInteger(param.id) &&
      param.id >= 0 &&
      param.id < params.length &&
      typeof param.value === "number" &&
      Number.isFinite(param.value)
    )
      params[param.id] = param.value;
  }
  return {
    ...migrateDeprecatedLegacyUi(module),
    version: definition.version ?? metadata.version ?? module.version,
    status: "ready",
    description: metadata.description ?? definition.description,
    screenshotUrl: compatibilityUi.hidePanelArtwork
      ? undefined
      : (metadata.screenshotUrl ?? definition.screenshotUrl),
    sourceUrl: metadata.sourceUrl ?? definition.sourceUrl,
    license: metadata.license ?? definition.license,
    width: compatibilityUi.width ?? definition.width,
    params,
    stateKeys: definition.stateKeys,
    state: stateFromData(module.key, rackData(module), definition.stateKeys),
  };
}

export function hydrateModulesWithDefinitions(
  modules: ModuleInstance[],
  definitions: WebPluginModule[],
) {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  let changed = false;
  const deprecatedWidths = new Map(
    modules.flatMap((module) => {
      const value = module.rack?.patchworkWebLegacyUi;
      if (!value || typeof value !== "object" || !("width" in value)) return [];
      const compatibilityUi = rackLegacyUi(module);
      return compatibilityUi.legacyWidth !== undefined && compatibilityUi.width === undefined
        ? [[module.id, compatibilityUi.legacyWidth] as const]
        : [];
    }),
  );
  const hydrated = modules.map((module) => {
    if (module.key === "Core/Blank") return module;
    const definition = byKey.get(module.key);
    if (!definition) return module;
    if (module.status !== "ready") {
      changed = true;
      return hydrateModuleWithDefinition(module, definition);
    }
    const moduleStateKeys = module.stateKeys?.map((item) => item.key) ?? [],
      definitionStateKeys = definition.stateKeys?.map((item) => item.key) ?? [],
      definitionMatches =
        Math.abs(module.width - definition.width) < 0.001 &&
        module.params.length === definition.params.length &&
        moduleStateKeys.length === definitionStateKeys.length &&
        moduleStateKeys.every((key, index) => key === definitionStateKeys[index]);
    if (definitionMatches && !deprecatedWidths.has(module.id)) return module;
    changed = true;
    return hydrateModuleWithDefinition(module, definition);
  });
  if (deprecatedWidths.size === 0) return changed ? hydrated : modules;
  changed = true;
  return compactLegacyModuleRows(
    hydrated.map((module, index) => ({
      module,
      sourceX: modules[index].x,
      sourceY: modules[index].y,
      legacyWidth: deprecatedWidths.get(module.id),
    })),
  );
}
