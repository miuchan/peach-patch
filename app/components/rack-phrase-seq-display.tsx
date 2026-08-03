import { useI18n } from "../i18n/provider";

export function RackPhraseSeqDisplay({
  values,
  digits = 3,
  label,
  x,
  y,
  width,
  height,
  scaleX = 1,
}: {
  values?: number[];
  digits?: number;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX?: number;
}) {
  const { t } = useI18n();
  const fallback = "1".padStart(digits, " "),
    text =
      values
        ?.slice(0, digits)
        .map((value) => String.fromCharCode(Math.max(0, Math.min(255, Math.round(value)))))
        .join("") || fallback;
  return (
    <div
      className="pw-phrase-seq-display"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      aria-label={t("display.labeledValue", {
        label: label ?? t("display.phraseSequence"),
        value: text.trim() || text,
      })}
    >
      <span aria-hidden="true">{"~".repeat(digits)}</span>
      <b>{text.padEnd(digits, " ").slice(0, digits)}</b>
    </div>
  );
}
