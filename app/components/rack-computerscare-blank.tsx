import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { SampleAssetRef } from "../../lib/patch-types";
import { getSample } from "../../lib/sample-store";

type RackComputerscareBlankProps = {
  asset?: SampleAssetRef;
  state: number[];
  stateKeys: {
    fit: number;
    invertY: number;
    zoomX: number;
    zoomY: number;
    xOffset: number;
    yOffset: number;
    rotation: number;
    hidePanel: number;
  };
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onLoad: () => void;
  onState: (updates: Array<[id: number, value: number]>) => void;
};

function stateValue(state: number[], index: number, fallback: number) {
  const value = state[index];
  return Number.isFinite(value) ? value : fallback;
}

export async function imageBlob(asset: SampleAssetRef) {
  const stored = await getSample(asset.storageKey);
  if (!stored) return undefined;
  if (stored.source) return stored.source;
  const width = Math.max(1, asset.sampleRate);
  const height = Math.max(1, Math.floor(asset.frames / width));
  if (stored.samples.length < width * height * 4) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < rgba.length; index += 1)
    rgba[index] = Math.round(Math.max(0, Math.min(1, stored.samples[index] ?? 0)) * 255);
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
  return await new Promise<Blob | undefined>((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? undefined), "image/png"),
  );
}

/** Browser counterpart of ComputerscareBlank's PNGDisplay and keyboard image controls. */
export function RackComputerscareBlank({
  asset,
  state,
  stateKeys,
  x,
  y,
  width,
  height,
  scaleX,
  onLoad,
  onState,
}: RackComputerscareBlankProps) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let disposed = false;
    let url: string | undefined;
    if (!asset) {
      setSource(undefined);
      return;
    }
    void imageBlob(asset).then((blob) => {
      if (!blob || disposed) return;
      url = URL.createObjectURL(blob);
      setSource(url);
    });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset]);

  const fit = Math.round(stateValue(state, stateKeys.fit, 0));
  const zoomX = stateValue(state, stateKeys.zoomX, 1) || 1;
  const zoomY = stateValue(state, stateKeys.zoomY, 1) || 1;
  const xOffset = stateValue(state, stateKeys.xOffset, 0);
  const yOffset = stateValue(state, stateKeys.yOffset, 0);
  const rotation = Math.round(stateValue(state, stateKeys.rotation, 0));
  const invertY = stateValue(state, stateKeys.invertY, 1) > 0.5;
  const set = (index: number, value: number) => onState([[index, value]]);
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const dPosition = 10;
    const dZoom = 0.05;
    if (event.key === "a") set(stateKeys.xOffset, xOffset + dPosition / zoomX);
    else if (event.key === "d") set(stateKeys.xOffset, xOffset - dPosition / zoomX);
    else if (event.key === "w")
      set(stateKeys.yOffset, yOffset + (invertY ? dPosition : -dPosition) / zoomY);
    else if (event.key === "s")
      set(stateKeys.yOffset, yOffset - (invertY ? dPosition : -dPosition) / zoomY);
    else if (event.key === "z")
      onState([
        [stateKeys.zoomX, zoomX * (1 + dZoom)],
        [stateKeys.zoomY, zoomY * (1 + dZoom)],
      ]);
    else if (event.key === "x")
      onState([
        [stateKeys.zoomX, zoomX * (1 - dZoom)],
        [stateKeys.zoomY, zoomY * (1 - dZoom)],
      ]);
    else if (event.key === "q") set(stateKeys.rotation, (rotation + 1) % 4);
    else if (event.key === "e") set(stateKeys.rotation, (rotation + 3) % 4);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const imageStyle = useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      position: "absolute",
      left: 0,
      top: 0,
      transformOrigin: "0 0",
      pointerEvents: "none",
    };
    if (fit === 0) Object.assign(base, { width: "100%", height: "100%" });
    else if (fit === 1) Object.assign(base, { width: "100%", height: "auto" });
    else if (fit === 2) Object.assign(base, { width: "auto", height: "100%" });
    const naturalScale = fit === 3 ? `scale(${zoomX}, ${zoomY}) ` : "";
    base.transform = `${naturalScale}translate(${xOffset}px, ${yOffset}px) rotate(${rotation * 90}deg)`;
    return base;
  }, [fit, rotation, xOffset, yOffset, zoomX, zoomY]);

  return (
    <div
      className="pw-module-visual pw-computerscare-blank"
      aria-label="Computerscare Blank image"
      tabIndex={0}
      onKeyDown={keyDown}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onLoad();
      }}
      style={{
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        overflow: "hidden",
        cursor: source ? "move" : "pointer",
      }}
    >
      {source && <img src={source} alt="" draggable={false} style={imageStyle} />}
    </div>
  );
}
