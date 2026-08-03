import type { ParamSpec, PortSpec } from "./web-plugin-registry.ts";

type PositionedWidget = ParamSpec | PortSpec;

const MIN_WIDGET_CENTER_DISTANCE = 3;

function visiblePositionedWidgets(
  params: readonly ParamSpec[],
  inputs: readonly PortSpec[],
  outputs: readonly PortSpec[],
) {
  return [
    ...params.filter((item) => !item.hidden && !item.contextOnly),
    ...inputs.filter((item) => !item.hidden),
    ...outputs.filter((item) => !item.hidden),
  ].filter(
    (item): item is PositionedWidget & { position: NonNullable<PositionedWidget["position"]> } =>
      Boolean(item.position),
  );
}

/**
 * Rejects source geometry that is clearly expressed in the wrong unit, outside
 * the fixed Rack panel, or collapsed onto one point. Official panel artwork is
 * safer than drawing interactive widgets at coordinates we know are corrupt.
 */
export function rackUiGeometryIsTrustworthy(
  params: readonly ParamSpec[],
  inputs: readonly PortSpec[],
  outputs: readonly PortSpec[],
) {
  const widgets = visiblePositionedWidgets(params, inputs, outputs);
  if (!widgets.length) return false;
  if (
    widgets.some(
      ({ position }) =>
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y) ||
        position.x < 0 ||
        position.y < 0 ||
        position.y > 380,
    )
  )
    return false;
  for (let index = 0; index < widgets.length; index += 1) {
    const current = widgets[index].position;
    for (let candidate = index + 1; candidate < widgets.length; candidate += 1) {
      const other = widgets[candidate].position;
      if (Math.hypot(current.x - other.x, current.y - other.y) < MIN_WIDGET_CENTER_DISTANCE)
        return false;
    }
  }
  return true;
}
