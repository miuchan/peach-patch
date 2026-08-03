import { stateFromData } from "./patch-state.ts";
import type { ModuleInstance, PatchDocument } from "./patch-types";
import type { ParamSpec } from "./web-plugin-registry";

export function updateModuleParam(
  patch: PatchDocument,
  moduleId: string,
  paramId: number,
  value: number,
) {
  return {
    ...patch,
    modules: patch.modules.map((module) =>
      module.id === moduleId
        ? {
            ...module,
            params: module.params.map((current, id) => (id === paramId ? value : current)),
          }
        : module,
    ),
  };
}

export function updateModuleState(
  patch: PatchDocument,
  moduleId: string,
  updates: Array<[id: number, value: number]>,
) {
  return {
    ...patch,
    modules: patch.modules.map((module) => {
      if (module.id !== moduleId) return module;
      const state = [...(module.state ?? [])];
      for (const [id, value] of updates) state[id] = value;
      return { ...module, state };
    }),
  };
}

export function mergeModuleData(
  patch: PatchDocument,
  moduleId: string,
  data: Record<string, unknown>,
) {
  const module = patch.modules.find((candidate) => candidate.id === moduleId);
  const previous =
    module?.rack?.data && typeof module.rack.data === "object"
      ? (module.rack.data as Record<string, unknown>)
      : {};
  const next = { ...previous, ...data };
  return {
    patch: {
      ...patch,
      modules: patch.modules.map((candidate) =>
        candidate.id === moduleId
          ? { ...candidate, rack: { ...(candidate.rack ?? {}), data: next } }
          : candidate,
      ),
    },
    data: next,
  };
}

export function applyRackModulePreset(
  patch: PatchDocument,
  moduleId: string,
  preset: Record<string, unknown>,
  definition: {
    params: readonly ParamSpec[];
    stateKeys?: ModuleInstance["stateKeys"];
  },
) {
  const target = patch.modules.find((module) => module.id === moduleId);
  if (!target || preset.plugin !== target.plugin || preset.model !== target.model) return null;
  const params = [...target.params];
  if (Array.isArray(preset.params)) {
    for (const entry of preset.params) {
      if (!entry || typeof entry !== "object") continue;
      const id = Number((entry as Record<string, unknown>).id),
        value = Number((entry as Record<string, unknown>).value),
        spec = definition.params.find((param) => param.id === id);
      if (!Number.isInteger(id) || !Number.isFinite(value) || !spec) continue;
      params[id] = Math.min(spec.max, Math.max(spec.min, value));
    }
  }
  const data =
      preset.data && typeof preset.data === "object" && !Array.isArray(preset.data)
        ? (preset.data as Record<string, unknown>)
        : undefined,
    rack = { ...(target.rack ?? {}) };
  if (data) rack.data = data;
  else delete rack.data;
  const state = data
    ? stateFromData(target.key, data, target.stateKeys ?? definition.stateKeys)
    : [];
  return {
    ...patch,
    modules: patch.modules.map((module) =>
      module.id === moduleId
        ? {
            ...module,
            params,
            state,
            rack,
            bypassed: preset.bypass === true,
          }
        : module,
    ),
  };
}

export function resetModuleControls(
  patch: PatchDocument,
  moduleId: string,
  params: readonly ParamSpec[],
) {
  if (!patch.modules.some((module) => module.id === moduleId)) return null;
  return {
    ...patch,
    modules: patch.modules.map((module) =>
      module.id === moduleId
        ? {
            ...module,
            params: params.map((param) => param.default),
          }
        : module,
    ),
  };
}

export function randomizeModuleControls(
  patch: PatchDocument,
  moduleId: string,
  params: readonly ParamSpec[],
  random: () => number = Math.random,
) {
  if (!patch.modules.some((module) => module.id === moduleId)) return null;
  return {
    ...patch,
    modules: patch.modules.map((module) =>
      module.id === moduleId
        ? {
            ...module,
            params: params.map((param) => {
              const value = param.min + random() * (param.max - param.min);
              return param.snap ? Math.round(value) : value;
            }),
          }
        : module,
    ),
  };
}
