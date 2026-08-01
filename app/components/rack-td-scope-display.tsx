import { memo, useEffect, useRef } from "react";

const HEADER = 8;

const SCHEMES = [
  [[122, 92, 255], [28, 204, 217]],
  [[0, 255, 65], [255, 15, 5]],
  [[92, 92, 92], [242, 242, 242]],
  [[140, 0, 0], [255, 255, 30]],
  [[92, 28, 0], [255, 188, 64]],
  [[0, 48, 8], [168, 255, 112]],
] as const;

function brightened(color: readonly number[], brightness: number) {
  const scale = brightness <= .5 ? .35 + brightness / .5 * .65 : 1;
  const lift = brightness <= .5 ? 0 : (brightness - .5) / .5 * .42;
  return color.map((channel) => Math.round(Math.min(255, channel * scale + (255 - channel * scale) * lift)));
}

export const RackTdScopeDisplay = memo(function RackTdScopeDisplay({
  values,
  state,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  state?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayWidth = width * scaleX;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#000";
    context.fillRect(0, 0, displayWidth, height);

    const linked = (values?.[0] ?? 0) > .5;
    const preview = (values?.[1] ?? 0) > .5;
    if (!linked || !preview) {
      context.strokeStyle = "rgba(122,92,255,.48)";
      context.lineWidth = 1.25;
      context.beginPath();
      context.moveTo(displayWidth * .16, height * .72);
      context.bezierCurveTo(displayWidth * .88, height * .55, displayWidth * .07, height * .34, displayWidth * .78, height * .18);
      context.stroke();
      context.fillStyle = linked ? "#d7e8ee" : "#96b0be";
      context.textAlign = "center";
      context.font = "7px ui-monospace, monospace";
      context.fillText(linked ? "WAITING FOR PREVIEW" : "ATTACH TO", displayWidth / 2, height - 26);
      context.font = "bold 9px ui-monospace, monospace";
      context.fillText("TEMPORAL DECK", displayWidth / 2, height - 14);
      return;
    }

    const rows = Math.max(1, Math.min(256, Math.round(values?.[6] ?? 256)));
    const stereo = (values?.[7] ?? 0) > .5;
    const inverted = Boolean(state?.[1] ?? 0);
    const scheme = Math.max(0, Math.min(SCHEMES.length - 1, Math.round(state?.[3] ?? 0)));
    const brightness = Math.max(0, Math.min(1, state?.[5] ?? .5));
    const low = brightened(SCHEMES[scheme][0], brightness);
    const high = brightened(SCHEMES[scheme][1], brightness);
    const gap = stereo ? 2 : 0;
    const laneWidth = stereo ? (displayWidth - gap) / 2 : displayWidth;
    if (stereo) {
      context.strokeStyle = `rgba(${low.join(",")},.25)`;
      context.lineWidth = .5;
      context.beginPath();
      context.moveTo(laneWidth + gap / 2, 0);
      context.lineTo(laneWidth + gap / 2, height);
      context.stroke();
    }

    for (let row = 0; row < rows; row++) {
      const sourceRow = inverted ? rows - row - 1 : row;
      const offset = HEADER + sourceRow * 4;
      const yPosition = (row + .5) * height / rows;
      for (let channel = 0; channel < (stereo ? 2 : 1); channel++) {
        const minimum = values?.[offset + channel * 2] ?? 0;
        const maximum = values?.[offset + channel * 2 + 1] ?? 0;
        const peak = Math.min(1, Math.max(Math.abs(minimum), Math.abs(maximum)));
        const color = low.map((value, index) => Math.round(value + (high[index] - value) * peak));
        const center = channel * (laneWidth + gap) + laneWidth / 2;
        const half = laneWidth * .46;
        context.strokeStyle = `rgba(${color.join(",")},${.32 + peak * .68})`;
        context.lineWidth = Math.max(.55, height / rows * .7);
        context.beginPath();
        context.moveTo(center + minimum * half, yPosition);
        context.lineTo(center + maximum * half, yPosition);
        context.stroke();
      }
    }

    let marker = Math.max(0, Math.min(1, values?.[4] ?? .5));
    const sampleMode = ((values?.[2] ?? 0) & 1) !== 0;
    marker = sampleMode ? .5 : Math.max(.5, marker);
    if (inverted) marker = 1 - marker;
    context.strokeStyle = "rgba(238,244,247,.72)";
    context.lineWidth = .75;
    context.beginPath();
    context.moveTo(0, marker * height + .5);
    context.lineTo(displayWidth, marker * height + .5);
    context.stroke();
  }, [displayWidth, height, state, values]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={(values?.[0] ?? 0) > .5 ? "TD.Scope waveform linked to Temporal Deck" : "TD.Scope, attach to Temporal Deck"}
      style={{ position: "absolute", left: x * scaleX, top: y, width: displayWidth, height, pointerEvents: "none", zIndex: 4 }}
    />
  );
});
