import { useRef, type PointerEvent } from "react";

export function RackWavetableEditor({
  values,
  actionBase,
  tables,
  samples,
  bitDepth,
  x,
  y,
  width,
  height,
  gap,
  borderColor = "#000",
  colors,
  scaleX,
  onMomentary,
}: {
  values?: number[];
  actionBase: number;
  tables: number;
  samples: number;
  bitDepth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  gap: number;
  borderColor?: string;
  colors: string[];
  scaleX: number;
  onMomentary: (id: number, active: boolean) => void;
}) {
  const lastPoint = useRef<{ table: number; sample: number; value: number } | null>(null),
    stride = bitDepth + 1,
    totalHeight = tables * height + Math.max(0, tables - 1) * gap,
    valid = Boolean(values && values.length >= tables * samples);

  const sendSample = (table: number, sample: number, value: number) => {
    onMomentary(actionBase + table * samples * stride + sample * stride + value, true);
  };

  const updateAtPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(),
      px = Math.max(0, Math.min(width, (event.clientX - rect.left) * width / Math.max(1, rect.width))),
      py = Math.max(0, Math.min(totalHeight, (event.clientY - rect.top) * totalHeight / Math.max(1, rect.height))),
      rowHeight = height + gap,
      table = Math.min(tables - 1, Math.floor(py / rowHeight)),
      localY = py - table * rowHeight;
    if (localY > height) return;
    const sample = Math.min(samples - 1, Math.floor(px / width * samples)),
      value = Math.max(0, Math.min(bitDepth, Math.floor((1 - localY / height) * bitDepth))),
      previous = lastPoint.current;
    if (previous && previous.table === table && previous.sample !== sample) {
      const start = Math.min(previous.sample, sample),
        end = Math.max(previous.sample, sample);
      for (let index = start; index <= end; index++) {
        const amount = (index - previous.sample) / (sample - previous.sample),
          interpolated = Math.max(0, Math.min(bitDepth, Math.round(previous.value + (value - previous.value) * amount)));
        sendSample(table, index, interpolated);
      }
    } else sendSample(table, sample, value);
    lastPoint.current = { table, sample, value };
  };

  return (
    <svg
      className="pw-rack-wavetable-editor"
      aria-label="Editable five-bank wavetable"
      viewBox={`0 0 ${width} ${totalHeight}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", left: x * scaleX, top: y, width: width * scaleX, height: totalHeight, touchAction: "none" }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        lastPoint.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateAtPointer(event);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        updateAtPointer(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        lastPoint.current = null;
      }}
      onPointerCancel={() => { lastPoint.current = null; }}
    >
      {Array.from({ length: tables }, (_, table) => {
        const top = table * (height + gap),
          points = Array.from({ length: samples }, (_, sample) => {
            const value = valid ? Math.max(0, Math.min(bitDepth, values![table * samples + sample])) : 0;
            return `${sample * width / samples},${height * (bitDepth - value) / bitDepth}`;
          }).join(" ");
        return (
          <g key={table} transform={`translate(0 ${top})`}>
            <rect x="-1" y="-1" width={width + 2} height={height + 2} rx="3" fill="#000" stroke={borderColor} />
            <polyline points={points} fill="none" stroke={colors[table] ?? "#fff"} strokeWidth="1" />
          </g>
        );
      })}
    </svg>
  );
}
