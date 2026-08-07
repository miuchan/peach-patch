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
  feedbackSources: Array<Record<string, unknown>>;
  ready: boolean;
  visualUpdatesEnabled: boolean;
  sharedBus: {
    values: Float32Array;
    touches: Float64Array;
    counts: Uint16Array;
    epoch: number;
  };
  emitMonitoredPortPeaks: (frames: number) => void;
  emitVisualSignals: (frames: number) => void;
  drainCaptures: () => void;
  prepareInputs: (module: TestTarget, frames: number) => void;
  prepareInputFrame: (module: TestTarget, frame: number) => void;
  saveFeedbackHistory: (frames: number) => void;
  setModuleParam: (module: Record<string, unknown>, id: number, value: number) => void;
  applyHoverBridge: (module: Record<string, unknown>, frame: number) => void;
  syncModuleParams: (module: Record<string, unknown>) => void;
  runModuleBlock: (module: Record<string, unknown>, frames: number) => boolean;
  loadGraph: (data: Record<string, unknown>) => Promise<void>;
  processQuantum: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
  port: {
    onmessage: ((event: { data: Record<string, unknown> }) => void) | null;
    postMessage: (message: unknown, transfer?: unknown[]) => void;
  };
};

type TestProcessorConstructor = new () => TestProcessor;

test("Rack graph shares expander state across WASM instances and expires absent peers", async () => {
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
      port = { onmessage: null, postMessage: () => {} };
    } as unknown as new () => TestProcessor["port"];
    workletGlobal.registerProcessor = (_name, constructor) => {
      Processor = constructor;
    };
    workletGlobal.sampleRate = 48_000;
    const worklet = await import(
      `${new URL("../public/audio/rack-graph-processor.js", import.meta.url).href}?shared-bus`
    );

    assert.ok(Processor);
    const processor = new Processor();
    const first = worklet.rackWebWasiImports({ sharedBus: processor.sharedBus }).env;
    const second = worklet.rackWebWasiImports({ sharedBus: processor.sharedBus }).env;

    first.rack_web_host_shared_set(24, 3.5);
    assert.equal(second.rack_web_host_shared_get(24), 3.5);
    assert.equal(second.rack_web_host_shared_get(-1), 0);
    first.rack_web_host_shared_touch(2);
    second.rack_web_host_shared_touch(2);
    assert.equal(first.rack_web_host_shared_count(2), 2);

    processor.sharedBus.epoch++;
    assert.equal(first.rack_web_host_shared_active(2), 1);
    assert.equal(first.rack_web_host_shared_count(2), 2);
    first.rack_web_host_shared_touch(2);
    assert.equal(second.rack_web_host_shared_count(2), 1);

    processor.sharedBus.epoch += 2;
    assert.equal(first.rack_web_host_shared_active(2), 0);
    assert.equal(first.rack_web_host_shared_count(2), 0);

    processor.sharedBus.values[24] = 9;
    await processor.loadGraph({ modules: [], wasmArtifacts: [] });
    assert.equal(processor.sharedBus.values[24], 0);
    assert.equal(processor.sharedBus.counts[2], 0);
    assert.equal(processor.sharedBus.epoch, 0);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(globalThis, key);
      else Reflect.set(globalThis, key, value);
    }
  }
});

