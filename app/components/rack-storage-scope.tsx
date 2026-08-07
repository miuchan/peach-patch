import { useMemo, useState, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type StorageScopeVisual = Extract<RuntimeVisual, { kind: "storage-scope" }>;

function scaled(value: number) {
  const absolute = Math.abs(value);
  const fixed = (scaledValue: number, digits: number, suffix: string) =>
    `${scaledValue.toFixed(digits).padStart(6, " ")}${suffix}`;
  if (absolute < 0.00000995) return fixed(value * 1_000_000, 5, "µ");
  if (absolute < 0.0000995) return fixed(value * 1_000_000, 4, "µ");
  if (absolute < 0.000995) return fixed(value * 1_000_000, 3, "µ");
  if (absolute < 0.00995) return fixed(value * 1_000, 5, "m");
  if (absolute < 0.0995) return fixed(value * 1_000, 4, "m");
  if (absolute < 0.995) return fixed(value * 1_000, 3, "m");
  if (absolute < 9.95) return fixed(value, 5, "");
  if (absolute < 99.5) return fixed(value, 4, "");
  return fixed(value, 3, "");
}

export function RackStorageScope({
  visual,
  values,
  params,
  cableColor,
  scaleX,
}: {
  visual: StorageScopeVisual;
  values?: number[];
  params: number[];
  cableColor?: string;
  scaleX: number;
}) {
  const [hover, setHover] = useState<{ x: number; y: number }>();
  const dataCaptured = (values?.[0] ?? 0) > 0.5;
  const running = (values?.[1] ?? 0) > 0.5;
  const progress = Math.max(0, Math.min(1, values?.[2] ?? 0));
  const bufferCount = Math.max(0, Math.round(values?.[3] ?? 0));
  const time = values?.[4] ?? 0;
  const bufferBytes = values?.[5] ?? 0;
  const capturedMin = values?.[6] ?? Number.POSITIVE_INFINITY;
  const capturedMax = values?.[7] ?? Number.NEGATIVE_INFINITY;
  const visibleMin = values?.[8] ?? -10;
  const visibleMax = values?.[9] ?? 10;
  const originalMin = Math.max(0, Math.round(values?.[10] ?? 0));
  const originalMax = Math.max(originalMin, Math.round(values?.[11] ?? 0));
  const mipEntry = Math.round(values?.[12] ?? -1);
  const count = Math.max(0, Math.min(visual.bins, Math.round(values?.[13] ?? 0)));
  const color = (params[visual.colorParam] ?? 0) > 0.5 && cableColor ? cableColor : visual.color;
  const rangeY = visibleMax - visibleMin;
  const trace = useMemo(() => {
    if (!dataCaptured || count <= 0) return { line: "", area: "" };
    const projectY = (value: number) =>
      rangeY === 0 || !Number.isFinite(value)
        ? visual.scopeHeight / 2
        : visual.scopeHeight - 2 - ((value - visibleMin) / rangeY) * (visual.scopeHeight - 4);
    const low: string[] = [];
    const high: string[] = [];
    for (let column = 0; column < count; column++) {
      const x = count <= 1 ? 0 : (column / (count - 1)) * visual.width;
      const minimum = values?.[visual.headerValues + column * 2] ?? 0;
      const maximum = values?.[visual.headerValues + column * 2 + 1] ?? minimum;
      low.push(`${x},${projectY(minimum)}`);
      high.push(`${x},${projectY(maximum)}`);
    }
    return {
      line: low.join(" "),
      area: [...low, ...high.reverse()].join(" "),
    };
  }, [
    count,
    dataCaptured,
    rangeY,
    values,
    visibleMin,
    visual.headerValues,
    visual.scopeHeight,
    visual.width,
  ]);

  const pointerPosition = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setHover({
      x: Math.max(
        0,
        Math.min(visual.width, ((event.clientX - bounds.left) / bounds.width) * visual.width),
      ),
      y: Math.max(
        0,
        Math.min(
          visual.scopeHeight,
          ((event.clientY - bounds.top) / bounds.height) * visual.scopeHeight,
        ),
      ),
    });
  };
  const hoverColumn =
    hover && count > 0
      ? Math.min(count - 1, Math.round((hover.x / visual.width) * (count - 1)))
      : 0;
  const hoverSample = hover
    ? Math.max(
        originalMin,
        Math.min(
          originalMax,
          Math.round(originalMin + (hover.x / visual.width) * (originalMax - originalMin)),
        ),
      )
    : 0;
  const hoverVoltage = hover
    ? visibleMin + ((visual.scopeHeight - 2 - hover.y) / (visual.scopeHeight - 4)) * rangeY
    : 0;
  const hoverLow = values?.[visual.headerValues + hoverColumn * 2] ?? 0;
  const hoverHigh = values?.[visual.headerValues + hoverColumn * 2 + 1] ?? hoverLow;
  const tooltip = !dataCaptured
    ? "No Data"
    : hover
      ? `Voltage: ${scaled(hoverVoltage)}V\nTime: ${scaled(bufferCount > 0 ? (hoverSample / bufferCount) * time : 0)}s\nSample: ${hoverSample}\n\n${mipEntry < 0 ? `Sampled Voltage: ${scaled(hoverLow)}V` : `Signal Voltage: ${scaled(hoverLow)}V - ${scaled(hoverHigh)}V`}`
      : undefined;
  const info = visual.info;

  return (
    <div
      className="pw-storage-scope"
      style={{
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
      }}
    >
      <svg
        viewBox={`0 0 ${visual.width} ${visual.scopeHeight}`}
        preserveAspectRatio="none"
        style={{ width: visual.width * scaleX, height: visual.scopeHeight }}
        onPointerEnter={pointerPosition}
        onPointerMove={pointerPosition}
        onPointerLeave={() => setHover(undefined)}
        aria-label="High Resolution Storage Scope"
      >
        {mipEntry < 0 ? (
          <polyline
            points={trace.line}
            fill="none"
            stroke={color}
            strokeWidth={visual.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <polygon points={trace.area} fill={color} />
        )}
      </svg>
      <div
        className="pw-storage-scope-info"
        style={{
          left: info.x * scaleX,
          top: info.y,
          width: info.width * scaleX,
          height: info.height,
        }}
      >
        <span>
          {running ? `Storing ${Math.floor(progress * 100)}%` : dataCaptured ? "Stored" : "No Data"}
        </span>
        {mipEntry >= 0 && <span className="right">Mipped {4 << (2 * mipEntry)}x</span>}
        <span>{time.toFixed(3)}s</span>
        <span className="right">{(bufferBytes / 1_000_000).toFixed(3)}Mb</span>
        {Number.isFinite(capturedMin) && <span>min {capturedMin.toFixed(3)}V</span>}
        {Number.isFinite(capturedMax) && (
          <span className="right">max {capturedMax.toFixed(3)}V</span>
        )}
      </div>
      {tooltip && hover && (
        <div
          className="pw-storage-scope-tooltip"
          style={{ left: (hover.x + 10) * scaleX, top: hover.y + 15 }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
