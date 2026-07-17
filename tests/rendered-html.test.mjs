import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Web Rack template patch", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Web Rack — Browser Modular Synthesizer<\/title>/i);
  assert.match(html, /VCV/);
  assert.match(html, /Right-click or Enter/);
  for (const moduleName of ["MIDI-CV", "VCO-1", "VCF", "VCA", "ADSR", "SCOPE", "AUDIO-2"]) {
    assert.match(html, new RegExp(moduleName.replace("/", "\\/"), "i"));
  }
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships product metadata and removes starter preview", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(layout, /Web Rack — Browser Modular Synthesizer/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /<SynthStudio \/>/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("public/og.png", root));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
