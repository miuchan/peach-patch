# Peach Patch

[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

Peach Patch is a browser-native modular synthesizer and Rack-compatible patch runtime. Open Rack 2 `.vcv` patches, build a patch from a verified module catalog, run the graph through Web Audio, and save it back to a Rack-compatible file—without installing a native audio application.

Module metadata and immutable WebAssembly artifacts are loaded from the [Peach Patch Registry](https://github.com/miuchan/peach-patch-registry). This repository contains the browser application and runtime; source discovery, WebAssembly builds, artifact publication, and registry governance live in the companion registry repository.

> Peach Patch is an independent project. It is not made by, affiliated with, or endorsed by VCV. VCV Rack is a trademark of VCV.

## Highlights

- **Rack patch workflow.** Open JSON or compressed Rack 2 `.vcv` files, import a public PatchStorage link, save in place where the browser supports it, or download a Rack-compatible JSON patch.
- **Signal-flow editor.** Work on an infinite canvas with pan, zoom, fit-to-patch, multi-select, copy/paste, undo/redo, quick add, compatible module replacement, cable insertion, and heal-delete.
- **Rack-style patching.** Drag from empty jacks to create cables, drag an existing plug to reconnect or disconnect it, and use <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>-drag to add another cable to an occupied input or output. Input stacks sum voltages; output stacks fan signals out.
- **Verified browser DSP.** Load the catalog from the Peach Patch Registry, validate its schema and package metadata, and verify every downloaded WASM artifact by byte length and SHA-256 before instantiation.
- **One live graph.** Run compatible module DSP, polyphonic cables, feedback edges, bypass routes, and supported expanders inside a patch-wide AudioWorklet graph.
- **Performance tools.** Use Web MIDI, Core MIDI/CV modules, next-CC MIDI learn, `.vcvm` presets, parameter automation, live port scopes, and module-provided WAV or MIDI capture.
- **Browser-local assets.** Decode supported audio, image, MIDI, ROM, and script assets locally, then keep their samples in IndexedDB and patch autosave state in `localStorage`.
- **Localized host interface.** Use Peach Patch in English or Simplified Chinese, including dialogs, status messages, controls, and accessibility labels.

## Compatibility boundary

Peach Patch is registry-only at runtime. Native `.vcvplugin` packages contain platform-specific dynamic libraries and cannot execute directly as browser WebAssembly. A module needs a compatible Web ABI artifact published in the [Peach Patch Registry](https://github.com/miuchan/peach-patch-registry); source discovery, builds, publication, and artifact governance belong in that companion repository.

Patch import is intentionally atomic. Before replacing the current patch, Peach Patch checks that every module is available in the verified browser catalog and is not marked with a commercial or proprietary license. If any instance is blocked, the current patch stays open and the unavailable module list is shown. Import compatibility therefore depends on the current registry, and browser rendering or host integrations can still differ from native Rack even when the DSP model is available.

## How it works

```text
.vcv file / PatchStorage link        VCV Library / PatchStorage
              │                              │
              ▼                              ▼
        React patch studio ◄────── Cloudflare Worker APIs
              │
              ├── normalized patch + undo history + autosave
              │
              └── Peach Patch Registry index
                              │
                              ▼
                   size/SHA-256 verified WASM
                              │
                              ▼
                  patch-wide AudioWorklet graph
                              │
                              ▼
                    Web Audio and Web MIDI
```

Editable patch history is the source of truth. The AudioWorklet is a live projection that is incrementally synchronized or rebuilt after structural edits; transient selection, viewport, menus, and gestures are never serialized into the patch.

## Quick start

### Requirements

- Node.js 22.22 or newer
- A modern browser with WebAssembly and Web Audio support

### Run locally

```bash
git clone https://github.com/miuchan/peach-patch.git
cd peach-patch
npm install
npm run dev
```

Open the local URL printed by Vite, then choose a patch or create one from the Library. Audio starts only after the browser's user-gesture policy allows it.

### Create or open a patch

1. Wait for the Library to finish loading the registry index.
2. Choose **New**, **Open** for a local `.vcv`, or **Link** for a public PatchStorage page.
3. Add modules from Library search or paste an exact `https://library.vcvrack.com/Plugin/Model` URL.
4. Drag between jacks to patch the graph, then press the play button to start browser audio.
5. Choose **Save** to write through a supported browser file handle or download a JSON `.vcv` fallback.

PatchStorage imports use the same-origin `/api/patchstorage` Worker route, accept public HTTPS PatchStorage pages only, and enforce a 25 MB patch limit.

### Choose the interface language

Use the **Language** selector in the top bar to switch between English and Simplified Chinese. The change applies immediately and is saved for future visits. On a first visit, Peach Patch uses the first supported language in the browser preferences and falls back to English when neither language is present. If browser storage is unavailable, the selected language still applies for the current session.

Localization covers the Peach Patch host interface. Module names, panel artwork, and text authored by Rack plugins remain in their upstream form so the browser representation stays consistent with the original module.

### Production build and preview

```bash
npm run build
npm run start
```

The application currently loads the `main` branch index from [miuchan/peach-patch-registry](https://github.com/miuchan/peach-patch-registry). A mirror or fork can pass a different HTTPS index URL through the registry client integration.

## Development

The application uses React 19, TypeScript, Vite, the Cloudflare Vite plugin, a small Worker API layer, AudioWorklet, and standalone WebAssembly module artifacts. Run the same quality gate used by CI before opening a pull request:

```bash
npm run check
```

`npm run check` verifies formatting and lint rules, then runs `npm test`. The test command performs the type check, production build, and coverage-gated Node suite. The gate requires at least 95% line coverage, 95% function coverage, and 80% branch coverage across the core `lib/` and `server/` TypeScript executed by the suite. Run `npm run test:unit` for a fast test pass or `npm run test:coverage` to inspect the coverage report directly.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, repository ownership boundaries, validation principles, and the pull-request checklist.

Browser-facing behavior stays covered at the boundary that owns it. The AudioWorklet graph uses its dedicated VM behavior tests, while build and rendered-output tests protect browser integration; those adapters are not folded into the core TypeScript percentage.

### Project layout

| Directory       | Purpose                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `app/`          | React composition, page hooks, dialogs, patch editor, Library, and browser UI |
| `lib/`          | Pure patch domains, registry boundaries, audio coordination, and adapters     |
| `public/audio/` | AudioWorklet processors used by the browser runtime                           |
| `assets/rack/`  | Small Rack-derived UI assets required locally by the application              |
| `server/`       | Validated API handlers for Library metadata, PatchStorage, and Rack UI assets |
| `worker/`       | Cloudflare Worker router and SPA asset fallback                               |
| `build/`        | Vite integration used by the hosting environment                              |
| `tests/`        | Type, registry, patch, runtime, and rendered-output tests                     |
| `docs/`         | Architecture, WebAssembly runtime, and UX documentation                       |

Build inputs and published WebAssembly artifacts are intentionally maintained in the companion [peach-patch-registry](https://github.com/miuchan/peach-patch-registry), rather than duplicated in this application repository.

## Registry integrity

The runtime treats the registry index as the source of truth for available modules. It:

1. requires an HTTPS registry index and validates its schema and package metadata;
2. rejects malformed or duplicate package keys and normalizes trusted module geometry at the boundary;
3. resolves artifact URLs against the index and requires HTTPS for WASM downloads;
4. verifies each artifact's declared byte length and SHA-256 digest before instantiation.

This keeps application code, module metadata, and generated binaries independently reviewable while preventing a truncated or unexpected artifact from silently entering the audio graph.

## Privacy and browser limits

Patch editing and browser-selected asset processing are local to the browser. Autosave uses `localStorage`, while decoded module assets use IndexedDB. The application still needs network access for the registry index, WASM artifacts, and some public Library metadata or panel images. Opening a PatchStorage link asks the deployment's Worker to fetch that public page and its `.vcv` download. Browser permissions still apply to Web MIDI, file access, and audio playback.

Support depends on both the browser and the published module ABI. Native filesystem access, native threads, arbitrary OS paths, and platform-specific plugin binaries are not portable to this runtime.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) defines ownership, trust boundaries, state, Worker routes, and data flow.
- [Browser Runtime](docs/WEB_RUNTIME.md) documents patch compatibility, registry verification, the WASM/AudioWorklet contract, assets, MIDI, capture, and current limits.
- [Interaction Model](docs/UX_COMPARISON.md) covers navigation, cable and module gestures, shortcuts, reference comparisons, and remaining UX gaps.
- [Design QA](design-qa.md) is the dated visual evidence log; archived screenshots and numeric results are revision-specific rather than current registry guarantees.

## Contributing

Issues and pull requests are welcome. Before contributing:

- read the architecture and runtime contracts above before choosing an ownership boundary;
- run the checks above and describe any browser-specific verification;
- send module source/build or artifact-publication changes to the [registry repository](https://github.com/miuchan/peach-patch-registry).

## License and attribution

Peach Patch is licensed under [GPL-3.0-or-later](LICENSE). The locally stored Rack UI assets in `assets/rack/` retain their applicable GPL licensing. Module translations and registry artifacts retain the licenses of their respective upstream projects; consult the registry metadata and upstream repositories before redistribution.

Official plugin screenshots are referenced from their public Library URLs at runtime and are not redistributed here.
