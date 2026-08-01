import type {
  ModuleInstance,
  PatchDocument,
} from "./patch-types";
import { stateFromData } from "./patch-state.ts";
import type { ParamSpec } from "./web-plugin-registry";

export const RACK_GRID_WIDTH = 15;
export const RACK_GRID_HEIGHT = 380;

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
        ? { ...module, params: module.params.map((current, id) => id === paramId ? value : current) }
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
  const previous = module?.rack?.data && typeof module.rack.data === "object"
    ? module.rack.data as Record<string, unknown>
    : {};
  const next = { ...previous, ...data };
  return {
    patch: {
      ...patch,
      modules: patch.modules.map((candidate) => candidate.id === moduleId
        ? { ...candidate, rack: { ...(candidate.rack ?? {}), data: next } }
        : candidate),
    },
    data: next,
  };
}

export function snapRackPosition(position: { x: number; y: number }) {
  return {
    x: Math.round(position.x / RACK_GRID_WIDTH) * RACK_GRID_WIDTH,
    y: Math.round(position.y / RACK_GRID_HEIGHT) * RACK_GRID_HEIGHT,
  };
}

export function rackSurfaceBounds(
  modules: Array<Pick<ModuleInstance, "x" | "y" | "width">>,
  viewportWidth: number,
  viewportHeight: number,
  pan: { x: number; y: number },
  zoom: number,
) {
  const safeZoom = Math.max(0.0001, zoom),
    safeViewportWidth = Math.max(1, viewportWidth),
    safeViewportHeight = Math.max(1, viewportHeight),
    viewport = {
      left: -pan.x / safeZoom,
      top: -pan.y / safeZoom,
      right: (safeViewportWidth - pan.x) / safeZoom,
      bottom: (safeViewportHeight - pan.y) / safeZoom,
    },
    moduleBox = modules.length
      ? {
          left: Math.min(...modules.map((module) => module.x)),
          top: Math.min(...modules.map((module) => module.y)),
          right: Math.max(
            ...modules.map((module) => module.x + module.width),
          ),
          bottom: Math.max(
            ...modules.map((module) => module.y + RACK_GRID_HEIGHT),
          ),
        }
      : { left: 0, top: 0, right: 0, bottom: 0 },
    horizontalMargin = (safeViewportWidth / safeZoom) * 0.9,
    verticalMargin = (safeViewportHeight / safeZoom) * 0.9,
    left =
      Math.floor(
        Math.min(viewport.left, moduleBox.left - horizontalMargin) /
          RACK_GRID_WIDTH,
      ) * RACK_GRID_WIDTH,
    top =
      Math.floor(
        Math.min(viewport.top, moduleBox.top - verticalMargin) /
          RACK_GRID_HEIGHT,
      ) * RACK_GRID_HEIGHT,
    right =
      Math.ceil(
        Math.max(viewport.right, moduleBox.right + horizontalMargin) /
          RACK_GRID_WIDTH,
      ) * RACK_GRID_WIDTH,
    bottom =
      Math.ceil(
        Math.max(viewport.bottom, moduleBox.bottom + verticalMargin) /
          RACK_GRID_HEIGHT,
      ) * RACK_GRID_HEIGHT;
  return {
    x: left,
    y: top,
    width: Math.max(RACK_GRID_WIDTH, right - left),
    height: Math.max(RACK_GRID_HEIGHT, bottom - top),
    right,
    bottom,
  };
}

export function rackModulesOverlap(
  first: Pick<ModuleInstance, "x" | "y" | "width">,
  second: Pick<ModuleInstance, "x" | "y" | "width">,
) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + RACK_GRID_HEIGHT <= second.y ||
    second.y + RACK_GRID_HEIGHT <= first.y
  );
}

