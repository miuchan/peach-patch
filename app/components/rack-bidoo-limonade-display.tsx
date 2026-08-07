import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const FRAME_LIMIT = 256;
const FRAME_POINTS = 512;
const BIN_POINTS = 512;
const WAVE_POINTS = 2048;
const HEADER = 8;
const FLAGS_OFFSET = HEADER;
const FRAMES_OFFSET = FLAGS_OFFSET + FRAME_LIMIT;
const MAGNITUDE_OFFSET = FRAMES_OFFSET + FRAME_LIMIT * FRAME_POINTS;
const PHASE_OFFSET = MAGNITUDE_OFFSET + BIN_POINTS;
const EDITED_WAVE_OFFSET = PHASE_OFFSET + BIN_POINTS;
const PLAYED_WAVE_OFFSET = EDITED_WAVE_OFFSET + WAVE_POINTS;
const VALUE_STEPS = 4096;
const COMMAND_STRIDE = BIN_POINTS * VALUE_STEPS;
const PI = Math.PI;

type Edit = { section: 0 | 1; bin: number; value: number } | null;

function prepareCanvas(element: HTMLCanvasElement, width: number, height: number) {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  element.width = Math.round(width * ratio);
  element.height = Math.round(height * ratio);
  const context = element.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

function localPoint(event: PointerEvent<HTMLCanvasElement>, width: number, height: number) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * width,
    y: ((event.clientY - bounds.top) / bounds.height) * height,
  };
}

function releasePointer(event: PointerEvent<HTMLCanvasElement>) {
  if (event.currentTarget.hasPointerCapture(event.pointerId))
    event.currentTarget.releasePointerCapture(event.pointerId);
}

