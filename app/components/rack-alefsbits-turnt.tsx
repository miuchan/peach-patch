import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";

const COLORS = {
  activeTab: "#8f3b3b",
  unavailableTab: "#3b3b3b",
  inactiveTab: "#1e1e1e",
  activeLabel: "#ffffff",
  unavailableLabel: "#7f7f7f",
  inactiveLabel: "#b0b0b0",
  background: "#1e1e1e",
  grid: "#50575c",
  trigger: "#8f3b3b",
  wave: "#ffffff",
};

export function RackAlefsbitsTurnt({
  values,
  actionBase,
  maxPoints,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  maxPoints: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const activeChannel = Math.max(0, Math.min(15, Math.round(values?.[0] ?? 0)));
  const channels = Math.max(0, Math.min(16, Math.round(values?.[2] ?? 0)));
  const mode = Math.round(values?.[3] ?? 0) === 1 ? 1 : 0;
  const zero = values?.[4] ?? 0;
  const pointCount = Math.max(0, Math.min(maxPoints, Math.round(values?.[5] ?? 0)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * scaleX * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio * scaleX, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const drawTabs = (first: number, top: number) => {
      const tabWidth = width / 8;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "8px sans-serif";
      for (let offset = 0; offset < 8; offset += 1) {
        const channel = first + offset;
        const available = channel < channels;
        const selected = available && channel === activeChannel;
        context.fillStyle = selected
          ? COLORS.activeTab
          : available
            ? COLORS.inactiveTab
            : COLORS.unavailableTab;
        context.fillRect(offset * tabWidth, top, tabWidth, 10);
        context.fillStyle = selected
          ? COLORS.activeLabel
          : available
            ? COLORS.inactiveLabel
            : COLORS.unavailableLabel;
        context.fillText(String(channel + 1), offset * tabWidth + tabWidth / 2, top + 5);
      }
    };

    drawTabs(0, 0);
    drawTabs(8, 103);
    const scopeTop = 9;
    const scopeHeight = 95;
    context.fillStyle = COLORS.background;
    context.fillRect(0, scopeTop, width, scopeHeight);
    context.strokeStyle = COLORS.grid;
    context.lineWidth = 1;
    for (const fraction of mode === 0 ? [0.25, 0.75] : [0.5]) {
      const lineY = scopeTop + scopeHeight * (1 - fraction);
      context.beginPath();
      context.moveTo(0, lineY);
      context.lineTo(width, lineY);
      context.stroke();
    }
    if (pointCount < 2) return;
    const minimum = mode === 1 ? 0 : -10;
    const maximum = 10;
    const toY = (value: number) =>
      scopeTop + scopeHeight - ((value - minimum) / (maximum - minimum)) * scopeHeight;
    const zeroY = toY(zero);

    context.strokeStyle = COLORS.trigger;
    context.lineWidth = 1;
    for (let index = 0; index < pointCount; index += 1) {
      if ((values?.[6 + maxPoints + index] ?? 0) <= 0.5) continue;
      const pointX = (index / (pointCount - 1)) * width;
      context.beginPath();
      context.moveTo(pointX, scopeTop);
      context.lineTo(pointX, scopeTop + scopeHeight);
      context.stroke();
    }

    const drawEnvelope = (upper: boolean) => {
      context.beginPath();
      context.moveTo(0, zeroY);
      for (let index = pointCount - 1; index >= 0; index -= 1) {
        const pointX = (index / (pointCount - 1)) * width;
        const sampleY = toY(values?.[6 + index] ?? 0);
        context.lineTo(pointX, upper ? Math.min(sampleY, zeroY) : Math.max(sampleY, zeroY));
      }
      context.lineTo(0, zeroY);
      const gradient = context.createLinearGradient(
        width / 2,
        zeroY,
        width / 2,
        upper ? scopeTop : scopeTop + scopeHeight,
      );
      gradient.addColorStop(0, "#ffffff00");
      gradient.addColorStop(1, COLORS.wave);
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = COLORS.wave;
      context.lineWidth = 1;
      context.stroke();
    };
    drawEnvelope(true);
    drawEnvelope(false);
  }, [activeChannel, channels, height, maxPoints, mode, pointCount, scaleX, values, width, zero]);

  const local = (event: PointerEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * width,
      y: ((event.clientY - bounds.top) / bounds.height) * height,
    };
  };
  const selectTabAt = (point: { x: number; y: number }) => {
    const first = point.y < 10 ? 0 : point.y >= 103 ? 8 : -1;
    if (first < 0) return false;
    const channel = first + Math.max(0, Math.min(7, Math.floor((point.x / width) * 8)));
    if (channel < channels) onAction(actionBase + channel, true);
    return true;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const point = pointerRef.current;
    const first = point.y < 10 ? 0 : point.y >= 103 ? 8 : -1;
    if (first < 0) return;
    const hovered = first + Math.max(0, Math.min(7, Math.floor((point.x / width) * 8)));
    const channel = hovered + (event.key === "ArrowLeft" ? -1 : 1);
    if (channel >= first && channel < first + 8 && channel < channels) {
      event.preventDefault();
      onAction(actionBase + channel, true);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="pw-rack-alefsbits-turnt"
      tabIndex={0}
      aria-label="Turnt scope and channel tabs"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        zIndex: 8,
        touchAction: "none",
      }}
      onPointerMove={(event) => {
        pointerRef.current = local(event);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        event.currentTarget.focus();
        const point = local(event);
        pointerRef.current = point;
        if (!selectTabAt(point) && point.y >= 9 && point.y <= 104) onAction(actionBase + 16, true);
      }}
      onKeyDown={onKeyDown}
      onWheel={(event) => {
        const point = local(event);
        pointerRef.current = point;
        if ((point.y < 10 || point.y >= 103) && event.deltaX !== 0) {
          event.preventDefault();
          const first = point.y < 10 ? 0 : 8;
          const hovered = first + Math.max(0, Math.min(7, Math.floor((point.x / width) * 8)));
          const channel = hovered + (event.deltaX < 0 ? 1 : -1);
          if (channel >= first && channel < first + 8 && channel < channels)
            onAction(actionBase + channel, true);
        } else if (point.y >= 9 && point.y <= 104 && event.deltaY !== 0) {
          event.preventDefault();
          onAction(actionBase + (event.deltaY < 0 ? 17 : 18), true);
        }
      }}
    />
  );
}
