import type { ModuleInstance, PatchDocument } from "./patch-types";

export function connectPatchCable(
  patch: PatchDocument,
  from: { moduleId: string; portId: number },
  to: { moduleId: string; portId: number },
  cableId: string,
  color: string,
) {
  if (
    from.moduleId === to.moduleId ||
    !patch.modules.some((module) => module.id === from.moduleId) ||
    !patch.modules.some((module) => module.id === to.moduleId) ||
    patch.cables.some(
      (cable) =>
        cable.fromModule === from.moduleId &&
        cable.fromPort === from.portId &&
        cable.toModule === to.moduleId &&
        cable.toPort === to.portId,
    )
  )
    return null;
  return {
    ...patch,
    cables: [
      ...patch.cables,
      {
        id: cableId,
        fromModule: from.moduleId,
        fromPort: from.portId,
        toModule: to.moduleId,
        toPort: to.portId,
        color,
      },
    ],
  };
}

export function reconnectPatchCableEndpoint(
  patch: PatchDocument,
  cableId: string,
  side: "input" | "output",
  port: { moduleId: string; portId: number },
) {
  const cable = patch.cables.find((candidate) => candidate.id === cableId);
  if (!cable) return null;
  if (side === "input" && cable.fromModule === port.moduleId) return null;
  if (side === "output" && cable.toModule === port.moduleId) return null;
  const nextCable =
    side === "input"
      ? { ...cable, toModule: port.moduleId, toPort: port.portId }
      : { ...cable, fromModule: port.moduleId, fromPort: port.portId };
  if (
    patch.cables.some(
      (candidate) =>
        candidate.id !== cableId &&
        candidate.fromModule === nextCable.fromModule &&
        candidate.fromPort === nextCable.fromPort &&
        candidate.toModule === nextCable.toModule &&
        candidate.toPort === nextCable.toPort,
    )
  )
    return null;
  return {
    ...patch,
    cables: patch.cables.map((candidate) => (candidate.id === cableId ? nextCable : candidate)),
  };
}

export function disconnectModuleCables(patch: PatchDocument, moduleId: string) {
  if (!patch.modules.some((module) => module.id === moduleId)) return null;
  const cables = patch.cables.filter(
    (cable) => cable.fromModule !== moduleId && cable.toModule !== moduleId,
  );
  return {
    patch: { ...patch, cables },
    removedCables: patch.cables.length - cables.length,
  };
}

export function spliceModuleIntoCable(
  patch: PatchDocument,
  cableId: string,
  module: ModuleInstance,
  incomingCableId: string,
  outgoingCableId: string,
): PatchDocument | null {
  const cable = patch.cables.find((candidate) => candidate.id === cableId);
  if (!cable) return null;
  if (
    !patch.modules.some((candidate) => candidate.id === cable.fromModule) ||
    !patch.modules.some((candidate) => candidate.id === cable.toModule)
  )
    return null;

  const shared = { color: cable.color };
  return {
    ...patch,
    modules: [...patch.modules, module],
    cables: [
      ...patch.cables.filter((candidate) => candidate.id !== cableId),
      {
        ...shared,
        id: incomingCableId,
        fromModule: cable.fromModule,
        fromPort: cable.fromPort,
        toModule: module.id,
        toPort: 0,
      },
      {
        ...shared,
        id: outgoingCableId,
        fromModule: module.id,
        fromPort: 0,
        toModule: cable.toModule,
        toPort: cable.toPort,
      },
    ],
  };
}

export function removeModuleAndHealCable(
  patch: PatchDocument,
  moduleId: string,
  healedCableId: string,
): PatchDocument | null {
  if (!patch.modules.some((candidate) => candidate.id === moduleId)) return null;
  const incoming = patch.cables.filter((cable) => cable.toModule === moduleId),
    outgoing = patch.cables.filter((cable) => cable.fromModule === moduleId);
  if (incoming.length !== 1 || outgoing.length !== 1) return null;

  return {
    ...patch,
    modules: patch.modules.filter((candidate) => candidate.id !== moduleId),
    cables: [
      ...patch.cables.filter(
        (cable) => cable.fromModule !== moduleId && cable.toModule !== moduleId,
      ),
      {
        id: healedCableId,
        fromModule: incoming[0].fromModule,
        fromPort: incoming[0].fromPort,
        toModule: outgoing[0].toModule,
        toPort: outgoing[0].toPort,
        color: incoming[0].color ?? outgoing[0].color,
      },
    ],
  };
}
