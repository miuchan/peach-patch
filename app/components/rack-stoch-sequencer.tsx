import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_SIZE = 6;
const STEPS = 32;
const SEQUENCE_STRIDE = 34;
const ACTION_SEQUENCE_STRIDE = 131072;
const ACTION_COMMAND_STRIDE = 8192;
const ACTION_STEPS = 256;
const SLIDER_TOP = 4;
const TRACE_COLORS = ["rgb(128,0,219)", "rgb(38,0,255)", "rgb(0,238,255)", "rgb(255,0,0)"];

type DisplayGeometry = { x: number; y: number; width: number; height: number };
type BankGeometry = DisplayGeometry & { count: number };

function sequenceOffset(sequence: number) {
  return HEADER_SIZE + sequence * SEQUENCE_STRIDE;
}

function actionId(actionBase: number, sequence: number, command: number, payload = 0) {
  return actionBase + sequence * ACTION_SEQUENCE_STRIDE + command * ACTION_COMMAND_STRIDE + payload;
}

function StochSequenceCanvas({
  values,
  actionBase,
  sequence,
  sequences,
  geometry,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  sequence: number;
  sequences: number;
  geometry: DisplayGeometry;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const lastCell = useRef(-1);
  const lastAction = useRef(actionBase);
  const offset = sequenceOffset(sequence);
  const length = Math.max(1, Math.min(STEPS, Math.round(values?.[offset] ?? STEPS)));

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(geometry.width * ratio);
    element.height = Math.round(geometry.height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, geometry.width, geometry.height);
    if (sequences === 1) {
      context.fillStyle = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "rgb(10,10,10)"
        : "rgb(40,40,40)";
      context.fillRect(0, 0, geometry.width, geometry.height);
    }
    const sliderWidth = geometry.width / length;
    for (let index = 0; index < length; index += 1) {
      context.strokeStyle = "rgb(60,70,73)";
      context.lineWidth = index % 4 === 0 ? 2 : 0.5;
      context.beginPath();
      context.moveTo(index * sliderWidth, 0);
      context.lineTo(index * sliderWidth, geometry.height);
      context.stroke();

      const probability = Math.max(0, Math.min(1, values?.[offset + 2 + index] ?? 0));
      const sliderHeight = (geometry.height - SLIDER_TOP) * (1 - probability);
      context.fillStyle = "rgba(255,255,255,0.74902)";
      context.fillRect(
        index * sliderWidth,
        sliderHeight,
        sliderWidth,
        geometry.height - sliderHeight,
      );
      context.fillStyle = "rgb(255,255,255)";
      context.fillRect(index * sliderWidth, sliderHeight, sliderWidth, SLIDER_TOP);
      if ((values?.[1] ?? 1) > 0.5) {
        let textY = sliderHeight;
        context.fillStyle = "white";
        if (sliderHeight < SLIDER_TOP + 3) {
          textY = SLIDER_TOP * 2 + sliderHeight + 3;
          context.fillStyle = "black";
        }
        context.font = `${9 + sliderWidth / 15}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "alphabetic";
        context.fillText(
          String(Math.trunc(probability * 100)),
          index * sliderWidth + sliderWidth / 2,
          textY,
        );
      }
    }
    const gateIndex = Math.round(values?.[offset + 1] ?? -1);
    if (gateIndex >= -1) {
      const position = (values?.[2] ?? 0) > 0.5 ? 0 : Math.max(0, Math.min(STEPS, gateIndex));
      const left = Math.max(0, Math.min(geometry.width - sliderWidth, position * sliderWidth));
      context.strokeStyle = sequences === 1 ? "rgb(0,238,255)" : TRACE_COLORS[sequence];
      context.lineWidth = 2;
      context.strokeRect(left, 1, sliderWidth, geometry.height - 1);
    }
    if (sequences > 1 && (values?.[3] ?? 0) === sequence && (values?.[5] ?? 1) > 0.5) {
      context.strokeStyle = TRACE_COLORS[sequence].replace("rgb", "rgba").replace(")", ",0.39216)");
      context.lineWidth = 4;
      context.strokeRect(0, 0, geometry.width, geometry.height);
    }
  }, [geometry.height, geometry.width, length, offset, sequence, sequences, values]);

  const edit = (event: PointerEvent<HTMLCanvasElement>, toggle = false) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * geometry.width;
    const localY = ((event.clientY - bounds.top) / bounds.height) * geometry.height;
    const column = Math.max(
      0,
      Math.min(length - 1, Math.floor(localX / (geometry.width / length))),
    );
    if (toggle) {
      if (column === lastCell.current) return;
      lastCell.current = column;
      lastAction.current = actionId(actionBase, sequence, 1, column);
    } else {
      const vertical = Math.max(
        0,
        Math.min(ACTION_STEPS - 1, Math.round((localY / geometry.height) * (ACTION_STEPS - 1))),
      );
      const encoded = column * ACTION_STEPS + vertical;
      if (encoded === lastCell.current) return;
      lastCell.current = encoded;
      lastAction.current = actionId(actionBase, sequence, 0, encoded);
    }
    onAction(lastAction.current, true);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    onAction(lastAction.current, false);
    lastCell.current = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!event.ctrlKey || (values?.[5] ?? 1) <= 0.5) return;
    const command =
      event.key === "ArrowLeft"
        ? 3
        : event.key === "ArrowRight"
          ? 4
          : event.key === "ArrowUp"
            ? 5
            : event.key === "ArrowDown"
              ? 6
              : sequences > 1 && event.key === "Enter"
                ? 7
                : sequences > 1 && event.key.toLowerCase() === "c"
                  ? 8
                  : sequences > 1 && event.key.toLowerCase() === "v"
                    ? 9
                    : -1;
    if (command < 0) return;
    event.preventDefault();
    onAction(actionId(actionBase, sequence, command), true);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-stoch-sequencer"
      aria-label={t("display.stochSequencer", { sequence: sequence + 1 })}
      tabIndex={0}
      style={{
        position: "absolute",
        left: geometry.x * scaleX,
        top: geometry.y,
        width: geometry.width * scaleX,
        height: geometry.height,
        touchAction: "none",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        edit(event, event.ctrlKey);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId) && !event.ctrlKey) edit(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={onKeyDown}
    />
  );
}

function StochMemoryBanks({
  values,
  actionBase,
  sequences,
  geometry,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  sequences: number;
  geometry: BankGeometry;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const bankStride = STEPS + 2;
  const bankOffset = HEADER_SIZE + sequences * SEQUENCE_STRIDE;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(geometry.width * ratio);
    element.height = Math.round(geometry.height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, geometry.width, geometry.height);
    const bankWidth = geometry.width / geometry.count;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    for (let bank = 0; bank < geometry.count; bank += 1) {
      const offset = bankOffset + bank * bankStride;
      const length = Math.max(1, Math.min(STEPS, Math.round(values?.[offset] ?? STEPS)));
      const enabled = (values?.[offset + 1] ?? 0) > 0.5;
      if (enabled) {
        const sliderWidth = bankWidth / length;
        context.fillStyle = (values?.[4] ?? 0) === bank ? "white" : "rgba(255,255,255,0.86275)";
        for (let index = 0; index < length; index += 1) {
          const probability = Math.max(0, Math.min(1, values?.[offset + 2 + index] ?? 0));
          if (probability <= 0) continue;
          const top = geometry.height * (1 - probability);
          context.fillRect(
            bank * bankWidth + index * sliderWidth,
            top,
            sliderWidth,
            geometry.height - top,
          );
        }
      }
      if (bank < geometry.count - 1) {
        context.strokeStyle = "rgb(60,70,73)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo((bank + 1) * bankWidth, 0);
        context.lineTo((bank + 1) * bankWidth, geometry.height);
        context.stroke();
      }
      if ((values?.[4] ?? 0) !== bank) {
        context.fillStyle = dark ? "rgba(255,255,255,0.47059)" : "rgba(0,0,0,0.47059)";
        context.fillRect(bank * bankWidth, 0, bankWidth, geometry.height);
      }
    }
  }, [bankOffset, bankStride, geometry.count, geometry.height, geometry.width, values]);
  return (
    <canvas
      ref={canvas}
      className="pw-rack-stoch-memory-banks"
      aria-label={t("display.stochMemoryBanks")}
      style={{
        position: "absolute",
        left: geometry.x * scaleX,
        top: geometry.y,
        width: geometry.width * scaleX,
        height: geometry.height,
        touchAction: "none",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const bounds = event.currentTarget.getBoundingClientRect();
        const bank = Math.max(
          0,
          Math.min(
            geometry.count - 1,
            Math.floor(((event.clientX - bounds.left) / bounds.width) * geometry.count),
          ),
        );
        const action = actionId(actionBase, 0, 2, bank);
        onAction(action, true);
        onAction(action, false);
      }}
    />
  );
}

export function RackStochSequencer({
  values,
  actionBase,
  sequences,
  displays,
  banks,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  sequences: number;
  displays: DisplayGeometry[];
  banks?: BankGeometry;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  return (
    <>
      {displays.map((geometry, sequence) => (
        <StochSequenceCanvas
          key={sequence}
          values={values}
          actionBase={actionBase}
          sequence={sequence}
          sequences={sequences}
          geometry={geometry}
          scaleX={scaleX}
          onAction={onAction}
        />
      ))}
      {banks ? (
        <StochMemoryBanks
          values={values}
          actionBase={actionBase}
          sequences={sequences}
          geometry={banks}
          scaleX={scaleX}
          onAction={onAction}
        />
      ) : null}
    </>
  );
}
