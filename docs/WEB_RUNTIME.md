# Rack Web runtime architecture

## Compatibility target

The authoritative reference is the Rack `v2.6.6` tree in `Rack/`. Source discovery and Emscripten compilation are maintained in the separate peach-patch-registry repository. A module is marked `WASM READY` only when a compiled artifact implements the same ordered parameter, input, output, and light indices as its Rack model and its documented DSP contract has an executable regression test. Library metadata alone never marks a module ready. Translations that replace SIMD/native DSP with browser-specific algorithms say so in the registry description.

## Why desktop plugin binaries cannot be loaded directly

Rack Library `.vcvplugin` packages contain a native shared library for one OS/CPU target. Browser WebAssembly cannot load Mach-O, ELF, or PE machine code. The runtime uses official Library metadata, the Peach Patch Registry, and browser-host boundaries. It loads a bundled or verified registry WASM artifact; source builds are not part of the website request path.

## Module URL pipeline

1. The client accepts only a module detail URL.
2. `/api/library/resolve` accepts only HTTPS, exact host `library.vcvrack.com`, no credentials or custom port, and exactly two safe path segments.
3. The endpoint reads the public title, description, screenshot, version, license, and source link.
4. The `(plugin, model)` key is resolved against the authored catalog and registry index, and the selected artifact is verified against its byte length and SHA-256 digest before instantiation.
5. Source discovery and Emscripten compilation are maintained in the separate `peach-patch-registry` repository. The website request path only loads verified bundled or registry artifacts.
6. The runtime hydrates the verified module and saved state, then attaches it to the AudioWorklet graph.
7. Unsupported native behavior is represented by a documented adapter or boundary in the registry; it is never inferred from metadata alone.

## DSP ABI 0.3

Each module artifact is a standalone WASM reactor with no imports and these exports:

```text
memory
_initialize()
rack_web_param_count() -> i32
rack_web_input_count() -> i32
rack_web_output_count() -> i32
rack_web_light_count() -> i32
rack_web_max_channels() -> i32
rack_web_input_buffer() -> pointer
rack_web_output_buffer() -> pointer
rack_web_light_buffer() -> pointer
rack_web_set_param(id, value)
rack_web_get_param(id) -> value
rack_web_set_input_connected(id, connected)
rack_web_set_output_connected(id, connected)
rack_web_set_input_channels(id, channels)
rack_web_get_output_channels(id) -> i32
rack_web_set_polyphony(channels)
rack_web_set_state(id, value)
rack_web_state_buffer(byteLength) -> pointer
rack_web_commit_state_json(byteLength) -> i32
rack_web_snapshot_state_json() -> byteLength
rack_web_snapshot_state_buffer() -> pointer
rack_web_asset_capacity() -> i32
rack_web_asset_buffer() -> pointer
rack_web_commit_asset(frames, channels, sampleRate)
rack_web_capture_capacity() -> i32
rack_web_capture_buffer() -> pointer
rack_web_capture_frames() -> i32
rack_web_capture_channels() -> i32
rack_web_capture_active() -> i32
rack_web_consume_capture(frames)
rack_web_set_capture_enabled(enabled)
rack_web_expander_capacity() -> i32
rack_web_expander_input_buffer() -> pointer
rack_web_expander_output_buffer() -> pointer
rack_web_set_expander_count(count)
rack_web_set_expander_type(index, type)
rack_web_set_expander_bypassed(index, bypassed)
rack_web_set_expander_param(index, id, value)
rack_web_set_expander_input_connected(index, id, connected)
rack_web_set_expander_input_channels(index, id, channels)
rack_web_get_expander_output_channels(index, port) -> i32
rack_web_seed(seed)
rack_web_process(frames, sampleRate)
```

Buffers are planar `float32`, 128 frames per channel, with up to 16 Rack channels per port. Channel zero keeps the ABI 0.2 monophonic layout; higher channels follow in channel-major port groups. Voltages use Rack conventions inside WASM. `public/audio/rack-graph-processor.js` owns every module instance in one render thread, moves Rack-voltage buffers between ports, and converts only the final Audio-8 pair to browser audio scale.

