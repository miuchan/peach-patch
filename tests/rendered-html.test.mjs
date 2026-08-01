import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

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
  const deployment=JSON.parse(wrangler);
  assert.equal(deployment.assets.not_found_handling,"single-page-application");
  assert.deepEqual(deployment.assets.run_worker_first,["/api/*"]);
});

test("ships product metadata and removes starter preview", async () => {
  const [html, main, packageJson] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app/main.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(html, /Peach Patch — Rack-compatible modular runtime/);
  assert.doesNotMatch(html, /\/og\.png/);
  assert.match(main, /createBrowserRouter/);
  assert.match(main, /<RouterProvider router=\{router\} \/>/);
  assert.match(main, /import\("\.\/rack-web-studio"\)/);
  assert.match(main, /return \{ Component: RackWebStudio \}/);
  assert.match(packageJson, /"react-router"/);
  assert.doesNotMatch(packageJson, /"(?:vinext|next|react-server-dom-webpack)"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("public/wasm/bruer-seq1.wasm", root));
  await access(new URL("public/wasm/audible-elements.wasm", root));
  await access(new URL("public/audio/rack-plugin-processor.js", root));
  await access(new URL("public/audio/rack-graph-processor.js", root));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  await assert.rejects(access(new URL("app/layout.tsx", root)));
  await assert.rejects(access(new URL("app/page.tsx", root)));
});

