export type RackAudioPlugSignal = {
  voltage: number;
  rms: number;
  channels: number;
  rgb: [number, number, number];
};

export type RackAudioHostControl = {
  moduleId: string;
  jumpUp: boolean;
  jumpDown: boolean;
  jumpLeft: boolean;
  jumpRight: boolean;
  x?: number;
  y?: number;
  zoom?: number;
  opacity?: number;
  tension?: number;
  padding: number;
  xStep: number;
  yStep: number;
  lockX: boolean;
  lockY: boolean;
  xConnected: boolean;
  yConnected: boolean;
  leftConnected: boolean;
  rightConnected: boolean;
  upConnected: boolean;
  downConnected: boolean;
};

export type RackAudioCaptureEvent =
  | {
      type: "capture-start";
      moduleId: string;
      format: "wav" | "midi";
      channels: number;
      sampleRate: number;
    }
  | {
      type: "capture-data";
      moduleId: string;
      format: "wav" | "midi";
      channels: number;
      sampleRate: number;
      frames: number;
      samples: Float32Array;
    }
  | { type: "capture-stop"; moduleId: string };

export type RackAudioWorkletEvent =
  | { type: "ready"; feedbackEdges: number }
  | { type: "error"; message: string }
  | { type: "state-json"; moduleId: string; state: Record<string, unknown> }
  | { type: "midi-output"; moduleId: string; records: Uint8Array; packets: Uint8Array }
  | { type: "midi-param" | "automation-param"; moduleId: string; id: number; value: number }
  | { type: "automation-complete" }
  | {
      type: "port-peaks";
      moduleId: string;
      inputs: number[];
      outputs: number[];
      inputScopes: number[][];
      outputScopes: number[][];
    }
  | {
      type: "visual-signals";
      cables: Record<string, number>;
      scopes: Record<string, number[][]>;
      plugs: Record<string, RackAudioPlugSignal>;
      lights: Record<string, number[]>;
      hostControl?: RackAudioHostControl;
    }
  | RackAudioCaptureEvent
  | { type: "captures-stopped"; requestId: number };

const DEFAULT_WORKLET_ERROR = "Rack graph AudioWorklet failed to load";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? number : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizedChannels(value: unknown): 1 | 2 {
  return Math.trunc(finiteNumber(value, 1)) >= 2 ? 2 : 1;
}

function normalizedSampleRate(value: unknown): number {
  return Math.max(1, Math.trunc(finiteNumber(value, 48_000)));
}

function bytesFrom(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (!ArrayBuffer.isView(value)) return undefined;
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function samplesFrom(value: unknown): Float32Array | undefined {
  if (value instanceof Float32Array) return value;
  if (value instanceof ArrayBuffer) {
    if (value.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return undefined;
    return new Float32Array(value);
  }
  return undefined;
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return [];
  return Array.from(value as ArrayLike<unknown>, (item) => finiteNumber(item));
}

function numberMatrix(value: unknown): number[][] {
  return Array.isArray(value) ? value.map(numberArray) : [];
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, finiteNumber(item)]));
}

function signalRecord(value: unknown): Record<string, RackAudioPlugSignal> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([id, item]) => {
      const signal = isRecord(item) ? item : {};
      const rgb = numberArray(signal.rgb).map((channel) => Math.max(0, Math.min(1, channel)));
      return [
        id,
        {
          voltage: finiteNumber(signal.voltage),
          rms: finiteNumber(signal.rms),
          channels: Math.max(0, finiteNumber(signal.channels)),
          rgb: [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0],
        },
      ];
    }),
  );
}

function scopeRecord(value: unknown): Record<string, number[][]> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([id, scopes]) => [id, numberMatrix(scopes)]),
  );
}

function lightRecord(value: unknown): Record<string, number[]> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([id, lights]) => [
      id,
      numberArray(lights).map((brightness) => Math.max(0, brightness)),
    ]),
  );
}

