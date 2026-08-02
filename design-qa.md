# VCV Rack UI restoration design QA

source visual truth path: `artifacts/ui-qa/vcv-reference.png` and official `artifacts/ui-qa/scope-source.webp`

implementation screenshot paths: `artifacts/ui-qa/scope-focused-full-v2.png`, `artifacts/ui-qa/rack-plugs-and-lights-1280x720.png`, `artifacts/ui-qa/rack-cable-direction-no-outline-1280x720.png`, `artifacts/ui-qa/mattix-import-live-fixed-v2-1280x720.png`, `artifacts/ui-qa/mattix-import-live-audio-display-690x749.png`, `artifacts/ui-qa/audio8-live-canonical-690x749.png`, `artifacts/ui-qa/mattix-final-passed-690x749.png`, and `artifacts/ui-qa/mattix-cable-centers-fixed-690x749.png`

comparison artifacts: `artifacts/ui-qa/rack-full-comparison.png`, `artifacts/ui-qa/scope-comparison-v2.png`, `artifacts/ui-qa/rack-controls-comparison.png`, `artifacts/ui-qa/rack-plug-comparison.png`, `artifacts/ui-qa/rack-cable-direction-comparison.png`, `artifacts/ui-qa/mattix-import-live-fixed-comparison.png`, and `artifacts/ui-qa/audio8-source-live-comparison.png`

viewport: VCV Rack reference 1301 x 768 px; full browser comparison 1280 x 720 CSS px at device scale factor 1; final embedded-browser regression 690 x 749 CSS px. The focused Audio-8 comparison normalizes both module crops to 195 x 482 px.

density normalization: the official Fundamental Scope source is 780 x 1520 px (@4x Rack pixels) and was downsampled to 207 x 404 px. The focused implementation module measured 207.316 x 404 CSS px at the current rack zoom and was cropped to 207 x 404 px. The focused comparison therefore uses equal pixel dimensions.

state: source full view is the open Mattix patch in VCV Rack 2.6.6. The latest implementation full view is the same imported `Mattix.vcv` with 87 panels, 80 active WASM modules, 142 cables, 15 feedback edges, running browser audio, animated signal jacks, and live dynamic surfaces. Earlier focused implementation evidence uses two Fundamental Scope modules, one Fundamental VCO, and two live cables. The focused Scope comparison uses the official default state on the left and the running signal state on the right; cable/waveform differences are expected state differences. The focused Audio-8 comparison uses the saved Mattix Core Audio device state and the same two connected device-output cables.

## Full-view comparison evidence

`artifacts/ui-qa/rack-full-comparison.png` places the live VCV Rack capture and browser implementation in one image. Rack rail geometry, 15 px HP rhythm, 380 px row height, panel-to-rail alignment, contiguous module packing, and cable termination agree visibly. The browser application chrome and inspector intentionally remain product-specific and are outside this UI-first rack/panel pass.

`artifacts/ui-qa/mattix-import-live-fixed-comparison.png` places the complete imported Mattix graph beside the VCV Rack reference at a normalized 1280 x 720 frame. The same seven rack rows, blank-panel gaps, module ordering, panel widths, cable colors, and dense cross-row routing are visible. The browser fit is slightly more centered and its application controls remain intentionally product-specific.

The final 690 x 749 embedded-browser regression reloaded the autosaved Mattix graph through the current source registry. All 87 panels remain on 15 px HP widths and 380 px row coordinates, with zero overlaps, 142 cables, 284 plug rings, zero shadow paths, and zero broken images. This caught and fixed stale autosaved widths and removed Library-raster aspect-ratio measurement as a geometry authority.

## Focused region comparison evidence

`artifacts/ui-qa/scope-comparison-v2.png` places the official Scope raster and equal-size browser capture together. Panel typography, screw positions, knob and jack placement, display bounds, display grid, waveform, trigger marker, and min/max/peak-to-peak statistics align. The implementation uses the official Library raster as the assembled static visual and replaces the display region with a live canvas.

`artifacts/ui-qa/audio8-source-live-comparison.png` places the Audio-8 region from the running VCV Rack reference beside the equal-size browser module. The display bounds, three rows, separators, ShareTechMono text, saved Core Audio device/rate/block values, jack grid, status-light positions, and cable endpoints align. Browser audio lights the first device-output pair and the connected jacks dynamically.

## Findings

