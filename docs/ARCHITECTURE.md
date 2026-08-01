# Peach Patch architecture

Peach Patch is organized around a client-only studio container, pure patch-domain operations, and an isolated browser audio runtime. The dependency direction is intentionally one-way:

```text
UI components and studio container
        |
        v
patch operations, serialization, registry and browser adapters
        |
        v
AudioWorklet graph / verified WASM ABI
```

## Boundaries

### Studio container

`app/rack-web-studio.tsx` owns the application session: patch history, selection, registry hydration, audio lifecycle, file commands, and status reporting. It composes the visual boundaries but should not own their markup or low-level gesture algorithms.

The visual surface is split into focused components:

- `rack-studio-topbar.tsx` — file, history, library, audio, and performance controls.
- `rack-studio-library.tsx` — registry search, URL loading, and module insertion affordances.
- `rack-studio-inspector.tsx` — selected-module controls and typed state editing.
- `rack-studio-module-layer.tsx` — module panel rendering and module-level event wiring.
- `rack-studio-cable-layer.tsx` — cable hit targets, curves, plugs, and signal display.
- `rack-studio-context-menus.tsx` — module and cable context actions.
- `rack-studio-quick-add.tsx` — keyboard-first module insertion at a world position.

Canvas panning, marquee selection, dragging, and touch pinch behavior live in `lib/use-rack-canvas-gestures.ts`. The hook receives patch/history callbacks from the container and does not know about the registry or audio engine.

### Patch domain

Patch transformations are pure and immutable. `lib/patch-operations.ts` owns structural edits such as connecting, replacing, duplicating, healing, deleting, resetting, and randomizing modules. `lib/patch-state.ts`, `lib/patch-autosave.ts`, `lib/vcv-patch-import.ts`, and `lib/vcv-patch-serialize.ts` define the boundaries for persisted data.

Derived geometry and runtime projections are separate from edits:

- `lib/rack-cable-layout.ts` derives cable geometry and signal fan-out.
- `lib/rack-viewport-control.ts` derives viewport lock and host-control behavior.
- `lib/rack-studio-helpers.ts` contains placement, IDs, validation, and browser-only helper contracts.

These modules must not import React or AudioWorklet code. This keeps them testable with Node and prevents UI state from becoming an implicit source of truth.

### Audio and browser adapters

`lib/rack-audio-controller.ts` owns the React-facing audio session. `lib/rack-audio-patch-sync.ts` projects patch changes into the live engine and performs incremental synchronization. `lib/rack-audio-engine.ts` remains the worklet client and transport boundary.

WASM loading, browser assets, and registry verification are isolated in `rack-wasm-host.ts`, `browser-asset-loader.ts`, and `peach-registry-client.ts`. The UI may request these services, but it should not reproduce their validation or transport rules.

## State ownership rules

1. The patch history is the source of truth for editable patch state.
2. AudioWorklet state is a live projection; it must be rebuilt or synchronized from the patch rather than becoming a second persisted store.
3. Selection, menus, viewport, and transient gestures are UI session state and must never be serialized into `.vcv` or autosave data.
4. Imported and autosaved data is normalized at the boundary before entering history.
5. Every structural edit must be immutable and undoable; side effects such as audio messages or downloads happen after the domain decision.

## Testing strategy

- Pure patch, geometry, state, import, registry, and serialization behavior is covered by Node tests.
- Render-boundary tests assert that the client SPA uses the intended component and service boundaries.
- Audio graph tests exercise topological scheduling, WASM routing, expanders, capture, telemetry, and reset messages.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test` are the release gates. Graph tests distinguish Rack-voltage output from the browser audio boundary, which normalizes +/-5V to +/-1.

When adding a feature, first decide which boundary owns its state and transformation. Add a pure operation or adapter when behavior can be tested without React; add a component when the concern is rendering; keep the studio container responsible only for orchestration between those boundaries.
