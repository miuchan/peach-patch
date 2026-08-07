import { useEffect, useRef, useState } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type DotMatrixTextVisual = Extract<RuntimeVisual, { kind: "dot-matrix-text" }>;

function normalizedText(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z ]/g, "");
}

export function RackDotMatrixText({
  data,
  visual,
  scaleX,
  onData,
}: {
  data: Record<string, unknown>;
  visual: DotMatrixTextVisual;
  scaleX: number;
  onData: (data: Record<string, unknown>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focused, setFocused] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const text = normalizedText(data[visual.dataKey]);
  const width = visual.width * scaleX;

  useEffect(() => {
    if (!focused) {
      setCursorVisible(false);
      return;
    }
    setCursorVisible(true);
    const timer = window.setInterval(() => setCursorVisible((visible) => !visible), 1_667);
    return () => window.clearInterval(timer);
  }, [focused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(visual.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = visual.background;
    context.fillRect(0, 0, width, visual.height);
    context.fillStyle = visual.color;
    const perLine = Math.floor((visual.columns + 1) / 6);
    const drawPixel = (x: number, y: number) =>
      context.fillRect(
        (visual.border + x * visual.pitch) * scaleX,
        visual.border + y * visual.pitch,
        visual.pixelSize * scaleX,
        visual.pixelSize,
      );
    [...text].forEach((character, index) => {
      const line = Math.floor(index / perLine);
      const offsetX = (index - line * perLine) * 6;
      const offsetY = line * 8;
      for (const [x, y] of visual.glyphs[character] ?? []) {
        if (x + offsetX < visual.columns && y + offsetY < visual.rows)
          drawPixel(x + offsetX, y + offsetY);
      }
    });
    if (focused && cursorVisible) {
      const line = Math.floor(text.length / perLine);
      const offsetX = (text.length - line * perLine) * 6;
      const offsetY = line * 8;
      for (let y = 0; y < 7; y++)
        if (offsetX < visual.columns && offsetY + y < visual.rows) drawPixel(offsetX, offsetY + y);
    }
  }, [cursorVisible, focused, scaleX, text, visual, width]);

  return (
    <label
      aria-label="Message"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width,
        height: visual.height,
        zIndex: 9,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: "block", width, height: visual.height }}
      />
      <input
        aria-label="Message text"
        value={text}
        spellCheck={false}
        autoCapitalize="characters"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) =>
          onData({ [visual.dataKey]: normalizedText(event.currentTarget.value) })
        }
        onKeyDown={(event) => event.stopPropagation()}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          border: 0,
          opacity: 0,
          cursor: "text",
        }}
      />
    </label>
  );
}
