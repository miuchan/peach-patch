# Patchwork Web workflow audit

> **Archived audit:** This report records the July 18, 2026 browser build under the former `Patchwork Web` name. It is preserved as source evidence for the screenshots and recommendations below, not as a description of the current Peach Patch interface. Several findings were implemented or superseded, including compact chrome, module focus, inspector scopes, smart insertion/replacement, heal-delete, Perform mode, direct cable dragging, universal cable stacks, and atomic registry compatibility checks. See [`../../docs/UX_COMPARISON.md`](../../docs/UX_COMPARISON.md) for current behavior.

## Scope

Combined UX and screenshot-based accessibility audit of opening `Mattix.vcv`, starting its audio graph, loading an official VCV Library URL, and undoing/redoing that change. VCV Rack 2 Free was inspected locally as a visual and navigation reference. Bitwig Studio was not installed on this Mac, so Bitwig comparisons below are limited to its official Grid documentation and are not presented as hands-on evidence.

## User goal

Open an existing Rack patch without setup, understand whether every module and cable is running, add an official free module directly from its Library URL, and safely reverse the change.

## Steps

1. **Open and fit Mattix — functional, visually strained.** The `.vcv` picker produced 87 modules and every panel reported `WASM READY`. At the fitted 55% view, the whole patch is visible, but labels, sliders, ports, and cable endpoints overlap heavily. Evidence: `01-web-mattix-baseline.png`.
2. **Start audio — healthy.** The persistent header reports 80 WASM modules, 142 cables, 15 feedback edges, and 0 skipped modules. This is stronger reassurance than a silent success state, but the long sentence competes with the toolbar at this viewport.
3. **Load an official URL — healthy.** Pasting `https://library.vcvrack.com/Venom/BenjolinOsc` rebuilt the graph to 81 WASM modules while preserving all 142 cables and 0 skipped modules. Evidence: `03-web-official-url-loaded.png`.
4. **Undo and redo — healthy.** Undo returned to 87 panels and 80 WASM modules; Redo restored 88 panels and 81 WASM modules; a final Undo restored the original patch.
5. **Compare the same patch in VCV Rack — strong visual identity, dense navigation.** VCV's panel artwork and control hierarchy remain more recognizable at overview scale, but the patch is still cable-dense and requires pan/zoom plus context-dependent commands. Evidence: `02-vcv-mattix-baseline.png`.

## Strengths

- One URL field replaces VCV's account/library install/update/restart path for compatible open-source modules.
- Graph-level telemetry names partial failures instead of leaving the user to infer them from silence.
- Undo and Redo are visible, stateful toolbar actions.
- The app preserves the original 87-module, 142-cable Mattix graph and exposes all modules semantically to assistive technology.

## UX risks

- The fitted overview is not an editing view: narrow modules render every HTML control and label, producing illegible collisions.
- Cable crossings have no isolate/highlight mode, making endpoint tracing difficult in Mattix.
- Adding a module succeeds, but its new location is not brought into view or announced spatially.
- The registry and engine status compete for horizontal space at desktop width.

## Accessibility risks

- Several visible labels and secondary status strings are too small at the fitted zoom; screenshot evidence cannot establish compliant contrast or effective text size.
- Many controls shrink below a comfortable pointer target in the overview.
- State changes are visible in the header, but a screenshot cannot verify live-region announcements.
- Keyboard focus order, screen-reader output, motion preferences, and zoom/reflow still require dedicated testing.

## Priority recommendations

1. Add a one-action focus command that centers the selected module at an editable zoom while preserving the whole-patch Fit command.
2. Add cable isolation for the selected module and dim unrelated cables.
3. Bring newly loaded modules into view and announce their location.
4. Add a locked performance mode, contextual module help, and per-port signal scopes, following the useful parts of Bitwig Grid without giving up Rack patch compatibility.
5. Later add smart insertion/replacement that preserves compatible cords and parameters.

## Evidence limits

- Bitwig Studio was unavailable locally. Its module palette, locked mode, smart insertion/replacement, interactive help, and per-port scopes were checked only against Bitwig's official Grid user guide.
- Screenshots cannot validate audio quality, timing, complete keyboard support, or WCAG conformance. DSP and graph behavior are covered separately by automated runtime tests.

## Implemented from this audit

- Added a selected-module **Focus** action and title-bar double-click shortcut. It centers the module and raises the patch from overview scale to an editable zoom; `04-web-selected-module-focus.png` records the first pass.
- Reflowed modules with more than five inputs or outputs into a compact two-column port grid. This removes the Tides and SEQ3 port overflow seen in the first focus capture; the accepted result is `05-web-focus-compact-ports.png`.
