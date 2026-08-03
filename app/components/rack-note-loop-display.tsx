export function RackNoteLoopDisplay({
  value,
  x,
  y,
  width,
  height,
  scaleX = 1,
}: {
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX?: number;
}) {
  const length = Math.max(1, Math.min(32, Math.round(value)));
  return (
    <div
      className="pw-note-loop-display"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      aria-label={`NoteLoop length: ${length}`}
    >
      <span aria-hidden="true">~~</span>
      <b>{String(length).padStart(2, " ")}</b>
    </div>
  );
}
