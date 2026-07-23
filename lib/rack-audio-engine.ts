import type { PatchDocument } from "./patch-types";
import { getSample } from "./sample-store";
import { getWebPlugin } from "./runtime-plugin-registry";
import { dataFromState } from "./patch-state";
import { createWavBlob, floatPcm16Part } from "./wav-encoder";
import { fetchVerifiedWasm } from "./peach-registry-client";
import type { WebPluginModule } from "./web-plugin-registry";

export type RackAudioStats = {
  activeModules: number;
  connectedCables: number;
  feedbackEdges: number;
  skippedModules: number;
  midiInputs: number;
  midiOutputs: number;
};

export type RackPlugSignal = { voltage:number; rms:number; channels:number; rgb:[number,number,number] };

export type RackRecording = {
  moduleId: string;
  blob: Blob;
  frames: number;
  channels: number;
  sampleRate: number;
};

type RackAudioCallbacks = {
  onCaptureState?: (moduleId: string, active: boolean) => void;
  onRecordingComplete?: (recording: RackRecording) => void;
  onStateSnapshot?: (moduleId: string, data: Record<string, unknown>) => void;
  onMidiParam?: (moduleId: string, id: number, value: number) => void;
  onMidiDevices?: (inputs: string[], outputs: string[]) => void;
  onMidiMessage?: (inputName: string, bytes: number[]) => void;
  onAutomationComplete?: () => void;
  onPortPeaks?: (
    moduleId: string,
    inputs: number[],
    outputs: number[],
    inputScopes: number[][],
    outputScopes: number[][],
  ) => void;
  onVisualSignals?: (
    cables: Record<string, number>,
    scopes: Record<string, number[][]>,
    plugs: Record<string, RackPlugSignal>,
    lights: Record<string, number[]>,
  ) => void;
};

type RecordingParts = {
  parts: BlobPart[];
  frames: number;
  channels: number;
  sampleRate: number;
};

export class RackAudioEngine {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private readonly recordings = new Map<string, RecordingParts>();
  private stopRequest = 0;
  private stopResolvers = new Map<number, () => void>();
  private midiAccess: MIDIAccess | null = null;
  private midiInputRoutes = new Map<string, string[]>();
  private midiOutputRoutes = new Map<string, string>();

  constructor(private readonly callbacks: RackAudioCallbacks = {}) {}

  private bindMidiAccess(access: MIDIAccess, node: AudioWorkletNode) {
    if (this.node !== node) return;
    if (this.midiAccess && this.midiAccess !== access) {
      for (const input of this.midiAccess.inputs.values()) input.onmidimessage = null;
      this.midiAccess.onstatechange = null;
    }
    this.midiAccess = access;
    const bindInputs = () => {
      for (const input of access.inputs.values())
        input.onmidimessage = (event) => {
          const bytes = [...(event.data ?? [])].slice(0, 3),
            exact = this.midiInputRoutes.get(input.name || "") ?? [],
            fallback = this.midiInputRoutes.get("") ?? [],
            moduleIds = [...new Set([...exact, ...fallback])];
          this.callbacks.onMidiMessage?.(input.name || "", bytes);
          if (this.node !== node) return;
          node.port.postMessage({ type: "midi-input", moduleIds, bytes });
        };
      this.callbacks.onMidiDevices?.(
        [...access.inputs.values()].map((input) => input.name || "Unnamed input"),
        [...access.outputs.values()].map(
          (output) => output.name || "Unnamed output",
        ),
      );
    };
    bindInputs();
    access.onstatechange = bindInputs;
  }

