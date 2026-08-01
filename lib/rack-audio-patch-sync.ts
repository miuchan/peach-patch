import type { ModuleInstance, PatchDocument } from "./patch-types";
import { dataFromState, stateFromData } from "./patch-state.ts";
import { getWebPlugin } from "./runtime-plugin-registry.ts";

type RackModuleSyncEngine = {
  setStateJson: (moduleId: string, data: Record<string, unknown> | undefined) => void;
  setParam: (moduleId: string, paramId: number, value: number) => void;
  setState: (moduleId: string, stateId: number, value: number) => void;
  setBypassed: (moduleId: string, bypassed: boolean) => void;
};

type AudioModuleSyncCache = Map<string, { controls: string; data: string }>;

export function syncRackAudioModules(
  engine: RackModuleSyncEngine,
  modules: ModuleInstance[],
  cache: AudioModuleSyncCache,
) {
  const active = new Set<string>();
  for (const module of modules) {
    if (module.status !== "ready") continue;
    active.add(module.id);
    const definition = getWebPlugin(module.key);
    const source = module.rack?.data && typeof module.rack.data === "object"
      ? module.rack.data as Record<string, unknown>
      : undefined;
    const data = dataFromState(
      module.key,
      source,
      module.state,
      module.stateKeys ?? definition?.stateKeys,
    );
    const controls = JSON.stringify([
      module.params,
      module.state ?? [],
      Boolean(module.bypassed),
    ]);
    const dataSignature = JSON.stringify(data ?? {});
    const previous = cache.get(module.id);
    if (previous?.data !== dataSignature) engine.setStateJson(module.id, data);
    if (previous?.controls !== controls) {
      module.params.forEach((value, id) => engine.setParam(module.id, id, value));
      module.state?.forEach((value, id) => engine.setState(module.id, id, value));
      engine.setBypassed(module.id, Boolean(module.bypassed));
    }
    cache.set(module.id, { controls, data: dataSignature });
  }
  for (const id of cache.keys()) if (!active.has(id)) cache.delete(id);
}

export function applyAudioParam(
  patch: PatchDocument,
  moduleId: string,
  paramId: number,
  value: number,
): PatchDocument {
  return {
    ...patch,
    modules: patch.modules.map((module) => {
      if (module.id !== moduleId || paramId < 0 || paramId >= module.params.length) {
        return module;
      }
      const params = [...module.params];
      params[paramId] = value;
      return { ...module, params };
    }),
  };
}

export function applyAudioStateSnapshot(
  patch: PatchDocument,
  moduleId: string,
  data: Record<string, unknown>,
  stateKeys?: Parameters<typeof stateFromData>[2],
): PatchDocument {
  return {
    ...patch,
    modules: patch.modules.map((module) => {
      if (module.id !== moduleId) return module;
      const previous = module.rack?.data && typeof module.rack.data === "object"
        ? module.rack.data as Record<string, unknown>
        : {};
      const hostData = Object.fromEntries(
        Object.entries(previous).filter(([key]) => key.startsWith("patchworkWeb")),
      );
      const merged = { ...data, ...hostData };
      const state = stateFromData(module.key, merged, stateKeys);
      return {
        ...module,
        rack: { ...(module.rack ?? {}), data: merged },
        state: state.length ? state : module.state,
      };
    }),
  };
}

export function findRackModule(
  patch: PatchDocument,
  moduleId: string,
): ModuleInstance | undefined {
  return patch.modules.find((module) => module.id === moduleId);
}
