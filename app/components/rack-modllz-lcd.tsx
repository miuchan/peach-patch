import { useRef, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type Kn8bVisual = Extract<RuntimeVisual, { kind: "modllz-kn8b" }>;
type MidiPolyMpeVisual = Extract<RuntimeVisual, { kind: "modllz-midi-poly-mpe" }>;
type XpandVisual = Extract<RuntimeVisual, { kind: "modllz-xpand" }>;

const KN8B_CHANNEL_STRIDE = 8;
const KN8B_CHANNEL_OFFSET = 6;

function fixed(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

function channelValue(values: number[], channel: number, field: number) {
  return values[KN8B_CHANNEL_OFFSET + channel * KN8B_CHANNEL_STRIDE + field] ?? 0;
}

function stop(event: PointerEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();
}

/** Source-faithful browser rendering for moDllz' Kn8bLCD TransparentWidget. */
export function RackMoDllzKn8bLcd({
  visual,
  values = [],
  scaleX,
  onAction,
}: {
  visual: Kn8bVisual;
  values?: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const channelOffset = Math.max(0, Math.min(8, Math.round(values[0] ?? 0)));
  const vca = (values[1] ?? 0) > 0.5;
  const trim = values[3] ?? 0;
  const inputConnected = values[4] ?? 0;
  const cvConnected = values[5] ?? 0;

  return (
    <div
      aria-label="Kn8b channel displays"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: visual.rows }, (_, row) => {
        const channel = channelOffset + row;
        const mode = Math.round(channelValue(values, channel, 0));
        const input = channelValue(values, channel, 1);
        const calculated = channelValue(values, channel, 2);
        const cv = channelValue(values, channel, 3);
        const output = channelValue(values, channel, 4);
        const operation = channelValue(values, channel, 5) > 0.5 ? 1 : 0;
        const unipolar = channelValue(values, channel, 6) > 0.5;
        const knob = channelValue(values, channel, 7);
        const operator = operation ? "x" : "+";
        const signedOperator = operation ? "x" : calculated < 0 ? "" : "+";
        const levelBlocks = Math.max(0, Math.min(18, Math.round(Math.abs(output) * 3.6)));
        const text = (
          x: number,
          y: number,
          value: string,
          color: string,
          anchor: "start" | "middle" | "end" = "end",
          size = 14,
          opacity = 1,
        ) => (
          <text
            x={x}
            y={y}
            fill={color}
            opacity={opacity}
            textAnchor={anchor}
            fontFamily="Gidolinya, sans-serif"
            fontSize={size}
          >
            {value}
          </text>
        );

        return (
          <div
            key={row}
            style={{
              position: "absolute",
              left: 0,
              top: row * visual.rowHeight,
              width: visual.width * scaleX,
              height: visual.displayHeight,
              overflow: "hidden",
            }}
          >
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${visual.width} ${visual.displayHeight}`}
              preserveAspectRatio="none"
              style={{ display: "block", width: "100%", height: "100%" }}
            >
              {mode < 1 ? (
                text(6, 19, String(channel + 1), "#888888", "middle", 12)
              ) : vca ? (
                <>
                  {text(1, 19, String(channel + 1), "#ff8800", "start", 12)}
                  {text(40, 19, fixed(knob + trim), "#ff4444")}
                  {text(72, 19, fixed(calculated), "#ff8800")}
                  <rect
                    x={1}
                    y={18}
                    width={Math.max(0, Math.min(72, calculated * 72))}
                    height={2}
                    fill="#ff8800"
                  />
                  {Array.from({ length: levelBlocks }, (_, block) => (
                    <rect
                      key={block}
                      x={1 + block * 4}
                      y={23}
                      width={3.5}
                      height={6}
                      fill={`rgb(${14 * block},${255 - 14 * block},0)`}
                    />
                  ))}
                </>
              ) : (
                <>
                  {text(6, 19, String(channel + 1), "#dddddd", "middle", 12)}
                  <g
                    stroke={inputConnected > 0.5 ? "#dddddd" : "#777777"}
                    strokeWidth={1}
                    fill="none"
                  >
                    {operation ? (
                      <>
                        <path d="M3.25 14.25 L8.75 19.75" />
                        <path d="M8.75 14.25 L3.25 19.75" />
                      </>
                    ) : (
                      <>
                        <path d="M6 13.5 L6 20.5" />
                        <path d="M2.5 17 L9.5 17" />
                      </>
                    )}
                  </g>
                  <g fill="#dddddd" stroke="#dddddd" strokeWidth={1}>
                    {unipolar ? (
                      <>
                        <rect x={3.5} y={23} width={5} height={8} stroke="none" />
                        <path d="M1.5 30.5 L10.5 30.5" />
                      </>
                    ) : (
                      <>
                        <rect x={3.5} y={23} width={5} height={4} stroke="none" />
                        <rect x={4} y={27} width={4} height={3.5} fill="none" />
                        <path d="M1.5 27 L10.5 27" />
                      </>
                    )}
                  </g>
                  {mode === 1 && (
                    <>
                      {cvConnected > 0.5 && text(72, 14, `${fixed(cv)}v`, "#dddd00")}
                      {text(72, cvConnected > 0.5 ? 28 : 19, `${fixed(calculated)}v`, "#888888")}
                    </>
                  )}
                  {mode === 2 && (
                    <>
                      {text(72, 14, `${fixed(input)}v`, "#44ddff")}
                      {text(
                        72,
                        28,
                        `${signedOperator}${fixed(calculated)}`,
                        operation ? "#ff4444" : "#ff9966",
                        "end",
                        14,
                        0.5,
                      )}
                    </>
                  )}
                  {mode === 3 && (
                    <>
                      {cvConnected > 0.5 && text(72, 14, `${fixed(cv)}v`, "#dddd00")}
                      {text(72, cvConnected > 0.5 ? 28 : 19, `${fixed(output)}v`, "#eeeeee")}
                    </>
                  )}
                  {mode === 4 && (
                    <>
                      {text(72, 9, `${fixed(input)}v`, "#44ddff", "end", 12)}
                      {text(
                        72,
                        19,
                        `${operator}${fixed(calculated)}`,
                        operation ? "#ff4444" : "#ff9966",
                        "end",
                        12,
                      )}
                      {text(72, 31, `${fixed(output)}v`, "#eeeeee", "end", 14)}
                    </>
                  )}
                </>
              )}
            </svg>
            {!vca &&
              mode >= 1 &&
              Array.from({ length: 3 }, (_, line) => (
                <button
                  key={line}
                  type="button"
                  aria-label={`${["Set output channel count", "Toggle sum/product", "Toggle polarity"][line]} for channel ${channel + 1}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: line * 11,
                    width: 20 * scaleX,
                    height: 11,
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    pointerEvents: "auto",
                  }}
                  onPointerDown={stop}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = visual.actionBase + row * 3 + line;
                    onAction(action, true);
                    onAction(action, false);
                  }}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

const POLY_MODE_NAMES = [
  "R O T A T E",
  "R E U S E",
  "R E S E T",
  "R E P A C K",
  "S O R T",
  "S T A C K - S H A R E",
  "S T A C K - D U A L",
  "U N I S O N",
  "U N I S O N <lower",
  "U N I S O N >upper",
  "M. P. E.",
  "M. P. E. ROLI",
  "M. P. E. Haken Continuum",
  "C H A N N E L",
];
const XPAND_NAMES = ["Xpnd", "Xp A", "Xp Ax", "Xp B", "Xp Bx", "Xp C", "Xp Cx", "Xp D", "Xp Dx"];
const STEAL_NAMES = ["Old", "New", "Low", "Hi", "No"];
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function midiCcName(value: number) {
  const known: Record<number, string> = {
    1: "Mod",
    2: "BrC",
    7: "Vol",
    10: "Pan",
    11: "Expr",
    64: "Sust",
    128: "chAT",
    129: "nteAT",
    131: "Slide",
    132: "Press",
    133: "cc74+",
    134: "chAT+",
  };
  return known[value] ?? `cc${value}`;
}

/** MIDIpolyMPE's source LCDs, field selection, and drag-edit data knob. */
export function RackMoDllzMidiPolyMpeLcd({
  visual,
  values = [],
  scaleX,
  onAction,
}: {
  visual: MidiPolyMpeVisual;
  values?: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const selected = Math.round(values[0] ?? 0);
  const mpe = (values[1] ?? 0) > 0.5;
  const unison = (values[2] ?? 0) > 0.5;
  const foundXpander = (values[3] ?? 0) > 0.5;
  const data = (id: number) => Math.round(values[8 + id] ?? 0);
  const selectedValue = data(selected);
  const select = (id: number) => {
    onAction(visual.actionBase + id, true);
    onAction(visual.actionBase + id, false);
  };
  const setValue = (value: number) => {
    onAction(visual.valueActionBase + value + 256, true);
    onAction(visual.valueActionBase + value + 256, false);
  };
  const field = (
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    disabled = false,
  ) => (
    <button
      type="button"
      aria-label={`Edit ${text}`}
      aria-pressed={selected === id}
      disabled={disabled}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        padding: 0,
        border: 0,
        borderRadius: 3,
        color: selected === id ? "#ff0000" : disabled ? "#777777" : "#dddddd",
        background: selected === id ? "#7f000064" : "transparent",
        font: "13px Gidolinya, ui-monospace, monospace",
        lineHeight: `${height}px`,
        textAlign: "center",
        pointerEvents: disabled ? "none" : "auto",
        cursor: disabled ? "default" : "pointer",
      }}
      onPointerDown={stop}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        select(id);
      }}
    >
      {text}
    </button>
  );
  const note = (value: number) =>
    `${NOTE_NAMES[((value % 12) + 12) % 12]}${Math.floor(value / 12) - 2}`;
  const yField = mpe ? 12 : 11;
  const yValue = Math.round(values[34] ?? data(yField));
  const zValue = Math.round(values[35] ?? data(13));
  const releaseValue = Math.round(values[36] ?? data(14));
  const drag = useRef({ startY: 0, startValue: 0 });

  return (
    <div
      aria-label="MIDIpolyMPE displays"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      <div
        style={{ position: "absolute", left: 7 * scaleX, top: 61, width: 136 * scaleX, height: 40 }}
      >
        {field(1, 0, 0, 136, 13, POLY_MODE_NAMES[Math.max(0, Math.min(13, data(1)))] ?? "")}
        {mpe ? (
          field(10, 0, 13, 136, 13, `voice ch PBend: ${data(10)}`)
        ) : (
          <>
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 13,
                width: 38 * scaleX,
                height: 13,
                color: "#dddddd",
                font: "13px Gidolinya, sans-serif",
                lineHeight: "13px",
                textAlign: "center",
              }}
            >
              Voices:
            </span>
            {field(2, 38, 13, 14, 13, String(data(2) * (foundXpander ? 2 : 1)))}
            {field(
              3,
              52,
              13,
              29,
              13,
              XPAND_NAMES[Math.max(0, Math.min(8, data(3)))] ?? "",
              (values[7] ?? 0) < 0.5,
            )}
            {field(
              unison ? 5 : 4,
              81,
              13,
              53,
              13,
              unison ? `Sprd: ${data(5)}` : `Steal: ${STEAL_NAMES[data(4)] ?? ""}`,
            )}
          </>
        )}
        <span
          style={{
            position: "absolute",
            left: 1 * scaleX,
            top: 26,
            width: 18 * scaleX,
            height: 13,
            color: "#dddddd",
            font: "13px Gidolinya, sans-serif",
            lineHeight: "13px",
            textAlign: "center",
          }}
        >
          nte:
        </span>
        {field(6, 19, 26, 29, 13, note(data(6)))}
        {field(7, 48, 26, 29, 13, note(data(7)))}
        <span
          style={{
            position: "absolute",
            left: 77 * scaleX,
            top: 26,
            width: 16 * scaleX,
            height: 13,
            color: "#dddddd",
            font: "13px Gidolinya, sans-serif",
            lineHeight: "13px",
            textAlign: "center",
          }}
        >
          vel:
        </span>
        {field(8, 93, 26, 20, 13, String(data(8)))}
        {field(9, 113, 26, 20, 13, String(data(9)))}
      </div>
      {field(
        yField,
        17,
        202,
        34,
        13,
        yField === 11 && yValue === 130 ? `rn±${data(11)}¢` : midiCcName(yValue),
        (values[37] ?? 1) < 0.5,
      )}
      {field(13, 60, 202, 34, 13, midiCcName(zValue), (values[38] ?? 1) < 0.5)}
      {field(
        14,
        103,
        202,
        34,
        13,
        data(1) === 11 ? (releaseValue ? "chGlide" : "Lift") : releaseValue ? "chPB" : "RelVel",
        (values[39] ?? 1) < 0.5,
      )}
      {field(15, 11.5, 253.5, 30, 13, `${data(15) > 0 ? "+" : ""}${data(15)}`)}
      {field(16, 47.5, 253.5, 23, 13, `${data(16) > 0 ? "+" : ""}${data(16)}`)}
      {field(17, 70.5, 253.5, 23, 13, `${data(17) > 0 ? "+" : ""}${data(17)}`)}
      {Array.from({ length: 8 }, (_, index) =>
        field(
          18 + index,
          10.5 + (index % 4) * 33,
          283 + Math.floor(index / 4) * 40,
          30,
          13,
          midiCcName(data(18 + index)),
        ),
      )}
      <button
        type="button"
        aria-label="Data entry knob"
        style={{
          position: "absolute",
          left: 57 * scaleX,
          top: 110.5,
          width: 36 * scaleX,
          height: 36,
          borderRadius: "50%",
          border: selected > 0 ? "2px solid #ff0000aa" : "2px solid transparent",
          background: "transparent",
          padding: 0,
          pointerEvents: "auto",
          cursor: selected > 0 ? "ns-resize" : "pointer",
        }}
        onPointerDown={(event) => {
          stop(event);
          drag.current.startY = event.clientY;
          drag.current.startValue = selectedValue;
          event.currentTarget.setPointerCapture(event.pointerId);
          if (selected < 1) select(Math.max(1, Math.round(values[0] ?? 1)));
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId) || selected < 1) return;
          setValue(drag.current.startValue + Math.round((drag.current.startY - event.clientY) / 3));
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (selected > 0) setValue(selectedValue);
        }}
      />
    </div>
  );
}

