import { createWavBlob, floatPcm16Part } from "./wav-encoder.ts";
import type { RackAudioCaptureEvent } from "./rack-audio-worklet-events.ts";

export type RackAudioCapture = {
  parts: BlobPart[];
  frames: number;
  channels: number;
  sampleRate: number;
  format: "wav" | "midi";
};

export type RackAudioCaptureTransition =
  | { type: "started"; capture: RackAudioCapture }
  | { type: "updated"; capture: RackAudioCapture }
  | { type: "stopped"; capture?: RackAudioCapture };

function emptyCapture(
  event: Extract<RackAudioCaptureEvent, { type: "capture-start" | "capture-data" }>,
): RackAudioCapture {
  return {
    parts: [],
    frames: 0,
    channels: event.channels,
    sampleRate: event.sampleRate,
    format: event.format,
  };
}

function capturePart(format: RackAudioCapture["format"], samples: Float32Array): BlobPart {
  return format === "midi"
    ? Uint8Array.from(samples, (sample) => Math.max(0, Math.min(255, Math.round(sample))))
    : floatPcm16Part(samples);
}

function wavSamplesForChannels(
  samples: Float32Array,
  frames: number,
  sourceChannels: number,
  targetChannels: number,
): Float32Array {
  const source = samples.subarray(0, frames * sourceChannels);
  if (sourceChannels === targetChannels) return source;

  const converted = new Float32Array(frames * targetChannels);
  if (targetChannels === 1) {
    for (let frame = 0; frame < frames; frame += 1) {
      converted[frame] = (source[frame * 2] + source[frame * 2 + 1]) / 2;
    }
    return converted;
  }

  for (let frame = 0; frame < frames; frame += 1) {
    const sample = source[frame];
    converted[frame * 2] = sample;
    converted[frame * 2 + 1] = sample;
  }
  return converted;
}

/**
 * Applies one normalized worklet event to the engine's private capture accumulator.
 *
 * Audio chunks are intentionally appended in place. A recording can contain
 * thousands of worklet messages, so copying the full parts array for every
 * chunk would turn a linear stream into quadratic main-thread work.
 */
export function applyRackAudioCaptureEvent(
  current: RackAudioCapture | undefined,
  event: RackAudioCaptureEvent,
): RackAudioCaptureTransition {
  if (event.type === "capture-stop") return { type: "stopped", capture: current };
  if (event.type === "capture-start") {
    return { type: "started", capture: emptyCapture(event) };
  }
  const capture = current ?? emptyCapture(event);
  const frames = Math.min(event.frames, Math.floor(event.samples.length / event.channels));
  if (!frames) return { type: "updated", capture };
  const samples =
    capture.format === "midi"
      ? event.samples.subarray(0, frames * event.channels)
      : wavSamplesForChannels(event.samples, frames, event.channels, capture.channels);
  capture.parts.push(capturePart(capture.format, samples));
  capture.frames += frames;
  return {
    type: "updated",
    capture,
  };
}

export function createRackAudioCaptureBlob(capture: RackAudioCapture): Blob {
  return capture.format === "midi"
    ? new Blob(capture.parts, { type: "audio/midi" })
    : createWavBlob(capture.parts, capture.frames, capture.channels, capture.sampleRate);
}
