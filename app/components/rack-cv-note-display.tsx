import { useMemo } from "react";
import { useI18n } from "../i18n/provider";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function cvNoteFromVoltage(voltage: number) {
  if (!Number.isFinite(voltage) || voltage < -10 || voltage > 10)
    return { valid: false, note: "--", cents: 0, voltage };
  const integer = Math.trunc(voltage);
  let octave = integer + 4;
  let fraction = voltage - integer;
  if (fraction < 0) {
    octave -= 1;
    fraction += 1;
  }
  const semitones = fraction * 12;
  let semitone = Math.trunc(semitones);
  let cents = Math.round((semitones - semitone) * 100);
  if (cents === 100) {
    semitone = (semitone + 1) % 12;
    cents = 0;
  }
  return {
    valid: true,
    note: `${NOTE_NAMES[semitone] ?? "C"}${octave}`,
    cents,
    voltage,
  };
}

export function RackCvNoteDisplay({
  samples,
  x,
  y,
  width,
  height,
  scaleX = 1,
}: {
  samples?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX?: number;
}) {
  const { locale, t } = useI18n();
  const voltageFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [locale],
  );
  const voltage = samples?.at(-1) ?? 0;
  const reading = cvNoteFromVoltage(voltage);
  return (
    <div
      className="pw-rack-cv-note"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      aria-label={t("display.cvTuner", {
        note: reading.note,
        cents: reading.cents,
        voltage: voltageFormatter.format(voltage),
      })}
    >
      <strong>{reading.note}</strong>
      <span>{reading.valid ? `${reading.cents > 0 ? "+" : ""}${reading.cents}` : ""}</span>
      <small>{Number.isFinite(voltage) ? voltage.toFixed(2) : "--"} V</small>
    </div>
  );
}
