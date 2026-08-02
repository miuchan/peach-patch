// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePatchStorageDownloadHtml,
  parsePatchStoragePageUrl,
  patchStorageFilename,
} from "../lib/patchstorage.ts";
import { GET } from "../server/api/patchstorage.ts";

test("PatchStorage page links are normalized without carrying tracking data", () => {
  assert.equal(
    parsePatchStoragePageUrl("https://www.patchstorage.com/meditation-patch/?utm_source=test#download").href,
    "https://patchstorage.com/meditation-patch/",
  );
  assert.throws(
    () => parsePatchStoragePageUrl("https://patchstorage.com.evil.example/meditation-patch/"),
    /Expected a PatchStorage patch link/,
  );
  assert.throws(
    () => parsePatchStoragePageUrl("https://patchstorage.com/platform/vcv-rack/"),
    /Expected a PatchStorage patch link/,
  );
});

test("PatchStorage download markup resolves only hosted .vcv uploads", () => {
  const page = new URL("https://patchstorage.com/meditation-patch/");
  const download = parsePatchStorageDownloadHtml(
    `<a href="https://patchstorage.com/wp-content/uploads/2017/09/Meditation-patch.vcv?source=page&amp;download=1" class="btn ps-patch-download">Download</a>`,
    page,
  );
  assert.equal(
    download.href,
    "https://patchstorage.com/wp-content/uploads/2017/09/Meditation-patch.vcv?source=page&download=1",
  );
  assert.equal(patchStorageFilename(download), "Meditation-patch.vcv");
  assert.throws(
    () => parsePatchStorageDownloadHtml(
      `<a class="ps-patch-download" href="https://files.example/patch.vcv">Download</a>`,
      page,
    ),
    /does not provide a direct .vcv download/,
  );
});

test("PatchStorage API proxies the resolved patch with a safe filename", async () => {
  const originalFetch = globalThis.fetch;
  const patchBytes = new TextEncoder().encode('{"modules":[],"cables":[]}');
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url === "https://patchstorage.com/meditation-patch/") {
      return new Response(
        `<a class="ps-patch-download btn" href="https://patchstorage.com/wp-content/uploads/2017/09/Meditation-patch.vcv">Download</a>`,
        { headers: { "content-type": "text/html" } },
      );
    }
    return new Response(patchBytes, {
      headers: { "content-length": String(patchBytes.byteLength) },
    });
  };
  try {
    const response = await GET(new Request(
      "https://peach.test/api/patchstorage?url=https%3A%2F%2Fpatchstorage.com%2Fmeditation-patch%2F",
    ));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-patch-filename"), "Meditation-patch.vcv");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), patchBytes);
    assert.deepEqual(requests, [
      "https://patchstorage.com/meditation-patch/",
      "https://patchstorage.com/wp-content/uploads/2017/09/Meditation-patch.vcv",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
