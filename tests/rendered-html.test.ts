import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { countSourceMatches, searchableSource } from "./source-contract.ts";

const root = new URL("../", import.meta.url);

async function readSearchableSource(path: string) {
  return searchableSource(await readFile(new URL(path, root), "utf8"));
}

test("builds the independent Peach Patch runtime as a client-only SPA", async () => {
  const [html, worker, wrangler] = await Promise.all([
    readFile(new URL("dist/client/index.html", root), "utf8"),
    readFile(new URL("dist/peachpatch/index.js", root), "utf8"),
    readFile(new URL("dist/peachpatch/wrangler.json", root), "utf8"),
  ]);
  assert.match(html, /<title>Peach Patch — Rack-compatible modular runtime<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module"[^>]+src="\/assets\/index-[^"]+\.js"/);
  assert.doesNotMatch(html, /PEACH|Bruer\/SEQ1|__next|__flight|react-server/);
  assert.match(worker, /\/api\/library\/resolve/);
  assert.match(worker, /\/api\/rack-component/);
  assert.match(worker, /\/api\/rack-rail/);
  assert.doesNotMatch(worker, /vinext|app-router-entry|react-server|\bRSC\b/);
  const deployment = JSON.parse(wrangler);
  assert.equal(deployment.name, "peachpatch");
  assert.equal(deployment.workers_dev, true);
  assert.deepEqual(deployment.routes, [{ pattern: "peachpatch.io", custom_domain: true }]);
  assert.equal(deployment.assets.not_found_handling, "single-page-application");
  assert.deepEqual(deployment.assets.run_worker_first, ["/api/*"]);
});

test("ships product metadata and removes starter preview", async () => {
  const [html, main, packageJson] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readSearchableSource("app/main.tsx"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(html, /Peach Patch — Rack-compatible modular runtime/);
  assert.doesNotMatch(html, /\/og\.png/);
  assert.match(main, /createBrowserRouter/);
  assert.match(main, /HydrateFallback:RackLoadingFallback/);
  assert.match(main, /initializeI18n\(\)/);
  assert.match(main, /<I18nProvider initialLocale=\{initialLocale\}>/);
  assert.match(main, /<RouterProvider router=\{router\} \/>/);
  assert.match(main, /import\("\.\/rack-web-studio"\)/);
  assert.match(main, /return \{ Component: RackWebStudio \}/);
  assert.match(packageJson, /"react-router"/);
  assert.doesNotMatch(packageJson, /"(?:vinext|next|react-server-dom-webpack)"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("public/audio/rack-plugin-processor.js", root));
  await access(new URL("public/audio/rack-graph-processor.js", root));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  await assert.rejects(access(new URL("app/layout.tsx", root)));
  await assert.rejects(access(new URL("app/page.tsx", root)));
});

test("large racks keep viewport gestures off the React render path", async () => {
  const [studio, gestures, viewport, moduleLayer, modulePanel, cableLayer, library, styles] =
    await Promise.all([
      readSearchableSource("app/rack-web-studio.tsx"),
      readSearchableSource("lib/use-rack-canvas-gestures.ts"),
      readSearchableSource("lib/rack-viewport-transform.ts"),
      readSearchableSource("app/components/rack-studio-module-layer.tsx"),
      readSearchableSource("app/components/module-panel.tsx"),
      readSearchableSource("app/components/rack-studio-cable-layer.tsx"),
      readSearchableSource("app/components/rack-studio-library.tsx"),
      readSearchableSource("app/globals.css"),
    ]);
  const pointerMove = gestures.slice(
    gestures.indexOf("const pointerMove"),
    gestures.indexOf("const pointerUp"),
  );
  assert.match(gestures, /createRackViewportFrameWriter/);
  assert.match(gestures, /Publish the final viewport in the same React batch/);
  assert.match(gestures, /addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(gestures, /addEventListener\("gesturechange", handleGestureChange/);
  assert.match(gestures, /nativeGestureActiveRef\.current/);
  assert.match(gestures, /if\s*\(viewportInteractionActiveRef\.current\)\s*return/);
  assert.doesNotMatch(studio, /onWheel=/);
  assert.doesNotMatch(pointerMove, /setPan\(|setZoom\(/);
  assert.match(viewport, /cableViewBox/);
  assert.match(moduleLayer, /memo\(\s*RackStudioModuleLayerView/);
  assert.match(moduleLayer, /className="pw-module-layer"/);
  assert.match(modulePanel, /--rack-module-x/);
  assert.match(modulePanel, /--rack-module-y/);
  assert.match(modulePanel, /data-rack-x=\{module\.x\}/);
  assert.match(gestures, /panel\.style\.visibility=rackModuleIntersectsViewport\(/);
  assert.match(cableLayer, /const cablePaths = useMemo/);
  assert.match(cableLayer, /preserveAspectRatio="none"/);
  assert.match(library, /memo\(RackStudioLibraryView\)/);
  assert.match(studio, /rackCableIntersectsViewport/);
  assert.doesNotMatch(studio, /viewport-(?:interaction|overview)/);
  assert.doesNotMatch(studio, /pw-rack-surface/);
  assert.match(styles, /\.pw-module\{[^}]*--rack-module-x/);
  assert.match(styles, /\.pw-module\{[^}]*translate3d\(var\(--rack-pan-x\)/);
  assert.match(styles, /\.pw-module-layer\{[^}]*z-index:1/);
  assert.match(styles, /\.pw-cable-hits\{[^}]*z-index:5/);
  assert.match(styles, /\.pw-cables\{[^}]*z-index:30/);
  assert.doesNotMatch(
    styles,
    /\.pw-module\s*\{[^}]*content-visibility:\s*auto/,
    "transformed rack modules must not use Chromium's unstable automatic content culling",
  );
  assert.doesNotMatch(
    styles,
    /\.pw-world\s*\{[^}]*(?:transform:|contain:|will-change:|backface-visibility:)/,
    "the shared viewport layer must not become a transformed compositor surface",
  );
});

test("Registry completion invalidates restored module panels without a click", async () => {
  const [studio, moduleLayer] = await Promise.all([
    readSearchableSource("app/rack-web-studio.tsx"),
    readSearchableSource("app/components/rack-studio-module-layer.tsx"),
  ]);

  assert.match(studio, /definitions=\{registry\}/);
  assert.match(moduleLayer, /definitions:\s*readonly\s+WebPluginModule\[\]/);
  assert.match(moduleLayer, /definitionsByKey=useMemo\(/);
  assert.match(moduleLayer, /previous\.definitions===next\.definitions/);
  assert.doesNotMatch(moduleLayer, /getDefinition/);
});

test("cable endpoint previews use an isolated Canvas without React pointer-move state", async () => {
  const [studio, preview, previewLayer, layout, cableLayer, portBank, plug, targeting, styles] =
    await Promise.all([
      readSearchableSource("app/rack-web-studio.tsx"),
      readSearchableSource("lib/rack-cable-preview.ts"),
      readSearchableSource("app/components/rack-studio-cable-preview-layer.tsx"),
      readSearchableSource("lib/rack-cable-layout.ts"),
      readSearchableSource("app/components/rack-studio-cable-layer.tsx"),
      readSearchableSource("app/components/module-panel-ports.tsx"),
      readSearchableSource("app/components/rack-cable-plug.tsx"),
      readSearchableSource("lib/rack-cable-targeting.ts"),
      readSearchableSource("app/globals.css"),
    ]);
  const rackStart = studio.indexOf("className={`pw-rack");
  const rackPointerMove = studio.slice(
    studio.indexOf("onPointerMove=", rackStart),
    studio.indexOf("onPointerUp=", rackStart),
  );
  assert.doesNotMatch(studio, /setCableDragPoint/);
  assert.doesNotMatch(rackPointerMove, /setCable(?:Drag|Draft)/);
  assert.match(rackPointerMove, /cablePreviewWriterRef\.current\?\.preview/);
  assert.match(preview, /at most one preview draw per frame/);
  assert.match(previewLayer, /<canvas ref=\{canvasRef\} className="pw-cable-preview"/);
  assert.match(previewLayer, /quadraticCurveTo/);
  assert.match(layout, /const modulesById = new Map/);
  assert.match(cableLayer, /data-cable-id=\{path\.id\}/);
  assert.match(cableLayer, /className="pw-cable-line"/);
  assert.match(studio, /rack\.setPointerCapture\(event\.pointerId\)/);
  assert.match(studio, /closestCablePort\(/);
  assert.match(studio, /dropTarget\?\.clientX\?\?event\.clientX/);
  assert.match(studio, /rackPortsMatch\(interaction\.value\.port,releasedPort\)/);
  assert.match(studio, /connectPort\(interaction\.value\.port\)/);
  assert.doesNotMatch(portBank, /\bdraggable\b|onPointerUp=/);
  assert.match(plug, /className="pw-cable-plug-hit"/);
  assert.match(targeting, /kind==="touch"\?48/);
  assert.match(styles, /\.cable-drop-target i/);
});

test("SignalFunctionSet displays keep Rack colors and route canvas gestures through visual actions", async () => {
  const [display, visuals, studio, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-signal-function-set-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("app/rack-web-studio.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  assert.match(display, /const BLUE\s*=\s*"#0097de"/);
  assert.match(display, /const ORANGE\s*=\s*"#ec652e"/);
  assert.match(display, /const PURPLE\s*=\s*"#35354d"/);
  for (const model of [
    "Arrange",
    "Beat",
    "Chance",
    "Gravity",
    "Note",
    "Operator",
    "Phase",
    "Play",
    "Record",
  ])
    assert.match(display, new RegExp(`"${model}"`));
  assert.match(display, /kind\s*<<\s*eventShift/);
  assert.match(display, /onAction\(id,\s*true\)/);
  assert.match(display, /const mini\s*=\s*64/);
  assert.doesNotMatch(display, /onContextMenu=/);
  assert.match(visuals, /onAction=\{onVisualAction\}/);
  const visualActionStart = studio.indexOf("onVisualAction=");
  const visualActionEnd = studio.indexOf("onParamHover=", visualActionStart);
  const visualAction = studio.slice(visualActionStart, visualActionEnd);
  assert.ok(visualActionStart >= 0 && visualActionEnd > visualActionStart);
  assert.match(visualAction, /triggerAction\(module\.id,\s*id,\s*active\)/);
  assert.doesNotMatch(visualAction, /setMomentaryParam|recordAutomationValue/);
  assert.match(worklet, /visual\.kind\s*===\s*"signal-function-set"/);
});

test("SortStep preserves native array colors and drag-only interpolation actions", async () => {
  const [display, visuals, registry, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-sort-step-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  for (const color of ["#ffffff", "#fada47", "#d13a52", "#1919e1"])
    assert.match(display, new RegExp(color));
  assert.match(display, /setPointerCapture/);
  assert.match(display, /onPointerMove/);
  assert.match(display, /index\s*\*\s*\(visual\.valueSteps\s*\+\s*1\)\s*\+\s*value/);
  assert.doesNotMatch(
    display.slice(display.indexOf("onPointerDown="), display.indexOf("onPointerMove=")),
    /write\(/,
  );
  assert.match(visuals, /visual\.kind==="sort-step"/);
  assert.match(visuals, /<RackSortStepDisplay/);
  assert.match(registry, /kind:\s*"sort-step"/);
  assert.match(worklet, /visual\.kind==="sort-step"/);
});

test("BaconMusic modules preserve the pressed footer and LintBuddy host tools", async () => {
  const [footer, lint, visuals, layer, registry] = await Promise.all([
    readSearchableSource("app/components/rack-bacon-footer.tsx"),
    readSearchableSource("app/components/rack-lint-buddy.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("app/components/rack-studio-module-layer.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(footer, /M20\.469 32\.031c-/);
  assert.match(footer, /M36 18c0 9\.941/);
  assert.match(footer, /setPointerCapture/);
  assert.match(footer, /pressed\?<LoveBaconSvg\/>:<BaconSvg\/>/);
  for (const testName of [
    "Labels Check",
    "Probe Bypass",
    "JSON Extract",
    "WidgetPositions",
    "WhiteList",
    "MyPatch",
  ])
    assert.match(lint, new RegExp(testName));
  assert.match(lint, /Run 100 times/);
  assert.match(lint, /URL\.createObjectURL/);
  assert.match(lint, /console\.info\(`LintBuddy Log Output/);
  assert.match(layer, /module\.key!=="BaconMusic\/LintBuddy"/);
  assert.match(layer, /outgoing\?\.toModule\?\?incoming\?\.fromModule/);
  assert.match(visuals, /<RackBaconFooter/);
  assert.match(visuals, /<RackLintBuddy/);
  assert.match(registry, /kind:\s*"bacon-footer"/);
  assert.match(registry, /kind:\s*"lint-buddy"/);
});

test("JW-Modules grids preserve native colors, drag painting, and alternate gestures", async () => {
  const [grid, visuals, registry, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-jw-grid.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  for (const color of ["#ff9709", "#fff309", "#901afc", "#1996fc"])
    assert.match(grid, new RegExp(color));
  assert.match(grid, /strokeStyle="rgb\(60,70,73\)"/);
  assert.match(grid, /setPointerCapture/);
  assert.match(grid, /hasPointerCapture/);
  assert.match(grid, /onPointerMove=/);
  assert.match(grid, /visual\.style==="arrange"&&event\.shiftKey/);
  assert.match(grid, /event\.button===2\|\|event\.ctrlKey/);
  assert.match(grid, /onContextMenu=/);
  assert.match(grid, /visual\.actionBase\+index\*2\+\(next\?1:0\)/);
  assert.match(visuals, /visual\.kind==="jw-grid"/);
  assert.match(visuals, /<RackJwGrid/);
  assert.match(registry, /kind:\s*"jw-grid"/);
  assert.match(worklet, /visual\.kind==="jw-grid"/);
});

test("JW-Modules generative displays retain source geometry and live WASM telemetry", async () => {
  const [display, visuals, registry, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-jw-visual-displays.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  for (const color of ["#ffffff", "#ff9709", "#fff309", "#901afc", "#1996fc"])
    assert.match(display, new RegExp(color));
  assert.match(display, /strokeStyle="rgb\(60,70,73\)"/);
  assert.match(display, /context\.lineWidth=1/);
  assert.match(display, /context\.lineWidth=2/);
  assert.match(display, /random\[nextCount%25\]/);
  assert.match(display, /direction\*theta\+randomAngle/);
  for (const kind of ["jw-d1v1de", "jw-thing-thing", "jw-tree"]) {
    assert.match(visuals, new RegExp(`visual\\.kind==="${kind}"`));
    assert.match(registry, new RegExp(`kind:\\s*"${kind}"`));
    assert.match(worklet, new RegExp(`visual\\.kind==="${kind}"`));
  }
});

test("Biset Tree draws every native wind-deformed branch with Rack styling", async () => {
  const [display, visuals, registry, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-biset-tree-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  assert.match(display, /context\.rotate\(-Math\.PI\/2\)/);
  assert.match(display, /context\.lineCap="round"/);
  assert.match(display, /values\[offset\+4\]\?\?0\)\*0\.2/);
  assert.match(display, /context\.moveTo\(values\[offset\]\?\?0,values\[offset\+1\]\?\?0\)/);
  assert.match(visuals, /visual\.kind==="biset-tree"/);
  assert.match(visuals, /<RackBisetTreeDisplay/);
  assert.match(registry, /kind:\s*"biset-tree"/);
  assert.match(worklet, /visual\.kind==="biset-tree"/);
});

test("Biset Regex restores Rack text editing, compile, stop, focus and syntax colors", async () => {
  const [display, visuals, registry, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-biset-regex.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  for (const marker of [
    'measureText("x")',
    "visibleOffset(visual.condensed,cursor)",
    'event.key==="Enter"',
    "visual.compileAllAction",
    "visual.compileActionBase+row",
    'event.key==="Escape"',
    "visual.stopActionBase+row",
    'event.key==="ArrowDown"',
    'nextText.replace(/[\\s]/g,"")',
    "characterColor(character,active.has(index),visual.colors)",
  ])
    assert.match(display, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(visuals, /visual\.kind==="biset-regex"/);
  assert.match(visuals, /<RackBisetRegex/);
  assert.match(registry, /kind:\s*"biset-regex"/);
  assert.match(worklet, /visual\.kind==="biset-regex"/);
});

test("Biset Tracker family keeps cross-module state, keyboard editing, and native colors", async () => {
  const [tracker, visuals, registry, worklet, layer] = await Promise.all([
    readSearchableSource("app/components/rack-biset-tracker.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("app/components/rack-studio-module-layer.tsx"),
  ]);
  for (const marker of [
    'event.key==="ArrowUp"',
    'event.key==="Backspace"',
    "setPointerCapture",
    "visual.userColors",
    "RackBisetTrackerOutput",
    "RackBisetTrackerState",
  ])
    assert.match(tracker, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(tracker, /visual\.font\.family/);
  assert.match(registry, /font:\s*\{\s*family:string;file:string\s*\}/);
  for (const kind of ["biset-tracker", "biset-tracker-output", "biset-tracker-state"]) {
    assert.match(visuals, new RegExp(`visual\\.kind===\"${kind}\"`));
    assert.match(registry, new RegExp(`kind:\\s*\"${kind}\"`));
    assert.match(worklet, new RegExp(`visual\\.kind === \"${kind}\"`));
  }
  assert.match(worklet, /configureBisetTrackerGroups/);
  assert.match(worklet, /processBisetTrackerGroup/);
  assert.match(layer, /relatedScopeSamples/);
});

test("Biset Blank replaces only cable artwork and preserves source-rate scope behavior", async () => {
  const [blank, studio, cableLayer, visuals, registry, worklet, css] = await Promise.all([
    readSearchableSource("app/components/rack-biset-blank-overlay.tsx"),
    readSearchableSource("app/rack-web-studio.tsx"),
    readSearchableSource("app/components/rack-studio-cable-layer.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("app/globals.css"),
  ]);
  for (const marker of [
    "(1-tension)*(150+Math.max(0,distance))",
    "visual.polyCableWidth",
    "visual.plugRadius",
    "visual.lightRadius",
    "visual.positiveColor",
    "visual.negativeColor",
    "scopeHeight*0.905",
    "RackShareTechMono",
  ])
    assert.match(blank, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(studio, /replacementActive={bisetBlankCableReplacement}/);
  assert.match(studio, /<RackBisetBlankOverlay/);
  assert.match(cableLayer, /replacementActive\?\{opacity:0\}:\{\}/);
  assert.match(cableLayer, /className="pw-cable-hits"/);
  assert.match(visuals, /<RackBisetBlankPanel/);
  assert.match(registry, /kind:\s*"biset-blank-overlay"/);
  assert.match(worklet, /captureBisetBlankSignals/);
  assert.match(worklet, /bisetBlankCaptureFrame===0/);
  assert.match(worklet, /new Float32Array\(2048\)/);
  assert.match(css, /\.pw-biset-blank-cables/);
  assert.match(css, /pointer-events:none/);
});

test("FullScope variants and FlyingFader preserve their native trace and drag behavior", async () => {
  const [scope, fader, controls, visuals, registry, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-full-scope-display.tsx"),
    readSearchableSource("app/components/rack-flying-fader.tsx"),
    readSearchableSource("app/components/module-panel-controls.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  assert.match(scope, /strokeWidth="1\.5"/);
  assert.match(scope, /strokeLinecap="round"/);
  assert.match(scope, /mixBlendMode:"plus-lighter"/);
  assert.match(scope, /rgba\(244,189,141,\.753\)/);
  assert.match(scope, /FontFace/);
  assert.match(scope, /statText\("max"/);
  assert.match(fader, /MotorizedFaderBackground\.svg/);
  assert.match(fader, /MotorizedFaderHandle_\$\{color\}\.svg/);
  assert.match(fader, /visual\.minHandleY\+\(visual\.maxHandleY-visual\.minHandleY\)\*normalized/);
  assert.match(fader, /rotate\(-90 11 76\.5\)/);
  assert.match(controls, /param\.dragActionId!==undefined/);
  assert.match(controls, /onVisualAction\(param\.dragActionId,true\)/);
  assert.match(controls, /onVisualAction\(param\.dragActionId,false\)/);
  assert.match(visuals, /visual\.kind==="flying-fader"/);
  assert.match(registry, /kind:\s*"flying-fader"/);
  assert.match(worklet, /visual\.kind==="full-scope"/);
});

test("Algomorph variants render the source graph bank and preserve matrix randomization", async () => {
  const [display, visuals, registry, client, worklet] = await Promise.all([
    readSearchableSource("app/components/rack-algomorph-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("lib/peach-registry-client.ts"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
  ]);
  for (const marker of [
    "DelexanderMiriamLibre",
    "8.35425",
    "0.925",
    "2.65/4+1/3",
    "rgb(64,54,74)",
    "154,154,111",
    "GraphStructure.cpp'sasymmetricsourceindex",
    "RandomizeAlgorithm",
    "RandomizeAllAlgorithms",
    "onContextMenu={contextMenu}",
  ])
    assert.match(display, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(display, /visual\.operators\.flatMap/);
  assert.match(display, /visual\.modulators\.map/);
  assert.match(display, /AUX_LABELS/);
  assert.match(visuals, /visual\.kind==="algomorph-display"/);
  assert.match(visuals, /<RackAlgomorphDisplay/);
  assert.match(registry, /kind:\s*"algomorph-display"/);
  assert.match(client, /"assetBase"invisual&&visual\.assetBase/);
  assert.match(worklet, /visual\.kind==="algomorph-display"/);
});

test("source-derived signal displays preserve Rack trace styles and sample input or output channels", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-native-signal-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"native-signal"/);
  assert.match(registry, /strokeWidths:\s*number\[\]/);
  assert.match(visuals, /RackNativeSignalDisplay/);
  assert.match(visuals, /strokeWidths=\{visual\.strokeWidths\}/);
  assert.match(display, /context\.lineWidth\s*=\s*\(strokeWidths\[/);
  assert.match(display, /mode\s*===\s*"xy"/);
  assert.match(display, /mode\s*===\s*"spectrum"/);
  assert.match(display, /mode\s*===\s*"meter"/);
  assert.match(worklet, /visual\.kind\s*===\s*"native-signal"/);
  assert.match(worklet, /source\.kind\s*===\s*"output"/);
  assert.match(worklet, /channel\s*\*\s*portCount\s*\+\s*port/);
});

test("source-derived touch, XY, point, and grid editors retain pointer capture and WASM actions", async () => {
  const [touch, ribbon, voxglitch, points, phase, crawl, grid, sequencer, visuals, worklet] =
    await Promise.all([
      readSearchableSource("app/components/rack-touch-ribbon.tsx"),
      readSearchableSource("app/components/rack-linear-ribbon.tsx"),
      readSearchableSource("app/components/rack-voxglitch-xy.tsx"),
      readSearchableSource("app/components/rack-param-xy-points.tsx"),
      readSearchableSource("app/components/rack-phase-distortion-pad.tsx"),
      readSearchableSource("app/components/rack-crawl-display.tsx"),
      readSearchableSource("app/components/rack-cell-grid.tsx"),
      readSearchableSource("app/components/rack-sequencer-grid.tsx"),
      readSearchableSource("app/components/module-panel-visuals.tsx"),
      readSearchableSource("public/audio/rack-graph-processor.js"),
    ]);
  assert.match(touch, /#ffccaaa0/);
  assert.match(touch, /setPointerCapture/);
  assert.match(touch, /xStep\s*\+\s*yStep\s*\*\s*actionSteps/);
  assert.match(ribbon, /#ff6464c8|color/);
  assert.match(ribbon, /onAction\(lastAction\.current,\s*false\)/);
  assert.match(voxglitch, /strokeWidth="0\.5"/);
  assert.match(voxglitch, /start|actionBase/);
  assert.match(points, /onParam\(points\[selected\]\.xParam/);
  assert.match(points, /setPointerCapture/);
  assert.match(phase, /#ffffff80/);
  assert.match(phase, /#2a5775/);
  assert.match(phase, /setPointerCapture/);
  assert.match(phase, /onAction\(action,\s*true\)/);
  assert.match(crawl, /onDoubleClick/);
  assert.match(crawl, /strokeOpacity|withAlpha/);
  assert.match(grid, /packedWordBits/);
  assert.match(grid, /setPointerCapture/);
  assert.match(grid, /rgba\(255,255,255,0\.0313725\)/);
  assert.match(sequencer, /pointerMode/);
  for (const component of [
    "RackTouchRibbon",
    "RackLinearRibbon",
    "RackVoxglitchXy",
    "RackParamXyPoints",
    "RackPhaseDistortionPad",
    "RackCrawlDisplay",
    "RackCellGrid",
  ])
    assert.match(visuals, new RegExp(component));
  assert.match(worklet, /visual\.kind\s*===\s*"voxglitch-xy"/);
  assert.match(worklet, /visual\.kind\s*===\s*"crawl-display"/);
  assert.match(worklet, /visual\.kind\s*===\s*"cell-grid"/);
  assert.match(worklet, /visual\.kind\s*===\s*"sequencer-grid"/);
  assert.match(worklet, /visual\.kind\s*===\s*"phase-distortion-pad"/);
  assert.match(worklet, /visual\.kind\s*===\s*"walk2-display"/);
  assert.match(worklet, /visual\.kind\s*===\s*"vertical-position"/);
  assert.match(worklet, /visual\.kind\s*===\s*"mouse-seq-grid"/);
  assert.match(worklet, /"param-xy-points"/);
});

test("MouseSeq keeps pointer-gate recording and Rack keyboard selection", async () => {
  const [grid, visuals] = await Promise.all([
    readSearchableSource("app/components/rack-mouse-seq-grid.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
  ]);
  assert.match(grid, /CLOCK_KEYS\s*=\s*\["z",\s*"x",\s*"c",\s*"v"\]/);
  assert.match(grid, /SCALE_KEYS\s*=\s*\["a",\s*"s",\s*"d",\s*"f"\]/);
  assert.match(grid, /#284028/);
  assert.match(grid, /#284040/);
  assert.match(grid, /#644028/);
  assert.match(grid, /#0064c8/);
  assert.match(grid, /onPointerCancel=\{release\}/);
  assert.match(visuals, /RackMouseSeqGrid/);
});

test("Walk2 and MC1 retain their native trace and recording drag semantics", async () => {
  const [walk2, vertical, visuals] = await Promise.all([
    readSearchableSource("app/components/rack-walk2-display.tsx"),
    readSearchableSource("app/components/rack-vertical-position.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
  ]);
  assert.match(walk2, /#ffffff70/);
  assert.match(walk2, /#505050/);
  assert.match(walk2, /#00ddff/);
  assert.match(walk2, /setPointerCapture/);
  assert.match(vertical, /#00ff008c/);
  assert.match(vertical, /#ffffff8c/);
  assert.match(vertical, /onAction\(lastAction\.current, false\)/);
  assert.match(visuals, /RackWalk2Display/);
  assert.match(visuals, /RackVerticalPosition/);
});

test("CyclicCA renders the native packed automaton state without inventing an editor", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-cyclic-ca-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"cyclic-ca"/);
  assert.match(registry, /cellsPerWord:\s*number/);
  assert.match(display, /context\.createImageData\(pixelWidth, pixelHeight\)/);
  assert.match(display, /cell\s*%\s*cellsPerWord/);
  assert.match(display, /imageRendering:\s*"pixelated"/);
  assert.match(display, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(display, /onAction|onParam/);
  assert.match(visuals, /RackCyclicCaDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"cyclic-ca"/);
});

test("dbRack matrix displays preserve native paint, erase, select, palette, and ant directions", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-db-matrix-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"db-matrix"/);
  assert.match(display, /#a2d6c6/);
  assert.match(display, /#404028/);
  assert.match(display, /#ffff64/);
  assert.match(display, /CHANNEL_COLORS/);
  assert.match(display, /PALETTES/);
  assert.match(display, /event\.shiftKey/);
  assert.match(display, /dragButton\.current\s*===\s*2/);
  assert.match(display, /setPointerCapture/);
  assert.match(display, /direction\s*===\s*0/);
  assert.match(visuals, /RackDbMatrixDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"db-matrix"/);
});

test("FLAME preserves its native spectrogram palette, stroke width, and draggable selection", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-flame-spectrogram.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"flame-spectrogram"/);
  assert.match(display, /255\s*-\s*row\s*\*\s*1\.2/);
  assert.match(display, /context\.lineWidth\s*=\s*1/);
  assert.match(display, /rgba\(0,0,0,0\.470588\)/);
  assert.match(display, /rgba\(0,0,0,0\.313725\)/);
  assert.match(display, /setPointerCapture/);
  assert.match(display, /onAction\(lastAction\.current, false\)/);
  assert.match(visuals, /RackFlameSpectrogram/);
  assert.match(worklet, /visual\.kind\s*===\s*"flame-spectrogram"/);
});

test("MemoryPad preserves path recording, the 50-point radial tail, and native puck radius", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-path-trackpad.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"path-trackpad"/);
  assert.match(display, /tail\.current\.length\s*>\s*50/);
  assert.match(display, /index\s*\/\s*49/);
  assert.match(display, /createRadialGradient/);
  assert.match(display, /context\.arc\(point\.x, point\.y, 8/);
  assert.match(display, /setPointerCapture/);
  assert.match(display, /onAction\(lastAction\.current, false\)/);
  assert.match(visuals, /RackPathTrackpad/);
  assert.match(worklet, /visual\.kind\s*===\s*"path-trackpad"/);
});

test("DigitalSequencer preserves native voltage, gate, modifier, and keyboard editing", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-digital-sequencer.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"digital-sequencer"/);
  assert.match(display, /commandAction\(2\)/);
  assert.match(display, /gatePaintOn/);
  assert.match(display, /event\.shiftKey/);
  assert.match(display, /ArrowUp/);
  assert.match(display, /rgba\(0,100,116,0\.1098\)/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackDigitalSequencer/);
  assert.match(worklet, /visual\.kind\s*===\s*"digital-sequencer"/);
});

test("Hazumi preserves native bouncing-ball grid rendering and drag height editing", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-hazumi-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"hazumi-sequencer"/);
  assert.match(display, /rgb\(223,234,236\)/);
  assert.match(display, /rgb\(42,50,52\)/);
  assert.match(display, /fade\.current\[column\]\s*\+\s*0\.036/);
  assert.match(display, /column\s*\*\s*ROWS\s*\+\s*row\s*-\s*1/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackHazumiDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"hazumi-sequencer"/);
});

test("StochSeq preserves probability painting, Ctrl toggles, banks, traces, and shortcuts", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-stoch-sequencer.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"stoch-sequencer"/);
  assert.match(display, /rgba\(255,255,255,0\.74902\)/);
  assert.match(display, /rgb\(60,70,73\)/);
  assert.match(display, /event\.ctrlKey/);
  assert.match(display, /event\.key\s*===\s*"ArrowLeft"/);
  assert.match(display, /StochMemoryBanks/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackStochSequencer/);
  assert.match(worklet, /visual\.kind\s*===\s*"stoch-sequencer"/);
});

test("Bidoo sample editors preserve native waveform colors, markers, pan, and vertical zoom", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-bidoo-sample-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"bidoo-sample"/);
  assert.match(display, /rgb\(164,3,111\)/);
  assert.match(display, /rgb\(45,114,143\)/);
  assert.match(display, /rgb\(255,233,0\)/);
  assert.match(display, /rgb\(205,31,0\)/);
  assert.match(display, /event\.shiftKey\s*\?\s*2\s*:\s*1\.1/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackBidooSampleDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"bidoo-sample"/);
});

test("liMonADe preserves native spectrum editing, frame traces, scrollbar, and 3D rotation", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-bidoo-limonade-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"bidoo-limonade"/);
  assert.match(display, /rgb\(255,233,0\)/);
  assert.match(display, /rgb\(2,195,154\)/);
  assert.match(display, /rgb\(205,31,0\)/);
  assert.match(display, /event\.ctrlKey/);
  assert.match(display, /scrollAnchor/);
  assert.match(display, /angles\.current\.alpha1/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackBidooLimonadeDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"bidoo-limonade"/);
});

test("Frozen Wasteland bar grids preserve native gradients, pin axis, and Shift drawing", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-fw-cell-bar-grid.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"fw-cell-bar-grid"/);
  assert.match(display, /rgb\(20,30,33\)/);
  assert.match(display, /rgba\(58,163,39,0\.12549\)/);
  assert.match(display, /rgba\(26,19,199,0\.941176\)/);
  assert.match(display, /event\.shiftKey/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackFwCellBarGrid/);
  assert.match(worklet, /visual\.kind\s*===\s*"fw-cell-bar-grid"/);
});

test("Filling Station preserves native step values, current color, and vertical drag editing", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-filling-station-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"filling-station"/);
  assert.match(display, /rgb\(239,224,0\)/);
  assert.match(display, /rgb\(47,240,0\)/);
  assert.match(display, /Math\.trunc\(current\.initial\s*\+\s*designDelta\s*\/\s*20\)/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackFillingStationDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"filling-station"/);
});

test("Quad Algorithmic Rhythm preserves radial colors, current step, and Shift accent editing", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-qar-rhythm-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"qar-rhythm"/);
  assert.match(display, /#efe000/);
  assert.match(display, /#00e0ef/);
  assert.match(display, /#2ff000/);
  assert.match(display, /event\.shiftKey\s*\?\s*accentActionBase/);
  assert.match(display, /context\.createRadialGradient/);
  assert.match(visuals, /RackQarRhythmDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"qar-rhythm"/);
});

test("CellularAuto preserves the native overview, zoom colors, and editable initial/field cells", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-cellular-auto-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"cellular-auto"/);
  assert.match(display, /#80ff40/);
  assert.match(display, /#000080/);
  assert.match(display, /#40c040/);
  assert.match(display, /actionBase\s*\+\s*encoded/);
  assert.match(visuals, /RackCellularAutoDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"cellular-auto"/);
});

test("Saros preserves the native envelope curve, playhead, and continuous table drawing", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-saros-envelope.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"saros-envelope"/);
  assert.match(display, /rgba\(255,196,100,0\.902\)/);
  assert.match(display, /rgba\(255,238,184,0\.565\)/);
  assert.match(display, /index\s*\*\s*actionSteps/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackSarosEnvelope/);
  assert.match(worklet, /visual\.kind\s*===\s*"saros-envelope"/);
});

test("TRG preserves its native two-page gate grid and paint drag semantics", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-trg-sequencer.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"trg-sequencer"/);
  assert.match(display, /rgb\(20,30,33\)/);
  assert.match(display, /rgb\(252,252,3\)/);
  assert.match(display, /rgb\(62,62,0\)/);
  assert.match(display, /paintState\.current\s*=/);
  assert.match(display, /setPointerCapture/);
  assert.match(visuals, /RackTrgSequencer/);
  assert.match(worklet, /visual\.kind\s*===\s*"trg-sequencer"/);
});

test("PolarCV preserves its native equation trace, cursor, grid, and stroke widths", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-polar-cv-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"polar-cv-display"/);
  assert.match(display, /#c9f2ff/);
  assert.match(display, /lineWidth\s*=\s*0\.3/);
  assert.match(display, /#ff0000/);
  assert.match(display, /lineWidth\s*=\s*3/);
  assert.match(display, /repeat\s*\*\s*\(index\s*\/\s*\(points\s*-\s*1\)\)\s*\*\s*Math\.PI/);
  assert.match(visuals, /RackPolarCvDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"polar-cv-display"/);
});

test("Axioma visual modules preserve native trails, roses, tesseract colors, and cobwebs", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-axioma-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"axioma-display"/);
  assert.match(display, /rgb\(250,250,250\)/);
  assert.match(display, /rgba\(224,224,224,0\.88\)/);
  assert.match(display, /rgb\(255,102,0\)/);
  assert.match(display, /lineWidth\s*=\s*0\.35/);
  assert.match(display, /bifurcationValue/);
  assert.match(visuals, /RackAxiomaDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"axioma-display"/);
});

test("Alias preserves its native benchmark status, green grid, and 0.8px ratio curve", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-alias-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"alias-display"/);
  assert.match(display, /rgb\(0,16,0\)/);
  assert.match(display, /rgb\(0,85,0\)/);
  assert.match(display, /rgb\(68,255,68\)/);
  assert.match(display, /lineWidth\s*=\s*0\.8/);
  assert.match(display, /WORKING/);
  assert.match(visuals, /RackAliasDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"alias-display"/);
});

test("Chord Chemist preserves its chord wheel, labels, and active step rings", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-chord-chemist-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"chord-chemist-display"/);
  assert.match(display, /rgb\(21,55,227\)/);
  assert.match(display, /rgb\(220,151,40\)/);
  assert.match(display, /lineWidth\s*=\s*1\.5/);
  assert.match(display, /Lydian Dominant/);
  assert.match(display, /pw-rack-chord-chemist-active-step/);
  assert.match(visuals, /RackChordChemistDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"chord-chemist-display"/);
});

test("Runshow preserves its native clocks, segmented bars, and draggable maximum line", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-runshow-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"runshow-display"/);
  assert.match(display, /rgb\(0,255,100\)/);
  assert.match(display, /rgb\(255,200,0\)/);
  assert.match(display, /rgb\(255,133,133\)/);
  assert.match(display, /rgb\(255,255,0\)/);
  assert.match(display, /sourceDeltaY\s*\*\s*0\.25/);
  assert.match(display, /onParamReset\(maxParam, 5\)/);
  assert.match(visuals, /RackRunshowDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"runshow-display"/);
});

test("SDLines and Note preserve their native polyphonic voltage and pitch displays", async () => {
  const [lines, notes, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-sd-lines-display.tsx"),
    readSearchableSource("app/components/rack-note-poly-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"sd-lines-display"/);
  assert.match(registry, /kind:\s*"note-poly-display"/);
  assert.match(lines, /rgb\(255,0,0\)/);
  assert.match(lines, /rgb\(120,120,120\)/);
  assert.match(lines, /strokeWidth="1"/);
  assert.match(notes, /Oswald/);
  assert.match(notes, /letterSpacing="1\.5"/);
  assert.match(notes, /cppRound/);
  assert.match(visuals, /RackSdLinesDisplay/);
  assert.match(visuals, /RackNotePolyDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"sd-lines-display"/);
});

test("LoFiTV preserves its native 127-square RGB slime trail map", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-lofi-tv-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"lofi-tv-display"/);
  assert.match(display, /\* 256/);
  assert.match(display, /imageSmoothingEnabled\s*=\s*false/);
  assert.match(display, /column \* rows \+ row/);
  assert.match(visuals, /RackLofiTvDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"lofi-tv-display"/);
});

test("Cosmic Clock preserves its live wheel, exact glyph paths, aspects, readout, and now action", async () => {
  const [display, visuals, worklet, registry, menus] = await Promise.all([
    readSearchableSource("app/components/rack-cosmic-clock-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
    readSearchableSource("app/components/rack-studio-context-menus.tsx"),
  ]);
  assert.match(registry, /kind:\s*"cosmic-clock-display"/);
  assert.match(registry, /contextActions\?:/);
  assert.match(display, /0\.15 \+ 0\.75 \* intensity/);
  assert.match(display, /mm\(0\.4 \* \(1 \+ intensity\)\)/);
  assert.match(display, /drawSignGlyph/);
  assert.match(display, /drawPlanetGlyph/);
  assert.match(display, /Share Tech Mono/);
  assert.match(visuals, /RackCosmicClockDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"cosmic-clock-display"/);
  assert.match(menus, /onTriggerAction\(module\.id, action\.id\)/);
});

test("WrongPeople Lua preserves its log, points, values, and four-trace scope modes", async () => {
  const [display, visuals, worklet, registry] = await Promise.all([
    readSearchableSource("app/components/rack-lua-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("public/audio/rack-graph-processor.js"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /kind:\s*"lua-display"/);
  assert.match(display, /letterSpacing\s*=\s*"-2px"/);
  assert.match(display, /rgb\(254,208,133\)/);
  assert.match(display, /globalCompositeOperation\s*=\s*"lighter"/);
  assert.match(display, /lineWidth\s*=\s*1\.5/);
  assert.match(display, /triggerThreshold/);
  assert.match(visuals, /RackLuaDisplay/);
  assert.match(worklet, /visual\.kind\s*===\s*"lua-display"/);
});

test("Bogaudio spectrum rendering supports exact native line colors and pointer freeze", async () => {
  const [display, visuals, registry] = await Promise.all([
    readSearchableSource("app/components/rack-spectrum-display.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("lib/web-plugin-registry.ts"),
  ]);
  assert.match(registry, /colors\?:\s*string\[\]/);
  assert.match(registry, /fillAlpha\?:\s*number/);
  assert.match(registry, /freeze\?:\s*boolean/);
  assert.match(visuals, /colors=\{visual\.colors\}/);
  assert.match(
    visuals,
    /fillAlpha=\{visual\.kind\s*===\s*"spectrum-analyzer"\s*\?\s*visual\.fillAlpha/,
  );
  assert.match(display, /if\s*\(fillAlpha\s*>\s*0\)/);
  assert.match(display, /setPointerCapture/);
  assert.match(display, /onPointerCancel/);
  assert.match(display, /event\.key\s*!==\s*"ArrowLeft"/);
});

test("official source widths stay canonical across image loads and autosave restore", async () => {
  const [
    panel,
    controls,
    visuals,
    ports,
    studio,
    dialogs,
    registryHook,
    audioRuntimeHook,
    strokeControlsHook,
    cableLayer,
    styles,
    manual,
    arpeggiator,
    corrupter,
    tapestry,
    paramVisual,
    paramVisualData,
    morphPad,
  ] = await Promise.all([
    readSearchableSource("app/components/module-panel.tsx"),
    readSearchableSource("app/components/module-panel-controls.tsx"),
    readSearchableSource("app/components/module-panel-visuals.tsx"),
    readSearchableSource("app/components/module-panel-ports.tsx"),
    readSearchableSource("app/rack-web-studio.tsx"),
    readSearchableSource("app/components/rack-studio-dialogs.tsx"),
    readSearchableSource("app/hooks/use-peach-registry.ts"),
    readSearchableSource("app/hooks/use-rack-audio-runtime.ts"),
    readSearchableSource("app/hooks/use-rack-stroke-controls.ts"),
    readSearchableSource("app/components/rack-studio-cable-layer.tsx"),
    readSearchableSource("app/globals.css"),
    readSearchableSource("app/components/rack-madzine-manual.tsx"),
    readSearchableSource("app/components/rack-ml-arpeggiator-display.tsx"),
    readSearchableSource("app/components/rack-corrupter-display.tsx"),
    readSearchableSource("app/components/rack-tapestry-display.tsx"),
    readSearchableSource("app/components/rack-param-visual.tsx"),
    readSearchableSource("lib/rack-param-visual-data.ts"),
    readSearchableSource("app/components/rack-morph-pad-display.tsx"),
  ]);
  assert.doesNotMatch(panel, /naturalWidth\s*\/\s*image\.naturalHeight/);
  assert.match(panel, /resolvedModulePortPosition\(module,direction,port\.id/);
  assert.match(ports, /pw-ports \$\{bankClass\} aligned-layout/);
  assert.match(
    panel,
    /hasTrustworthySourceGeometry=rackUiGeometryIsTrustworthy\(definition\?\.width\?\?module\.width,params,inputs,outputs\)/,
  );
  assert.match(panel, /allowSourceGeometry=!panelArtworkUnavailable&&hasTrustworthySourceGeometry/);
  assert.match(
    panel,
    /panelInputs=panelArtworkUnavailable\?\[\]:hasPanelArtwork\?hasTrustworthySourceGeometry\?inputs\.filter\(port=>port\.position\):\[\]:inputs/,
  );
  assert.match(
    panel,
    /panelOutputs=panelArtworkUnavailable\?\[\]:hasPanelArtwork\?hasTrustworthySourceGeometry\?outputs\.filter\(port=>port\.position\):\[\]:outputs/,
  );
  assert.match(
    panel,
    /hasSourceLayout=hasPanelArtwork\|\|hasParamSourceLayout\|\|hasPortSourceLayout/,
  );
  assert.match(
    panel,
    /onError=\{\(\)=>setFailedPanelArtworkUrl\(module\.screenshotUrl\?\?null\)\}/,
  );
  assert.match(panel, /!expectsPanelArtwork\s*\?\s*\(\s*<div className="pw-module-image"/);
  assert.match(
    panel,
    /panelArtworkUnavailable\s*\?\s*\(\s*<div className="pw-panel-asset-error" role="alert"/,
  );
  assert.match(panel, /"module\.panelArtworkLoadFailed"/);
  assert.match(panel, /"module\.panelArtworkUnavailable"/);
  assert.match(panel, /<ModulePanelControls/);
  assert.match(controls, /paramDragRef/);
  assert.match(controls, /setPointerCapture/);
  assert.match(controls, /rackParamInteraction/);
  assert.match(controls, /pw-param-switch/);
  assert.match(panel, /<ModulePanelVisuals/);
  assert.match(visuals, /visual\.kind==="morph-pad"/);
  assert.match(visuals, /visual\.kind==="signal-function-set"/);
  assert.match(visuals, /RackSignalFunctionSetDisplay/);
  assert.match(morphPad, /onParam\(xParam,clampUnit\(normalizedX\)\)/);
  assert.match(morphPad, /onParam\(yParam,clampUnit\(normalizedY\)\)/);
  assert.match(visuals, /RackMadzineScopeDisplay/);
  assert.match(visuals, /visual\.kind==="madzine-scope"/);
  assert.match(visuals, /RackMadzineWaveformDisplay/);
  assert.match(visuals, /visual\.kind==="madzine-waveform"/);
  assert.match(visuals, /onLoopEndReset=\{\(\)=>onParamReset/);
  assert.match(visuals, /RackUniversalRhythmDisplay/);
  assert.match(visuals, /visual\.kind==="universal-rhythm"/);
  assert.match(visuals, /visual\.kind==="song-mode-sequence"/);
  assert.match(visuals, /aria-label=\{t\("visual\.playbackSequence"\)\}/);
  assert.match(visuals, /RackMadzineLaunchpad/);
  assert.match(visuals, /visual\.kind==="madzine-launchpad"/);
  assert.match(visuals, /RackTheKickSample/);
  assert.match(visuals, /visual\.kind==="the-kick-sample"/);
  assert.match(visuals, /RackMadzineManual/);
  assert.match(visuals, /visual\.kind==="madzine-manual"/);
  assert.match(visuals, /RackMlArpeggiatorDisplay/);
  assert.match(visuals, /visual\.kind==="ml-arpeggiator"/);
  assert.match(visuals, /RackCorrupterDisplay/);
  assert.match(visuals, /visual\.kind==="corrupter-display"/);
  assert.match(corrupter, /DECIMATE/);
  assert.match(corrupter, /\(writePosition\/bins\)\*width/);
  assert.match(corrupter, /BND/);
  assert.match(visuals, /RackTapestryDisplay/);
  assert.match(visuals, /visual\.kind==="tapestry-display"/);
  assert.match(tapestry, /rack-tapestry-display|display\.tapestryEditor/);
  assert.match(tapestry, /deleteActionBase/);
  assert.match(tapestry, /Math\.pow\(peak,\.7\)/);
  assert.match(paramVisual, /rackParamKnobAsset/);
  assert.match(paramVisual, /className="pw-rack-param-visual knob"/);
  assert.match(
    paramVisualData,
    /RedLargeToggleKnob:\{name:"msm\/Knobs\/RedLargeKnob\.svg",size:47,angle:\.78\}/,
  );
  assert.match(
    paramVisualData,
    /GreenToggleKnobSmall:\{name:"msm\/Knobs\/GreenSmallKnob\.svg",size:32,angle:\.78\}/,
  );
  assert.match(paramVisualData, /VioM2Switch:\{name:"",size:\[14,20\.641106\],frames:2/);
  assert.match(
    paramVisualData,
    /Rogan2PWhite:\{name:"Rogan2PWhite",bg:"Rogan2PBg",fg:"Rogan2PWhiteFg",size:34\.29297/,
  );
  assert.match(paramVisualData, /FMSM/);
  assert.match(paramVisualData, /msm\/Switch\/FMSM_3\.svg/);
  assert.match(paramVisualData, /OSCiXEGG/);
  assert.match(paramVisualData, /msm\/Button\/Easteregg_1\.svg/);
  assert.equal(
    countSourceMatches(
      controls,
      /registerRackParamPress\(lastParamPressRef\.current,param\.id,event\.pointerType,performance\.now\(\)\)/g,
    ),
    3,
  );
  assert.equal(countSourceMatches(controls, /if\(event\.detail>1\|\|press\.doubleClick\)\{/g), 4);
  assert.equal(countSourceMatches(controls, /if\(event\.button>0\)return;/g), 4);
  assert.match(controls, /onMouseDown=\{\(event\)=>\{/);
  assert.match(
    controls,
    /registerRackParamPress\(lastParamPressRef\.current,param\.id,"mouse",performance\.now\(\)\)/,
  );
  assert.equal(countSourceMatches(controls, /onDoubleClick=\{\(event\)=>\{/g), 3);
  assert.match(
    controls,
    /resetParam=\(\)=>window\.requestAnimationFrame\(\(\)=>onParamReset\(param\.id,rackParamResetValue\(param,module\.params\)\)\)/,
  );
  assert.match(controls, /paramDragRef\.current=null;resetParam\(\)/);
  assert.match(controls, /if\(event\.detail>1\)return/);
  assert.match(controls, /param\.position\?\.widget==="LoadButton"/);
  assert.match(controls, /suppressAssetPickerRef\.current=true/);
  assert.match(controls, /queueAssetPicker\(\);suppressAssetPickerRef\.current=false/);
  assert.match(controls, /className="pw-midi-device"/);
  assert.match(controls, /STROKE_SPECIAL_MODES\.map/);
  assert.match(ports, /data-port-direction={direction}/);
  assert.match(panel, /direction="in"/);
  assert.match(panel, /direction="out"/);
  assert.match(studio, /normalizeRestoredPatch\(restored\.patch, getWebPlugin\)/);
  assert.match(studio, /parseAutosavedPatch\(localStorage\.getItem/);
  assert.match(dialogs, /dialog\.failure\.invalidEyebrow/);
  assert.match(dialogs, /dialog\.failure\.invalidTitle/);
  assert.match(studio, /layoutPatchCables\(patch, registry, cableTension\)/);
  assert.doesNotMatch(
    studio,
    /patchQuery|traceSelection|pw-patch-tools|Find module in patch|Trace cables/,
  );
  assert.match(studio, /import \{ Maximize2 \} from "lucide-react"/);
  assert.match(studio, /className="pw-zoom"[\s\S]*className="pw-zoom-fit"/);
  assert.doesNotMatch(studio, /className="pw-rack-surface"/);
  assert.match(cableLayer, /className="pw-cable-hits"/);
  assert.match(registryHook, /loadPeachRegistry\(configuredIndex,controller\.signal\)/);
  assert.match(registryHook, /replaceRegistryModules\(nextModules\)/);
  assert.match(registryHook, /import\.meta\.env\.VITE_PEACH_REGISTRY_URL/);
  assert.match(studio, /useRackAudioRuntime\(/);
  assert.match(audioRuntimeHook, /structureRef\.current=loadedStructureKey/);
  assert.match(audioRuntimeHook, /rackAudioGraphNeedsRebuild\(/);
  assert.match(studio, /useRackStrokeControls\(/);
  assert.match(strokeControlsHook, /dispatchHoveredHotkey\(event,true\)/);
  assert.match(strokeControlsHook, /dispatchStroke\(event,true\)/);
  assert.match(strokeControlsHook, /window\.addEventListener\("keyup",handleKeyUp\)/);
  assert.doesNotMatch(studio, /\/dynamic-plugins\/catalog\.json|127\.0\.0\.1:4179|\/compile/);
  assert.match(studio, /rackViewportPresentation\(/);
  assert.match(studio, /setManualHelpHover/);
  assert.match(studio, /onPortHover=/);
  assert.doesNotMatch(studio, /choose a Library module to insert it on this cable/);
  assert.match(manual, /aria-label=\{t\("manual\.search"\)\}/);
  assert.match(manual, /onData\(\{language:1\}\)/);
  assert.match(manual, /onData\(\{fontSize:20\}\)/);
  assert.match(arpeggiator, /display\.arpeggiator/);
  assert.match(arpeggiator, /className="active"/);
  assert.match(styles, /\.pw-rack\{overflow:clip;/);
  assert.match(styles, /\.pw-rack\{[^}]*overscroll-behavior:none/);
  assert.match(styles, /\.pw-cable-hits\{[^}]*overflow:hidden/);
  assert.doesNotMatch(styles, /\.pw-rack\.viewport-interaction/);
});
