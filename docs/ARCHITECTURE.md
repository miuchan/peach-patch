# Peach Patch architecture

Peach Patch is split into a browser studio, pure patch-domain code, a narrow Cloudflare Worker boundary, and one AudioWorklet-owned signal graph. This repository is a registry consumer: source discovery, C++ adaptation, Emscripten builds, package manifests, and artifact publication belong to [Peach Patch Registry](https://github.com/miuchan/peach-patch-registry).

## System map

```text
VCV Library ───────┐
PatchStorage ──────┼──► Worker API handlers ──► browser studio
Rack UI assets ────┘                              │
                                                  ├──► patch history + local storage
Peach Patch Registry ──► schema validation ───────┤
                              │                   ├──► IndexedDB module assets
                              └──► verified WASM ─┤
                                                  ▼
                                      one AudioWorklet graph
                                                  │
                                                  ▼
                                         Web Audio / Web MIDI
```

The dependency direction is one-way: UI orchestration calls domain operations and adapters; adapters project trusted data into the AudioWorklet. The worklet never becomes a second editable or persisted store.

## Application boundaries

### Entry point and studio container

`app/main.tsx` mounts a React 19 client SPA and lazy-loads `app/rack-web-studio.tsx`. The studio container composes session concerns, while focused hooks own lifecycle-heavy behavior:

- `app/hooks/use-peach-registry.ts` owns registry loading, cancellation, catalog replacement, and trusted module hydration;
- `app/hooks/use-rack-automation.ts` owns bounded recording/playback state, timers, worklet handoff, and history checkpoints;
- `app/hooks/use-rack-audio-runtime.ts` owns audio start/stop, capture startup, incremental synchronization, generation-safe graph rebuilds, and teardown;
- `app/hooks/use-rack-stroke-controls.ts` owns Stroke command routing, hovered-control hotkeys, repeat/CV key release, and global editor shortcuts;
- patch history, selection, viewport, dialogs, and status reporting;
- file, PatchStorage, preset, autosave, and browser-asset commands;
- audio, Web MIDI, capture, telemetry, and host-control coordination.

The container may compose boundaries, but low-level rendering and gesture algorithms stay in focused components or `lib/` modules. The principal visual boundaries are:

- `rack-studio-topbar.tsx` — file, history, Library, audio, and repository actions;
- `rack-studio-library.tsx` — registry search, exact VCV Library URL loading, add, insert, and replace affordances;
- `rack-studio-inspector.tsx` — live ports, parameter/state editing, MIDI learn, presets, and module actions;
- `rack-studio-module-layer.tsx` and `module-panel.tsx` — panel rendering and module controls;
- `module-panel-controls.tsx` — ready-state parameters, selectors, switches, module editors, Stroke mappings, MIDI selection, and asset-button timing;
- `module-panel-ports.tsx` — reusable input/output jack rendering and direct cable drag/drop interactions;
- `module-panel-visuals.tsx` — explicit dispatch for registry-declared custom displays and their action boundaries;
- `rack-studio-dialogs.tsx` — PatchStorage input and atomic patch-open failure dialogs;
- `rack-studio-cable-layer.tsx` and `rack-cable-plug.tsx` — cable geometry, hit targets, plugs, and signal state;
- `rack-studio-context-menus.tsx` — module and cable commands;
- `rack-studio-quick-add.tsx` — keyboard-first insertion at a rack position.

Canvas pan, touch pinch, marquee selection, and collision-aware group dragging live in `lib/use-rack-canvas-gestures.ts`. The hook receives patch/history callbacks and has no dependency on the registry or audio engine.

### Internationalization

`app/i18n/` owns localization for the Peach Patch host interface. `initializeI18n()` resolves the initial locale before React mounts, then `I18nProvider` exposes the active locale, translation, and number-formatting functions. Resolution prefers the validated `peach-patch.locale.v1` value from `localStorage`, then the first supported entry in `navigator.languages`, and finally English. An explicit selection is persisted when storage is available. Every change also synchronizes the document language, direction, title, description, and Open Graph locale metadata.

The boundary is split by responsibility:

- `core.ts` owns supported locale identifiers, normalization, fallback resolution, plural selection, interpolation, and locale-aware number formatting;
- `catalogs.ts` owns the statically imported English and Simplified Chinese catalogs. The English keys form the `MessageKey` type, and every other catalog must have exact key and placeholder parity;
- `provider.tsx` owns browser detection, preference persistence, document metadata, and the React context consumed by components;
- `user-message.ts` defines stable `message` and `issue` descriptors for asynchronous status, callback, and failure paths.

Components translate browser-owned copy at render time with `useI18n()`. Long-lived state stores a message key and structured values rather than a translated string; `formatUserMessage()` resolves it only at the final display boundary. This lets already-visible status and error fallbacks update immediately when the locale changes and prevents native exception text from becoming untranslated UI. Locale state never enters `PatchDocument`, AudioWorklet messages, `.vcv` serialization, or autosave. Plugin names, module-authored panel text, and user content remain source data rather than host translations.

### Patch domain

`PatchDocument` in `lib/patch-types.ts` is the internal editable model. Transformations are immutable and are kept outside React. `lib/patch-operations.ts` is the stable import facade; implementation details are split by responsibility:

- `patch-cable-topology.ts` — connect, reconnect, disconnect, cable insertion, stacking, and heal-delete topology;
- `patch-module-editing.ts` — module duplication and compatible replacement;
- `patch-module-state.ts` — parameter, typed state, model data, preset, reset, and randomization transforms;
- `rack-patch-layout.ts` — rack-grid snapping, overlap-safe movement, selection geometry, ports, and viewport calculations;
- `vcv-patch.ts`, `vcv-legacy-migrations.ts`, and `vcv-patch-import.ts` — archive parsing, legacy repair, validation, and conversion;
- `vcv-patch-serialize.ts` — Rack-compatible JSON export and ID translation;
- `patch-state.ts` and `patch-hydrate.ts` — typed Rack state and trusted registry hydration;
- `patch-autosave.ts` and `patch-automation.ts` — validated browser persistence boundaries;
- `rack-cable-layout.ts` — derived curves, plugs, draft geometry, stacking order, and signal fan-out.

These modules must not import React or browser audio code. Unknown Rack fields are retained under the `rack` boundary so a supported import/export round trip does not discard data the browser does not interpret.

### Registry and browser adapters

The browser downloads the mutable registry index directly from HTTPS. `lib/peach-registry-client.ts` validates schema version 1, required package identity/artifact fields, basic parameter and port data, and duplicate keys. It also resolves URLs and normalizes bounded geometry cases before replacing the in-memory catalog in `runtime-plugin-registry.ts`.

The runtime index is the browser source of truth. `manifestUrl` may be retained as package metadata, but the application does not fetch an independent manifest during module startup. `fetchVerifiedWasm()` resolves the artifact URL, requires HTTPS, then checks declared byte length and SHA-256 before the bytes can reach WebAssembly.

Other browser adapters remain isolated:

- `browser-asset-loader.ts` validates and normalizes audio, image, MIDI, ROM, and script files;
- `sample-store.ts` owns IndexedDB storage and validates records on read;
- `rack-wasm-host.ts` exposes the deterministic, restricted WASI surface used outside the graph worklet;
- `rack-audio-engine.ts` coordinates `AudioContext`, one worklet node, verified artifacts, assets, and MIDI routes;
- `rack-audio-worklet-events.ts` validates untrusted worklet messages before they reach engine callbacks;
- `rack-audio-capture.ts` appends bounded capture chunks and creates the final WAV or MIDI blob;
- `rack-audio-midi.ts` decodes bounded module MIDI output records;
- `rack-audio-runtime-state.ts` decides whether the structure actually loaded by an asynchronous engine start must be rebuilt;
- `rack-audio-controller.ts` translates validated engine callbacks into patch/history updates and downloads;
- `rack-audio-patch-sync.ts` incrementally synchronizes params, state, JSON data, and bypass state.

Module-panel support also keeps non-rendering behavior out of the large visual component. `rack-module-panel-data.ts` owns pure keyboard, MIDI-log, and meter derivations; `rack-module-remote-audio.ts` owns bounded remote-audio and playlist loading; `rack-param-visual-data.ts` owns the Rack widget catalog plus parameter geometry, frame, angle, and asset resolution. These helpers are tested without rendering the full panel.

### Worker API

`worker/index.ts` routes only known `/api/*` requests and otherwise falls back to SPA assets.

| Route                  | Responsibility                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `/api/library/resolve` | Accept one exact `https://library.vcvrack.com/Plugin/Model` URL and return normalized public metadata    |
| `/api/patchstorage`    | Resolve a public PatchStorage page to its hosted `.vcv`, validate redirects, and enforce the 25 MB limit |
| `/api/rack-component`  | Serve the allowlisted Rack component SVGs used by browser controls                                       |
| `/api/rack-rail`       | Serve the immutable local Rack rail SVG                                                                  |

The Worker does not build modules, proxy arbitrary URLs, store patches, or act as the registry.

## State ownership

| State                                  | Owner                         | Persistence                                                                       |
| -------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| Modules, cables, Rack data, automation | `PatchDocument` history       | `.vcv` export and validated `localStorage` autosave                               |
| Undo/redo                              | `usePatchHistory`             | Session only; capped history                                                      |
| Decoded module assets                  | `sample-store.ts`             | IndexedDB, referenced from patch metadata by storage key                          |
| Selection, menus, viewport, gestures   | React session                 | Never serialized                                                                  |
| Registry catalog                       | Runtime registry              | Refetched; not persisted as patch state                                           |
| WASM instances and signal buffers      | AudioWorklet                  | Live projection only                                                              |
| Web MIDI devices and routes            | Audio engine plus module data | Device enumeration is session state; selected names may round-trip in module data |
| Interface locale                       | `I18nProvider`                | Validated `localStorage` preference; never patch state                            |

Structural edits use `commit()` and become undoable immediately. Continuous gestures may use `mutate()` while moving, then create one history checkpoint when the gesture completes. Side effects such as worklet messages, file downloads, or IndexedDB writes happen after the domain decision.

## Main data flows

### Patch import

1. `parseVcvArchive()` accepts plain JSON or a zstd-compressed Rack archive containing `patch.json`.
2. Legacy data is normalized and structurally validated.
3. `assertVcvPatchModulesLoadable()` checks every module against the current registry and blocks the whole import when a module is unavailable or commercially licensed.
4. `importVcvPatch()` converts Rack IDs, positions, params, data, bypass state, and cables into `PatchDocument`.
5. Registry definitions hydrate geometry and runtime metadata before the document replaces history.

The atomic check prevents a failed import from silently replacing the user's current patch with a partial graph.

### Audio startup and synchronization

1. The main thread selects active registry-backed modules and loads browser assets from IndexedDB.
2. WASM is fetched and verified once per artifact URL, then copied per module instance.
3. `RackAudioEngine` transfers the graph, artifacts, state, assets, cables, and browser audio boundaries to one `AudioWorkletNode`.
4. Incoming worklet messages are parsed by `rack-audio-worklet-events.ts`; capture and MIDI payloads then pass through their focused reducers/decoders.
5. `public/audio/rack-graph-processor.js` instantiates the modules, schedules the graph, processes cable stacks and feedback, and emits telemetry, capture data, MIDI, automation, and state snapshots.
6. Parameter/state/bypass changes use messages; structural changes rebuild the live projection from `PatchDocument`.

Stopping audio first asks the worklet to flush active captures, then disconnects the node and closes the `AudioContext`.

## External-data rules

Treat every network response, file, saved patch, autosave record, and IndexedDB record as untrusted:

- parse and normalize at the boundary before constructing internal types;
- require finite numbers and bounded IDs, sizes, channel counts, and paths;
- restrict server-side URL fetching to explicit HTTPS hosts and shapes;
- keep verification in the owning adapter instead of repeating partial checks in UI components;
- preserve known legacy omissions only through explicit migrations;
- reject invalid or unsupported data without mutating the current patch.

## Testing strategy

- Pure domain, migration, geometry, state, registry, URL, storage, and serialization behavior runs under Node's test runner.
- AudioWorklet behavior runs in a VM harness and covers graph scheduling, cable summing, polyphony, feedback, expanders, MIDI, capture, automation, and telemetry.
- Render-boundary tests protect the SPA/component/service wiring without treating implementation text snapshots as runtime evidence.
- Internationalization tests enforce locale resolution, catalog and placeholder parity, plural and number formatting, and render-time retranslation of stable message descriptors.
- `npm test` runs type checking, a production Cloudflare/Vite build, and the coverage-gated Node suite. The current gate is 95% lines, 95% functions, and 80% branches across covered `lib/` and `server/` TypeScript.
- `npm run check` is the contributor and CI entry point: formatting, linting, then the complete test command above.

When adding a feature, first choose its state owner and trust boundary. Prefer a pure operation when behavior can be tested without React, an adapter when data crosses browser/network/runtime boundaries, and a component when the concern is rendering or direct interaction.
