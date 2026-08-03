import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRackAudioCaptureEvent,
  createRackAudioCaptureBlob,
} from "../lib/rack-audio-capture.ts";
import { decodeRackAudioMidiOutput } from "../lib/rack-audio-midi.ts";
import { parseRackAudioWorkletEvent } from "../lib/rack-audio-worklet-events.ts";

test("worklet event parsing rejects malformed boundaries without throwing", () => {
  assert.equal(parseRackAudioWorkletEvent(null), null);
  assert.equal(parseRackAudioWorkletEvent({ type: "unknown" }), null);
  assert.equal(
    parseRackAudioWorkletEvent({
      type: "capture-data",
      moduleId: "recorder",
      samples: new Uint8Array([1, 2, 3]),
    }),
    null,
  );
  assert.equal(
    parseRackAudioWorkletEvent({
      type: "state-json",
      moduleId: "module",
      bytes: new TextEncoder().encode("not json"),
    }),
    null,
  );
  assert.deepEqual(
    parseRackAudioWorkletEvent({
      type: "capture-start",
      moduleId: "recorder",
      channels: 0,
      sampleRate: 0,
    }),
    {
      type: "capture-start",
      moduleId: "recorder",
      format: "wav",
      channels: 1,
      sampleRate: 48_000,
    },
  );

  const hostile = {
    type: "visual-signals",
    get cables(): never {
      throw new Error("hostile getter");
    },
  };
  const hostileType = {
    get type(): never {
      throw new Error("hostile type getter");
    },
  };
  assert.doesNotThrow(() => parseRackAudioWorkletEvent(hostile));
  assert.doesNotThrow(() => parseRackAudioWorkletEvent(hostileType));
  assert.equal(parseRackAudioWorkletEvent(hostile), null);
  assert.equal(parseRackAudioWorkletEvent(hostileType), null);
});

test("worklet state and telemetry are normalized before engine callbacks", () => {
  const state = parseRackAudioWorkletEvent({
    type: "state-json",
    moduleId: "oscillator",
    bytes: new TextEncoder().encode(JSON.stringify({ mode: "sine" })),
  });
  assert.deepEqual(state, {
    type: "state-json",
    moduleId: "oscillator",
    state: { mode: "sine" },
  });

  const telemetry = parseRackAudioWorkletEvent({
    type: "visual-signals",
    cables: { cable: "2.5", invalid: Number.POSITIVE_INFINITY },
    scopes: { osc: [new Float32Array([1, Number.NaN])] },
    plugs: {
      cable: {
        voltage: "4.5",
        rms: Number.NaN,
        channels: -2,
        rgb: [-1, 0.25, 2],
      },
    },
    lights: { osc: [-1, "0.75", Number.POSITIVE_INFINITY] },
    hostControl: {
      moduleId: "viewport",
      jumpUp: 1,
      x: 0.5,
      zoom: "not-a-number",
      padding: "2",
      lockX: true,
    },
  });
  assert.deepEqual(telemetry, {
    type: "visual-signals",
    cables: { cable: 2.5, invalid: 0 },
    scopes: { osc: [[1, 0]] },
    plugs: {
      cable: { voltage: 4.5, rms: 0, channels: 0, rgb: [0, 0.25, 1] },
    },
    lights: { osc: [0, 0.75, 0] },
    hostControl: {
      moduleId: "viewport",
      jumpUp: true,
      jumpDown: false,
      jumpLeft: false,
      jumpRight: false,
      x: 0.5,
      padding: 2,
      xStep: 0,
      yStep: 0,
      lockX: true,
      lockY: false,
      xConnected: false,
      yConnected: false,
      leftConnected: false,
      rightConnected: false,
      upConnected: false,
      downConnected: false,
    },
  });
});

test("worklet lifecycle, MIDI, peak, and capture messages keep their wire contracts", () => {
  assert.deepEqual(parseRackAudioWorkletEvent({ type: "ready", feedbackEdges: "2" }), {
    type: "ready",
    feedbackEdges: 2,
  });
  assert.deepEqual(parseRackAudioWorkletEvent({ type: "error" }), {
    type: "error",
    message: "Rack graph AudioWorklet failed to load",
  });
  assert.deepEqual(
    parseRackAudioWorkletEvent({
      type: "midi-output",
      moduleId: "midi",
      records: new Uint8Array([1, 0xf8, 0, 0]),
      packets: new Uint8Array([1, 0, 0xfa]),
    }),
    {
      type: "midi-output",
      moduleId: "midi",
      records: new Uint8Array([1, 0xf8, 0, 0]),
      packets: new Uint8Array([1, 0, 0xfa]),
    },
  );
  assert.deepEqual(
    parseRackAudioWorkletEvent({
      type: "port-peaks",
      moduleId: "meter",
      inputs: new Float32Array([0.5]),
      outputs: [1],
      inputScopes: [[1, Number.NaN]],
      outputScopes: [[-1]],
    }),
    {
      type: "port-peaks",
      moduleId: "meter",
      inputs: [0.5],
      outputs: [1],
      inputScopes: [[1, 0]],
      outputScopes: [[-1]],
    },
  );
  assert.deepEqual(
    parseRackAudioWorkletEvent({
      type: "capture-data",
      moduleId: "recorder",
      format: "midi",
      channels: 1,
      sampleRate: 44_100,
      frames: 2,
      samples: new Float32Array([0x90, 60]),
    }),
    {
      type: "capture-data",
      moduleId: "recorder",
      format: "midi",
      channels: 1,
      sampleRate: 44_100,
      frames: 2,
      samples: new Float32Array([0x90, 60]),
    },
  );
  assert.deepEqual(parseRackAudioWorkletEvent({ type: "capture-stop", moduleId: "recorder" }), {
    type: "capture-stop",
    moduleId: "recorder",
  });
  assert.deepEqual(parseRackAudioWorkletEvent({ type: "captures-stopped", requestId: 7 }), {
    type: "captures-stopped",
    requestId: 7,
  });
  assert.deepEqual(parseRackAudioWorkletEvent({ type: "automation-complete" }), {
    type: "automation-complete",
  });
});

