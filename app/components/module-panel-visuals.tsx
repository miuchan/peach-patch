import type { ModuleInstance, SampleAssetRef } from "../../lib/patch-types";
import { rackMidiLogText } from "../../lib/rack-module-panel-data";
import type { WebPluginModule } from "../../lib/web-plugin-registry";
import { CellaFrequencyAnalyzerDisplay } from "./cella-frequency-analyzer-display";
import { RackAudioDisplay } from "./rack-audio-display";
import { RackBouncyBallsDisplay } from "./rack-bouncy-balls-display";
import { RackBpmDisplay } from "./rack-bpm-display";
import { RackCorrupterDisplay } from "./rack-corrupter-display";
import { RackCvNoteDisplay } from "./rack-cv-note-display";
import { RackElementaryCaDisplay } from "./rack-elementary-ca-display";
import { RackFourViewDisplay } from "./rack-four-view-display";
import { RackFullScopeDisplay } from "./rack-full-scope-display";
import { RackHexLooperDisplay } from "./rack-hex-looper-display";
import { RackIntegralFluxPreview } from "./rack-integral-flux-preview";
import { RackKlokSpidDmd } from "./rack-klokspid-dmd";
import { RackLightMatrixDisplay } from "./rack-light-matrix-display";
import { RackLomasSamplerDisplay } from "./rack-lomas-sampler-display";
import { RackMadzineLaunchpad } from "./rack-madzine-launchpad";
import { RackMadzineManual, type MadzineManualTarget } from "./rack-madzine-manual";
import { RackMadzineScopeDisplay } from "./rack-madzine-scope-display";
import { RackMadzineWaveformDisplay } from "./rack-madzine-waveform-display";
import { RackMlArpeggiatorDisplay } from "./rack-ml-arpeggiator-display";
import { RackMorphPadDisplay } from "./rack-morph-pad-display";
import { RackMultiMeterDisplay } from "./rack-multi-meter-display";
import { RackNesScreenDisplay } from "./rack-nes-screen-display";
import { RackNoteEchoDisplay } from "./rack-note-echo-display";
import { RackNoteLoopDisplay } from "./rack-note-loop-display";
import { RackNoteMeterDisplay } from "./rack-note-meter-display";
import { RackOctobirDisplay } from "./rack-octobir-display";
import { RackParamNumericDisplay } from "./rack-param-numeric-display";
import { RackPhraseSeqDisplay } from "./rack-phrase-seq-display";
import { RackPianoKeyboard } from "./rack-piano-keyboard";
import { RackRkdDividers } from "./rack-rkd-dividers";
import { RackScopeDisplay } from "./rack-scope-display";
import { RackSegmentDisplay } from "./rack-segment-display";
import { RackSpeckSpectrumDisplay } from "./rack-speck-spectrum-display";
import { RackSpectrumDisplay } from "./rack-spectrum-display";
import { RackTapestryDisplay } from "./rack-tapestry-display";
import { RackTdScopeDisplay } from "./rack-td-scope-display";
import { RackTemporalDeckDisplay } from "./rack-temporal-deck-display";
import { RackTheKickSample } from "./rack-the-kick-sample";
import { RackUndertowPreview } from "./rack-undertow-preview";
import { RackUniversalRhythmDisplay } from "./rack-universal-rhythm-display";
import { RackWavetableDisplay } from "./rack-wavetable-display";
import { RackWavetableEditor } from "./rack-wavetable-editor";
import { RackWolframDisplay } from "./rack-wolfram-display";
import { RackXYPadDisplay } from "./rack-xy-pad-display";
import { useI18n } from "../i18n/provider";

type ModulePanelVisualsProps = {
  module: ModuleInstance;
  definition?: WebPluginModule;
  scopeSamples?: number[][];
  renderedLightValues: number[];
  rackData: Record<string, unknown>;
  audioData?: Record<string, unknown>;
  audioRunning: boolean;
  selectedAsset?: SampleAssetRef;
  paramNotice: { id: number; serial: number } | null;
  manualHelpTarget: MadzineManualTarget | null;
  onLoadAsset: () => void;
  onLoadAssetSlot: (slot: number) => void;
  onParam: (id: number, value: number) => void;
  onParamReset: (id: number, value: number) => void;
  onMomentary: (id: number, active: boolean) => void;
  onState: (updates: Array<[id: number, value: number]>) => void;
  onData: (data: Record<string, unknown>) => void;
};

export function ModulePanelVisuals({
  module,
  definition,
  scopeSamples,
  renderedLightValues,
  rackData,
  audioData,
  audioRunning,
  selectedAsset,
  paramNotice,
  manualHelpTarget,
  onLoadAsset,
  onLoadAssetSlot,
  onParam: updateParam,
  onParamReset,
  onMomentary,
  onState,
  onData,
}: ModulePanelVisualsProps) {
  const { t } = useI18n();
  if (!definition) return null;

  return (
    <>
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