The three asset calls are an optional-capacity protocol implemented by every artifact. Ordinary DSP modules report zero capacity. Sampler modules expose an interleaved `float32` staging buffer; the worklet copies browser-decoded PCM into WASM once and commits its frame/channel/sample-rate metadata before processing begins.

The capture calls are the inverse optional-capacity protocol for modules that write audio. VCV Recorder keeps its real-time gain, trigger/gate, mono/stereo, and VU behavior in WASM, exposes a bounded interleaved PCM queue, and never blocks the AudioWorklet on encoding or filesystem access. The worklet drains 2,048-frame transferable chunks; the main thread converts them incrementally to PCM16 and finishes a WAV `Blob` on stop. Stopping audio or rebuilding the graph first flushes every active capture.

The expander calls are also optional-capacity. The editor preserves real SVG panel widths and the worklet joins compatible modules only when their Rack panels touch on the same row. Venom mixer bases receive right-side member parameters, CV, channel counts, and bypass state as per-block snapshots; the base WASM keeps the original typed `MixModule` chain and copies generated Send/Fade outputs back to the attached member ports. Attached members are collapsed into their base for topological scheduling, while their external cables remain normal graph edges.

## Live Web Audio graph

`lib/rack-audio-engine.ts` creates one graph `AudioWorkletNode` for the entire patch. The worklet instantiates each standalone module WASM, topologically orders the cable graph, and maps every Rack jack to a planar 1–16-channel buffer. Forward edges consume the current 128-frame render block; cycle-closing feedback edges consume the preceding block, making cyclic patches deterministic instead of delegating their scheduling to Web Audio. Core Audio-8 inputs 1/2 become the worklet's stereo browser output. Input/output connection flags are sent into WASM because Rack normalled inputs and cascading mixers depend on whether a jack is present. Parameter changes are posted to the running worklet without rebuilding the graph.

Blank panels and the Audio-8 boundary do not allocate WASM instances. For the Mattix fixture the single worklet owns 80 active WASM modules for 87 panels, with all 142 cables connected. Its 19 distinct Rack model keys are all supported: 16 are dynamically compiled from immutable official VCV source, `Core/AudioInterface` and `Core/Blank` are intentional browser host boundaries, and `Befaco/SpringReverb` is a browser DSP adapter because the desktop source couples its convolution path to native assets and filesystem access.

For those 16 source-built Mattix models, the compiler now extracts the official widget constructor coordinates for every visible parameter, input, and output. Core Audio-8 and the Spring Reverb browser adapter use coordinates read from the same checked-out Rack sources, so every interactive Mattix panel shares this path; Blank has no controls. The editor maps the coordinates onto the Library panel asset, uses the same jack centers for cable geometry, preserves larger web hit areas, and omits removed ABI parameter slots that Rack keeps only for patch compatibility. Generic grid controls remain the fallback for modules whose widget source computes geometry dynamically.

Structural edits rebuild this graph while playback stays enabled. Parameter changes continue to use worklet messages and do not trigger a rebuild.

Module bypass follows Rack's `configBypass()` model: registry metadata declares exact input/output routes, the worklet copies all active polyphonic channels without calling module DSP, and modules without routes emit silence while bypassed. The `bypass` field round-trips through `.vcv`, autosave, undo, and redo; live toggles use a worklet message and do not rebuild the graph.

## Patch and history model

Rack accepts both zstd-compressed tar archives containing `patch.json` and legacy plain-JSON `.vcv` files. Patchwork imports either form and exports the plain-JSON form. The serializer preserves unknown top-level, module, cable, and model-state fields, numeric port indices, module IDs, cable IDs, plug order, colors, and Rack grid positions. Its Mattix round-trip test covers all 87 modules and 142 cables.