- [P3] The live Scope statistics use browser canvas text metrics, so their glyph spacing remains a minor optical difference from Rack's NanoVG rendering.
  Location: `app/components/rack-scope-display.tsx`.
  Evidence: equal-size comparison shows matching content, bounds, alignment, and hierarchy with small subpixel glyph-spacing differences only.
  Impact: no functional, layout, or interaction impact.

## Required fidelity surfaces

- Fonts and typography: panel fonts come from the official module raster and match. Braids uses the original Segment14 font. Audio displays load Rack's original `ShareTechMono-Regular.ttf`. The live Scope stats retain the P3 browser-canvas spacing difference above.
- Spacing and layout rhythm: passed for Rack geometry: 15 px HP, 380 px rows, exact rail SVG, contiguous packing, and exact port anchors.
- Colors and visual tokens: panel and rail colors come from original assets. Live cable colors are patch colors. Powered-jack glow is an intentional live-state overlay.
- Image quality and asset fidelity: official Library module rasters and the cloned Rack `Rail.svg` are used; no replacement panel illustration is drawn. Focused capture remains sharp at equal dimensions.
- Copy and content: original panel copy is preserved by the official raster. Browser application chrome remains product-specific in this phase.

## Comparison history

1. Initial implementation had a P1 40 px artificial header offset and P1 generic grid rack. Fixed by removing the source-panel header from layout, moving all widget/port coordinates to the 0..380 Rack coordinate space, and serving the cloned Rack `Rail.svg`.
2. First rail capture was blocked because the runtime route resolved `process.cwd()` to `/bundle`. Fixed by bundling the original SVG with a Vite raw import. Post-fix evidence is `artifacts/ui-qa/rack-full-comparison.png`.
3. First focused Scope comparison lacked live statistics and trigger presentation and used a blue unpatched trace. Fixed by adding live pp/max/min labels, trigger line/marker, and Rack-yellow default trace. Post-fix evidence is `artifacts/ui-qa/scope-comparison-v2.png`.
4. Cable endpoints initially terminated as bare strokes. Fixed from Rack 2.6.6 `CableWidget.cpp`, `Module.cpp`, and `Light.hpp`: each endpoint now uses the original tinted `Plug.svg`, the original centered `PlugPort.svg` circular ring, tangent-angle rotation, top-plug ordering, mono/polyphonic RGB voltage calculation, immediate-rise/30 Hz exponential decay, and screen-blended multi-color light composition. Post-fix evidence is `artifacts/ui-qa/rack-plug-comparison.png`.
5. Module lights initially remained frozen in the Library raster. Fixed by extracting `createLight*` and `createLightParam*` geometry from source and streaming the WASM light buffer to Rack-style foreground and halo rendering.
6. Cable lines had an opaque 9 px black border and the input plug was fixed at `-π/2`, pointing away from the cable slump. Fixed by removing the shadow path, deriving both plug angles from each jack toward the shared slump point, offsetting the cable endpoints 14 px along those vectors as in `CableWidget.cpp`, and using a quadratic path through the same slump. Post-fix evidence is `artifacts/ui-qa/rack-cable-direction-comparison.png`.
7. The imported-patch button preferred `showOpenFilePicker()`, which does not expose a DOM file-chooser event in the embedded browser and left `Open .vcv` inert. Fixed by routing the button through the standard accessible file input. The actual `/Users/miu/Downloads/Mattix.vcv` now imports successfully.
8. At 1280 px the live engine status collapsed into a narrow vertical strip, and horizontal focus scrolling could hide the primary audio control. Fixed by hiding the duplicated header status below 1400 px and compacting action padding so all 16 controls fit without scrolling. Post-fix evidence is `artifacts/ui-qa/mattix-import-live-fixed-v2-1280x720.png`.
9. The colored Rogan knob layers used legacy undersized bounds, so their moving red/green discs and centers did not match the official panel raster; Branches also interpreted a `30.196594mm` SVG width as 30 Rack pixels, multiplying its control offsets and sizes by roughly three. Fixed by using the Rack 2.6.6 component-library dimensions (Rogan1PS 39.6836 px, Rogan2PS 43.3476 px, Rogan3PS 51.84375 px), measuring all overlay geometry against the hydrated module width, snapping near-grid millimeter panels to 15 px HP units, and correcting Branches to 90 px.
10. Audio-8 still used its stale 300 px browser width and only the Library screenshot's frozen device display. Fixed from Rack 2.6.6 `Audio.cpp`, `AudioDisplay.cpp`, and `LedDisplay.cpp`: the Core module is 150 px, uses the original display bounds/font/rows/separators and saved device values, and exposes all eight GreenRed status-light positions. The same pass removed raster-aspect width mutation and reconciles autosaved module widths against current source definitions, eliminating six overlaps found during the final regression.
11. Cable paths were memoized only against the patch while panel jack hit targets rerendered when the dynamic source registry arrived. This left many cables using fallback coordinates even though the visible jacks had switched to extracted source coordinates; four static fallback widths also disagreed with their source SVGs. Fixed by making cable geometry depend on the active registry, using `modulePortPosition()` for both panel buttons and cable endpoints, preserving resizable Blank widths, and matching Braids/Elements/SEQ3/VCA widths to their source panels. Across all 284 Mattix plugs, the measured plug-to-nearest-jack maximum fell from 20.284 px to 0.0029 px at the 27% fitted view; no endpoint exceeds half a CSS pixel.

