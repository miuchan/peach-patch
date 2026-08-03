import type { PatchDocument } from "./patch-types";

export type PatchAutomationEvent = {
  timeMs: number;
  moduleId: string;
  paramId: number;
  value: number;
};

export type PatchAutomationClip = {
  durationMs: number;
  events: PatchAutomationEvent[];
};

export function appendAutomationEvent(
  events: PatchAutomationEvent[],
  event: PatchAutomationEvent,
  limit = 10_000,
) {
  const previous = events.at(-1);
  if (
    previous &&
    previous.moduleId === event.moduleId &&
    previous.paramId === event.paramId &&
    event.timeMs - previous.timeMs < 16
  ) {
    events[events.length - 1] = event;
    return;
  }
  if (events.length >= limit) events.shift();
  events.push(event);
}

export function automationClipFromPatch(patch: PatchDocument): PatchAutomationClip | null {
  const raw = patch.rack?.patchworkWebAutomation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (!Array.isArray(source.events)) return null;
  const events = source.events.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const value = entry as Record<string, unknown>,
      timeMs = Number(value.timeMs),
      moduleId = String(value.moduleId || ""),
      paramId = Number(value.paramId),
      paramValue = Number(value.value);
    return Number.isFinite(timeMs) &&
      timeMs >= 0 &&
      moduleId &&
      Number.isInteger(paramId) &&
      paramId >= 0 &&
      Number.isFinite(paramValue)
      ? [{ timeMs, moduleId, paramId, value: paramValue }]
      : [];
  });
  return {
    durationMs: Math.max(1, Number(source.durationMs) || events.at(-1)?.timeMs || 1),
    events,
  };
}

export function patchWithAutomationClip(
  patch: PatchDocument,
  clip: PatchAutomationClip,
): PatchDocument {
  return {
    ...patch,
    rack: {
      ...(patch.rack ?? {}),
      patchworkWebAutomation: clip,
    },
  };
}
