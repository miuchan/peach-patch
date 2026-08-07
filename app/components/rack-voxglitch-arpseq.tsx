import { useRef, useState, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type ArpVisual = Extract<RuntimeVisual, { kind: "voxglitch-arpseq" }>;
type MenuState = { x: number; y: number; kind: 0 | 1 } | null;
type WindowDrag = { mode: 0 | 1 | 2; column: number; start: number; end: number } | null;

const PAGE_LABELS = ["Gate", "Transpose", "Mod 1", "Mod 2"];
const DISPLAY_X = 237.10121;
const DISPLAY_WIDTH = 363.03758;
const BAR_PADDING = 0.8;
const BAR_WIDTH = (DISPLAY_WIDTH - 15 * BAR_PADDING) / 16;
const BAR_PITCH = BAR_WIDTH + BAR_PADDING;
const WINDOW_CELL_WIDTH = (DISPLAY_WIDTH - 16 * BAR_PADDING) / 16;
const WINDOW_PITCH = WINDOW_CELL_WIDTH + BAR_PADDING;

function number(values: number[], index: number) {
  const result = values[index] ?? 0;
  return Number.isFinite(result) ? result : 0;
}

function text(values: number[], offset: number, length: number) {
  let result = "";
  for (let index = 0; index < length; index++) {
    const code = Math.round(values[offset + index] ?? 0);
    if (!code) break;
    result += String.fromCharCode(code);
  }
  return result;
}

function pageOffset(page: number) {
  return 32 + page * 52;
}

function pointerPosition(
  event: { clientX: number; clientY: number; currentTarget: HTMLElement },
  width: number,
  height: number,
) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(width, ((event.clientX - bounds.left) * width) / Math.max(1, bounds.width)),
    ),
    y: Math.max(
      0,
      Math.min(height, ((event.clientY - bounds.top) * height) / Math.max(1, bounds.height)),
    ),
  };
}

function DigitalToggleControl({
  x,
  width,
  label,
  active,
  onToggle,
}: {
  x: number;
  width: number;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      style={{
        position: "absolute",
        left: x,
        top: 27.5,
        width,
        height: 18,
        padding: "0 8px",
        border: 0,
        borderRadius: 2.5,
        background: "#312a09",
        color: "#eaca3f",
        font: "12px system-ui, sans-serif",
        textAlign: "left",
        cursor: "pointer",
        pointerEvents: "auto",
      }}
    >
      {label}
      <span
        style={{
          position: "absolute",
          right: 8,
          top: 4,
          width: 10,
          height: 10,
          border: "1px solid #9f8611",
          background: active ? "#ffd714" : "#3e3509",
          boxShadow: active ? "0 0 4px #ffd714" : "none",
        }}
      />
    </button>
  );
}

function HorizontalControl({
  x,
  label,
  value,
  onValue,
}: {
  x: number;
  label: string;
  value: number;
  onValue: (value: number) => void;
}) {
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const position = pointerPosition(event, 74, 10);
    onValue(Math.max(0, Math.min(1, (position.x - 2) / 74)));
  };
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 27.5,
        width: 120,
        height: 18,
        borderRadius: 2.5,
        background: "#312a09",
        color: "#eaca3f",
        font: "12px system-ui, sans-serif",
        pointerEvents: "auto",
      }}
    >
      <span style={{ position: "absolute", left: 8, top: 2 }}>{label}</span>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        tabIndex={0}
        style={{
          position: "absolute",
          left: 42,
          top: 4,
          width: 74,
          height: 10,
          background: "#5e4e07",
          touchAction: "none",
          cursor: "ew-resize",
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          update(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <span
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(70, value * 74)),
            top: 0,
            width: 4,
            height: 10,
            background: "#ffd714",
          }}
        />
      </div>
    </div>
  );
}

