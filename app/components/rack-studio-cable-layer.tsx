import type { MouseEvent, PointerEvent } from "react";
import type { RackCableDraftLayout, RackCableLayout } from "../../lib/rack-cable-layout";
import type { RackPlugSignal } from "../../lib/rack-audio-engine";
import { RackCablePlug } from "./rack-cable-plug";

type RackSurface = {
  x: number;
  y: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type RackStudioCableLayerProps = {
  paths: RackCableLayout[];
  draft?: RackCableDraftLayout;
  surface: RackSurface;
  visible: boolean;
  opacity: number;
  selectedIds: ReadonlySet<string>;
  signalLevels: Readonly<Record<string, number>>;
  plugSignals: Readonly<Record<string, RackPlugSignal>>;
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

export function RackStudioCableLayer({
  paths,
  draft,
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
  return <>
    <svg
      className="pw-cable-hits"
      viewBox={viewBox}
      style={{ left: surface.x, top: surface.y, width: surface.width, height: surface.height, display: visible ? undefined : "none" }}
    >
      {paths.map((path) => <path
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
      />)}
    </svg>
    <svg
      className="pw-cables"
      viewBox={viewBox}
      style={{ left: surface.x, top: surface.y, width: surface.width, height: surface.height, opacity, display: visible ? undefined : "none" }}
    >
      {paths.map((path, index) => <g
        key={path.id}
        className={`${selectedIds.has(path.id) ? "selected" : ""} ${Math.abs(signalLevels[path.id] ?? 0) > .01 ? "powered" : ""}`}
      >
        <path d={path.d} stroke={path.color} />
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
      </g>)}
      {draft && <g className="pw-cable-draft" aria-hidden="true">
        <path d={draft.d} stroke={draft.color} />
        <RackCablePlug
          x={draft.x1}
          y={draft.y1}
          angle={draft.outputAngle}
          color={draft.color}
          top
          gradientId="plug-draft-out"
          cableId={draft.id}
          moduleId={draft.anchorModuleId}
          direction="out"
          portId={draft.anchorPortId}
        />
        <RackCablePlug
          x={draft.x2}
          y={draft.y2}
          angle={draft.inputAngle}
          color={draft.color}
          top
          gradientId="plug-draft-in"
          cableId={draft.id}
          moduleId={draft.anchorModuleId}
          direction="in"
          portId={draft.anchorPortId}
        />
      </g>}
    </svg>
  </>;
}