test("capture accumulation appends chunks in place and preserves WAV and MIDI wire behavior", async () => {
  const started = applyRackAudioCaptureEvent(undefined, {
    type: "capture-start",
    moduleId: "recorder",
    format: "wav",
    channels: 2,
    sampleRate: 48_000,
  });
  assert.equal(started.type, "started");
  if (started.type !== "started") return;

  const parts = started.capture.parts;
  const updated = applyRackAudioCaptureEvent(started.capture, {
    type: "capture-data",
    moduleId: "recorder",
    format: "wav",
    channels: 2,
    sampleRate: 48_000,
    frames: 9,
    samples: new Float32Array([1, -1, 0.5, -0.5]),
  });
  assert.equal(updated.type, "updated");
  if (updated.type !== "updated") return;
  assert.equal(updated.capture, started.capture);
  assert.equal(updated.capture.parts, parts);
  assert.equal(updated.capture.frames, 2);
  assert.equal(updated.capture.parts.length, 1);
  const firstPart = updated.capture.parts[0];
  const appended = applyRackAudioCaptureEvent(updated.capture, {
    type: "capture-data",
    moduleId: "recorder",
    format: "wav",
    channels: 2,
    sampleRate: 48_000,
    frames: 1,
    samples: new Float32Array([0.25, -0.25]),
  });
  assert.equal(appended.type, "updated");
  if (appended.type !== "updated") return;
  assert.equal(appended.capture.parts, parts);
  assert.equal(appended.capture.parts[0], firstPart);
  assert.equal(appended.capture.parts.length, 2);
  assert.equal(appended.capture.frames, 3);
  const wav = createRackAudioCaptureBlob(appended.capture);
  assert.equal(wav.type, "audio/wav");
  assert.equal(wav.size, 56);

  const midi = applyRackAudioCaptureEvent(undefined, {
    type: "capture-data",
    moduleId: "midi-recorder",
    format: "midi",
    channels: 1,
    sampleRate: 48_000,
    frames: 3,
    samples: new Float32Array([-1, 12.6, 300]),
  });
  assert.equal(midi.type, "updated");
  if (midi.type !== "updated") return;
  const midiBlob = createRackAudioCaptureBlob(midi.capture);
  assert.equal(midiBlob.type, "audio/midi");
  assert.deepEqual(new Uint8Array(await midiBlob.arrayBuffer()), new Uint8Array([0, 13, 255]));
});

test("fractional capture metadata is integer-normalized and cannot desynchronize WAV data", async () => {
  const event = parseRackAudioWorkletEvent({
    type: "capture-data",
    moduleId: "fractional-recorder",
    format: "wav",
    channels: 1.5,
    sampleRate: 48_000.75,
    frames: 2.9,
    samples: new Float32Array([1, 0, -1]),
  });
  assert.deepEqual(event, {
    type: "capture-data",
    moduleId: "fractional-recorder",
    format: "wav",
    channels: 1,
    sampleRate: 48_000,
    frames: 2,
    samples: new Float32Array([1, 0, -1]),
  });
  if (!event || event.type !== "capture-data") return;

  const transition = applyRackAudioCaptureEvent(undefined, event);
  assert.equal(transition.type, "updated");
  if (transition.type !== "updated") return;
  assert.equal(transition.capture.frames, 2);
  assert.equal(transition.capture.channels, 1);

  const wav = createRackAudioCaptureBlob(transition.capture);
  const bytes = await wav.arrayBuffer();
  assert.equal(wav.size, 48);
  assert.equal(new DataView(bytes).getUint32(40, true), 4);
});

test("capture channel changes are mixed into the WAV format chosen at start", async () => {
  const started = applyRackAudioCaptureEvent(undefined, {
    type: "capture-start",
    moduleId: "changing-recorder",
    format: "wav",
    channels: 1,
    sampleRate: 48_000,
  });
  assert.equal(started.type, "started");
  if (started.type !== "started") return;

  const updated = applyRackAudioCaptureEvent(started.capture, {
    type: "capture-data",
    moduleId: "changing-recorder",
    format: "wav",
    channels: 2,
    sampleRate: 48_000,
    frames: 2,
    samples: new Float32Array([1, -1, 0.5, 0.25]),
  });
  assert.equal(updated.type, "updated");
  if (updated.type !== "updated") return;
  assert.equal(updated.capture.channels, 1);
  assert.equal(updated.capture.frames, 2);

  const wav = createRackAudioCaptureBlob(updated.capture);
  const view = new DataView(await wav.arrayBuffer());
  assert.equal(wav.size, 48);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), 4);
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), Math.round(0.375 * 0x7fff));
});

test("MIDI output decoding preserves compact records then complete packets", () => {
  const records = new Uint8Array([3, 0x90, 60, 127, 2, 0x80, 60, 0, 1, 0xf8, 0, 0]);
  const packets = new Uint8Array([4, 0, 0xf0, 1, 2, 0xf7, 3, 0, 0x90, 64]);
  assert.deepEqual(decodeRackAudioMidiOutput(records, packets), [
    [0x90, 60, 127],
    [0x80, 60],
    [0xf8],
    [0xf0, 1, 2, 0xf7],
  ]);
});
