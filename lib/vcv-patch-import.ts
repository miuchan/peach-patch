import type { ModuleInstance, PatchDocument } from "./patch-types.ts";
import { stateFromData } from "./patch-state.ts";
import type { WebPluginModule } from "./web-plugin-registry.ts";
import type { VcvPatch } from "./vcv-patch.ts";
import { polyphonyFromData, sampleAssetFromData, sampleAssetsFromData } from "./rack-studio-helpers.ts";

export type VcvDefinitionResolver = (key: string) => WebPluginModule | undefined;

export function importVcvPatch(
  raw: VcvPatch,
  resolveDefinition: VcvDefinitionResolver,
  cableColors: readonly string[],
): PatchDocument & { unresolved: ModuleInstance[] } {
  const minX = raw.modules.length ? Math.min(...raw.modules.map((module) => module.pos[0])) : 0;
  const minY = raw.modules.length ? Math.min(...raw.modules.map((module) => module.pos[1])) : 0;
  const rack = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "modules" && key !== "cables"));
  const modules = raw.modules.map((source): ModuleInstance => {
    const key = `${source.plugin}/${source.model}`;
    const definition = resolveDefinition(key);
    const values = definition?.params.map((param) => param.default) ?? Array.from({ length: source.params?.length ?? 0 }, () => 0);
    source.params?.forEach((param) => { values[param.id] = param.value; });
    const blankWidth = source.plugin === "Core" && source.model === "Blank" ? Math.max(45, Number(source.data?.width ?? 10) * 15) : undefined;
    return {
      id: `vcv-${source.id}`, key, plugin: source.plugin, model: source.model,
      version: source.version ?? definition?.version,
      x: (source.pos[0] - minX) * 15, y: (source.pos[1] - minY) * 380,
      width: blankWidth ?? definition?.width ?? Math.max(90, Number(source.data?.width ?? 12) * 15),
      params: values,
      state: stateFromData(key, source.data, definition?.stateKeys),
      stateKeys: definition?.stateKeys,
      asset: sampleAssetFromData(source.data), assets: sampleAssetsFromData(source.data),
      polyphony: polyphonyFromData(source.data) ?? (definition?.polyphonic ? 1 : undefined),
      bypassed: source.bypass === true || source.disabled === true,
      rack: { ...source }, status: definition ? "ready" : "resolving",
      description: definition?.description, screenshotUrl: definition?.screenshotUrl,
      sourceUrl: definition?.sourceUrl, license: definition?.license,
    };
  });
  const cables = raw.cables.map((cable) => ({
    id: `vcv-cable-${cable.id}`, fromModule: `vcv-${cable.outputModuleId}`,
    fromPort: cable.outputId, toModule: `vcv-${cable.inputModuleId}`, toPort: cable.inputId,
    color: cable.color ?? cableColors[cable.id % cableColors.length], rack: { ...cable },
  }));
  return {
    modules,
    cables,
    rack,
    rackOrigin: [minX, minY],
    unresolved: modules.filter((module) => module.status !== "ready"),
  };
}
