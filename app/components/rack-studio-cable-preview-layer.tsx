import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { RackCableGeometry } from "../../lib/rack-cable-layout";
import type { RackViewport } from "../../lib/rack-viewport-transform";

export type RackCablePreviewLayout = RackCableGeometry & {
  color: string;
};

export type RackCablePreviewLayerHandle = {
  draw: (geometry: RackCableGeometry, viewport: RackViewport, color: string) => void;
};

type RackStudioCablePreviewLayerProps = {
  layout: RackCablePreviewLayout | null;
  pan: { x: number; y: number };
  zoom: number;
};

type CanvasSize = {
  width: number;
  height: number;
  pixelRatio: number;
};

const PLUG_SIZE = 33;
const PORT_SIZE = 15.8003;
const plugImages = new Map<string, HTMLImageElement>();

function componentAsset(name: string, color?: string) {
  const query = new URLSearchParams({ name });
  if (color) query.set("color", color);
  return `/api/rack-component?${query}`;
}

function previewImage(name: string, color?: string) {
  const key = `${name}:${color ?? ""}`;
  let image = plugImages.get(key);
  if (!image) {
    image = new Image();
    image.src = componentAsset(name, color);
    plugImages.set(key, image);
  }
  return image;
}

function resizeCanvas(canvas: HTMLCanvasElement, size: CanvasSize) {
  if (size.width && size.height) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  size.width = width;
  size.height = height;
  size.pixelRatio = pixelRatio;
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
}

function drawPlug(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  zoom: number,
  color: string,
) {
  const plug = previewImage("Plug", color);
  const port = previewImage("PlugPort");
  context.save();
  context.translate(x, y);
  context.rotate(angle - Math.PI / 2);
  if (plug.complete && plug.naturalWidth) {
    const size = PLUG_SIZE * zoom;
    context.drawImage(plug, -size / 2, -size / 2, size, size);
  } else {
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, Math.max(3, PLUG_SIZE * zoom * 0.3), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
  if (port.complete && port.naturalWidth) {
    const size = PORT_SIZE * zoom;
    context.drawImage(port, x - size / 2, y - size / 2, size, size);
  } else {
    context.fillStyle = "#111";
    context.beginPath();
    context.arc(x, y, Math.max(1.5, PORT_SIZE * zoom * 0.25), 0, Math.PI * 2);
    context.fill();
  }
}

function drawPreview(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  geometry: RackCableGeometry,
  viewport: RackViewport,
  color: string,
) {
  resizeCanvas(canvas, size);
  const context = canvas.getContext("2d");
  if (!context || !size.width || !size.height) return;
  const { pan, zoom } = viewport;
  const x = (value: number) => pan.x + value * zoom;
  const y = (value: number) => pan.y + value * zoom;
  context.setTransform(size.pixelRatio, 0, 0, size.pixelRatio, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  context.beginPath();
  context.moveTo(x(geometry.curveStartX), y(geometry.curveStartY));
  context.quadraticCurveTo(
    x(geometry.curveControlX),
    y(geometry.curveControlY),
    x(geometry.curveEndX),
    y(geometry.curveEndY),
  );
  context.strokeStyle = color;
  context.lineWidth = Math.max(1.25, 6 * zoom);
  context.lineCap = "round";
  context.stroke();
  drawPlug(context, x(geometry.x1), y(geometry.y1), geometry.outputAngle, zoom, color);
  drawPlug(context, x(geometry.x2), y(geometry.y2), geometry.inputAngle, zoom, color);
}

const RackStudioCablePreviewLayerView = forwardRef<
  RackCablePreviewLayerHandle,
  RackStudioCablePreviewLayerProps
>(function RackStudioCablePreviewLayerView({ layout, pan, zoom }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, pixelRatio: 0 });

  useImperativeHandle(
    ref,
    () => ({
      draw(geometry, viewport, color) {
        const canvas = canvasRef.current;
        if (canvas) drawPreview(canvas, sizeRef.current, geometry, viewport, color);
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    drawPreview(canvas, sizeRef.current, layout, { pan, zoom }, layout.color);
    const observer = new ResizeObserver(() => {
      sizeRef.current.width = 0;
      drawPreview(canvas, sizeRef.current, layout, { pan, zoom }, layout.color);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [layout, pan, zoom]);

  return layout ? <canvas ref={canvasRef} className="pw-cable-preview" aria-hidden="true" /> : null;
});

export const RackStudioCablePreviewLayer = memo(RackStudioCablePreviewLayerView);
