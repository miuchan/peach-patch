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
    readFile(new URL("dist/peach_patch/index.js", root), "utf8"),
    readFile(new URL("dist/peach_patch/wrangler.json", root), "utf8"),
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
  const [studio, gestures, viewport, moduleLayer, cableLayer, library, styles] = await Promise.all([
    readSearchableSource("app/rack-web-studio.tsx"),
    readSearchableSource("lib/use-rack-canvas-gestures.ts"),
    readSearchableSource("lib/rack-viewport-transform.ts"),
    readSearchableSource("app/components/rack-studio-module-layer.tsx"),
    readSearchableSource("app/components/rack-studio-cable-layer.tsx"),
    readSearchableSource("app/components/rack-studio-library.tsx"),
    readSearchableSource("app/globals.css"),
  ]);
  const pointerMove = gestures.slice(
    gestures.indexOf("const pointerMove"),
    gestures.indexOf("const pointerUp"),
  );
  assert.match(gestures, /createRackViewportTransformWriter/);
  assert.match(gestures, /startTransition\(\(\) =>/);
  assert.match(gestures, /addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(gestures, /addEventListener\("gesturechange", handleGestureChange/);
  assert.doesNotMatch(studio, /onWheel=/);
  assert.doesNotMatch(pointerMove, /setPan\(|setZoom\(/);
  assert.match(viewport, /translate3d\(/);
  assert.match(moduleLayer, /memo\(\s*RackStudioModuleLayerView/);
  assert.match(cableLayer, /const cablePaths = useMemo/);
  assert.match(library, /memo\(RackStudioLibraryView\)/);
  assert.match(studio, /viewport-overview/);
  assert.match(
    styles,
    /\.pw-world\.viewport-overview\s+\.pw-module\s*>\s*\*\s*\{\s*display:\s*none\s*!important/,
  );
  assert.doesNotMatch(
    styles,
    /\.pw-module\s*\{[^}]*content-visibility:\s*auto/,
    "transformed rack modules must not use Chromium's unstable automatic content culling",
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
  const [studio, preview, previewLayer, layout, cableLayer] = await Promise.all([
    readSearchableSource("app/rack-web-studio.tsx"),
    readSearchableSource("lib/rack-cable-preview.ts"),
    readSearchableSource("app/components/rack-studio-cable-preview-layer.tsx"),
    readSearchableSource("lib/rack-cable-layout.ts"),
    readSearchableSource("app/components/rack-studio-cable-layer.tsx"),
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
  ]);
  assert.doesNotMatch(panel, /naturalWidth\s*\/\s*image\.naturalHeight/);
  assert.match(panel, /resolvedModulePortPosition\(module,direction,port\.id/);
  assert.match(ports, /pw-ports \$\{bankClass\} aligned-layout/);
  assert.match(
    panel,
    /hasTrustworthySourceGeometry=rackUiGeometryIsTrustworthy\(definition\?\.width\?\?module\.width,params,inputs,outputs\)/,
  );
  assert.match(panel, /allowSourceGeometry=!panelArtworkFailed&&hasTrustworthySourceGeometry/);
  assert.match(
    panel,
    /panelInputs=hasPanelArtwork\?hasTrustworthySourceGeometry\?inputs\.filter\(port=>port\.position\):\[\]:inputs/,
  );
  assert.match(
    panel,
    /panelOutputs=hasPanelArtwork\?hasTrustworthySourceGeometry\?outputs\.filter\(port=>port\.position\):\[\]:outputs/,
  );
  assert.match(
    panel,
    /hasSourceLayout=hasPanelArtwork\|\|hasParamSourceLayout\|\|hasPortSourceLayout/,
  );
  assert.match(
    panel,
    /onError=\{\(\)=>setFailedPanelArtworkUrl\(module\.screenshotUrl\?\?null\)\}/,
  );
  assert.match(panel, /<ModulePanelControls/);
  assert.match(controls, /paramDragRef/);
  assert.match(controls, /setPointerCapture/);
  assert.match(controls, /rackParamInteraction/);
  assert.match(controls, /pw-param-switch/);
  assert.match(panel, /<ModulePanelVisuals/);
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
  assert.match(studio, /className="pw-rack-surface"/);
  assert.match(cableLayer, /className="pw-cable-hits"/);
  assert.match(registryHook, /loadPeachRegistry\(undefined,controller\.signal\)/);
  assert.match(registryHook, /replaceRegistryModules\(nextModules\)/);
  assert.match(studio, /useRackAudioRuntime\(/);
  assert.match(audioRuntimeHook, /structureRef\.current=loadedStructureKey/);
  assert.match(audioRuntimeHook, /rackAudioGraphNeedsRebuild\(/);
  assert.match(studio, /useRackStrokeControls\(/);
  assert.match(strokeControlsHook, /dispatchHoveredHotkey\(event\)/);
  assert.match(strokeControlsHook, /dispatchStroke\(event,true\)/);
  assert.match(strokeControlsHook, /window\.addEventListener\("keyup",handleKeyUp\)/);
  assert.doesNotMatch(studio, /\/dynamic-plugins\/catalog\.json|127\.0\.0\.1:4179|\/compile/);
  assert.match(studio, /rackSurfaceBounds\(/);
  assert.match(studio, /setManualHelpHover/);
  assert.match(studio, /onPortHover=/);
  assert.doesNotMatch(studio, /choose a Library module to insert it on this cable/);
  assert.match(manual, /aria-label=\{t\("manual\.search"\)\}/);
  assert.match(manual, /onData\(\{language:1\}\)/);
  assert.match(manual, /onData\(\{fontSize:20\}\)/);
  assert.match(arpeggiator, /display\.arpeggiator/);
  assert.match(arpeggiator, /className="active"/);
  assert.match(styles, /\.pw-rack\{overflow:clip;/);
});
