import type { ModuleInstance, SampleAssetRef } from "../../lib/patch-types";
import type { PointerEvent } from "react";
import { rackMidiLogText } from "../../lib/rack-module-panel-data";
import type { RuntimeVisual, WebPluginModule } from "../../lib/web-plugin-registry";
import { CellaFrequencyAnalyzerDisplay } from "./cella-frequency-analyzer-display";
import { RackAlikinsHoverBridge } from "./rack-alikins-hover-bridge";
import { RackAlgomorphDisplay } from "./rack-algomorph-display";
import { RackAlefsbitsPanel } from "./rack-alefsbits-panel";
import { RackAlefsbitsTurnt } from "./rack-alefsbits-turnt";
import { RackAliasDisplay } from "./rack-alias-display";
import { RackAudioDisplay } from "./rack-audio-display";
import { RackAxiomaDisplay } from "./rack-axioma-display";
import { RackBouncyBallsDisplay } from "./rack-bouncy-balls-display";
import { RackBaconFooter } from "./rack-bacon-footer";
import { RackBidooLimonadeDisplay } from "./rack-bidoo-limonade-display";
import { RackBidooSampleDisplay } from "./rack-bidoo-sample-display";
import { RackBisetTreeDisplay } from "./rack-biset-tree-display";
import { RackBisetRegex } from "./rack-biset-regex";
import {
  RackBisetTracker,
  RackBisetTrackerOutput,
  RackBisetTrackerState,
} from "./rack-biset-tracker";
import { RackBisetBlankPanel } from "./rack-biset-blank-overlay";
import { RackBpmDisplay } from "./rack-bpm-display";
import { RackCorrupterDisplay } from "./rack-corrupter-display";
import { RackComputerscareFigure } from "./rack-computerscare-figure";
import { RackComputerscareBlank } from "./rack-computerscare-blank";
import { RackCosmicClockDisplay } from "./rack-cosmic-clock-display";
import { RackCrawlDisplay } from "./rack-crawl-display";
import { RackCellGrid } from "./rack-cell-grid";
import { RackCellularAutoDisplay } from "./rack-cellular-auto-display";
import { RackCatroColorDisplay } from "./rack-catro-color-display";
import { RackChordChemistDisplay } from "./rack-chord-chemist-display";
import { RackCvNoteDisplay } from "./rack-cv-note-display";
import { RackCyclicCaDisplay } from "./rack-cyclic-ca-display";
import { RackDbMatrixDisplay } from "./rack-db-matrix-display";
import { RackDigitalSequencer } from "./rack-digital-sequencer";
import { RackDigitalProgrammer } from "./rack-digital-programmer";
import { RackDressMeUp } from "./rack-dress-me-up";
import { RackDotMatrixText } from "./rack-dot-matrix-text";
import { RackEditableText } from "./rack-editable-text";
import { RackElementaryCaDisplay } from "./rack-elementary-ca-display";
import { RackFlameSpectrogram } from "./rack-flame-spectrogram";
import { RackFillingStationDisplay } from "./rack-filling-station-display";
import { RackFlyingFader } from "./rack-flying-fader";
import { RackFourViewDisplay } from "./rack-four-view-display";
import { RackFullScopeDisplay } from "./rack-full-scope-display";
import { RackFwCellBarGrid } from "./rack-fw-cell-bar-grid";
import { RackHexLooperDisplay } from "./rack-hex-looper-display";
import { RackHazumiDisplay } from "./rack-hazumi-display";
import { RackKilpatrickStereoMeter, RackKilpatrickTestOsc } from "./rack-kilpatrick-displays";
import { RackKilpatrickJoystick } from "./rack-kilpatrick-joystick";
import { RackJwGrid } from "./rack-jw-grid";
import {
  RackJwD1v1deDisplay,
  RackJwThingThingDisplay,
  RackJwTreeDisplay,
} from "./rack-jw-visual-displays";
import { RackIntegralFluxPreview } from "./rack-integral-flux-preview";
import { RackKlokSpidDmd } from "./rack-klokspid-dmd";
import { RackLightMatrixDisplay } from "./rack-light-matrix-display";
import { RackLinearRibbon } from "./rack-linear-ribbon";
import { RackLintBuddy, type LintBuddyTarget } from "./rack-lint-buddy";
import { RackLofiTvDisplay } from "./rack-lofi-tv-display";
import { RackLomasSamplerDisplay } from "./rack-lomas-sampler-display";
import { RackLuaDisplay } from "./rack-lua-display";
import { RackMadzineLaunchpad } from "./rack-madzine-launchpad";
import { RackMadzineManual, type MadzineManualTarget } from "./rack-madzine-manual";
import { RackMadzineScopeDisplay } from "./rack-madzine-scope-display";
import { RackMadzineWaveformDisplay } from "./rack-madzine-waveform-display";
import { RackMlArpeggiatorDisplay } from "./rack-ml-arpeggiator-display";
import { RackMoDllzKn8bLcd, RackMoDllzMidiPolyMpeLcd, RackMoDllzXpandLcd } from "./rack-modllz-lcd";
import { RackSapphireMoots, RackSapphireOutputSelector } from "./rack-sapphire-interactions";
import { RackSlolyPit } from "./rack-sloly-pit";
import { RackSortStepDisplay } from "./rack-sort-step-display";
import { RackProbablyNoteMn } from "./rack-probably-note-mn";
import { RackMorphPadDisplay } from "./rack-morph-pad-display";
import { RackMouseSeqGrid } from "./rack-mouse-seq-grid";
import { RackMultiMeterDisplay } from "./rack-multi-meter-display";
import { RackNesScreenDisplay } from "./rack-nes-screen-display";
import { RackNativeSignalDisplay } from "./rack-native-signal-display";
import { RackNativeInteraction } from "./rack-native-interaction";
import { RackNoteEchoDisplay } from "./rack-note-echo-display";
import { RackNoteLoopDisplay } from "./rack-note-loop-display";
import { RackNoteMeterDisplay } from "./rack-note-meter-display";
import { RackNotePolyDisplay } from "./rack-note-poly-display";
import { RackOctobirDisplay } from "./rack-octobir-display";
import { RackParamNumericDisplay } from "./rack-param-numeric-display";
import { RackParamXyPoints } from "./rack-param-xy-points";
import { RackPaletteEngineSelector } from "./rack-palette-engine-selector";
import { RackPanelColor } from "./rack-panel-color";
import { RackPathTrackpad } from "./rack-path-trackpad";
import { RackPhaseDistortionPad } from "./rack-phase-distortion-pad";
import { RackPhraseSeqDisplay } from "./rack-phrase-seq-display";
import { RackPianoKeyboard } from "./rack-piano-keyboard";
import { RackPolarCvDisplay } from "./rack-polar-cv-display";
import { RackPortaloof } from "./rack-portaloof";
import { RackQarRhythmDisplay } from "./rack-qar-rhythm-display";
import { RackRkdDividers } from "./rack-rkd-dividers";
import { RackRunshowDisplay } from "./rack-runshow-display";
import { RackSdLinesDisplay } from "./rack-sd-lines-display";
import { RackScopeDisplay } from "./rack-scope-display";
import { RackSpellbookEditor } from "./rack-spellbook-editor";
import { RackSarosEnvelope } from "./rack-saros-envelope";
import { RackSegmentDisplay } from "./rack-segment-display";
import { RackSequencerGrid } from "./rack-sequencer-grid";
import { RackSignalFunctionSetDisplay } from "./rack-signal-function-set-display";
import { RackSpeckSpectrumDisplay } from "./rack-speck-spectrum-display";
import { RackStochSequencer } from "./rack-stoch-sequencer";
import { RackSpectrumDisplay } from "./rack-spectrum-display";
import { RackSpecificValue } from "./rack-specific-value";
import { RackStorageScope } from "./rack-storage-scope";
import { RackRowTool } from "./rack-row-tool";
import { RackTapestryDisplay } from "./rack-tapestry-display";
import { RackTdScopeDisplay } from "./rack-td-scope-display";
import { RackTemporalDeckDisplay } from "./rack-temporal-deck-display";
import { RackTheKickSample } from "./rack-the-kick-sample";
import { RackTouchRibbon } from "./rack-touch-ribbon";
import { RackTrgSequencer } from "./rack-trg-sequencer";
import { RackUndertowPreview } from "./rack-undertow-preview";
import { RackUniversalRhythmDisplay } from "./rack-universal-rhythm-display";
import { RackVerticalPosition } from "./rack-vertical-position";
import { RackVerticalLabel } from "./rack-vertical-label";
import { RackValueLabel } from "./rack-value-label";
import { RackVoxglitchXy } from "./rack-voxglitch-xy";
import { RackVoxglitchArpSeq } from "./rack-voxglitch-arpseq";
import { RackWavetableDisplay } from "./rack-wavetable-display";
import { RackWavetableEditor } from "./rack-wavetable-editor";
import { RackWolframDisplay } from "./rack-wolfram-display";
import { RackWalk2Display } from "./rack-walk2-display";
import { RackXYPadDisplay } from "./rack-xy-pad-display";
import { useI18n } from "../i18n/provider";

