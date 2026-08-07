import { useEffect, useState, type KeyboardEvent } from "react";

type FieldMode = "volts" | "hz" | "lfo-hz" | "lfo-bpm" | "note" | "cents";

const FIELDS: Array<{
  mode: FieldMode;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}> = [
  { mode: "volts", label: "Volts", x: 10, y: 38, width: 70, height: 22 },
  { mode: "hz", label: "Frequency in hertz", x: 10, y: 78, width: 70, height: 22 },
  { mode: "lfo-hz", label: "LFO frequency in hertz", x: 10, y: 120, width: 70, height: 22 },
  { mode: "lfo-bpm", label: "LFO tempo in beats per minute", x: 10, y: 159, width: 70, height: 22 },
  { mode: "note", label: "Note name", x: 10, y: 201, width: 70, height: 22 },
  { mode: "cents", label: "Note cents", x: 10, y: 228, width: 55, height: 22 },
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ENHARMONIC: Record<string, string> = {
  c: "C",
  "c#": "C#",
  db: "C#",
  d: "D",
  "d#": "D#",
  eb: "D#",
  e: "E",
  fb: "E",
  "e#": "F",
  f: "F",
  "f#": "F#",
  gb: "F#",
  g: "G",
  "g#": "G#",
  ab: "G#",
  a: "A",
  "a#": "A#",
  bb: "A#",
  b: "B",
  cb: "B",
  "b#": "C",
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function general(value: number, precision: number, alternate: boolean) {
  if (!Number.isFinite(value)) return "0";
  let text = value.toPrecision(precision);
  if (!alternate) {
    const [mantissa, exponent] = text.split("e");
    const trimmed = mantissa.includes(".")
      ? mantissa.replace(/0+$/, "").replace(/\.$/, "")
      : mantissa;
    text = exponent === undefined ? trimmed : `${trimmed}e${exponent}`;
  }
  return text;
}

function roundedNote(volts: number) {
  const semitones = Math.round(volts * 12);
  return { index: ((semitones % 12) + 12) % 12, octave: Math.floor(volts) + 4 };
}

function centsFromVolts(volts: number) {
  return (volts - Math.round(volts * 12) / 12) * 1200;
}

function displayValue(mode: FieldMode, volts: number) {
  if (mode === "volts") return general(volts, 4, true);
  if (mode === "hz") {
    const frequency = 261.626 * 2 ** volts;
    return general(frequency, frequency < 100 ? 6 : 7, true);
  }
  if (mode === "lfo-hz") {
    const frequency = 2 * 2 ** volts;
    return general(frequency, frequency < 100 ? 5 : 6, true);
  }
  if (mode === "lfo-bpm") return general(120 * 2 ** volts, 6, false);
  if (mode === "cents") return (Math.round(centsFromVolts(volts) * 100) / 100).toFixed(2);
  const note = roundedNote(volts);
  return `${NOTE_NAMES[note.index]}${note.octave}`;
}

function enteredVolts(mode: FieldMode, text: string, current: number) {
  if (mode === "note") {
    const match = text.trim().match(/^([a-gA-G](?:#|b|♯|♭)?)(-?\d+)?$/u);
    if (!match) return undefined;
    const spelling = match[1].replace("♯", "#").replace("♭", "b").toLowerCase();
    const canonical = ENHARMONIC[spelling];
    const octave = Number(match[2] ?? 4);
    const note = canonical ? NOTE_NAMES.indexOf(canonical) : -1;
    if (note < 0 || !Number.isInteger(octave) || octave < -6 || octave > 14) return undefined;
    return clamp(octave - 4 + note / 12, -10, 10);
  }
  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return undefined;
  if (mode === "volts") return clamp(number, -10, 10);
  if (mode === "hz") return number > 0 ? clamp(Math.log2(number / 261.626), -10, 10) : undefined;
  if (mode === "lfo-hz") return number > 0 ? clamp(Math.log2(number / 2), -10, 10) : undefined;
  if (mode === "lfo-bpm") return number > 0 ? clamp(Math.log2(number / 120), -10, 10) : undefined;
  return clamp(Math.round(current * 12) / 12 + clamp(number, -50, 50) / 1200, -10, 10);
}

function arrowDelta(mode: FieldMode, event: KeyboardEvent<HTMLInputElement>) {
  if (mode === "note") return (event.altKey ? 0.01 : event.shiftKey ? 12 : 1) / 12;
  if (mode === "volts" || mode === "lfo-hz")
    return event.altKey ? 0.001 : event.shiftKey ? 0.1 : 0.01;
  return event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
}

function SpecificValueField({
  mode,
  label,
  value,
  x,
  y,
  width,
  height,
  scaleX,
  onValue,
}: (typeof FIELDS)[number] & {
  value: number;
  scaleX: number;
  onValue: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => displayValue(mode, value));
  useEffect(() => {
    if (!focused) setText(displayValue(mode, value));
  }, [focused, mode, value]);
  const commit = () => {
    const next = enteredVolts(mode, text, value);
    if (next !== undefined) onValue(next);
    setText(displayValue(mode, next ?? value));
  };
  return (
    <input
      className="pw-specific-value-field"
      aria-label={label}
      spellCheck={false}
      value={text}
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(displayValue(mode, value));
      }}
      onChange={(event) => setText(event.target.value)}
      onDoubleClick={(event) => event.currentTarget.select()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.select();
          return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === "ArrowUp" ? 1 : -1;
        let next: number;
        if (mode === "note") next = value + direction * arrowDelta(mode, event);
        else {
          const displayed = Number.parseFloat(text);
          const adjusted =
            (Number.isFinite(displayed) ? displayed : 0) + direction * arrowDelta(mode, event);
          next = enteredVolts(mode, String(adjusted), value) ?? value;
        }
        next = clamp(next, -10, 10);
        if (mode === "note") next = Math.round(next * 1000) / 1000;
        onValue(next);
        setText(displayValue(mode, next));
      }}
    />
  );
}

/** Exact browser counterpart of Alikins SpecificValue's six linked Rack TextFields. */
export function RackSpecificValue({
  value,
  x,
  y,
  width,
  height,
  scaleX,
  onValue,
}: {
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onValue: (value: number) => void;
}) {
  return (
    <div
      className="pw-module-visual pw-specific-value"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height, pointerEvents: "none" }}
    >
      {FIELDS.map((field) => (
        <SpecificValueField
          key={field.mode}
          {...field}
          value={value}
          scaleX={scaleX}
          onValue={onValue}
        />
      ))}
    </div>
  );
}