test("Biset Blank captures source-rate cable history and preserves polyphonic modes", async () => {
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
      port = { onmessage: null, postMessage: () => {} };
    } as unknown as new () => TestProcessor["port"];
    workletGlobal.registerProcessor = (_name, constructor) => {
      Processor = constructor;
    };
    workletGlobal.sampleRate = 48_000;
    await import(
      `${new URL("../public/audio/rack-graph-processor.js", import.meta.url).href}?biset-blank`
    );

    assert.ok(Processor);
    const processor = new Processor() as TestProcessor & {
      cables: Array<Record<string, unknown>>;
      hoverControl: { moduleId: string; type: "out"; id: number; modifiers: number } | null;
      captureBisetBlankSignals: (frames: number) => void;
      bisetBlankVisualData: () => {
        cableWaves: Record<string, number[]>;
        blankScopes: Record<string, number[]>;
      };
    };
    const params = Array(19).fill(0);
    params[4] = 0;
    params[5] = 1;
    processor.modules.set("blank", {
      id: "blank",
      bypassed: false,
      params,
      visuals: [{ kind: "biset-blank-overlay" }],
    } as unknown as TestSource);
    const outputs = new Float32Array(2 * 128);
    for (const [frame, value] of [
      [0, 1],
      [32, 2],
      [64, 3],
      [96, 4],
    ]) {
      outputs[frame] = value;
      outputs[128 + frame] = 10;
    }
    processor.modules.set("source", {
      id: "source",
      outputCount: 1,
      outputs,
      previous: new Float32Array(outputs.length),
      currentChannels: new Uint8Array([2]),
      previousChannels: new Uint8Array([2]),
    } as unknown as TestSource);
    processor.cables = [
      {
        id: "cable",
        fromModule: "source",
        fromPort: 0,
        toModule: "target",
        toPort: 0,
      },
    ];
    processor.hoverControl = { moduleId: "source", type: "out", id: 0, modifiers: 0 };
    processor.captureBisetBlankSignals(128);
    let visual = processor.bisetBlankVisualData();
    assert.equal(visual.cableWaves.cable.length, 256);
    assert.equal(visual.cableWaves.cable[0], 4);
    assert.equal(visual.blankScopes.cable[0], 4);

    params[4] = 1;
    outputs[0] = 3;
    outputs[128] = 7;
    processor.captureBisetBlankSignals(1);
    visual = processor.bisetBlankVisualData();
    assert.equal(visual.cableWaves.cable[0], 10);

    params[10] = 1;
    visual = processor.bisetBlankVisualData();
    assert.equal(visual.blankScopes.cable[0], 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(globalThis, key);
      else Reflect.set(globalThis, key, value);
    }
  }
});

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
    assert.deepEqual(connected, [1]);
    assert.deepEqual(channelCounts, [3]);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(globalThis, key);
      else Reflect.set(globalThis, key, value);
    }
  }
});

test("Rack graph keeps stable controls off the real-time WASM boundary and isolates faults", async () => {
  let Processor: TestProcessorConstructor | undefined;
  const messages: unknown[] = [];
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
        postMessage: (message: unknown) => messages.push(message),
      };
    } as unknown as new () => TestProcessor["port"];
    workletGlobal.registerProcessor = (_name, constructor) => {
      Processor = constructor;
    };
    workletGlobal.sampleRate = 48_000;
    await import(
      `${new URL("../public/audio/rack-graph-processor.js", import.meta.url).href}?rt-cache`
    );

    assert.ok(Processor);
    const processor = new Processor();
    let paramWrites = 0;
    const module = {
      id: "faulty",
      key: "Test/Faulty",
      params: [0.25, 0.5],
      paramCache: new Float64Array(2).fill(Number.NaN),
      dirtyParams: new Set([0, 1]),
      faulted: false,
      errorReported: false,
      runtime: {
        rack_web_set_param: () => paramWrites++,
        rack_web_process: () => {
          throw new Error("test trap");
        },
      },
    };

    processor.syncModuleParams(module);
    processor.syncModuleParams(module);
    assert.equal(paramWrites, 2);
    processor.setModuleParam(module, 0, 0.25);
    processor.syncModuleParams(module);
    assert.equal(paramWrites, 2);
    processor.setModuleParam(module, 0, 0.75);
    processor.syncModuleParams(module);
    assert.equal(paramWrites, 3);

    assert.equal(processor.runModuleBlock(module, 128), false);
    assert.equal(module.faulted, true);
    assert.equal(messages.length, 1);
    assert.equal(processor.runModuleBlock(module, 128), false);
    assert.equal(messages.length, 1);

    processor.ready = true;
    processor.processQuantum = () => {
      throw new Error("host failure");
    };
    const outputs = [[new Float32Array(128).fill(1), new Float32Array(128).fill(1)]];
    assert.equal(processor.process([], outputs), true);
    assert.equal(
      outputs[0][0].every((sample) => sample === 0),
      true,
    );
    assert.equal(
      outputs[0][1].every((sample) => sample === 0),
      true,
    );
    assert.equal(messages.length, 2);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(globalThis, key);
      else Reflect.set(globalThis, key, value);
    }
  }
});

