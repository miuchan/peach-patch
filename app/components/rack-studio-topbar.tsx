import { Play, Square } from "lucide-react";
import type { ReactNode } from "react";

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
  return (
    <header className="pw-topbar">
      <div className="pw-brand">
        <i />
        <span>PEACH</span>
        <b>PATCH</b>
      </div>
      <nav className="pw-actions" aria-label="Peach Patch application menu">
        <div className="pw-action-group" aria-label="File actions">
          <button
            type="button"
            disabled={modulesLocked}
            title="Create a new patch"
            onClick={onNewPatch}
          >
            New
          </button>
          <button
            type="button"
            onClick={onOpenPatch}
            disabled={modulesLocked || !registryReady}
            title="Open a .vcv patch"
          >
            Open
          </button>
          <button
            type="button"
            onClick={onOpenPatchUrl}
            disabled={modulesLocked || !registryReady}
            title="Open a patch from PatchStorage"
          >
            Link
          </button>
          {fileInput}
          {presetInput}
          <button type="button" onClick={onSavePatch} title="Save the current .vcv patch">
            Save
          </button>
        </div>
        <div className="pw-action-group" aria-label="History actions">
          <button
            type="button"
            onClick={onUndo}
            disabled={modulesLocked || !canUndo}
            title="Undo · ⌘/Ctrl+Z"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={modulesLocked || !canRedo}
            title="Redo · ⇧⌘/Ctrl+Z"
          >
            Redo
          </button>
        </div>
        <div className="pw-action-group" aria-label="View actions">
          <button
            type="button"
            className={libraryOpen ? "active" : ""}
            aria-pressed={libraryOpen}
            onClick={onToggleLibrary}
            title="Show or hide the module Library"
          >
            Library
          </button>
        </div>
        <button
          type="button"
          className={`pw-audio-action ${audioRunning ? "audio-live" : ""}`}
          onClick={onToggleAudio}
          disabled={busy || !registryReady}
          title={audioRunning ? "Stop browser audio" : "Start browser audio"}
        >
          {audioRunning ? (
            <Square aria-hidden="true" size={11} strokeWidth={2.25} />
          ) : (
            <Play aria-hidden="true" size={11} strokeWidth={2.25} />
          )}
          <span>{audioRunning ? "Stop audio" : "Start audio"}</span>
        </button>
        <a
          className="pw-github-link"
          href={GITHUB_REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View Peach Patch on GitHub"
          title="View Peach Patch on GitHub"
        >
          <GitHubIcon />
        </a>
      </nav>
    </header>
  );
}