function hostControlFrom(value: unknown): RackAudioHostControl | undefined {
  if (!isRecord(value)) return undefined;
  const optional = {
    x: optionalNumber(value.x),
    y: optionalNumber(value.y),
    zoom: optionalNumber(value.zoom),
    opacity: optionalNumber(value.opacity),
    tension: optionalNumber(value.tension),
  };
  return {
    moduleId: String(value.moduleId || ""),
    jumpUp: Boolean(value.jumpUp),
    jumpDown: Boolean(value.jumpDown),
    jumpLeft: Boolean(value.jumpLeft),
    jumpRight: Boolean(value.jumpRight),
    ...(optional.x === undefined ? {} : { x: optional.x }),
    ...(optional.y === undefined ? {} : { y: optional.y }),
    ...(optional.zoom === undefined ? {} : { zoom: optional.zoom }),
    ...(optional.opacity === undefined ? {} : { opacity: optional.opacity }),
    ...(optional.tension === undefined ? {} : { tension: optional.tension }),
    padding: finiteNumber(value.padding),
    xStep: finiteNumber(value.xStep),
    yStep: finiteNumber(value.yStep),
    lockX: Boolean(value.lockX),
    lockY: Boolean(value.lockY),
    xConnected: Boolean(value.xConnected),
    yConnected: Boolean(value.yConnected),
    leftConnected: Boolean(value.leftConnected),
    rightConnected: Boolean(value.rightConnected),
    upConnected: Boolean(value.upConnected),
    downConnected: Boolean(value.downConnected),
  };
}

function parseStateJson(data: Record<string, unknown>): RackAudioWorkletEvent | null {
  const bytes = bytesFrom(data.bytes);
  if (!bytes) return null;
  const state: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return isRecord(state)
    ? { type: "state-json", moduleId: String(data.moduleId || ""), state }
    : null;
}

function parseCaptureEvent(data: Record<string, unknown>): RackAudioCaptureEvent | null {
  const moduleId = String(data.moduleId || "");
  if (!moduleId) return null;
  if (data.type === "capture-stop") return { type: "capture-stop", moduleId };
  const format = data.format === "midi" ? "midi" : "wav";
  const channels = normalizedChannels(data.channels);
  const sampleRate = normalizedSampleRate(data.sampleRate);
  if (data.type === "capture-start") {
    return { type: "capture-start", moduleId, format, channels, sampleRate };
  }
  const samples = samplesFrom(data.samples);
  if (!samples) return null;
  return {
    type: "capture-data",
    moduleId,
    format,
    channels,
    sampleRate,
    frames: Math.max(0, Math.trunc(finiteNumber(data.frames))),
    samples,
  };
}

function parseKnownEvent(data: Record<string, unknown>): RackAudioWorkletEvent | null {
  switch (data.type) {
    case "ready":
      return { type: "ready", feedbackEdges: finiteNumber(data.feedbackEdges) };
    case "error":
      return {
        type: "error",
        message: typeof data.message === "string" ? data.message : DEFAULT_WORKLET_ERROR,
      };
    case "state-json":
      return parseStateJson(data);
    case "midi-output":
      return {
        type: "midi-output",
        moduleId: String(data.moduleId || ""),
        records: bytesFrom(data.records) ?? new Uint8Array(),
        packets: bytesFrom(data.packets) ?? new Uint8Array(),
      };
    case "midi-param":
    case "automation-param":
      return {
        type: data.type,
        moduleId: String(data.moduleId || ""),
        id: finiteNumber(data.id),
        value: finiteNumber(data.value),
      };
    case "automation-complete":
      return { type: "automation-complete" };
    case "port-peaks":
      return {
        type: "port-peaks",
        moduleId: String(data.moduleId || ""),
        inputs: numberArray(data.inputs),
        outputs: numberArray(data.outputs),
        inputScopes: numberMatrix(data.inputScopes),
        outputScopes: numberMatrix(data.outputScopes),
      };
    case "visual-signals": {
      const hostControl = hostControlFrom(data.hostControl);
      return {
        type: "visual-signals",
        cables: numberRecord(data.cables),
        scopes: scopeRecord(data.scopes),
        plugs: signalRecord(data.plugs),
        lights: lightRecord(data.lights),
        ...(hostControl ? { hostControl } : {}),
      };
    }
    case "capture-start":
    case "capture-data":
    case "capture-stop":
      return parseCaptureEvent(data);
    case "captures-stopped":
      return {
        type: "captures-stopped",
        requestId: finiteNumber(data.requestId),
      };
    default:
      return null;
  }
}

/**
 * Converts the untyped structured-clone boundary into the finite set of events
 * understood by the main-thread audio engine. Malformed plugin telemetry is
 * ignored instead of being allowed to interrupt audio lifecycle handling.
 */
export function parseRackAudioWorkletEvent(value: unknown): RackAudioWorkletEvent | null {
  try {
    if (!isRecord(value) || typeof value.type !== "string") return null;
    return parseKnownEvent(value);
  } catch {
    return null;
  }
}
