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
  actionId?: number;
  dragActionId?: number;
  unbounded?: boolean;
  hidden?: boolean;
  contextOnly?: boolean;
  values?: string[];
  contextActions?: Array<{ id: number; name: string }>;
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
  bitmask?: Array<{ bit: number; name: string }>;
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
export type HoverBridgeContract =
  | {
      mode: "inspect";
      enableParam: number;
      rangeParam: number;
      rawParam: number;
      scaledParam: number;
    }
  | {
      mode: "inject";
      enableParam: number;
      rangeParam: number;
      input: number;
    };
export type GlobalPointerContract = {
  paramHoverOnlyParam?: number;
  modifiersState?: number;
  modifiersDefault?: number;
  wheel?: {
    downAction: number;
    upAction: number;
    lockMs: number;
  };
  middle?: {
    action: number;
    modeState?: number;
    modeDefault?: number;
    disabledValue?: number;
  };
};
export type ManualHelpText = { en: string; zh: string; ja: string };
export type ManualHelpModule = {
  name: string;
  description: ManualHelpText;
  entries: Array<{ name: string; text: ManualHelpText }>;
};
export type RuntimeInteractionCommand =
  | { target: "action"; id: number }
  | { target: "asset" }
  | { target: "commands"; commands: RuntimeInteractionCommand[] }
  | {
      target: "condition";
      source: "param" | "state" | "visual";
      id: number;
      equals: number;
      command?: RuntimeInteractionCommand;
      otherwise?: RuntimeInteractionCommand;
    }
  | {
      target: "menu";
      title: string;
      choices: Array<{ label: string; command: RuntimeInteractionCommand }>;
    }
  | {
      target: "param" | "state";
      id: number;
      operation: "toggle" | "cycle" | "set";
      value?: number;
      alternateValue?: number;
      minimum?: number;
      maximum?: number;
      step?: number;
      wrap?: boolean;
    };
