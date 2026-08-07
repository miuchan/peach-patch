import { memo, useMemo, type MouseEvent, type PointerEvent } from "react";
import type { RackCableLayout } from "../../lib/rack-cable-layout";
import type { RackPlugSignal } from "../../lib/rack-audio-engine";
import { rackViewportPresentation, type RackViewport } from "../../lib/rack-viewport-transform";
import { RackCablePlug } from "./rack-cable-plug";
import { useI18n } from "../i18n/provider";

export type RackStudioCableLayerProps = {
  paths: RackCableLayout[];
  viewport: RackViewport;
  viewportSize: { width: number; height: number };
  visible: boolean;
  replacementActive?: boolean;
  opacity: number;
  selectedIds: ReadonlySet<string>;
  signalLevels: Readonly<Record<string, number>>;
  plugSignals: Readonly<Record<string, RackPlugSignal>>;
  visualUpdatesPaused: boolean;
  onSelect: (id: string, event: CableSelectionEvent) => void;
  onContextMenu: (id: string, event: MouseEvent<SVGPathElement>) => void;
  onPlugPointerDown: (
    path: RackCableLayout,
    side: "input" | "output",
    event: PointerEvent<Element>,
  ) => void;
};

export type CableSelectionEvent = {
  stopPropagation: () => void;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
};

function RackStudioCableLayerView({
  paths,
  viewport,
  viewportSize,
  visible,
  replacementActive = false,
  opacity,
  selectedIds,
  signalLevels,
  plugSignals,
  onSelect,
  onContextMenu,
  onPlugPointerDown,
}: RackStudioCableLayerProps) {
  const { t } = useI18n();
  const viewBox = rackViewportPresentation(viewport, viewportSize).cableViewBox;
  const hitPaths = useMemo(
    () =>
      paths.map((path) => (
        <path
          key={path.id}
          className="hit"
          d={path.d}
          role="button"
          aria-label={t("cable.aria", { id: path.id })}
          tabIndex={0}
          onPointerDown={(event) => onSelect(path.id, event)}
          onContextMenu={(event) => onContextMenu(path.id, event)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSelect(path.id, event);
          }}
        />
      )),
    [onContextMenu, onSelect, paths, t],
  );
  const cablePaths = useMemo(
    () =>
      paths.map((path, index) => (
        <g
          key={path.id}
          className={`pw-cable-layout ${selectedIds.has(path.id) ? "selected" : ""} ${Math.abs(signalLevels[path.id] ?? 0) > 0.01 ? "powered" : ""}`}
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
        </g>
      )),
    [onPlugPointerDown, paths, plugSignals, selectedIds, signalLevels],
  );
  return (
    <>
      <svg
        className="pw-cable-hits"
        viewBox={viewBox}
        preserveAspectRatio="none"
        style={{
          display: visible ? undefined : "none",
        }}
      >
        {hitPaths}
      </svg>
      <svg
        className="pw-cables"
        viewBox={viewBox}
        preserveAspectRatio="none"
        style={{
          opacity,
          ...(replacementActive ? { opacity: 0 } : {}),
          display: visible ? undefined : "none",
        }}
      >
        {cablePaths}
      </svg>
    </>
  );
}

function cableLayerPropsEqual(
  previous: RackStudioCableLayerProps,
  next: RackStudioCableLayerProps,
) {
  return (
    previous.paths === next.paths &&
    previous.viewport.pan.x === next.viewport.pan.x &&
    previous.viewport.pan.y === next.viewport.pan.y &&
    previous.viewport.zoom === next.viewport.zoom &&
    previous.viewportSize.width === next.viewportSize.width &&
    previous.viewportSize.height === next.viewportSize.height &&
    previous.visible === next.visible &&
    previous.replacementActive === next.replacementActive &&
    previous.opacity === next.opacity &&
    previous.selectedIds === next.selectedIds &&
    (next.visualUpdatesPaused ||
      (previous.signalLevels === next.signalLevels && previous.plugSignals === next.plugSignals)) &&
    previous.onSelect === next.onSelect &&
    previous.onContextMenu === next.onContextMenu &&
    previous.onPlugPointerDown === next.onPlugPointerDown
  );
}

export const RackStudioCableLayer = memo(RackStudioCableLayerView, cableLayerPropsEqual);