Browser autosave stores the complete editor document locally. Modifier selection, group movement, copy/paste of internal wiring, direct cable selection/deletion, batch deletion, and structural edits all participate in the same 100-state history.

New editor modules use UUID-backed IDs, so loading a module after restoring a Rack patch cannot collide with an existing Rack or autosave ID. Autosave hydration also repairs legacy duplicate IDs before React or the audio graph sees them.

Every destructive or structural editor operation commits a full immutable `PatchDocument` snapshot. Undo/redo retains the latest 100 snapshots. Module dragging uses transient mutation and records one checkpoint on pointer release, so a drag is one undoable action rather than hundreds.

Patch hydration sends each module's complete saved `data` object through a bounded UTF-8 JSON buffer before the first audio block. The standalone runtime parses the full JSON value grammar and invokes the original module's `dataFromJson()`, so dynamically named keys and nested sequencer banks reach the actual DSP rather than merely round-tripping through the editor. The inverse snapshot ABI serializes the original `dataToJson()` tree after a momentary control edit and transfers it back from the AudioWorklet; save, autosave, undo, redo, and live DSP all use the same state. Scalar integer/real/boolean keys also occupy live ABI slots; arrays use ordered `{key, type, index}` slots and nested values use `{key, type, path}` slots for immediate browser control updates. Mattix therefore restores SEQ3 run/gate patterns and clock passthrough, Branches modes, Tides mode/range, and Rings polyphony/model state, while Impromptu Foundry restores its four tracks of phrases, sequences, CV, and step attributes. When a previously unknown model finishes compiling after patch import, hydration reapplies the original Rack parameters and state instead of replacing patch values with defaults.

## Source adapter manifest

`lib/web-plugin-registry.ts` is the website's authored fallback inventory for bundled Web ABI modules. It generates `web-runtime/modules.json`; each generated record binds a Library key to one C++ entry, output artifact, initial WASM memory size, and one of three declared compatibility strategies:

- `ordered-translation`: ordered parameters, ports, lights, and module behavior translated from the Rack source.
- `browser-dsp-adapter`: the Rack control/port/state contract is preserved while browser-suitable DSP replaces a native or dependency-heavy algorithm.
- `rack-boundary`: a Core module represented by a browser boundary or a zero-DSP compatibility artifact.

`scripts/generate-web-runtime-manifest.ts` emits the JSON artifact, and `scripts/read-web-runtime-manifest.ts` validates keys, identifiers, memory alignment, uniqueness, and C++ entry existence before compilation. `scripts/build-web-runtime.sh` accepts zero or more exact Rack keys. The test suite enforces exact generated output and valid ABI exports.

The source-build pipeline is maintained in the separate Peach Patch Registry repository. This website document describes only the runtime-facing manifest and ABI; see its `docs/BUILDING.md` for source extraction, compatibility adaptation, and Emscripten compilation. Bruer/SEQ1 compiled from its original class matches the bundled translation across 12,288 sampled outputs. Bidoo `lATe`, `dTrOY`, `BanCau`, and `lIMbO` 2.1.1 compile from exact revision `85c00f2aefa22d72d2a7472a1a937a962be3b07d`; their enum-derived clock/CV/gate/audio ports, absence of a false expander contract, lATe's original 1 ms 10 V pulse, dTrOY's external-clock sequencer advance through its quantizer, BanCau's dual-envelope routing, and lIMbO's independent stereo ladder state are permanent regressions.

