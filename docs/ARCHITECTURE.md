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

`app/main.tsx` mounts a React 19 client SPA and lazy-loads `app/rack-web-studio.tsx`. The studio container owns session orchestration:

- registry loading and module hydration;
- patch history, selection, viewport, dialogs, and status reporting;
- file, PatchStorage, preset, autosave, and browser-asset commands;
- audio and Web MIDI lifecycle;
- automation, capture, telemetry, and host-control coordination.

The container may compose boundaries, but low-level rendering and gesture algorithms stay in focused components or `lib/` modules. The principal visual boundaries are:

- `rack-studio-topbar.tsx` — file, history, Library, audio, and repository actions;
- `rack-studio-library.tsx` — registry search, exact VCV Library URL loading, add, insert, and replace affordances;
- `rack-studio-inspector.tsx` — live ports, parameter/state editing, MIDI learn, presets, and module actions;
- `rack-studio-module-layer.tsx` and `module-panel.tsx` — panel rendering and module controls;
- `rack-studio-cable-layer.tsx` and `rack-cable-plug.tsx` — cable geometry, hit targets, plugs, and signal state;
- `rack-studio-context-menus.tsx` — module and cable commands;
- `rack-studio-quick-add.tsx` — keyboard-first insertion at a rack position.

Canvas pan, touch pinch, marquee selection, and collision-aware group dragging live in `lib/use-rack-canvas-gestures.ts`. The hook receives patch/history callbacks and has no dependency on the registry or audio engine.

### Patch domain

`PatchDocument` in `lib/patch-types.ts` is the internal editable model. Transformations are immutable and are kept outside React:

- `patch-operations.ts` — connect/reconnect, stacking, insert, replace, duplicate, heal-delete, reset, randomize, movement, and viewport calculations;
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
- `rack-audio-controller.ts` translates engine callbacks into patch/history updates and downloads;
- `rack-audio-patch-sync.ts` incrementally synchronizes params, state, JSON data, and bypass state.

### Worker API

`worker/index.ts` routes only known `/api/*` requests and otherwise falls back to SPA assets.

| Route | Responsibility |
| --- | --- |
| `/api/library/resolve` | Accept one exact `https://library.vcvrack.com/Plugin/Model` URL and return normalized public metadata |
| `/api/patchstorage` | Resolve a public PatchStorage page to its hosted `.vcv`, validate redirects, and enforce the 25 MB limit |
| `/api/rack-component` | Serve the allowlisted Rack component SVGs used by browser controls |
| `/api/rack-rail` | Serve the immutable local Rack rail SVG |

The Worker does not build modules, proxy arbitrary URLs, store patches, or act as the registry.

## State ownership

| State | Owner | Persistence |
| --- | --- | --- |
| Modules, cables, Rack data, automation | `PatchDocument` history | `.vcv` export and validated `localStorage` autosave |
| Undo/redo | `usePatchHistory` | Session only; capped history |
| Decoded module assets | `sample-store.ts` | IndexedDB, referenced from patch metadata by storage key |
| Selection, menus, viewport, gestures | React session | Never serialized |
| Registry catalog | Runtime registry | Refetched; not persisted as patch state |
| WASM instances and signal buffers | AudioWorklet | Live projection only |
| Web MIDI devices and routes | Audio engine plus module data | Device enumeration is session state; selected names may round-trip in module data |

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
4. `public/audio/rack-graph-processor.js` instantiates the modules, schedules the graph, processes cable stacks and feedback, and emits telemetry, capture data, MIDI, automation, and state snapshots.
5. Parameter/state/bypass changes use messages; structural changes rebuild the live projection from `PatchDocument`.

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
- `npm test` runs type checking, a production Cloudflare/Vite build, and the coverage-gated Node suite. The current gate is 95% lines, 95% functions, and 80% branches across covered `lib/` and `server/` TypeScript.
- `npm run lint` is a separate required check.

When adding a feature, first choose its state owner and trust boundary. Prefer a pure operation when behavior can be tested without React, an adapter when data crosses browser/network/runtime boundaries, and a component when the concern is rendering or direct interaction.