## Primary interactions tested

- Added multiple source-art modules and verified adjacent 195 px packing with no overlap.
- Connected cables through exact jack hit targets and verified generated SVG cable endpoints land at the same Rack widget coordinates.
- Started browser audio with a Fundamental VCO feeding two Scope modules.
- Verified two powered cables and four powered jacks reported 5.000 V live signal state.
- Verified both Scope canvases run at device density and display live waveforms.
- Verified the Braids Segment14 canvas is present and changes from `CSAW` to `QPSK` when the Model parameter moves from minimum to maximum; evidence is `artifacts/ui-qa/braids-qpsk-1280x720.png`.
- Verified Mattix Audio-8 renders its saved `Core Audio`, `MacBook Air扬声器 (1-2 out)`, `48 kHz`, and `256` values in the original three-row display; all eight source status-light widgets are mounted and the first device-output pair lights when browser audio starts.
- Verified every one of the 150 visible Mattix parameters has extracted source widget metadata; knob rotation, switch frames, push-button glow, and slider travel use original Rack/plugin SVG assets.
- Verified all cable endpoints have a distinct plug body and centered circular `PlugPort` ring; only each cable's top plug receives the Rack-style RGB signal lamp.
- Verified the rendered cable SVG contains zero `.shadow` paths; both visible cables use quadratic slump paths and all four plugs have non-fixed source-derived rotations.
- Verified 7 live module light widgets on the current four-module browser patch, including VCO phase/mode lights and Scope latch lights.
- Imported the actual `/Users/miu/Downloads/Mattix.vcv` through the visible `Open .vcv` control and verified 87/87 ready panels, 142/142 cable groups, 284 cable plugs, zero shadow paths, 342 dynamic light widgets, zero broken panel images, zero off-grid panels, and zero overlaps.
- Started the imported Mattix graph and verified the authoritative runtime state: 80 WASM modules, 142 cables, 15 feedback edges, zero skipped modules, and 92 currently powered cable groups.
- Verified the 1280 px header has no horizontal overflow: the first audio control and last New patch control are simultaneously visible.
- Reloaded the autosaved 87-module patch through current source definitions and verified 0 off-grid HP widths, 0 off-row modules, 0 overlaps, 0 broken images, 1 live Scope, 6 live Braids segment displays, 1 live Audio-8 display, and 350 dynamic light widgets.
- Verified every one of the 284 Mattix plug rings against the rendered jack-button centers after dynamic registry hydration: median error 0.00003 px, 95th percentile 0.00208 px, maximum 0.00289 px, and zero endpoints above 0.5 px.
- Verified browser console errors: none.
- Verified typecheck, lint, production build, source-widget extraction tests, generic display-contract tests, and the full 80-module/142-cable Mattix graph worklet test.

## Implementation checklist

1. [x] Bind Mattix meters and custom displays to audio/WASM telemetry.
2. [x] Cover every dynamic widget type used by Mattix.
3. [x] Re-run full-view and focused design QA with no P0/P1/P2 findings.

final result: passed

tooling note: the 32 focused import/layout/rendering tests, typecheck, lint, and production build pass. The repository-wide test command still reaches the pre-existing visual-only scaffold fixture failure where generated adapter code references an undeclared `foreground`; it is outside this cable/UI change.