test("official source widths stay canonical across image loads and autosave restore", async () => {
  const [panel, studio, cableLayer, styles, manual, arpeggiator, corrupter, tapestry, paramVisual] = await Promise.all([
    readFile(new URL("app/components/module-panel.tsx", root), "utf8"),
    readFile(new URL("app/rack-web-studio.tsx", root), "utf8"),
    readFile(new URL("app/components/rack-studio-cable-layer.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/components/rack-madzine-manual.tsx", root), "utf8"),
    readFile(new URL("app/components/rack-ml-arpeggiator-display.tsx", root), "utf8"),
    readFile(new URL("app/components/rack-corrupter-display.tsx", root), "utf8"),
    readFile(new URL("app/components/rack-tapestry-display.tsx", root), "utf8"),
    readFile(new URL("app/components/rack-param-visual.tsx", root), "utf8"),
  ]);
  assert.doesNotMatch(panel, /naturalWidth\s*\/\s*image\.naturalHeight/);
  assert.match(panel, /resolvedModulePortPosition\(module,direction,port\.id/);
  assert.match(panel, /pw-ports inputs aligned-layout/);
  assert.match(panel, /paramDragRef/);
  assert.match(panel, /setPointerCapture/);
  assert.match(panel, /rackParamInteraction/);
  assert.match(panel, /pw-param-switch/);
  assert.match(panel, /RackMadzineScopeDisplay/);
  assert.match(panel, /visual\.kind==="madzine-scope"/);
  assert.match(panel, /RackMadzineWaveformDisplay/);
  assert.match(panel, /visual\.kind==="madzine-waveform"/);
  assert.match(panel, /onLoopEndReset=\{\(\)=>onParamReset/);
  assert.match(panel, /RackUniversalRhythmDisplay/);
  assert.match(panel, /visual\.kind==="universal-rhythm"/);
  assert.match(panel, /visual\.kind==="song-mode-sequence"/);
  assert.match(panel, /aria-label="Playback sequence"/);
  assert.match(panel, /RackMadzineLaunchpad/);
  assert.match(panel, /visual\.kind==="madzine-launchpad"/);
  assert.match(panel, /RackTheKickSample/);
  assert.match(panel, /visual\.kind==="the-kick-sample"/);
  assert.match(panel, /RackMadzineManual/);
  assert.match(panel, /visual\.kind==="madzine-manual"/);
  assert.match(panel, /RackMlArpeggiatorDisplay/);
  assert.match(panel, /visual\.kind==="ml-arpeggiator"/);
  assert.match(panel, /RackCorrupterDisplay/);
  assert.match(panel, /visual\.kind==="corrupter-display"/);
  assert.match(corrupter, /DECIMATE/);
  assert.match(corrupter, /writePosition\/bins\*width/);
  assert.match(corrupter, /BND/);
  assert.match(panel, /RackTapestryDisplay/);
  assert.match(panel, /visual\.kind==="tapestry-display"/);
  assert.match(tapestry, /rack-tapestry-display|Tapestry reel waveform/);
  assert.match(tapestry, /deleteActionBase/);
  assert.match(tapestry, /Math\.pow\(peak,\.7\)/);
  assert.match(paramVisual, /RedLargeToggleKnob:\{name:"msm\/Knobs\/RedLargeKnob\.svg",size:47,angle:\.78\}/);
  assert.match(paramVisual, /GreenToggleKnobSmall:\{name:"msm\/Knobs\/GreenSmallKnob\.svg",size:32,angle:\.78\}/);
  assert.match(paramVisual, /VioM2Switch:\{name:"",size:\[14,20\.641106\],frames:2/);
  assert.match(paramVisual, /FMSM/);
  assert.match(paramVisual, /msm\/Switch\/FMSM_3\.svg/);
  assert.match(paramVisual, /OSCiXEGG/);
  assert.match(paramVisual, /msm\/Button\/Easteregg_1\.svg/);
  assert.equal(
    panel.match(/registerRackParamPress\(lastParamPressRef\.current,param\.id,event\.pointerType,performance\.now\(\)\)/g)?.length,
    3,
  );
  assert.equal(panel.match(/if\(event\.detail>1\|\|press\.doubleClick\)\{/g)?.length,4);
  assert.equal(panel.match(/if\(event\.button>0\)return;/g)?.length,4);
  assert.match(panel, /onMouseDown=\{\(event\)=>\{/);
  assert.match(panel, /registerRackParamPress\(lastParamPressRef\.current,param\.id,"mouse",performance\.now\(\)\)/);
  assert.equal(panel.match(/onDoubleClick=\{\(event\)=>\{/g)?.length,3);
  assert.match(panel, /resetParam=\(\)=>window\.requestAnimationFrame\(\(\)=>onParamReset\(param\.id,rackParamResetValue\(param,module\.params\)\)\)/);
  assert.match(panel, /paramDragRef\.current=null;resetParam\(\)/);
  assert.match(panel, /if\(event\.detail>1\)return/);
  assert.match(panel, /data-port-direction="in"/);
  assert.match(panel, /data-port-direction="out"/);
  assert.match(studio, /normalizeRestoredPatch\(restored\.patch, getWebPlugin\)/);
  assert.match(studio, /parseAutosavedPatch\(localStorage\.getItem/);
  assert.match(studio, /layoutPatchCables\(patch, registry, cableTension\)/);
  assert.doesNotMatch(
    studio,
    /patchQuery|traceSelection|pw-patch-tools|Find module in patch|Trace cables/,
  );
  assert.match(studio, /import \{ Maximize2 \} from "lucide-react"/);
  assert.match(studio, /className="pw-zoom"[\s\S]*className="pw-zoom-fit"/);
  assert.match(studio, /className="pw-rack-surface"/);
  assert.match(cableLayer, /className="pw-cable-hits"/);
  assert.match(studio, /loadPeachRegistry\(undefined,controller\.signal\)/);
  assert.match(studio, /replaceRegistryModules\(modules\)/);
  assert.doesNotMatch(studio, /\/dynamic-plugins\/catalog\.json|127\.0\.0\.1:4179|\/compile/);
  assert.match(studio, /rackSurfaceBounds\(/);
  assert.match(studio, /setManualHelpHover/);
  assert.match(studio, /onPortHover=/);
  assert.match(manual, /aria-label="Search MADZINE manual"/);
  assert.match(manual, /onData\(\{language:1\}\)/);
  assert.match(manual, /onData\(\{fontSize:20\}\)/);
  assert.match(arpeggiator, /order, range, and mode display/);
  assert.match(arpeggiator, /className="active"/);
  assert.match(styles, /\.pw-rack\{overflow:clip;/);
});
