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
  curveStartX: number;
  curveStartY: number;
  curveControlX: number;
  curveControlY: number;
  curveEndX: number;
  curveEndY: number;
  d: string;
};

export type RackCableGeometry = Pick<
  RackCableLayout,
  | "x1"
  | "y1"
  | "x2"
  | "y2"
  | "outputAngle"
  | "inputAngle"
  | "curveStartX"
  | "curveStartY"
  | "curveControlX"
  | "curveControlY"
  | "curveEndX"
  | "curveEndY"
  | "d"
>;

export type RackCablePreviewSession = {
  movingSide: "input" | "output";
  anchor: { x: number; y: number };
  initialPoint: { x: number; y: number };
};

export type RackCableDragPreview = {
  cableId: string;
  side: RackCablePreviewSession["movingSide"];
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
  const ports: PortSpec[] =
    direction === "in" ? (definition?.inputs ?? []) : (definition?.outputs ?? []);
  return resolvedModulePortPosition(
    module,
    direction,
    portId,
    ports,
    definition?.width ?? module.width,
  );
}

export function rackCableGeometry(
  output: { x: number; y: number },
  input: { x: number; y: number },
  tension: number,
): RackCableGeometry {
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
    curveStartX: startX,
    curveStartY: startY,
    curveControlX: slumpX,
    curveControlY: slumpY,
    curveEndX: endX,
    curveEndY: endY,
    d: `M${startX} ${startY} Q${slumpX} ${slumpY},${endX} ${endY}`,
  };
}

export function layoutRackCablePreview(
  session: Pick<RackCablePreviewSession, "movingSide" | "anchor">,
  point: { x: number; y: number },
  tension: number,
) {
  return session.movingSide === "input"
    ? rackCableGeometry(session.anchor, point, tension)
    : rackCableGeometry(point, session.anchor, tension);
}

export function layoutPatchCables(
  patch: PatchDocument,
  definitions: readonly ModuleDefinition[],
  tension: number,
  dragPreview?: RackCableDragPreview,
): RackCableLayout[] {
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const modulesById = new Map(patch.modules.map((module) => [module.id, module]));
  const ranked = rankedPlugIds(patch);
  const layouts: RackCableLayout[] = [];
  for (const cable of patch.cables) {
    const from = modulesById.get(cable.fromModule);
    const to = modulesById.get(cable.toModule);
    if (!from || !to) continue;
    const fromDefinition = definitionsByKey.get(from.key);
    const toDefinition = definitionsByKey.get(to.key);
    const output = portPosition(from, "out", cable.fromPort, fromDefinition);
    const input = portPosition(to, "in", cable.toPort, toDefinition);
    const previewOutput =
      dragPreview?.cableId === cable.id && dragPreview.side === "output"
        ? { x: dragPreview.x, y: dragPreview.y }
        : output;
    const previewInput =
      dragPreview?.cableId === cable.id && dragPreview.side === "input"
        ? { x: dragPreview.x, y: dragPreview.y }
        : input;
    layouts.push({
      ...cable,
      ...rackCableGeometry(previewOutput, previewInput, tension),
      topOutputPlug: ranked.outputs.get(`${cable.fromModule}:${cable.fromPort}`)?.id === cable.id,
      topInputPlug: ranked.inputs.get(`${cable.toModule}:${cable.toPort}`)?.id === cable.id,
    });
  }
  return layouts;
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
  const geometry =
    draft.direction === "out"
      ? rackCableGeometry(anchor, pointer, tension)
      : rackCableGeometry(pointer, anchor, tension);
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
