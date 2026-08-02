import type { PatchDocument, ModuleInstance } from "./patch-types.ts";
import { resolvedModulePortPosition } from "./patch-operations.ts";
import type { PortSpec, WebPluginModule } from "./web-plugin-registry.ts";

export type RackCableLayout = PatchDocument["cables"][number] & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  outputAngle: number;
  inputAngle: number;
  topOutputPlug: boolean;
  topInputPlug: boolean;
  d: string;
};

export type RackCableDragPreview = {
  cableId: string;
  side: "input" | "output";
  x: number;
  y: number;
};

export type RackCableDraft = {
  moduleId: string;
  direction: "in" | "out";
  portId: number;
  x: number;
  y: number;
  color: string;
};

export type RackCableDraftLayout = {
  id: "cable-draft";
  color: string;
  anchorModuleId: string;
  anchorDirection: "in" | "out";
  anchorPortId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  outputAngle: number;
  inputAngle: number;
  d: string;
};

type ModuleDefinition = Pick<WebPluginModule, "key" | "width" | "inputs" | "outputs">;

function rankedPlugIds(patch: PatchDocument) {
  const inputs = new Map<string, { id: string; order: number }>();
  const outputs = new Map<string, { id: string; order: number }>();
  patch.cables.forEach((cable, index) => {
    const inputOrder = Number(cable.rack?.inputPlugOrder);
    const outputOrder = Number(cable.rack?.outputPlugOrder);
    const inputKey = `${cable.toModule}:${cable.toPort}`;
    const outputKey = `${cable.fromModule}:${cable.fromPort}`;
    const inputRank = Number.isFinite(inputOrder) ? inputOrder : index * 2 + 1;
    const outputRank = Number.isFinite(outputOrder) ? outputOrder : index * 2;
    if ((inputs.get(inputKey)?.order ?? -Infinity) <= inputRank)
      inputs.set(inputKey, { id: cable.id, order: inputRank });
    if ((outputs.get(outputKey)?.order ?? -Infinity) <= outputRank)
      outputs.set(outputKey, { id: cable.id, order: outputRank });
  });
  return { inputs, outputs };
}

function portPosition(
  module: ModuleInstance,
  direction: "in" | "out",
  portId: number,
  definition: ModuleDefinition | undefined,
) {
  const ports: PortSpec[] = direction === "in" ? definition?.inputs ?? [] : definition?.outputs ?? [];
  return resolvedModulePortPosition(module, direction, portId, ports, definition?.width ?? module.width);
}

function cableGeometry(
  output: { x: number; y: number },
  input: { x: number; y: number },
  tension: number,
) {
  const sag = Math.max(70, Math.abs(input.x - output.x) * 0.22) * (1.5 - tension);
  const slumpX = (output.x + input.x) / 2;
  const slumpY = (output.y + input.y) / 2 + sag;
  const outputAngle = Math.atan2(slumpY - output.y, slumpX - output.x);
  const inputAngle = Math.atan2(slumpY - input.y, slumpX - input.x);
  const clearance = 14;
  const startX = output.x + Math.cos(outputAngle) * clearance;
  const startY = output.y + Math.sin(outputAngle) * clearance;
  const endX = input.x + Math.cos(inputAngle) * clearance;
  const endY = input.y + Math.sin(inputAngle) * clearance;
  return {
    x1: output.x,
    y1: output.y,
    x2: input.x,
    y2: input.y,
    outputAngle,
    inputAngle,
    d: `M${startX} ${startY} Q${slumpX} ${slumpY},${endX} ${endY}`,
  };
}

export function layoutPatchCables(
  patch: PatchDocument,
  definitions: readonly ModuleDefinition[],
  tension: number,
  dragPreview?: RackCableDragPreview,
): RackCableLayout[] {
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const ranked = rankedPlugIds(patch);
  return patch.cables.flatMap((cable) => {
    const from = patch.modules.find((module) => module.id === cable.fromModule);
    const to = patch.modules.find((module) => module.id === cable.toModule);
    if (!from || !to) return [];
    const fromDefinition = definitionsByKey.get(from.key);
    const toDefinition = definitionsByKey.get(to.key);
    const output = portPosition(from, "out", cable.fromPort, fromDefinition);
    const input = portPosition(to, "in", cable.toPort, toDefinition);
    const previewOutput = dragPreview?.cableId === cable.id && dragPreview.side === "output"
      ? { x: dragPreview.x, y: dragPreview.y }
      : output;
    const previewInput = dragPreview?.cableId === cable.id && dragPreview.side === "input"
      ? { x: dragPreview.x, y: dragPreview.y }
      : input;
    return [{
      ...cable,
      ...cableGeometry(previewOutput, previewInput, tension),
      topOutputPlug: ranked.outputs.get(`${cable.fromModule}:${cable.fromPort}`)?.id === cable.id,
      topInputPlug: ranked.inputs.get(`${cable.toModule}:${cable.toPort}`)?.id === cable.id,
    }];
  });
}

export function layoutRackCableDraft(
  patch: PatchDocument,
  definitions: readonly ModuleDefinition[],
  tension: number,
  draft: RackCableDraft,
): RackCableDraftLayout | undefined {
  const module = patch.modules.find((candidate) => candidate.id === draft.moduleId);
  if (!module) return undefined;
  const definition = definitions.find((candidate) => candidate.key === module.key);
  const anchor = portPosition(module, draft.direction, draft.portId, definition);
  const pointer = { x: draft.x, y: draft.y };
  const geometry = draft.direction === "out"
    ? cableGeometry(anchor, pointer, tension)
    : cableGeometry(pointer, anchor, tension);
  return {
    id: "cable-draft",
    color: draft.color,
    anchorModuleId: draft.moduleId,
    anchorDirection: draft.direction,
    anchorPortId: draft.portId,
    ...geometry,
  };
}

export function cableSignalLevels(
  cables: PatchDocument["cables"],
  signalByCable: Readonly<Record<string, number>>,
) {
  const levels = new Map<string, number>();
  for (const cable of cables) {
    const level = signalByCable[cable.id] ?? 0;
    const outputKey = `${cable.fromModule}:out:${cable.fromPort}`;
    const inputKey = `${cable.toModule}:in:${cable.toPort}`;
    levels.set(outputKey, Math.max(levels.get(outputKey) ?? 0, level));
    levels.set(inputKey, Math.max(levels.get(inputKey) ?? 0, level));
  }
  return levels;
}
