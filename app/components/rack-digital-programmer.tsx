import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type DigitalProgrammerVisual = Extract<RuntimeVisual, { kind: "digital-programmer" }>;

const NORMAL_BACKGROUND = "#25383b";
const HOVER_BACKGROUND = "#32464a";
const NORMAL_FILL = "#95a3a5";
const HOVER_FILL = "#dfeaec";
const BANK_BACKGROUND = "#1f272a";
const BANK_HIGHLIGHT = "#2d3d3c";

function clamped(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Source-faithful drag bars and bank mini-maps for Voxglitch Digital Programmer. */
export function RackDigitalProgrammer({
  visual,
  state,
  data,
  scaleX,
  onState,
  onAction,
}: {
  visual: DigitalProgrammerVisual;
  state: number[];
  data: Record<string, unknown>;
  scaleX: number;
  onState: (updates: Array<[id: number, value: number]>) => void;
  onAction: (id: number, active: boolean) => void;
}) {
  const [hoveredSlider, setHoveredSlider] = useState<number>();
  const [hoveredBank, setHoveredBank] = useState<number>();
  const selectedBank = Math.max(
    0,
    Math.min(visual.banks - 1, Math.round(state[visual.selectedBankState] ?? 0)),
  );
  const rawLabels = data[visual.dataKey];
  const labels: unknown[] = Array.isArray(rawLabels) ? rawLabels : [];
  const sliderState = (bank: number, column: number) =>
    visual.stateBase + bank * visual.columns + column;
  const sliderValue = (bank: number, column: number) =>
    clamped(state[sliderState(bank, column)] ?? 0);
  const setFromPointer = (column: number, event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const value = clamped(1 - (event.clientY - bounds.top) / Math.max(1, bounds.height));
    onState([[sliderState(selectedBank, column), value]]);
  };
  const changeFromKeyboard = (column: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.key === "ArrowUp" ? 0.01 : -0.01;
    onState([
      [sliderState(selectedBank, column), clamped(sliderValue(selectedBank, column) + delta)],
    ]);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 9,
        pointerEvents: "none",
      }}
    >
      {visual.sliderPositions.map(([x, y], column) => {
        const value = sliderValue(selectedBank, column);
        const hovered = hoveredSlider === column;
        const fill = hovered ? HOVER_FILL : NORMAL_FILL;
        const background = hovered ? HOVER_BACKGROUND : NORMAL_BACKGROUND;
        const label = typeof labels[column] === "string" ? labels[column] : "";
        return (
          <button
            key={`slider-${column}`}
            type="button"
            aria-label={`Slider ${column + 1}`}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={value}
            onPointerEnter={() => setHoveredSlider(column)}
            onPointerLeave={() => setHoveredSlider(undefined)}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              setFromPointer(column, event);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              event.preventDefault();
              event.stopPropagation();
              setFromPointer(column, event);
            }}
            onKeyDown={(event) => changeFromKeyboard(column, event)}
            style={{
              position: "absolute",
              left: x * scaleX,
              top: y,
              width: visual.sliderWidth * scaleX,
              height: visual.sliderHeight,
              padding: 0,
              overflow: "hidden",
              border: 0,
              borderRadius: 0,
              cursor: "ns-resize",
              pointerEvents: "auto",
              background: `linear-gradient(to top, ${fill} 0%, ${fill} ${value * 100}%, ${background} ${value * 100}%, ${background} 100%)`,
            }}
          >
            {label && (
              <span
                style={{
                  position: "absolute",
                  left: 15 * scaleX,
                  bottom: 8,
                  width: 275,
                  color: "#ffffff",
                  fontSize: 14,
                  fontFamily: "sans-serif",
                  fontWeight: 400,
                  lineHeight: 1,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  transform: "rotate(-90deg)",
                  transformOrigin: "left bottom",
                  pointerEvents: "none",
                }}
              >
                {label}
              </span>
            )}
          </button>
        );
      })}
      {visual.bankPositions.map(([x, y], bank) => {
        const selected = selectedBank === bank;
        const hovered = hoveredBank === bank;
        const active = selected || hovered;
        return (
          <button
            key={`bank-${bank}`}
            type="button"
            aria-label={`Bank ${bank + 1}`}
            aria-pressed={selected}
            onPointerEnter={() => setHoveredBank(bank)}
            onPointerLeave={() => setHoveredBank(undefined)}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAction(visual.actionBase + bank, true);
              onAction(visual.actionBase + bank, false);
            }}
            style={{
              position: "absolute",
              left: x * scaleX,
              top: y,
              width: visual.bankWidth * scaleX,
              height: visual.bankHeight,
              padding: 0,
              overflow: "hidden",
              border: 0,
              borderRadius: 0,
              cursor: "pointer",
              pointerEvents: "auto",
              background: active ? BANK_HIGHLIGHT : BANK_BACKGROUND,
            }}
          >
            {Array.from({ length: visual.columns }, (_, column) => (
              <i
                key={column}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: `${(column * 100) / visual.columns}%`,
                  bottom: 0,
                  width: `${100 / visual.columns}%`,
                  height: `${sliderValue(bank, column) * 100}%`,
                  background: active ? HOVER_FILL : NORMAL_FILL,
                }}
              />
            ))}
          </button>
        );
      })}
    </div>
  );
}
