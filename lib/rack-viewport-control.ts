import type { ModuleInstance } from "./patch-types";
import type { RackHostControl } from "./rack-audio-engine.ts";

export type RackViewportState = {
  pan: { x: number; y: number };
  zoom: number;
  lockX: number | null;
  lockY: number | null;
};

export type RackViewportMetrics = {
  modules: Array<Pick<ModuleInstance, "x" | "y" | "width">>;
  width: number;
  height: number;
};

export function applyRackHostViewportControl(
  control: RackHostControl,
  state: RackViewportState,
  metrics: RackViewportMetrics,
): RackViewportState {
  const previousZoom = state.zoom;
  const nextZoom = Number.isFinite(control.zoom)
    ? Math.max(0.08, Math.min(2.4, control.zoom!))
    : previousZoom;
  const next = {
    x: state.pan.x / previousZoom * nextZoom,
    y: state.pan.y / previousZoom * nextZoom,
  };
  const modules = metrics.modules;
  const padding = Math.max(0, control.padding) * 15;
  const minX = (modules.length ? Math.min(...modules.map((module) => module.x)) : 0) - padding;
  const minY = (modules.length ? Math.min(...modules.map((module) => module.y)) : 0) - padding;
  const maxX = (modules.length ? Math.max(...modules.map((module) => module.x + module.width)) : 0) + padding;
  const maxY = (modules.length ? Math.max(...modules.map((module) => module.y + 380)) : 0) + padding;
  const visibleWidth = Math.max(1, metrics.width) / nextZoom;
  const visibleHeight = Math.max(1, metrics.height) / nextZoom;
  const maxScrollX = Math.max(minX, maxX - visibleWidth);
  const maxScrollY = Math.max(minY, maxY - visibleHeight);
  if (control.jumpLeft) next.x += Math.max(0, control.xStep) * 15 * nextZoom;
  if (control.jumpRight) next.x -= Math.max(0, control.xStep) * 15 * nextZoom;
  if (control.jumpUp) next.y += Math.max(0, control.yStep) * (380 / 3) * nextZoom;
  if (control.jumpDown) next.y -= Math.max(0, control.yStep) * (380 / 3) * nextZoom;
  if (Number.isFinite(control.x)) next.x = -(minX + (maxScrollX - minX) * control.x!) * nextZoom;
  if (Number.isFinite(control.y)) next.y = -(minY + (maxScrollY - minY) * control.y!) * nextZoom;

  const holdX = control.lockX && !control.leftConnected && !control.rightConnected && !control.xConnected;
  const holdY = control.lockY && !control.upConnected && !control.downConnected && !control.yConnected;
  let lockX = state.lockX;
  let lockY = state.lockY;
  if (control.lockX) {
    if (lockX === null) lockX = -next.x / nextZoom;
    else if (holdX) next.x = -lockX * nextZoom;
  } else lockX = null;
  if (control.lockY) {
    if (lockY === null) lockY = -next.y / nextZoom;
    else if (holdY) next.y = -lockY * nextZoom;
  } else lockY = null;
  return { pan: next, zoom: nextZoom, lockX, lockY };
}