test("Rack graph saves history only for outputs that close feedback cycles", async () => {
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
      port = { onmessage: null, postMessage: () => {} };
    } as unknown as new () => TestProcessor["port"];
    workletGlobal.registerProcessor = (_name, constructor) => {
      Processor = constructor;
    };
    workletGlobal.sampleRate = 48_000;
    await import(
      `${new URL("../public/audio/rack-graph-processor.js", import.meta.url).href}?feedback-cache`
    );

    assert.ok(Processor);
    const processor = new Processor();
    const memoryBuffer = {};
    const outputs = new Float32Array(4 * 128);
    outputs[128] = 4;
    outputs[129] = 5;
    const history = new Float32Array(outputs.length).fill(9);
    const source = {
      runtime: { memory: { buffer: memoryBuffer } },
      wasiHolder: { memoryGrew: false },
      memoryBuffer,
      outputCount: 2,
      maxChannels: 2,
      outputs,
      previous: history,
      feedbackOutputPorts: new Uint8Array([0, 1]),
      currentChannels: new Uint8Array([1, 1]),
      previousChannels: new Uint8Array(2),
    };
    processor.feedbackSources = [source];
    processor.saveFeedbackHistory(2);

    assert.deepEqual(Array.from(history.slice(0, 2)), [9, 9]);
    assert.deepEqual(Array.from(history.slice(128, 130)), [4, 5]);
    assert.deepEqual(Array.from(source.previousChannels), [0, 1]);
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

test("Rack graph reproduces Alikins hover inspection and CV parameter injection", async () => {
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
      port = { onmessage: null, postMessage: () => {} };
    } as unknown as new () => TestProcessor["port"];
    workletGlobal.registerProcessor = (_name, constructor) => {
      Processor = constructor;
    };
    workletGlobal.sampleRate = 48_000;
    await import(
      `${new URL("../public/audio/rack-graph-processor.js", import.meta.url).href}?alikins-hover`
    );
    assert.ok(Processor);
    const processor = new Processor();
    const target = {
      id: "target",
      params: [0.25],
      paramSpecs: [{ min: -1, max: 1, default: 0 }],
      dirtyParams: new Set<number>(),
      inputCount: 0,
      outputCount: 0,
      inputChannels: new Uint8Array(0),
      currentChannels: new Uint8Array(0),
      inputs: new Float32Array(0),
      outputs: new Float32Array(0),
    };
    const inspector = {
      id: "inspector",
      params: [0, 1, 2, 0],
      dirtyParams: new Set<number>(),
      hoverBridge: {
        mode: "inspect",
        enableParam: 1,
        rangeParam: 2,
        rawParam: 0,
        scaledParam: 3,
      },
      hoverVisual: [],
    };
    processor.modules.set("target", target as unknown as TestSource);
    processor.modules.set("inspector", inspector as unknown as TestSource);
    processor.port.onmessage?.({
      data: {
        type: "hover-control",
        moduleId: "target",
        controlType: "param",
        id: 0,
        modifiers: 1,
      },
    });
    processor.applyHoverBridge(inspector, 0);
    assert.equal(inspector.params[0], 0.25);
    assert.equal(inspector.params[3], 1.25);
    assert.deepEqual(inspector.hoverVisual, [0.25, -1, 1, 0, 1, 1.25, 1]);

    const injector = {
      id: "injector",
      params: [2, 2],
      dirtyParams: new Set<number>(),
      hoverBridge: { mode: "inject", enableParam: 0, rangeParam: 1, input: 0 },
      hoverVisual: [],
      hoverInputValue: 0,
      inputChannels: new Uint8Array([1]),
      inputs: new Float32Array(128),
    };
    injector.inputs[0] = 2.5;
    processor.modules.set("injector", injector as unknown as TestSource);
    processor.applyHoverBridge(injector, 0);
    assert.equal(target.params[0], 0.5);
    assert.deepEqual(injector.hoverVisual, [0.5, -1, 1, 0, 1, 0.25, 1]);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(globalThis, key);
      else Reflect.set(globalThis, key, value);
    }
  }
});
