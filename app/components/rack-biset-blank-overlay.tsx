import { useEffect, useMemo } from "react";
import rackMonoUrl from "../../assets/rack/fonts/ShareTechMono-Regular.ttf?url";
import type { ModuleInstance } from "../../lib/patch-types";
import type { RackCableLayout } from "../../lib/rack-cable-layout";
import type { RackPlugSignal } from "../../lib/rack-audio-engine";
import { rackViewportPresentation, type RackViewport } from "../../lib/rack-viewport-transform";
import type { RuntimeVisual, WebPluginModule } from "../../lib/web-plugin-registry";

type BlankVisual = Extract<RuntimeVisual, { kind: "biset-blank-overlay" }>;
type HoveredPort = { moduleId: string; direction: "in" | "out"; portId: number };

let rackMonoPromise: Promise<void> | undefined;

function loadRackMono() {
  if (!rackMonoPromise)
    rackMonoPromise = new FontFace("RackShareTechMono", `url(${rackMonoUrl})`)
      .load()
      .then((font) => {
        document.fonts.add(font);
      });
  return rackMonoPromise;
}

function param(module: ModuleInstance, id: number, fallback: number) {
  const value = module.params[id];
  return Number.isFinite(value) ? value : fallback;
}

function animatedCablePath(
  cable: RackCableLayout,
  samples: readonly number[],
  tension: number,
  points: number,
  maximumDistance: number,
  scale: number,
  slewParam: number,
) {
  const dx = cable.x2 - cable.x1,
    dy = cable.y2 - cable.y1,
    distance = Math.hypot(dx, dy),
    historyLength = Math.max(1, Math.min(maximumDistance, distance)) / maximumDistance,
    controlX = (cable.x1 + cable.x2) * 0.5,
    controlY = (cable.y1 + cable.y2) * 0.5 + (1 - tension) * (150 + Math.max(0, distance)),
    orientation = cable.x1 > cable.x2 ? 1 : -1,
    slew = Math.max(0, Math.min(0.8, slewParam * slewParam * 0.8));
  let previousVoltage = 0,
    path = `M${cable.x1.toFixed(3)} ${cable.y1.toFixed(3)}`;
  for (let index = 0; index < points; index++) {
    const t = (index + 1) / points,
      inverse = 1 - t,
      tangentX = 2 * inverse * (controlX - cable.x1) + 2 * t * (cable.x2 - controlX),
      tangentY = 2 * inverse * (controlY - cable.y1) + 2 * t * (cable.y2 - controlY),
      tangentLength = Math.max(1e-6, Math.hypot(tangentX, tangentY)),
      sampleIndex = Math.min(
        Math.max(0, samples.length - 1),
        Math.floor(t * Math.max(0, samples.length - 1) * historyLength),
      ),
      rawVoltage = Number(samples[sampleIndex]) || 0,
      voltage = rawVoltage * (1 - slew) + previousVoltage * slew,
      fade = t < 0.2 ? t * 5 : t > 0.8 ? (1 - t) * 5 : 1,
      amplitude = voltage * fade * scale * orientation,
      x =
        inverse * inverse * cable.x1 +
        2 * inverse * t * controlX +
        t * t * cable.x2 -
        (tangentY / tangentLength) * amplitude,
      y =
        inverse * inverse * cable.y1 +
        2 * inverse * t * controlY +
        t * t * cable.y2 +
        (tangentX / tangentLength) * amplitude;
    path += ` L${x.toFixed(3)} ${y.toFixed(3)}`;
    previousVoltage = voltage;
  }
  return path;
}

