import type { ModuleInstance } from "./patch-types";

export const RACK_GRID_WIDTH = 15;
export const RACK_GRID_HEIGHT = 380;

export function snapRackPosition(position: { x: number; y: number }) {
  return {
    x: Math.round(position.x / RACK_GRID_WIDTH) * RACK_GRID_WIDTH,
    y: Math.round(position.y / RACK_GRID_HEIGHT) * RACK_GRID_HEIGHT,
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
  if (moving.some((module) => stationary.some((other) => rackModulesOverlap(module, other))))
    return modules;
  return proposed;
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
    maxY = Math.max(...modules.map((module) => module.y + RACK_GRID_HEIGHT)),
    contentWidth = Math.max(1, maxX - minX),
    contentHeight = Math.max(1, maxY - minY),
    zoom = Math.min(
      1.25,
      Math.max(
        0.08,
        Math.min((viewportWidth - 80) / contentWidth, (viewportHeight - 80) / contentHeight),
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
        bottom = (module.y + RACK_GRID_HEIGHT) * zoom + pan.y;
      return right >= rect.left && left <= rect.right && bottom >= rect.top && top <= rect.bottom;
    })
    .map((module) => module.id);
}

export function modulePortPosition(
  module: ModuleInstance,
  direction: "in" | "out",
  portId: number,
  portCount: number,
  rackPosition?: { x: number; y: number; width?: number; height?: number; centered?: boolean },
  rackWidth = module.width,
) {
  if (rackPosition && rackWidth > 0) {
    const anchorOffsetX = rackPosition.centered ? 0 : (rackPosition.width ?? 24) / 2,
      anchorOffsetY = rackPosition.centered ? 0 : (rackPosition.height ?? 24) / 2;
    return {
      x: module.x + (rackPosition.x + anchorOffsetX) * (module.width / rackWidth),
      y: module.y + rackPosition.y + anchorOffsetY,
    };
  }
  const columns = portCount > 5 ? 2 : 1,
    rows = Math.max(1, Math.ceil(portCount / columns)),
    column = Math.max(0, portId) % columns,
    row = Math.floor(Math.max(0, portId) / columns),
    horizontalGap = columns > 1 ? 2 : 0,
    containerWidth = module.width / 2,
    columnWidth = (containerWidth - 8 - horizontalGap * (columns - 1)) / columns,
    columnLeft =
      module.x +
      (direction === "out" ? containerWidth : 0) +
      4 +
      column * (columnWidth + horizontalGap),
    verticalGap = rows > 1 ? 2 : 0,
    rowHeight = (132 - verticalGap * (rows - 1)) / rows;
  return {
    x: direction === "in" ? columnLeft + 10 : columnLeft + columnWidth - 10,
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
  return modulePortPosition(module, direction, fallbackIndex, portCount, port?.position, rackWidth);
}
