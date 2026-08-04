import { readFile } from "node:fs/promises";
import vm from "node:vm";

const MODULES = 80;
const CABLES = 142;
const FEEDBACK_EDGES = 15;
const FRAMES = 128;
const SAMPLE_RATE = 48_000;

type Calls = { params: number; inputState: number; process: number };
type BenchmarkModule = {
  id: string;
  inputCount: number;
  outputCount: number;
  inputCables: BenchmarkEdge[][];
  outputConnections: boolean[];
  feedbackOutputPorts: Uint8Array;
  [key: string]: unknown;
};
type BenchmarkEdge = {
  fromModule: string;
  fromPort: number;
  toModule: string;
  toPort: number;
  source: BenchmarkModule;
  target: BenchmarkModule;
  feedback: boolean;
};
type BenchmarkProcessor = {
  modules: Map<string, BenchmarkModule>;
  order: string[];
  execution: BenchmarkModule[];
  incoming: Map<string, BenchmarkEdge[]>;
  cables: BenchmarkEdge[];
  deviceCables: Array<Record<string, unknown>>;
  audioBoundaries: Map<string, unknown>;
  expanderChains: Map<string, unknown>;
  messageGroups: Map<string, unknown>;
  messageLinks: unknown[];
  captureModules: BenchmarkModule[];
  midiOutputModules: BenchmarkModule[];
  feedbackSources: BenchmarkModule[];
  midiAutomations: Map<string, unknown>;
  automationActive: boolean;
  visualUpdatesEnabled: boolean;
  ready: boolean;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
};
type BenchmarkProcessorConstructor = new () => BenchmarkProcessor;