export function RackBidooLimonadeDisplay({
  values,
  mode,
  actionBase,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  mode: "bins" | "wavetable";
  actionBase: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const previousPointer = useRef({ x: 0, y: 0 });
  const scrollAnchor = useRef(0);
  const scrolling = useRef(false);
  const edit = useRef<Edit>(null);
  const angles = useRef({ alpha1: 25, alpha2: 35 });
  const [viewSerial, setViewSerial] = useState(0);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = prepareCanvas(element, width, height);
    if (!context) return;
    const frameCount = Math.max(0, Math.min(FRAME_LIMIT, Math.round(values?.[0] ?? 0)));
    const editedIndex = Math.max(0, Math.min(frameCount - 1, Math.round(values?.[1] ?? 0)));
    const playedIndex = Math.max(0, Math.min(frameCount - 1, Math.round(values?.[2] ?? 0)));

    if (mode === "bins") {
      const nativeWidth = 420;
      const magnitudeHeight = 70;
      const phaseHeight = 50;
      const graphGap = 30;
      const zoomWidth = nativeWidth * 28;
      const zoomLeft =
        ((scrollAnchor.current / (nativeWidth - 20)) * (nativeWidth - zoomWidth)) / 2;
      context.save();
      context.beginPath();
      context.rect(0, 0, nativeWidth, magnitudeHeight + graphGap + phaseHeight + 12);
      context.clip();
      context.fillStyle = "rgba(220,220,220,0.313725)";
      context.beginPath();
      context.roundRect(0, magnitudeHeight + phaseHeight + graphGap + 4, nativeWidth, 8, 2);
      context.fill();
      context.fillStyle = "rgb(220,220,220)";
      context.beginPath();
      context.roundRect(
        scrollAnchor.current,
        magnitudeHeight + phaseHeight + graphGap + 4,
        20,
        8,
        2,
      );
      context.fill();
      context.font = "16px sans-serif";
      context.textBaseline = "alphabetic";
      context.fillStyle = "rgb(255,233,0)";
      context.fillText("▲ Magnitude ▼ Phase", 130, magnitudeHeight + graphGap * 0.5 + 4);
      if (frameCount > 0)
        context.fillText(
          `Frame ${editedIndex + 1} / ${frameCount}`,
          0,
          magnitudeHeight + graphGap * 0.5 + 4,
        );

      if (frameCount > 0) {
        let tag = 1;
        const binWidth = zoomWidth / 1024;
        for (let bin = 0; bin < BIN_POINTS; bin += 1) {
          const px = zoomLeft + zoomWidth * (bin / 1024);
          if (bin === tag) {
            context.fillStyle = "rgba(45,114,143,0.392157)";
            context.fillRect(px, 0, binWidth, magnitudeHeight);
            context.fillRect(px, magnitudeHeight + graphGap, binWidth, phaseHeight);
            tag *= 2;
          }
          if (px >= nativeWidth) continue;
          const preview = edit.current?.bin === bin ? edit.current : null;
          const magnitude =
            preview?.section === 0
              ? preview.value
              : Math.max(0, Math.min(1, values?.[MAGNITUDE_OFFSET + bin] ?? 0));
          const phase =
            preview?.section === 1
              ? preview.value
              : Math.max(-PI, Math.min(PI, values?.[PHASE_OFFSET + bin] ?? 0));
          context.fillStyle = "rgb(255,233,0)";
          context.strokeStyle = "rgba(45,114,143,0.392157)";
          context.lineWidth = 2;
          context.beginPath();
          context.rect(
            px + 1,
            magnitudeHeight * (1 - magnitude),
            binWidth - 2,
            magnitudeHeight * magnitude,
          );
          const phasePixels = (phaseHeight * 0.5 * phase) / PI;
          context.rect(
            px + 1,
            magnitudeHeight + graphGap + phaseHeight * 0.5 - phasePixels,
            binWidth - 2,
            phasePixels,
          );
          context.stroke();
          context.fill();
        }
      }
      context.restore();

      const drawWave = (offset: number, color: string) => {
        context.beginPath();
        for (let index = 0; index < WAVE_POINTS; index += 1) {
          const px = (index / WAVE_POINTS) * nativeWidth;
          const py = -(values?.[offset + index] ?? 0) * 18 + 35;
          if (index === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.lineCap = "butt";
        context.globalCompositeOperation = "lighter";
        context.stroke();
        context.globalCompositeOperation = "source-over";
      };
      if (frameCount > 0 && Math.round(values?.[5] ?? 1) === 0)
        drawWave(PLAYED_WAVE_OFFSET, "rgb(205,31,0)");
      if (frameCount > 0 && Math.round(values?.[4] ?? 1) === 0)
        drawWave(EDITED_WAVE_OFFSET, "rgb(2,195,154)");
      return;
    }

    if (Math.round(values?.[3] ?? 0) !== 0) return;
    const { alpha1, alpha2 } = angles.current;
    const a1 = (alpha1 * PI) / 180;
    const a2 = (alpha2 * PI) / 180;
    const ca1 = Math.cos(a1);
    const sa1 = Math.sin(a1);
    const ca2 = Math.cos(a2);
    const sa2 = Math.sin(a2);
    const project = (sample: number, x3d: number, frame: number) => {
      const y3d = (10 * frame) / Math.max(1, frameCount) - 5;
      const z3d = -sample;
      return {
        x: 10 * (ca2 * x3d + sa2 * y3d + 7.5),
        y: 10 * (z3d * ca1 - (ca2 * y3d - sa2 * x3d) * sa1 + 5),
      };
    };
    context.lineWidth = 1;
    for (let order = 0; order < frameCount; order += 1) {
      const frame = frameCount - order - 1;
      context.beginPath();
      for (let point = 0; point < FRAME_POINTS; point += 1) {
        const projected = project(
          values?.[FRAMES_OFFSET + frame * FRAME_POINTS + point] ?? 0,
          (20 * point * 2) / WAVE_POINTS - 5,
          frame,
        );
        if (point === 0) context.moveTo(projected.x, projected.y);
        else context.lineTo(projected.x, projected.y);
      }
      context.strokeStyle =
        (values?.[FLAGS_OFFSET + frame] ?? 0) > 0.5
          ? "rgba(255,233,0,0.058824)"
          : "rgba(255,233,0,0.196078)";
      context.stroke();
    }
    const drawSelectedWave = (offset: number, frame: number, color: string) => {
      if (frameCount <= 0) return;
      context.beginPath();
      for (let point = 0; point < WAVE_POINTS; point += 1) {
        const projected = project(
          values?.[offset + point] ?? 0,
          (10 * point) / WAVE_POINTS - 5,
          frame,
        );
        if (point === 0) context.moveTo(projected.x, projected.y);
        else context.lineTo(projected.x, projected.y);
      }
      context.strokeStyle = color;
      context.stroke();
    };
    drawSelectedWave(EDITED_WAVE_OFFSET, editedIndex, "rgb(2,195,154)");
    drawSelectedWave(PLAYED_WAVE_OFFSET, playedIndex, "rgb(205,31,0)");
    context.font = "8px sans-serif";
    context.fillStyle = "rgb(255,233,0)";
    context.fillText(`V=${Math.round(values?.[6] ?? 1)}`, 132, 120);
  }, [height, mode, values, viewSerial, width]);

  return (
    <canvas
      ref={canvas}
      className={`pw-rack-bidoo-limonade pw-rack-bidoo-limonade-${mode}`}
      aria-label={t("display.bidooLimonade", { view: mode })}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const point = localPoint(event, width, height);
        previousPointer.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (mode === "wavetable") return;
        scrolling.current =
          point.y >= 150 && point.x >= scrollAnchor.current && point.x <= scrollAnchor.current + 20;
        if (scrolling.current || point.x > 420) {
          edit.current = null;
          return;
        }
        const zoomWidth = 420 * 28;
        const zoomLeft = ((scrollAnchor.current / 400) * (420 - zoomWidth)) / 2;
        const bin = Math.max(
          0,
          Math.min(BIN_POINTS - 1, Math.floor(((point.x - zoomLeft) / zoomWidth) * 1024)),
        );
        if (point.y <= 70)
          edit.current = { section: 0, bin, value: values?.[MAGNITUDE_OFFSET + bin] ?? 0 };
        else if (point.y >= 100 && point.y <= 150)
          edit.current = { section: 1, bin, value: values?.[PHASE_OFFSET + bin] ?? 0 };
        else edit.current = null;
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const deltaX = ((event.clientX - previousPointer.current.x) / bounds.width) * width;
        const deltaY = ((event.clientY - previousPointer.current.y) / bounds.height) * height;
        previousPointer.current = { x: event.clientX, y: event.clientY };
        if (mode === "wavetable") {
          angles.current.alpha1 = Math.max(-90, Math.min(90, angles.current.alpha1 + deltaY));
          angles.current.alpha2 = (angles.current.alpha2 - deltaX + 360) % 360;
          setViewSerial((serial) => serial + 1);
          return;
        }
        if (scrolling.current) {
          scrollAnchor.current = Math.max(0, Math.min(400, scrollAnchor.current + deltaX));
          setViewSerial((serial) => serial + 1);
          return;
        }
        const current = edit.current;
        if (!current) return;
        current.value = event.ctrlKey
          ? 0
          : current.section === 0
            ? Math.max(0, Math.min(1, current.value - deltaY / 250))
            : Math.max(-PI, Math.min(PI, current.value - deltaY / 250));
        const normalized = current.section === 0 ? current.value : (current.value + PI) / (2 * PI);
        const encoded = Math.round(Math.max(0, Math.min(1, normalized)) * (VALUE_STEPS - 1));
        const action =
          actionBase + current.section * COMMAND_STRIDE + current.bin * VALUE_STEPS + encoded;
        onAction(action, true);
        onAction(action, false);
        setViewSerial((serial) => serial + 1);
      }}
      onPointerUp={(event) => {
        scrolling.current = false;
        edit.current = null;
        releasePointer(event);
      }}
      onPointerCancel={(event) => {
        scrolling.current = false;
        edit.current = null;
        releasePointer(event);
      }}
    />
  );
}
