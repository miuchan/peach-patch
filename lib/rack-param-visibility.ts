import type { ParamSpec, StateSpec } from "./web-plugin-registry";

export function rackParamIsVisible(
  param: ParamSpec,
  stateKeys: readonly StateSpec[] | undefined,
  state: readonly number[] | undefined,
  connectedInputIds: ReadonlySet<number>,
) {
  if (param.visibleWhenState) {
    const stateIndex =
      stateKeys?.findIndex((item) => item.key === param.visibleWhenState?.key) ?? -1;
    if (stateIndex < 0) return false;
    const stateValue = state?.[stateIndex] ?? stateKeys?.[stateIndex]?.default ?? 0;
    if (Math.round(stateValue) !== param.visibleWhenState.equals) return false;
  }

  if (param.visibleWhenInputConnection) {
    const { ids, mode, connected } = param.visibleWhenInputConnection;
    const matches =
      mode === "all"
        ? ids.every((id) => connectedInputIds.has(id) === connected)
        : ids.some((id) => connectedInputIds.has(id) === connected);
    if (!matches) return false;
  }

  return true;
}
