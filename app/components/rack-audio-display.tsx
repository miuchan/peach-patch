import { useEffect, useMemo } from "react";
import rackMonoUrl from "../../assets/rack/fonts/ShareTechMono-Regular.ttf?url";
import { useI18n } from "../i18n/provider";

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

function compactRate(sampleRate: number, locale: string) {
  if (!(sampleRate > 0)) return "--- kHz";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
    sampleRate / 1000,
  )} kHz`;
}

export function RackAudioDisplay({
  audio,
  running,
  channels,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  audio?: Record<string, unknown>;
  running: boolean;
  channels: 2 | 8 | 16;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { formatNumber, locale, t } = useI18n();
  useEffect(() => {
    void loadRackMono().catch(() => undefined);
  }, []);

  const text = useMemo(() => {
    const driver =
        audio?.driver === 5 ? "Core Audio" : running ? "Web Audio" : t("display.audio.noDriver"),
      outputOffset = Math.max(0, Number(audio?.outputOffset) || 0),
      outputCount = running || audio?.deviceName ? Math.min(channels, 2) : 0,
      deviceName = String(audio?.deviceName || (running ? t("display.audio.systemOutput") : "")),
      device = deviceName
        ? `${deviceName}${
            outputCount
              ? ` (${t("display.audio.outputRange", {
                  start: outputOffset + 1,
                  end: outputOffset + outputCount,
                })})`
              : ""
          }`
        : t("display.audio.noDevice"),
      sampleRate = Number(audio?.sampleRate) || (running ? 48000 : 0),
      blockSize = Number(audio?.blockSize) || (running ? 128 : 0);
    return {
      driver,
      device,
      rate: compactRate(sampleRate, locale),
      block: blockSize > 0 ? formatNumber(blockSize) : "---",
    };
  }, [audio, channels, formatNumber, locale, running, t]);

  if (channels === 2)
    return (
      <div
        className="pw-rack-audio-display audio-2"
        style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
        aria-label={t("display.audioDevice")}
      >
        <div>{text.device.replace(/^[（(](.+)[）)]$/, "$1")}</div>
        <span aria-hidden="true">0</span>
        <span aria-hidden="true">−3</span>
        <span aria-hidden="true">−6</span>
        <span aria-hidden="true">−12</span>
        <span aria-hidden="true">−24</span>
        <span aria-hidden="true">−36</span>
      </div>
    );

  const wide = width >= 200;
  return (
    <div
      className="pw-rack-audio-display"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      aria-label={t("display.audioDevice")}
    >
      <div>{wide ? t("display.audio.driver", { driver: text.driver }) : text.driver}</div>
      <div>{wide ? t("display.audio.device", { device: text.device }) : text.device}</div>
      <div className="split">
        <span>{wide ? t("display.audio.rate", { rate: text.rate }) : text.rate}</span>
        <span>{wide ? t("display.audio.blockSize", { block: text.block }) : text.block}</span>
      </div>
    </div>
  );
}
