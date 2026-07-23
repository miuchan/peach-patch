export const RACK_DOUBLE_CLICK_DURATION_MS = 300;

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
