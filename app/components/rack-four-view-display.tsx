const SHARP_NAMES = ["C", 'C"', "D", 'D"', "E", "F", 'F"', "G", 'G"', "A", 'A"', "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function noteText(voltage: number, sharp: boolean) {
  if (!Number.isFinite(voltage) || voltage <= -99) return " - ";
  const packed = Math.round(voltage * 12),
    note = ((packed % 12) + 12) % 12,
    octave = Math.floor(packed / 12) + 4;
  return `${(sharp ? SHARP_NAMES : FLAT_NAMES)[note] ?? "C"}${octave >= 0 && octave <= 9 ? octave : ""}`.slice(
    0,
    3,
  );
}

function chordText(values: number[], row: number) {
  const offset = 4 + row * 4,
    codes = values
      .slice(offset, offset + 3)
      .map((value) => Math.round(value))
      .filter((value) => value > 0);
  return codes.length ? String.fromCharCode(...codes) : "";
}

export function RackFourViewDisplay({
  values,
  params,
  state,
  modeParam,
  sharpState,
  rows,
  x,
  y,
  width,
  height,
  spacingY,
  scaleX = 1,
}: {
  values?: number[];
  params: number[];
  state?: number[];
  modeParam: number;
  sharpState: number;
  rows: number;
  x: number;
  y: number;
  width: number;
  height: number;
  spacingY: number;
  scaleX?: number;
}) {
  const source = values ?? [],
    chordMode = (params[modeParam] ?? 0) >= 0.5,
    sharp = (state?.[sharpState] ?? 1) >= 0.5;
  return (
    <>
      {Array.from({ length: rows }, (_, row) => {
        const text = chordMode ? chordText(source, row) : noteText(source[row] ?? -100, sharp);
        return (
          <div
            key={row}
            className="pw-four-view-display"
            style={{ left: x * scaleX, top: y + row * spacingY, width: width * scaleX, height }}
            aria-label={`Four View ${row + 1}: ${text || "blank"}`}
          >
            <span>~~~</span>
            <b>{text}</b>
          </div>
        );
      })}
    </>
  );
}