function RangeControl({
  x,
  low,
  high,
  bipolar,
  onRange,
}: {
  x: number;
  low: number;
  high: number;
  bipolar: boolean;
  onRange: (side: 0 | 1, value: number) => void;
}) {
  const dragSide = useRef<0 | 1>(0);
  const displayLow = bipolar ? low * 10 - 5 : low * 10;
  const displayHigh = bipolar ? high * 10 - 5 : high * 10;
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const position = pointerPosition(event, 100, 10);
    const raw = Math.round((position.x / 100) * 40) / 40;
    onRange(dragSide.current, dragSide.current === 0 ? Math.min(raw, high) : Math.max(raw, low));
  };
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 27.5,
        width: 235,
        height: 18,
        borderRadius: 2.5,
        background: "#312a09",
        color: "#eaca3f",
        font: "12px system-ui, sans-serif",
        pointerEvents: "auto",
      }}
    >
      <span style={{ position: "absolute", left: 8, top: 2 }}>
        Range: {displayLow.toFixed(2)} to {displayHigh.toFixed(2)}V
      </span>
      <div
        role="group"
        aria-label="Voltage range"
        style={{
          position: "absolute",
          right: 8,
          top: 4,
          width: 100,
          height: 10,
          background: "#5e4e07",
          touchAction: "none",
          cursor: "ew-resize",
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const position = pointerPosition(event, 100, 10);
          dragSide.current =
            Math.abs(position.x - low * 100) < Math.abs(position.x - high * 100) ? 0 : 1;
          event.currentTarget.setPointerCapture(event.pointerId);
          update(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <span
          style={{
            position: "absolute",
            left: low * 100 + 4,
            right: 100 - high * 100 + 4,
            top: 4.5,
            height: 1,
            background: "#ffd714",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: low * 100,
            top: 0,
            width: 4,
            height: 10,
            background: "#ffd714",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: high * 100 - 4,
            top: 0,
            width: 4,
            height: 10,
            background: "#ffd714",
          }}
        />
      </div>
    </div>
  );
}

function SequenceBars({
  page,
  kind,
  values,
  playback,
  start,
  end,
  bipolar,
  y,
  height,
  visual,
  onAction,
  onMenu,
}: {
  page: number;
  kind: 0 | 1;
  values: number[];
  playback: number;
  start: number;
  end: number;
  bipolar: boolean;
  y: number;
  height: number;
  visual: ArpVisual;
  onAction: (id: number, active: boolean) => void;
  onMenu: (menu: MenuState) => void;
}) {
  const lastColumn = useRef(0);
  const shifting = useRef(false);
  const action = (operation: number) =>
    onAction(visual.sequenceActionBase + page * 32 + kind * 16 + operation, true);
  const edit = (event: PointerEvent<HTMLDivElement>) => {
    const position = pointerPosition(event, DISPLAY_WIDTH, height);
    const column = Math.max(0, Math.min(15, Math.floor(position.x / BAR_PITCH)));
    if (shifting.current) {
      const delta = column - lastColumn.current;
      for (let move = 0; move < Math.abs(delta); move++) action(delta < 0 ? 0 : 1);
      lastColumn.current = column;
      return;
    }
    const step = Math.round((1 - position.y / height) * 255);
    onAction(visual.barActionBase + page * 8192 + kind * 4096 + column * 256 + step, true);
  };
  return (
    <div
      role="application"
      aria-label={`${PAGE_LABELS[page]} ${kind ? "chance" : "voltage"} sequencer`}
      tabIndex={0}
      style={{
        position: "absolute",
        left: DISPLAY_X,
        top: y,
        width: DISPLAY_WIDTH,
        height,
        touchAction: "none",
        outline: "none",
        pointerEvents: "auto",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const position = pointerPosition(event, DISPLAY_WIDTH, height);
        lastColumn.current = Math.max(0, Math.min(15, Math.floor(position.x / BAR_PITCH)));
        shifting.current = event.shiftKey;
        event.currentTarget.setPointerCapture(event.pointerId);
        action(12);
        if (!shifting.current) edit(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) edit(event);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        action(13);
        shifting.current = false;
      }}
      onPointerCancel={() => {
        action(13);
        shifting.current = false;
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const position = pointerPosition(event, DISPLAY_WIDTH, height);
        const column = Math.max(0, Math.min(15, Math.floor(position.x / BAR_PITCH)));
        const defaultValue = kind ? 1 : page === 0 ? 0.5 : page === 1 ? 0.5 : page > 1 ? 0.5 : 0;
        onAction(
          visual.barActionBase +
            page * 8192 +
            kind * 4096 +
            column * 256 +
            Math.round(defaultValue * 255),
          true,
        );
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onMenu({ x: event.clientX, y: event.clientY, kind });
      }}
      onKeyDown={(event) => {
        if (event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          action(2);
        }
      }}
    >
      <svg
        viewBox={`0 0 ${DISPLAY_WIDTH} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        {values.map((raw, column) => {
          const barHeight = bipolar ? Math.abs(raw - 0.5) * height : raw * height;
          const barY = bipolar
            ? raw > 0.5
              ? height / 2 - barHeight
              : height / 2
            : height - barHeight;
          const current = column === playback;
          return (
            <g key={column}>
              <rect x={column * BAR_PITCH} y="0" width={BAR_WIDTH} height={height} fill="#5e4e07" />
              {barHeight > 0 ? (
                <rect
                  x={column * BAR_PITCH}
                  y={barY}
                  width={BAR_WIDTH}
                  height={barHeight}
                  fill={current ? "#ffd714" : "#a88e0d"}
                />
              ) : null}
              {column < start || column > end ? (
                <rect
                  x={column * BAR_PITCH}
                  y="0"
                  width={BAR_WIDTH}
                  height={height}
                  fill="rgba(0,0,0,.235)"
                />
              ) : null}
            </g>
          );
        })}
        {bipolar ? (
          <rect x="0" y={height / 2} width={DISPLAY_WIDTH} height="1" fill="rgba(0,0,0,.35)" />
        ) : null}
      </svg>
    </div>
  );
}

/** Complete host-side reconstruction of Voxglitch ArpSeq's custom digital editor. */
export function RackVoxglitchArpSeq({
  visual,
  values = [],
  params,
  scaleX,
  onAction,
  onParam,
}: {
  visual: ArpVisual;
  values?: number[];
  params: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
  onParam: (id: number, value: number) => void;
}) {
  const page = Math.max(0, Math.min(3, Math.round(number(values, 0))));
  const offset = pageOffset(page);
  const voltage = Array.from({ length: 16 }, (_, step) => number(values, offset + step));
  const chance = Array.from({ length: 16 }, (_, step) => number(values, offset + 16 + step));
  const start = Math.max(0, Math.min(15, Math.round(number(values, offset + 32))));
  const end = Math.max(start, Math.min(15, Math.round(number(values, offset + 33))));
  const playback = Math.max(0, Math.min(15, Math.round(number(values, offset + 34))));
  const bipolar = number(values, offset + 35) > 0.5;
  const cycles = Array.from({ length: 16 }, (_, step) => number(values, offset + 36 + step));
  const [menu, setMenu] = useState<MenuState>(null);
  const [cycleMenu, setCycleMenu] = useState<{ x: number; y: number } | null>(null);
  const windowDrag = useRef<WindowDrag>(null);
  const windowMemory = useRef<[number, number]>([0, 15]);
  const control = (id: number, step: number) =>
    onAction(visual.controlActionBase + id * 512 + step, true);
  const sendWindow = (nextStart: number, nextEnd: number) =>
    onAction(visual.windowActionBase + page * 256 + nextStart * 16 + nextEnd, true);
  const contextOperations = [
    ["Shift Left", 0],
    ["Shift Right", 1],
    ["Randomize", 2],
    ["Reverse", 3],
    ["Shuffle", 4],
    ["Invert", 5],
    ["Sort", 6],
    ["Mirror", 7],
    ["Reset to Default", 8],
    ["Zero", 9],
    ["Undo", 10],
    ["Redo", 11],
  ] as const;

  return (
    <div
      aria-label="ArpSeq digital editor"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 14,
        pointerEvents: "none",
        transformOrigin: "top left",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: visual.width,
          height: visual.height,
          transform: `scaleX(${scaleX})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 138.89827,
            top: 53.577,
            width: 90.116,
            height: 301.438,
            pointerEvents: "auto",
          }}
        >
          {PAGE_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onAction(visual.tabActionBase + index, true);
              }}
              style={{
                position: "absolute",
                left: 0,
                top: index * 75.6095,
                width: 90.116,
                height: 74.6095,
                border: 0,
                background: index === page ? "#332a04" : "#1e1802",
                color: index === page ? "#ffd714" : "rgba(255,215,20,.51)",
                font: "12px system-ui, sans-serif",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          aria-label="Sequence window"
          style={{
            position: "absolute",
            left: DISPLAY_X,
            top: 61.16473,
            width: DISPLAY_WIDTH,
            height: WINDOW_CELL_WIDTH * 0.6,
            pointerEvents: "auto",
            touchAction: "none",
            cursor: "ew-resize",
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            const column = Math.max(
              0,
              Math.min(
                15,
                Math.floor(
                  pointerPosition(event, DISPLAY_WIDTH, WINDOW_CELL_WIDTH * 0.6).x / WINDOW_PITCH,
                ),
              ),
            );
            const mode: 0 | 1 | 2 =
              start === end
                ? start === 0
                  ? 2
                  : start === 15
                    ? 0
                    : 2
                : column === start
                  ? 0
                  : column === end
                    ? 2
                    : 1;
            windowDrag.current = { mode, column, start, end };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = windowDrag.current;
            if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const column = Math.max(
              0,
              Math.min(
                15,
                Math.floor(
                  pointerPosition(event, DISPLAY_WIDTH, WINDOW_CELL_WIDTH * 0.6).x / WINDOW_PITCH,
                ),
              ),
            );
            if (drag.mode === 0) sendWindow(Math.min(column, drag.end), drag.end);
            else if (drag.mode === 2) sendWindow(drag.start, Math.max(column, drag.start));
            else {
              const width = drag.end - drag.start;
              const nextStart = Math.max(
                0,
                Math.min(15 - width, drag.start + column - drag.column),
              );
              sendWindow(nextStart, nextStart + width);
            }
          }}
          onPointerUp={(event) => {
            windowDrag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (start === 0 && end === 15) sendWindow(...windowMemory.current);
            else {
              windowMemory.current = [start, end];
              sendWindow(0, 15);
            }
          }}
        >
          <svg
            viewBox={`0 0 ${DISPLAY_WIDTH} ${WINDOW_CELL_WIDTH * 0.6}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
          >
            {Array.from({ length: 16 }, (_, step) =>
              step >= start && step <= end ? (
                <rect
                  key={step}
                  x={step * WINDOW_PITCH}
                  y="0"
                  width={WINDOW_CELL_WIDTH}
                  height={WINDOW_CELL_WIDTH * 0.6}
                  fill={step === start || step === end ? "#ffd714" : "#a88e0d"}
                />
              ) : null,
            )}
          </svg>
        </div>

        <SequenceBars
          page={page}
          kind={0}
          values={voltage}
          playback={playback}
          start={start}
          end={end}
          bipolar={bipolar}
          y={80.70864}
          height={211.71036}
          visual={visual}
          onAction={onAction}
          onMenu={setMenu}
        />
        <SequenceBars
          page={page}
          kind={1}
          values={chance}
          playback={playback}
          start={start}
          end={end}
          bipolar={false}
          y={298.829}
          height={21.171}
          visual={visual}
          onAction={onAction}
          onMenu={setMenu}
        />

        <div
          style={{
            position: "absolute",
            left: 237,
            top: 325.5,
            width: 365,
            height: 23,
            background: "#1e1802",
            pointerEvents: "auto",
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setCycleMenu({ x: event.clientX, y: event.clientY });
          }}
        >
          {Array.from({ length: 16 }, (_, step) => {
            const paramId = 6 + page * 16 + step;
            const maximum = Math.max(1, Math.min(16, Math.round(params[paramId] ?? 1)));
            const countdown = Math.max(0, Math.min(16, cycles[step]));
            return (
              <button
                key={step}
                type="button"
                title={`Cycle ${step + 1}: ${maximum}`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const update = (clientY: number) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    onParam(
                      paramId,
                      Math.max(
                        1,
                        Math.min(
                          16,
                          Math.round(
                            1 + ((bounds.bottom - clientY) / Math.max(1, bounds.height)) * 15,
                          ),
                        ),
                      ),
                    );
                  };
                  update(event.clientY);
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  onParam(
                    paramId,
                    Math.max(
                      1,
                      Math.min(
                        16,
                        Math.round(
                          1 + ((bounds.bottom - event.clientY) / Math.max(1, bounds.height)) * 15,
                        ),
                      ),
                    ),
                  );
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                style={{
                  position: "absolute",
                  left: 10.05 + step * 22.8,
                  top: 0.7,
                  width: 21,
                  height: 21,
                  padding: 0,
                  border: "1px solid #725f08",
                  borderRadius: 2,
                  background: "#2f2704",
                  color: "#ffd714",
                  font: "11px ui-monospace, monospace",
                  cursor: "ns-resize",
                }}
              >
                {maximum}
                {countdown > 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      inset: `${21 - (21 * countdown) / 16}px 0 0`,
                      background: "rgba(255,215,20,.2)",
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {page === 0 ? (
          <>
            <DigitalToggleControl
              x={365}
              width={108}
              label="Step After Arp"
              active={number(values, 2) > 0.5}
              onToggle={() => onAction(visual.toggleActionBase + 1, true)}
            />
            <DigitalToggleControl
              x={481}
              width={112}
              label="Sample & Hold"
              active={number(values, 1) > 0.5}
              onToggle={() => onAction(visual.toggleActionBase, true)}
            />
          </>
        ) : null}
        {page === 2 || page === 3 ? (
          <>
            <HorizontalControl
              x={145}
              label="Slew:"
              value={number(values, page === 2 ? 5 : 9)}
              onValue={(next) => control(page === 2 ? 2 : 5, Math.round(next * 255))}
            />
            <RangeControl
              x={275}
              low={number(values, page === 2 ? 3 : 7)}
              high={number(values, page === 2 ? 4 : 8)}
              bipolar={number(values, page === 2 ? 6 : 10) > 0.5}
              onRange={(side, next) => control((page === 2 ? 0 : 3) + side, Math.round(next * 40))}
            />
            <DigitalToggleControl
              x={519}
              width={96}
              label={number(values, page === 2 ? 6 : 10) > 0.5 ? "Bi-Polar" : "Uni-Polar"}
              active={number(values, page === 2 ? 6 : 10) > 0.5}
              onToggle={() => onAction(visual.toggleActionBase + (page === 2 ? 10 : 11), true)}
            />
          </>
        ) : null}

        {[
          { x: 15.416, content: text(values, 12, 8) || "x1" },
          { x: 69.467, content: text(values, 20, 8) || "FWD" },
        ].map((readout) => (
          <div
            key={readout.x}
            style={{
              position: "absolute",
              left: readout.x,
              top: 220.745,
              width: 45,
              height: 30,
              borderRadius: 3,
              background: "#000",
              color: "#ffd714",
              font: "14px DSEG14Classic, ui-monospace, monospace",
              lineHeight: "30px",
              textAlign: "right",
              paddingRight: 5,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          >
            <span style={{ position: "absolute", right: 5, color: "#332a04" }}>~~~</span>
            <span style={{ position: "relative" }}>{readout.content}</span>
          </div>
        ))}
      </div>

      {menu ? (
        <div
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
            zIndex: 1000,
            minWidth: 150,
            padding: 5,
            border: "1px solid #777",
            borderRadius: 4,
            background: "#202020",
            color: "#eee",
            boxShadow: "0 5px 18px #000a",
            pointerEvents: "auto",
            font: "12px system-ui, sans-serif",
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {contextOperations.map(([label, operation], index) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onAction(visual.sequenceActionBase + page * 32 + menu.kind * 16 + operation, true);
                setMenu(null);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "4px 8px",
                border: 0,
                borderTop: index === 3 || index === 8 || index === 10 ? "1px solid #555" : 0,
                background: "transparent",
                color: "inherit",
                textAlign: "left",
              }}
            >
              {label}
              {operation < 2 ? (
                <small style={{ float: "right", color: "#aaa" }}>(shift + drag)</small>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {cycleMenu ? (
        <div
          style={{
            position: "fixed",
            left: cycleMenu.x,
            top: cycleMenu.y,
            zIndex: 1000,
            minWidth: 150,
            padding: 5,
            border: "1px solid #777",
            borderRadius: 4,
            background: "#202020",
            color: "#eee",
            boxShadow: "0 5px 18px #000a",
            pointerEvents: "auto",
            font: "12px system-ui, sans-serif",
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {["Reset Cycles", "Smart Randomize"].map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onAction(visual.toggleActionBase + 20 + index, true);
                setCycleMenu(null);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 8px",
                border: 0,
                background: "transparent",
                color: "inherit",
                textAlign: "left",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
