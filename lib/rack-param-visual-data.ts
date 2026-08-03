import type { ParamSpec, RackWidgetPosition } from "./web-plugin-registry";

export type RackProceduralKnob = {
  base: string;
  center: string;
  border: string;
  indicator: string;
  margin: number;
  lineWidth?: number;
  dotRadius?: number;
};
export type RackKnobAsset = {
  name?: string;
  size: number;
  angle: number;
  minAngle?: number;
  maxAngle?: number;
  bg?: string;
  fg?: string;
  procedural?: RackProceduralKnob;
};
const KNOBS: Record<string, RackKnobAsset> = {
  RoundBlackKnob: { name: "RoundBlackKnob", bg: "RoundBlackKnobBg", size: 28.3476, angle: 0.83 },
  RoundBlackSnapKnob: {
    name: "RoundBlackKnob",
    bg: "RoundBlackKnobBg",
    size: 28.3476,
    angle: 0.83,
  },
  RoundSmallBlackKnob: {
    name: "RoundSmallBlackKnob",
    bg: "RoundSmallBlackKnobBg",
    size: 22.6758,
    angle: 0.83,
  },
  RoundLargeBlackKnob: {
    name: "RoundLargeBlackKnob",
    bg: "RoundLargeBlackKnobBg",
    size: 36,
    angle: 0.83,
  },
  RoundBigBlackKnob: {
    name: "RoundBigBlackKnob",
    bg: "RoundBigBlackKnobBg",
    size: 45,
    angle: 0.83,
  },
  RoundHugeBlackKnob: {
    name: "RoundHugeBlackKnob",
    bg: "RoundHugeBlackKnobBg",
    size: 53.8593,
    angle: 0.83,
  },
  RoundExtraBigBlackKnob: {
    name: "HoyerRoundExtraBigBlackKnob",
    bg: "HoyerRoundExtraBigBlackKnobBg",
    size: 52.5435,
    angle: 0.83,
  },
  GreenKnob: { name: "IggyGreenKnob", size: 20.2972, angle: 0.83 },
  CyanKnob: { name: "IggyCyanKnob", size: 22.65625, angle: 0.83 },
  IMSmallKnob: {
    name: "impromptu/Trimpot.svg",
    bg: "impromptu/Trimpot_bg.svg",
    size: 23.622,
    angle: 0.83,
  },
  IMFourPosSmallKnob: {
    name: "impromptu/Trimpot.svg",
    bg: "impromptu/Trimpot_bg.svg",
    size: 23.622,
    angle: 0.5,
  },
  PolyKnob: {
    name: "impromptu/Trimpot.svg",
    bg: "impromptu/Trimpot_bg.svg",
    size: 23.622,
    angle: 0.5,
  },
  Cv2Knob: {
    name: "impromptu/Trimpot.svg",
    bg: "impromptu/Trimpot_bg.svg",
    size: 23.622,
    angle: 0.83,
  },
  ProbKnob: {
    name: "impromptu/Trimpot.svg",
    bg: "impromptu/Trimpot_bg.svg",
    size: 23.622,
    angle: 0.83,
  },
  RndSemiKnob: {
    name: "impromptu/Trimpot.svg",
    bg: "impromptu/Trimpot_bg.svg",
    size: 23.622,
    angle: 0.83,
  },
  IMMediumKnob: {
    name: "Rogan1PWhite",
    bg: "Rogan1PBg",
    fg: "impromptu/Rogan1PWhite_fg.svg",
    size: 31.3984,
    angle: 0.83,
  },
  LoopKnob: {
    name: "Rogan1PWhite",
    bg: "Rogan1PBg",
    fg: "impromptu/Rogan1PWhite_fg.svg",
    size: 31.3984,
    angle: 0.83,
  },
  TapKnob: {
    name: "Rogan1PWhite",
    bg: "Rogan1PBg",
    fg: "impromptu/Rogan1PWhite_fg.svg",
    size: 31.3984,
    angle: 0.83,
  },
  SemitoneKnob: {
    name: "Rogan1PWhite",
    bg: "Rogan1PBg",
    fg: "impromptu/Rogan1PWhite_fg.svg",
    size: 31.3984,
    angle: 0.83,
  },
  IMBigKnobInf: {
    name: "impromptu/Rogan1S.svg",
    bg: "Rogan1PSBg",
    fg: "impromptu/Rogan1PSWhite_fg.svg",
    size: 39.6836,
    angle: 0.83,
  },
  Trimpot: { name: "Trimpot", bg: "TrimpotBg", size: 17.8594, angle: 0.75 },
  BefacoBigKnob: { name: "BefacoBigKnob", bg: "BefacoBigKnobBg", size: 73.704, angle: 0.75 },
  BefacoTinyKnob: {
    name: "BefacoTinyPointBlack",
    bg: "BefacoTinyKnobWhiteBg",
    size: 25.5119,
    angle: 0.8,
  },
  Davies1900hWhiteKnob: {
    name: "Davies1900hWhite",
    bg: "Davies1900hWhiteBg",
    size: 36.002,
    angle: 0.83,
  },
  HCVThemedRogan: {
    name: "Rogan1PRed",
    bg: "Rogan1PBg",
    fg: "Rogan1PRedFg",
    size: 31.3984,
    angle: 0.83,
  },
  Rogan1PSRed: {
    name: "Rogan1PSRed",
    bg: "Rogan1PSBg",
    fg: "Rogan1PSRedFg",
    size: 39.6836,
    angle: 0.83,
  },
  Rogan1PSGreen: {
    name: "Rogan1PSGreen",
    bg: "Rogan1PSBg",
    fg: "Rogan1PSGreenFg",
    size: 39.6836,
    angle: 0.83,
  },
  Rogan1PSWhite: {
    name: "Rogan1PSWhite",
    bg: "Rogan1PSBg",
    fg: "Rogan1PSWhiteFg",
    size: 39.6836,
    angle: 0.83,
  },
  Rogan2PWhite: {
    name: "Rogan2PWhite",
    bg: "Rogan2PBg",
    fg: "Rogan2PWhiteFg",
    size: 34.29297,
    angle: 0.83,
  },
  Rogan2PSRed: {
    name: "Rogan2PSRed",
    bg: "Rogan2PSBg",
    fg: "Rogan2PSRedFg",
    size: 43.3476,
    angle: 0.83,
  },
  Rogan2PSGreen: {
    name: "Rogan2PSGreen",
    bg: "Rogan2PSBg",
    fg: "Rogan2PSGreenFg",
    size: 43.3476,
    angle: 0.83,
  },
  Rogan2PSWhite: {
    name: "Rogan2PSWhite",
    bg: "Rogan2PSBg",
    fg: "Rogan2PSWhiteFg",
    size: 43.3476,
    angle: 0.83,
  },
  Rogan2SGray: {
    name: "Rogan2SGray",
    bg: "Rogan2SBg",
    fg: "Rogan2SGrayFg",
    size: 43.3476,
    angle: 0.83,
  },
  Rogan3PSRed: {
    name: "Rogan3PSRed",
    bg: "Rogan3PSBg",
    fg: "Rogan3PSRedFg",
    size: 51.84375,
    angle: 0.83,
  },
  Rogan3PSGreen: {
    name: "Rogan3PSGreen",
    bg: "Rogan3PSBg",
    fg: "Rogan3PSGreenFg",
    size: 51.84375,
    angle: 0.83,
  },
  Rogan3PSWhite: {
    name: "Rogan3PSWhite",
    bg: "Rogan3PSBg",
    fg: "Rogan3PSWhiteFg",
    size: 51.84375,
    angle: 0.83,
  },
  Rogan3PWhite: {
    name: "Rogan3PWhite",
    bg: "Rogan3PBg",
    fg: "Rogan3PWhiteFg",
    size: 41.76172,
    angle: 0.83,
  },
  gtgRedKnob: { name: "gtg/RedKnob.svg", size: 35.433, angle: 0.83 },
  gtgOrangeKnob: { name: "gtg/OrangeKnob.svg", size: 35.433, angle: 0.83 },
  gtgBlueKnob: { name: "gtg/BlueKnob.svg", size: 35.433, angle: 0.83 },
  gtgGrayKnob: { name: "gtg/GrayKnob.svg", size: 35.433, angle: 0.83 },
  gtgBlackKnob: { name: "gtg/BlackKnob.svg", size: 35.433, angle: 0.83 },
  gtgRedTinyKnob: { name: "gtg/RedTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgOrangeTinyKnob: { name: "gtg/OrangeTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgBlueTinyKnob: { name: "gtg/BlueTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgGrayTinyKnob: { name: "gtg/GrayTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgBlackTinyKnob: { name: "gtg/BlackTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgRedTinySnapKnob: { name: "gtg/RedTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgOrangeTinySnapKnob: { name: "gtg/OrangeTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgBlueTinySnapKnob: { name: "gtg/BlueTinyKnob.svg", size: 20.669, angle: 0.83 },
  gtgGrayTinySnapKnob: { name: "gtg/GrayTinyKnob.svg", size: 20.669, angle: 0.83 },
  GreyLargeKnob: { name: "msm/Knobs/GreyLargeKnob.svg", size: 47, angle: 0.78 },
  BlueLargeKnob: { name: "msm/Knobs/BlueLargeKnob.svg", size: 47, angle: 0.78 },
  GreenLargeKnob: { name: "msm/Knobs/GreenLargeKnob.svg", size: 47, angle: 0.78 },
  RedLargeKnob: { name: "msm/Knobs/RedLargeKnob.svg", size: 47, angle: 0.78 },
  VioLargeKnob: { name: "msm/Knobs/VioLargeKnob.svg", size: 47, angle: 0.78 },
  GreySmallKnob: { name: "msm/Knobs/GreySmallKnob.svg", size: 32, angle: 0.78 },
  BlueSmallKnob: { name: "msm/Knobs/BlueSmallKnob.svg", size: 32, angle: 0.78 },
  GreenSmallKnob: { name: "msm/Knobs/GreenSmallKnob.svg", size: 32, angle: 0.78 },
  RedSmallKnob: { name: "msm/Knobs/RedSmallKnob.svg", size: 32, angle: 0.78 },
  YellowSmallKnob: { name: "msm/Knobs/YellowSmallKnob.svg", size: 32, angle: 0.78 },
  GreenTinyKnob: { name: "msm/Knobs/GreenTinyKnob.svg", size: 25, angle: 0.78 },
  GreenToggleKnobSmall: { name: "msm/Knobs/GreenSmallKnob.svg", size: 32, angle: 0.78 },
  RedSmallToggleKnob: { name: "msm/Knobs/RedSmallKnob.svg", size: 32, angle: 0.78 },
  BlueSmallToggleKnob: { name: "msm/Knobs/BlueSmallKnob.svg", size: 32, angle: 0.78 },
  RedLargeToggleKnob: { name: "msm/Knobs/RedLargeKnob.svg", size: 47, angle: 0.78 },
  LeviathanHaloKnob2: {
    name: "leviathan/HaloKnobCenter.svg",
    bg: "leviathan/HaloKnob2Back.svg",
    size: 46,
    angle: 0.83,
  },
  IntegralFluxHalo2Knob: {
    name: "leviathan/HaloKnobCenter.svg",
    bg: "leviathan/HaloKnob2Back.svg",
    size: 46,
    angle: 0.83,
  },
  IntegralFluxCurveHalo2Knob: {
    name: "leviathan/HaloKnobCenter.svg",
    bg: "leviathan/HaloKnob2Back.svg",
    size: 46,
    angle: 0.83,
  },
  ProcEdgeHalo2Knob: {
    name: "leviathan/HaloKnobCenter.svg",
    bg: "leviathan/HaloKnob2Back.svg",
    size: 46,
    angle: 0.83,
  },
  ProcCurveHalo2Knob: {
    name: "leviathan/HaloKnobCenter.svg",
    bg: "leviathan/HaloKnob2Back.svg",
    size: 46,
    angle: 0.83,
  },
  Eclipse2Knob: { name: "leviathan/Eclipse2Knob.svg", size: 34, angle: 0.83 },
  IntegralFluxEclipse2Knob: { name: "leviathan/Eclipse2Knob.svg", size: 34, angle: 0.83 },
  TinyClockworkGearKnob: { name: "leviathan/gear_knob_tiny.svg", size: 24, angle: 0.8 },
  BipolarTinyClockworkGearKnob: { name: "leviathan/gear_knob_tiny.svg", size: 24, angle: 0.8 },
  LFMKnob: { name: "lifeform/LFMKnob.svg", size: 38.997, angle: 0.68 },
  LFMSnapKnob: { name: "lifeform/LFMKnob.svg", size: 38.997, angle: 0.68 },
  LFMNuKnob: { name: "lifeform/LFMNuKnob.svg", size: 38.997, angle: 0.68 },
  LFMTinyKnob: { name: "lifeform/LFMTinyKnob.svg", size: 23.751, angle: 0.68 },
  LFMTinySnapKnob: { name: "lifeform/LFMTinyKnob.svg", size: 23.751, angle: 0.68 },
  RoundGrayKnob: { name: "lomas/RoundGrayKnob.svg", size: 38.3858, angle: 0.75 },
  RoundSmallGrayKnob: { name: "lomas/RoundSmallGrayKnob.svg", size: 25.0984, angle: 0.75 },
  RoundBigGrayKnob: { name: "lomas/RoundBigGrayKnob.svg", size: 42.81496, angle: 0.75 },
  SelectEncoder: {
    name: "modular-mooch/M1900hBlackEncoder.svg",
    fg: "modular-mooch/M1900hKnob_fg.svg",
    size: 35,
    angle: 0.83,
  },
  LengthKnob: {
    name: "modular-mooch/M1900hBlackKnob.svg",
    fg: "modular-mooch/M1900hKnob_fg.svg",
    size: 35,
    angle: 0.75,
    minAngle: -0.75,
    maxAngle: 0.5,
  },
  ProbabilityKnob: {
    name: "modular-mooch/M1900hBlackKnob.svg",
    fg: "modular-mooch/M1900hKnob_fg.svg",
    size: 35,
    angle: 0.75,
  },
  HexKnob: { name: "lyrae/HexKnob.svg", size: 25, angle: 0.8 },
  SnappingHexKnob: { name: "lyrae/HexKnob.svg", size: 25, angle: 0.8 },
  MedHexKnob: { name: "lyrae/MedHexKnob.svg", size: 20, angle: 0.8 },
  SmallHexKnob: { name: "lyrae/SmallHexKnob.svg", size: 12, angle: 0.8 },
  SmallHexKnobInv: { name: "lyrae/SmallHexKnobInverted.svg", size: 12, angle: 0.8 },
  StandardBlackKnob: {
    size: 30,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  OpcCustomKnob: {
    size: 47.244,
    angle: 0.75,
    procedural: {
      base: "rgb(35 35 35)",
      center: "rgb(184 184 184)",
      border: "rgb(72 72 72)",
      indicator: "white",
      margin: 4,
      lineWidth: 1.5,
      dotRadius: 0,
    },
  },
  OpcCustomTrimKnob: {
    size: 20.669,
    angle: 0.75,
    procedural: {
      base: "rgb(35 35 35)",
      center: "rgb(184 184 184)",
      border: "rgb(72 72 72)",
      indicator: "white",
      margin: 2,
      lineWidth: 1.25,
      dotRadius: 0,
    },
  },
  StandardBlackKnob26: {
    size: 26,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  SnapKnob26: {
    size: 26,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  TechnoStandardBlackKnob: {
    size: 45,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  TechnoStandardBlackKnob30: {
    size: 30,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  SmallGrayKnob: {
    size: 21,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(180 180 180)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 6,
      lineWidth: 1.5,
      dotRadius: 1.5,
    },
  },
  SnapKnob: {
    size: 26,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  TechnoSnapKnob30: {
    size: 30,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  SmallWhiteKnob: {
    size: 26,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "white",
      border: "rgb(100 100 100)",
      indicator: "rgb(255 133 133)",
      margin: 6,
    },
  },
  LargeWhiteKnob: {
    size: 37,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "white",
      border: "rgb(100 100 100)",
      indicator: "rgb(255 133 133)",
      margin: 8,
    },
  },
  MicrotuneKnob: {
    size: 20,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(50 50 50)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 5,
    },
  },
  MADDYSnapKnob: {
    size: 26,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(130 130 130)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  MADDYPlusSnapKnob: {
    size: 26,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(130 130 130)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
  WhiteKnob: {
    size: 30,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "white",
      border: "rgb(100 100 100)",
      indicator: "rgb(255 133 133)",
      margin: 8,
    },
  },
  MediumGrayKnob: {
    size: 26,
    angle: 0.75,
    procedural: {
      base: "rgb(30 30 30)",
      center: "rgb(130 130 130)",
      border: "rgb(100 100 100)",
      indicator: "white",
      margin: 8,
    },
  },
};
export type RackSwitchAsset = {
  name: string;
  size: [number, number];
  frames: number;
  names?: string[];
  rotation?: number;
};

const SWITCHES: Record<string, RackSwitchAsset> = {
  RecButton: { name: "RecButton", size: [32.48, 32.48], frames: 2 },
  VCVButton: { name: "VCVButton", size: [18, 18], frames: 2 },
  ClickableLight: { name: "", size: [8, 8], frames: 2 },
  CKD6: { name: "CKD6", size: [28, 27.9959], frames: 2 },
  TL1105: { name: "TL1105", size: [15.36, 15.3577], frames: 2 },
  CKSS: { name: "CKSS", size: [14, 20.6411], frames: 2 },
  IMSwitch2V: { name: "CKSS", size: [14, 20.6411], frames: 2 },
  IMSwitch2H: { name: "CKSS", size: [20.6411, 14], frames: 2, rotation: 90 },
  CKSSThree: { name: "CKSSThree", size: [13.457, 28.3477], frames: 3 },
  NKK: { name: "NKK", size: [31.9999, 43.8825], frames: 3 },
  CyanSwitch: {
    name: "",
    size: [9.4464293, 16.712534],
    frames: 2,
    names: ["IggyCyanSwitch0", "IggyCyanSwitch1"],
  },
  CyanButton: {
    name: "",
    size: [9.7440945, 9.7440945],
    frames: 2,
    names: ["IggyCyanButton0", "IggyCyanButton1"],
  },
  gtgBlackButton: { name: "gtg/BlackButton_", size: [18.012, 18.012], frames: 2 },
  gtgBlackTinyButton: { name: "gtg/BlackTinyButton_", size: [12.402, 12.402], frames: 2 },
  SmallGoldButton: {
    name: "",
    size: [18, 18],
    frames: 2,
    names: ["leviathan/gold_button.svg", "leviathan/gold_button.svg"],
  },
  SmallGoldApertureButton: {
    name: "",
    size: [18, 18],
    frames: 2,
    names: ["leviathan/gold_button.svg", "leviathan/gold_button.svg"],
  },
  LoopGoldButton: {
    name: "",
    size: [24, 24],
    frames: 2,
    names: ["leviathan/gold_button.svg", "leviathan/gold_button.svg"],
  },
  IntegralFluxPlasmaSwitch: {
    name: "",
    size: [17, 30],
    frames: 2,
    names: ["leviathan/PlasmaSwitchSmall.png", "leviathan/PlasmaSwitchSmall.png"],
  },
  MS: {
    name: "",
    size: [14, 20.641],
    frames: 2,
    names: ["lifeform/MS_0.svg", "lifeform/MS_1.svg"],
  },
  VioMSwitch: {
    name: "",
    size: [14, 20.641106],
    frames: 2,
    names: ["msm/Switch/VioMSwitch_0.svg", "msm/Switch/VioMSwitch_1.svg"],
  },
  VioM2Switch: {
    name: "",
    size: [14, 20.641106],
    frames: 2,
    names: ["msm/Switch/VioMSwitch_0.svg", "msm/Switch/VioMSwitch_1.svg"],
  },
  OSCiXEGG: {
    name: "",
    size: [70, 19.9],
    frames: 2,
    names: ["msm/Button/Easteregg_0.svg", "msm/Button/Easteregg_1.svg"],
  },
  LFMSwitch: {
    name: "",
    size: [14, 20.641],
    frames: 3,
    names: ["lifeform/LFMSwitch_0.svg", "lifeform/LFMSwitch_1.svg", "lifeform/LFMSwitch_2.svg"],
  },
  FMSM: {
    name: "",
    size: [64, 18],
    frames: 4,
    names: [
      "msm/Switch/FMSM_0.svg",
      "msm/Switch/FMSM_1.svg",
      "msm/Switch/FMSM_2.svg",
      "msm/Switch/FMSM_3.svg",
    ],
  },
  RubberButton: {
    name: "",
    size: [25.0984, 25.0984],
    frames: 2,
    names: ["lomas/RubberButton.svg", "lomas/RubberButton1.svg"],
  },
  RubberSmallButton: {
    name: "",
    size: [16.2402, 16.2402],
    frames: 2,
    names: ["lomas/RubberSmallButton.svg", "lomas/RubberSmallButton1.svg"],
  },
  LoadButton: {
    name: "",
    size: [16.2402, 16.2402],
    frames: 2,
    names: ["lomas/RubberSmallButton.svg", "lomas/RubberSmallButton1.svg"],
  },
  ...Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [
      `By${index + 1}Button`,
      {
        name: "",
        size: [29.5276, 29.5276] as [number, number],
        frames: 2,
        names: [`HoyerBy${index + 1}Off`, `HoyerBy${index + 1}On`],
      },
    ]),
  ),
};
const WINDOW_NAMES = [
    "Boxcar",
    "Bartlett",
    "BartlettHann",
    "Parzen",
    "Welch",
    "Cosine",
    "Bohman",
    "Lanczos",
    "Hann",
    "Hamming",
    "Blackman",
    "BlackmanHarris",
    "BlackmanNuttall",
    "KaiserBessel",
    "Flattop",
  ],
  SMOOTH_NAMES = [
    "None",
    "1/48 oct",
    "1/24 oct",
    "1/12 oct",
    "1/9 oct",
    "1/6 oct",
    "1/5 oct",
    "1/4 oct",
    "1/3 oct",
    "1/2 oct",
    "2/3 oct",
    "3/4 oct",
    "1 oct",
    "1.5 oct",
    "2 oct",
    "2.5 oct",
  ];

const WIDGET_ASSET_MATCHERS = Object.keys({ ...KNOBS, ...SWITCHES }).map(
  (name) => [name, new RegExp(`(?:^|[^A-Za-z0-9_])${name}(?:$|[^A-Za-z0-9_])`)] as const,
);

export type RackParamInteraction = "knob" | "slider" | "switch" | "button" | "selector" | "unknown";

export function rackParamWidgetKind(param: ParamSpec) {
  const widget = param.position?.widget ?? "";
  const simple = widget.replace(/\b(?:rack::)?componentlibrary::/g, "").trim();
  if (/\bOpcToggleButton\b/.test(simple)) return "OpcToggleButton";
  if (/\bOpcDetectModeButton\b/.test(simple)) return "OpcDetectModeButton";
  if (/\bRecButton\b/.test(simple)) return "RecButton";
  if (/AssignButton|VCVLightButton|VCVLightLatch|VCVLatch|VCVButton|LEDButton/.test(simple))
    return "VCVButton";
  if (/VCVLightBezel|\bLEDBezel\b/.test(simple)) return "VCVBezel";
  if (/VCVLightSlider|LEDLightSlider/.test(simple)) return "VCVSlider";
  if (/BefacoSlidePot/.test(simple)) return "BefacoSlidePot";
  if (/\bLFMSliderWhite\b/.test(simple)) return "LFMSliderWhite";
  if (/\bTextKnob\b/.test(simple)) return "TextKnob";
  return WIDGET_ASSET_MATCHERS.find(([, pattern]) => pattern.test(simple))?.[0] ?? "";
}

export function rackParamInteraction(param: ParamSpec): RackParamInteraction {
  if (param.button) return "button";
  const kind = rackParamWidgetKind(param);
  if (/^gtgBlack(?:Tiny)?Button$/.test(kind)) return "button";
  if (param.position?.control === "selector") return "selector";
  if (kind in KNOBS || kind === "TextKnob") return "knob";
  if (kind === "VCVSlider" || kind === "BefacoSlidePot" || kind === "LFMSliderWhite")
    return "slider";
  if (kind === "VCVBezel" || kind in SWITCHES) return "switch";
  if (kind === "OpcToggleButton" || kind === "OpcDetectModeButton") return "switch";
  return "unknown";
}

export function rackParamControlSize(param: ParamSpec) {
  const position = param.position,
    kind = rackParamWidgetKind(param),
    knob = KNOBS[kind];
  if (position?.control === "selector")
    return { width: position.width ?? 38, height: position.height ?? 18 };
  if (knob) return { width: knob.size, height: knob.size };
  if (kind === "TextKnob") return { width: 60, height: 30 };
  if (kind === "VCVSlider") return { width: 19.8426, height: 76.5352 };
  if (kind === "BefacoSlidePot") return { width: 15.5913, height: 111 };
  if (kind === "LFMSliderWhite") return { width: 22, height: 76.5 };
  if (kind === "VCVBezel") return { width: 21.2603, height: 21.2599 };
  if (kind === "OpcToggleButton" || kind === "OpcDetectModeButton")
    return { width: position?.width ?? 38, height: position?.height ?? 20 };
  const control = SWITCHES[kind];
  return control
    ? { width: control.size[0], height: control.size[1] }
    : { width: position?.width ?? 38, height: position?.height ?? 40 };
}

export function rackParamSwitchFrames(param: ParamSpec) {
  const kind = rackParamWidgetKind(param);
  return kind === "VCVBezel"
    ? 2
    : (SWITCHES[kind]?.frames ?? Math.max(2, Math.round(param.max - param.min) + 1));
}

export function rackParamTextValue(param: ParamSpec, value: number) {
  const index = Math.max(0, Math.round(value));
  if (param.name === "Window") return WINDOW_NAMES[index] ?? String(index);
  if (param.name === "Smooth") return SMOOTH_NAMES[index] ?? String(index);
  if (param.name === "Length") return String(2 ** index);
  if (param.name === "X Scale" || (param.name === "Y Scale" && param.max === 1))
    return ["Linear", "Logarithmic"][index] ?? String(index);
  if (param.name === "Y Scale") return ["Linear", "Log 60dB", "Log 120dB"][index] ?? String(index);
  if (param.name === "Hop" || param.name === "Average")
    return `${Number((value * 1000).toPrecision(4))}ms`;
  if (param.name === "LO Freq" || param.name === "HI Freq")
    return `${Number(value.toPrecision(5))}Hz`;
  if (param.name === "Slope") return `${Number(value.toPrecision(3))}dB/oct`;
  return String(Number(value.toPrecision(5)));
}

export function rackParamAssetUrl(name: string) {
  return /^(?:gtg|impromptu|leviathan|lifeform|lomas|lyrae|modular-mooch|msm)\//.test(name)
    ? `/rack-components/${name}`
    : `/api/rack-component?name=${encodeURIComponent(name)}`;
}

export function rackParamKnobAsset(kind: string) {
  return KNOBS[kind];
}

export function rackParamSwitchAsset(kind: string) {
  return SWITCHES[kind];
}

export function rackParamNormalizedValue(param: ParamSpec, value: number) {
  const normalized = param.max === param.min ? 0 : (value - param.min) / (param.max - param.min);
  return param.unbounded ? normalized : Math.max(0, Math.min(1, normalized));
}

export function rackParamPlacementStyle(
  position: RackWidgetPosition,
  sourceWidth: number,
  width: number,
  height: number,
) {
  return {
    left: `${((position.x + (position.centered ? 0 : width / 2)) / sourceWidth) * 100}%`,
    top: `${((position.y + (position.centered ? 0 : height / 2)) / 380) * 100}%`,
    zIndex: position.zIndex,
    transform: "translate(-50%, -50%)",
  };
}

export function rackParamKnobRotation(knob: RackKnobAsset, normalized: number, unbounded: boolean) {
  const wrappedNormalized = unbounded ? ((normalized % 1) + 1) % 1 : normalized;
  return (
    ((knob.minAngle ?? -knob.angle) +
      wrappedNormalized * ((knob.maxAngle ?? knob.angle) - (knob.minAngle ?? -knob.angle))) *
    180
  );
}

export function rackParamSwitchFrame(normalized: number, frames: number) {
  return Math.round(normalized * (frames - 1));
}
