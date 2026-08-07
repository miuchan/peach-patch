import { useEffect, useRef, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type JwGridVisual = Extract<RuntimeVisual, { kind: "jw-grid" }>;

const HEADER = 32;
const COLORS = ["#ff9709", "#fff309", "#901afc", "#1996fc"];

function isBlackKey(note: number) {
  return [1, 3, 6, 8, 10].includes(((note % 12) + 12) % 12);
}

export function RackJwGrid({
  visual,
  values = [],
  scaleX,
  onAction,
}: {
  visual: JwGridVisual;
  values?: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ value: boolean; index: number } | null>(null);
  const cellCount = visual.cols * visual.rows;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(visual.width * ratio);
    element.height = Math.round(visual.height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#000";
    context.fillRect(0, 0, visual.width, visual.height);

    if (visual.style === "note-seq" || visual.style === "note-seq-fu") {
      const root = Math.round(values[7] ?? 0);
      context.fillStyle = "rgb(40,40,40)";
      for (let row = 0; row < visual.rows; row += 1)
        if (!isBlackKey(visual.rows - 1 - row + root))
          context.fillRect(0, row * visual.cellHeight, visual.width, visual.cellHeight);
    }

    context.strokeStyle = "rgb(60,70,73)";
    for (let column = visual.style === "arrange" ? 0 : 1; column <= visual.cols; column += 1) {
      if (column === visual.cols && visual.style !== "arrange" && visual.style !== "note-seq")
        continue;
      context.lineWidth = column % 4 === 0 && visual.style !== "pres1t" ? 2 : 1;
      context.beginPath();
      context.moveTo(column * visual.cellWidth, 0);
      context.lineTo(column * visual.cellWidth, visual.height);
      context.stroke();
    }
    for (let row = visual.style === "arrange" ? 0 : 1; row <= visual.rows; row += 1) {
      if (row === visual.rows && !["arrange", "note-seq", "pres1t"].includes(visual.style))
        continue;
      context.lineWidth = ["note-seq", "note-seq-fu", "pres1t"].includes(visual.style)
        ? 1
        : row % 4 === 0
          ? 2
          : 1;
      context.beginPath();
      context.moveTo(0, row * visual.cellHeight);
      context.lineTo(visual.width, row * visual.cellHeight);
      context.stroke();
    }

    for (let index = 0; index < cellCount; index += 1) {
      const column = index % visual.cols;
      const row = Math.floor(index / visual.cols);
      if (visual.style === "pres1t") {
        if (Math.round(values[5] ?? -1) === index) {
          context.strokeStyle = COLORS[3];
          context.lineWidth = 2;
          context.strokeRect(
            column * visual.cellWidth,
            row * visual.cellHeight,
            visual.cellWidth,
            visual.cellHeight,
          );
        }
        if (Math.round(values[6] ?? -1) === index) {
          context.strokeStyle = COLORS[1];
          context.lineWidth = 2;
          context.strokeRect(
            column * visual.cellWidth,
            row * visual.cellHeight,
            visual.cellWidth,
            visual.cellHeight,
          );
        }
        const value = values[HEADER + index] ?? 99999;
        if (value !== 99999) {
          const barHeight = 2 + ((Math.max(-10, Math.min(10, value)) + 10) / 20) * 24;
          context.fillStyle = "rgb(60,70,73)";
          context.fillRect(
            column * visual.cellWidth + 2,
            row * visual.cellHeight + visual.cellHeight - 2 - barHeight,
            visual.cellWidth - 4,
            barHeight,
          );
        }
        continue;
      }
      if (!(values[HEADER + index] ?? 0)) continue;
      if (visual.style === "arrange") context.fillStyle = COLORS[row % 4];
      else if (visual.style === "trigs") context.fillStyle = COLORS[Math.floor(row / 4) % 4];
      else if (visual.style === "one-pattern") {
        const counter = Math.round(values[HEADER + cellCount + row] ?? 0);
        context.fillStyle = counter % (row + 1) === 0 ? COLORS[3] : COLORS[1];
      } else if (visual.style === "patterns") {
        const counter = Math.round(values[HEADER + cellCount + (index % 16)] ?? 0);
        context.fillStyle = counter % (index + 1) === 0 ? COLORS[3] : COLORS[1];
      } else context.fillStyle = COLORS[3];
      const inset = visual.style === "arrange" ? 2 : 0;
      context.fillRect(
        column * visual.cellWidth + inset,
        row * visual.cellHeight + inset,
        visual.style === "one-pattern" ? visual.width : visual.cellWidth - inset * 2,
        visual.cellHeight - inset * 2,
      );
    }

    const vertical = (column: number, color: string, y = 0, height = visual.height) => {
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(column * visual.cellWidth, y);
      context.lineTo(column * visual.cellWidth, y + height);
      context.stroke();
    };
    if (visual.style === "arrange" || visual.style === "note-seq") {
      vertical(Math.round(values[3] ?? 0), COLORS[3]);
      vertical(Math.round(values[4] ?? -1) + 1, COLORS[2]);
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      context.strokeRect(
        Math.round(values[2] ?? 0) * visual.cellWidth,
        0,
        visual.cellWidth,
        visual.height,
      );
    }
    if (visual.style === "note-seq") {
      context.strokeStyle = COLORS[0];
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, (32 - (values[8] ?? 32)) * visual.cellHeight);
      context.lineTo(visual.width, (32 - (values[8] ?? 32)) * visual.cellHeight);
      context.stroke();
      context.strokeStyle = COLORS[1];
      context.beginPath();
      context.moveTo(0, (33 - (values[9] ?? 1)) * visual.cellHeight);
      context.lineTo(visual.width, (33 - (values[9] ?? 1)) * visual.cellHeight);
      context.stroke();
    }
    if (visual.style === "note-seq-fu") {
      for (let playhead = 0; playhead < 4; playhead += 1) {
        if (!(values[22 + playhead] ?? 0)) continue;
        const color = COLORS[playhead];
        for (const column of [values[14 + playhead] ?? 0, (values[18 + playhead] ?? -1) + 1]) {
          vertical(column, color, 0, visual.cellHeight);
          vertical(column, color, visual.height - visual.cellHeight, visual.cellHeight);
        }
        vertical(values[10 + playhead] ?? 0, color);
      }
      for (const row of [32 - (values[8] ?? 32), 33 - (values[9] ?? 1)]) {
        context.strokeStyle = "rgb(120,120,120)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, row * visual.cellHeight);
        context.lineTo(visual.width, row * visual.cellHeight);
        context.stroke();
      }
    }
    if (visual.style === "trigs") {
      for (let track = 0; track < 4; track += 1) {
        const drawMarker = (absolute: number) => {
          const column = ((absolute % 16) + 16) % 16;
          const row = Math.floor(absolute / 16) + track * 4;
          vertical(column, "#fff", row * visual.cellHeight, visual.cellHeight);
        };
        drawMarker(Math.round(values[14 + track] ?? 0));
        drawMarker(Math.round(values[18 + track] ?? 0) + 1);
        const position = Math.round(values[10 + track] ?? 0);
        const row = Math.floor(position / 16) + track * 4;
        context.strokeStyle = "#fff";
        context.lineWidth = 2;
        context.strokeRect(
          (position % 16) * visual.cellWidth,
          row * visual.cellHeight,
          visual.cellWidth,
          visual.cellHeight,
        );
      }
    }
  }, [cellCount, values, visual]);

  const cellAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * visual.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * visual.height;
    const column = Math.floor(x / visual.cellWidth);
    const row = Math.floor(y / visual.cellHeight);
    return column >= 0 && column < visual.cols && row >= 0 && row < visual.rows
      ? column + row * visual.cols
      : null;
  };
  const send = (id: number) => {
    onAction(id, true);
    onAction(id, false);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-jw-grid"
      aria-label="JW-Modules grid editor"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        touchAction: "none",
        cursor: "crosshair",
      }}
      onContextMenu={(event) => {
        if (visual.style === "pres1t") event.preventDefault();
      }}
      onPointerDown={(event) => {
        const readSelection = visual.style === "pres1t" && (event.button === 2 || event.ctrlKey);
        if (event.button !== 0 && !readSelection) return;
        const index = cellAt(event);
        if (index === null) return;
        event.preventDefault();
        event.stopPropagation();
        if (
          visual.style === "arrange" &&
          event.shiftKey &&
          visual.playheadActionBase !== undefined
        ) {
          send(visual.playheadActionBase + (index % visual.cols));
          return;
        }
        if (visual.style === "pres1t") {
          send(visual.actionBase + index * 2 + (readSelection ? 1 : 0));
          return;
        }
        const next = !(values[HEADER + index] ?? 0);
        drag.current = { value: next, index };
        send(visual.actionBase + index * 2 + (next ? 1 : 0));
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const index = cellAt(event);
        if (index === null || index === current.index) return;
        current.index = index;
        send(visual.actionBase + index * 2 + (current.value ? 1 : 0));
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