  private handleCaptureMessage(data: Record<string, unknown>) {
    const moduleId = String(data.moduleId || "");
    if (!moduleId) return;
    if (data.type === "capture-start") {
      this.recordings.set(moduleId, {
        parts: [],
        frames: 0,
        channels: Math.max(1, Math.min(2, Number(data.channels) || 1)),
        sampleRate: Math.max(1, Number(data.sampleRate) || 48000),
      });
      this.callbacks.onCaptureState?.(moduleId, true);
      return;
    }
    if (data.type === "capture-data") {
      const samples =
          data.samples instanceof Float32Array
            ? data.samples
            : new Float32Array(data.samples as ArrayBuffer),
        channels = Math.max(1, Math.min(2, Number(data.channels) || 1)),
        recording = this.recordings.get(moduleId) ?? {
          parts: [],
          frames: 0,
          channels,
          sampleRate: Math.max(1, Number(data.sampleRate) || 48000),
        };
      recording.parts.push(floatPcm16Part(samples));
      recording.frames += Math.min(
        Number(data.frames) || 0,
        Math.floor(samples.length / channels),
      );
      recording.channels = channels;
      this.recordings.set(moduleId, recording);
      return;
    }
    if (data.type === "capture-stop") {
      const recording = this.recordings.get(moduleId);
      this.recordings.delete(moduleId);
      this.callbacks.onCaptureState?.(moduleId, false);
      if (recording)
        this.callbacks.onRecordingComplete?.({
          moduleId,
          frames: recording.frames,
          channels: recording.channels,
          sampleRate: recording.sampleRate,
          blob: createWavBlob(
            recording.parts,
            recording.frames,
            recording.channels,
            recording.sampleRate,
          ),
        });
    }
  }

