const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_MILLISECONDS = 12_000;

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
  milliseconds: number,
) {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => {
        timer = globalThis.setTimeout(() => resolve(null), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

export async function boundedAudioResponse(
  response: Response,
  maxBytes = DEFAULT_MAX_BYTES,
  maxMilliseconds = DEFAULT_MAX_MILLISECONDS,
) {
  if (!response.ok) throw new Error(`Audio URL returned HTTP ${response.status}`);
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const deadline = Date.now() + maxMilliseconds;
  let length = 0;
  while (length < maxBytes && Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const result = await readWithTimeout(reader, remaining);
    if (!result || result.done) break;

    const room = maxBytes - length;
    const chunk = result.value.byteLength > room ? result.value.slice(0, room) : result.value;
    chunks.push(chunk as Uint8Array<ArrayBuffer>);
    length += chunk.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  if (!length) throw new Error("The audio URL returned no decodable data");

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function firstPlaylistEntry(text: string, baseUrl: string) {
  const plsEntries = [...text.matchAll(/^File\d+\s*=\s*(.+)$/gim)].map((match) => match[1].trim());
  const m3uEntries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const entry = plsEntries[0] ?? m3uEntries[0];
  if (!entry) throw new Error("The playlist contains no audio URL");
  return new URL(entry, baseUrl).href;
}

export async function audioFileFromUrl(value: string) {
  let url = new URL(value).href;
  for (let pass = 0; pass < 2; pass += 1) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { Range: "bytes=0-16777215" },
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
    const pathname = new URL(response.url || url).pathname;
    const isPlaylist =
      /\.(?:m3u8?|pls)$/i.test(pathname) ||
      contentType.includes("mpegurl") ||
      contentType.includes("scpls");
    const bytes = await boundedAudioResponse(
      response,
      isPlaylist ? 512 * 1024 : DEFAULT_MAX_BYTES,
      isPlaylist ? 4_000 : DEFAULT_MAX_MILLISECONDS,
    );
    if (isPlaylist) {
      url = firstPlaylistEntry(new TextDecoder().decode(bytes), response.url || url);
      continue;
    }

    const name = decodeURIComponent(
      pathname.split("/").filter(Boolean).at(-1) ?? "internet-radio.mp3",
    );
    return new File([bytes], name, {
      type: contentType.startsWith("audio/") ? contentType : "audio/mpeg",
    });
  }
  throw new Error("Nested playlists are not supported");
}
