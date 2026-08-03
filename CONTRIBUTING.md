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

## Internationalization

The Peach Patch host interface supports English (`en`) and Simplified Chinese (`zh-CN`). Browser-owned visible copy, dialog text, status and error fallbacks, titles, and accessibility labels belong in `app/i18n/catalogs.ts`; components render them through `useI18n()` instead of hardcoding a language.

Keep translation state out of patch and audio domains:

- Represent deferred or long-lived UI feedback with `message()` or `issue()` from `app/i18n/user-message.ts`. Store the descriptor and call `formatUserMessage()` at the render boundary so an existing status is translated again when the language changes.
- Give `issue()` a localized fallback key. Do not expose `Error.message` or other browser/runtime diagnostics as user-facing copy.
- Pass numbers through message interpolation or `formatNumber()` so `Intl` applies the active locale. Use plural templates for count-dependent grammar.
- Keep module names, plugin-authored panel text, physical key names, filenames, and user content in their source form. Translate the surrounding Peach Patch instruction or accessibility label.

The English catalog defines the canonical `MessageKey` set. Every catalog must contain exactly the same keys and interpolation placeholders. When adding or changing copy, update `enMessages` and `zhCNMessages` together, preserve placeholder names, and include an `other` plural form. `tests/i18n.test.ts` enforces key and placeholder parity, locale resolution, plural formatting, and descriptor retranslation.

Adding another locale also requires updating `SUPPORTED_LOCALES`, registering its catalog, exposing it in the language selector, defining its document metadata mapping, and extending the locale tests. A language choice is a host preference stored under `peach-patch.locale.v1`; it must never enter a `.vcv` patch or patch autosave data.

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
