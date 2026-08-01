import { Play, Square } from "lucide-react";
import type { ReactNode } from "react";

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
      <div className="pw-brand"><i /><span>PEACH</span><b>PATCH</b></div>
      <nav className="pw-actions" aria-label="Peach Patch application menu">
        <div className="pw-action-group" aria-label="File actions">
          <button type="button" disabled={modulesLocked} title="Create a new patch" onClick={onNewPatch}>New</button>
          <button type="button" onClick={onOpenPatch} disabled={modulesLocked || !registryReady} title="Open a .vcv patch">Open</button>
          {fileInput}
          {presetInput}
          <button type="button" onClick={onSavePatch} title="Save the current .vcv patch">Save</button>
        </div>
        <div className="pw-action-group" aria-label="History actions">
          <button type="button" onClick={onUndo} disabled={modulesLocked || !canUndo} title="Undo · ⌘/Ctrl+Z">Undo</button>
          <button type="button" onClick={onRedo} disabled={modulesLocked || !canRedo} title="Redo · ⇧⌘/Ctrl+Z">Redo</button>
        </div>
        <div className="pw-action-group" aria-label="View actions">
          <button type="button" className={libraryOpen ? "active" : ""} aria-pressed={libraryOpen} onClick={onToggleLibrary} title="Show or hide the module Library">Library</button>
        </div>
        <button type="button" className={`pw-audio-action ${audioRunning ? "audio-live" : ""}`} onClick={onToggleAudio} disabled={busy || !registryReady} title={audioRunning ? "Stop browser audio" : "Start browser audio"}>
          {audioRunning ? <Square aria-hidden="true" size={11} strokeWidth={2.25} /> : <Play aria-hidden="true" size={11} strokeWidth={2.25} />}
          <span>{audioRunning ? "Stop audio" : "Start audio"}</span>
        </button>
      </nav>
    </header>
  );
}
