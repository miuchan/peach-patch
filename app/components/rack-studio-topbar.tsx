import { Play, Square } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/provider";

const GITHUB_REPOSITORY_URL = "https://github.com/miuchan/peach-patch";

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

export type RackStudioTopbarProps = {
  modulesLocked: boolean;
  registryReady: boolean;
  libraryOpen: boolean;
  audioRunning: boolean;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onNewPatch: () => void;
  onOpenPatch: () => void;
  onOpenPatchUrl: () => void;
  onSavePatch: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleLibrary: () => void;
  onToggleAudio: () => void;
  fileInput: ReactNode;
  presetInput: ReactNode;
};

export function RackStudioTopbar({
  modulesLocked,
  registryReady,
  libraryOpen,
  audioRunning,
  busy,
  canUndo,
  canRedo,
  onNewPatch,
  onOpenPatch,
  onOpenPatchUrl,
  onSavePatch,
  onUndo,
  onRedo,
  onToggleLibrary,
  onToggleAudio,
  fileInput,
  presetInput,
}: RackStudioTopbarProps) {
  const { locale, setLocale, t } = useI18n();
  return (
    <header className="pw-topbar">
      <div className="pw-brand">
        <i />
        <span>PEACH</span>
        <b>PATCH</b>
      </div>
      <nav className="pw-actions" aria-label={t("topbar.applicationMenu")}>
        <div className="pw-action-group" aria-label={t("topbar.fileActions")}>
          <button
            type="button"
            disabled={modulesLocked}
            title={t("topbar.newTitle")}
            onClick={onNewPatch}
          >
            {t("topbar.new")}
          </button>
          <button
            type="button"
            onClick={onOpenPatch}
            disabled={modulesLocked || !registryReady}
            title={t("topbar.openTitle")}
          >
            {t("topbar.open")}
          </button>
          <button
            type="button"
            onClick={onOpenPatchUrl}
            disabled={modulesLocked || !registryReady}
            title={t("topbar.linkTitle")}
          >
            {t("topbar.link")}
          </button>
          {fileInput}
          {presetInput}
          <button type="button" onClick={onSavePatch} title={t("topbar.saveTitle")}>
            {t("topbar.save")}
          </button>
        </div>
        <div className="pw-action-group" aria-label={t("topbar.historyActions")}>
          <button
            type="button"
            onClick={onUndo}
            disabled={modulesLocked || !canUndo}
            title={t("topbar.undoTitle")}
          >
            {t("topbar.undo")}
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={modulesLocked || !canRedo}
            title={t("topbar.redoTitle")}
          >
            {t("topbar.redo")}
          </button>
        </div>
        <div className="pw-action-group" aria-label={t("topbar.viewActions")}>
          <button
            type="button"
            className={libraryOpen ? "active" : ""}
            aria-pressed={libraryOpen}
            onClick={onToggleLibrary}
            title={t("topbar.libraryTitle")}
          >
            {t("topbar.library")}
          </button>
        </div>
        <button
          type="button"
          className={`pw-audio-action ${audioRunning ? "audio-live" : ""}`}
          onClick={onToggleAudio}
          disabled={busy || !registryReady}
          title={audioRunning ? t("topbar.stopAudioTitle") : t("topbar.startAudioTitle")}
        >
          {audioRunning ? (
            <Square aria-hidden="true" size={11} strokeWidth={2.25} />
          ) : (
            <Play aria-hidden="true" size={11} strokeWidth={2.25} />
          )}
          <span>{audioRunning ? t("topbar.stopAudio") : t("topbar.startAudio")}</span>
        </button>
        <label className="pw-locale-picker" title={t("locale.label")}>
          <span>{t("locale.label")}</span>
          <select
            aria-label={t("locale.label")}
            value={locale}
            onChange={(event) => setLocale(event.target.value === "zh-CN" ? "zh-CN" : "en")}
          >
            <option value="en">{t("locale.english")}</option>
            <option value="zh-CN">{t("locale.chineseSimplified")}</option>
          </select>
        </label>
        <a
          className="pw-github-link"
          href={GITHUB_REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("topbar.github")}
          title={t("topbar.github")}
        >
          <GitHubIcon />
        </a>
      </nav>
    </header>
  );
}
