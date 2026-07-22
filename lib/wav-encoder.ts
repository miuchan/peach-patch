export function floatPcm16Part(samples: Float32Array) {
  const bytes = new ArrayBuffer(samples.length * 2),
    view = new DataView(bytes);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      index * 2,
      sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff),
      true,
    );
  }
  return bytes;
}

export function wavHeader(frames: number, channels: number, sampleRate: number) {
  channels = Math.max(1, Math.min(2, Math.trunc(channels)));
  sampleRate = Math.max(1, Math.trunc(sampleRate));
  frames = Math.max(0, Math.trunc(frames));
  const dataBytes = frames * channels * 2,
    bytes = new ArrayBuffer(44),
    view = new DataView(bytes),
    text = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index++)
        view.setUint8(offset + index, value.charCodeAt(index));
    };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  return bytes;
}

export function createWavBlob(
  parts: BlobPart[],
  frames: number,
  channels: number,
  sampleRate: number,
) {
  return new Blob([wavHeader(frames, channels, sampleRate), ...parts], {
    type: "audio/wav",
  });
}