export function moveRackModulesWithoutOverlap(
  modules: ModuleInstance[],
  origins: ReadonlyMap<string, { x: number; y: number }>,
  delta: { x: number; y: number },
) {
  const movingIds = new Set(origins.keys()),
    proposed = modules.map((module) => {
      const origin = origins.get(module.id);
      if (!origin) return module;
      const position = snapRackPosition({
        x: origin.x + delta.x,
        y: origin.y + delta.y,
      });
      return { ...module, ...position };
    }),
    moving = proposed.filter((module) => movingIds.has(module.id)),
    stationary = proposed.filter((module) => !movingIds.has(module.id));
  if (
    moving.some((module) =>
      stationary.some((other) => rackModulesOverlap(module, other)),
    )
  )
    return modules;
  return proposed;
}

function rackCopyWithoutId(rack: Record<string, unknown> | undefined) {
  if (!rack) return undefined;
  const copy = { ...rack };
  delete copy.id;
  return copy;
}

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
    !patch.modules.some((module) => module.id === to.moduleId)
  )
    return null;
  return {
    ...patch,
    cables: [
      ...patch.cables.filter(
        (cable) =>
          !(cable.toModule === to.moduleId && cable.toPort === to.portId),
      ),
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
  const nextCable = side === "input"
    ? { ...cable, toModule: port.moduleId, toPort: port.portId }
    : { ...cable, fromModule: port.moduleId, fromPort: port.portId };
  return {
    ...patch,
    cables: patch.cables
      .filter((candidate) => candidate.id === cableId || !(side === "input"
        ? candidate.toModule === port.moduleId && candidate.toPort === port.portId
        : false))
      .map((candidate) => candidate.id === cableId ? nextCable : candidate),
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
  if (
    !target ||
    preset.plugin !== target.plugin ||
    preset.model !== target.model
  )
    return null;
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
      preset.data &&
      typeof preset.data === "object" &&
      !Array.isArray(preset.data)
        ? (preset.data as Record<string, unknown>)
        : undefined,
    rack = { ...(target.rack ?? {}) };
  if (data) rack.data = data;
  else delete rack.data;
  const state = data
    ? stateFromData(
        target.key,
        data,
        target.stateKeys ?? definition.stateKeys,
      )
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

export function duplicatePatchModules(
  patch: PatchDocument,
  moduleIds: ReadonlySet<string>,
  newModuleId: (originalId: string) => string,
  newCableId: (originalId: string) => string,
  offset = { x: 30, y: 40 },
) {
  const originals = patch.modules.filter((module) => moduleIds.has(module.id));
  if (!originals.length) return null;
  const ids = new Map(
      originals.map((module) => [module.id, newModuleId(module.id)]),
    ),
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

export function disconnectModuleCables(
  patch: PatchDocument,
  moduleId: string,
) {
  if (!patch.modules.some((module) => module.id === moduleId)) return null;
  const cables = patch.cables.filter(
    (cable) =>
      cable.fromModule !== moduleId && cable.toModule !== moduleId,
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
        (cable) =>
          cable.fromModule !== moduleId && cable.toModule !== moduleId,
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

export function fittedPatchViewport(
  modules: ModuleInstance[],
  viewportWidth: number,
  viewportHeight: number,
) {
  if (!modules.length || viewportWidth <= 0 || viewportHeight <= 0) return null;
  const minX = Math.min(...modules.map((module) => module.x)),
    minY = Math.min(...modules.map((module) => module.y)),
    maxX = Math.max(...modules.map((module) => module.x + module.width)),
    maxY = Math.max(...modules.map((module) => module.y + 380)),
    contentWidth = Math.max(1, maxX - minX),
    contentHeight = Math.max(1, maxY - minY),
    zoom = Math.min(
      1.25,
      Math.max(
        0.08,
        Math.min(
          (viewportWidth - 80) / contentWidth,
          (viewportHeight - 80) / contentHeight,
        ),
      ),
    );
  return {
    zoom,
    pan: {
      x: (viewportWidth - contentWidth * zoom) / 2 - minX * zoom,
      y: (viewportHeight - contentHeight * zoom) / 2 - minY * zoom,
    },
  };
}

export function anchoredViewportPan(
  pan: { x: number; y: number },
  currentZoom: number,
  nextZoom: number,
  anchor: { x: number; y: number },
) {
  const safeZoom = Math.max(0.0001, currentZoom);
  return {
    x: anchor.x - ((anchor.x - pan.x) / safeZoom) * nextZoom,
    y: anchor.y - ((anchor.y - pan.y) / safeZoom) * nextZoom,
  };
}

export function modulesIntersectingViewportRect(
  modules: ModuleInstance[],
  pan: { x: number; y: number },
  zoom: number,
  rect: { left: number; top: number; right: number; bottom: number },
) {
  return modules
    .filter((module) => {
      const left = module.x * zoom + pan.x,
        top = module.y * zoom + pan.y,
        right = (module.x + module.width) * zoom + pan.x,
        bottom = (module.y + 380) * zoom + pan.y;
      return (
        right >= rect.left &&
        left <= rect.right &&
        bottom >= rect.top &&
        top <= rect.bottom
      );
    })
    .map((module) => module.id);
}

export function modulePortPosition(
  module: ModuleInstance,
  direction: "in" | "out",
  portId: number,
  portCount: number,
  rackPosition?: { x:number; y:number; width?:number; height?:number; centered?:boolean },
  rackWidth = module.width,
) {
  if (rackPosition && rackWidth > 0) {
    const anchorOffsetX=rackPosition.centered?0:(rackPosition.width??24)/2,
      anchorOffsetY=rackPosition.centered?0:(rackPosition.height??24)/2;
    return {
      x:module.x+(rackPosition.x+anchorOffsetX)*(module.width/rackWidth),
      y:module.y+rackPosition.y+anchorOffsetY,
    };
  }
  const columns = portCount > 5 ? 2 : 1,
    rows = Math.max(1, Math.ceil(portCount / columns)),
    column = Math.max(0, portId) % columns,
    row = Math.floor(Math.max(0, portId) / columns),
    horizontalGap = columns > 1 ? 2 : 0,
    containerWidth = module.width / 2,
    columnWidth =
      (containerWidth - 8 - horizontalGap * (columns - 1)) / columns,
    columnLeft =
      module.x +
      (direction === "out" ? containerWidth : 0) +
      4 +
      column * (columnWidth + horizontalGap),
    verticalGap = rows > 1 ? 2 : 0,
    rowHeight = (132 - verticalGap * (rows - 1)) / rows;
  return {
    x:
      direction === "in"
        ? columnLeft + 10
        : columnLeft + columnWidth - 10,
    y: module.y + 222 + row * (rowHeight + verticalGap) + rowHeight / 2,
  };
}

type ModulePortLayout = {
  id: number;
  hidden?: boolean;
  position?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    centered?: boolean;
  };
};

/**
 * Resolves the one authoritative center shared by a jack hit target, cable
 * plug, and cable path. Rack itself anchors CableWidget endpoints to the
 * center of PortWidget; keeping this in one function prevents CSS layout from
 * becoming a second, slightly different geometry engine.
 */
export function resolvedModulePortPosition(
  module: ModuleInstance,
  direction: "in" | "out",
  portId: number,
  ports: readonly ModulePortLayout[],
  rackWidth = module.width,
) {
  const visiblePorts = ports.filter((port) => !port.hidden),
    port = visiblePorts.find((candidate) => candidate.id === portId),
    visibleIndex = visiblePorts.findIndex((candidate) => candidate.id === portId),
    fallbackIndex = visibleIndex >= 0 ? visibleIndex : Math.max(0, portId),
    portCount = Math.max(1, visiblePorts.length, fallbackIndex + 1);
  return modulePortPosition(
    module,
    direction,
    fallbackIndex,
    portCount,
    port?.position,
    rackWidth,
  );
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
        candidate.id === moduleId
          ? { ...replacement, id: moduleId }
          : candidate,
      ),
      cables,
    },
    droppedCables,
  };
}
