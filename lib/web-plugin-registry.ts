export type RackWidgetPosition = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex?: number;
  control?: "selector";
  centered?: boolean;
  widget?: string;
};
export type ParamSpec = {
  id: number;
  name: string;
  min: number;
  max: number;
  default: number;
  initial?: number;
  snap?: boolean;
  button?: boolean;
  unbounded?: boolean;
  hidden?: boolean;
  contextOnly?: boolean;
  values?: string[];
  position?: RackWidgetPosition;
  resetFrom?: { paramId: number; scale: number; offset: number };
  visibleWhenState?: { key: string; equals: number };
  visibleWhenInputConnection?: { ids: number[]; mode: "any" | "all"; connected: boolean };
};
export type PortSpec = {
  id: number;
  name: string;
  kind: "cv" | "gate" | "audio";
  hidden?: boolean;
  position?: RackWidgetPosition;
};
export type LightSpec = {
  id: number;
  widget: string;
  position: RackWidgetPosition;
  paramId?: number;
};
export type StateSpec = {
  key: string;
  type: "integer" | "real" | "boolean" | "string-enum";
  values?: string[];
  index?: number;
  path?: Array<number | string>;
  name?: string;
  default?: number;
  contextOnly?: boolean;
};
export type RuntimeStrategy =
  "ordered-translation" | "browser-dsp-adapter" | "rack-boundary" | "direct-rack-source-adapter";
export type ObjectExpanderContract = {
  family: string;
  role: "base" | "member";
  direction: "left" | "right";
  transport: "object-snapshot";
  type: number;
  maxMembers: number;
};
export type MessageExpanderContract = {
  transport: "message-buffer";
  direction: "both";
  capacity: number;
  models: Array<{ key: string; symbol: string; index: number }>;
};
export type ExpanderContract = ObjectExpanderContract | MessageExpanderContract;
export type ManualHelpText = { en: string; zh: string; ja: string };
export type ManualHelpModule = {
  name: string;
  description: ManualHelpText;
  entries: Array<{ name: string; text: ManualHelpText }>;
};
export type RuntimeVisual =
  | { kind: "scope"; inputs: [number, number]; width: number; height: number; x: number; y: number }
  | {
      kind: "multi-meter";
      inputs: [number, number, number];
      modeParam: number;
      channelsParam: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "spectrum-analyzer";
      inputs: number[];
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "cella-frequency-analyzer";
      inputs: [number, number];
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "spectrogram"; inputs: [number]; width: number; height: number; x: number; y: number }
  | { kind: "cv-note"; inputs: [number]; width: number; height: number; x: number; y: number }
  | {
      kind: "note-meter";
      inputs: number[];
      accidentalParam: number;
      modeParam: number;
      decimalsParam: number;
      styleParam: number;
      width: number;
      height: number;
      rowHeight: number;
      x: number;
      y: number;
    }
  | {
      kind: "bpm-display";
      inputs: [number];
      styleParam: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "light-matrix";
      lightStart: number;
      columns: number;
      rows: number;
      channels: 1 | 2 | 3;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "hex-looper"; radius: number; width: number; height: number; x: number; y: number }
  | { kind: "wavetable-display"; width: number; height: number; x: number; y: number }
  | { kind: "wolfram-display"; cells: number; width: number; height: number; x: number; y: number }
  | {
      kind: "segment";
      param: number;
      values: string[];
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "param-numeric-display";
      param: number;
      digits: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "elementary-ca";
      inputs: [number, number, number];
      ruleParam: number;
      seedParam: number;
      scaleParam: number;
      cells: number;
      scaleValues: string[];
      width: number;
      height: number;
      x: number;
      y: number;
      labelWidth: number;
      labelHeight: number;
      labelX: number;
      labelY: number;
    }
  | {
      kind: "piano-keyboard";
      actionBase: number;
      keys: number;
      voices: number;
      lightStart: number;
      lightStride?: number;
      lightVoiceStride?: number;
      lightChannels?: number;
      lightOrder?: "top-down" | "bottom-up";
      actionSteps?: number;
      fixedKeyOnDrag?: boolean;
      modifierBank?: "shift";
      width: number;
      height: number;
      x: number;
      y: number;
      layout?: "small" | "big";
      rightClick?: boolean;
    }
  | {
      kind: "four-view-display";
      modeParam: number;
      sharpState: number;
      rows: number;
      width: number;
      height: number;
      x: number;
      y: number;
      spacingY: number;
    }
  | {
      kind: "note-echo-display";
      tapParam: number;
      semiParam: number;
      cv2Param: number;
      probabilityParam: number;
      randomSemiParam: number;
      cv2ModeParam: number;
      polyParam: number;
      tap: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "note-loop-display";
      param: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "phrase-seq-display";
      digits?: number;
      label?: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "scribble-strip";
      dataKey: string;
      defaultText: string;
      orientationState: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "bouncy-balls";
      actionBase: number;
      paddleXState: number;
      paddleYState: number;
      displayWidth: number;
      displayHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "full-scope"; points: number; width: number; height: number; x: number; y: number }
  | {
      kind: "madzine-scope";
      points: number;
      tracks: number;
      range: number;
      colors: string[];
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "madzine-waveform";
      points: number;
      maxSlices: number;
      maxVoices: number;
      loopEndParam: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "universal-rhythm";
      steps: number;
      displayX: number;
      displayY: number;
      displayWidth: number;
      displayHeight: number;
      roleStartX: number;
      roleSpacing: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "song-mode-sequence";
      dataKey: string;
      defaultText: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "madzine-launchpad";
      actionBase: number;
      rows: number;
      columns: number;
      wavePoints: number;
      cellWidth: number;
      cellHeight: number;
      spacingX: number;
      spacingY: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "the-kick-sample";
      clearAction: number;
      modeActionBase: number;
      modeParam: number;
      loadX: number;
      loadY: number;
      loadWidth: number;
      loadHeight: number;
      labelX: number;
      labelY: number;
      labelWidth: number;
      labelHeight: number;
      modeX: number;
      modeY: number;
      modeWidth: number;
      modeHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "madzine-manual";
      displayX: number;
      displayY: number;
      displayWidth: number;
      displayHeight: number;
      languageX: number;
      languageY: number;
      languageWidth: number;
      languageHeight: number;
      decreaseX: number;
      increaseX: number;
      fontY: number;
      fontWidth: number;
      fontHeight: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      kind: "ml-arpeggiator";
      channels: number;
      rows: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "corrupter-display"; bins: number; width: number; height: number; x: number; y: number }
  | {
      kind: "tapestry-display";
      bins: number;
      maxSplices: number;
      actionBase: number;
      deleteActionBase: number;
      actionSteps: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "xy-pad";
      actionBase: number;
      xParam: number;
      yParam: number;
      displayWidth: number;
      displayHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "morph-pad";
      xParam: number;
      yParam: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "wavetable-editor";
      actionBase: number;
      tables: number;
      samples: number;
      bitDepth: number;
      width: number;
      height: number;
      gap: number;
      borderColor?: string;
      colors: string[];
      x: number;
      y: number;
    }
  | {
      kind: "racknes-screen";
      bufferWidth: number;
      bufferHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "speck-spectrum"; bins: number; width: number; height: number; x: number; y: number }
  | {
      kind: "integral-flux-preview";
      channel: 1 | 4;
      offset: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "proc-preview"; offset: number; width: number; height: number; x: number; y: number }
  | {
      kind: "temporal-deck";
      offset: number;
      lightStart: number;
      redLightStart: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "td-scope"; offset: number; width: number; height: number; x: number; y: number }
  | {
      kind: "undertow-preview";
      offset: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "octobir-display"; offset: number; width: number; height: number; x: number; y: number }
  | { kind: "rkd-dividers"; offset: number; width: number; height: number; x: number; y: number }
  | { kind: "klokspid-dmd"; offset: number; width: number; height: number; x: number; y: number }
  | { kind: "lomas-sampler"; offset: number; width: number; height: number; x: number; y: number }
  | {
      kind: "less-mess-labels";
      rows: number;
      dataKeyPrefix: string;
      width: number;
      height: number;
      rowHeight: number;
      x: number;
      y: number;
    }
  | {
      kind: "midi-log";
      rows: number;
      columns: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "audio-display";
      channels: 2 | 8 | 16;
      width: number;
      height: number;
      x: number;
      y: number;
    };