Real exact-source dynamic regressions now cover Fundamental Mult, Sum, Split, Merge, Octave, MidSide, Mixer, Unity, Push, Mutes, Quantizer, SEQ3, SHASR, SequentialSwitch1/2, RandomValues, Random, Logic, Viz, VCA-1, Compare, Pulses, VCMixer, 8vert, CVMix, Gates, ADSR, Fade, LFO, Rescale, legacy VCA, VCF, Process, Scope, Delay, VCO, and Noise. Representative assertions include all 112 nested RandomValues cells; Random's `[1.625, 1.625, 1.625, 1.625, 10]` interpolation/trigger result; Logic's truth table; positive/negative Viz lights; VCMixer linear and fourth-power CV modes; Gates edges and flip/flop states; four-voice ADSR gating; Fade linear and equal-power laws; LFO phase advance; Rescale stateful multipliers; VCF impulse energy in both filter modes; Process gate-state transitions; Scope two-channel passthrough and lights; Delay's 1 ms wet peak at frame 46; VCO's four octave-spaced voices and four finite bipolar waves; and Noise's seven seeded outputs across the 1024-frame gray-noise FFT boundary. The Rack FFT/IIR/MinBLEP primitives also have a generated-WASM fixture. Template regressions verify both 1-to-4 and 4-to-1 clocked routing; adapter fixtures additionally cover safe local `<rack.hpp>` DSP headers, vector-compatible port collections, mixed-type clamp, SSE-style scalar lane operations, exponential filtering, trigger/lifecycle events, editable display strings, `json_int_t`, transitive custom bases and secondary interfaces, disconnected Rack expander fields, native display-pointer isolation, `APP->engine` sample-rate changes, out-of-line DSP, explicit light counts, Rack frames/resampling, 40-slot JSON arrays, automatic 4-to-8 MiB constructor retry, and WASI logging.