export type RuntimeVisual =
  | {
      kind: "sloly-pit-routing";
      modeActionBase: number;
      selectActionBase: number;
      routeActionBase: number;
      truncateActionBase: number;
      replaceActionBase: number;
      appendActionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "probably-note-mn";
      maxPitches: number;
      fixedValues: number;
      pitchStride: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "voxglitch-arpseq";
      tabActionBase: number;
      barActionBase: number;
      sequenceActionBase: number;
      windowActionBase: number;
      toggleActionBase: number;
      controlActionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "rack-row-tool";
      inclusiveState: number;
      stripModeState: number;
      rows: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "storage-scope";
      input: number;
      colorParam: number;
      bins: number;
      headerValues: number;
      scopeHeight: number;
      info: { x: number; y: number; width: number; height: number };
      color: string;
      strokeWidth: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "alikins-hover-bridge";
      mode: "inspect" | "inject";
      fieldX: number;
      fieldY: [number, number, number, number, number];
      fieldWidth: number;
      fieldHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "kilpatrick-stereo-meter";
      refParams: [number, number];
      assetBase: string;
      font: { file: string; family: string };
      radius: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "kilpatrick-test-osc";
      wheelUpAction: number;
      wheelDownAction: number;
      assetBase: string;
      font: { file: string; family: string };
      radius: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "kilpatrick-joystick";
      actionBase: number;
      actionSteps: number;
      resetParam: number;
      controlAreaScale: number;
      knobRadius: number;
      knobColor: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "sapphire-moots";
      assetBase: string;
      controlModeState: number;
      rampingStates: number[];
      labelCenter: [number, number];
      labelHitSize: [number, number];
      buttonCenters: Array<[number, number]>;
      buttonSize: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "sapphire-output-selector";
      state: number;
      rows: number;
      rowBox: { x: number; y: number; width: number; height: number; pitch: number };
      hitFraction: number;
      arrow: { a: number; h: number; g: number; v: number; w: number };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "modllz-kn8b";
      actionBase: number;
      rows: number;
      rowHeight: number;
      displayHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "modllz-midi-poly-mpe";
      actionBase: number;
      valueActionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "modllz-xpand";
      state: number;
      choices: string[];
      choiceWidth: number;
      activeHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "scope"; inputs: [number, number]; width: number; height: number; x: number; y: number }
  | {
      kind: "alefsbits-panel";
      assetBase: string;
      panelFile: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "alefsbits-turnt";
      actionBase: number;
      maxPoints: number;
      topTabs: { x: number; y: number; width: number; height: number };
      scope: { x: number; y: number; width: number; height: number };
      bottomTabs: { x: number; y: number; width: number; height: number };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "native-signal";
      mode: "scope" | "xy" | "spectrum" | "meter";
      sources: Array<{ kind: "input" | "output"; id: number; channel?: number }>;
      colors: string[];
      strokeWidths: number[];
      backgroundColor?: string;
      gridColor?: string;
      range?: number;
      stacked?: boolean;
      bipolar?: boolean;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "native-interaction";
      assetBase?: string;
      font?: { file: string; family: string };
      regions: Array<{
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
        interactive?: boolean;
        hoverOnly?: boolean;
        dragSelect?: boolean;
        cursor?: "default" | "pointer" | "text" | "crosshair" | "ew-resize";
        title?: string;
        click?: RuntimeInteractionCommand;
        rightClick?: RuntimeInteractionCommand;
        doubleClick?: RuntimeInteractionCommand;
        wheelUp?: RuntimeInteractionCommand;
        wheelDown?: RuntimeInteractionCommand;
        shiftWheelUp?: RuntimeInteractionCommand;
        shiftWheelDown?: RuntimeInteractionCommand;
        display?: {
          source: "param" | "state" | "visual";
          id: number;
          format?:
            | "integer"
            | "signed-integer"
            | "midi-channel"
            | "midi-channel-any"
            | "midi-map"
            | "ascii";
          asciiLengthId?: number;
          digits?: number;
          secondary?: { source: "param" | "state" | "visual"; id: number };
          condition?: {
            source: "param" | "state" | "visual";
            id: number;
            equals: number;
            otherwiseText: string;
          };
          activeText?: {
            source: "param" | "state" | "visual";
            id: number;
            equals: number;
            text: string;
          };
          defaultValue?: number;
          text?: string;
          invalidWhenNonFinite?: boolean;
          invalidAtOrBelow?: number;
          clippedAtOrAbove?: number;
          clippedAgainst?: { source: "param" | "state" | "visual"; id: number };
          clippedColor?: string;
          dash?: { width: number; strokeWidth: number; color?: string };
          labels?: string[];
          colors?: string[];
          colorId?: number;
          hideValue?: boolean;
          scale?: number;
          precision?: number;
          prefix?: string;
          suffix?: string;
          activeId?: number;
          color: string;
          background?: string;
          borderColor?: string;
          activeBorderColor?: string;
          borderRadius?: number;
          fontSize: number;
          fontFamily?: string;
          fontWeight?: number;
          lineHeight?: number;
          textAlign?: "left" | "center" | "right";
          padding?: number;
          indicator?: {
            width: number;
            height: number;
            borderRadius?: number;
            color?: string;
            colors?: string[];
          };
        };
      }>;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "digital-programmer";
      banks: number;
      columns: number;
      stateBase: number;
      selectedBankState: number;
      actionBase: number;
      sliderPositions: Array<[x: number, y: number]>;
      sliderWidth: number;
      sliderHeight: number;
      bankPositions: Array<[x: number, y: number]>;
      bankWidth: number;
      bankHeight: number;
      dataKey: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "palette-engine-selector";
      actionBase: number;
      positions: Array<[x: number, y: number]>;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "signal-function-set";
      model: string;
      actionBase: number;
      eventShift: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "touch-ribbon";
      actionBase: number;
      actionSteps: number;
      octavesParam: number;
      showGuidesState: number;
      guideTypeState: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "linear-ribbon";
      actionBase: number;
      actionSteps: number;
      margin: number;
      radius: number;
      color: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "voxglitch-xy";
      actionBase: number;
      hoverActionBase: number;
      actionSteps: number;
      tabletModeState: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "param-xy-points";
      points: Array<{
        xParam: number;
        yParam: number;
        label: string;
        shape: "circle" | "square";
        color: string;
      }>;
      inputs?: [number, number];
      widthParam: number;
      heightParam: number;
      gridSize: number;
      pointSize: number;
      gridColor: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "crawl-display";
      actionBase: number;
      actionSteps: number;
      maxPoints: number;
      crawlerCount: number;
      colors: string[];
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "cell-grid";
      actionBase: number;
      actionSteps: number;
      maxCells: number;
      packedWordBits: number;
      cellScale: number;
      onColor: string;
      antColor?: string;
      shadowColor?: string;
      monitorFuzz?: boolean;
      reflection?: boolean;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "sequencer-grid";
      actionBase: number;
      rows: number;
      columns: number;
      trackRows: number;
      colors: string[];
      gridColor: string;
      markerColor: string;
      majorEvery: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "phase-distortion-pad";
      actionBase: number;
      actionSteps: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "walk2-display";
      actionBase: number;
      actionSteps: number;
      historyPoints: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "vertical-position";
      actionBase: number;
      actionSteps: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "mouse-seq-grid";
      actionBase: number;
      hotkeyBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "cyclic-ca";
      cellsPerWord: number;
      bitsPerCell: number;
      pixelWidth: number;
      pixelHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "db-matrix";
      actionBase: number;
      maxRows: number;
      mode: "continuous" | "binary" | "ant";
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "flame-spectrogram";
      actionBase: number;
      columns: number;
      rows: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "path-trackpad";
      actionBase: number;
      actionSteps: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "digital-sequencer";
      actionBase: number;
      valueSteps: number;
      columns: number;
      sequencers: number;
      voltageX: number;
      voltageY: number;
      voltageWidth: number;
      voltageHeight: number;
      gateX: number;
      gateY: number;
      gateWidth: number;
      gateHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "hazumi-sequencer";
      actionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "stoch-sequencer";
      actionBase: number;
      sequences: number;
      displays: Array<{ x: number; y: number; width: number; height: number }>;
      banks?: { x: number; y: number; width: number; height: number; count: number };
    }
  | {
      kind: "bidoo-sample";
      mode: "canard" | "edsaros" | "ouaive";
      actionBase?: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "bidoo-limonade";
      mode: "bins" | "wavetable";
      actionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "fw-cell-bar-grid";
      actionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "filling-station";
      actionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "qar-rhythm";
      actionBase: number;
      accentActionBase: number;
      maxSteps: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "cellular-auto";
      actionBase: number;
      columns: number;
      rows: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "saros-envelope";
      actionBase: number;
      actionSteps: number;
      tableSize: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "trg-sequencer";
      actionBase: number;
      steps: number;
      pageSize: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "polar-cv-display";
      points: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "axioma-display";
      mode: "ikeda" | "rhodonea" | "tesseract" | "bifurcation" | "cobweb";
      points: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "alias-display";
      steps: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "chord-chemist-display";
      steps: number;
      root: { x: number; y: number; width: number; height: number };
      scale: { x: number; y: number; width: number; height: number };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "runshow-display";
      maxParam: number;
      time: { x: number; y: number; width: number; height: number };
      bars: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: "sd-lines-display";
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "note-poly-display";
      channels: number;
      rowHeight: number;
      width: number;
      x: number;
      y: number;
    }
  | {
      kind: "lofi-tv-display";
      columns: number;
      rows: number;
      cellSize: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "cosmic-clock-display";
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "lua-display";
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "catro-color-display";
      width: number;
      height: number;
      x: number;
      y: number;
      layers: Array<{
        shape: "rect" | "circle" | "meter";
        signal: number;
        active: number;
        mode: number;
        x: number;
        y: number;
        width: number;
        height: number;
        alpha: number;
        yStart?: number;
        ySize?: number;
      }>;
    }
  | {
      kind: "panel-color";
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "vertical-label";
      dataKey: string;
      defaultText: string;
      maximumLength: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "value-label";
      offset: number;
      color: string;
      background: string;
      borderColor?: string;
      fontSize: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "dot-matrix-text";
      dataKey: string;
      columns: number;
      rows: number;
      glyphs: Record<string, Array<[number, number]>>;
      pixelSize: number;
      pitch: number;
      border: number;
      color: string;
      background: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "spellbook-editor";
      dataKey: string;
      lineHeightKey: string;
      defaultText: string;
      minimumLineHeight: number;
      maximumLineHeight: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "editable-text";
      dataKey: string;
      dataIndex?: number;
      dataIndexState?: number;
      dataIndexParam?: number;
      dataOuterIndex?: number;
      dataOuterIndexState?: number;
      dataOuterIndexParam?: number;
      dataFormat?: "text" | "integer" | "number" | "one-based-digits";
      deferred?: boolean;
      dirtyForeground?: string;
      hexPatternShortcuts?: {
        densityState: number;
        minimumLengthState: number;
        maximumLengthState: number;
      };
      contextOnly?: boolean;
      allowedCharacters?: string;
      uppercase?: boolean;
      minimum?: number;
      maximum?: number;
      foregroundKey: string;
      backgroundKey: string;
      fontSizeKey?: string;
      defaultText?: string;
      defaultTexts?: string[];
      title?: string;
      maximumLength?: number;
      defaultForeground: string;
      defaultBackground: string;
      backgroundCss?: string;
      focusBackgroundCss?: string;
      defaultFontSize: number;
      fontFamily?: string;
      fontWeight?: number;
      textAlign?: "left" | "center" | "right";
      lineHeight?: number;
      padding?: number;
      borderRadius?: number;
      styleControls?: boolean;
      multiline: boolean;
      rotation: 0 | 90;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "specific-value";
      param: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "computerscare-figure";
      figure: "face" | "stick";
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "computerscare-blank";
      stateKeys: {
        fit: number;
        invertY: number;
        zoomX: number;
        zoomY: number;
        xOffset: number;
        yOffset: number;
        rotation: number;
        hidePanel: number;
      };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "dress-me-up";
      assetBase: string;
      actionBase: number;
      stateKeys: {
        enableShader: number;
        spotWidth: number;
        spotHeight: number;
        colorBoost: number;
        inputGamma: number;
        outputGamma: number;
        effectScale: number;
      };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "portaloof";
      displayX: number;
      actionBase: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
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
      profile?: "bogaudio";
      rangeMode?: "analyzer" | "analyzer-xl";
      stateKeys?: { frequencyPlot: number; range: number; amplitudePlot: number };
      colors?: string[];
      axisColor?: string;
      textColor?: string;
      lineWidth?: number;
      fillAlpha?: number;
      freeze?: boolean;
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
      fontSize?: number;
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
  | {
      kind: "sort-step";
      actionBase: number;
      valueSteps: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "bacon-footer"; width: number; height: number; x: number; y: number }
  | { kind: "lint-buddy"; width: number; height: number; x: number; y: number }
  | {
      kind: "jw-grid";
      style:
        "one-pattern" | "arrange" | "note-seq" | "note-seq-fu" | "patterns" | "pres1t" | "trigs";
      cols: number;
      rows: number;
      cellWidth: number;
      cellHeight: number;
      actionBase: number;
      playheadActionBase?: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | { kind: "jw-d1v1de"; width: number; height: number; x: number; y: number }
  | { kind: "jw-thing-thing"; width: number; height: number; x: number; y: number }
  | { kind: "jw-tree"; width: number; height: number; x: number; y: number }
  | {
      kind: "biset-tree";
      maxBranches: number;
      color: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "biset-regex";
      condensed: boolean;
      rows: number;
      dataKey: string;
      compileActionBase: number;
      compileAllAction: number;
      stopActionBase: number;
      assetBase: string;
      font: { family: string; file: string };
      displayX: number;
      displayY: number;
      displayWidth: number;
      displayHeight: number;
      rowStep: number;
      colors: {
        clock: string;
        pitch: string;
        error: string;
        running: string;
        editing: string;
        active: string;
        syntax: string;
        value: string;
      };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "biset-tracker";
      assetBase: string;
      font: { family: string; file: string };
      main: { x: number; y: number; width: number; height: number };
      side: { x: number; y: number; width: number; height: number };
      info: { x: number; y: number; width: number; height: number };
      charWidth: number;
      charHeight: number;
      columns: number;
      rows: number;
      colors: string[];
      userColors: string[];
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "biset-tracker-output";
      variant: "synth" | "drum";
      synthParam: number;
      assetBase: string;
      font: { family: string; file: string };
      colors: { background: string; selected: string; text: string; learn: string };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "biset-tracker-state";
      userColors: string[];
      background: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "biset-blank-overlay";
      bufferSize: number;
      cablePoints: number;
      scopePoints: number;
      maxCableDistance: number;
      cableWidth: number;
      polyCableWidth: number;
      plugRadius: number;
      plugStrokeWidth: number;
      lightRadius: number;
      lightStrokeWidth: number;
      positiveColor: string;
      negativeColor: string;
      lightBorderColor: string;
      fontFamily: string;
      assetBase: string;
      panelParam: number;
      panels: string[];
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "flying-fader";
      param: number;
      capColorState: number;
      dataKey: string;
      defaultText: string;
      assetBase: string;
      font: { family: string; file: string };
      colors: string[];
      minHandleY: number;
      maxHandleY: number;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "algomorph-display";
      graphFile: string;
      assetBase: string;
      font: { family: string; file: string };
      currentAction: number;
      allAction: number;
      display: { x: number; y: number; width: number; height: number };
      operators: Array<[number, number]>;
      modulators: Array<[number, number]>;
      connectionRegion: { x: number; y: number; width: number; height: number };
      auxPanel?: {
        x: number;
        y: number;
        width: number;
        height: number;
        labelX: number;
        labelY: number[];
      };
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      kind: "full-scope";
      profile?: "jw" | "wiqid";
      points: number;
      defaultColor?: string;
      xColor?: string;
      showStats?: boolean;
      assetBase?: string;
      font?: { family: string; file: string };
      width: number;
      height: number;
      x: number;
      y: number;
    }
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
  hidden?: boolean;
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
      type: "audio" | "image" | "binary" | "midi" | "script" | "text";
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
    hoverBridge?: HoverBridgeContract;
    hostControl?: "rack-view";
    hotkey?: {
      scope: "module-hover";
      actionBase: number;
      recordParam: number;
      keyState: number;
      modsState: number;
    };
    hoverActions?: Array<{
      key: string;
      modifiers?: number;
      phase?: "press" | "release" | "both";
      repeat?: boolean;
      action?: number;
      hostAction?: "clock-autopatch";
      param?: number;
      operation?: "toggle" | "momentary" | "set";
      value?: number;
      alternateValue?: number;
    }>;
    globalPointer?: GlobalPointerContract;
    manualHelp?: Record<string, ManualHelpModule>;
    contextActions?: Array<{ id: number; name: string }>;
    visuals?: RuntimeVisual[];
  };
};
