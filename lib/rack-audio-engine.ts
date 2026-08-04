import type { PatchDocument } from "./patch-types";
import { getSample } from "./sample-store";
import { getWebPlugin } from "./runtime-plugin-registry";
import { dataFromState } from "./patch-state";
import { fetchVerifiedWasm } from "./peach-registry-client";
import type { WebPluginModule } from "./web-plugin-registry";
import {
  applyRackAudioCaptureEvent,
  createRackAudioCaptureBlob,
  type RackAudioCapture,
} from "./rack-audio-capture.ts";
import { decodeRackAudioMidiOutput } from "./rack-audio-midi.ts";
import {
  parseRackAudioWorkletEvent,
  type RackAudioCaptureEvent,
  type RackAudioHostControl,
  type RackAudioPlugSignal,
} from "./rack-audio-worklet-events.ts";

export type RackAudioStats = {
  activeModules: number;
  connectedCables: number;
  feedbackEdges: number;
  skippedModules: number;
  midiInputs: number;
  midiOutputs: number;
};

export type RackPlugSignal = RackAudioPlugSignal;
export type RackHostControl = RackAudioHostControl;

export type RackRecording = {
  moduleId: string;
  blob: Blob;
  format: "wav" | "midi";
  frames: number;
  channels: number;
  sampleRate: number;
};

