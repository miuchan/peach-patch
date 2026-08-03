import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendAutomationEvent,
  automationClipFromPatch,
  patchWithAutomationClip,
  type PatchAutomationEvent,
} from "../../lib/patch-automation";
import type { PatchDocument } from "../../lib/patch-types";
import type { RackAudioEngine } from "../../lib/rack-audio-engine";

type PatchCommitter = (update: PatchDocument | ((patch: PatchDocument) => PatchDocument)) => void;
type PatchMutator = (update: (patch: PatchDocument) => PatchDocument) => void;

type RackAutomationOptions = {
  patch: PatchDocument;
  structureKey: string;
  audioRef: { current: RackAudioEngine | null };
  commitPatch: PatchCommitter;
  mutatePatch: PatchMutator;
  checkpointPatch: (patch: PatchDocument) => void;
  onStatus: (message: string) => void;
};

function applyAutomationEvent(patch: PatchDocument, event: PatchAutomationEvent): PatchDocument {
  return {
    ...patch,
    modules: patch.modules.map((module) => {
      if (module.id !== event.moduleId) return module;
      const params = [...module.params];
      params[event.paramId] = event.value;
      return { ...module, params };
    }),
  };
}

export function useRackAutomation({
  patch,
  structureKey,
  audioRef,
  commitPatch,
  mutatePatch,
  checkpointPatch,
  onStatus,
}: RackAutomationOptions) {
  const [playing, setPlaying] = useState(false);
  const recordingRef = useRef(false);
  const recordingStartRef = useRef(0);
  const recordedEventsRef = useRef<PatchAutomationEvent[]>([]);
  const playbackTimersRef = useRef<number[]>([]);
  const beforePlaybackRef = useRef<PatchDocument | null>(null);
  const playbackEventCountRef = useRef(0);
  const playbackStructureRef = useRef("");

  const clearPlaybackTimers = useCallback(() => {
    for (const timer of playbackTimersRef.current) window.clearTimeout(timer);
    playbackTimersRef.current = [];
  }, []);

  const finishPlayback = useCallback(
    (message: string) => {
      clearPlaybackTimers();
      audioRef.current?.stopAutomation();
      const beforePlayback = beforePlaybackRef.current;
      beforePlaybackRef.current = null;
      playbackStructureRef.current = "";
      if (beforePlayback) checkpointPatch(beforePlayback);
      setPlaying(false);
      onStatus(message);
    },
    [audioRef, checkpointPatch, clearPlaybackTimers, onStatus],
  );

  const recordValue = useCallback((moduleId: string, paramId: number, value: number) => {
    if (!recordingRef.current) return;
    appendAutomationEvent(recordedEventsRef.current, {
      timeMs: Math.max(0, performance.now() - recordingStartRef.current),
      moduleId,
      paramId,
      value,
    });
  }, []);

  const toggleRecording = useCallback(() => {
    if (recordingRef.current) {
      recordingRef.current = false;
      const events = [...recordedEventsRef.current];
      const durationMs = Math.max(
        1,
        performance.now() - recordingStartRef.current,
        events.at(-1)?.timeMs ?? 0,
      );
      if (!events.length) {
        onStatus("Automation recording stopped · no parameter changes captured");
        return;
      }
      commitPatch((current) => patchWithAutomationClip(current, { durationMs, events }));
      onStatus(
        `Automation captured · ${events.length} events · ${(durationMs / 1000).toFixed(1)}s · saved in patch`,
      );
      return;
    }

    if (playing) finishPlayback("Automation playback stopped for recording");
    recordedEventsRef.current = [];
    recordingStartRef.current = performance.now();
    recordingRef.current = true;
    onStatus("Automation recording · move module controls or mapped MIDI CCs");
  }, [commitPatch, finishPlayback, onStatus, playing]);

  const togglePlayback = useCallback(() => {
    if (playing) {
      finishPlayback("Automation playback stopped · undo is available");
      return;
    }

    const clip = automationClipFromPatch(patch);
    if (!clip?.events.length) {
      onStatus("Record parameter automation before playing it");
      return;
    }
    if (recordingRef.current) toggleRecording();

    const validEvents = clip.events.filter((event) => {
      const targetModule = patch.modules.find((module) => module.id === event.moduleId);
      return targetModule && event.paramId >= 0 && event.paramId < targetModule.params.length;
    });
    if (!validEvents.length) {
      onStatus("Automation targets are not present in this patch");
      return;
    }

    beforePlaybackRef.current = patch;
    playbackEventCountRef.current = validEvents.length;
    playbackStructureRef.current = structureKey;
    setPlaying(true);

    if (audioRef.current) {
      audioRef.current.playAutomation(validEvents, clip.durationMs);
      onStatus(
        `AudioWorklet automation playing · ${validEvents.length} events · sample-accurate audio clock`,
      );
      return;
    }

    for (const event of validEvents) {
      playbackTimersRef.current.push(
        window.setTimeout(() => {
          audioRef.current?.setParam(event.moduleId, event.paramId, event.value);
          mutatePatch((current) => applyAutomationEvent(current, event));
        }, event.timeMs),
      );
    }
    playbackTimersRef.current.push(
      window.setTimeout(
        () =>
          finishPlayback(`Automation played · ${validEvents.length} events · undo is available`),
        Math.max(clip.durationMs, validEvents.at(-1)?.timeMs ?? 0) + 10,
      ),
    );
    onStatus(
      `Automation playing · ${validEvents.length} events · ${(clip.durationMs / 1000).toFixed(1)}s`,
    );
  }, [
    audioRef,
    finishPlayback,
    mutatePatch,
    onStatus,
    patch,
    playing,
    structureKey,
    toggleRecording,
  ]);

  const reset = useCallback(() => {
    clearPlaybackTimers();
    audioRef.current?.stopAutomation();
    beforePlaybackRef.current = null;
    playbackStructureRef.current = "";
    playbackEventCountRef.current = 0;
    recordingRef.current = false;
    recordingStartRef.current = 0;
    recordedEventsRef.current = [];
    setPlaying(false);
  }, [audioRef, clearPlaybackTimers]);

  useEffect(() => {
    if (playing && playbackStructureRef.current && playbackStructureRef.current !== structureKey) {
      finishPlayback("Automation stopped because the patch structure changed · undo is available");
    }
  }, [finishPlayback, playing, structureKey]);

  useEffect(
    () => () => {
      clearPlaybackTimers();
    },
    [clearPlaybackTimers],
  );

  return {
    beforePlaybackRef,
    playbackEventCountRef,
    playbackStructureRef,
    playing,
    recordValue,
    reset,
    setPlaying,
    togglePlayback,
    toggleRecording,
  };
}
