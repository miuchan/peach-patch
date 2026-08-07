import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const CLOCK_KEYS = ["z", "x", "c", "v"];
const SCALE_KEYS = ["a", "s", "d", "f"];

export function RackMouseSeqGrid({
  values,
  actionBase,
  hotkeyBase,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  hotkeyBase: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const lastAction = useRef(actionBase);
  const size = Math.max(1, Math.min(64, Math.round(values?.[0] ?? 32)));
  const cursorX = Math.max(0, Math.min(size - 1, Math.round(values?.[1] ?? 0)));
  const cursorY = Math.max(0, Math.min(size - 1, Math.round(values?.[2] ?? 0)));
  const gate = (values?.[3] ?? 0) > 0.5;
  const playX = Math.max(0, Math.min(size - 1, Math.round(values?.[4] ?? 0)));
  const playY = Math.max(0, Math.min(size - 1, Math.round(values?.[5] ?? 0)));
  const play = (values?.[6] ?? 0) > 0.5;
  const cellWidth = width / size;
  const cellHeight = height / size;
  const actionAt = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.max(
      0,
      Math.min(size - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * size)),
    );
    const row = Math.max(
      0,
      Math.min(size - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * size)),
    );
    return actionBase + row * 64 + column;
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const action = actionAt(event);
    if (action === lastAction.current) return;
    lastAction.current = action;
    onAction(action, true);
  };
  const release = (event: PointerEvent<SVGSVGElement>) => {
    onAction(lastAction.current, false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const hotkey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    const clock = CLOCK_KEYS.indexOf(key);
    const scale = SCALE_KEYS.indexOf(key);
    if (clock < 0 && scale < 0) return;
    event.preventDefault();
    onAction(hotkeyBase + (clock >= 0 ? clock : 4 + scale), true);
  };
  return (
    <svg
      className="pw-rack-mouse-seq-grid"
      aria-label={t("display.mouseSeqGrid")}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      tabIndex={0}
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
        event.currentTarget.focus();
        lastAction.current = actionAt(event);
        onAction(lastAction.current, true);
      }}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={hotkey}
    >
      {Array.from({ length: size }, (_, row) => (
        <rect
          key={row}
          x="0"
          y={row * cellHeight}
          width={width}
          height={cellHeight}
          fill={row % 2 === 0 ? "#284028" : "#284040"}
        />
      ))}
      {gate ? (
        <rect
          x={cursorX * cellWidth}
          y={cursorY * cellHeight}
          width={cellWidth}
          height={cellHeight}
          fill="#644028"
        />
      ) : null}
      {play ? (
        <rect
          x={playX * cellWidth}
          y={playY * cellHeight}
          width={cellWidth}
          height={cellHeight}
          fill="#0064c8"
        />
      ) : null}
    </svg>
  );
}
