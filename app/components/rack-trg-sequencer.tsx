import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_VALUES = 4;
const GRID_X = 10;
const GRID_Y = 6;
const CELL_WIDTH = 20;
const CELL_HEIGHT = 20;
const COLUMN_STRIDE = 30;
const ROW_STRIDE = 24;
const PAGE_Y = 198;
const PAGE_HIT_HEIGHT = 14;

export function RackTrgSequencer({
  values,
  actionBase,
  steps,
  pageSize,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  steps: number;
  pageSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const valuesRef = useRef(values);
  const paintState = useRef<number | null>(null);
  const lastStep = useRef(-1);
  const lastAction = useRef(actionBase);

  useEffect(() => {
    valuesRef.current = values;
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "rgb(20,30,33)";
    context.fillRect(0, 0, width, height);

    const currentStep = Math.round(values?.[0] ?? 0);
    const page = Math.max(0, Math.min(1, Math.round(values?.[1] ?? 0)));
    const sequenceLength = Math.max(1, Math.min(steps, Math.round(values?.[2] ?? steps)));
    const rowCount = pageSize / 2;
    for (let displayed = 0; displayed < pageSize; displayed += 1) {
      const column = Math.floor(displayed / rowCount);
      const row = displayed % rowCount;
      const step = page * pageSize + displayed;
      const enabled = (values?.[HEADER_VALUES + step] ?? 0) > 0.5;
      const color = step < sequenceLength ? "rgb(252,252,3)" : "rgb(62,62,0)";
      const left = GRID_X + column * COLUMN_STRIDE;
      const top = GRID_Y + row * ROW_STRIDE;
      context.fillStyle = color;
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.beginPath();
      context.rect(left, top, CELL_WIDTH, CELL_HEIGHT);
      if (enabled) context.fill();
      else context.stroke();
      if (step === currentStep) {
        context.fillStyle = enabled ? "rgb(20,30,33)" : color;
        context.beginPath();
        context.arc(left + CELL_WIDTH / 2, top + CELL_HEIGHT / 2, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.fillStyle = "rgb(252,252,3)";
    context.fillRect(GRID_X + page * COLUMN_STRIDE, 200, CELL_WIDTH, 6);
  }, [values, width, height, steps, pageSize]);

  const logicalPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * width,
      y: ((event.clientY - bounds.top) / bounds.height) * height,
    };
  };
  const stepAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const position = logicalPosition(event);
    const column =
      position.x > GRID_X && position.x < GRID_X + CELL_WIDTH
        ? 0
        : position.x > GRID_X + COLUMN_STRIDE && position.x < GRID_X + COLUMN_STRIDE + CELL_WIDTH
          ? 1
          : -1;
    if (column < 0 || position.y <= GRID_Y) return -1;
    const row = Math.floor((position.y - GRID_Y) / ROW_STRIDE);
    if (row < 0 || row >= pageSize / 2 || (position.y - GRID_Y) % ROW_STRIDE >= CELL_HEIGHT)
      return -1;
    const page = Math.max(0, Math.min(1, Math.round(valuesRef.current?.[1] ?? 0)));
    return page * pageSize + column * (pageSize / 2) + row;
  };
  const sendStep = (step: number) => {
    if (step < 0 || step === lastStep.current || paintState.current === null) return;
    const id = actionBase + paintState.current * steps + step;
    lastStep.current = step;
    lastAction.current = id;
    onAction(id, true);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-trg-sequencer"
      aria-label={t("display.trgSequencer")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
        cursor: "pointer",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const step = stepAt(event);
        if (step >= 0) {
          paintState.current = (valuesRef.current?.[HEADER_VALUES + step] ?? 0) > 0.5 ? 0 : 1;
          lastStep.current = -1;
          sendStep(step);
          return;
        }
        const position = logicalPosition(event);
        if (
          position.x > GRID_X &&
          position.x < GRID_X + CELL_WIDTH * 2 + 10 &&
          position.y > PAGE_Y &&
          position.y < PAGE_Y + PAGE_HIT_HEIGHT
        ) {
          const page = Math.max(0, Math.min(1, Math.round(valuesRef.current?.[1] ?? 0)));
          const id = actionBase + steps * 2 + (page === 0 ? 1 : 0);
          lastAction.current = id;
          onAction(id, true);
        }
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId) || paintState.current === null)
          return;
        event.preventDefault();
        sendStep(stepAt(event));
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        onAction(lastAction.current, false);
        paintState.current = null;
        lastStep.current = -1;
      }}
      onPointerCancel={() => {
        onAction(lastAction.current, false);
        paintState.current = null;
        lastStep.current = -1;
      }}
    />
  );
}
