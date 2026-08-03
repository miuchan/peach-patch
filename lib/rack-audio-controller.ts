import type { PatchDocument } from "./patch-types";
import {
  RackAudioEngine,
  type RackAudioCallbacks,
  type RackHostControl,
  type RackRecording,
} from "./rack-audio-engine.ts";
import { applyAudioParam, applyAudioStateSnapshot } from "./rack-audio-patch-sync.ts";
import { getWebPlugin } from "./runtime-plugin-registry.ts";

type PatchUpdater = (updater: (patch: PatchDocument) => PatchDocument) => void;
type PatchCommitter = (updater: (patch: PatchDocument) => PatchDocument) => void;

export type RackAudioControllerContext = {
  applyRackHostControl: (control: RackHostControl) => void;
  recordAutomationValue: (moduleId: string, paramId: number, value: number) => void;
  mutateHistory: PatchUpdater;
  commitHistory: PatchCommitter;
  checkpointHistory: (patch: PatchDocument) => void;
  setMidiDevices: (devices: { inputs: string[]; outputs: string[] }) => void;
  setMidiLearnArmed: (armed: boolean) => void;
  midiLearnTargetRef: { current: { moduleId: string; paramId: number } | null };
  audioPatchRef: { current: PatchDocument };
  audioRef: { current: RackAudioEngine | null };
  setStatus: (status: string) => void;
  setAutomationPlaying: (playing: boolean) => void;
  automationBeforeRef: { current: PatchDocument | null };
  automationStructureRef: { current: string };
  automationPlaybackCountRef: { current: number };
  setPortPeaks: (peaks: {
    moduleId: string;
    inputs: number[];
    outputs: number[];
    inputScopes: number[][];
    outputScopes: number[][];
  }) => void;
  setVisualSignals: (
    updater: (previous: {
      cables: Record<string, number>;
      scopes: Record<string, number[][]>;
      plugs: Record<
        string,
        { voltage: number; rms: number; channels: number; rgb: [number, number, number] }
      >;
      lights: Record<string, number[]>;
    }) => {
      cables: Record<string, number>;
      scopes: Record<string, number[][]>;
      plugs: Record<
        string,
        { voltage: number; rms: number; channels: number; rgb: [number, number, number] }
      >;
      lights: Record<string, number[]>;
    },
  ) => void;
  setRecordingIds: (updater: (current: Set<string>) => Set<string>) => void;
};

function handleRecordingComplete(recording: RackRecording, context: RackAudioControllerContext) {
  const rackModule = context.audioPatchRef.current.modules.find(
      (module) => module.id === recording.moduleId,
    ),
    stamp = new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replace(/\.\d{3}Z$/, "Z"),
    extension = recording.format === "midi" ? "mid" : "wav",
    name = `${rackModule?.model || "Recorder"}-${stamp}.${extension}`,
    url = URL.createObjectURL(recording.blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  context.setStatus(
    recording.format === "midi"
      ? `${name} captured · ${recording.frames} bytes`
      : `${name} captured · ${(recording.frames / recording.sampleRate).toFixed(1)}s · ${recording.channels === 2 ? "stereo" : "mono"}`,
  );
}

function handleMidiLearn(inputName: string, bytes: number[], context: RackAudioControllerContext) {
  const targetRef = context.midiLearnTargetRef.current;
  if (!targetRef || bytes.length < 3 || (bytes[0] & 0xf0) !== 0xb0) return;
  const current = context.audioPatchRef.current,
    target = current.modules.find((module) => module.id === targetRef.moduleId),
    midiMap = current.modules.find((module) => module.key === "Core/MIDI-Map");
  context.midiLearnTargetRef.current = null;
  context.setMidiLearnArmed(false);
  if (!target || !midiMap) {
    context.setStatus("MIDI learn target or Core MIDI-Map is no longer available");
    return;
  }
  const data =
      midiMap.rack?.data && typeof midiMap.rack.data === "object"
        ? (midiMap.rack.data as Record<string, unknown>)
        : {},
    existingMaps = Array.isArray(data.maps) ? data.maps : [],
    targetRackId = Number(target.rack?.id),
    map = {
      cc: bytes[1] & 0x7f,
      moduleId: Number.isInteger(targetRackId) ? targetRackId : -1,
      patchworkModuleId: target.id,
      paramId: targetRef.paramId,
    },
    maps = [
      ...existingMaps.filter((entry) => {
        if (!entry || typeof entry !== "object") return true;
        const value = entry as Record<string, unknown>;
        return !(
          value.patchworkModuleId === target.id && Number(value.paramId) === targetRef.paramId
        );
      }),
      map,
    ],
    nextData = { ...data, maps };
  context.audioRef.current?.setStateJson(midiMap.id, nextData);
  context.commitHistory((patch) => ({
    ...patch,
    modules: patch.modules.map((module) =>
      module.id === midiMap.id
        ? { ...module, rack: { ...(module.rack ?? {}), data: nextData } }
        : module,
    ),
  }));
  const definition = getWebPlugin(target.key),
    paramName =
      definition?.params.find((param) => param.id === targetRef.paramId)?.name ??
      `parameter ${targetRef.paramId + 1}`;
  context.setStatus(
    `MIDI learn · ${inputName || "default input"} CC ${map.cc} → ${target.plugin}/${target.model} ${paramName}`,
  );
}

export function createRackAudioEngine(context: RackAudioControllerContext) {
  const callbacks: RackAudioCallbacks = {
    onHostControl: context.applyRackHostControl,
    onMidiParam: (moduleId, id, value) => {
      context.recordAutomationValue(moduleId, id, value);
      context.mutateHistory((patch) => applyAudioParam(patch, moduleId, id, value));
    },
    onMidiDevices: (inputs, outputs) => context.setMidiDevices({ inputs, outputs }),
    onMidiMessage: (inputName, bytes) => handleMidiLearn(inputName, bytes, context),
    onAutomationComplete: () => {
      const before = context.automationBeforeRef.current;
      context.automationBeforeRef.current = null;
      context.automationStructureRef.current = "";
      if (before) context.checkpointHistory(before);
      context.setAutomationPlaying(false);
      context.setStatus(
        `AudioWorklet automation complete · ${context.automationPlaybackCountRef.current} events · undo is available`,
      );
    },
    onPortPeaks: (moduleId, inputs, outputs, inputScopes, outputScopes) =>
      context.setPortPeaks({ moduleId, inputs, outputs, inputScopes, outputScopes }),
    onVisualSignals: (cables, scopes, plugs, lights) =>
      context.setVisualSignals((previous) => ({
        cables,
        scopes: { ...previous.scopes, ...scopes },
        plugs,
        lights,
      })),
    onStateSnapshot: (moduleId, data) =>
      context.commitHistory((patch) => {
        const module = patch.modules.find((candidate) => candidate.id === moduleId);
        return applyAudioStateSnapshot(
          patch,
          moduleId,
          data,
          getWebPlugin(module?.key ?? "")?.stateKeys,
        );
      }),
    onCaptureState: (moduleId, active) =>
      context.setRecordingIds((current) => {
        const next = new Set(current);
        if (active) next.add(moduleId);
        else next.delete(moduleId);
        return next;
      }),
    onRecordingComplete: (recording) => handleRecordingComplete(recording, context),
  };
  return new RackAudioEngine(callbacks);
}
