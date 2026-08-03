import { type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

export function RackXYPadDisplay({
  values,
  x,
  y,
  width,
  height,
  displayWidth,
  displayHeight,
  actionBase,
  xParam,
  yParam,
  scaleX,
  onParam,
  onMomentary,
}: {
  values?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  actionBase: number;
  xParam: number;
  yParam: number;
  scaleX: number;
  onParam: (id: number, value: number) => void;
  onMomentary: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const valid = Boolean(values && values.length >= 6 && (values.length - 6) % 2 === 0),
    ballX = valid ? values![0] : displayWidth / 2,
    ballY = valid ? values![1] : displayHeight / 2,
    gate = valid && values![2] >= 0.5,
    path = valid
      ? Array.from({ length: (values!.length - 6) / 2 }, (_, index) => {
          const offset = 6 + index * 2;
          return `${index ? "L" : "M"}${values![offset].toFixed(2)},${values![offset + 1].toFixed(2)}`;
        }).join(" ")
      : "";

  const updatePosition = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(),
      px = Math.max(
        12,
        Math.min(
          displayWidth - 12,
          ((event.clientX - rect.left) * displayWidth) / Math.max(1, rect.width),
        ),
      ),
      py = Math.max(
        12,
        Math.min(
          displayHeight - 12,
          ((event.clientY - rect.top) * displayHeight) / Math.max(1, rect.height),
        ),
      );
    onParam(xParam, px);
    onParam(yParam, py);
  };

  return (
    <svg
      className="pw-rack-xy-pad"
      aria-label={t("display.xyPad")}
      viewBox={`0 0 ${displayWidth} ${displayHeight}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onPointerDown={(event) => {
        if (event.button > 0) return;
        event.preventDefault();
        event.stopPropagation();
        updatePosition(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        onMomentary(actionBase, true);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        updatePosition(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        onMomentary(actionBase, false);
      }}
      onPointerCancel={() => onMomentary(actionBase, false)}
    >
      <rect width={displayWidth} height={displayHeight} fill="#000" />
      <g stroke="#143235" fill={gate ? "#143235" : "none"} strokeWidth="2">
        <line x1="0" y1={displayHeight - ballY} x2={displayWidth} y2={displayHeight - ballY} />
        <line x1={displayWidth - ballX} y1="0" x2={displayWidth - ballX} y2={displayHeight} />
        <circle cx={displayWidth - ballX} cy={displayHeight - ballY} r="10" />
      </g>
      {path ? <path d={path} fill="none" stroke="#1996fc" strokeWidth="2" /> : null}
      <g stroke="#fff" fill="none" strokeWidth="1">
        <line x1="0" y1={ballY} x2={displayWidth} y2={ballY} />
        <line x1={ballX} y1="0" x2={ballX} y2={displayHeight} />
      </g>
      <circle
        cx={ballX}
        cy={ballY}
        r="10"
        fill={gate ? "#1996fc" : "none"}
        stroke="#1996fc"
        strokeWidth="2"
      />
    </svg>
  );
}
