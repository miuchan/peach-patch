import type { CSSProperties, DragEvent, PointerEvent } from "react";
import type { PortSpec } from "../../lib/web-plugin-registry";
import { useI18n } from "../i18n/provider";

export type ModulePanelPort = {
  moduleId: string;
  direction: "in" | "out";
  portId: number;
};

type ModulePanelPortBankProps = {
  moduleId: string;
  moduleModel: string;
  direction: "in" | "out";
  ports: PortSpec[];
  pending: ModulePanelPort | null;
  signalLevels: Readonly<Record<number, number>>;
  sourceLayout: boolean;
  portStyle: (port: PortSpec, direction: "in" | "out") => CSSProperties;
  onPort: (port: ModulePanelPort) => void;
  onPortDragStart: (port: ModulePanelPort) => void;
  onPortDrop: (from: ModulePanelPort, to: ModulePanelPort) => void;
  onPortDragEnd: () => void;
  onPortPointerDown: (port: ModulePanelPort, event: PointerEvent<HTMLButtonElement>) => void;
  onPortPointerUp: (port: ModulePanelPort, event: PointerEvent<HTMLButtonElement>) => void;
  onPortHover: (direction: "in" | "out", id: number | null) => void;
};

function portReference(moduleId: string, direction: "in" | "out", portId: number): ModulePanelPort {
  return { moduleId, direction, portId };
}

export function ModulePanelPortBank({
  moduleId,
  moduleModel,
  direction,
  ports,
  pending,
  signalLevels,
  sourceLayout,
  portStyle,
  onPort,
  onPortDragStart,
  onPortDrop,
  onPortDragEnd,
  onPortPointerDown,
  onPortPointerUp,
  onPortHover,
}: ModulePanelPortBankProps) {
  const { t } = useI18n();
  const bankClass = direction === "in" ? "inputs" : "outputs";
  const startPortDrag = (event: DragEvent<HTMLButtonElement>, port: ModulePanelPort) => {
    event.stopPropagation();
    event.dataTransfer.setData("application/x-patchwork-port", JSON.stringify(port));
    event.dataTransfer.effectAllowed = "link";
    onPortDragStart(port);
  };
  const allowPortDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (!event.dataTransfer.types.includes("application/x-patchwork-port")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "link";
  };
  const dropPort = (event: DragEvent<HTMLButtonElement>, to: ModulePanelPort) => {
    const encoded = event.dataTransfer.getData("application/x-patchwork-port");
    if (!encoded) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      onPortDrop(JSON.parse(encoded) as ModulePanelPort, to);
    } catch {
      onPortDragEnd();
    }
  };

  return (
    <div
      className={`pw-ports ${bankClass} aligned-layout ${ports.length > 5 ? "compact" : ""} ${sourceLayout ? "source-layout" : ""}`}
      style={{ "--port-columns": ports.length > 5 ? 2 : 1 } as CSSProperties}
    >
      {ports.map((port) => {
        const reference = portReference(moduleId, direction, port.id);
        const level = signalLevels[port.id] ?? 0;
        const pendingPort =
          pending?.moduleId === moduleId &&
          pending.direction === direction &&
          pending.portId === port.id;
        return (
          <button
            type="button"
            draggable
            key={port.id}
            style={portStyle(port, direction)}
            data-module-id={moduleId}
            data-port-direction={direction}
            data-port-id={port.id}
            className={`${Object.hasOwn(signalLevels, port.id) ? "connected" : ""} ${Math.abs(level) > 0.01 ? "powered" : ""} ${pendingPort ? "pending" : ""}`}
            data-signal={Math.min(10, Math.abs(level)).toFixed(3)}
            aria-label={t("port.label", {
              module: moduleModel,
              port: port.name,
              direction: direction === "in" ? t("port.input") : t("port.output"),
            })}
            onClick={() => onPort(reference)}
            onDragStart={(event) => startPortDrag(event, reference)}
            onDragOver={allowPortDrop}
            onDrop={(event) => dropPort(event, reference)}
            onDragEnd={onPortDragEnd}
            onPointerDown={(event) => onPortPointerDown(reference, event)}
            onPointerUp={(event) => onPortPointerUp(reference, event)}
            onPointerEnter={() => onPortHover(direction, port.id)}
            onPointerLeave={() => onPortHover(direction, null)}
          >
            <i />
            <span>{port.name}</span>
          </button>
        );
      })}
    </div>
  );
}