type ModulePanelVisualsProps = {
  module: ModuleInstance;
  definition?: WebPluginModule;
  scopeSamples?: number[][];
  relatedScopeSamples?: number[][];
  renderedLightValues: number[];
  rackData: Record<string, unknown>;
  audioData?: Record<string, unknown>;
  audioRunning: boolean;
  inputCableColors?: Record<number, string>;
  selectedAsset?: SampleAssetRef;
  paramNotice: { id: number; serial: number } | null;
  manualHelpTarget: MadzineManualTarget | null;
  lintBuddyTarget?: LintBuddyTarget;
  onLoadAsset: () => void;
  onLoadAssetSlot: (slot: number) => void;
  onParam: (id: number, value: number) => void;
  onParamReset: (id: number, value: number) => void;
  onMomentary: (id: number, active: boolean) => void;
  onVisualAction: (id: number, active: boolean) => void;
  onRackRowAction: (action: 0 | 1 | 3 | 4) => void;
  onRackRowDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onState: (updates: Array<[id: number, value: number]>) => void;
  onData: (data: Record<string, unknown>) => void;
};

export function ModulePanelVisuals({
  module,
  definition,
  scopeSamples,
  relatedScopeSamples,
  renderedLightValues,
  rackData,
  audioData,
  audioRunning,
  inputCableColors,
  selectedAsset,
  paramNotice,
  manualHelpTarget,
  lintBuddyTarget,
  onLoadAsset,
  onLoadAssetSlot,
  onParam: updateParam,
  onParamReset,
  onMomentary,
  onVisualAction,
  onRackRowAction,
  onRackRowDragStart,
  onState,
  onData,
}: ModulePanelVisualsProps) {
  const { t } = useI18n();
  if (!definition) return null;

  return (
    <>
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "sloly-pit-routing")
        .map((visual, index) => (
          <RackSlolyPit
            key={`sloly-pit-routing-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "probably-note-mn")
        .map((visual, index) => (
          <RackProbablyNoteMn
            key={`probably-note-mn-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "voxglitch-arpseq")
        .map((visual, index) => (
          <RackVoxglitchArpSeq
            key={`voxglitch-arpseq-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            params={module.params}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
            onParam={updateParam}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "rack-row-tool")
        .map((visual, index) => (
          <RackRowTool
            key={`rack-row-tool-${index}`}
            visual={visual}
            scaleX={module.width / definition.width}
            onAction={onRackRowAction}
            onDragStart={onRackRowDragStart}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "storage-scope")
        .map((visual, index) => (
          <RackStorageScope
            key={`storage-scope-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            params={module.params}
            cableColor={inputCableColors?.[visual.input]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "alikins-hover-bridge")
        .map((visual, index) => (
          <RackAlikinsHoverBridge
            key={`alikins-hover-bridge-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "kilpatrick-stereo-meter")
        .map((visual, index) => (
          <RackKilpatrickStereoMeter
            key={`kilpatrick-stereo-meter-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            refs={visual.refParams.map((id) => module.params[id] ?? 0)}
            scaleX={module.width / definition.width}
            onParam={updateParam}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "kilpatrick-test-osc")
        .map((visual, index) => (
          <RackKilpatrickTestOsc
            key={`kilpatrick-test-osc-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "kilpatrick-joystick")
        .map((visual, index) => (
          <RackKilpatrickJoystick
            key={`kilpatrick-joystick-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            reset={(module.params[visual.resetParam] ?? 0) > 0.5}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "sapphire-moots")
        .map((visual, index) => (
          <RackSapphireMoots
            key={`sapphire-moots-${index}`}
            visual={visual}
            state={module.state ?? []}
            scaleX={module.width / definition.width}
            onState={onState}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "sapphire-output-selector")
        .map((visual, index) => (
          <RackSapphireOutputSelector
            key={`sapphire-output-selector-${index}`}
            visual={visual}
            state={module.state ?? []}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onState={onState}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "modllz-kn8b")
        .map((visual, index) => (
          <RackMoDllzKn8bLcd
            key={`modllz-kn8b-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "modllz-midi-poly-mpe")
        .map((visual, index) => (
          <RackMoDllzMidiPolyMpeLcd
            key={`modllz-midi-poly-mpe-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "modllz-xpand")
        .map((visual, index) => (
          <RackMoDllzXpandLcd
            key={`modllz-xpand-${index}`}
            visual={visual}
            state={module.state ?? []}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onState={onState}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "alefsbits-panel")
        .map((visual, index) => (
          <RackAlefsbitsPanel
            key={`alefsbits-panel-${index}`}
            modelKey={definition.key}
            assetBase={visual.assetBase}
            panelFile={visual.panelFile}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "alefsbits-turnt")
        .map((visual, index) => (
          <RackAlefsbitsTurnt
            key={`alefsbits-turnt-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            maxPoints={visual.maxPoints}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "scope")
        .map((visual, index) => (
          <RackScopeDisplay
            key={`scope-${index}`}
            x={scopeSamples?.[0]}
            y={scopeSamples?.[1]}
            lissajous={(module.params[5] ?? 0) > 0.5}
            gainX={module.params[0] ?? 0}
            gainY={module.params[2] ?? 0}
            offsetX={module.params[1] ?? 0}
            offsetY={module.params[3] ?? 0}
            threshold={module.params[6] ?? 0}
            triggerEnabled={(module.params[7] ?? 1) < 0.5}
            width={(visual.width * module.width) / definition.width}
            height={visual.height}
            left={(visual.x * module.width) / definition.width}
            top={visual.y}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "native-signal")
        .map((visual, index) => (
          <RackNativeSignalDisplay
            key={`native-signal-${index}`}
            samples={scopeSamples}
            mode={visual.mode}
            colors={visual.colors}
            strokeWidths={visual.strokeWidths}
            backgroundColor={visual.backgroundColor}
            gridColor={visual.gridColor}
            range={visual.range}
            stacked={visual.stacked}
            bipolar={visual.bipolar}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "native-interaction")
        .map((visual, index) => (
          <RackNativeInteraction
            key={`native-interaction-${index}`}
            visual={visual}
            params={module.params}
            state={module.state ?? []}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onParam={updateParam}
            onState={onState}
            onAction={onVisualAction}
            onLoadAsset={onLoadAsset}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "digital-programmer")
        .map((visual, index) => (
          <RackDigitalProgrammer
            key={`digital-programmer-${index}`}
            visual={visual}
            state={module.state ?? []}
            data={rackData}
            scaleX={module.width / definition.width}
            onState={onState}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "palette-engine-selector")
        .map((visual, index) => (
          <RackPaletteEngineSelector
            key={`palette-engine-selector-${index}`}
            values={scopeSamples?.[0]}
            positions={visual.positions}
            actionBase={visual.actionBase}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "signal-function-set")
        .map((visual, index) => (
          <RackSignalFunctionSetDisplay
            key={`signal-function-set-${visual.model}-${index}`}
            values={scopeSamples?.[0]}
            model={visual.model}
            actionBase={visual.actionBase}
            eventShift={visual.eventShift}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "touch-ribbon")
        .map((visual, index) => (
          <RackTouchRibbon
            key={`touch-ribbon-${index}`}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            octaves={module.params[visual.octavesParam] ?? 1}
            showGuides={
              (module.state?.[visual.showGuidesState] ??
                definition.stateKeys?.[visual.showGuidesState]?.default ??
                1) > 0.5
            }
            guideType={
              module.state?.[visual.guideTypeState] ??
              definition.stateKeys?.[visual.guideTypeState]?.default ??
              0
            }
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "linear-ribbon")
        .map((visual, index) => (
          <RackLinearRibbon
            key={`linear-ribbon-${index}`}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            margin={visual.margin}
            radius={visual.radius}
            color={visual.color}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "voxglitch-xy")
        .map((visual, index) => (
          <RackVoxglitchXy
            key={`voxglitch-xy-${index}`}
            values={scopeSamples?.[0]}
            tabletMode={
              (module.state?.[visual.tabletModeState] ??
                definition.stateKeys?.[visual.tabletModeState]?.default ??
                0) > 0.5
            }
            actionBase={visual.actionBase}
            hoverActionBase={visual.hoverActionBase}
            actionSteps={visual.actionSteps}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "param-xy-points")
        .map((visual, index) => (
          <RackParamXyPoints
            key={`param-xy-points-${index}`}
            params={module.params}
            samples={scopeSamples}
            points={visual.points}
            widthParam={visual.widthParam}
            heightParam={visual.heightParam}
            gridSize={visual.gridSize}
            pointSize={visual.pointSize}
            gridColor={visual.gridColor}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onParam={updateParam}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "crawl-display")
        .map((visual, index) => (
          <RackCrawlDisplay
            key={`crawl-display-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            maxPoints={visual.maxPoints}
            crawlerCount={visual.crawlerCount}
            colors={visual.colors}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "cell-grid")
        .map((visual, index) => (
          <RackCellGrid
            key={`cell-grid-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            maxCells={visual.maxCells}
            packedWordBits={visual.packedWordBits}
            cellScale={visual.cellScale}
            onColor={visual.onColor}
            antColor={visual.antColor}
            shadowColor={visual.shadowColor}
            monitorFuzz={visual.monitorFuzz}
            reflection={visual.reflection}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "sequencer-grid")
        .map((visual, index) => (
          <RackSequencerGrid
            key={`sequencer-grid-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            rows={visual.rows}
            columns={visual.columns}
            trackRows={visual.trackRows}
            colors={visual.colors}
            gridColor={visual.gridColor}
            markerColor={visual.markerColor}
            majorEvery={visual.majorEvery}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "phase-distortion-pad")
        .map((visual, index) => (
          <RackPhaseDistortionPad
            key={`phase-distortion-pad-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "walk2-display")
        .map((visual, index) => (
          <RackWalk2Display
            key={`walk2-display-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "vertical-position")
        .map((visual, index) => (
          <RackVerticalPosition
            key={`vertical-position-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "mouse-seq-grid")
        .map((visual, index) => (
          <RackMouseSeqGrid
            key={`mouse-seq-grid-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            hotkeyBase={visual.hotkeyBase}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "cyclic-ca")
        .map((visual, index) => (
          <RackCyclicCaDisplay
            key={`cyclic-ca-${index}`}
            values={scopeSamples?.[0]}
            cellsPerWord={visual.cellsPerWord}
            bitsPerCell={visual.bitsPerCell}
            pixelWidth={visual.pixelWidth}
            pixelHeight={visual.pixelHeight}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "db-matrix")
        .map((visual, index) => (
          <RackDbMatrixDisplay
            key={`db-matrix-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            maxRows={visual.maxRows}
            mode={visual.mode}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "flame-spectrogram")
        .map((visual, index) => (
          <RackFlameSpectrogram
            key={`flame-spectrogram-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            columns={visual.columns}
            rows={visual.rows}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "path-trackpad")
        .map((visual, index) => (
          <RackPathTrackpad
            key={`path-trackpad-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "digital-sequencer")
        .map((visual, index) => (
          <RackDigitalSequencer
            key={`digital-sequencer-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            valueSteps={visual.valueSteps}
            columns={visual.columns}
            sequencers={visual.sequencers}
            voltageHeight={visual.voltageHeight}
            gateTop={visual.gateY - visual.y}
            gateHeight={visual.gateHeight}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "hazumi-sequencer")
        .map((visual, index) => (
          <RackHazumiDisplay
            key={`hazumi-sequencer-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "stoch-sequencer")
        .map((visual, index) => (
          <RackStochSequencer
            key={`stoch-sequencer-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            sequences={visual.sequences}
            displays={visual.displays}
            banks={visual.banks}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "bidoo-sample")
        .map((visual, index) => (
          <RackBidooSampleDisplay
            key={`bidoo-sample-${visual.mode}-${index}`}
            values={scopeSamples?.[0]}
            mode={visual.mode}
            actionBase={visual.actionBase}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "bidoo-limonade")
        .map((visual, index) => (
          <RackBidooLimonadeDisplay
            key={`bidoo-limonade-${visual.mode}-${index}`}
            values={scopeSamples?.[0]}
            mode={visual.mode}
            actionBase={visual.actionBase}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "fw-cell-bar-grid")
        .map((visual, index) => (
          <RackFwCellBarGrid
            key={`fw-cell-bar-grid-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "filling-station")
        .map((visual, index) => (
          <RackFillingStationDisplay
            key={`filling-station-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "qar-rhythm")
        .map((visual, index) => (
          <RackQarRhythmDisplay
            key={`qar-rhythm-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            accentActionBase={visual.accentActionBase}
            maxSteps={visual.maxSteps}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "cellular-auto")
        .map((visual, index) => (
          <RackCellularAutoDisplay
            key={`cellular-auto-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            columns={visual.columns}
            rows={visual.rows}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "saros-envelope")
        .map((visual, index) => (
          <RackSarosEnvelope
            key={`saros-envelope-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            actionSteps={visual.actionSteps}
            tableSize={visual.tableSize}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "trg-sequencer")
        .map((visual, index) => (
          <RackTrgSequencer
            key={`trg-sequencer-${index}`}
            values={scopeSamples?.[0]}
            actionBase={visual.actionBase}
            steps={visual.steps}
            pageSize={visual.pageSize}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "polar-cv-display")
        .map((visual, index) => (
          <RackPolarCvDisplay
            key={`polar-cv-display-${index}`}
            values={scopeSamples?.[0]}
            points={visual.points}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "axioma-display")
        .map((visual, index) => (
          <RackAxiomaDisplay
            key={`axioma-display-${visual.mode}-${index}`}
            mode={visual.mode}
            values={scopeSamples?.[0]}
            points={visual.points}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "alias-display")
        .map((visual, index) => (
          <RackAliasDisplay
            key={`alias-display-${index}`}
            values={scopeSamples?.[0]}
            steps={visual.steps}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "chord-chemist-display")
        .map((visual, index) => (
          <RackChordChemistDisplay
            key={`chord-chemist-display-${index}`}
            values={scopeSamples?.[0]}
            steps={visual.steps}
            root={visual.root}
            scale={visual.scale}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "runshow-display")
        .map((visual, index) => (
          <RackRunshowDisplay
            key={`runshow-display-${index}`}
            values={scopeSamples?.[0]}
            maxParam={visual.maxParam}
            time={visual.time}
            bars={visual.bars}
            scaleX={module.width / definition.width}
            onParam={updateParam}
            onParamReset={onParamReset}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "sd-lines-display")
        .map((visual, index) => (
          <RackSdLinesDisplay
            key={`sd-lines-display-${index}`}
            values={scopeSamples?.[0]}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "note-poly-display")
        .map((visual, index) => (
          <RackNotePolyDisplay
            key={`note-poly-display-${index}`}
            values={scopeSamples?.[0]}
            channels={visual.channels}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            rowHeight={visual.rowHeight}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "lofi-tv-display")
        .map((visual, index) => (
          <RackLofiTvDisplay
            key={`lofi-tv-display-${index}`}
            values={scopeSamples?.[0]}
            columns={visual.columns}
            rows={visual.rows}
            cellSize={visual.cellSize}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "cosmic-clock-display")
        .map((visual, index) => (
          <RackCosmicClockDisplay
            key={`cosmic-clock-display-${index}`}
            values={scopeSamples?.[0]}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "lua-display")
        .map((visual, index) => (
          <RackLuaDisplay
            key={`lua-display-${index}`}
            values={scopeSamples?.[0]}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "catro-color-display")
        .map((visual, index) => (
          <RackCatroColorDisplay
            key={`catro-color-display-${index}`}
            values={scopeSamples?.[0]}
            layers={visual.layers}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "panel-color")
        .map((visual, index) => (
          <RackPanelColor
            key={`panel-color-${index}`}
            values={scopeSamples?.[0]}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "vertical-label")
        .map((visual, index) => (
          <RackVerticalLabel
            key={`vertical-label-${index}`}
            text={String(rackData[visual.dataKey] ?? visual.defaultText)}
            maximumLength={visual.maximumLength}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "value-label")
        .map((visual, index) => (
          <RackValueLabel
            key={`value-label-${index}`}
            value={scopeSamples?.[0]?.[visual.offset] ?? 0}
            {...visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "dot-matrix-text")
        .map((visual, index) => (
          <RackDotMatrixText
            key={`dot-matrix-text-${index}`}
            data={rackData}
            visual={visual}
            scaleX={module.width / definition.width}
            onData={onData}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "spellbook-editor")
        .map((visual, index) => (
          <RackSpellbookEditor
            key={`spellbook-editor-${index}`}
            data={rackData}
            visual={visual}
            scaleX={module.width / definition.width}
            onData={onData}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter(
          (visual): visual is Extract<RuntimeVisual, { kind: "editable-text" }> =>
            visual.kind === "editable-text" && !visual.contextOnly,
        )
        .map((visual, index) => (
          <RackEditableText
            key={`editable-text-${index}`}
            data={rackData}
            state={module.state}
            params={module.params}
            visual={visual}
            scaleX={module.width / definition.width}
            onData={onData}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "specific-value")
        .map((visual, index) => (
          <RackSpecificValue
            key={`specific-value-${index}`}
            value={module.params[visual.param] ?? 0}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onValue={(value) => updateParam(visual.param, value)}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "computerscare-figure")
        .map((visual, index) => (
          <RackComputerscareFigure
            key={`computerscare-figure-${index}`}
            values={scopeSamples?.[0]}
            {...visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "computerscare-blank")
        .map((visual, index) => (
          <RackComputerscareBlank
            key={`computerscare-blank-${index}`}
            asset={selectedAsset}
            state={module.state ?? []}
            stateKeys={visual.stateKeys}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
            onLoad={onLoadAsset}
            onState={onState}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "dress-me-up")
        .map((visual, index) => (
          <RackDressMeUp
            key={`dress-me-up-${index}`}
            values={scopeSamples?.[0]}
            state={module.state ?? []}
            {...visual}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition.runtime?.visuals
        ?.filter((visual) => visual.kind === "portaloof")
        .map((visual, index) => (
          <RackPortaloof
            key={`portaloof-${index}`}
            asset={selectedAsset}
            values={scopeSamples?.[0]}
            params={module.params}
            data={rackData}
            {...visual}
            scaleX={module.width / definition.width}
            onLoad={onLoadAsset}
            onParam={updateParam}
            onData={onData}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "octobir-display")
        .map((visual, index) => (
          <RackOctobirDisplay
            key={`octobir-display-${index}`}
            values={scopeSamples?.[0]?.slice(visual.offset)}
            filenames={[module.assets?.[0]?.name, module.assets?.[1]?.name]}
            dynamic={(module.params[6] ?? 0) > 0.5}
            threshold={scopeSamples?.[0]?.[visual.offset + 4] ?? module.params[8] ?? -30}
            range={scopeSamples?.[0]?.[visual.offset + 5] ?? module.params[9] ?? 20}
            scaleX={module.width / definition.width}
            onLoad={onLoadAssetSlot}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "rkd-dividers")
        .map((visual, index) => (
          <RackRkdDividers
            key={`rkd-dividers-${index}`}
            values={scopeSamples?.[0]?.slice(visual.offset)}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "klokspid-dmd")
        .map((visual, index) => (
          <RackKlokSpidDmd
            key={`klokspid-dmd-${index}`}
            values={scopeSamples?.[0]?.slice(visual.offset)}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "multi-meter")
        .map((visual, index) => (
          <RackMultiMeterDisplay
            key={`multi-meter-${index}`}
            samples={scopeSamples}
            mode={module.params[visual.modeParam] ?? 0}
            channelsMode={module.params[visual.channelsParam] ?? 0}
            refs={module.params.slice(2, 18)}
            x={(visual.x * module.width) / definition.width}
            y={visual.y}
            width={(visual.width * module.width) / definition.width}
            height={visual.height}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "spectrum-analyzer" || visual.kind === "spectrogram")
        .map((visual, index) => (
          <RackSpectrumDisplay
            key={`${visual.kind}-${index}`}
            kind={visual.kind}
            samples={scopeSamples}
            params={module.params}
            state={module.state}
            running={(renderedLightValues[0] ?? 1) > 0.5}
            colors={visual.kind === "spectrum-analyzer" ? visual.colors : undefined}
            axisColor={visual.kind === "spectrum-analyzer" ? visual.axisColor : undefined}
            textColor={visual.kind === "spectrum-analyzer" ? visual.textColor : undefined}
            lineWidth={visual.kind === "spectrum-analyzer" ? visual.lineWidth : undefined}
            fillAlpha={visual.kind === "spectrum-analyzer" ? visual.fillAlpha : undefined}
            freeze={visual.kind === "spectrum-analyzer" ? visual.freeze : undefined}
            profile={visual.kind === "spectrum-analyzer" ? visual.profile : undefined}
            rangeMode={visual.kind === "spectrum-analyzer" ? visual.rangeMode : undefined}
            stateKeys={visual.kind === "spectrum-analyzer" ? visual.stateKeys : undefined}
            x={(visual.x * module.width) / definition.width}
            y={visual.y}
            width={(visual.width * module.width) / definition.width}
            height={visual.height}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "cella-frequency-analyzer")
        .map((visual, index) => (
          <CellaFrequencyAnalyzerDisplay
            key={`cella-frequency-analyzer-${index}`}
            samples={scopeSamples}
            params={module.params}
            state={module.state}
            x={(visual.x * module.width) / definition.width}
            y={visual.y}
            width={(visual.width * module.width) / definition.width}
            height={visual.height}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "cv-note")
        .map((visual, index) => (
          <RackCvNoteDisplay
            key={`cv-note-${index}`}
            samples={scopeSamples?.[0]}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "note-meter")
        .map((visual, index) => (
          <RackNoteMeterDisplay
            key={`note-meter-${index}`}
            samples={scopeSamples}
            params={module.params}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            rowHeight={visual.rowHeight}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "bpm-display")
        .map((visual, index) => (
          <RackBpmDisplay
            key={`bpm-display-${index}`}
            samples={scopeSamples?.[0]}
            params={module.params}
            styleParam={visual.styleParam}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "midi-log")
        .map((visual, index) => (
          <pre
            key={`midi-log-${index}`}
            className="pw-midi-log"
            aria-label={t("visual.midiLog")}
            style={{
              left: (visual.x * module.width) / definition.width,
              top: visual.y,
              width: (visual.width * module.width) / definition.width,
              height: visual.height,
            }}
          >
            {rackMidiLogText(scopeSamples?.[0], visual.rows, visual.columns)}
          </pre>
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "light-matrix")
        .map((visual, index) => (
          <RackLightMatrixDisplay
            key={`light-matrix-${index}`}
            values={renderedLightValues}
            lightStart={visual.lightStart}
            columns={visual.columns}
            rows={visual.rows}
            channels={visual.channels}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "hex-looper")
        .map((visual, index) => (
          <RackHexLooperDisplay
            key={`hex-looper-${index}`}
            values={scopeSamples?.[0]}
            radius={visual.radius}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "wavetable-display")
        .map((visual, index) => (
          <RackWavetableDisplay
            key={`wavetable-display-${index}`}
            values={scopeSamples?.[0]}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "wolfram-display")
        .map((visual, index) => (
          <RackWolframDisplay
            key={`wolfram-display-${index}`}
            values={scopeSamples?.[0]}
            {...visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "segment")
        .map((visual, index) => (
          <RackSegmentDisplay
            key={`segment-${index}`}
            value={module.params[visual.param] ?? 0}
            values={visual.values}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "param-numeric-display")
        .map((visual, index) => (
          <RackParamNumericDisplay
            key={`param-numeric-display-${index}`}
            value={module.params[visual.param] ?? 0}
            digits={visual.digits}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "elementary-ca")
        .map((visual, index) => (
          <RackElementaryCaDisplay
            key={`elementary-ca-${index}`}
            samples={scopeSamples}
            params={module.params}
            {...visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "piano-keyboard")
        .map((visual, index) => (
          <RackPianoKeyboard
            key={`piano-keyboard-${index}`}
            {...visual}
            values={renderedLightValues}
            scaleX={module.width / definition.width}
            onMomentary={onMomentary}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "four-view-display")
        .map((visual, index) => (
          <RackFourViewDisplay
            key={`four-view-display-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            params={module.params}
            state={module.state}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "note-echo-display")
        .map((visual, index) => (
          <RackNoteEchoDisplay
            key={`note-echo-display-${index}`}
            {...visual}
            params={module.params}
            wetOnly={(renderedLightValues[0] ?? 0) > 0.5}
            notifiedParam={paramNotice?.id ?? null}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "note-loop-display")
        .map((visual, index) => (
          <RackNoteLoopDisplay
            key={`note-loop-display-${index}`}
            value={module.params[visual.param] ?? 0}
            {...visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "phrase-seq-display")
        .map((visual, index) => (
          <RackPhraseSeqDisplay
            key={`phrase-seq-display-${index}`}
            values={scopeSamples?.[0]}
            {...visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "scribble-strip")
        .map((visual, index) => {
          const text = String(rackData[visual.dataKey] ?? visual.defaultText),
            fromTop = Boolean(
              module.state?.[visual.orientationState] ??
              definition.stateKeys?.[visual.orientationState]?.default ??
              0,
            );
          return (
            <div
              key={`scribble-strip-${index}`}
              className={`pw-scribble-strip-display ${fromTop ? "from-top" : "from-bottom"}`}
              aria-label={t("visual.scribbleStripLabel", { text })}
              style={{
                left: (visual.x * module.width) / definition.width,
                top: visual.y,
                width: (visual.width * module.width) / definition.width,
                height: visual.height,
              }}
            >
              <span>{text}</span>
            </div>
          );
        })}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "bouncy-balls")
        .map((visual, index) => (
          <RackBouncyBallsDisplay
            key={`bouncy-balls-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onState={onState}
            onMomentary={onMomentary}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "sort-step")
        .map((visual, index) => (
          <RackSortStepDisplay
            key={`sort-step-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "bacon-footer")
        .map((visual, index) => (
          <RackBaconFooter
            key={`bacon-footer-${index}`}
            visual={visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "lint-buddy")
        .map((visual, index) => (
          <RackLintBuddy
            key={`lint-buddy-${index}`}
            visual={visual}
            scaleX={module.width / definition.width}
            target={lintBuddyTarget}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "jw-grid")
        .map((visual, index) => (
          <RackJwGrid
            key={`jw-grid-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "jw-d1v1de")
        .map((visual, index) => (
          <RackJwD1v1deDisplay
            key={`jw-d1v1de-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "jw-thing-thing")
        .map((visual, index) => (
          <RackJwThingThingDisplay
            key={`jw-thing-thing-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "jw-tree")
        .map((visual, index) => (
          <RackJwTreeDisplay
            key={`jw-tree-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "biset-tree")
        .map((visual, index) => (
          <RackBisetTreeDisplay
            key={`biset-tree-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "biset-regex")
        .map((visual, index) => (
          <RackBisetRegex
            key={`biset-regex-${index}`}
            visual={visual}
            data={rackData}
            params={module.params}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onData={onData}
            onAction={onVisualAction}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "biset-tracker")
        .map((visual, index) => (
          <RackBisetTracker
            key={`biset-tracker-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            params={module.params}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "biset-tracker-output")
        .map((visual, index) => (
          <RackBisetTrackerOutput
            key={`biset-tracker-output-${index}`}
            visual={visual}
            values={relatedScopeSamples?.[0]}
            paramValue={module.params[visual.synthParam] ?? 0}
            scaleX={module.width / definition.width}
            onParam={(value) => updateParam(visual.synthParam, value)}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "biset-tracker-state")
        .map((visual, index) => (
          <RackBisetTrackerState
            key={`biset-tracker-state-${index}`}
            visual={visual}
            values={relatedScopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "biset-blank-overlay")
        .map((visual, index) => (
          <RackBisetBlankPanel
            key={`biset-blank-panel-${index}`}
            module={module}
            visual={visual}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "flying-fader")
        .map((visual, index) => (
          <RackFlyingFader
            key={`flying-fader-${index}`}
            visual={visual}
            value={module.params[visual.param] ?? definition.params[visual.param]?.default ?? 1}
            capColor={
              module.state?.[visual.capColorState] ??
              definition.stateKeys?.[visual.capColorState]?.default ??
              0
            }
            text={String(rackData[visual.dataKey] ?? visual.defaultText)}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "algomorph-display")
        .map((visual, index) => (
          <RackAlgomorphDisplay
            key={`algomorph-display-${index}`}
            visual={visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onAction={onVisualAction}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "full-scope")
        .map((visual, index) => (
          <RackFullScopeDisplay
            key={`full-scope-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "madzine-scope")
        .map((visual, index) => (
          <RackMadzineScopeDisplay
            key={`madzine-scope-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "madzine-waveform")
        .map((visual, index) => (
          <RackMadzineWaveformDisplay
            key={`madzine-waveform-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            loopEnd={
              module.params[visual.loopEndParam] ??
              definition.params[visual.loopEndParam]?.default ??
              1
            }
            scaleX={module.width / definition.width}
            onLoopEnd={(value) => updateParam(visual.loopEndParam, value)}
            onLoopEndReset={() =>
              onParamReset(
                visual.loopEndParam,
                definition.params[visual.loopEndParam]?.default ?? 1,
              )
            }
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "universal-rhythm")
        .map((visual, index) => (
          <RackUniversalRhythmDisplay
            key={`universal-rhythm-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "song-mode-sequence")
        .map((visual, index) => (
          <input
            key={`song-mode-sequence-${index}`}
            className="pw-song-mode-sequence"
            aria-label={t("visual.playbackSequence")}
            type="text"
            spellCheck={false}
            value={String(rackData[visual.dataKey] ?? visual.defaultText)}
            style={{
              left: (visual.x * module.width) / definition.width,
              top: visual.y,
              width: (visual.width * module.width) / definition.width,
              height: visual.height,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            onChange={(event) => onData({ [visual.dataKey]: event.target.value })}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "madzine-launchpad")
        .map((visual, index) => (
          <RackMadzineLaunchpad
            key={`madzine-launchpad-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onMomentary={onMomentary}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "the-kick-sample")
        .map((visual, index) => (
          <RackTheKickSample
            key={`the-kick-sample-${index}`}
            {...visual}
            scaleX={module.width / definition.width}
            loaded={Boolean(selectedAsset) || Boolean(rackData.hasSample)}
            mode={Number(module.state?.[2] ?? rackData.modeValue ?? 0)}
            filename={selectedAsset?.name ?? String(rackData.samplePath ?? t("asset.defaultName"))}
            onLoad={onLoadAsset}
            onMomentary={onMomentary}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "madzine-manual")
        .map((visual, index) => (
          <RackMadzineManual
            key={`madzine-manual-${index}`}
            {...visual}
            help={definition.runtime?.manualHelp ?? {}}
            target={manualHelpTarget}
            languageValue={Number(rackData.language ?? 1)}
            fontSizeValue={Number(rackData.fontSize ?? 20)}
            scaleX={module.width / definition.width}
            onData={onData}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "ml-arpeggiator")
        .map((visual, index) => (
          <RackMlArpeggiatorDisplay
            key={`ml-arpeggiator-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "corrupter-display")
        .map((visual, index) => (
          <RackCorrupterDisplay
            key={`corrupter-display-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "tapestry-display")
        .map((visual, index) => (
          <RackTapestryDisplay
            key={`tapestry-display-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onMomentary={onMomentary}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "morph-pad")
        .map((visual, index) => (
          <RackMorphPadDisplay
            key={`morph-pad-${index}`}
            {...visual}
            xValue={module.params[visual.xParam] ?? 0}
            yValue={module.params[visual.yParam] ?? 0}
            scaleX={module.width / definition.width}
            onParam={updateParam}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "xy-pad")
        .map((visual, index) => (
          <RackXYPadDisplay
            key={`xy-pad-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onParam={updateParam}
            onMomentary={onMomentary}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "wavetable-editor")
        .map((visual, index) => (
          <RackWavetableEditor
            key={`wavetable-editor-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
            onMomentary={onMomentary}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "racknes-screen")
        .map((visual, index) => (
          <RackNesScreenDisplay
            key={`racknes-screen-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "speck-spectrum")
        .map((visual, index) => (
          <RackSpeckSpectrumDisplay
            key={`speck-spectrum-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            params={module.params}
            linLog={(renderedLightValues[1] ?? 0) > 0.5}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "integral-flux-preview")
        .map((visual, index) => (
          <RackIntegralFluxPreview
            key={`integral-flux-preview-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "proc-preview")
        .map((visual, index) => (
          <RackIntegralFluxPreview
            key={`proc-preview-${index}`}
            {...visual}
            channel={1}
            label="Proc"
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "temporal-deck")
        .map((visual, index) => (
          <RackTemporalDeckDisplay
            key={`temporal-deck-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            lights={renderedLightValues}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "td-scope")
        .map((visual, index) => (
          <RackTdScopeDisplay
            key={`td-scope-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            state={module.state}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "undertow-preview")
        .map((visual, index) => (
          <RackUndertowPreview
            key={`undertow-preview-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "lomas-sampler")
        .map((visual, index) => (
          <RackLomasSamplerDisplay
            key={`lomas-sampler-${index}`}
            {...visual}
            values={scopeSamples?.[0]}
            scaleX={module.width / definition.width}
          />
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "less-mess-labels")
        .map((visual, index) => (
          <div
            key={`less-mess-labels-${index}`}
            className="pw-less-mess-labels"
            style={{
              left: (visual.x * module.width) / definition.width,
              top: visual.y,
              width: (visual.width * module.width) / definition.width,
            }}
          >
            {Array.from({ length: visual.rows }, (_, row) => {
              const key = `${visual.dataKeyPrefix}${row}`;
              return (
                <input
                  key={key}
                  aria-label={t("visual.cableLabel", { row: row + 1 })}
                  type="text"
                  value={String(rackData[key] ?? "")}
                  style={{ top: row * visual.rowHeight, height: visual.height }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onChange={(event) => onData({ [key]: event.target.value })}
                />
              );
            })}
          </div>
        ))}
      {definition?.runtime?.visuals
        ?.filter((visual) => visual.kind === "audio-display")
        .map((visual, index) => (
          <RackAudioDisplay
            key={`audio-display-${index}`}
            audio={audioData}
            running={audioRunning}
            channels={visual.channels}
            x={visual.x}
            y={visual.y}
            width={visual.width}
            height={visual.height}
            scaleX={module.width / definition.width}
          />
        ))}
    </>
  );
}
