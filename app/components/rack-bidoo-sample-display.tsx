import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const SAMPLE_POINTS = 4096;
const CANARD_HEADER = 10;
const CANARD_SLICES = 128;
const EDSAROS_HEADER = 7;
const OUAIVE_HEADER = 9;
const ACTION_STEPS = 65536;

type View = { width: number; left: number; referenceX: number };

export function RackBidooSampleDisplay({
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
  mode: "canard" | "edsaros" | "ouaive";
  actionBase?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ width, left: 0, referenceX: 0 });
  const previousPointer = useRef({ x: 0, y: 0 });
  const [viewSerial, setViewSerial] = useState(0);

  useEffect(() => {
    if (view.current.width < width) view.current = { width, left: 0, referenceX: 0 };
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const sampleCount = Math.max(0, Math.round(values?.[0] ?? 0));
    if (!sampleCount) return;
    const zoom = view.current.width;
    const left = view.current.left;
    const position = (normalized: number) => normalized * zoom + left;
    const drawWave = (offset: number, top: number, waveHeight: number, color: string) => {
      context.save();
      context.beginPath();
      context.rect(0, top, width, waveHeight);
      context.clip();
      context.beginPath();
      let started = false;
      const first = Math.max(0, Math.floor((-left / zoom) * (SAMPLE_POINTS - 1)));
      const last = Math.min(
        SAMPLE_POINTS - 1,
        Math.ceil(((width - left) / zoom) * (SAMPLE_POINTS - 1)),
      );
      for (let index = first; index <= last; index += 1) {
        const normalized = index / (SAMPLE_POINTS - 1);
        const sample = values?.[offset + index] ?? 0;
        const px = position(normalized);
        const py = top + waveHeight * (0.5 + sample * 0.5);
        if (!started) {
          context.moveTo(px, py);
          started = true;
        } else context.lineTo(px, py);
      }
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.lineCap = "butt";
      context.globalCompositeOperation = mode === "edsaros" ? "source-over" : "lighter";
      context.stroke();
      context.restore();
    };

    if (mode === "canard") {
      const channelHeight = 50;
      context.strokeStyle = "rgba(255,255,255,0.188235)";
      context.lineWidth = 1;
      for (const center of [channelHeight / 2, channelHeight * 1.5 + 10]) {
        context.beginPath();
        context.moveTo(0, center);
        context.lineTo(width, center);
        context.stroke();
      }
      const loading = (values?.[5] ?? 0) > 0.5;
      if (!loading) {
        context.strokeStyle = "rgb(45,114,143)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(position(values?.[1] ?? 0), 0);
        context.lineTo(position(values?.[1] ?? 0), height);
        context.stroke();
        context.fillStyle = "rgba(255,255,255,0.235294)";
        context.beginPath();
        context.moveTo(position((values?.[2] ?? 0) + (values?.[4] ?? 0)), 0);
        context.lineTo(position(values?.[2] ?? 0), height);
        context.lineTo(position(values?.[3] ?? 0), height);
        context.lineTo(position((values?.[3] ?? 0) - (values?.[4] ?? 0)), 0);
        context.closePath();
        context.fill();
      }
      drawWave(CANARD_HEADER + CANARD_SLICES, 0, channelHeight, "rgb(164,3,111)");
      drawWave(
        CANARD_HEADER + CANARD_SLICES + SAMPLE_POINTS,
        channelHeight + 10,
        channelHeight,
        "rgb(164,3,111)",
      );
      const sliceCount = Math.max(0, Math.min(CANARD_SLICES, Math.round(values?.[9] ?? 0)));
      if (Math.round(values?.[6] ?? 0) === 1) {
        const selected = Math.round(values?.[7] ?? -1);
        if (selected >= 0 && selected < sliceCount) {
          const start = values?.[CANARD_HEADER + selected] ?? 0;
          const end = selected + 1 < sliceCount ? (values?.[CANARD_HEADER + selected + 1] ?? 1) : 1;
          context.strokeStyle = "rgb(205,31,0)";
          context.lineWidth = 4;
          context.beginPath();
          context.moveTo(position(start), height - 1);
          context.lineTo(position(end), height - 1);
          context.stroke();
        }
        const deleting = values?.[8] ?? -1;
        for (let index = 0; index < sliceCount; index += 1) {
          const marker = values?.[CANARD_HEADER + index] ?? 0;
          context.strokeStyle =
            Math.abs(marker - deleting) < 1e-7 ? "rgb(205,31,0)" : "rgb(255,233,0)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(position(marker), 0);
          context.lineTo(position(marker), height);
          context.stroke();
        }
      }
    } else if (mode === "ouaive") {
      const waveformTop = 15;
      const channelHeight = 50;
      context.fillStyle = "rgb(255,233,0)";
      context.font = "14px sans-serif";
      context.textBaseline = "top";
      const triggerMode = Math.round(values?.[3] ?? 0);
      context.fillText(triggerMode === 0 ? "TRIG" : triggerMode === 1 ? "GATE" : "SLICE", 3, 0);
      context.fillText(
        Math.round(values?.[6] ?? 0) === 0 ? "►" : Math.round(values?.[6] ?? 0) === 2 ? "►►" : "◄",
        40,
        0,
      );
      if (triggerMode === 2) context.fillText(`|${Math.round(values?.[4] ?? 1)}|`, 59, 0);
      context.fillText(`x${(values?.[7] ?? 0).toFixed(1)}`, 90, 0);
      context.strokeStyle = "rgba(255,255,255,0.188235)";
      context.lineWidth = 1;
      for (const center of [
        waveformTop + channelHeight / 2,
        waveformTop + channelHeight * 1.5 + 10,
      ]) {
        context.beginPath();
        context.moveTo(0, center);
        context.lineTo(width, center);
        context.stroke();
      }
      if ((values?.[8] ?? 0) > 0.5) {
        context.strokeStyle = "rgb(45,114,143)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(position(values?.[1] ?? 0), waveformTop);
        context.lineTo(position(values?.[1] ?? 0), waveformTop + 2 * channelHeight + 10);
        context.stroke();
      }
      if ((values?.[2] ?? 0) <= 0.5) {
        drawWave(OUAIVE_HEADER, waveformTop, channelHeight, "rgb(164,3,111)");
        drawWave(
          OUAIVE_HEADER + SAMPLE_POINTS,
          waveformTop + channelHeight + 10,
          channelHeight,
          "rgb(164,3,111)",
        );
        if (triggerMode === 2) {
          const slices = Math.max(1, Math.round(values?.[4] ?? 1));
          for (let slice = 1; slice < slices; slice += 1) {
            const px = position(slice / slices);
            context.strokeStyle = "rgb(255,233,0)";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(px, waveformTop);
            context.lineTo(px, waveformTop + 2 * channelHeight + 10);
            context.stroke();
          }
        }
      }
    } else {
      context.strokeStyle = "white";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
      drawWave(EDSAROS_HEADER, 0, height, "rgba(164,3,111,0.784314)");
      context.strokeStyle = "rgb(45,114,143)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(position(values?.[1] ?? 0), 0);
      context.lineTo(position(values?.[1] ?? 0), height);
      context.stroke();
      context.strokeStyle = "rgb(255,233,0)";
      context.fillStyle = "rgb(255,233,0)";
      for (const [index, marker] of [
        [2, "right"],
        [3, "right-top"],
        [4, "left-top"],
        [5, "right"],
      ] as const) {
        const px = position(values?.[index] ?? 0);
        const top = marker.includes("top") ? 0 : 10;
        context.beginPath();
        context.moveTo(px, top);
        context.lineTo(px, height);
        context.stroke();
        context.beginPath();
        context.moveTo(px, top);
        context.lineTo(px + (marker.startsWith("left") ? -5 : 5), top + 3);
        context.lineTo(px, top + 6);
        context.closePath();
        context.fill();
      }
    }
  }, [height, mode, values, viewSerial, width]);

  const local = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * width,
      y: ((event.clientY - bounds.top) / bounds.height) * height,
    };
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <canvas
      ref={canvas}
      className={`pw-rack-bidoo-sample pw-rack-bidoo-sample-${mode}`}
      aria-label={t("display.bidooSample", {
        module: mode === "canard" ? "cANARd" : mode === "edsaros" ? "eDsaroS" : "OUAIve",
      })}
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
        const point = local(event);
        view.current.referenceX = mode === "ouaive" ? 0 : point.x;
        previousPointer.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (mode === "canard" && actionBase !== undefined) {
          const normalized = Math.max(
            0,
            Math.min(1, (point.x - view.current.left) / view.current.width),
          );
          const action = actionBase + Math.round(normalized * (ACTION_STEPS - 1));
          onAction(action, true);
          onAction(action, false);
        }
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        const deltaX =
          ((event.clientX - previousPointer.current.x) /
            event.currentTarget.getBoundingClientRect().width) *
          width;
        const deltaY = event.clientY - previousPointer.current.y;
        previousPointer.current = { x: event.clientX, y: event.clientY };
        let factor = 1;
        if (mode === "canard" || mode === "ouaive") {
          if (deltaY > 0) factor = 1 / (event.shiftKey ? 2 : 1.1);
          else if (deltaY < 0) factor = event.shiftKey ? 2 : 1.1;
        } else if (deltaY < 0) factor = 1 / (event.shiftKey ? 3 : 2);
        else if (deltaY > 0) factor = event.shiftKey ? 2 : 1.1;
        const oldWidth = view.current.width;
        const nextWidth = Math.max(width, oldWidth * factor);
        const nextLeft = Math.max(
          width - nextWidth,
          Math.min(
            0,
            view.current.referenceX -
              (view.current.referenceX - view.current.left) * factor +
              deltaX,
          ),
        );
        view.current = { ...view.current, width: nextWidth, left: nextLeft };
        setViewSerial((serial) => serial + 1);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
