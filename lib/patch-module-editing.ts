import type { ModuleInstance, PatchDocument } from "./patch-types";

function rackCopyWithoutId(rack: Record<string, unknown> | undefined) {
  if (!rack) return undefined;
  const copy = { ...rack };
  delete copy.id;
  return copy;
}

export function duplicatePatchModules(
  patch: PatchDocument,
  moduleIds: ReadonlySet<string>,
  newModuleId: (originalId: string) => string,
  newCableId: (originalId: string) => string,
  offset = { x: 30, y: 40 },
) {
  const originals = patch.modules.filter((module) => moduleIds.has(module.id));
  if (!originals.length) return null;
  const ids = new Map(originals.map((module) => [module.id, newModuleId(module.id)])),
    modules = originals.map((module) => ({
      ...module,
      id: ids.get(module.id)!,
      x: module.x + offset.x,
      y: module.y + offset.y,
      params: [...module.params],
      state: module.state ? [...module.state] : undefined,
      rack: rackCopyWithoutId(module.rack),
    })),
    cables = patch.cables.flatMap((cable) => {
      const fromModule = ids.get(cable.fromModule),
        toModule = ids.get(cable.toModule);
      return fromModule && toModule
        ? [
            {
              ...cable,
              id: newCableId(cable.id),
              fromModule,
              toModule,
              rack: rackCopyWithoutId(cable.rack),
            },
          ]
        : [];
    });
  return {
    patch: {
      ...patch,
      modules: [...patch.modules, ...modules],
      cables: [...patch.cables, ...cables],
    },
    moduleIds: modules.map((module) => module.id),
    cableCount: cables.length,
  };
}

export function replaceModuleKeepingCompatibleCables(
  patch: PatchDocument,
  moduleId: string,
  replacement: ModuleInstance,
  inputIds: ReadonlySet<number>,
  outputIds: ReadonlySet<number>,
) {
  if (!patch.modules.some((candidate) => candidate.id === moduleId)) return null;
  let droppedCables = 0;
  const cables = patch.cables.filter((cable) => {
    const compatible =
      (cable.toModule !== moduleId || inputIds.has(cable.toPort)) &&
      (cable.fromModule !== moduleId || outputIds.has(cable.fromPort));
    if (!compatible) droppedCables++;
    return compatible;
  });
  return {
    patch: {
      ...patch,
      modules: patch.modules.map((candidate) =>
        candidate.id === moduleId ? { ...replacement, id: moduleId } : candidate,
      ),
      cables,
    },
    droppedCables,
  };
}