function voltageLightColor(voltage: number, visual: BlankVisual) {
  const color = voltage > 0 ? visual.positiveColor : visual.negativeColor,
    intensity = Math.max(0, Math.min(1, Math.abs(voltage) / 10)),
    red = Number.parseInt(color.slice(1, 3), 16),
    green = Number.parseInt(color.slice(3, 5), 16),
    blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgb(${Math.round(red * intensity)} ${Math.round(green * intensity)} ${Math.round(
    blue * intensity,
  )})`;
}

function definitionForModule(
  moduleId: string,
  modules: readonly ModuleInstance[],
  definitions: readonly WebPluginModule[],
) {
  const module = modules.find((candidate) => candidate.id === moduleId);
  return module ? definitions.find((candidate) => candidate.key === module.key) : undefined;
}

function portName(
  moduleId: string,
  direction: "in" | "out",
  portId: number,
  modules: readonly ModuleInstance[],
  definitions: readonly WebPluginModule[],
) {
  const definition = definitionForModule(moduleId, modules, definitions),
    port = (direction === "out" ? definition?.outputs : definition?.inputs)?.find(
      (candidate) => candidate.id === portId,
    );
  return port?.name ?? `Port ${portId + 1}`;
}

export function RackBisetBlankOverlay({
  module,
  visual,
  paths,
  modules,
  definitions,
  viewport,
  viewportSize,
  tension,
  opacity,
  cablesVisible,
  signals,
  cableWaves,
  blankScopes,
  hoveredPort,
  modifiers,
}: {
  module: ModuleInstance;
  visual: BlankVisual;
  paths: RackCableLayout[];
  modules: readonly ModuleInstance[];
  definitions: readonly WebPluginModule[];
  viewport: RackViewport;
  viewportSize: { width: number; height: number };
  tension: number;
  opacity: number;
  cablesVisible: boolean;
  signals: Readonly<Record<string, RackPlugSignal>>;
  cableWaves: Readonly<Record<string, number[]>>;
  blankScopes: Readonly<Record<string, number[]>>;
  hoveredPort: HoveredPort | null;
  modifiers: number;
}) {
  useEffect(() => {
    void loadRackMono();
  }, []);

  const cableEnabled = cablesVisible && param(module, 0, 1) >= 0.5,
    cableLight = param(module, 2, 1) >= 0.5,
    polyThick = param(module, 3, 1) >= 0.5,
    cableScale = param(module, 7, 1),
    cableSlew = param(module, 6, 0),
    viewBox = rackViewportPresentation(viewport, viewportSize).cableViewBox,
    scopeEnabled = param(module, 8, 1) >= 0.5,
    scopeNeedsShift = param(module, 9, 0) >= 0.5,
    scopeVisible = scopeEnabled && (!scopeNeedsShift || (modifiers & 1) !== 0);
  const hoveredCable = useMemo(() => {
      if (!hoveredPort) return undefined;
      return [...paths]
        .reverse()
        .find((cable) =>
          hoveredPort.direction === "out"
            ? cable.fromModule === hoveredPort.moduleId && cable.fromPort === hoveredPort.portId
            : cable.toModule === hoveredPort.moduleId && cable.toPort === hoveredPort.portId,
        );
    }, [hoveredPort, paths]),
    scopeKey =
      hoveredCable?.id ??
      (hoveredPort?.direction === "out"
        ? `port:${hoveredPort.moduleId}:out:${hoveredPort.portId}`
        : ""),
    scopeSamples = scopeKey ? blankScopes[scopeKey] : undefined,
    scopeColor = hoveredCable?.color ?? "#ffffff";

  let scopeLabel = "";
  if (hoveredCable)
    scopeLabel = `${portName(
      hoveredCable.fromModule,
      "out",
      hoveredCable.fromPort,
      modules,
      definitions,
    )} output to ${portName(
      hoveredCable.toModule,
      "in",
      hoveredCable.toPort,
      modules,
      definitions,
    )} input`;
  else if (hoveredPort?.direction === "out")
    scopeLabel = portName(hoveredPort.moduleId, "out", hoveredPort.portId, modules, definitions);

  const scopeScale = Math.max(0.02, Math.min(1, param(module, 12, 0.2))),
    scopeWidth = scopeScale * viewportSize.width,
    scopeHeight = scopeWidth * 0.5,
    scopePosition = Math.max(0, Math.min(4, Math.round(param(module, 11, 0)))),
    scopeX =
      scopePosition === 0 || scopePosition === 2
        ? 10
        : scopePosition === 1 || scopePosition === 3
          ? viewportSize.width - scopeWidth - 10
          : viewportSize.width * 0.5 - scopeWidth * 0.5,
    scopeY =
      scopePosition === 0 || scopePosition === 1
        ? 40
        : scopePosition === 2 || scopePosition === 3
          ? viewportSize.height - scopeHeight - 10
          : viewportSize.height * 0.5 - scopeHeight * 0.5,
    scopeAlpha = Math.max(0, Math.min(1, param(module, 17, 1))),
    backgroundAlpha = Math.max(0, Math.min(1, param(module, 14, 0.6))),
    guideAlpha = Math.max(0, Math.min(1, param(module, 15, 0.3))),
    labelAlpha = Math.max(0, Math.min(1, param(module, 16, 1))),
    scopeThickness = Math.max(1, Math.min(10, param(module, 13, 2))),
    clipId = `biset-blank-scope-${module.id.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`,
    scopePath = scopeSamples?.length
      ? scopeSamples
          .map((voltage, index) => {
            const t = index / visual.scopePoints,
              x = scopeX + t * scopeWidth,
              y = scopeY + scopeHeight * 0.5 - (Number(voltage) || 0) * 0.05 * scopeHeight * 0.8;
            return `${index ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`;
          })
          .join(" ")
      : "";

  if (!(viewportSize.width > 0 && viewportSize.height > 0)) return null;
  return (
    <>
      {cableEnabled && (
        <svg
          className="pw-biset-blank-cables"
          viewBox={viewBox}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {paths.map((cable) => {
            const samples = cableWaves[cable.id] ?? [],
              signal = signals[cable.id],
              thick = polyThick && (signal?.channels ?? 0) > 1,
              voltage = samples[0] ?? signal?.voltage ?? 0,
              lightColor = voltageLightColor(voltage, visual),
              line = animatedCablePath(
                cable,
                samples,
                tension,
                visual.cablePoints,
                visual.maxCableDistance,
                cableScale,
                cableSlew,
              );
            return (
              <g key={cable.id}>
                <path
                  d={line}
                  fill="none"
                  stroke={cable.color}
                  strokeWidth={thick ? visual.polyCableWidth : visual.cableWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={opacity}
                />
                {[
                  { x: cable.x1, y: cable.y1 },
                  { x: cable.x2, y: cable.y2 },
                ].map((point, index) => (
                  <g key={index}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={visual.plugRadius}
                      fill={cableLight ? "none" : cable.color}
                      stroke={cable.color}
                      strokeWidth={visual.plugStrokeWidth}
                    />
                    {cableLight && (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={visual.lightRadius}
                        fill={lightColor}
                        stroke={visual.lightBorderColor}
                        strokeWidth={visual.lightStrokeWidth}
                      />
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      )}
      {scopeVisible && scopeSamples && scopeLabel && (
        <svg
          className="pw-biset-blank-scope"
          viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={scopeX} y={scopeY} width={scopeWidth} height={scopeHeight} />
            </clipPath>
          </defs>
          <g opacity={scopeAlpha}>
            <rect
              x={scopeX}
              y={scopeY}
              width={scopeWidth}
              height={scopeHeight}
              fill="#000000"
              fillOpacity={backgroundAlpha}
            />
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((position) => (
              <line
                key={position}
                x1={scopeX}
                y1={scopeY + scopeHeight * position}
                x2={scopeX + scopeWidth}
                y2={scopeY + scopeHeight * position}
                stroke="#ffffff"
                strokeOpacity={guideAlpha}
                strokeWidth={1}
              />
            ))}
            <path
              d={scopePath}
              clipPath={`url(#${clipId})`}
              fill="none"
              stroke={scopeColor}
              strokeWidth={scopeThickness}
            />
            <text
              x={scopeX + scopeWidth * 0.5}
              y={scopeY + scopeHeight * 0.905}
              fill="#ffffff"
              fillOpacity={labelAlpha}
              fontFamily={visual.fontFamily}
              fontSize={12 * scopeScale * 5}
              textAnchor="middle"
              dominantBaseline="hanging"
            >
              {scopeLabel}
            </text>
          </g>
        </svg>
      )}
    </>
  );
}

export function RackBisetBlankPanel({
  module,
  visual,
  scaleX,
}: {
  module: ModuleInstance;
  visual: BlankVisual;
  scaleX: number;
}) {
  const panel = Math.max(
      0,
      Math.min(visual.panels.length - 1, Math.round(param(module, visual.panelParam, 0))),
    ),
    file = visual.panels[panel];
  if (!file) return null;
  return (
    <img
      className="pw-rack-biset-blank-panel"
      src={`${visual.assetBase}${file}`}
      alt=""
      draggable={false}
      style={{
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
      }}
    />
  );
}
