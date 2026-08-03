import { useCallback, useEffect, useRef, useState } from "react";
import type { PatchDocument } from "../../lib/patch-types";
import type { RackAudioEngine, RackAudioStats } from "../../lib/rack-audio-engine";
import { syncRackAudioModules } from "../../lib/rack-audio-patch-sync";
import { rackAudioGraphNeedsRebuild } from "../../lib/rack-audio-runtime-state";
import type { PeachRegistryState } from "./use-peach-registry";
import {
  issue,
  message,
  type MessageDescriptorValue,
  type UserMessage,
} from "../i18n/user-message";

type AudioEngineRef = { current: RackAudioEngine | null };

type RackAudioRuntimeOptions = {
  audioRef: AudioEngineRef;
  patch: PatchDocument;
  structureKey: string;
  registryState: PeachRegistryState;
  createEngine: () => RackAudioEngine;
  configureEngine: (engine: RackAudioEngine) => void;
  isRebuildDeferred: () => boolean;
  onBusyChange: (busy: boolean) => void;
  onStatus: (message: UserMessage) => void;
};

function graphValues(stats: RackAudioStats): Readonly<Record<string, MessageDescriptorValue>> {
  return {
    modules: message("count.wasmModules", { count: stats.activeModules }),
    cables: message("count.cables", { count: stats.connectedCables }),
    midiInputs: stats.midiInputs,
    midiOutputs: stats.midiOutputs,
    feedbackEdges: message("count.feedbackEdges", { count: stats.feedbackEdges }),
    skippedModules: message("count.skippedModules", { count: stats.skippedModules }),
  };
}

async function stopAfterFailedTransition(engine: RackAudioEngine | null) {
  if (!engine) return;
  try {
    await engine.stop();
  } catch {
    // Startup errors are more useful than a secondary teardown failure.
  }
}

/**
 * Owns the browser-audio session lifecycle while leaving the engine reference
 * available to the studio's latency-sensitive parameter and state controls.
 */
