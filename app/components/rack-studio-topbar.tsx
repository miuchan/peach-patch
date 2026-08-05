import {
  ChevronDown,
  FolderOpen,
  LibraryBig,
  Link2,
  Menu,
  Play,
  Plus,
  Redo2,
  Save,
  Square,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/provider";

const GITHUB_REPOSITORY_URL = "https://github.com/miuchan/peach-patch";

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) setMobileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const runMobileAction = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  return (
    <header className="pw-topbar">
      <div className="pw-brand" aria-label="Peach Patch">
        <i aria-hidden="true" />
        <span>PEACH</span>
        <b>PATCH</b>
      </div>

      <nav className="pw-desktop-actions" aria-label={t("topbar.applicationMenu")}>
        <div className="pw-action-group" aria-label={t("topbar.fileActions")}>
          <button
            type="button"
            disabled={modulesLocked}
            title={t("topbar.newTitle")}
            onClick={onNewPatch}
          >
            <Plus aria-hidden="true" />
            <span>{t("topbar.new")}</span>
          </button>
          <button
            type="button"
            onClick={onOpenPatch}
            disabled={modulesLocked || !registryReady}
            title={t("topbar.openTitle")}
          >
            <FolderOpen aria-hidden="true" />
            <span>{t("topbar.open")}</span>
          </button>
          <button
            type="button"
            onClick={onOpenPatchUrl}
            disabled={modulesLocked || !registryReady}
            title={t("topbar.linkTitle")}
          >
            <Link2 aria-hidden="true" />
            <span>{t("topbar.link")}</span>
          </button>
          <button type="button" onClick={onSavePatch} title={t("topbar.saveTitle")}>
            <Save aria-hidden="true" />
            <span>{t("topbar.save")}</span>
          </button>
        </div>
        <div className="pw-action-group" aria-label={t("topbar.historyActions")}>
          <button
            type="button"
            onClick={onUndo}
            disabled={modulesLocked || !canUndo}
            title={t("topbar.undoTitle")}
          >
            <Undo2 aria-hidden="true" />
            <span>{t("topbar.undo")}</span>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={modulesLocked || !canRedo}
            title={t("topbar.redoTitle")}
          >
            <Redo2 aria-hidden="true" />
            <span>{t("topbar.redo")}</span>
          </button>
        </div>
        <button
          type="button"
          className={`pw-library-action ${libraryOpen ? "active" : ""}`}
          aria-controls="pw-module-library"
          aria-expanded={libraryOpen}
          onClick={onToggleLibrary}
          title={t("topbar.libraryTitle")}
        >
          <LibraryBig aria-hidden="true" />
          <span>{t("topbar.library")}</span>
        </button>
        <button
          type="button"
          className={`pw-audio-action ${audioRunning ? "audio-live" : ""}`}
          onClick={onToggleAudio}
          disabled={busy || !registryReady}
          title={audioRunning ? t("topbar.stopAudioTitle") : t("topbar.startAudioTitle")}
        >
          {audioRunning ? (
            <Square aria-hidden="true" size={13} strokeWidth={2.25} />
          ) : (
            <Play aria-hidden="true" size={13} strokeWidth={2.25} />
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
            <option value="en">EN</option>
            <option value="zh-CN">中文</option>
          </select>
          <ChevronDown className="pw-locale-chevron" aria-hidden="true" />
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

      <nav className="pw-mobile-actions" aria-label={t("topbar.applicationMenu")}>
        <button
          type="button"
          className={libraryOpen ? "active" : ""}
          aria-controls="pw-module-library"
          aria-expanded={libraryOpen}
          onClick={onToggleLibrary}
          title={t("topbar.libraryTitle")}
        >
          <LibraryBig aria-hidden="true" />
          <span>{t("topbar.library")}</span>
        </button>
        <button
          type="button"
          className={`pw-mobile-audio ${audioRunning ? "audio-live" : ""}`}
          onClick={onToggleAudio}
          disabled={busy || !registryReady}
          title={audioRunning ? t("topbar.stopAudioTitle") : t("topbar.startAudioTitle")}
        >
          {audioRunning ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{audioRunning ? t("topbar.stopAudio") : t("topbar.startAudio")}</span>
        </button>
        <div className="pw-mobile-more" ref={mobileMenuRef}>
          <button
            type="button"
            className={mobileMenuOpen ? "active" : ""}
            aria-controls="pw-mobile-menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            title={t("topbar.moreTitle")}
          >
            <Menu aria-hidden="true" />
            <span>{t("topbar.more")}</span>
          </button>
          {mobileMenuOpen ? (
            <section
              id="pw-mobile-menu"
              className="pw-mobile-menu"
              aria-label={t("topbar.menuTitle")}
            >
              <header>
                <b>{t("topbar.menuTitle")}</b>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={t("common.close")}
                >
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="pw-mobile-menu-grid" aria-label={t("topbar.fileActions")}>
                <button
                  type="button"
                  disabled={modulesLocked}
                  onClick={() => runMobileAction(onNewPatch)}
                >
                  <Plus aria-hidden="true" />
                  <span>{t("topbar.new")}</span>
                </button>
                <button
                  type="button"
                  disabled={modulesLocked || !registryReady}
                  onClick={() => runMobileAction(onOpenPatch)}
                >
                  <FolderOpen aria-hidden="true" />
                  <span>{t("topbar.open")}</span>
                </button>
                <button
                  type="button"
                  disabled={modulesLocked || !registryReady}
                  onClick={() => runMobileAction(onOpenPatchUrl)}
                >
                  <Link2 aria-hidden="true" />
                  <span>{t("topbar.openFromLink")}</span>
                </button>
                <button type="button" onClick={() => runMobileAction(onSavePatch)}>
                  <Save aria-hidden="true" />
                  <span>{t("topbar.save")}</span>
                </button>
              </div>
              <div className="pw-mobile-history" aria-label={t("topbar.historyActions")}>
                <button
                  type="button"
                  disabled={modulesLocked || !canUndo}
                  onClick={() => runMobileAction(onUndo)}
                >
                  <Undo2 aria-hidden="true" />
                  <span>{t("topbar.undo")}</span>
                </button>
                <button
                  type="button"
                  disabled={modulesLocked || !canRedo}
                  onClick={() => runMobileAction(onRedo)}
                >
                  <Redo2 aria-hidden="true" />
                  <span>{t("topbar.redo")}</span>
                </button>
              </div>
              <footer>
                <label>
                  <span>{t("locale.label")}</span>
                  <select
                    value={locale}
                    onChange={(event) => setLocale(event.target.value === "zh-CN" ? "zh-CN" : "en")}
                  >
                    <option value="en">{t("locale.english")}</option>
                    <option value="zh-CN">{t("locale.chineseSimplified")}</option>
                  </select>
                </label>
                <a
                  href={GITHUB_REPOSITORY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("topbar.github")}
                  title={t("topbar.github")}
                >
                  <GitHubIcon size={18} />
                  <span>{t("topbar.githubShort")}</span>
                </a>
              </footer>
            </section>
          ) : null}
        </div>
      </nav>

      {fileInput}
      {presetInput}
    </header>
  );
}
