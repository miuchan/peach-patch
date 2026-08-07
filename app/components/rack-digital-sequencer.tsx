import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_SIZE = 7;
const COMMAND_BASE = 32 * 1024;
const VOLTAGE_RANGES = [
  [0, 10],
  [-10, 10],
  [0, 5],
  [-5, 5],
  [0, 3],
  [-3, 3],
  [0, 1],
  [-1, 1],
] as const;

type EditMode = "voltage" | "length" | "shift" | "gate" | null;

export function RackDigitalSequencer({
  values,
  actionBase,
  valueSteps,
  columns,
  sequencers,
  voltageHeight,
  gateTop,
  gateHeight,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  valueSteps: number;
  columns: number;
  sequencers: number;
  voltageHeight: number;
  gateTop: number;
  gateHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const editMode = useRef<EditMode>(null);
  const lastColumn = useRef(-1);
  const lastAction = useRef(actionBase);
  const gatePaintOn = useRef(false);
  const keyboardZone = useRef<"voltage" | "gate">("voltage");
  const hoverColumn = useRef(0);
  const [tooltip, setTooltip] = useState<{ column: number; value: number } | null>(null);
  const commandAction = (command: number, payload = 0) =>
    actionBase + COMMAND_BASE + command * 64 + payload;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const barPitch = width / columns;
    const barWidth = barPitch - 0.8;
    const voltageEnd = Math.round(values?.[1] ?? columns - 1);
    const gateEnd = Math.round(values?.[2] ?? columns - 1);
    const voltagePlayback = Math.round(values?.[3] ?? 0);
    const gatePlayback = Math.round(values?.[4] ?? 0);
    const rangeIndex = Math.max(
      0,
      Math.min(VOLTAGE_RANGES.length - 1, Math.round(values?.[5] ?? 0)),
    );
    const bipolar = [1, 3, 5, 7].includes(rangeIndex);

    for (let column = 0; column < columns; column += 1) {
      const left = column * barPitch;
      const value = Math.max(0, Math.min(1, values?.[HEADER_SIZE + column] ?? 0));
      context.fillStyle = column <= voltageEnd ? "rgb(42,50,52)" : "rgb(31,39,41)";
      context.fillRect(left, 0, barWidth, voltageHeight);
      context.fillStyle =
        column === voltagePlayback
          ? "rgba(255,255,255,0.9804)"
          : column <= voltageEnd
            ? "rgba(255,255,255,0.5882)"
            : "rgba(255,255,255,0.0392)";
      if (bipolar) {
        const half = voltageHeight / 2;
        if (value > 0.5)
          context.fillRect(
            left,
            half - (value - 0.5) * voltageHeight,
            barWidth,
            (value - 0.5) * voltageHeight,
          );
        else context.fillRect(left, half, barWidth, (0.5 - value) * voltageHeight);
      } else if (value > 0) {
        context.fillRect(
          left,
          voltageHeight - value * voltageHeight,
          barWidth,
          value * voltageHeight,
        );
      }
      if (column === voltagePlayback) {
        context.fillStyle = "rgba(255,255,255,0.0784)";
        context.fillRect(left, 0, barWidth, voltageHeight);
      }

      const gate = (values?.[HEADER_SIZE + columns + column] ?? 0) > 0.5;
      context.fillStyle = column <= gateEnd ? "rgb(60,60,64)" : "rgb(45,45,45)";
      context.fillRect(left, gateTop, barWidth, gateHeight);
      if (gate) {
        context.fillStyle =
          column === gatePlayback
            ? "rgba(255,255,255,0.9804)"
            : column <= gateEnd
              ? "rgba(255,255,255,0.5882)"
              : "rgba(255,255,255,0.0588)";
        context.fillRect(left, gateTop, barWidth, gateHeight);
      }
      if (column === gatePlayback) {
        context.fillStyle = "rgba(255,255,255,0.0784)";
        context.fillRect(left, gateTop, barWidth, gateHeight);
      }
    }

    context.fillStyle = "rgba(240,240,255,0.1569)";
    for (let guide = 1; guide < columns / 4; guide += 1) {
      const left = guide * 4 * barPitch;
      context.fillRect(left, 0, 1, voltageHeight);
      context.fillRect(left, gateTop, 1, gateHeight);
    }
    if (bipolar) context.fillRect(1, voltageHeight / 2, width - 2, 1);
    context.fillStyle = "rgba(0,100,116,0.1098)";
    context.fillRect(0, 0, width, voltageHeight);
    context.fillRect(0, gateTop, width, gateHeight);

    if (tooltip) {
      const [rangeLow, rangeHigh] = VOLTAGE_RANGES[rangeIndex];
      const scaledValue = rangeLow + tooltip.value * (rangeHigh - rangeLow);
      const tooltipWidth = 33;
      const barLeft = tooltip.column * barPitch;
      const tooltipX = tooltip.column > 26 ? barLeft - tooltipWidth - 3.8 : barLeft + barWidth + 3;
      const tooltipY = voltageHeight - Math.max(60, tooltip.value * voltageHeight) + 30;
      context.beginPath();
      context.roundRect(tooltipX, tooltipY, tooltipWidth, 20, 2);
      context.fillStyle = "rgba(20,20,20,0.9804)";
      context.fill();
      context.fillStyle = "white";
      context.font = "13px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(scaledValue.toFixed(6).slice(0, 4), tooltipX + 16.5, tooltipY + 10);
    }
  }, [columns, gateHeight, gateTop, height, tooltip, values, voltageHeight, width]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * width;
    const localY = ((event.clientY - bounds.top) / bounds.height) * height;
    return {
      column: Math.max(0, Math.min(columns - 1, Math.floor((localX / width) * columns))),
      localY,
    };
  };
  const editVoltage = (column: number, localY: number) => {
    const y = Math.max(
      0,
      Math.min(valueSteps - 1, Math.round((localY / voltageHeight) * (valueSteps - 1))),
    );
    const action = actionBase + column * valueSteps + y;
    lastAction.current = action;
    onAction(action, true);
    setTooltip({ column, value: 1 - y / (valueSteps - 1) });
  };
  const moveShift = (column: number) => {
    while (lastColumn.current > column) {
      lastAction.current = commandAction(2);
      onAction(lastAction.current, true);
      lastColumn.current -= 1;
    }
    while (lastColumn.current < column) {
      lastAction.current = commandAction(3);
      onAction(lastAction.current, true);
      lastColumn.current += 1;
    }
  };
  const paintGate = (column: number) => {
    if (column === lastColumn.current) return;
    lastColumn.current = column;
    lastAction.current = commandAction(gatePaintOn.current ? 5 : 4, column);
    onAction(lastAction.current, true);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    onAction(lastAction.current, false);
    editMode.current = null;
    lastColumn.current = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.repeat) return;
    if (/^[1-8]$/.test(event.key)) {
      event.preventDefault();
      const selected = Number(event.key) - 1 + (event.shiftKey && sequencers > 8 ? 8 : 0);
      if (selected < sequencers) onAction(commandAction(6, selected), true);
      return;
    }
    if (event.key.toLowerCase() === "f" && !event.ctrlKey) {
      event.preventDefault();
      onAction(commandAction(7), true);
      return;
    }
    const voltage = keyboardZone.current === "voltage";
    const send = (command: number, payload = 0) => onAction(commandAction(command, payload), true);
    if (voltage && event.key === "ArrowLeft") {
      send(8);
      if (event.shiftKey) send(10);
    } else if (voltage && event.key === "ArrowUp") send(17, hoverColumn.current);
    else if (voltage && event.key === "ArrowDown") send(18, hoverColumn.current);
    else if (!voltage && event.key === "ArrowLeft") {
      send(10);
      if (event.shiftKey) send(8);
    } else if (!voltage && event.key === "ArrowRight") {
      send(11);
      if (event.shiftKey) send(9);
    } else if (event.key.toLowerCase() === "r" && !event.ctrlKey) {
      send(voltage ? 12 : 13);
      if (event.shiftKey) send(voltage ? 13 : 12);
    } else if (voltage && event.key.toLowerCase() === "g" && !event.ctrlKey) send(16);
    else if (!voltage && event.key.toLowerCase() === "b" && !event.ctrlKey) send(19);
    else if (voltage && event.key === "Escape") {
      send(14);
      if (event.shiftKey) send(15);
    } else return;
    event.preventDefault();
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-digital-sequencer"
      aria-label={t("display.digitalSequencer")}
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
        const next = point(event);
        if (
          next.localY > voltageHeight &&
          (next.localY < gateTop || next.localY > gateTop + gateHeight)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        lastColumn.current = next.column;
        if (next.localY <= voltageHeight) {
          keyboardZone.current = "voltage";
          if (event.shiftKey) editMode.current = "shift";
          else if (event.ctrlKey) {
            editMode.current = "length";
            lastAction.current = commandAction(0, next.column);
            onAction(lastAction.current, true);
          } else {
            editMode.current = "voltage";
            editVoltage(next.column, next.localY);
          }
        } else {
          keyboardZone.current = "gate";
          editMode.current = "gate";
          gatePaintOn.current = !((values?.[HEADER_SIZE + columns + next.column] ?? 0) > 0.5);
          lastColumn.current = -1;
          paintGate(next.column);
        }
      }}
      onPointerMove={(event) => {
        const next = point(event);
        hoverColumn.current = next.column;
        keyboardZone.current = next.localY >= gateTop ? "gate" : "voltage";
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          if ((values?.[6] ?? 0) > 0.5 && next.localY <= voltageHeight)
            onAction(commandAction(1, next.column), true);
          return;
        }
        if (editMode.current === "shift") moveShift(next.column);
        else if (editMode.current === "length" && next.column !== lastColumn.current) {
          lastColumn.current = next.column;
          lastAction.current = commandAction(0, next.column);
          onAction(lastAction.current, true);
        } else if (editMode.current === "voltage") editVoltage(next.column, next.localY);
        else if (editMode.current === "gate") paintGate(next.column);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={() => setTooltip(null)}
      onKeyDown={onKeyDown}
    />
  );
}
