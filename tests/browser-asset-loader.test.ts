import assert from "node:assert/strict";
import test from "node:test";
import { loadBrowserAsset } from "../lib/browser-asset-loader.ts";

const binaryContract = (type: "binary" | "midi" | "script" | "text", maxSamples = 64) => ({
  type,
  maxSamples,
  maxSeconds: 0,
  channels: 1 as const,
});

test("browser binary assets validate their format and preserve every byte", async () => {
  const rom = new File(
    [Uint8Array.from([0x4e, 0x45, 0x53, 0x1a, ...Array.from({ length: 12 }, () => 0)])],
    "game.nes",
  );
  const loaded = await loadBrowserAsset(rom, binaryContract("binary"));
  assert.equal(loaded.ref.name, "game.nes");
  assert.equal(loaded.ref.frames, 16);
  assert.deepEqual(loaded.detail, { kind: "bytes", bytes: 16 });
  assert.deepEqual(Array.from(loaded.samples.slice(0, 4)), [0x4e, 0x45, 0x53, 0x1a]);

  await assert.rejects(
    loadBrowserAsset(new File([new Uint8Array(16)], "not-a-rom.nes"), binaryContract("binary")),
    /not an iNES/,
  );
  await assert.rejects(
    loadBrowserAsset(
      new File([Uint8Array.from([0x4d, 0x54, 0x68])], "short.mid"),
      binaryContract("midi"),
    ),
    /not a Standard MIDI File/,
  );
});

test("browser text assets reject empty, invalid UTF-8, and over-limit payloads", async () => {
  const script = await loadBrowserAsset(
    new File(["return 42"], "voice.lua"),
    binaryContract("script"),
  );
  assert.deepEqual(script.detail, { kind: "bytes", bytes: 9 });

  const sequence = await loadBrowserAsset(
    new File(["0,1,-2.5\n3,4"], "sequence.txt"),
    binaryContract("text"),
  );
  assert.deepEqual(sequence.detail, { kind: "bytes", bytes: 12 });
  assert.equal(new TextDecoder().decode(Uint8Array.from(sequence.samples)), "0,1,-2.5\n3,4");

  await assert.rejects(
    loadBrowserAsset(new File([], "empty.lua"), binaryContract("script")),
    /script is empty/,
  );
  await assert.rejects(
    loadBrowserAsset(new File([], "empty.txt"), binaryContract("text")),
    /text file is empty/,
  );
  await assert.rejects(
    loadBrowserAsset(new File([Uint8Array.from([0xff])], "invalid.lua"), binaryContract("script")),
    /not valid UTF-8/,
  );
  await assert.rejects(
    loadBrowserAsset(new File(["12345"], "large.lua"), binaryContract("script", 4)),
    /larger than the 4 byte module limit/,
  );
  await assert.rejects(
    loadBrowserAsset({ size: 100 * 1024 * 1024 + 1 } as File, binaryContract("script")),
    /100 MB browser decode limit/,
  );
});

test("browser image assets are scaled and normalized into RGBA samples", async () => {
  const previousBitmap = globalThis.createImageBitmap;
  const previousDocument = globalThis.document;
  let closed = false;
  globalThis.createImageBitmap = (async () => ({
    width: 4,
    height: 2,
    close: () => {
      closed = true;
    },
  })) as typeof createImageBitmap;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({ data: Uint8ClampedArray.from([255, 128, 0, 64, 0, 64, 128, 255]) }),
      }),
    }),
  } as unknown as Document;

  try {
    const loaded = await loadBrowserAsset(new File(["image"], "panel.png"), {
      type: "image",
      maxSamples: 8,
      maxSeconds: 0,
      channels: 4,
    });
    assert.deepEqual(loaded.detail, { kind: "image", width: 2, height: 1 });
    assert.equal(loaded.ref.sampleRate, 2);
    assert.equal(loaded.ref.channels, 4);
    assert.deepEqual(
      Array.from(loaded.samples, (value) => Math.round(value * 255)),
      [255, 128, 0, 64, 0, 64, 128, 255],
    );
    assert.equal(closed, true);
  } finally {
    globalThis.createImageBitmap = previousBitmap;
    globalThis.document = previousDocument;
  }
});

test("browser image decoding closes the bitmap when canvas setup fails", async () => {
  const previousBitmap = globalThis.createImageBitmap;
  const previousDocument = globalThis.document;
  let closed = false;
  globalThis.createImageBitmap = (async () => ({
    width: 1,
    height: 1,
    close: () => {
      closed = true;
    },
  })) as typeof createImageBitmap;
  globalThis.document = {
    createElement: () => ({ getContext: () => null }),
  } as unknown as Document;
  try {
    await assert.rejects(
      loadBrowserAsset(new File(["image"], "panel.png"), {
        type: "image",
        maxSamples: 4,
        maxSeconds: 0,
        channels: 4,
      }),
      /could not create an image decoder/,
    );
    assert.equal(closed, true);
  } finally {
    globalThis.createImageBitmap = previousBitmap;
    globalThis.document = previousDocument;
  }
});

test("browser audio assets honor channel, duration, and sample limits", async () => {
  const PreviousAudioContext = globalThis.AudioContext;
  let closed = false;
  globalThis.AudioContext = class {
    async decodeAudioData() {
      return {
        numberOfChannels: 2,
        length: 8,
        sampleRate: 4,
        getChannelData: (channel: number) =>
          channel === 0
            ? Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7])
            : Float32Array.from([10, 11, 12, 13, 14, 15, 16, 17]),
      };
    }
    async close() {
      closed = true;
    }
  } as unknown as typeof AudioContext;

  try {
    const loaded = await loadBrowserAsset(new File(["audio"], "tone.wav"), {
      type: "audio",
      maxSamples: 6,
      maxSeconds: 1,
      channels: 2,
    });
    assert.deepEqual(loaded.detail, { kind: "audio", seconds: 0.75, channels: 2 });
    assert.equal(loaded.ref.frames, 3);
    assert.deepEqual(Array.from(loaded.samples), [0, 10, 1, 11, 2, 12]);
    assert.equal(closed, true);
  } finally {
    globalThis.AudioContext = PreviousAudioContext;
  }
});