  async start(patch: PatchDocument): Promise<RackAudioStats> {
    // Web MIDI permission must be requested while the Audio button's user
    // activation is still live, before the first await below.
    const midiAccessPromise: Promise<MIDIAccess | null> =
      typeof navigator.requestMIDIAccess === "function"
        ? navigator.requestMIDIAccess().catch(() => null)
        : Promise.resolve(null);
    await this.stop();
    const context = new AudioContext({ latencyHint: "interactive" });
    this.context = context;
    await context.audioWorklet.addModule("/audio/rack-graph-processor.js");

    const outgoing = new Set(
      patch.cables.map((cable) => `${cable.fromModule}:${cable.fromPort}`),
    );
    const readyModules = patch.modules.filter(
      (module) => getWebPlugin(module.key),
    );
    const activeInstances = readyModules.filter((instance) => {
      const definition = getWebPlugin(instance.key)!;
      return (
        !definition.runtime?.audio &&
        (definition.outputs.length > 0 ||
          Boolean(definition.runtime?.expander) ||
          Boolean(definition.runtime?.capture) ||
          Boolean(definition.runtime?.midi?.input) ||
          Boolean(definition.runtime?.midi?.output) ||
          Boolean(definition.runtime?.visuals?.length))
      );
    });
    const activeIds = new Set(activeInstances.map((instance) => instance.id));
    const moduleById = new Map(patch.modules.map((module) => [module.id, module]));
    const artifactPromises = new Map<string, Promise<ArrayBuffer>>();
    const artifact = (definition: WebPluginModule) => {
      const url = definition.wasmUrl;
      let promise = artifactPromises.get(url);
      if (!promise) {
        promise = fetchVerifiedWasm(definition);
        artifactPromises.set(url, promise);
      }
      return promise;
    };

    const modules = await Promise.all(
      activeInstances.map(async (instance) => {
        const definition = getWebPlugin(instance.key)!;
        const stored = instance.asset
          ? await getSample(instance.asset.storageKey).catch(() => undefined)
          : undefined;
        const storedAssets = instance.assets
          ? await Promise.all(
              Array.from({ length: instance.assets.length }, async (_, slot) => {
                const ref = instance.assets?.[slot];
                return ref
                  ? await getSample(ref.storageKey).catch(() => undefined)
                  : undefined;
              }),
            )
          : undefined;
        return {
          id: instance.id,
          key: instance.key,
          wasm: (await artifact(definition)).slice(0),
          params: instance.params,
          state: instance.state ?? [],
          stateJson: JSON.stringify(
            dataFromState(
              instance.key,
              instance.rack?.data && typeof instance.rack.data === "object"
                ? (instance.rack.data as Record<string, unknown>)
                : undefined,
              instance.state,
              instance.stateKeys,
            ) ?? {},
          ),
          seed: (Number(instance.id.replace(/\D/g, "")) || 1) >>> 0,
          polyphony: instance.polyphony ?? 1,
          bypassed: instance.bypassed ?? false,
          bypassRoutes: definition.bypassRoutes ?? [],
          x: instance.x,
          y: instance.y,
          width: instance.width,
          rackId: Number(instance.rack?.id ?? -1),
          snapParams: definition.params.map((param) => Boolean(param.snap)),
          expander: definition.runtime?.expander,
          visuals: definition.runtime?.visuals ?? [],
          outputConnections: definition.outputs.map((port) =>
            outgoing.has(`${instance.id}:${port.id}`),
          ),
          asset: stored ? { ...stored.ref, samples: stored.samples } : undefined,
          assets: storedAssets?.map((sample) =>
            sample ? { ...sample.ref, samples: sample.samples } : undefined,
          ),
        };
      }),
    );
    const audioBoundaries = readyModules.flatMap((instance) => {
      const definition = getWebPlugin(instance.key)!;
      return definition.runtime?.audio
        ? [{ id: instance.id, key: instance.key, params: instance.params }]
        : [];
    });
    this.midiInputRoutes.clear();
    this.midiOutputRoutes.clear();
    for (const instance of activeInstances) {
      const definition = getWebPlugin(instance.key),
        midi =
          instance.rack?.data && typeof instance.rack.data === "object"
            ? (instance.rack.data as Record<string, unknown>).midi
            : undefined,
        deviceName =
          midi && typeof midi === "object" && !Array.isArray(midi)
            ? String((midi as Record<string, unknown>).deviceName || "")
            : "";
      if (definition?.runtime?.midi?.input) {
        const ids = this.midiInputRoutes.get(deviceName) ?? [];
        ids.push(instance.id);
        this.midiInputRoutes.set(deviceName, ids);
      }
      if (definition?.runtime?.midi?.output)
        this.midiOutputRoutes.set(instance.id, deviceName);
    }
    const cables = patch.cables.flatMap((cable) => {
      if (!activeIds.has(cable.fromModule)) return [];
      const target = moduleById.get(cable.toModule);
      const targetDefinition = target ? getWebPlugin(target.key) : undefined;
      if (targetDefinition?.runtime?.audio) {
        return cable.toPort < 2
          ? [{ ...cable, toAudio: true, audioModuleId: target!.id }]
          : [];
      }
      return activeIds.has(cable.toModule)
        ? [{ ...cable, toAudio: false }]
        : [];
    });

    const node = new AudioWorkletNode(context, "rack-graph-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
    });
    this.node = node;
    const loaded = new Promise<{ feedbackEdges: number }>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("Rack graph AudioWorklet timed out")),
        12_000,
      );
      node.port.onmessage = (event) => {
        const data = event.data as Record<string, unknown> | undefined;
        if (data?.type === "ready") {
          window.clearTimeout(timer);
          resolve({ feedbackEdges: Number(data.feedbackEdges) || 0 });
        } else if (data?.type === "error") {
          window.clearTimeout(timer);
          reject(
            new Error(
              typeof data.message === "string"
                ? data.message
                : "Rack graph AudioWorklet failed to load",
            ),
          );
        } else if (data?.type === "state-json") {
          try {
            const source =
                data.bytes instanceof Uint8Array
                  ? data.bytes
                  : new Uint8Array(data.bytes as ArrayBuffer),
              state = JSON.parse(new TextDecoder().decode(source)) as unknown;
            if (state && typeof state === "object" && !Array.isArray(state))
              this.callbacks.onStateSnapshot?.(
                String(data.moduleId || ""),
                state as Record<string, unknown>,
              );
          } catch {
            // A malformed plugin snapshot must not stop the audio graph.
          }
        } else if (data?.type === "midi-output") {
          const records =
              data.records instanceof Uint8Array
                ? data.records
                : new Uint8Array(data.records as ArrayBuffer),
            packets = data.packets
              ? data.packets instanceof Uint8Array
                ? data.packets
                : new Uint8Array(data.packets as ArrayBuffer)
              : new Uint8Array(),
            requestedName = this.midiOutputRoutes.get(String(data.moduleId || "")) || "",
            outputs = this.midiAccess ? [...this.midiAccess.outputs.values()] : [],
            destination =
              outputs.find((output) => output.name === requestedName) ?? outputs[0];
          if (destination) {
            for (let offset = 0; offset + 3 < records.length; offset += 4) {
              const size = Math.max(1, Math.min(3, records[offset] || 1));
              destination.send([...records.slice(offset + 1, offset + 1 + size)]);
            }
            for (let offset = 0; offset + 1 < packets.length; ) {
              const size = packets[offset] | (packets[offset + 1] << 8),
                end = offset + 2 + size;
              if (size < 1 || end > packets.length) break;
              destination.send([...packets.slice(offset + 2, end)]);
              offset = end;
            }
          }
        } else if (data?.type === "midi-param") {
          this.callbacks.onMidiParam?.(
            String(data.moduleId || ""),
            Number(data.id) || 0,
            Number(data.value) || 0,
          );
        } else if (data?.type === "automation-param") {
          this.callbacks.onMidiParam?.(
            String(data.moduleId || ""),
            Number(data.id) || 0,
            Number(data.value) || 0,
          );
        } else if (data?.type === "automation-complete") {
          this.callbacks.onAutomationComplete?.();
        } else if (data?.type === "port-peaks") {
          this.callbacks.onPortPeaks?.(
            String(data.moduleId || ""),
            Array.from(
              (data.inputs as ArrayLike<number> | undefined) ?? [],
              Number,
            ),
            Array.from(
              (data.outputs as ArrayLike<number> | undefined) ?? [],
              Number,
            ),
            Array.isArray(data.inputScopes)
              ? data.inputScopes.map((scope) =>
                  Array.from(
                    (scope as ArrayLike<number> | undefined) ?? [],
                    Number,
                  ),
                )
              : [],
            Array.isArray(data.outputScopes)
              ? data.outputScopes.map((scope) =>
                  Array.from(
                    (scope as ArrayLike<number> | undefined) ?? [],
                    Number,
                  ),
                )
              : [],
          );
        } else if (data?.type === "visual-signals") {
          const cables =
              data.cables && typeof data.cables === "object"
                ? Object.fromEntries(
                    Object.entries(data.cables as Record<string, unknown>).map(
                      ([id, value]) => [id, Number(value) || 0],
                    ),
                  )
                : {},
            plugs =
              data.plugs && typeof data.plugs === "object"
                ? Object.fromEntries(
                    Object.entries(data.plugs as Record<string, unknown>).map(([id,value])=>{
                      const signal=value&&typeof value==="object"?value as Record<string,unknown>:{};
                      const rgb=Array.from((signal.rgb as ArrayLike<number>|undefined)??[],value=>Math.max(0,Math.min(1,Number(value)||0)));
                      return [id,{voltage:Number(signal.voltage)||0,rms:Number(signal.rms)||0,channels:Math.max(0,Number(signal.channels)||0),rgb:[rgb[0]??0,rgb[1]??0,rgb[2]??0] as [number,number,number]}];
                    }),
                  )
                : {},
            scopes =
              data.scopes && typeof data.scopes === "object"
                ? Object.fromEntries(
                    Object.entries(data.scopes as Record<string, unknown>).map(
                      ([id, value]) => [
                        id,
                        Array.isArray(value)
                          ? value.map((samples) =>
                              Array.from(
                                (samples as ArrayLike<number> | undefined) ?? [],
                                Number,
                              ),
                            )
                          : [],
                      ],
                    ),
                  )
                : {},
            lights =
              data.lights && typeof data.lights === "object"
                ? Object.fromEntries(
                    Object.entries(data.lights as Record<string, unknown>).map(
                      ([id, value]) => [
                        id,
                        Array.from(
                          (value as ArrayLike<number> | undefined) ?? [],
                          (brightness) =>
                            Math.max(0, Number(brightness) || 0),
                        ),
                      ],
                    ),
                  )
                : {};
          this.callbacks.onVisualSignals?.(cables, scopes, plugs, lights);
        } else if (
          data?.type === "capture-start" ||
          data?.type === "capture-data" ||
          data?.type === "capture-stop"
        ) {
          this.handleCaptureMessage(data);
        } else if (data?.type === "captures-stopped") {
          const requestId = Number(data.requestId);
          this.stopResolvers.get(requestId)?.();
          this.stopResolvers.delete(requestId);
        }
      };
    });
    const transfer: Transferable[] = [];
    for (const rackModule of modules) {
      transfer.push(rackModule.wasm);
      if (rackModule.asset)
        transfer.push(rackModule.asset.samples.buffer as ArrayBuffer);
      for (const asset of rackModule.assets ?? [])
        if (asset) transfer.push(asset.samples.buffer as ArrayBuffer);
    }
    node.port.postMessage(
      { type: "load-graph", modules, cables, audioBoundaries },
      transfer,
    );
    const level = context.createGain();
    level.gain.value = 0.5;
    node.connect(level).connect(context.destination);
    const result = await loaded;
    const immediateMidiAccess = await Promise.race([
      midiAccessPromise,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 250)),
    ]);
    if (immediateMidiAccess) this.bindMidiAccess(immediateMidiAccess, node);
    void midiAccessPromise.then((access) => {
      if (access && access !== this.midiAccess) this.bindMidiAccess(access, node);
    });
    await context.resume();
    return {
      activeModules: activeInstances.length,
      connectedCables: cables.length,
      feedbackEdges: result.feedbackEdges,
      skippedModules: patch.modules.length - readyModules.length,
      midiInputs: this.midiAccess?.inputs.size ?? 0,
      midiOutputs: this.midiAccess?.outputs.size ?? 0,
    };
  }

  setParam(moduleId: string, id: number, value: number) {
    this.node?.port.postMessage({ type: "param", moduleId, id, value });
  }

  setState(moduleId: string, id: number, value: number) {
    this.node?.port.postMessage({ type: "state", moduleId, id, value });
  }

  snapshotState(moduleId: string) {
    this.node?.port.postMessage({ type: "snapshot-state", moduleId });
  }

  setStateJson(moduleId: string, data: Record<string, unknown> | undefined) {
    this.node?.port.postMessage({
      type: "load-state-json",
      moduleId,
      stateJson: JSON.stringify(data ?? {}),
    });
  }

  setBypassed(moduleId: string, bypassed: boolean) {
    this.node?.port.postMessage({ type: "bypass", moduleId, bypassed });
  }

  setMidiDevice(
    moduleId: string,
    deviceName: string,
    input: boolean,
    output: boolean,
  ) {
    if (input) {
      for (const [name, ids] of this.midiInputRoutes) {
        const next = ids.filter((id) => id !== moduleId);
        if (next.length) this.midiInputRoutes.set(name, next);
        else this.midiInputRoutes.delete(name);
      }
      const ids = this.midiInputRoutes.get(deviceName) ?? [];
      ids.push(moduleId);
      this.midiInputRoutes.set(deviceName, ids);
    }
    if (output) this.midiOutputRoutes.set(moduleId, deviceName);
  }

  playAutomation(
    events: Array<{
      timeMs: number;
      moduleId: string;
      paramId: number;
      value: number;
    }>,
    durationMs: number,
  ) {
    this.node?.port.postMessage({
      type: "automation-start",
      events,
      durationMs,
    });
  }

  stopAutomation() {
    this.node?.port.postMessage({ type: "automation-stop" });
  }

  setMonitoredModule(moduleId: string | null) {
    this.node?.port.postMessage({
      type: "monitor-module",
      moduleId: moduleId ?? "",
    });
  }

  setCaptureEnabled(moduleId: string, enabled: boolean) {
    this.node?.port.postMessage({
      type: "capture-enable",
      moduleId,
      enabled,
    });
  }

  triggerAction(moduleId: string, id: number, active: boolean) {
    this.node?.port.postMessage({
      type: "trigger-action",
      moduleId,
      id,
      active,
    });
  }

  async stop() {
    if (this.midiAccess) {
      for (const input of this.midiAccess.inputs.values()) input.onmidimessage = null;
      this.midiAccess.onstatechange = null;
    }
    this.midiAccess = null;
    this.callbacks.onMidiDevices?.([], []);
    this.midiInputRoutes.clear();
    this.midiOutputRoutes.clear();
    const node = this.node;
    if (node) {
      const requestId = ++this.stopRequest;
      await Promise.race([
        new Promise<void>((resolve) => {
          this.stopResolvers.set(requestId, resolve);
          node.port.postMessage({ type: "stop-captures", requestId });
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 250)),
      ]);
      this.stopResolvers.delete(requestId);
      node.disconnect();
      node.port.close();
    }
    this.node = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") await context.close();
  }
}
