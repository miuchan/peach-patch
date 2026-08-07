import { useEffect, useRef } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type D1v1deVisual = Extract<RuntimeVisual, { kind: "jw-d1v1de" }>;
type ThingThingVisual = Extract<RuntimeVisual, { kind: "jw-thing-thing" }>;
type TreeVisual = Extract<RuntimeVisual, { kind: "jw-tree" }>;

const BALL_COLORS = ["#ffffff", "#ff9709", "#fff309", "#901afc", "#1996fc"];
const DIVIDER_COLORS = ["#1996fc", "#ff9709", "#fff309", "#901afc"];

function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function canvasStyle(
  visual: { x: number; y: number; width: number; height: number },
  scaleX: number,
) {
  return {
    position: "absolute" as const,
    left: visual.x * scaleX,
    top: visual.y,
    width: visual.width * scaleX,
    height: visual.height,
    pointerEvents: "none" as const,
  };
}

export function RackJwD1v1deDisplay({
  visual,
  values = [],
  scaleX,
}: {
  visual: D1v1deVisual;
  values?: number[];
  scaleX: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const width = visual.width * scaleX,
      context = prepareCanvas(element, width, visual.height);
    if (!context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, visual.height);
    const division = Math.max(1, Math.min(64, Math.round(values[1] ?? 4))),
      rowHeight = visual.height / division;
    context.strokeStyle = "rgb(60,70,73)";
    context.lineWidth = 1;
    for (let row = 1; row < division; row += 1) {
      context.beginPath();
      context.moveTo(0, row * rowHeight);
      context.lineTo(width, row * rowHeight);
      context.stroke();
    }
    const offset = Math.round(values[2] ?? 0);
    if (offset > 0 && (offset + 1) * rowHeight < visual.height + 2) {
      context.fillStyle = "rgb(60,70,73)";
      context.fillRect(0, offset * rowHeight, width, rowHeight);
    }
    const tick = Math.round(values[0] ?? 0);
    if ((tick + 1) * rowHeight < visual.height + 2) {
      context.fillStyle = DIVIDER_COLORS[Math.max(0, Math.min(3, Math.round(values[3] ?? 0)))];
      context.fillRect(0, tick * rowHeight, width, rowHeight);
    }
  }, [scaleX, values, visual]);
  return (
    <canvas
      ref={canvas}
      className="pw-rack-jw-d1v1de"
      aria-label="D1v1de clock division display"
      style={canvasStyle(visual, scaleX)}
    />
  );
}

export function RackJwThingThingDisplay({
  visual,
  values = [],
  scaleX,
}: {
  visual: ThingThingVisual;
  values?: number[];
  scaleX: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const width = visual.width * scaleX,
      context = prepareCanvas(element, width, visual.height);
    if (!context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, visual.height);
    const points = [{ x: width / 2, y: visual.height / 2 }];
    for (let index = 1; index < 5; index += 1) {
      const previous = points[index - 1];
      points.push({
        x: previous.x + (values[2 + index * 2] ?? 0),
        y: previous.y + (values[3 + index * 2] ?? 0),
      });
    }
    context.strokeStyle = "#fff";
    context.lineWidth = 1;
    for (let index = 1; index < points.length; index += 1) {
      context.beginPath();
      context.moveTo(points[index - 1].x, points[index - 1].y);
      context.lineTo(points[index].x, points[index].y);
      context.stroke();
    }
    const radius = values[0] ?? 5;
    for (let index = 0; index < points.length; index += 1) {
      context.beginPath();
      context.arc(points[index].x, points[index].y, radius, 0, Math.PI * 2);
      context.fillStyle = BALL_COLORS[index];
      context.strokeStyle = BALL_COLORS[index];
      context.lineWidth = 2;
      context.fill();
      context.stroke();
    }
  }, [scaleX, values, visual]);
  return (
    <canvas
      ref={canvas}
      className="pw-rack-jw-thing-thing"
      aria-label="ThingThing orbit display"
      style={canvasStyle(visual, scaleX)}
    />
  );
}

function treeColor(hue: number) {
  const wrappedHue = ((hue % 1) + 1) % 1;
  return `hsla(${wrappedHue * 360},50%,50%,${0xc0 / 0xff})`;
}

export function RackJwTreeDisplay({
  visual,
  values = [],
  scaleX,
}: {
  visual: TreeVisual;
  values?: number[];
  scaleX: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const width = visual.width * scaleX,
      context = prepareCanvas(element, width, visual.height);
    if (!context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, visual.height);
    const theta = ((values[0] ?? 25) * Math.PI) / 180,
      hue = values[1] ?? 0.1,
      reduce = values[2] ?? 0.65,
      length = values[3] ?? 110,
      height = values[4] ?? 150,
      jitter = values[5] ?? 0,
      random = values.slice(6, 31);
    const stroke = (distance: number) => {
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, -distance);
      context.stroke();
    };
    const branch = (distance: number, count: number) => {
      const reduced = distance * reduce;
      if (reduced <= 2) return;
      const nextCount = count + 1,
        randomAngle = (random[nextCount % 25] ?? 0) * jitter;
      context.strokeStyle = treeColor(hue * nextCount * 0.5);
      for (const direction of [1, -1]) {
        context.save();
        context.rotate(direction * theta + randomAngle);
        stroke(reduced);
        context.translate(0, -reduced);
        branch(reduced, nextCount);
        context.restore();
      }
    };
    context.save();
    context.translate(width / 2, visual.height);
    context.lineWidth = 2;
    context.strokeStyle = treeColor(hue);
    stroke(height);
    context.translate(0, -height);
    branch(length, 1);
    context.restore();
  }, [scaleX, values, visual]);
  return (
    <canvas
      ref={canvas}
      className="pw-rack-jw-tree"
      aria-label="Tree fractal display"
      style={canvasStyle(visual, scaleX)}
    />
  );
}
