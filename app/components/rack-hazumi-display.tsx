import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const COLUMNS = 8;
const ROWS = 16;
const HEADER_HEIGHTS = 0;
const HEADER_BALLS = COLUMNS;
const HEADER_TRIGGERS = COLUMNS * 2;
const CELL_WIDTH = 19;
const CELL_HEIGHT = 19;
const CELL_PADDING = 2.25;

export function RackHazumiDisplay({
  values,
  actionBase,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
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
  const lastCell = useRef(-1);
  const lastAction = useRef(actionBase);
  const fade = useRef(Array.from({ length: COLUMNS }, () => 1));
  const previousTriggers = useRef(Array.from({ length: COLUMNS }, () => false));

  useEffect(() => {
    for (let column = 0; column < COLUMNS; column += 1) {
      const triggered = (values?.[HEADER_TRIGGERS + column] ?? 0) > 0.5;
      if (triggered && !previousTriggers.current[column]) fade.current[column] = 0;
      previousTriggers.current[column] = triggered;
    }

    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    let frame = 0;
    const draw = () => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      let animating = false;
      for (let column = 0; column < COLUMNS; column += 1) {
        const columnHeight = Math.max(
          1,
          Math.min(ROWS, Math.round(values?.[HEADER_HEIGHTS + column] ?? 1)),
        );
        const ball = Math.max(
          0,
          Math.min(ROWS - 1, Math.round(values?.[HEADER_BALLS + column] ?? 0)),
        );
        for (let row = 0; row < ROWS; row += 1) {
          const left = column * (CELL_WIDTH + CELL_PADDING);
          const top = (ROWS - row - 1) * (CELL_HEIGHT + CELL_PADDING);
          if (ball === row) {
            context.fillStyle = "rgb(223,234,236)";
          } else if (columnHeight > row) {
            const amount = fade.current[column];
            const red = Math.round(160 + (63 - 160) * amount);
            const green = Math.round(160 + (71 - 160) * amount);
            const blue = Math.round(160 + (73 - 160) * amount);
            const alpha = (150 + (255 - 150) * amount) / 255;
            context.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
          } else {
            context.fillStyle = "rgb(42,50,52)";
          }
          context.fillRect(left, top, CELL_WIDTH, CELL_HEIGHT);
        }
        if (fade.current[column] < 1) {
          fade.current[column] = Math.min(1, fade.current[column] + 0.036);
          animating = true;
        }
      }
      if (animating) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [height, values, width]);

  const cell = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * width;
    const localY = ((event.clientY - bounds.top) / bounds.height) * height;
    if (localX < 0 || localY < 0 || localX >= width || localY >= height) return null;
    const column = Math.max(
      0,
      Math.min(COLUMNS - 1, Math.floor(localX / (CELL_WIDTH + CELL_PADDING))),
    );
    const row = Math.max(1, Math.min(ROWS, 17 - Math.floor(localY / (CELL_HEIGHT + CELL_PADDING))));
    return { column, row, encoded: column * ROWS + row - 1 };
  };
  const edit = (event: PointerEvent<HTMLCanvasElement>) => {
    const next = cell(event);
    if (!next || next.encoded === lastCell.current) return;
    lastCell.current = next.encoded;
    lastAction.current = actionBase + next.encoded;
    onAction(lastAction.current, true);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    onAction(lastAction.current, false);
    lastCell.current = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-hazumi-display"
      aria-label={t("display.hazumiSequencer")}
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
        event.currentTarget.setPointerCapture(event.pointerId);
        edit(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) edit(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
