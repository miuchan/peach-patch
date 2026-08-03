# Contributing to Peach Patch

Thanks for helping improve Peach Patch. Contributions should keep the browser runtime understandable, preserve Rack-compatible patch behavior, and place work in the repository that owns it.

## Environment

- Node.js 22.22.0, as recorded in `.node-version`
- npm, using the committed `package-lock.json`
- A modern browser with WebAssembly and Web Audio for interactive verification

Install the exact dependency set:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Audio requires a browser user gesture. Registry-backed modules also require network access to the configured HTTPS registry index and artifacts.

## Choose the owning repository

This repository owns the browser application and runtime:

- React editing workflows and browser interactions;
- immutable patch-domain operations, import/export, and persistence boundaries;
- registry index consumption, schema validation, and WASM integrity verification;
- Web Audio, AudioWorklet, Web MIDI, browser assets, and Worker API integration.

The companion [Peach Patch Registry](https://github.com/miuchan/peach-patch-registry) owns:

- module source discovery and C++ browser adaptations;
- Emscripten builds and build tooling;
- package manifests, published WebAssembly artifacts, and catalog governance;
- artifact provenance and registry publication workflows.

Do not add module source trees, build caches, local WASM outputs, or a second catalog to this repository. A portable host capability may require coordinated changes in both repositories, but each side should retain its own responsibilities.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing ownership or dependency direction, and [docs/WEB_RUNTIME.md](docs/WEB_RUNTIME.md) before changing patch, registry, WASM, or AudioWorklet contracts.

## Validation principles

Treat data from files, network responses, the registry, PatchStorage, `localStorage`, IndexedDB, WebAssembly, and AudioWorklet messages as untrusted until the owning boundary validates it.

- Parse and normalize external data before constructing internal types.
- Require finite values and explicit bounds for IDs, sizes, channels, paths, and collection lengths.
- Restrict remote requests to the intended HTTPS hosts and URL shapes.
- Verify registry WASM artifacts by declared byte length and SHA-256 before instantiation.
- Keep validation in the adapter that owns the boundary instead of repeating partial checks in UI code.
- Preserve supported legacy input only through explicit migrations.
- Reject invalid imports atomically so the current patch is not replaced by a partial graph.

## Checks

During development, use the smallest relevant feedback loop:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
```

Before opening a pull request, run the complete CI-equivalent gate:

```bash
npm run check
```

The complete gate checks formatting and lint rules, then runs type checking, a production build, and the coverage-gated Node test suite. If browser behavior changes, also exercise the affected flow in a browser and describe that verification in the pull request.

## Pull-request checklist

- [ ] The change is in the repository and architectural boundary that owns it.
- [ ] External data is validated and normalized at its entry boundary.
- [ ] Runtime contracts and Rack-compatible round trips remain intact.
- [ ] Focused tests cover new domain or boundary behavior.
- [ ] `npm run check` passes locally.
- [ ] Browser-specific behavior was verified when applicable.
- [ ] User-facing or architectural documentation was updated when applicable.
- [ ] Generated artifacts, local caches, credentials, and unrelated work are not included.

Keep pull requests focused and explain observable behavior, compatibility impact, and verification. Implementation history belongs in commit history, not in product or architecture documentation.