/** Source-faithful four-way group selector for moDllz' XpanderLCD. */
export function RackMoDllzXpandLcd({
  visual,
  state,
  values = [],
  scaleX,
  onState,
}: {
  visual: XpandVisual;
  state: number[];
  values?: number[];
  scaleX: number;
  onState: (updates: Array<[id: number, value: number]>) => void;
}) {
  const selected = Math.max(
    0,
    Math.min(visual.choices.length - 1, Math.round(state[visual.state] ?? 0)),
  );
  const active = (values[0] ?? 0) > 0.5;
  const alternate = (values[1] ?? 0) > 0.5;

  return (
    <div
      aria-label="Xpand group selector"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      {visual.choices.map((choice, index) => (
        <button
          key={choice}
          type="button"
          aria-label={`Select Xpand group ${choice}`}
          aria-pressed={selected === index}
          style={{
            position: "absolute",
            left: index * visual.choiceWidth * scaleX,
            top: 0,
            width: visual.choiceWidth * scaleX,
            height: visual.activeHeight,
            padding: 0,
            border: 0,
            borderRadius: active && selected === index ? 4 : 0,
            color: selected === index ? (active ? "#00ff00" : "#eeeeee") : "#ffffff66",
            background: active && selected === index ? "#00ff0016" : "transparent",
            font: "14px Gidolinya, sans-serif",
            lineHeight: `${visual.activeHeight}px`,
            textAlign: "center",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
          onPointerDown={stop}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onState([[visual.state, index]]);
          }}
        >
          {choice}
          {selected === index && active && alternate ? "x" : ""}
        </button>
      ))}
    </div>
  );
}
