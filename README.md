# Peach Patch

[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

Peach Patch is a browser-native modular synthesizer and Rack patch runtime. Open `.vcv` patches, place and connect modules, play them through Web Audio, and save the result back to a Rack-compatible patch file—without installing a native audio application.

Module metadata and immutable WebAssembly artifacts are loaded from the [Peach Patch Registry](https://github.com/miuchan/peach-patch-registry). This repository contains the browser application and runtime; source discovery, WebAssembly builds, artifact publication, and registry governance live in the companion registry repository.

> Peach Patch is an independent project. It is not made by, affiliated with, or endorsed by VCV. VCV Rack is a trademark of VCV.

## What you can do

- Import and export Rack-compatible `.vcv` patches, including compressed Rack 2 patches and public PatchStorage links.
- Build and edit patches on an infinite canvas with pan, zoom, multi-select, copy/paste, undo/redo, cable replacement, module replacement, and signal-flow helpers.
- Load modules from the registry with verified metadata, manifest, byte length, and SHA-256 checks.
- Run compatible module DSP as WebAssembly inside a patch-wide AudioWorklet graph.
- Use browser-local audio files, Web MIDI, MIDI-CV utilities, automation, presets, autosave, and live signal telemetry where supported by the module and browser.
- Keep patch files and selected audio assets in the browser; the runtime does not need to upload a patch to play it locally.

## How it works

```text
                        immutable metadata + WASM
Browser UI  ───────────► Peach Patch Registry
    │                              │
    │ local .vcv patch             ▼
    └────────────────────► verified WASM modules
                                   │
                                   ▼
                         AudioWorklet signal graph
                                   │
                                   ▼
                            Web Audio output
```

The application is registry-only at runtime. Native `.vcvplugin` packages and their platform-specific dynamic libraries cannot execute directly in browser WebAssembly. A plugin must therefore have a compatible Web ABI build published in the registry; closed-source or otherwise unsupported plugins require a web build from their author.

## Quick start

### Requirements

- Node.js 22.13 or newer
- A modern browser with WebAssembly and Web Audio support

### Run locally

```bash
git clone https://github.com/miuchan/peach-patch.git
cd peach-patch
npm install
npm run dev
```

Open the local URL printed by Vite, then choose a patch or create one from the Library. Audio starts only after the browser's user-gesture policy allows it.

### Production build and preview

```bash
npm run build
npm run start
```

The registry endpoint can be changed by the runtime integration when deploying a compatible mirror or fork. The default registry is the `main` branch index at [miuchan/peach-patch-registry](https://github.com/miuchan/peach-patch-registry).

## Development

Useful checks before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test
```

`npm test` runs the type check, production build, and the Node test suite. Keep browser-facing behavior covered at the domain, registry-client, AudioWorklet, or rendered-HTML boundary that owns it.

### Project layout

| Directory | Purpose |
| --- | --- |
| `app/` | React application, patch editor, Library, and browser UI |
| `lib/` | Patch domain, registry client, runtime types, and browser adapters |
| `public/audio/` | AudioWorklet processors used by the browser runtime |
| `assets/rack/` | Small Rack-derived UI assets required locally by the application |
| `server/` | Worker/API handlers for metadata and runtime support |
| `tests/` | Type, registry, patch, runtime, and rendered-output tests |
| `docs/` | Architecture, WebAssembly runtime, and UX documentation |

Build inputs and published WebAssembly artifacts are intentionally maintained in the companion [peach-patch-registry](https://github.com/miuchan/peach-patch-registry), rather than duplicated in this application repository.

## Registry integrity

The runtime treats the registry index as the source of truth for available modules. For each artifact it:

1. validates the registry schema and package metadata;
2. resolves artifact and manifest URLs against the registry index;
3. downloads the immutable WebAssembly artifact;
4. verifies its declared byte length and SHA-256 digest before instantiation.

This keeps application code, module metadata, and generated binaries independently reviewable while preventing a truncated or unexpected artifact from silently entering the audio graph.

## Privacy and browser limits

Patch editing and browser-selected audio processing are local to the browser. The application does need network access to load registry metadata and module artifacts, and some Library metadata or panel images may come from their public HTTPS URLs. Browser permissions still apply to Web MIDI, file access, and audio playback.

Support depends on both the browser and the published module ABI. Native filesystem access, native threads, arbitrary OS paths, and platform-specific plugin binaries are not portable to this runtime.

## Contributing

Issues and pull requests are welcome. Before contributing:

- read [Architecture](docs/ARCHITECTURE.md) to understand the UI, patch-domain, registry, adapter, and AudioWorklet boundaries;
- read [Web Runtime](docs/WEB_RUNTIME.md) for the module ABI and compatibility rules;
- run the checks above and describe any browser-specific verification;
- send module source/build or artifact-publication changes to the [registry repository](https://github.com/miuchan/peach-patch-registry).

For interaction goals and known gaps, see [UX Comparison](docs/UX_COMPARISON.md).

## License and attribution

Peach Patch is licensed under [GPL-3.0-or-later](LICENSE). The locally stored Rack UI assets in `assets/rack/` retain their applicable GPL licensing. Module translations and registry artifacts retain the licenses of their respective upstream projects; consult the registry metadata and upstream repositories before redistribution.

Official plugin screenshots are referenced from their public Library URLs at runtime and are not redistributed here.
