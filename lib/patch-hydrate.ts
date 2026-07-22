import type { ModuleInstance } from "./patch-types.ts";
import { stateFromData } from "./patch-state.ts";
import type { WebPluginModule } from "./web-plugin-registry.ts";

type ModuleMetadata = Partial<
  Pick<
    ModuleInstance,
    "description" | "screenshotUrl" | "sourceUrl" | "license" | "version"
  >
>;

function rackData(module: ModuleInstance) {
  const value = module.rack?.data;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

export function hydrateModuleWithDefinition(
  module: ModuleInstance,
  definition: WebPluginModule,
  metadata: ModuleMetadata = {},
): ModuleInstance {
  const params = definition.params.map((param) => param.default),
    savedParams = Array.isArray(module.rack?.params)
      ? module.rack.params
      : [];
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
    ...module,
    version: definition.version ?? metadata.version ?? module.version,
    status: "ready",
    description: metadata.description ?? definition.description,
    screenshotUrl: metadata.screenshotUrl ?? definition.screenshotUrl,
    sourceUrl: metadata.sourceUrl ?? definition.sourceUrl,
    license: metadata.license ?? definition.license,
    width: definition.width,
    params,
    stateKeys: definition.stateKeys,
    state: stateFromData(module.key, rackData(module), definition.stateKeys),
  };
}
