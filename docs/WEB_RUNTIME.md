# Peach Patch browser runtime

This document describes the runtime contract implemented by the Peach Patch browser application. Module discovery, source adaptation, Emscripten compilation, manifests, package publication, and catalog-wide provenance are owned by [Peach Patch Registry](https://github.com/miuchan/peach-patch-registry), not by this repository.

## Compatibility rule

A Rack Library entry is not automatically browser-compatible. A module is available only when the registry publishes a matching package with:

- the exact `Plugin/Model` key used by the patch;
- ordered parameter, input, output, light, and state metadata;
- a compatible `rack_web_*` WebAssembly artifact;
- a declared byte length and SHA-256 digest;
- licensing that the browser host accepts.

Peach Patch checks every module before importing a patch. If any instance is absent from the runtime catalog or is marked commercial, proprietary, paid, closed-source, or similarly restricted, the whole import is rejected and the current patch remains open. There is no partial-import mode.

Native `.vcvplugin` bundles cannot satisfy this contract directly. Their Mach-O, ELF, or PE libraries target a desktop OS and CPU, while the browser graph can instantiate only compatible WebAssembly.

## Registry flow

At startup the application fetches the schema-version-1 index from the registry's HTTPS URL with cache revalidation. `lib/peach-registry-client.ts` validates required package identity, artifact, parameter, and port fields, rejects duplicate keys, resolves relative artifact URLs, and repairs bounded geometry cases before replacing the in-memory runtime catalog.

An optional package-level `hidden: true` mirrors Rack's module-manifest semantics. Hidden packages stay in the in-memory runtime catalog so an existing `.vcv` can resolve its exact `Plugin/Model` key and verified WASM artifact, but they are excluded from the Library, quick-add, replacement choices, search results, and visible module counts.

The index is the runtime source of truth. It may contain a `manifestUrl`, but Peach Patch does not fetch or independently verify that manifest during startup. Artifact integrity comes from the size and SHA-256 values already present in the validated index.

When a user pastes a VCV Library URL:

1. `/api/library/resolve` accepts only an exact HTTPS `library.vcvrack.com/Plugin/Model` address with no credentials, port, query, or fragment.
2. The Worker extracts public title, description, screenshot, version, license, and source-link metadata.
3. The `Plugin/Model` key is looked up in the already loaded Peach Patch catalog.
4. A matching `hidden: true` package is rejected as non-addable even though exact-key patch hydration can still resolve it.
5. Only the registry definition can make the module runnable; Library metadata alone cannot.
6. The WASM download must use HTTPS and pass byte-length and SHA-256 verification before instantiation.

There is no bundled module catalog, local compiler fallback, or website request path that builds C++ source.

## Patch files

### Import

`parseVcvArchive()` accepts both:

- a plain JSON `.vcv` file;
- a zstd-compressed Rack archive whose tar payload contains `patch.json`.

The parser normalizes supported Rack 0.x structures, applies explicit legacy module migrations, validates the module/cable graph, then performs the atomic registry compatibility check. Import preserves Rack IDs, positions, parameters, model data, bypass state, cable colors, unknown fields, and the original rack origin where possible.

Public PatchStorage imports use the same parser after a constrained Worker fetch. The Worker accepts only `patchstorage.com` HTTPS page and upload URLs, revalidates redirects, requires a direct `.vcv` download, sanitizes the filename, and rejects declared or decoded bodies larger than 25 MB.

### Export

Peach Patch exports formatted Rack-compatible JSON and currently identifies the result as Rack `2.6.6`. Existing safe numeric IDs are reused; new IDs are allocated without collisions. Browser module IDs used by MIDI mappings and automation are translated back to Rack IDs during serialization.

Unknown top-level, module, cable, and model-data fields are spread back into the exported object. Browser-owned metadata uses `patchworkWeb*` keys. `.vcvm` module presets are separate JSON downloads and are accepted only for the same plugin/model target.

### Browser asset portability

Audio, image, Standard MIDI File, iNES ROM, and UTF-8 script assets are decoded or validated in the browser and stored as `Float32Array` records in IndexedDB. The patch stores only a `storageKey` plus asset metadata; it does not embed the asset bytes. Moving the `.vcv` to another browser profile therefore does not move its browser-local assets.

The global browser decode limit is 100 MB per selected file. Each registry module may impose a smaller sample, byte, duration, channel, or slot limit.

## WebAssembly ABI

Published manifests currently identify the portable module contract as ABI `0.3`. The worklet URL's cache-busting query is an application implementation detail and is not the package ABI.

### Core processing surface

Every active DSP instance exposes the core memory, lifecycle, port, parameter, channel, and processing functions used by `public/audio/rack-graph-processor.js`:

```text
memory
_initialize()
rack_web_input_count()
rack_web_output_count()
rack_web_input_buffer()
rack_web_output_buffer()
rack_web_max_channels()
rack_web_set_input_connected(id, connected)
rack_web_set_input_channels(id, channels)
rack_web_set_output_connected(id, connected)
rack_web_get_output_channels(id)
rack_web_set_param(id, value)
rack_web_set_polyphony(channels)
rack_web_set_state(id, value)
rack_web_seed(seed)
rack_web_process(frames, sampleRate)
rack_web_process_frame(frame, sampleRate)
```

The normal graph uses block processing. Sample-accurate automation and message-linked execution use the frame function. Buffers are planar `float32`, with a fixed 128-frame stride and up to the artifact's declared maximum channels per Rack port. Rack voltage conventions stay inside the graph; only a Core audio boundary maps the final stereo pair into Web Audio.

Artifacts run with the small deterministic WASI/environment surface in `lib/rack-wasm-host.ts` and the worklet. Unsupported filesystem, process, DNS, and socket operations return fixed errors instead of gaining ambient browser or operating-system access.

### Optional capability groups

Optional exports are enabled only when the registry metadata declares the matching runtime capability and the artifact exposes the corresponding capacity or buffers.

| Capability         | Runtime behavior                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Lights and visuals | Reads light and custom visual buffers for panels, scopes, meters, displays, and telemetry                          |
| JSON state         | Loads typed/nested Rack model data and snapshots runtime-owned state back into patch history                       |
| Assets             | Copies one or multiple browser-decoded asset slots into WASM before processing                                     |
| Capture            | Drains bounded audio or MIDI chunks without blocking the render thread, then downloads WAV or MID on stop          |
| Web MIDI           | Pushes bounded input messages and drains module output records or packets                                          |
| Bypass             | Applies registry-declared input/output routes without running module DSP                                           |
| Expanders          | Supports object snapshots, bidirectional message buffers, direct neighbors, and longer typed chains where declared |
| Host control       | Allows explicitly translated modules to request bounded rack viewport or cable presentation actions                |
| Trigger actions    | Sends browser panel gestures that are not ordinary continuous Rack parameters                                      |

The exact export names and metadata shapes are defined by `lib/web-plugin-registry.ts`, `lib/rack-wasm-host.ts`, and `public/audio/rack-graph-processor.js`. New capabilities must be added to the registry package contract and browser host together; UI code must not infer them from a module name.

## One AudioWorklet graph

`RackAudioEngine` creates one `AudioWorkletNode` for the complete patch. The main thread verifies and transfers the artifact bytes, state, assets, cables, and browser audio boundaries. The engine delegates message validation, capture assembly, and MIDI record decoding to `rack-audio-worklet-events.ts`, `rack-audio-capture.ts`, and `rack-audio-midi.ts`; malformed worklet payloads do not flow directly into application callbacks. The React lifecycle records the exact patch structure loaded by each asynchronous start and rebuilds if editing advanced while artifacts were loading. The worklet then:

- instantiates one WASM runtime for each active module instance;
- joins compatible physical expander neighbors declared by the registry;
- topologically orders the executable graph;
- processes forward edges from the current render block;
- processes cycle-closing feedback edges from the preceding block;
- tracks port channel counts, connection flags, bypass, lights, captures, MIDI, and telemetry;
- mixes only the first two supported Core audio-boundary inputs into the browser's stereo output.

Blank panels and Core audio-boundary panels are host objects rather than ordinary DSP instances.

### Cable stacks and polyphony

Every routable input and output supports a cable stack. Exact duplicate edges are rejected.

- An output stack fans one signal to multiple destinations.
- An input stack sums all incoming voltages per channel.
- A monophonic input is broadcast across the widest connected polyphonic source before summing.
- Channels missing from a connected polyphonic source contribute zero.

In the editor, dragging an occupied plug normally moves that cable. Releasing over empty rack disconnects it. <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>-drag starts an additional cable from the occupied port and preserves the existing stack.

### Updates and rebuilds

Parameter, typed state, JSON state, bypass, capture, monitor, and action changes use worklet messages. MIDI device choices update bounded main-thread input/output routing maps and the module's persisted data. Structural changes—modules, cables, geometry relevant to expanders, or browser asset identity—rebuild the live graph from the current `PatchDocument` while keeping that document as the editable source of truth.

Audio startup asks for Web MIDI permission during the audio-button gesture, but a missing or delayed permission result does not block graph startup. Authorized devices can attach later and hot-plug updates refresh the input/output list.

## Automation and capture

The bounded automation recorder captures module-control and mapped MIDI changes. Repeated changes to the same target within 16 ms are coalesced, the clip is capped at 10,000 events, and valid events are stored in `patchworkWebAutomation` inside the patch.

During playback the worklet schedules events against its audio frame clock and switches the graph to per-frame processing. A structural edit stops playback because recorded module targets can no longer be assumed stable. Completing or stopping playback creates an undo checkpoint for the resulting control values.

Capture-capable modules expose bounded queues. The worklet emits transferable chunks; the main thread creates PCM16 WAV parts or byte-preserving MIDI parts and starts a download when capture stops. Audio shutdown waits briefly for active captures to flush before closing the context.

## Panels and live telemetry

Registry geometry is normalized onto Rack's 15 px HP grid and 380 px row height. When source-derived positions are valid, the same coordinates drive visible controls, jack hit targets, and cable endpoints. Invalid or absent positions fall back to bounded accessible browser layouts; a missing screenshot falls back to a generated functional panel.

The selected-module inspector exposes every compatible non-button parameter, typed state, source link, MIDI-learn target, and live input/output scopes. `ModulePanel` composes ready-state controls through `module-panel-controls.tsx`, delegates registry-declared displays to `module-panel-visuals.tsx`, and keeps its port bank, keyboard/MIDI/meter derivations, parameter widget catalog, and bounded remote-audio loading in focused component or adapter modules. Custom module visuals are explicit registry contracts; they do not change the DSP ABI or become patch state unless their interaction writes a declared parameter/state/data field.

## Known limits

- Native desktop plugin binaries and arbitrary OS paths cannot run in the browser.
- A patch is usable only when every module is present in the current accepted registry catalog.
- Browser output is stereo. Additional Core device channels and native audio inputs are not currently routed.
- Registry metadata and artifacts require network access; the application is not an offline package manager.
- Browser-selected assets remain in one browser profile and are not embedded in `.vcv` exports.
- PatchStorage support is public-link import, not cloud save or account storage.
- Native custom drawing, host menus, filesystem behavior, threads, SIMD assumptions, and other desktop integrations may need explicit browser translations.
- Source-derived panel geometry can still fall back when a widget computes its layout dynamically.

## Building and publishing modules

Do not add C++, build caches, local WASM outputs, or a second catalog to this repository. Use the companion registry's [building guide](https://github.com/miuchan/peach-patch-registry/blob/main/docs/BUILDING.md), schema, provenance, verification, and release process. The browser application should change only when a capability requires a portable host-side contract or UI integration.

## Runtime verification

```bash
npm run check
```

The command checks formatting and lint rules, then runs type checking, a production build, and the coverage-gated suite. The suite includes registry boundaries, patch parsing and legacy migration, atomic compatibility checks, cable stacking, polyphonic graph behavior, state and asset validation, PatchStorage constraints, serialization, worklet messaging, capture, and rendered application boundaries.