## Dense application chrome pass

source capture: `artifacts/ui-qa/dense-ui-before-690x749.png`

implementation captures: `artifacts/ui-qa/dense-ui-final-clean-1280x720.png`, `artifacts/ui-qa/dense-ui-library-open-1280x720.png`, `artifacts/ui-qa/dense-ui-library-open-690x749.png`, and `artifacts/ui-qa/dense-ui-inspector-1280x720.png`

The persistent toolbar now contains only audio, fit, library, undo/redo, open, save, and new-patch controls. Focus, copy, paste, delete, heal-delete, performance, and automation controls were removed from the persistent chrome; existing keyboard editing remains available, while the advanced performance/automation/heal actions remain compact expert shortcuts. The duplicated engine/status prose is now an accessible live region rather than visible chrome.

The top bar fell from 52 px to 36 px, the open Library shelf from 116 px to 70 px, and the 28 px bottom status/footer row was removed completely. At 1280 × 720 the collapsed rack viewport therefore grows from 640 px to 684 px; with Library open it grows from 524 px to 614 px. The Library keeps its URL loader, module search, and horizontal module results while removing the introductory and ABI explanatory copy. The inspector drops duplicated description and panel-reference content and uses a 236 px compact live-port/parameter layout.

Responsive verification passes at 1280 × 720 and 690 × 749: zero page overflow, zero toolbar overflow, no footer nodes, 87 restored Mattix modules, 284 cable plugs, zero broken images, and a 643 px rack viewport with the Library open at the narrow breakpoint. Live audio verification reports 80 WASM modules, 142 cables, 15 feedback edges, 0 skipped modules, and powered cable/jack animation.

final dense-chrome result: passed

## Patch search and cable-trace removal

source visual: `/var/folders/qg/1b0blbsn5yv031r0gjb363400000gn/T/codex-clipboard-1ab283d1-d3ff-4ea7-b07b-bcd715ea0c12.png`

implementation capture: `artifacts/ui-qa/patch-tools-removed-1280x720.png`

The requested `Find in 87 modules…` field and `Trace cables` control are absent rather than visually hidden. Their query state, match filtering, result list, trace state, cable-muting branch, context-menu exclusion, and all associated CSS were removed. The rack now begins directly below the 36 px application bar with no overlay or reserved blank row.

The restored Mattix view has zero patch-tool nodes, zero matching accessible controls, zero muted cable groups, all 142 cable groups and 284 plug rings present, zero broken images, zero page overflow, and no footer. The attached source crop and the final full-rack capture were reviewed together; no P0/P1/P2 issues remain.

final patch-tools removal result: passed

## Peach Patch naming and menu information architecture

source capture: `artifacts/ui-qa/peach-patch-header-before-1280x720.png`

implementation captures: `artifacts/ui-qa/peach-patch-header-final-live-1280x720.png` and `artifacts/ui-qa/peach-patch-header-after-690x749.png`

The visible product brand, document metadata, Open Graph title, default patch filename, and rack accessibility label now use `Peach Patch`. The top-row commands follow the user's task model instead of the implementation sequence: `New / Open / Save` for files, `Undo / Redo` for history, and `Library / Fit` for the rack view. Three-pixel separators make those command families scannable without adding headings or another row. Audio start/stop is isolated at the far-right edge as the persistent global transport action; idle uses the existing signal green, and the running stop state uses the existing cable red.

The before/after captures were reviewed together at 1280 × 720. The final menu has semantic navigation and named action groups, no horizontal overflow, and keeps the full 684 px rack viewport. At 690 × 749 all eight commands remain simultaneously visible in the same order with zero navigation or page overflow. Library toggle and audio start/stop were exercised after the rearrangement; Mattix remained at 87 modules and 142 cables, and live audio reported 80 WASM modules with zero skipped modules.

final Peach Patch header result: passed

## Lucide audio transport icons

implementation captures: `artifacts/ui-qa/lucide-audio-idle-1280x720.png` and `artifacts/ui-qa/lucide-audio-running-1280x720.png`

The far-right global audio action now uses the `Play` and `Square` components from `lucide-react`, preserving an outlined, compact transport metaphor instead of a text glyph. Both idle and running states use an 11 × 11 px icon with the existing label, and the former inset bottom status line has been removed completely; computed `border-bottom-width` is 0 px and `box-shadow` is `none` in both states.