export function useRackAudioRuntime({
  audioRef,
  patch,
  structureKey,
  registryState,
  createEngine,
  configureEngine,
  isRebuildDeferred,
  onBusyChange,
  onStatus,
}: RackAudioRuntimeOptions) {
  const [audioRunning, setAudioRunning] = useState(false);
  const [engineRevision, setEngineRevision] = useState(0);
  const latestPatchRef = useRef(patch);
  const latestStructureKeyRef = useRef(structureKey);
  const moduleSyncRef = useRef(new Map<string, { controls: string; data: string }>());
  const structureRef = useRef("");
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    latestPatchRef.current = patch;
    latestStructureKeyRef.current = structureKey;
  }, [patch, structureKey]);

  const isCurrentGeneration = useCallback(
    (generation: number) => mountedRef.current && generationRef.current === generation,
    [],
  );

  const startCurrentEngine = useCallback(
    async (generation: number) => {
      const patchSnapshot = latestPatchRef.current;
      const loadedStructureKey = latestStructureKeyRef.current;
      const engine = createEngine();
      try {
        const stats = await engine.start(patchSnapshot);
        if (!isCurrentGeneration(generation)) {
          await stopAfterFailedTransition(engine);
          return null;
        }
        audioRef.current = engine;
        configureEngine(engine);
        structureRef.current = loadedStructureKey;
        setEngineRevision((revision) => revision + 1);
        return { engine, stats };
      } catch (error) {
        if (audioRef.current === engine) audioRef.current = null;
        await stopAfterFailedTransition(engine);
        throw error;
      }
    },
    [audioRef, configureEngine, createEngine, isCurrentGeneration],
  );

  const toggleCapture = useCallback(
    async (moduleId: string, captureActive: boolean) => {
      if (captureActive) {
        audioRef.current?.setCaptureEnabled(moduleId, false);
        return;
      }

      const generation = ++generationRef.current;
      onBusyChange(true);
      try {
        let engine = audioRef.current;
        if (!engine) {
          const started = await startCurrentEngine(generation);
          if (!started) return;
          engine = started.engine;
          setAudioRunning(true);
          onStatus(message("status.audio.readyToRecord", graphValues(started.stats)));
        }
        if (!isCurrentGeneration(generation)) return;
        engine.setCaptureEnabled(moduleId, true);
      } catch (error) {
        if (!isCurrentGeneration(generation)) return;
        const failedEngine = audioRef.current;
        audioRef.current = null;
        await stopAfterFailedTransition(failedEngine);
        if (!isCurrentGeneration(generation)) return;
        setAudioRunning(false);
        onStatus(issue(error, "errors.recorderFailed"));
      } finally {
        if (isCurrentGeneration(generation)) onBusyChange(false);
      }
    },
    [audioRef, isCurrentGeneration, onBusyChange, onStatus, startCurrentEngine],
  );

  const toggleAudio = useCallback(async () => {
    if (registryState !== "ready") {
      onStatus(
        message(registryState === "error" ? "errors.registryUnavailable" : "status.registry.wait"),
      );
      return;
    }

    const generation = ++generationRef.current;
    onBusyChange(true);
    const previous = audioRef.current;
    if (previous) audioRef.current = null;
    try {
      if (previous) {
        await previous.stop();
        if (!isCurrentGeneration(generation)) return;
        setAudioRunning(false);
        onStatus(message("status.audio.stopped"));
        return;
      }

      const started = await startCurrentEngine(generation);
      if (!started) return;
      setAudioRunning(true);
      onStatus(message("status.audio.live", graphValues(started.stats)));
    } catch (error) {
      if (!isCurrentGeneration(generation)) return;
      const failedEngine = previous ?? audioRef.current;
      if (audioRef.current === failedEngine) audioRef.current = null;
      await stopAfterFailedTransition(failedEngine);
      if (!isCurrentGeneration(generation)) return;
      setAudioRunning(false);
      onStatus(issue(error, "errors.audioEngineFailed"));
    } finally {
      if (isCurrentGeneration(generation)) onBusyChange(false);
    }
  }, [audioRef, isCurrentGeneration, onBusyChange, onStatus, registryState, startCurrentEngine]);

  useEffect(() => {
    const engine = audioRef.current;
    if (!engine || !audioRunning) {
      moduleSyncRef.current.clear();
      return;
    }
    syncRackAudioModules(engine, patch.modules, moduleSyncRef.current);
  }, [audioRef, audioRunning, patch.modules]);

  useEffect(() => {
    const previous = audioRef.current;
    if (
      !rackAudioGraphNeedsRebuild({
        audioRunning,
        currentStructureKey: structureKey,
        enginePresent: Boolean(previous),
        loadedStructureKey: structureRef.current,
        rebuildDeferred: isRebuildDeferred(),
      }) ||
      !previous
    )
      return;

    const generation = ++generationRef.current;
    audioRef.current = null;
    onBusyChange(true);
    onStatus(message("status.audio.rebuilding"));

    void (async () => {
      try {
        await previous.stop();
        if (!isCurrentGeneration(generation)) return;
        const started = await startCurrentEngine(generation);
        if (!started) return;
        setAudioRunning(true);
        onStatus(message("status.audio.rebuilt", graphValues(started.stats)));
      } catch (error) {
        if (!isCurrentGeneration(generation)) return;
        const failedEngine = audioRef.current ?? previous;
        if (audioRef.current === failedEngine) audioRef.current = null;
        await stopAfterFailedTransition(failedEngine);
        if (!isCurrentGeneration(generation)) return;
        setAudioRunning(false);
        onStatus(issue(error, "errors.audioRebuildFailed"));
      } finally {
        if (isCurrentGeneration(generation)) onBusyChange(false);
      }
    })();
  }, [
    audioRef,
    audioRunning,
    engineRevision,
    isCurrentGeneration,
    isRebuildDeferred,
    onBusyChange,
    onStatus,
    startCurrentEngine,
    structureKey,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      const engine = audioRef.current;
      audioRef.current = null;
      void stopAfterFailedTransition(engine);
    };
  }, [audioRef]);

  return { audioRunning, toggleAudio, toggleCapture };
}
