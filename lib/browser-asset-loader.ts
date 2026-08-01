import type { SampleAssetRef } from "./patch-types.ts";

export type BrowserAssetContract = {
  type: "audio" | "image" | "binary" | "midi" | "script";
  maxSamples: number;
  maxSeconds: number;
  channels: 1 | 2 | 4;
  slots?: number;
};

export type LoadedBrowserAsset = {
  ref: SampleAssetRef;
  samples: Float32Array;
  detail: string;
};

const MAX_FILE_BYTES = 100 * 1024 * 1024;

function assetRef(file: File, sampleRate: number, channels: number, frames: number): SampleAssetRef {
  return {
    storageKey: `sample-${crypto.randomUUID()}`,
    name: file.name,
    sampleRate,
    channels,
    frames,
  };
}

async function loadImage(file: File, contract: BrowserAssetContract): Promise<LoadedBrowserAsset> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxPixels = Math.max(1, Math.floor(contract.maxSamples / 4));
    const scale = Math.min(1, Math.sqrt(maxPixels / (bitmap.width * bitmap.height)));
    const width = Math.max(1, Math.floor(bitmap.width * scale));
    const height = Math.max(1, Math.floor(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Browser could not create an image decoder");
    context.drawImage(bitmap, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    const samples = new Float32Array(width * height * 4);
    for (let index = 0; index < rgba.length; index++) samples[index] = rgba[index] / 255;
    return {
      ref: assetRef(file, width, 4, width * height),
      samples,
      detail: `${width}×${height} RGBA`,
    };
  } finally {
    bitmap.close();
  }
}

function validateBinary(file: File, bytes: Uint8Array, contract: BrowserAssetContract) {
  if (contract.type === "binary" && (bytes.length < 16 || bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a))
    throw new Error("The selected file is not an iNES .nes ROM");
  if (contract.type === "midi" && (bytes.length < 14 || bytes[0] !== 0x4d || bytes[1] !== 0x54 || bytes[2] !== 0x68 || bytes[3] !== 0x64))
    throw new Error("The selected file is not a Standard MIDI File");
  if (contract.type === "script") {
    if (!bytes.length) throw new Error("The selected Lua script is empty");
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new Error("The selected Lua script is not valid UTF-8 text"); }
  }
  if (bytes.length > contract.maxSamples)
    throw new Error(`${contract.type === "midi" ? "MIDI file" : contract.type === "script" ? "Lua script" : "ROM"} is larger than the ${contract.maxSamples.toLocaleString()} byte module limit`);
}

async function loadBinary(file: File, contract: BrowserAssetContract): Promise<LoadedBrowserAsset> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateBinary(file, bytes, contract);
  const samples = new Float32Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) samples[index] = bytes[index];
  return { ref: assetRef(file, 1, 1, bytes.length), samples, detail: `${bytes.length.toLocaleString()} bytes` };
}

async function loadAudio(file: File, contract: BrowserAssetContract): Promise<LoadedBrowserAsset> {
  const decoder = new AudioContext();
  try {
    const buffer = await decoder.decodeAudioData(await file.arrayBuffer());
    const channels = Math.min(contract.channels, buffer.numberOfChannels);
    const frames = Math.min(
      buffer.length,
      contract.maxSeconds > 0 ? Math.floor(buffer.sampleRate * contract.maxSeconds) : buffer.length,
      Math.floor(contract.maxSamples / channels),
    );
    const samples = new Float32Array(frames * channels);
    for (let frame = 0; frame < frames; frame++)
      for (let channel = 0; channel < channels; channel++)
        samples[frame * channels + channel] = buffer.getChannelData(channel)[frame];
    return {
      ref: assetRef(file, buffer.sampleRate, channels, frames),
      samples,
      detail: `${(frames / buffer.sampleRate).toFixed(1)}s · ${channels === 2 ? "stereo" : "mono"}`,
    };
  } finally {
    await decoder.close();
  }
}

export async function loadBrowserAsset(file: File, contract: BrowserAssetContract): Promise<LoadedBrowserAsset> {
  if (file.size > MAX_FILE_BYTES) throw new Error("Sample is larger than the 100 MB browser decode limit");
  if (contract.type === "image") return loadImage(file, contract);
  if (contract.type === "binary" || contract.type === "midi" || contract.type === "script") return loadBinary(file, contract);
  return loadAudio(file, contract);
}
