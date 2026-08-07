import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 1, 4, 6, 7, 10],
  [0, 1, 2, 6, 7, 8],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 4, 7, 9],
  [0, 2, 4, 5, 7, 8, 9, 11],
  [0, 2, 4, 5, 6, 8, 10],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 3, 5, 7, 10],
  [0, 2, 3, 5, 7, 8, 11],
  [0, 2, 3, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 1, 3, 5, 7, 8, 10],
  [0, 2, 4, 6, 7, 9, 11],
  [0, 2, 4, 5, 7, 9, 10],
  [0, 1, 3, 5, 6, 8, 10],
  [0, 2, 4, 6, 7, 9, 10],
  [0, 2, 4, 6, 8, 9, 11],
  [0, 2, 3, 6, 7, 9, 11],
  [0, 1, 4, 5, 7, 8, 10],
  [0, 1, 3, 5, 6, 9, 10],
  [0, 1, 3, 4, 6, 8, 10],
  [0, 3, 5, 6, 7, 10],
  [0, 1, 4, 5, 7, 8, 11],
  [0, 2, 3, 6, 7, 8, 11],
  [0, 3, 4, 6, 7, 9, 10],
  [0, 1, 4, 5, 6, 8, 11],
  [0, 2, 3, 7, 8],
  [0, 1, 5, 6, 10],
  [0, 1, 5, 7, 10],
  [0, 2, 5, 7, 9],
  [0, 2, 4, 6, 8, 10],
  [0, 3, 4, 7, 8, 11],
  [0, 1, 3, 4, 6, 7, 9, 10],
  [0, 1, 4, 6, 8, 10, 11],
  [0, 2, 4, 6, 9, 10],
  [0, 2, 4, 5, 7, 8, 11],
  [0, 1, 3, 5, 7, 9, 11],
  [0, 1, 3, 5, 7, 8, 11],
  [0, 2, 4, 5, 7, 9, 10, 11],
  [0, 2, 3, 5, 6, 7, 8, 11],
  [0, 2, 3, 6, 7, 9, 10],
  [0, 1, 3, 4, 6, 7],
];
const SCALE_NAMES = [
  "Chromatic",
  "Tritone",
  "Two-Semi Tritone",
  "Major (Ionian)",
  "Major Pentatonic",
  "Major Bebop",
  "Major Locrian",
  "Natural Minor",
  "Minor Pentatonic",
  "Harmonic Minor",
  "Melodic Minor",
  "Dorian",
  "Phrygian",
  "Lydian",
  "Mixolydian",
  "Locrian",
  "Lydian Dominant",
  "Lydian Augmented",
  "Lydian Diminished",
  "Phrygian Dominant",
  "Locrian Nat6",
  "Super Locrian",
  "Blues",
  "Double Harmonic",
  "Hungarian Minor",
  "Hungarian Major",
  "Persian",
  "Hirajoshi",
  "Iwato",
  "In Sen",
  "Yo",
  "Whole Tone",
  "Augmented",
  "Octatonic (H-W)",
  "Enigmatic",
  "Prometheus",
  "Harmonic Major",
  "Neapolitan Maj",
  "Neapolitan Min",
  "Bebop Dominant",
  "Algerian",
  "Ukrainian Dorian",
  "Istrian",
];

function chordName(root: number, scaleIndex: number, degree: number) {
  const scale = SCALES[scaleIndex] ?? SCALES[0];
  const interval = scale[degree % scale.length] ?? 0;
  const absoluteRoot = (root + interval) % 12;
  if (scaleIndex === 4 || scaleIndex === 5)
    return `${NOTE_NAMES[absoluteRoot]}${scaleIndex === 4 ? "6" : "m7"}`;
  const third = ((scale[(degree + 2) % scale.length] ?? 0) - interval + 12) % 12;
  const fifth = ((scale[(degree + 4) % scale.length] ?? 0) - interval + 12) % 12;
  let name = NOTE_NAMES[absoluteRoot] ?? "?";
  if (third === 3) name += "m";
  else if (third === 2) name += "sus2";
  else if (third === 5) name += "sus4";
  else if (third !== 4) name += "?";
  if (fifth === 6) name += "b5";
  else if (fifth === 8) name += "#5";
  return name;
}

