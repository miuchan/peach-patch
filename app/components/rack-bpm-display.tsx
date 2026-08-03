import type { CSSProperties } from "react";
import { useI18n } from "../i18n/provider";

const COLORS = ["#ff3333", "#ffd456", "#72ea65", "#13ecc4", "#ebebeb"];

export function RackBpmDisplay({
  samples,
  params,
  styleParam,
  x,
  y,
  width,
  height,
  scaleX = 1,
}: {
  samples?: number[];
  params: number[];
  styleParam: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX?: number;
}) {
  const { t } = useI18n();
  const voltage = samples?.at(-1),
    bpm = Math.max(
      0,
      Math.min(999, Math.round(voltage === undefined ? 120 : 120 * Math.pow(2, voltage))),
    ),
    color =
      COLORS[Math.max(0, Math.min(COLORS.length - 1, Math.round(params[styleParam] ?? 0)))] ??
      COLORS[0];
  return (
    <div
      className="pw-rack-bpm-display"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height, color } as CSSProperties}
      aria-label={t("display.bpm", { bpm })}
    >
      {String(bpm).padStart(3, " ")}
    </div>
  );
}