export type RackAudioCallbacks = {
  onCaptureState?: (moduleId: string, active: boolean) => void;
  onRecordingComplete?: (recording: RackRecording) => void;
  onStateSnapshot?: (moduleId: string, data: Record<string, unknown>) => void;
  onMidiParam?: (moduleId: string, id: number, value: number) => void;
  onMidiDevices?: (inputs: string[], outputs: string[]) => void;
  onMidiMessage?: (inputName: string, bytes: number[]) => void;
  onAutomationComplete?: () => void;
  onHostControl?: (control: RackHostControl) => void;
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

export class RackAudioEngine {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private readonly recordings = new Map<string, RackAudioCapture>();
  private stopRequest = 0;
  private stopResolvers = new Map<number, () => void>();
  private midiAccess: MIDIAccess | null = null;
  private midiInputRoutes = new Map<string, string[]>();
  private midiOutputRoutes = new Map<string, string>();
  private visualUpdatesEnabled = true;

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
        [...access.outputs.values()].map((output) => output.name || "Unnamed output"),
      );
    };
    bindInputs();
    access.onstatechange = bindInputs;
  }

  private handleCaptureEvent(event: RackAudioCaptureEvent) {
    const transition = applyRackAudioCaptureEvent(this.recordings.get(event.moduleId), event);
    if (transition.type === "started") {
      this.recordings.set(event.moduleId, transition.capture);
      this.callbacks.onCaptureState?.(event.moduleId, true);
      return;
    }
    if (transition.type === "updated") {
      this.recordings.set(event.moduleId, transition.capture);
      return;
    }
    this.recordings.delete(event.moduleId);
    this.callbacks.onCaptureState?.(event.moduleId, false);
    if (!transition.capture) return;
    this.callbacks.onRecordingComplete?.({
      moduleId: event.moduleId,
      format: transition.capture.format,
      frames: transition.capture.frames,
      channels: transition.capture.channels,
      sampleRate: transition.capture.sampleRate,
      blob: createRackAudioCaptureBlob(transition.capture),
    });
  }

  async start(patch: PatchDocument): Promise<RackAudioStats> {
    // Web MIDI permission must be requested while the Audio button's user
    // activation is still live, before the first await below.
    const midiAccessPromise: Promise<MIDIAccess | null> =
      typeof navigator.requestMIDIAccess === "function"
        ? navigator.requestMIDIAccess().catch(() => null)
        : Promise.resolve(null);
    await this.stop();
    const outgoing = new Set(patch.cables.map((cable) => `${cable.fromModule}:${cable.fromPort}`));
    const readyModules = patch.modules.filter((module) => getWebPlugin(module.key));
    const activeInstances = readyModules.filter((instance) => {
      const definition = getWebPlugin(instance.key)!;
      return (
        !definition.runtime?.audio &&
        (definition.outputs.length > 0 ||
          Boolean(definition.runtime?.expander) ||
          Boolean(definition.runtime?.capture) ||
          Boolean(definition.runtime?.midi?.input) ||
          Boolean(definition.runtime?.midi?.output) ||
          Boolean(definition.runtime?.hostControl) ||
          Boolean(definition.runtime?.visuals?.length))
      );
    });
    const context = new AudioContext({
      latencyHint: activeInstances.length >= 48 ? "balanced" : "interactive",
    });
    this.context = context;
    await context.audioWorklet.addModule("/audio/rack-graph-processor.js?abi=0.7");

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
        await artifact(definition);
        const stored = instance.asset
          ? await getSample(instance.asset.storageKey).catch(() => undefined)
          : undefined;
        const storedAssets = instance.assets
          ? await Promise.all(
              Array.from({ length: instance.assets.length }, async (_, slot) => {
                const ref = instance.assets?.[slot];
                return ref ? await getSample(ref.storageKey).catch(() => undefined) : undefined;
              }),
            )
          : undefined;
        return {
          id: instance.id,
          key: instance.key,
          wasmId: definition.wasmUrl,
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
          hostControl: definition.runtime?.hostControl,
          visuals: definition.runtime?.visuals ?? [],
          capture: definition.runtime?.capture,
          midiOutput: Boolean(definition.runtime?.midi?.output),
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
    const wasmArtifacts = await Promise.all(
      [...artifactPromises].map(async ([id, promise]) => ({ id, wasm: await promise })),
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
      if (definition?.runtime?.midi?.output) this.midiOutputRoutes.set(instance.id, deviceName);
    }
    const cables = patch.cables.flatMap((cable) => {
      if (!activeIds.has(cable.fromModule)) return [];
      const target = moduleById.get(cable.toModule);
      const targetDefinition = target ? getWebPlugin(target.key) : undefined;
      if (targetDefinition?.runtime?.audio) {
        return cable.toPort < 2 ? [{ ...cable, toAudio: true, audioModuleId: target!.id }] : [];
      }
      return activeIds.has(cable.toModule) ? [{ ...cable, toAudio: false }] : [];
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
        const message = parseRackAudioWorkletEvent(event.data);
        if (!message) return;
        if (
          !this.visualUpdatesEnabled &&
          (message.type === "port-peaks" || message.type === "visual-signals")
        )
          return;
        switch (message.type) {
          case "ready":
            window.clearTimeout(timer);
            resolve({ feedbackEdges: message.feedbackEdges });
            break;
          case "error":
            window.clearTimeout(timer);
            reject(new Error(message.message));
            break;
          case "state-json":
            this.callbacks.onStateSnapshot?.(message.moduleId, message.state);
            break;
          case "midi-output": {
            const requestedName = this.midiOutputRoutes.get(message.moduleId) || "";
            const outputs = this.midiAccess ? [...this.midiAccess.outputs.values()] : [];
            const destination =
              outputs.find((output) => output.name === requestedName) ?? outputs[0];
            if (destination) {
              for (const bytes of decodeRackAudioMidiOutput(message.records, message.packets)) {
                destination.send(bytes);
              }
            }
            break;
          }
          case "midi-param":
          case "automation-param":
            this.callbacks.onMidiParam?.(message.moduleId, message.id, message.value);
            break;
          case "automation-complete":
            this.callbacks.onAutomationComplete?.();
            break;
          case "port-peaks":
            this.callbacks.onPortPeaks?.(
              message.moduleId,
              message.inputs,
              message.outputs,
              message.inputScopes,
              message.outputScopes,
            );
            break;
          case "visual-signals":
            this.callbacks.onVisualSignals?.(
              message.cables,
              message.scopes,
              message.plugs,
              message.lights,
            );
            if (message.hostControl) this.callbacks.onHostControl?.(message.hostControl);
            break;
          case "capture-start":
          case "capture-data":
          case "capture-stop":
            this.handleCaptureEvent(message);
            break;
          case "captures-stopped":
            this.stopResolvers.get(message.requestId)?.();
            this.stopResolvers.delete(message.requestId);
            break;
        }
      };
    });
    const transfer: Transferable[] = wasmArtifacts.map(({ wasm }) => wasm);
    for (const rackModule of modules) {
      if (rackModule.asset) transfer.push(rackModule.asset.samples.buffer as ArrayBuffer);
      for (const asset of rackModule.assets ?? [])
        if (asset) transfer.push(asset.samples.buffer as ArrayBuffer);
    }
    node.port.postMessage(
      { type: "load-graph", modules, wasmArtifacts, cables, audioBoundaries },
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

  resetParam(moduleId: string, id: number, value: number) {
    this.node?.port.postMessage({
      type: "reset-param",
      moduleId,
      id,
      value,
    });
  }

  setMomentaryParam(moduleId: string, id: number, active: boolean) {
    this.node?.port.postMessage({
      type: "momentary-param",
      moduleId,
      id,
      active,
    });
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

  setMidiDevice(moduleId: string, deviceName: string, input: boolean, output: boolean) {
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

  setVisualUpdatesEnabled(enabled: boolean) {
    if (this.visualUpdatesEnabled === enabled) return;
    this.visualUpdatesEnabled = enabled;
    this.node?.port.postMessage({ type: "visual-updates", enabled });
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
    this.visualUpdatesEnabled = true;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") await context.close();
  }
}
