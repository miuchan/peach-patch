import { useMemo, useRef, type PointerEvent } from "react";

const VOICE_COLORS = [
  "#ffc864",
  "#6496ff",
  "#64ff96",
  "#c864ff",
  "#ffff64",
  "#64ffff",
  "#ff64c8",
  "#c8c8c8",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function RackMadzineWaveformDisplay({
  values,
  points,
  maxSlices,
  maxVoices,
  loopEnd,
  x,
  y,
  width,
  height,
  scaleX,
  onLoopEnd,
  onLoopEndReset,
}: {
  values?: number[];
  points: number;
  maxSlices: number;
  maxVoices: number;
  loopEnd: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onLoopEnd: (value: number) => void;
  onLoopEndReset: () => void;
}) {
  const dragging = useRef<{ pointerId: number; lastX: number } | null>(null),
    recorded = Math.max(0, Math.round(values?.[0] ?? 0)),
    flags = Math.max(0, Math.round(values?.[2] ?? 0)),
    isRecording = Boolean(flags & 1),
    isPlaying = Boolean(flags & 2),
    isLooping = Boolean(flags & 4),
    recordPosition = clamp(values?.[4] ?? 0, 0, 1),
    sliceCount = clamp(Math.round(values?.[5] ?? 0), 0, maxSlices),
    voiceCount = clamp(Math.round(values?.[6] ?? 1), 1, maxVoices),
    sliceOffset = 8 + points * 2,
    voiceOffset = sliceOffset + maxSlices,
    halfHeight = height * 0.5,
    quarterHeight = height * 0.25,
    paths = useMemo(() => {
      const left = values?.slice(8, 8 + points) ?? [],
        right = values?.slice(8 + points, 8 + points * 2) ?? [];
      return [left, right].map((samples, channel) =>
        samples
          .map((sample, index) => {
            const px = points > 1 ? (index / (points - 1)) * width : 0,
              py =
                quarterHeight +
                channel * halfHeight -
                (clamp(Number.isFinite(sample) ? sample : 0, -12.5, 12.5) / 10) *
                  quarterHeight *
                  0.8;
            return `${index ? "L" : "M"}${px.toFixed(3)},${py.toFixed(3)}`;
          })
          .join(" "),
      );
    }, [halfHeight, points, quarterHeight, values, width]);
  const localX = (event: { currentTarget: SVGSVGElement; clientX: number }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return rect.width ? clamp(((event.clientX - rect.left) / rect.width) * width, 0, width) : 0;
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button > 0 || Math.abs(localX(event) - loopEnd * width) >= 10) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { pointerId: event.pointerId, lastX: event.clientX };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current?.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect(),
      delta = rect.width ? (event.clientX - dragging.current.lastX) / rect.width : 0;
    dragging.current.lastX = event.clientX;
    onLoopEnd(clamp(loopEnd + delta, 0.01, 1));
  };
  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current?.pointerId !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <svg
      className="pw-rack-madzine-waveform"
      aria-label="Weiii Documenta stereo recording waveform"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(event) => {
        if (Math.abs(localX(event) - loopEnd * width) < 10) {
          event.stopPropagation();
          onLoopEndReset();
        }
      }}
    >
      <rect width={width} height={height} fill="rgba(0,0,0,.706)" />
      <line
        x1="0"
        x2={width}
        y1={halfHeight}
        y2={halfHeight}
        stroke="rgba(80,80,80,.588)"
        strokeWidth="1"
      />
      {recorded > 0 &&
        paths.map((path, channel) => (
          <path key={channel} d={path} fill="none" stroke="#ff6464" strokeWidth="1" />
        ))}
      {recorded > 0 &&
        Array.from({ length: sliceCount }, (_, index) => values?.[sliceOffset + index] ?? -1)
          .filter((value) => value >= 0)
          .map((position, index) => (
            <line
              key={`slice-${index}`}
              x1={position * width}
              x2={position * width}
              y1="0"
              y2={height}
              stroke="rgba(200,200,200,.314)"
              strokeWidth="1"
            />
          ))}
      {recorded > 0 && (
        <line
          x1={loopEnd * width}
          x2={loopEnd * width}
          y1="0"
          y2={height}
          stroke="rgba(100,200,255,.784)"
          strokeWidth="3"
        />
      )}
      {recorded > 0 &&
        (isPlaying || isLooping) &&
        Array.from({ length: voiceCount }, (_, index) => values?.[voiceOffset + index] ?? -1)
          .filter((value) => value >= 0)
          .map((position, index) => (
            <line
              key={`voice-${index}`}
              x1={position * width}
              x2={position * width}
              y1="0"
              y2={height}
              stroke={
                voiceCount === 1
                  ? "rgba(255,100,100,.706)"
                  : VOICE_COLORS[index % VOICE_COLORS.length]
              }
              strokeOpacity={voiceCount === 1 ? 1 : 0.588}
              strokeWidth="1.5"
            />
          ))}
      {isRecording && (
        <line
          x1={recordPosition * width}
          x2={recordPosition * width}
          y1="0"
          y2={height}
          stroke="#ff0000"
          strokeWidth="2"
        />
      )}
      <rect
        x=".5"
        y=".5"
        width={Math.max(0, width - 1)}
        height={Math.max(0, height - 1)}
        fill="none"
        stroke="rgba(255,255,255,.235)"
        strokeWidth="1"
      />
    </svg>
  );
}
