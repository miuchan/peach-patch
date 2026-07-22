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

test("server-renders the independent Peach Patch runtime", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Peach Patch — Rack-compatible modular runtime<\/title>/i);
  assert.match(html, /PEACH/);
  assert.match(html, /PATCH/);
  assert.match(html, /Bruer\/SEQ1/);
  assert.match(html, />New</);
  assert.match(html, />Open</);
  assert.match(html, />Save</);
  assert.match(html, />Undo</);
  assert.match(html, />Redo</);
  assert.match(html, />Library</);
  assert.match(html, /aria-label="Fit complete patch in view"/);
  assert.match(html, /Start audio/);
  assert.match(html, /MODULES ·/);
  assert.doesNotMatch(html, /Rack-compatible research build|Heal delete|Record automation|Play automation/);
  assert.doesNotMatch(html, /<footer\b|Rack source v2\.6\.6|WASM READY/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships product metadata and removes starter preview", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(layout, /Peach Patch — Rack-compatible modular runtime/);
  assert.doesNotMatch(layout, /\/og\.png/);
  assert.match(page, /<RackWebStudio \/>/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("public/wasm/bruer-seq1.wasm", root));
  await access(new URL("public/wasm/audible-elements.wasm", root));
  await access(new URL("public/audio/rack-plugin-processor.js", root));
  await access(new URL("public/audio/rack-graph-processor.js", root));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});

test("official source widths stay canonical across image loads and autosave restore", async () => {
  const [panel, studio] = await Promise.all([
    readFile(new URL("app/components/module-panel.tsx", root), "utf8"),
    readFile(new URL("app/rack-web-studio.tsx", root), "utf8"),
  ]);
  assert.doesNotMatch(panel, /naturalWidth\s*\/\s*image\.naturalHeight/);
  assert.match(panel, /resolvedModulePortPosition\(module,direction,port\.id/);
  assert.match(panel, /pw-ports inputs aligned-layout/);
  assert.match(panel, /paramDragRef/);
  assert.match(panel, /setPointerCapture/);
  assert.match(panel, /rackParamInteraction/);
  assert.match(panel, /pw-param-switch/);
  assert.match(panel, /onDoubleClick=\{\(event\)=>\{event\.preventDefault\(\);event\.stopPropagation\(\);onParam\(param\.id,param\.default\);\}\}/);
  assert.match(panel, /data-port-direction="in"/);
  assert.match(panel, /data-port-direction="out"/);
  assert.match(studio, /module\.width !== definition\.width/);
  assert.match(studio, /\{ \.\.\.module, width: definition\.width \}/);
  assert.match(studio, /module\.key === "Core\/Blank"/);
  assert.match(studio, /\},\[patch,registry\]\);/);
  assert.doesNotMatch(
    studio,
    /patchQuery|traceSelection|pw-patch-tools|Find module in patch|Trace cables/,
  );
  assert.match(studio, /import \{ Maximize2, Play, Square \} from "lucide-react"/);
  assert.match(studio, /className="pw-zoom"[\s\S]*className="pw-zoom-fit"/);
  assert.match(studio, /className="pw-rack-surface"/);
  assert.match(studio, /className="pw-cable-hits"/);
  assert.match(studio, /fetch\("\/dynamic-plugins\/catalog\.json"\)/);
  assert.match(studio, /rackSurfaceBounds\(/);
});
