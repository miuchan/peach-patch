import assert from "node:assert/strict";
import test from "node:test";

type TestCable = {
  fromModule: string;
  fromPort: number;
  toPort: number;
  feedback: boolean;
};

type TestSource = {
  outputCount: number;
  outputs: Float32Array;
  previous: Float32Array;
  currentChannels: Uint8Array;
  previousChannels: Uint8Array;
};

type TestTarget = {
  id: string;
  inputCount: number;
  maxChannels: number;
  inputs: Float32Array;
  inputChannels: Uint8Array;
  runtime: {
    rack_web_set_input_connected: (port: number, connected: number) => void;
    rack_web_set_input_channels: (port: number, channels: number) => void;
  };
};

type TestProcessor = {
  modules: Map<string, TestSource>;
  incoming: Map<string, TestCable[]>;
  ready: boolean;
  visualUpdatesEnabled: boolean;
  emitMonitoredPortPeaks: (frames: number) => void;
  emitVisualSignals: (frames: number) => void;
  drainCaptures: () => void;
  prepareInputs: (module: TestTarget, frames: number) => void;
  prepareInputFrame: (module: TestTarget, frame: number) => void;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
  port: {
    onmessage: ((event: { data: Record<string, unknown> }) => void) | null;
    postMessage: (message: unknown, transfer?: unknown[]) => void;
  };
};

type TestProcessorConstructor = new () => TestProcessor;

test("Rack graph stacks inputs and broadcasts mono signals across polyphonic channels", async () => {
  let Processor: TestProcessorConstructor | undefined;
  const workletGlobal = globalThis as typeof globalThis & {
    AudioWorkletProcessor: new () => {
      port: {
        onmessage: ((event: { data: Record<string, unknown> }) => void) | null;
        postMessage: (message: unknown, transfer?: unknown[]) => void;
      };
    };
    registerProcessor: (name: string, constructor: TestProcessorConstructor) => void;
    sampleRate: number;
  };
  const previous = {
    AudioWorkletProcessor: Reflect.get(globalThis, "AudioWorkletProcessor"),
    registerProcessor: Reflect.get(globalThis, "registerProcessor"),
    sampleRate: Reflect.get(globalThis, "sampleRate"),
  };

  try {
    workletGlobal.AudioWorkletProcessor = class {
      port = {
        onmessage: null,
        postMessage: () => {},
      };
    };
    workletGlobal.registerProcessor = (_name, constructor) => {
      Processor = constructor;
    };
    workletGlobal.sampleRate = 48_000;
    await import(new URL("../public/audio/rack-graph-processor.js", import.meta.url).href);

    assert.ok(Processor);
    const processor = new Processor();
    const monoOutputs = new Float32Array(3 * 128);
    monoOutputs[0] = 1;
    monoOutputs[1] = 2;
    const polyOutputs = new Float32Array(3 * 128);
    polyOutputs[0] = 10;
    polyOutputs[1] = 10;
    polyOutputs[128] = 20;
    polyOutputs[129] = 20;
    polyOutputs[256] = 30;
    polyOutputs[257] = 30;
    processor.modules.set("mono", {
      outputCount: 1,
      outputs: monoOutputs,
      previous: new Float32Array(monoOutputs.length),
      currentChannels: new Uint8Array([1]),
      previousChannels: new Uint8Array([1]),
    });
    processor.modules.set("poly", {
      outputCount: 1,
      outputs: polyOutputs,
      previous: new Float32Array(polyOutputs.length),
      currentChannels: new Uint8Array([3]),
      previousChannels: new Uint8Array([3]),
    });
    processor.incoming.set("target", [
      { fromModule: "mono", fromPort: 0, toPort: 0, feedback: false },
      { fromModule: "poly", fromPort: 0, toPort: 0, feedback: false },
    ]);
    const connected: number[] = [];
    const channelCounts: number[] = [];
    const target: TestTarget = {
      id: "target",
      inputCount: 1,
      maxChannels: 3,
      inputs: new Float32Array(3 * 128),
      inputChannels: new Uint8Array(1),
      runtime: {
        rack_web_set_input_connected: (_port, value) => connected.push(value),
        rack_web_set_input_channels: (_port, value) => channelCounts.push(value),
      },
    };

    processor.prepareInputs(target, 2);
    assert.deepEqual(Array.from(target.inputChannels), [3]);
    assert.deepEqual(connected, [1]);
    assert.deepEqual(channelCounts, [3]);
    assert.deepEqual(
      [
        target.inputs[0],
        target.inputs[1],
        target.inputs[128],
        target.inputs[129],
        target.inputs[256],
        target.inputs[257],
      ],
      [11, 12, 21, 22, 31, 32],
    );

    target.inputs.fill(99);
    processor.prepareInputFrame(target, 1);
    assert.deepEqual([target.inputs[1], target.inputs[129], target.inputs[257]], [12, 22, 32]);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(globalThis, key);
      else Reflect.set(globalThis, key, value);
    }
  }
});

test("Rack graph pauses only visual telemetry during direct manipulation", async () => {
  let Processor: TestProcessorConstructor | undefined;
  const workletGlobal = globalThis as typeof globalThis & {
    AudioWorkletProcessor: new () => TestProcessor["port"];
    registerProcessor: (name: string, constructor: TestProcessorConstructor) => void;
    sampleRate: number;
  };
  const previous = {
    AudioWorkletProcessor: Reflect.get(globalThis, "AudioWorkletProcessor"),
    registerProcessor: Reflect.get(globalThis, "registerProcessor"),
    sampleRate: Reflect.get(globalThis, "sampleRate"),
  };

  try {
    workletGlobal.AudioWorkletProcessor = class {
      port = {
        onmessage: null,
        postMessage: () => {},
      };
    } as unknown as new () => TestProcessor["port"];
    workletGlobal.registerProcessor = (_name, constructor) => {
      Processor = constructor;
    };
    workletGlobal.sampleRate = 48_000;
    await import(
      `${new URL("../public/audio/rack-graph-processor.js", import.meta.url).href}?visual-pause`
    );

    assert.ok(Processor);
    const processor = new Processor();
    let monitorCalls = 0,
      visualCalls = 0,
      captureDrainCalls = 0;
    processor.ready = true;
    processor.emitMonitoredPortPeaks = () => monitorCalls++;
    processor.emitVisualSignals = () => visualCalls++;
    processor.drainCaptures = () => captureDrainCalls++;
    const outputs = [[new Float32Array(128), new Float32Array(128)]];

    processor.process([], outputs);
    assert.deepEqual([monitorCalls, visualCalls], [1, 1]);
    assert.equal(captureDrainCalls, 1);

    processor.port.onmessage?.({
      data: { type: "visual-updates", enabled: false },
    });
    assert.equal(processor.visualUpdatesEnabled, false);
    processor.process([], outputs);
    assert.deepEqual([monitorCalls, visualCalls], [1, 1]);
    assert.equal(captureDrainCalls, 2);

    processor.port.onmessage?.({
      data: { type: "visual-updates", enabled: true },
    });
    processor.process([], outputs);
    assert.deepEqual([monitorCalls, visualCalls], [2, 2]);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(globalThis, key);
      else Reflect.set(globalThis, key, value);
    }
  }
});
