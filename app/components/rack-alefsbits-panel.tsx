import { useAlefsbitsPanelPreference } from "../hooks/use-alefsbits-panel-preference";

export function RackAlefsbitsPanel({
  modelKey,
  assetBase,
  panelFile,
  width,
  height,
  scaleX,
}: {
  modelKey: string;
  assetBase: string;
  panelFile: string;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { effectiveContrast } = useAlefsbitsPanelPreference(modelKey);
  const inverted = effectiveContrast < 0.4;
  const sourceBackground = inverted ? 1 - effectiveContrast : effectiveContrast;
  const size = { width: width * scaleX, height };

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          ...size,
          zIndex: 2,
          background: `rgb(${sourceBackground * 255} ${sourceBackground * 255} ${sourceBackground * 255})`,
          pointerEvents: "none",
        }}
      />
      <img
        aria-hidden="true"
        alt=""
        draggable={false}
        src={`${assetBase}${panelFile}`}
        style={{
          position: "absolute",
          inset: 0,
          ...size,
          zIndex: 3,
          display: "block",
          pointerEvents: "none",
        }}
      />
      {inverted && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            ...size,
            zIndex: 11,
            background: "#fff",
            mixBlendMode: "difference",
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}