The immutable Audible Instruments `a15554e33721c2f8f65bb6b0f59588307fb6e625` revision and its locked eurorack/stmlib dependencies now compile all 20 manifest models: Braids, Plaits, Elements, Tides, Tides2, Clouds, Warps, Rings, Links, Kinks, Shades, Branches, Blinds, Veils, Frames, Stages, Marbles, Ripples, Shelves, and Streams. The dependency walker follows includes found inside companion implementation units, so Tides now links its exact resource tables instead of falling back after `generator.cc`. A clean batch produced 20/20 standalone artifacts with no imports; each survived 20,480 frames split between 44.1 and 48 kHz with finite outputs/lights, and the five default-silent gain/router models produced finite nonzero output under active controls and gates. Streams, Shelves, and Elements were then pasted as official Library URLs in the running browser, appeared as `WASM READY`, and joined a live graph with zero skipped modules. Befaco Iroi 2.11.0 at exact revision `637e42c1589d212ff70eee1ffa35236e72ac78c6` now also compiles with its locked Iroi, OwlProgram, DaisySP, and hvcc repositories. A connected stereo 128-frame signal test produced 191 finite nonzero samples; its official URL loaded as `WASM READY` with all 50 parameters, 12 inputs, 2 outputs, 28 lights, and an 8 MiB memory budget. C1 Channel Strip `ChanOut` 2.1.1 at exact revision `37873c00cb6fc08a853cd937a4b5055ed04fe83a` preserves its secondary control interface, Rack expander buffers, four character engines, and 10 scalar state fields while using disconnected-expander semantics without CHO-X. All four engines produced finite stereo output with 255 or 256 nonzero samples per 256-sample block. Venom 2.15.0 at exact revision `f0c7fd2af1da6e8232afd7fa84295a9d368631d4` now contributes 58 exact-source models. In addition to the four mixer bases, seven typed mixer expanders, `ShapedVCA`, `SVF`, `WaveFolder`, `WaveMangler`, `Octaver`, `Slew`, and `Logic`, the persisted batch includes 35 more oscillators, recursion processors, poly utilities, merges/splits, rhythm/control generators, spatial processors, and expanders. Every one of those 35 modules is instantiated by the permanent test suite, driven through all inputs, and checked for finite output across 44.1 and 48 kHz. Rack's poly-normal rule was corrected so mono inputs repeat channel 0 while missing channels on a connected poly input return zero; all previously built artifacts that call this API were rebuilt from their locked revisions. Nested third-party source directories now use quote-only include paths, and embedded STM/CMSIS firmware is excluded from browser DSP builds without hiding required stmlib headers. Every covered Venom official URL appeared as `WASM READY`; adding any one to Mattix raised the live graph from 80 to 81 WASM modules with all 142 cables, 15 feedback edges, and zero skipped modules, and Undo restored the 87-panel Mattix baseline. The Venom mixer family routes its right-side expanders through physical adjacency. Exact-source producer/consumer buffers now preserve Rack's one-sample flip latency, generic typed neighbor snapshots support parameter and port access, and multi-panel proxy chains execute `BenjolinOsc → Gates → Volts` with both expander outputs live. `Venom/Logic` compiles with integer SIMD and dynamic switch labels. That milestone reached 142 browser registry keys and 125 persisted direct exact-source builds. VCV Recorder's official URL loaded through its bundled browser adapter, recorded and downloaded a mono WAV. TC Wurl's official URL compiled from revision `5d573b7c3bdb2f20e8d98dab94ccd111d204513b`, appeared as `WASM READY`, and raised Mattix to 81 WASM modules with zero skipped modules. Submarine TD-202's official URL compiled from revision `16796663a6e75a9d8fd003961329e98c531e848f` with its exact zero-I/O/two-light contract. Stoermelder Stroke's official URL compiled from revision `d02f0b6d79e792416c5876e369adf2e69f5513bc`; its browser panel mapped `A` to Gate and its host-action regression produced an exact 10 V CV signal. Bogaudio VCO, VCF/LVCF, LFO, DADSRH, Arp, Analyzer, Additator, FFB, CVD, Blank3, PolyCon, Matrix88, AddrSeq, Mix8, and Mix8x official URLs compiled from revision `656eaae458e045602dc974bae82e15a11e104958`. Count Modula Switch 8-1 2.5.0 compiled from exact revision `30b3c6c46fc0589f5e0ece7ad79abbe0293e70fd` through the macro-configured shared-header path; its 5 parameters, 14 inputs, 1 output, 21 lights, and six state fields match the original contract. Two clock edges routed 2 V and 7 V from consecutive inputs. Its official URL appeared as `WASM READY`; Undo removed it, Redo restored it, and the live 91-panel Mattix graph ran 84 WASM modules with 142 cables, 15 feedback edges, and zero skipped modules. Impromptu Clocked 2.5.0 compiles from exact revision `5ba4ccd49cd657d04bb73b9143daa7ab490baf2b`; its 20 parameters, 7 inputs, 7 outputs, 8 lights, three bypass routes, message-buffer expander ABI, and 13 state fields are preserved. The real runtime reports a 30–300 BPM range with a 120 BPM default, produces two 0/10 V clock pulses per second at that setting, and honors the stopped-output-high option. Its official URL appeared as `WASM READY`; Undo and Redo removed/restored it, and the live 92-panel graph ran 85 WASM modules with 142 cables, 15 feedback edges, and zero skipped modules. Regressions cover audio/control behavior for every DSP module, including polyphonic constants, 8×8 matrix routing, addressable sequencing, Mix8 constructor defaults and stereo mixer output, and the Mix8/Mix8x 16 KiB bidirectional message-buffer contract, plus Blank3's zero-output contract. The generic collector now preserves namespace-scoped implementation files, constructor initializer lists, comment-aware bodies, recursively resolved alias/template bases, dependency declarations delayed until inherited bases are complete, local and namespace-qualified free implementation helper functions, out-of-class static data, namespace implementation globals, conditionally compiled implementation units and their own include closure, finite JSON string modes, inherited presentation-only JSON, dependent sibling helpers, inherited secondary bases, topologically ordered local headers, and required standard headers. Qualified Rack bases such as `rack::Module` are now resolved atomically instead of being corrupted by unrelated third-party `Module` typedefs, and the DSP-only host supplies the Surge neighbor-connection interface used by its tuned-delay modules. `SurgeXTDelayLineByFreq` rebuilt successfully from the locked revision after both fixes. Its 2 parameters, 3 inputs, and 2 outputs now also recover exact source coordinates through nearby `LayoutConstants`, `box.size`, scalar `mm2px()`, and range-for column evaluation; the rebuilt 20 MiB artifact retains its exact four-voice v/oct delay timing. In the live Mattix browser session, adding VCF or Analyzer raised the graph to 82 WASM modules while retaining 142 cables, 15 feedback edges, and zero skipped modules; the worklet stayed live, and Undo restored 81 modules without changing the patch graph.

