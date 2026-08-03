import { memo, useMemo, type MouseEvent, type PointerEvent } from "react";
import type { RackCableLayout } from "../../lib/rack-cable-layout";
import type { RackPlugSignal } from "../../lib/rack-audio-engine";
import { RackCablePlug } from "./rack-cable-plug";

export type RackCableSurface = {
  x: number;
  y: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type RackStudioCableLayerProps = {
  paths: RackCableLayout[];
  surface: RackCableSurface;
  visible: boolean;
  opacity: number;
  selectedIds: ReadonlySet<string>;
  signalLevels: Readonly<Record<string, number>>;
  plugSignals: Readonly<Record<string, RackPlugSignal>>;
  visualUpdatesPaused: boolean;
  onSelect: (id: string, event: CableSelectionEvent) => void;
  onContextMenu: (id: string, event: MouseEvent<SVGPathElement>) => void;
  onPlugPointerDown: (path: RackCableLayout, side: "input" | "output", event: PointerEvent<Element>) => void;
};

export type CableSelectionEvent = {
  stopPropagation: () => void;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
};

function RackStudioCableLayerView({
  paths,
  surface,
  visible,
  opacity,
  selectedIds,
  signalLevels,
  plugSignals,
  onSelect,
  onContextMenu,
  onPlugPointerDown,
}: RackStudioCableLayerProps) {
  const viewBox = `${surface.x} ${surface.y} ${surface.width} ${surface.height}`;
  const hitPaths = useMemo(() => paths.map((path) => <path
    key={path.id}
    className="hit"
    d={path.d}
    role="button"
    aria-label={`Cable ${path.id}`}
    tabIndex={0}
    onPointerDown={(event) => onSelect(path.id, event)}
    onContextMenu={(event) => onContextMenu(path.id, event)}
    onKeyDown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onSelect(path.id, event);
    }}
  />), [onContextMenu, onSelect, paths]);
  const cablePaths = useMemo(() => paths.map((path, index) => <g
    key={path.id}
    className={`pw-cable-layout ${selectedIds.has(path.id) ? "selected" : ""} ${Math.abs(signalLevels[path.id] ?? 0) > .01 ? "powered" : ""}`}
    data-cable-id={path.id}
  >
    <path className="pw-cable-line" d={path.d} stroke={path.color} />
    <RackCablePlug
      x={path.x1}
      y={path.y1}
      angle={path.outputAngle}
      color={path.color}
      signal={plugSignals[path.id]}
      top={path.topOutputPlug}
      gradientId={`plug-out-${index}`}
      cableId={path.id}
      moduleId={path.fromModule}
      direction="out"
      portId={path.fromPort}
      onPointerDown={(event) => onPlugPointerDown(path, "output", event)}
    />
    <RackCablePlug
      x={path.x2}
      y={path.y2}
      angle={path.inputAngle}
      color={path.color}
      signal={plugSignals[path.id]}
      top={path.topInputPlug}
      gradientId={`plug-in-${index}`}
      cableId={path.id}
      moduleId={path.toModule}
      direction="in"
      portId={path.toPort}
      onPointerDown={(event) => onPlugPointerDown(path, "input", event)}
    />
  </g>), [onPlugPointerDown, paths, plugSignals, selectedIds, signalLevels]);
  return <>
    <svg
      className="pw-cable-hits"
      viewBox={viewBox}
      style={{ left: surface.x, top: surface.y, width: surface.width, height: surface.height, display: visible ? undefined : "none" }}
    >
      {hitPaths}
    </svg>
    <svg
      className="pw-cables"
      viewBox={viewBox}
      style={{ left: surface.x, top: surface.y, width: surface.width, height: surface.height, opacity, display: visible ? undefined : "none" }}
    >
      {cablePaths}
    </svg>
  </>;
}

function cableLayerPropsEqual(
  previous: RackStudioCableLayerProps,
  next: RackStudioCableLayerProps,
) {
  return previous.paths === next.paths
    && previous.surface === next.surface
    && previous.visible === next.visible
    && previous.opacity === next.opacity
    && previous.selectedIds === next.selectedIds
    && (next.visualUpdatesPaused || (
      previous.signalLevels === next.signalLevels
      && previous.plugSignals === next.plugSignals
    ))
    && previous.onSelect === next.onSelect
    && previous.onContextMenu === next.onContextMenu
    && previous.onPlugPointerDown === next.onPlugPointerDown;
}

export const RackStudioCableLayer = memo(
  RackStudioCableLayerView,
  cableLayerPropsEqual,
);
