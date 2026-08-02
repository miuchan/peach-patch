import { useEffect, useMemo } from "react";
import rackMonoUrl from "../../assets/rack/fonts/ShareTechMono-Regular.ttf?url";

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

function compactRate(sampleRate: number) {
  if (!(sampleRate > 0)) return "--- kHz";
  return `${Number((sampleRate / 1000).toFixed(3))} kHz`;
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
  useEffect(() => {
    void loadRackMono().catch(() => undefined);
  }, []);

  const text = useMemo(() => {
    const driver = audio?.driver === 5 ? "Core Audio" : running ? "Web Audio" : "(No driver)",
      outputOffset = Math.max(0, Number(audio?.outputOffset) || 0),
      outputCount = running || audio?.deviceName ? Math.min(channels, 2) : 0,
      deviceName = String(audio?.deviceName || (running ? "System output" : "")),
      device = deviceName
        ? `${deviceName}${outputCount ? ` (${outputOffset + 1}-${outputOffset + outputCount} out)` : ""}`
        : "(No device)",
      sampleRate = Number(audio?.sampleRate) || (running ? 48000 : 0),
      blockSize = Number(audio?.blockSize) || (running ? 128 : 0);
    return { driver, device, rate: compactRate(sampleRate), block: blockSize > 0 ? String(blockSize) : "---" };
  }, [audio, channels, running]);

  if (channels === 2)
    return (
      <div
        className="pw-rack-audio-display audio-2"
        style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
        aria-label="Live Rack audio device display"
      >
        <div>{text.device.replace(/^\((.+)\)$/, "$1")}</div>
        <span aria-hidden="true">0</span><span aria-hidden="true">−3</span><span aria-hidden="true">−6</span>
        <span aria-hidden="true">−12</span><span aria-hidden="true">−24</span><span aria-hidden="true">−36</span>
      </div>
    );

  const wide = width >= 200;
  return (
    <div
      className="pw-rack-audio-display"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      aria-label="Live Rack audio device display"
    >
      <div>{wide ? `Driver: ${text.driver}` : text.driver}</div>
      <div>{wide ? `Device: ${text.device}` : text.device}</div>
      <div className="split"><span>{wide ? `Rate: ${text.rate}` : text.rate}</span><span>{wide ? `Block size: ${text.block}` : text.block}</span></div>
    </div>
  );
}