Valley 2.4.5 now compiles Plateau, Topograph, uGraph, Feline, Amalgam, Interzone, Dexter, and Terrorform from exact Library gitlink `86f02e431136a7f5c96a872b99b7115b7e133e05`. This found two general source-loader defects: the official submodule label is `repos/ValleyFree` while its tree path is `repos/Valley`, and the locked revision was already the remote default `HEAD`, leaving the old `--no-checkout` clone empty. Both cases have fixture regressions. Plateau's out-of-line constructor yields all 30 live parameter names/ranges, 17 named inputs, two outputs, two bypass routes, and eight typed state fields; the named widget `Vec` members place every live parameter and jack at its official coordinate. An impulse through the original Dattorro network produces a finite stereo tail in an 8 MiB WASM instance. Topograph and uGraph cover the old `step()` dispatch and exact pattern resource arrays. Feline, Amalgam, Interzone, Dexter, and Terrorform cover SSE/SSE2 translation, Rack-vector interoperability, deterministic entropy, aligned allocations, modern Clang reserved identifiers, and 4–64 MiB runtime budgets. The widget extractor now evaluates finite float coordinates, numeric coordinate arrays, scalar assignments, and nested `for` loops, taking Dexter from 39/87 recognized widgets to 135/135 visible controls, Terrorform from 68/88 to 88/88, and Feline from 12/32 to 32/32. Every visible control and jack across the eight panels now has its official source coordinate; Amalgam's unused `MODE_CV_INPUT` and Interzone's unmounted `FILTER_INPUT` remain addressable ABI slots but are hidden in the browser UI. Dexter embeds 35 original wavetable banks in an 8.2 MB artifact, while Terrorform embeds all 64 banks in a 12.4 MB artifact. The grouped runtime regression clocks both sequencers, filters audio, gates the Interzone voice, and checks finite nonzero output from both ROM oscillators.

Impromptu Foundry 2.5.0 now extends that Clocked coverage at the same exact revision `5ba4ccd49cd657d04bb73b9143daa7ab490baf2b`. Its 79 parameters, 13 inputs, 12 outputs, 143 lights, and four-track/32-step/64-sequence data compile from official source. A real dynamically named `id0_cv` bank loaded through the complete JSON ABI produces the saved 1.75 V step from the original DSP. The official URL appeared as `WASM READY`; Undo and Redo removed and restored its 79-control panel, and the live 93-panel graph ran 86 WASM modules with all 142 cables, 15 feedback edges, and zero skipped modules. This milestone raised the browser registry to 143 keys; the persisted catalog contained 125 direct exact-source builds.

Rack Core MIDI compatibility adds `MIDIToCVInterface`, `MIDICCToCVInterface`, `MIDITriggerToCVInterface`, `MIDI-Map`, `CV-MIDI`, `CV-CC`, and `CV-Gate` with their exact legacy slugs and port indices. The AudioWorklet accepts raw Web MIDI records and drains bounded outbound records to a matching device name or the first available output. Permission is requested from the audio-button gesture but never blocks graph startup; late authorization hot-connects devices. Tests cover polyphonic note/velocity/gate conversion, 1 ms retrigger and transport pulses, learned note/CC JSON, CV-to-note/CC/clock emission, and MIDI-Map's cross-module Rack-ID parameter control. A live 94-panel Mattix-derived session ran 87 WASM modules, 142 cables, 15 feedback edges, zero skipped modules, and zero attached MIDI devices. Core Audio 2/8/16 now share the browser output boundary; Audio 2 preserves its live level control, while browser stereo playback intentionally exposes ports 1/2. Core Notes preserves UTF-8 text JSON and exposes an undoable multiline editor. This milestone raised the browser registry to 153 keys.

