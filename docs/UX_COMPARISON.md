# Mattix patch usability comparison

Validated on 2026-07-19 with the same 87-module, 142-cable `Mattix.vcv` graph.

![VCV Rack and Patchwork Web fitted overviews](../artifacts/mattix-vcv-patchwork-comparison-2026-07-19.jpg)

## VCV Rack 2.6.6 live comparison

The original patch was opened in VCV Rack Free 2.6.6 and in Patchwork Web. Patchwork resolved all 87 module instances, preserved all 142 cables, reported zero missing modules, and ran the complete graph in the browser AudioWorklet.

VCV Rack remains the visual-fidelity reference: its official panels, control geometry, cable plugs, and rack rows are exact. Its fitted overview also uses the available empty space well. On this patch, however, finding one of several repeated `SEQ3` modules still requires scanning the rack, and unrelated cables remain equally prominent while editing one signal path.

Patchwork now automatically collapses the Library for large/imported/autosaved patches, centers the fitted graph, searches only the current patch, focuses a result at an editable zoom, and dims every cable unrelated to the selected module. Since the captured comparison, every interactive Mattix panel has also gained its official source-derived parameter and jack coordinates over the Library panel asset; web hit targets remain deliberately larger than Rack's. Navigation still requires fewer gestures on this dense patch.

## Bitwig Studio reference

Bitwig Studio was not installed on the test Mac, so no Bitwig interaction is presented as a live test. The comparison uses Bitwig's current official documentation for [Welcome to The Grid](https://www.bitwig.com/userguide/latest/welcome_to_the_grid/) and [Grid Modules](https://www.bitwig.com/userguide/latest/grid_modules/).

The Grid documents four workflows worth carrying into a browser rack:

- hide the module palette and lock structural editing for performance;
- insert a module directly on a port/cable;
- heal a serial signal path when a module is deleted;
- show selected-module help and live input/output scopes in the inspector.

Patchwork implements browser versions of all four:

- `Perform` keeps parameters and audio live while structural and destructive edits are locked;
- a selected cable turns compatible Library cards into `INSERT` actions;
- `Heal delete` reconnects an unambiguous one-in/one-out path and refuses fan-in/fan-out;
- inspector-driven Library replacement keeps exact-name parameters and all port-compatible cables;
- Library cards can also be dragged directly onto a highlighted target panel to invoke the same replacement;
- right-clicking empty rack space opens a searchable Quick Add palette at that world position;
- right-clicking a module opens a compact Rack-style action menu, while the inspector exposes the same duplicate, initialize, randomize, disconnect, and replace operations;
- cables can be created by direct port dragging as well as the existing click-to-patch flow, with occupied inputs replaced atomically;
- a cable context menu exposes recoloring, insertion, and deletion, while the persistent footer keeps ready/total WASM and cable counts visible;
- cable endpoints follow official source-derived jack centers when available, with the one- or two-column rendered geometry retained as the fallback;
- matching Rack `.vcvm` presets can be saved or loaded from both the inspector and module context menu without replacing panel identity or cables;
- a compact record/play pair captures panel gestures and MIDI-mapped changes into the patch for performance playback without unlocking structure;
- empty-space mouse/touch panning, pointer-anchored trackpad zoom, center-anchored zoom buttons, and anchored two-finger pinch work without changing modules;
- Shift-drag marquee selection intersects panels correctly at any pan/zoom and adds them to the current module selection for group edits;
- the selected module inspector shows source metadata plus rate-limited live voltage peaks and Canvas waveforms for every port.

## Remaining fidelity work

Mattix no longer depends on generic widget placement: its 16 source-built models, Core Audio boundary, and Spring Reverb adapter all use their checked-out Rack coordinates, and Blank has no controls. Source-built modules added later receive the same extraction whenever their widget constructor uses statically recoverable `Vec` or `mm2px(Vec)` calls. The remaining visual gap is dynamic or custom-drawn widget geometry, animated native knobs/lights, and arbitrary SVG component skins; those fall back to accessible browser controls while the inspector keeps the exact official panel asset available for reference. This is separate from DSP compatibility, which remains covered by executable WASM and patch-graph tests.
