import { useState } from "react";
import { useI18n } from "../i18n/provider";

const modeNames = ["PM", "RM", "AM", "SYNC"];
const modeColors = ["#e3bb0a", "#e3151a", "#15d121", "#1a21e3"];

export function RackTheKickSample({
  clearAction,
  modeActionBase,
  modeParam,
  loadX,
  loadY,
  loadWidth,
  loadHeight,
  labelX,
  labelY,
  labelWidth,
  labelHeight,
  modeX,
  modeY,
  modeWidth,
  modeHeight,
  scaleX,
  loaded,
  mode,
  filename,
  onLoad,
  onMomentary,
}: {
  clearAction: number;
  modeActionBase: number;
  modeParam: number;
  loadX: number;
  loadY: number;
  loadWidth: number;
  loadHeight: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  labelHeight: number;
  modeX: number;
  modeY: number;
  modeWidth: number;
  modeHeight: number;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleX: number;
  loaded: boolean;
  mode: number;
  filename?: string;
  onLoad: () => void;
  onMomentary: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedMode = Math.max(0, Math.min(3, Math.round(mode)));
  const action = (id: number) => {
    onMomentary(id, true);
    onMomentary(id, false);
  };
  const label = (filename ?? "Sample").replace(/\.[^.]+$/, "");
  return (
    <div className="pw-the-kick-sample">
      <button
        type="button"
        className={`pw-the-kick-load ${loaded ? "loaded" : ""}`}
        aria-label={loaded ? t("kick.loadedSample", { sample: label }) : t("kick.loadSample")}
        style={{ left: loadX * scaleX, top: loadY, width: loadWidth * scaleX, height: loadHeight }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          setMenuOpen(false);
          onLoad();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (loaded) action(clearAction);
        }}
      >
        {loaded ? label : "LOAD"}
      </button>
      <div
        className={`pw-the-kick-mode-label ${loaded ? "loaded" : ""}`}
        style={{
          left: labelX * scaleX,
          top: labelY,
          width: labelWidth * scaleX,
          height: labelHeight,
          color: modeColors[normalizedMode],
        }}
      >
        {loaded ? (
          <b>{modeNames[normalizedMode]}</b>
        ) : (
          <>
            <span>Load wav</span>
            <span>to activate</span>
            <span>dynamic FM</span>
          </>
        )}
      </div>
      {!loaded && (
        <i
          className="pw-the-kick-knob-blocker"
          style={{ left: (labelX + 15) * scaleX, top: labelY + 13, width: 30 * scaleX, height: 30 }}
        />
      )}
      <button
        type="button"
        className="pw-the-kick-mode-hit"
        aria-label={t("kick.fmMode", { mode: modeNames[normalizedMode] })}
        disabled={!loaded}
        style={{ left: modeX * scaleX, top: modeY, width: modeWidth * scaleX, height: modeHeight }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => action(modeParam)}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          action(modeActionBase);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (loaded) setMenuOpen((current) => !current);
        }}
      />
      {menuOpen && (
        <div
          className="pw-the-kick-mode-menu"
          style={{ left: (modeX - 30) * scaleX, top: modeY + modeHeight + 3 }}
        >
          {modeNames.map((name, index) => (
            <button
              key={name}
              type="button"
              className={index === normalizedMode ? "selected" : ""}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                action(modeActionBase + index);
                setMenuOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