The six Core MIDI panels with physical ports also use the exact 12-jack or 16-jack coordinates from Rack's Core widget sources. Their Web MIDI device selector remains in the browser control layer, so it stays readable without displacing or falsifying the panel jack geometry. MIDI-Map has no physical ports and continues to expose its mappings through the inspector.

Stroke's portable special modes also run as browser host commands: hovered-parameter random/copy/paste, focused module zoom, patch fit/toggle, cable opacity/color/layer/visibility, module movement lock, random module insertion, module preset download, and repeatable rack panning. A live browser regression mapped `X` to cable visibility and verified hide/restore before undoing the mode, mapping, and module add.

| Audible Instruments exact-source model | Params | Inputs | Outputs | Lights |
|---|---:|---:|---:|---:|
| Braids | 7 | 5 | 1 | 0 |
| Plaits | 11 | 8 | 2 | 16 |
| Elements | 28 | 16 | 2 | 3 |
| Tides | 7 | 9 | 4 | 6 |
| Tides2 | 13 | 8 | 4 | 10 |
| Clouds | 13 | 10 | 2 | 9 |
| Warps | 5 | 6 | 2 | 5 |
| Rings | 12 | 8 | 2 | 4 |
| Links | 0 | 6 | 6 | 6 |
| Kinks | 0 | 5 | 7 | 6 |
| Shades | 6 | 3 | 3 | 6 |
| Branches | 4 | 4 | 4 | 4 |
| Blinds | 8 | 8 | 4 | 16 |
| Veils | 8 | 8 | 4 | 8 |
| Frames | 9 | 6 | 6 | 8 |
| Stages | 18 | 12 | 6 | 18 |
| Marbles | 15 | 9 | 7 | 18 |
| Ripples | 3 | 5 | 4 | 0 |
| Shelves | 10 | 13 | 7 | 1 |
| Streams | 11 | 6 | 2 | 16 |

```bash
# all adapters
npm run wasm:build

# one adapter during development
npm run wasm:build -- Fundamental/VCO
```

## Implemented web builds