export function RackChordChemistDisplay({
  values,
  steps,
  root,
  scale,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  steps: number;
  root: { x: number; y: number; width: number; height: number };
  scale: { x: number; y: number; width: number; height: number };
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const currentStep = Math.max(0, Math.min(steps - 1, Math.round(values?.[0] ?? 0)));
  const stepCount = Math.max(1, Math.min(steps, Math.trunc(values?.[1] ?? 8)));
  const rootValue = Math.max(0, Math.trunc(values?.[2] ?? 24));
  const scaleIndex = Math.max(0, Math.min(SCALES.length - 1, Math.trunc(values?.[3] ?? 0)));

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2.6;
    const radius = 90;
    const anglePerStep = (2 * Math.PI) / stepCount;
    for (let index = 0; index < stepCount; index += 1) {
      const start = index * anglePerStep - Math.PI / 2;
      const end = (index + 1) * anglePerStep - Math.PI / 2;
      context.beginPath();
      context.arc(centerX, centerY, radius, start, end);
      context.lineTo(centerX, centerY);
      context.closePath();
      context.fillStyle = index === currentStep ? "rgb(21,55,227)" : "rgb(60,60,60)";
      context.fill();
      context.strokeStyle = "rgb(220,151,40)";
      context.lineWidth = 1.5;
      context.stroke();

      const textAngle = start + anglePerStep / 2;
      const degree = Math.max(0, Math.round(values?.[4 + index] ?? index % 7));
      const quality = Math.max(0, Math.round(values?.[4 + steps + index] ?? 0));
      let name = chordName(rootValue % 12, scaleIndex, degree);
      if (quality === 2) name += "6";
      else if (quality === 3) name += "9";
      else if (quality === 4) name += "11";
      context.fillStyle = "#ffffff";
      context.font = `${stepCount > 10 ? 9 : 11}px system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        name,
        centerX + Math.cos(textAngle) * radius * 0.75,
        centerY + Math.sin(textAngle) * radius * 0.75,
      );
    }
  }, [values, steps, width, height, currentStep, stepCount, rootValue, scaleIndex]);

  const rootText = `${NOTE_NAMES[rootValue % 12]}${Math.floor(rootValue / 12) + 1}`;
  const mm = (value: number) => (value * 75) / 25.4;
  const ringRadius = 17.8594 / 2 + 2;
  const activeRow = Math.floor(currentStep / 8);
  const activeColumn = currentStep % 8;
  const activeX = mm(14 + activeColumn * 14.5);
  const activeY = mm(105 + activeRow * 14);

  return (
    <>
      <canvas
        ref={canvas}
        className="pw-rack-chord-chemist-circle"
        aria-label={t("display.chordChemist")}
        style={{
          position: "absolute",
          left: x * scaleX,
          top: y,
          width: width * scaleX,
          height,
          pointerEvents: "none",
        }}
      />
      <span
        className="pw-rack-chord-chemist-value"
        style={{
          position: "absolute",
          left: root.x * scaleX,
          top: root.y,
          width: root.width * scaleX,
          height: root.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          color: "rgb(21,55,227)",
          fontSize: 13,
          pointerEvents: "none",
        }}
      >
        {rootText}
      </span>
      <span
        className="pw-rack-chord-chemist-value"
        style={{
          position: "absolute",
          left: scale.x * scaleX,
          top: scale.y,
          width: scale.width * scaleX,
          height: scale.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          color: "rgb(21,55,227)",
          fontSize: 13,
          pointerEvents: "none",
        }}
      >
        {SCALE_NAMES[scaleIndex] ?? "?"}
      </span>
      <span
        className="pw-rack-chord-chemist-active-step"
        style={{
          position: "absolute",
          left: (activeX - ringRadius) * scaleX,
          top: activeY - ringRadius,
          width: ringRadius * 2 * scaleX,
          height: ringRadius * 2,
          borderRadius: "50%",
          background: "rgb(21,55,227)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
