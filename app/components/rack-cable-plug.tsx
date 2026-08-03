import type { RackPlugSignal } from "../../lib/rack-audio-engine";

const PLUG_SIZE = 33,
  PORT_SIZE = 15.8003,
  LIGHT_RADIUS = 4.5,
  HALO_RADIUS = 19.5,
  COLORS = ["#ed2c24", "#90c73e", "#29b2ef"];

function componentAsset(name: string, color?: string) {
  const query = new URLSearchParams({ name });
  if (color) query.set("color", color);
  return `/api/rack-component?${query}`;
}

function lightStates(signal: RackPlugSignal | undefined) {
  if (!signal) return COLORS.map((color) => ({ color, brightness: 0 }));
  const rgb =
    signal.rgb?.length === 3
      ? signal.rgb
      : signal.channels > 1
        ? [0, 0, Math.max(0, signal.rms / 10)]
        : signal.voltage < 0
          ? [Math.max(0, -signal.voltage / 10), 0, 0]
          : [0, Math.max(0, signal.voltage / 10), 0];
  return COLORS.map((color, index) => ({
    color,
    brightness: Math.max(0, Math.min(1, rgb[index] ?? 0)),
  }));
}

export function RackCablePlug({
  x,
  y,
  angle,
  color,
  signal,
  top,
  gradientId,
  cableId,
  moduleId,
  direction,
  portId,
  onPointerDown,
}: {
  x: number;
  y: number;
  angle: number;
  color: string;
  signal?: RackPlugSignal;
  top: boolean;
  gradientId: string;
  cableId: string;
  moduleId: string;
  direction: "in" | "out";
  portId: number;
  onPointerDown?: (event: React.PointerEvent<Element>) => void;
}) {
  const lights = lightStates(signal),
    rotation = (angle * 180) / Math.PI - 90,
    active = top ? lights.filter((light) => light.brightness > 0.0001) : [],
    interactive = top && Boolean(onPointerDown);
  return (
    <g
      className={`pw-cable-plug ${top ? "top" : ""}`}
      transform={`translate(${x} ${y})`}
      data-cable-id={cableId}
      data-module-id={moduleId}
      data-port-direction={direction}
      data-port-id={portId}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Drag ${direction} plug` : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
    >
      {interactive && <title>Drag to reconnect · Cmd/Ctrl-drag to stack a new cable</title>}
      <g transform={`rotate(${rotation})`}>
        <image
          href={componentAsset("Plug", color)}
          x={-PLUG_SIZE / 2}
          y={-PLUG_SIZE / 2}
          width={PLUG_SIZE}
          height={PLUG_SIZE}
        />
      </g>
      <image
        href={componentAsset("PlugPort")}
        x={-PORT_SIZE / 2}
        y={-PORT_SIZE / 2}
        width={PORT_SIZE}
        height={PORT_SIZE}
      />
      {active.map((light, index) => (
        <g key={light.color}>
          <defs>
            <radialGradient id={`${gradientId}-${index}`} cx="50%" cy="50%" r="50%">
              <stop
                offset="23.0769%"
                stopColor={light.color}
                stopOpacity={light.brightness * 0.25}
              />
              <stop offset="100%" stopColor={light.color} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className="pw-plug-halo" r={HALO_RADIUS} fill={`url(#${gradientId}-${index})`} />
          <circle
            className="pw-plug-light"
            r={LIGHT_RADIUS}
            fill={light.color}
            fillOpacity={light.brightness}
          />
        </g>
      ))}
    </g>
  );
}
