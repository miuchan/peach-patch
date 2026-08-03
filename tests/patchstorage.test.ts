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
    parsePatchStoragePageUrl(
      "https://www.patchstorage.com/meditation-patch/?utm_source=test#download",
    ).href,
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
    () =>
      parsePatchStorageDownloadHtml(
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
    const response = await GET(
      new Request(
        "https://peach.test/api/patchstorage?url=https%3A%2F%2Fpatchstorage.com%2Fmeditation-patch%2F",
      ),
    );
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

test("PatchStorage API reports missing URLs and upstream page failures", async () => {
  const missing = await GET(new Request("https://peach.test/api/patchstorage"));
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { error: "Missing PatchStorage patch URL" });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    const response = await GET(
      new Request(
        "https://peach.test/api/patchstorage?url=https%3A%2F%2Fpatchstorage.com%2Fmeditation-patch%2F",
      ),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "PatchStorage page returned 503" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PatchStorage API validates redirects and download responses", async () => {
  const originalFetch = globalThis.fetch;
  let request = 0;
  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) {
      const response = new Response(
        `<a class="ps-patch-download" href="https://patchstorage.com/wp-content/uploads/2026/08/patch.vcv">Download</a>`,
      );
      Object.defineProperty(response, "url", {
        value: "https://patchstorage.com/meditation-patch/",
      });
      return response;
    }
    return new Response("unavailable", { status: 404 });
  };
  try {
    const response = await GET(
      new Request(
        "https://peach.test/api/patchstorage?url=https%3A%2F%2Fpatchstorage.com%2Fmeditation-patch%2F",
      ),
    );
    assert.deepEqual(await response.json(), { error: "PatchStorage download returned 404" });

    globalThis.fetch = async () => {
      const redirected = new Response("page");
      Object.defineProperty(redirected, "url", { value: "https://example.com/stolen-patch/" });
      return redirected;
    };
    const redirect = await GET(
      new Request(
        "https://peach.test/api/patchstorage?url=https%3A%2F%2Fpatchstorage.com%2Fmeditation-patch%2F",
      ),
    );
    assert.match((await redirect.json()).error, /Expected a PatchStorage patch link/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PatchStorage API enforces declared and decoded patch size limits", async () => {
  const originalFetch = globalThis.fetch;
  const page = () =>
    new Response(
      `<a class="ps-patch-download" href="https://patchstorage.com/wp-content/uploads/2026/08/patch.vcv">Download</a>`,
    );
  const requestUrl =
    "https://peach.test/api/patchstorage?url=https%3A%2F%2Fpatchstorage.com%2Fmeditation-patch%2F";

  try {
    let request = 0;
    globalThis.fetch = async () => {
      request += 1;
      return request === 1
        ? page()
        : new Response("too large", {
            headers: { "content-length": String(25 * 1024 * 1024 + 1) },
          });
    };
    const declared = await GET(new Request(requestUrl));
    assert.deepEqual(await declared.json(), {
      error: "The PatchStorage patch is larger than the 25 MB import limit",
    });

    request = 0;
    globalThis.fetch = async () => {
      request += 1;
      if (request === 1) return page();
      return {
        ok: true,
        url: "",
        headers: new Headers(),
        arrayBuffer: async () => ({ byteLength: 25 * 1024 * 1024 + 1 }),
      } as unknown as Response;
    };
    const decoded = await GET(new Request(requestUrl));
    assert.deepEqual(await decoded.json(), {
      error: "The PatchStorage patch is larger than the 25 MB import limit",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PatchStorage API keeps a stable fallback for non-Error failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw "offline";
  };
  try {
    const response = await GET(
      new Request(
        "https://peach.test/api/patchstorage?url=https%3A%2F%2Fpatchstorage.com%2Fmeditation-patch%2F",
      ),
    );
    assert.deepEqual(await response.json(), { error: "Could not load the PatchStorage patch" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
