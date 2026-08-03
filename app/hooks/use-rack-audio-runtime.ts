import { useCallback, useEffect, useRef, useState } from "react";
import type { PatchDocument } from "../../lib/patch-types";
import type { RackAudioEngine, RackAudioStats } from "../../lib/rack-audio-engine";
import { syncRackAudioModules } from "../../lib/rack-audio-patch-sync";
import { rackAudioGraphNeedsRebuild } from "../../lib/rack-audio-runtime-state";
import type { PeachRegistryState } from "./use-peach-registry";

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
  onStatus: (message: string) => void;
};

function graphSummary(stats: RackAudioStats) {
  return `${stats.activeModules} WASM modules · one graph worklet · ${stats.connectedCables} cables · MIDI ${stats.midiInputs} in/${stats.midiOutputs} out · ${stats.feedbackEdges} feedback edges · ${stats.skippedModules} modules skipped`;
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
          onStatus(
            `Audio live · ${started.stats.activeModules} WASM modules · ${started.stats.connectedCables} cables · MIDI ${started.stats.midiInputs} in/${started.stats.midiOutputs} out · ready to record`,
          );
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
        onStatus(error instanceof Error ? error.message : "Recorder failed");
      } finally {
        if (isCurrentGeneration(generation)) onBusyChange(false);
      }
    },
    [audioRef, isCurrentGeneration, onBusyChange, onStatus, startCurrentEngine],
  );

  const toggleAudio = useCallback(async () => {
    if (registryState !== "ready") {
      onStatus(
        registryState === "error"
          ? "GitHub registry is unavailable"
          : "Wait for the GitHub registry to finish loading",
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
        onStatus("Browser audio stopped");
        return;
      }

      const started = await startCurrentEngine(generation);
      if (!started) return;
      setAudioRunning(true);
      onStatus(`Audio live · ${graphSummary(started.stats)}`);
    } catch (error) {
      if (!isCurrentGeneration(generation)) return;
      const failedEngine = previous ?? audioRef.current;
      if (audioRef.current === failedEngine) audioRef.current = null;
      await stopAfterFailedTransition(failedEngine);
      if (!isCurrentGeneration(generation)) return;
      setAudioRunning(false);
      onStatus(error instanceof Error ? error.message : "Audio engine failed");
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
    onStatus("Patch structure changed · rebuilding browser audio graph…");

    void (async () => {
      try {
        await previous.stop();
        if (!isCurrentGeneration(generation)) return;
        const started = await startCurrentEngine(generation);
        if (!started) return;
        setAudioRunning(true);
        onStatus(`Audio rebuilt · ${graphSummary(started.stats)}`);
      } catch (error) {
        if (!isCurrentGeneration(generation)) return;
        const failedEngine = audioRef.current ?? previous;
        if (audioRef.current === failedEngine) audioRef.current = null;
        await stopAfterFailedTransition(failedEngine);
        if (!isCurrentGeneration(generation)) return;
        setAudioRunning(false);
        onStatus(error instanceof Error ? error.message : "Audio graph rebuild failed");
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
