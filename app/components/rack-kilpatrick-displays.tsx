import { useEffect, useRef, type WheelEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type StereoVisual = Extract<RuntimeVisual, { kind: "kilpatrick-stereo-meter" }>;
type TestOscVisual = Extract<RuntimeVisual, { kind: "kilpatrick-test-osc" }>;

const loadFont = (assetBase: string, file: string, family: string) => {
  if (typeof FontFace === "undefined") return;
  const face = new FontFace(family, `url(${JSON.stringify(`${assetBase}${file}`)})`);
  void face
    .load()
    .then((loaded) => document.fonts.add(loaded))
    .catch(() => undefined);
};

const setup = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const scale = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
};

export function RackKilpatrickStereoMeter({
  visual,
  values,
  refs,
  scaleX,
  onParam,
}: {
  visual: StereoVisual;
  values?: number[];
  refs: number[];
  scaleX: number;
  onParam: (id: number, value: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const changedAt = useRef([0, 0]);
  const previousRefs = useRef(refs.slice(0, 2));

  useEffect(() => loadFont(visual.assetBase, visual.font.file, visual.font.family), [visual]);
  useEffect(() => {
    for (let index = 0; index < 2; index++) {
      if (previousRefs.current[index] !== refs[index]) changedAt.current[index] = performance.now();
      previousRefs.current[index] = refs[index];
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = setup(canvas, visual.width, visual.height);
    if (!context) return;
    context.fillStyle = "#000000";
    context.beginPath();
    context.roundRect(0, 0, visual.width, visual.height, visual.radius);
    context.fill();

    for (let channel = 0; channel < 2; channel++) {
      const meterWidth = visual.width * 0.4;
      const meterHeight = visual.height * 0.87;
      const x = visual.width * (channel ? 0.72 : 0.28) - meterWidth * 0.5;
      const y = visual.height * 0.02;
      const level = Math.max(-96, Math.min(0, values?.[channel * 2] ?? -96));
      const peak = Math.max(-96, Math.min(0, values?.[channel * 2 + 1] ?? -96));
      const ref = refs[channel] ?? 0;
      context.fillStyle = "#303030";
      context.fillRect(x, y, meterWidth, 12);
      context.fillStyle = ref === 0 ? "#e0e0e0" : "#ff0000";
      context.font = `9.5px ${JSON.stringify(visual.font.family)}, monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const showRef = performance.now() - changedAt.current[channel] < 1500;
      context.fillText((showRef ? ref : level + ref).toFixed(1), x + meterWidth * 0.5, y + 6);
      const barY = y + 14;
      context.fillStyle = "#303030";
      context.fillRect(x, barY, meterWidth, meterHeight);
      if (level > -96) {
        const top = barY + -level * (meterHeight / 96);
        context.fillStyle = "#00e000";
        context.fillRect(x, top, meterWidth, meterHeight + barY - top);
      }
      if (peak > -96) {
        context.fillStyle = "#e00000";
        context.fillRect(x, barY + -peak * (meterHeight / 96), meterWidth, 2);
      }
    }
  }, [refs, values, visual]);

  const wheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const channel = event.clientX - bounds.left > bounds.width / 2 ? 1 : 0;
    const id = visual.refParams[channel];
    onParam(id, Math.max(-60, Math.min(24, (refs[channel] ?? 0) + (event.deltaY < 0 ? -1 : 1))));
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Stereo level meter; scroll either side to adjust its reference level"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 11,
        touchAction: "none",
      }}
      onWheel={wheel}
    />
  );
}

const factorToDb = (factor: number) => {
  const db = 20 * Math.log10(Math.max(1e-12, factor));
  return Math.abs(db) < 0.05 ? 0 : db;
};

const frequencyText = (frequency: number) =>
  frequency < 1000 ? `${frequency.toFixed(1)}Hz` : ` ${(frequency * 0.001).toFixed(3)}kHz`;

export function RackKilpatrickTestOsc({
  visual,
  values,
  scaleX,
  onAction,
}: {
  visual: TestOscVisual;
  values?: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => loadFont(visual.assetBase, visual.font.file, visual.font.family), [visual]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = setup(canvas, visual.width, visual.height);
    if (!context) return;
    context.fillStyle = "#000000";
    context.beginPath();
    context.roundRect(0, 0, visual.width, visual.height, visual.radius);
    context.fill();
    context.fillStyle = "#e0e0e0";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `10px ${JSON.stringify(visual.font.family)}, monospace`;
    const absolute = factorToDb(values?.[0] ?? 1);
    const reference = factorToDb(values?.[1] ?? 1);
    context.fillText(`ABS: ${absolute.toFixed(1)}dB`, visual.width * 0.5, visual.height * 0.15);
    context.fillText(`REF: ${reference.toFixed(1)}dB`, visual.width * 0.5, visual.height * 0.3);
    context.fillText(
      `S: ${(values?.[2] ?? 1).toFixed(1)}s ${((values?.[3] ?? 0) * 100).toFixed(0).padStart(3, " ")}%`,
      visual.width * 0.5,
      visual.height * 0.85,
    );
    context.font = `13px ${JSON.stringify(visual.font.family)}, monospace`;
    context.fillText(frequencyText(values?.[4] ?? 1047), visual.width * 0.5, visual.height * 0.5);
  }, [values, visual]);

  return (
    <canvas
      ref={canvasRef}
      role="slider"
      aria-label="Test oscillator reference level"
      aria-valuemin={-120}
      aria-valuemax={24}
      aria-valuenow={factorToDb(values?.[1] ?? 1)}
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 11,
      }}
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const action = event.deltaY < 0 ? visual.wheelUpAction : visual.wheelDownAction;
        onAction(action, true);
        onAction(action, false);
      }}
    />
  );
}