export type WebPluginModule = {
  key: string;
  plugin: string;
  model: string;
  name: string;
  brand: string;
  version: string;
  license: string;
  sourceUrl: string;
  libraryUrl: string;
  screenshotUrl: string;
  wasmUrl: string;
  manifestUrl?: string;
  sourceCommit?: string;
  artifact?: {
    sha256: string;
    size: number;
  };
  width: number;
  description: string;
  params: ParamSpec[];
  inputs: PortSpec[];
  outputs: PortSpec[];
  lights: number;
  lightWidgets?: LightSpec[];
  stateKeys?: StateSpec[];
  polyphonic?: boolean;
  bypassRoutes?: Array<[inputId: number, outputId: number]>;
  runtime?: {
    strategy?: RuntimeStrategy;
    initialMemory?: number;
    capture?: {
      format: "wav" | "midi";
      channels: "input-dependent" | 1;
      panelControlParam?: number;
    };
    asset?: {
      type: "audio" | "image" | "binary" | "midi" | "script";
      maxSamples: number;
      maxSeconds: number;
      channels: 1 | 2 | 4;
      slots?: number;
      url?: true;
    };
    midi?: { input?: true; output?: true };
    audio?: { channels: 2 | 8 | 16 };
    expanderMode?: "disconnected" | "host-snapshot" | "message-buffer";
    expander?: ExpanderContract;
    hostControl?: "rack-view";
    hotkey?: {
      scope: "module-hover";
      actionBase: number;
      recordParam: number;
      keyState: number;
      modsState: number;
    };
    manualHelp?: Record<string, ManualHelpModule>;
    visuals?: RuntimeVisual[];
  };
};