async function processorSource(path: string) {
  if (path !== "-") return readFile(path, "utf8");
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function loadProcessor(source: string) {
  let Processor: BenchmarkProcessorConstructor | undefined;
  class AudioWorkletProcessor {
    port = { onmessage: null, postMessage() {} };
  }
  const context = vm.createContext({
    AudioWorkletProcessor,
    DataView,
    Error,
    Float32Array,
    Float64Array,
    Int8Array,
    Map,
    Math,
    Number,
    Object,
    Set,
    Uint8Array,
    Uint32Array,
    WebAssembly,
    sampleRate: SAMPLE_RATE,
    registerProcessor(_name: string, constructor: BenchmarkProcessorConstructor) {
      Processor = constructor;
    },
  });
  vm.runInContext(source, context, { filename: "rack-graph-processor.js" });
  return Processor;
}

function fakeModule(id: number, calls: Calls): BenchmarkModule {
  const inputCount = 4,
    outputCount = 4,
    maxChannels = 16,
    inputFloats = inputCount * maxChannels * FRAMES,
    outputFloats = outputCount * maxChannels * FRAMES,
    memory = new WebAssembly.Memory({ initial: 1 }),
    inputs = new Float32Array(memory.buffer, 0, inputFloats),
    outputs = new Float32Array(memory.buffer, inputFloats * 4, outputFloats),
    params = Array.from({ length: 12 }, (_, index) => index / 12),
    connectedInputChannels = new Int8Array(inputCount),
    inputCables: BenchmarkEdge[][] = Array.from({ length: inputCount }, () => []);
  connectedInputChannels.fill(-1);
  const runtime = {
    memory,
    rack_web_input_buffer: () => 0,
    rack_web_output_buffer: () => inputFloats * 4,
    rack_web_set_param() {
      calls.params++;
    },
    rack_web_set_input_connected() {
      calls.inputState++;
    },
    rack_web_set_input_channels() {
      calls.inputState++;
    },
    rack_web_process() {
      calls.process++;
    },
    rack_web_get_output_channels: () => 1,
  };
  return {
    id: `module-${id}`,
    key: `Benchmark/Module${id % 12}`,
    runtime,
    wasiHolder: { runtime, memoryGrew: false },
    memoryBuffer: memory.buffer,
    params,
    paramCache: Float64Array.from(params),
    dirtyParams: new Set(),
    momentaryReleases: new Set(),
    bypassed: false,
    faulted: false,
    bypassRoutes: [],
    visuals: [],
    outputConnections: new Array(outputCount).fill(false),
    expanderCapacity: 0,
    captureCapacity: 0,
    inputCount,
    outputCount,
    lightCount: 0,
    lights: null,
    maxChannels,
    inputs,
    outputs,
    previous: new Float32Array(outputFloats),
    feedbackOutputPorts: new Uint8Array(outputCount),
    previousChannels: new Uint8Array(outputCount),
    currentChannels: new Uint8Array(outputCount),
    inputChannels: new Uint8Array(inputCount),
    connectedInputChannels,
    inputCables,
    expanderInputs: null,
    expanderOutputs: null,
    messageGroup: null,
  };
}

function benchmarkProcessor(Processor: BenchmarkProcessorConstructor) {
  const calls = { params: 0, inputState: 0, process: 0 },
    processor = new Processor(),
    modules = Array.from({ length: MODULES }, (_, id) => fakeModule(id, calls));
  processor.modules = new Map(modules.map((module) => [module.id, module]));
  processor.order = modules.map((module) => module.id);
  processor.execution = modules;
  processor.incoming = new Map();
  processor.cables = [];
  processor.deviceCables = [];
  processor.audioBoundaries = new Map();
  processor.expanderChains = new Map();
  processor.messageGroups = new Map();
  processor.messageLinks = [];
  processor.captureModules = [];
  processor.midiOutputModules = [];
  processor.feedbackSources = [];
  processor.midiAutomations = new Map();
  processor.automationActive = false;
  processor.visualUpdatesEnabled = false;
  processor.ready = true;

  const edges = [];
  for (let index = 0; index < CABLES; index++) {
    const targetIndex = index < MODULES - 1 ? index + 1 : 1 + ((index * 17) % (MODULES - 1)),
      sourceIndex = index < MODULES - 1 ? index : (index * 11) % targetIndex,
      source = modules[sourceIndex],
      target = modules[targetIndex],
      feedback = index >= CABLES - FEEDBACK_EDGES;
    if (!source || !target) throw new Error("Benchmark topology contains an invalid module");
    const edge = {
      fromModule: source.id,
      fromPort: index % source.outputCount,
      toModule: target.id,
      toPort: index % target.inputCount,
      source,
      target,
      feedback,
    };
    edges.push(edge);
    source.outputConnections[edge.fromPort] = true;
    const incoming = processor.incoming.get(target.id) || [];
    incoming.push(edge);
    processor.incoming.set(target.id, incoming);
    target.inputCables[edge.toPort].push(edge);
    if (feedback) {
      source.feedbackOutputPorts[edge.fromPort] = 1;
      if (!processor.feedbackSources.includes(source)) processor.feedbackSources.push(source);
    }
  }
  processor.cables = edges;

  const boundary = { key: "Core/AudioInterface2", params: [1] },
    outputModule = modules.at(-1);
  if (!outputModule) throw new Error("Benchmark topology has no audio source");
  outputModule.outputConnections[0] = true;
  processor.deviceCables.push({
    fromModule: outputModule.id,
    fromPort: 0,
    toPort: 0,
    source: outputModule,
    boundary,
  });
  const output = [[new Float32Array(FRAMES), new Float32Array(FRAMES)]];
  for (let index = 0; index < 100; index++) processor.process([], output);
  calls.params = 0;
  calls.inputState = 0;
  calls.process = 0;

  const samples: number[] = [];
  for (let sample = 0; sample < 7; sample++) {
    const start = performance.now();
    for (let index = 0; index < 250; index++) processor.process([], output);
    samples.push((performance.now() - start) / 250);
  }
  samples.sort((left, right) => left - right);
  const millisecondsPerQuantum = samples[Math.floor(samples.length / 2)] ?? 0,
    deadlineMilliseconds = (FRAMES / SAMPLE_RATE) * 1000,
    measuredQuanta = samples.length * 250;
  return {
    topology: { modules: MODULES, cables: CABLES, feedbackEdges: FEEDBACK_EDGES },
    millisecondsPerQuantum: Number(millisecondsPerQuantum.toFixed(4)),
    deadlineMilliseconds: Number(deadlineMilliseconds.toFixed(4)),
    hostHeadroom: Number((deadlineMilliseconds / millisecondsPerQuantum).toFixed(2)),
    wasmCallsPerQuantum: {
      process: Number((calls.process / measuredQuanta).toFixed(2)),
      parameterWrites: Number((calls.params / measuredQuanta).toFixed(2)),
      inputStateWrites: Number((calls.inputState / measuredQuanta).toFixed(2)),
    },
  };
}

const source = await processorSource(process.argv[2] || "public/audio/rack-graph-processor.js"),
  Processor = loadProcessor(source);
if (!Processor) throw new Error("Rack graph AudioWorklet did not register its processor");
console.log(JSON.stringify(benchmarkProcessor(Processor), null, 2));
