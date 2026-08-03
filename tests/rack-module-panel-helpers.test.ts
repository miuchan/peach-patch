import assert from "node:assert/strict";
import test from "node:test";
import {
  audioBoundaryLightValues,
  rackKeyFromModuleEvent,
  rackMidiLogText,
  rackModifiersFromModuleEvent,
  strokeKeyLabel,
} from "../lib/rack-module-panel-data.ts";
import {
  audioFileFromUrl,
  boundedAudioResponse,
  firstPlaylistEntry,
  RemoteAudioError,
} from "../lib/rack-module-remote-audio.ts";

function keyboard(
  key: string,
  code = "",
  modifiers: Partial<Pick<KeyboardEvent, "shiftKey" | "ctrlKey" | "altKey" | "metaKey">> = {},
) {
  return {
    key,
    code,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...modifiers,
  };
}

test("module Stroke controls share Rack key codes and human-readable labels", () => {
  assert.equal(rackKeyFromModuleEvent(keyboard("a", "KeyA")), 65);
  assert.equal(rackKeyFromModuleEvent(keyboard("Shift", "ShiftLeft")), 340);
  assert.equal(rackKeyFromModuleEvent(keyboard("F25", "F25")), 314);
  assert.equal(
    rackModifiersFromModuleEvent(
      keyboard("a", "KeyA", {
        shiftKey: true,
        ctrlKey: true,
        altKey: true,
        metaKey: true,
      }),
    ),
    15,
  );
  assert.equal(strokeKeyLabel(-1, 0), "Map key");
  assert.equal(strokeKeyLabel(340, 0), "Left Shift");
  assert.equal(strokeKeyLabel(314, 10), "⌘Ctrl+F25");
});

test("Rack MIDI log text respects row lengths, bounds, and byte values", () => {
  assert.equal(rackMidiLogText([2, 3, 65, 66, 67, 0, 2, 68, 69, 0, 0], 2, 4), "ABC\nDE");
  assert.equal(rackMidiLogText([1, 2, 65, 300, 0], 1, 3), "Aÿ");
  assert.equal(rackMidiLogText(undefined, 4, 8), "");
});

test("audio boundary lights retain stereo meters and multichannel running state", () => {
  assert.deepEqual(
    audioBoundaryLightValues(2, 12, true, { 0: 10, 1: 1 }),
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1],
  );
  assert.deepEqual(audioBoundaryLightValues(8, 4, true, {}), [1, 0, 0, 0]);
  assert.deepEqual(audioBoundaryLightValues(16, 3, false, {}), [0, 0, 0]);
});

test("playlist parsing resolves PLS and M3U entries against their source URL", () => {
  assert.equal(
    firstPlaylistEntry("[playlist]\nFile1=../radio.mp3\n", "https://example.test/live/list.pls"),
    "https://example.test/radio.mp3",
  );
  assert.equal(
    firstPlaylistEntry("#EXTM3U\nstream.aac\n", "https://example.test/live/list.m3u"),
    "https://example.test/live/stream.aac",
  );
  assert.throws(
    () => firstPlaylistEntry("#EXTM3U\n# no entries", "https://example.test/list.m3u"),
    (error) => error instanceof RemoteAudioError && error.code === "empty-playlist",
  );
  assert.throws(
    () => firstPlaylistEntry("http://[invalid", "https://example.test/list.m3u"),
    (error) => error instanceof RemoteAudioError && error.code === "invalid-playlist-url",
  );
});

test("bounded audio reads reject HTTP errors and never exceed the byte cap", async () => {
  const bytes = await boundedAudioResponse(new Response(Uint8Array.from([1, 2, 3, 4])), 3, 1_000);
  assert.deepEqual([...bytes], [1, 2, 3]);
  await assert.rejects(
    boundedAudioResponse(new Response("no", { status: 503 })),
    (error) => error instanceof RemoteAudioError && error.code === "http" && error.status === 503,
  );
});

test("remote audio follows one playlist and returns a named bounded File", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.endsWith("station.m3u")) {
      const response = new Response("#EXTM3U\ntracks/live.mp3\n", {
        headers: { "content-type": "audio/x-mpegurl; charset=utf-8" },
      });
      Object.defineProperty(response, "url", { value: url });
      return response;
    }
    const response = new Response(Uint8Array.from([1, 2, 3]), {
      headers: { "content-type": "audio/mpeg" },
    });
    Object.defineProperty(response, "url", { value: url });
    return response;
  }) as typeof fetch;

  try {
    const file = await audioFileFromUrl("https://radio.example/station.m3u");
    assert.equal(file.name, "live.mp3");
    assert.equal(file.type, "audio/mpeg");
    assert.equal(file.size, 3);
    assert.deepEqual(requestedUrls, [
      "https://radio.example/station.m3u",
      "https://radio.example/tracks/live.mp3",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
