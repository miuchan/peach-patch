// Match the upper end of desktop accessibility double-click intervals.
// Rack controls suppress native mouse events to implement vertical dragging,
// so pointer timing must remain usable for people with a slower click cadence.
export const RACK_DOUBLE_CLICK_DURATION_MS = 1_000;

export type RackParamPress = {
  paramId: number;
  pointerType: string;
  time: number;
};

export function registerRackParamPress(
  previous: RackParamPress | null,
  paramId: number,
  pointerType: string,
  time: number,
): { doubleClick: boolean; next: RackParamPress | null } {
  const elapsed = previous ? time - previous.time : Number.POSITIVE_INFINITY;
  const doubleClick =
    previous?.paramId === paramId &&
    previous.pointerType === pointerType &&
    elapsed >= 0 &&
    elapsed <= RACK_DOUBLE_CLICK_DURATION_MS;

  return {
    doubleClick,
    next: doubleClick ? null : { paramId, pointerType, time },
  };
}

export function rackParamResetValue(param: ParamSpec, values: readonly number[]): number {
  if (!param.resetFrom) return param.default;
  const source = values[param.resetFrom.paramId];
  if (!Number.isFinite(source)) return param.default;
  const value = source * param.resetFrom.scale + param.resetFrom.offset;
  if (param.unbounded) return value;
  return Math.min(Math.max(param.min, param.max), Math.max(Math.min(param.min, param.max), value));
}
import type { ParamSpec } from "./web-plugin-registry";
