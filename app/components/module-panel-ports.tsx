import type { CSSProperties, PointerEvent } from "react";
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
  onPortPointerDown: (port: ModulePanelPort, event: PointerEvent<HTMLButtonElement>) => void;
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
  onPortPointerDown,
  onPortHover,
}: ModulePanelPortBankProps) {
  const { t } = useI18n();
  const bankClass = direction === "in" ? "inputs" : "outputs";

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
            onPointerDown={(event) => onPortPointerDown(reference, event)}
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
