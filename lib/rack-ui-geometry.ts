import type { ParamSpec, PortSpec } from "./web-plugin-registry.ts";
import { rackParamControlSize } from "./rack-param-visual-data.ts";

const MIN_WIDGET_CENTER_DISTANCE = 3;

function visiblePositionedWidgets(
  params: readonly ParamSpec[],
  inputs: readonly PortSpec[],
  outputs: readonly PortSpec[],
) {
  return [
    ...params
      .filter((item) => !item.hidden && !item.contextOnly && item.position)
      .map((item) => ({ item, size: rackParamControlSize(item) })),
    ...inputs
      .filter((item) => !item.hidden && item.position)
      .map((item) => ({
        item,
        size: { width: item.position?.width ?? 24, height: item.position?.height ?? 24 },
      })),
    ...outputs
      .filter((item) => !item.hidden && item.position)
      .map((item) => ({
        item,
        size: { width: item.position?.width ?? 24, height: item.position?.height ?? 24 },
      })),
  ].map(({ item, size }) => {
    const position = item.position!;
    return {
      x: position.x + (position.centered ? 0 : size.width / 2),
      y: position.y + (position.centered ? 0 : size.height / 2),
    };
  });
}

/**
 * Rejects source geometry that is clearly expressed in the wrong unit, outside
 * the fixed Rack panel, or collapsed onto one point. Official panel artwork is
 * safer than drawing interactive widgets at coordinates we know are corrupt.
 */
export function rackUiGeometryIsTrustworthy(
  panelWidth: number,
  params: readonly ParamSpec[],
  inputs: readonly PortSpec[],
  outputs: readonly PortSpec[],
) {
  const widgets = visiblePositionedWidgets(params, inputs, outputs);
  if (!Number.isFinite(panelWidth) || panelWidth <= 0 || !widgets.length) return false;
  if (
    widgets.some(
      ({ x, y }) =>
        !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > panelWidth || y < 0 || y > 380,
    )
  )
    return false;
  for (let index = 0; index < widgets.length; index += 1) {
    const current = widgets[index];
    for (let candidate = index + 1; candidate < widgets.length; candidate += 1) {
      const other = widgets[candidate];
      if (Math.hypot(current.x - other.x, current.y - other.y) < MIN_WIDGET_CENTER_DISTANCE)
        return false;
    }
  }
  return true;
}
