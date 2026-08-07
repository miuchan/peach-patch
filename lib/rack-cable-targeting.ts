export type RackCablePortReference = {
  moduleId: string;
  direction: "in" | "out";
  portId: number;
};

export type RackCablePortCandidate = RackCablePortReference & {
  clientX: number;
  clientY: number;
};

export type RackCablePointerKind = "mouse" | "pen" | "touch";

/**
 * Uses physical screen pixels so the acquisition area remains comfortable at
 * every Rack zoom level. Starting a cable stays conservative around panel
 * controls; dropping is deliberately more forgiving and is confirmed by the
 * live snapped preview.
 */
export function cablePortSnapRadius(pointerType: string, phase: "start" | "drop"): number {
  const kind: RackCablePointerKind =
    pointerType === "touch" ? "touch" : pointerType === "pen" ? "pen" : "mouse";
  if (phase === "start") return kind === "touch" ? 34 : kind === "pen" ? 28 : 22;
  return kind === "touch" ? 48 : kind === "pen" ? 40 : 32;
}

function portsAreCompatible(anchor: RackCablePortReference, candidate: RackCablePortReference) {
  return anchor.direction !== candidate.direction && anchor.moduleId !== candidate.moduleId;
}

export function closestCablePort<T extends RackCablePortCandidate>(
  candidates: readonly T[],
  point: { clientX: number; clientY: number },
  maxDistance: number,
  anchor?: RackCablePortReference,
): T | null {
  const maximumSquared = maxDistance * maxDistance;
  let closest: T | null = null;
  let closestSquared = maximumSquared;
  for (const candidate of candidates) {
    if (anchor && !portsAreCompatible(anchor, candidate)) continue;
    const dx = candidate.clientX - point.clientX;
    const dy = candidate.clientY - point.clientY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > closestSquared) continue;
    closest = candidate;
    closestSquared = distanceSquared;
  }
  return closest;
}