| Model | Parameters | Inputs | Outputs | Lights | Test evidence |
|---|---:|---:|---:|---:|---|
| Bruer/SEQ1 | 19 | 2 | 4 | 77 | Clock produces 10V Euclidean trigger |
| Fundamental/VCA | 2 | 6 | 2 | 0 | Unity gain plus four independent planar voices |
| Fundamental/ADSR | 9 | 6 | 1 | 5 | Per-voice gate produces an increasing envelope |
| AudibleInstruments/Links | 0 | 6 | 6 | 6 | Multiple copies and adder sums preserve port order |
| AudibleInstruments/Kinks | 0 | 5 | 7 | 6 | Sign, logic, noise, and S&H outputs verified |
| AudibleInstruments/Shades | 6 | 3 | 3 | 6 | Connected outputs split the cascading mix |
| AudibleInstruments/Branches | 4 | 4 | 4 | 4 | Deterministic Bernoulli routing preserves output IDs |
| Fundamental/SEQ3 | 39 | 5 | 16 | 27 | External clock advances the step and selects row CV |
| Core/Blank | 0 | 0 | 0 | 0 | Zero-port compatibility artifact executes |
| Befaco/Mixer | 4 | 4 | 2 | 3 | Main/inverted mix pair verified numerically |
| Fundamental/VCO | 8 | 4 | 4 | 5 | Four independently pitched polyBLEP voices |
| Fundamental/VCF | 7 | 4 | 2 | 0 | Impulse produces lowpass and highpass response |
| Fundamental/Delay | 8 | 6 | 2 | 1 | 1ms wet impulse appears at the Rack wet port |
| Core/AudioInterface | 0 | 8 | 8 | 16 | Audio-8 browser boundary ports and silent device inputs |
| Fundamental/Scope | 8 | 3 | 2 | 2 | Both monitored signals pass through unchanged |
| AudibleInstruments/Braids | 7 | 5 | 1 | 0 | Macro oscillator is finite and bipolar |
| AudibleInstruments/Tides | 7 | 9 | 4 | 6 | Gate, unipolar, and bipolar phase outputs |
| AudibleInstruments/Rings | 12 | 8 | 2 | 4 | Strum excites dual browser resonators |
| AudibleInstruments/Elements | 28 | 16 | 2 | 3 | Gate excites stereo physical-model adapter |
| Befaco/Iroi | 50 | 12 | 2 | 28 | Locked OwlProgram firmware DSP runs with mixed C/C++ dependencies |
| C1-ChannelStrip/ChanOut | 7 | 2 | 2 | 36 | Four character engines run standalone with disconnected expander semantics |
| Venom/Mix4Stereo | 8 | 8 | 2 | 0 | Inherited mixer and biquad oversampling paths produce finite stereo sums |
| Venom/Mix4 | 8 | 4 | 1 | 0 | Mono mix and oversampled clipping preserve the official channel order |
| Befaco/SpringReverb | 4 | 5 | 2 | 8 | Impulse produces a delayed dispersive tail |
| Fundamental/VCO2 | 7 | 4 | 1 | 5 | Wavetable family morph emits finite audio-rate output |
| Fundamental/LFO | 7 | 5 | 4 | 5 | Clock/reset-compatible sine, triangle, saw, and square output |
| Fundamental/Noise | 0 | 0 | 7 | 0 | White, pink, red, violet, blue, gray, and black outputs differ |
| voxglitch/looper | 1 | 1 | 2 | 0 | Built-in loop and ABI-loaded interleaved stereo PCM both execute |

Widget geometry recovery statically expands plugin-owned `static void` layout helpers called with the widget as their first argument. Numeric and enum arguments, defaulted finite arguments, range-for initializer lists, and counters advanced by earlier completed loops are propagated into the helper body. The argument splitter tracks matched delimiter types so `w->module` no longer corrupts comma boundaries. Immutable `LayoutItem` descriptions recover standard knob centers, and custom factories with top-left/size rectangles recover selector centers, extents, and horizontal interaction. This places Surge XT VCF's five primary knobs, filter type/subtype selectors, six inputs, and two outputs at their exact shared-layout coordinates while its original stateful filter WASM regression remains active. Its twenty mutually exclusive modulation-ring parameters deliberately stay off the official panel rather than stacking twenty controls over five knobs; the selected-module Inspector exposes them, and every other non-button advanced parameter, with named sliders and live numeric values.

The same Inspector lazily renders translated Rack state slots only when opened. Boolean, finite string-enum, integer, real, indexed, and nested-path entries receive native browser controls; edits are sent to the running module, retained in patch history, and reconstructed into their original JSON paths on `.vcv` export. The project test command now begins with a strict TypeScript pass, which caught and removed an invalid runtime import that the bundler's CommonJS interop had left undiagnosed.

## Remaining work toward broad Rack compatibility

- Move the JavaScript graph scheduler itself into an AudioWorklet-owned WASM engine compatible with Rack's sample-level ordering.
- Add more DSP primitives, SIMD operations, native-host UI translations, and oversampling to the automatic adapter.
- Implement Rack SVG widget primitives without redistributing restricted Core visual designs. Rack-style module context actions are now translated to native browser controls.
- Add cloud patch storage. Browser file handles support native Open/Save-in-place with fallback; `.vcvm` presets use exact-model validation; Core MIDI panels expose device selection and next-CC learn; and the bounded automation recorder persists gestures with target-ID translation and sample-accurate AudioWorklet-clock playback whenever audio is live. The normal graph keeps its fast 128-frame path, while recorded automation temporarily switches to exact per-sample parameter scheduling.
- Build and test the remaining open-source Library catalog. Native-only freeware requires author-supplied web artifacts.