The interaction was exercised in the browser from `Start audio` to `Stop audio` and back. The icon changes from `lucide-play` to `lucide-square`, the button remains at the far-right edge, the restored Mattix rack remains visible, and a fresh page reports zero console errors.

final Lucide transport result: passed

## Rack fit control placement

implementation capture: `artifacts/ui-qa/fit-with-zoom-1280x720.png`

`Fit` has been removed from the top application menu and moved into the lower-right zoom control. It now follows zoom out, the current percentage, and zoom in as a fourth 26 × 26 px control inside the same 28 px-high bordered shell. The action uses Lucide `Maximize2`, shares the zoom controls' color, hover, active, disabled, and focus treatment, and keeps a one-pixel internal divider.

Browser verification found zero Fit controls in the header and exactly one in the zoom group. Zooming from 25% to 35% and then invoking Fit returned the complete Mattix patch to 26%, confirming the relocated control still executes the original fit behavior.

final rack fit placement result: passed

## Infinite Rack surface expansion

VCV source references are represented by the preserved Rack UI component assets under `assets/rack/`.

implementation capture: `artifacts/ui-qa/infinite-rack-negative-add-1280x720.png`

The fixed 5200 × 3200 rack artwork has been replaced by a dynamically bounded rail surface. Following Rack 2.6.6, the surface uses the module bounding box, grows it by 90% of the current viewport on every side, and expands it again to contain the current viewport. Bounds snap to 15 px HP columns and 380 px rows; the original rail asset continues to tile from the world origin, including at negative coordinates. Cable SVG bounds and viewBox now follow the same dynamic surface.

Module snapping and every add path now accept negative X and Y positions, so adding from the Library, quick-add menu, URL resolver, cable insertion, or Stroke command can extend the rack leftward and upward as well as rightward and downward. Movement remains collision-aware and row/HP snapped.

Browser verification panned roughly 25,000 Rack pixels left and 16,000 pixels up from Mattix, then added Bruer/SEQ1. The new module landed at `x -25545 / y -15960`; the rack expanded to `left -30240 / top -18240` while retaining repeated rails across the viewport. Undo and Fit restored the original 87-module patch, and the browser reported zero console errors.

final infinite Rack result: passed

## Registry-wide module geometry and broken-artwork pass

### Scope and source of truth

- Viewport: 1280 × 720 in the Codex in-app browser.
- Reference: official VCV Library ChordCV raster at
  `artifacts/ui-qa/chordcv-official-source.png`.
- Repaired implementation: local refreshed registry plus the current Peach
  Patch frontend at `artifacts/ui-qa/chordcv-repaired-local-registry-1280x720.png`.
- Combined comparison: official source on the left, repaired implementation on
  the right at `artifacts/ui-qa/chordcv-source-vs-repaired.png`.
- Safe fallback against the currently published registry:
  `artifacts/ui-qa/chordcv-final-remote-safe-fallback-1280x720.png`.

### Measured alignment

The browser-reported control centers exactly matched the extracted Rack source
coordinates on the 120 × 380 panel:

- Parameters: `(60,95)`, `(60,140)`, `(46,180)`, `(74,180)`.
- Inputs: `(20,95)`, `(20,140)`, `(18,180)`, `(102,180)`.
- Outputs: `(32,253)`, `(32,299)`, `(88,253)`, `(88,299)`, `(60,332)`.

The module raster loaded without broken images. The reference/implementation
comparison shows the same panel proportions, component styles, spacing, and
jack centers; only live parameter-state rendering can change a knob indicator.

### Cross-module guards

- Missing positions: official artwork remains canonical and arbitrary fallback
  widgets are not drawn over it.
- Collapsed, out-of-panel, or wrong-unit positions: source overlays are rejected.
- Missing official raster: the broken image is removed and the functional
  generated panel is used.
- Registry audit: all 3,009 screenshot URLs checked; 2,749 returned 200 and 260
  confirmed 404 entries were cleared. Transient failures are not cleared.

### Rubric

- Source fidelity: pass.
- Layout and sizing: pass.
- Typography and visual hierarchy: pass; inherited from the official raster.
- Interaction geometry: pass for refreshed source geometry.
- Failure states: pass for missing geometry, corrupt geometry, and broken raster.
- Browser console and image loading: pass in the verified ChordCV state.

No P0, P1, or P2 visual issues remain in the verified states.
