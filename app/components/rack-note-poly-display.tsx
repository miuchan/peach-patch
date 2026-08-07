import { useI18n } from "../i18n/provider";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function cppRound(value: number) {
  return Math.trunc(value + (value >= 0 ? 0.5 : -0.5));
}

function noteText(voltage: number) {
  const clamped = Math.max(-10, Math.min(10, voltage));
  const notes = cppRound(clamped * 12 + 60);
  const microPitch = clamped * 12 + 60;
  const notesDeviation = microPitch - notes;
  const corrected = cppRound(notes + notesDeviation);
  const deviation = notesDeviation - (corrected - notes);
  const nameIndex = (1200 + corrected) % 12;
  const octave = Math.trunc(corrected / 12) - 1;
  const absoluteDeviation = Math.abs(deviation);
  if (absoluteDeviation >= 0.01)
    return `${NOTE_NAMES[nameIndex]}${octave}${deviation > 0 ? "+" : "-"}${Math.trunc(absoluteDeviation * 100)}`;
  return `${NOTE_NAMES[nameIndex]}${octave}`;
}

export function RackNotePolyDisplay({
  values,
  channels: maximumChannels,
  x,
  y,
  width,
  rowHeight,
  scaleX,
}: {
  values?: number[];
  channels: number;
  x: number;
  y: number;
  width: number;
  rowHeight: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const channels = Math.max(0, Math.min(maximumChannels, Math.trunc(values?.[0] ?? 0)));
  return (
    <svg
      className="pw-rack-note-poly"
      aria-label={t("display.notePoly")}
      viewBox={`0 0 ${width} ${rowHeight * maximumChannels}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height: rowHeight * maximumChannels,
        overflow: "visible",
      }}
    >
      {Array.from({ length: channels }, (_, channel) => (
        <text
          key={channel}
          x="3.5"
          y={2.5 + rowHeight * channel}
          fill="rgb(255,255,255)"
          fontFamily="Oswald, 'Arial Narrow', sans-serif"
          fontSize="13"
          letterSpacing="1.5"
        >
          {noteText(Number.isFinite(values?.[1 + channel]) ? Number(values?.[1 + channel]) : 0)}
        </text>
      ))}
    </svg>
  );
}
