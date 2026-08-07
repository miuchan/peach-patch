import { useEffect, useRef } from "react";
import type { ModuleInstance, PatchDocument } from "../../lib/patch-types";
import type { RackAudioEngine } from "../../lib/rack-audio-engine";
import {
  findOpenPosition,
  moduleFromDefinition,
  rackKeyFromKeyboard,
  rackModifiersFromKeyboard,
  strokeBindings,
} from "../../lib/rack-studio-helpers";
import { allWebPlugins, getWebPlugin } from "../../lib/runtime-plugin-registry";
import { isStrokeCvMode, STROKE_REPEATABLE_MODES } from "../../lib/stroke-host";
import { useStableEvent } from "../../lib/use-stable-event";
import { message, type UserMessage } from "../i18n/user-message";

type ValueRef<T> = { current: T };
type RackPoint = { x: number; y: number };
type PatchCommitter = (update: PatchDocument | ((patch: PatchDocument) => PatchDocument)) => void;
type StrokeBinding = ReturnType<typeof strokeBindings>[number];

type RackStrokeSelection = {
  moduleIds: ReadonlySet<string>;
  cableIds: ReadonlySet<string>;
  replaceModuleSelection: (ids: Set<string>) => void;
  replaceCableSelection: (ids: Set<string>) => void;
  copySelection: () => void;
  pasteSelection: () => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  healDeleteSelection: () => void;
};

type RackStrokeViewport = {
  controlRef: ValueRef<{ pan: RackPoint; zoom: number }>;
  adjustZoom: (delta: number, absoluteZoom?: number) => void;
  fitPatch: () => void;
  focusModule: (moduleId: string, requestedZoom?: number) => void;
  setPan: (update: (point: RackPoint) => RackPoint) => void;
};

type RackStrokeEditor = {
  cableColors: readonly string[];
  cableOpacity: number;
  cablesVisible: boolean;
  modulesLocked: boolean;
  contextMenuOpen: boolean;
  closeContextMenus: () => void;
  setCableOpacity: (update: (value: number) => number) => void;
  setCablesVisible: (update: (value: boolean) => boolean) => void;
  setModulesLocked: (update: (value: boolean) => boolean) => void;
  togglePerformanceMode: () => void;
};

type RackStrokePatchActions = {
  commitPatch: PatchCommitter;
  undo: () => void;
  redo: () => void;
  setModuleParam: (moduleId: string, paramId: number, value: number) => void;
  setModuleState: (moduleId: string, updates: Array<[id: number, value: number]>) => void;
};

type RackStrokeAutomationActions = {
  toggleRecording: () => void;
  togglePlayback: () => void;
};

export type RackStrokeControlsOptions = {
  patch: PatchDocument;
  audioRef: ValueRef<RackAudioEngine | null>;
  hoveredModuleRef: ValueRef<string | null>;
  hoveredParamRef: ValueRef<{ moduleId: string; paramId: number } | null>;
  selection: RackStrokeSelection;
  viewport: RackStrokeViewport;
  editor: RackStrokeEditor;
  patchActions: RackStrokePatchActions;
  automation: RackStrokeAutomationActions;
  onSavePreset: (module: ModuleInstance, asDefault: boolean) => void;
  onStatus: (message: UserMessage) => void;
};

function resolveStrokeTarget(
  modules: ModuleInstance[],
  data: string,
  hoveredModuleId: string | null,
  selectedModuleIds: ReadonlySet<string>,
) {
  // Stored Rack targets win; pointer and selection are interactive fallbacks.
  const storedTarget = data
    ? modules.find(
        (module) =>
          module.id === data ||
          module.id === `vcv-${data}` ||
          String(module.rack?.id ?? "") === data,
      )
    : undefined;
  if (storedTarget) return storedTarget;

  const hovered = hoveredModuleId
    ? modules.find((module) => module.id === hoveredModuleId)
    : undefined;
  if (hovered) return hovered;

  if (selectedModuleIds.size !== 1) return undefined;
  const selectedId = selectedModuleIds.values().next().value;
  return modules.find((module) => module.id === selectedId);
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Owns Stroke routing and the studio's global keyboard command map. */
export function useRackStrokeControls({
  patch,
  audioRef,
  hoveredModuleRef,
  hoveredParamRef,
  selection,
  viewport,
  editor,
  patchActions,
  automation,
  onSavePreset,
  onStatus,
}: RackStrokeControlsOptions) {
  const copiedParamRef = useRef<number | null>(null);

  const runStrokeSpecial = useStableEvent((source: ModuleInstance, binding: StrokeBinding) => {
    const target = resolveStrokeTarget(
      patch.modules,
      binding.data,
      hoveredModuleRef.current,
      selection.moduleIds,
    );

    switch (binding.mode) {
      case 9:
      case 10:
      case 11: {
        const hovered = hoveredParamRef.current;
        const targetModule = hovered
          ? patch.modules.find((module) => module.id === hovered.moduleId)
          : undefined;
        if (!hovered || !targetModule) {
          onStatus(message("status.stroke.parameterHoverRequired"));
          return;
        }

        const current = targetModule.params[hovered.paramId] ?? 0;
        if (binding.mode === 10) {
          copiedParamRef.current = current;
          onStatus(
            message("status.stroke.parameterCopied", {
              module: targetModule.model,
              parameter: hovered.paramId + 1,
            }),
          );
          return;
        }

        const definition = getWebPlugin(targetModule.key);
        const param = definition?.params.find((candidate) => candidate.id === hovered.paramId);
        const next =
          binding.mode === 9
            ? (param?.min ?? 0) + Math.random() * ((param?.max ?? 1) - (param?.min ?? 0))
            : copiedParamRef.current;
        if (next === null) {
          onStatus(message("status.stroke.copyRequired"));
          return;
        }

        audioRef.current?.setParam(targetModule.id, hovered.paramId, next);
        patchActions.commitPatch((currentPatch) => ({
          ...currentPatch,
          modules: currentPatch.modules.map((module) =>
            module.id === targetModule.id
              ? {
                  ...module,
                  params: module.params.map((value, id) => (id === hovered.paramId ? next : value)),
                }
              : module,
          ),
        }));
        onStatus(
          message(
            binding.mode === 9
              ? "status.stroke.parameterRandomized"
              : "status.stroke.parameterPasted",
            { module: targetModule.model, parameter: hovered.paramId + 1 },
          ),
        );
        return;
      }
      case 12:
      case 121:
        if (target) viewport.focusModule(target.id, 0.9);
        else onStatus(message("status.stroke.focusTargetRequired"));
        return;
      case 14:
      case 141:
        if (target) viewport.focusModule(target.id, 0.3);
        else onStatus(message("status.stroke.focusTargetRequired"));
        return;
      case 16:
      case 161: {
        const customZoom = Number(binding.data);
        if (target && Number.isFinite(customZoom)) viewport.focusModule(target.id, customZoom);
        else onStatus(message("status.stroke.customZoomInvalid"));
        return;
      }
      case 17:
      case 171:
        if (target) viewport.focusModule(target.id, 0.9);
        else
          onStatus(
            binding.data
              ? message("status.stroke.targetMissing", { target: binding.data })
              : message("status.stroke.targetMissingUnknown"),
          );
        return;
      case 13:
      case 131:
        viewport.fitPatch();
        return;
      case 15:
      case 151:
        if (viewport.controlRef.current.zoom >= 0.75) viewport.fitPatch();
        else if (target) viewport.focusModule(target.id, 0.9);
        else onStatus(message("status.stroke.zoomTargetRequired"));
        return;
      case 20:
        editor.setCableOpacity((value) => (value > 0 ? 0 : 1));
        onStatus(
          message(
            editor.cableOpacity > 0
              ? "status.stroke.cableOpacityHidden"
              : "status.stroke.cableOpacityRestored",
          ),
        );
        return;
      case 21:
      case 24: {
        if (!selection.cableIds.size) {
          onStatus(message("status.stroke.cableSelectionRequired"));
          return;
        }
        patchActions.commitPatch((current) => ({
          ...current,
          cables: current.cables.map((cable) => {
            if (!selection.cableIds.has(cable.id)) return cable;
            const currentIndex = editor.cableColors.indexOf(cable.color.toLowerCase());
            const nextColor =
              binding.mode === 24 && /^#[\da-f]{6,8}$/i.test(binding.data)
                ? binding.data
                : editor.cableColors[
                    (currentIndex + 1 + editor.cableColors.length) % editor.cableColors.length
                  ];
            return { ...cable, color: nextColor };
          }),
        }));
        onStatus(
          message("status.stroke.cablesRecolored", {
            cables: message("count.cables", { count: selection.cableIds.size }),
          }),
        );
        return;
      }
      case 22:
        if (!selection.cableIds.size) {
          onStatus(message("status.stroke.rotateSelectionRequired"));
          return;
        }
        patchActions.commitPatch((current) => ({
          ...current,
          cables: [
            ...current.cables.filter((cable) => !selection.cableIds.has(cable.id)),
            ...current.cables.filter((cable) => selection.cableIds.has(cable.id)),
          ],
        }));
        onStatus(message("status.stroke.cablesFront"));
        return;
      case 23:
        editor.setCablesVisible((value) => !value);
        onStatus(
          message(
            editor.cablesVisible ? "status.stroke.cablesHidden" : "status.stroke.cablesShown",
          ),
        );
        return;
      case 33:
        editor.setModulesLocked((value) => !value);
        onStatus(
          message(
            editor.modulesLocked ? "status.stroke.modulesUnlocked" : "status.stroke.modulesLocked",
          ),
        );
        return;
      case 38: {
        const candidates = allWebPlugins().filter((definition) => definition.key !== source.key);
        const definition = candidates[Math.floor(Math.random() * candidates.length)];
        if (!definition) return;
        patchActions.commitPatch((current) => {
          const position = findOpenPosition(current.modules, definition.width, {
            x: (-viewport.controlRef.current.pan.x + 80) / viewport.controlRef.current.zoom,
            y: (-viewport.controlRef.current.pan.y + 80) / viewport.controlRef.current.zoom,
          });
          return {
            ...current,
            modules: [...current.modules, moduleFromDefinition(definition, position.x, position.y)],
          };
        });
        onStatus(message("status.stroke.randomModule", { module: definition.key }));
        return;
      }
      case 36:
      case 37:
        if (target) onSavePreset(target, binding.mode === 37);
        else onStatus(message("status.stroke.presetTargetRequired"));
        return;
      case 40:
      case 41:
      case 42:
      case 43:
        viewport.setPan((value) => ({
          x: value.x + (binding.mode === 40 ? 30 : binding.mode === 41 ? -30 : 0),
          y: value.y + (binding.mode === 42 ? 30 : binding.mode === 43 ? -30 : 0),
        }));
        return;
      case 44:
        onStatus(message("status.stroke.minimizeUnavailable"));
        return;
      default:
        onStatus(message("status.stroke.desktopUnsupported", { command: binding.mode }));
    }
  });

  const dispatchStroke = useStableEvent((event: KeyboardEvent, active: boolean) => {
    const keyCode = rackKeyFromKeyboard(event);
    const modifiers = rackModifiersFromKeyboard(event);
    if (keyCode < 0) return false;

    let matched = false;
    for (const strokeModule of patch.modules) {
      if (strokeModule.key !== "Stoermelder-P1/Stroke") continue;
      for (const binding of strokeBindings(strokeModule)) {
        if (binding.key !== keyCode || binding.mods !== modifiers) continue;
        if (event.repeat && !STROKE_REPEATABLE_MODES.has(binding.mode)) continue;
        matched = true;
        if (isStrokeCvMode(binding.mode)) {
          audioRef.current?.triggerAction(strokeModule.id, binding.id, active);
        } else if (active) {
          runStrokeSpecial(strokeModule, binding);
        }
      }
    }
    return matched;
  });

  const dispatchHoveredHotkey = useStableEvent((event: KeyboardEvent, active: boolean) => {
    const moduleId = hoveredModuleRef.current;
    const hotkeyModule = moduleId
      ? patch.modules.find((module) => module.id === moduleId)
      : undefined;
    const definition = hotkeyModule ? getWebPlugin(hotkeyModule.key) : undefined;
    const contract = definition?.runtime?.hotkey;
    const hoverActions = definition?.runtime?.hoverActions ?? [];
    if (!hotkeyModule || (!contract && !hoverActions.length)) return false;

    const keyCode = rackKeyFromKeyboard(event);
    const modifiers = rackModifiersFromKeyboard(event);
    if (keyCode < 0) return false;
    if (contract && active && !event.repeat) {
      const recording = (hotkeyModule.params[contract.recordParam] ?? 0) >= 0.5;
      const storedKey =
        hotkeyModule.state?.[contract.keyState] ??
        definition.stateKeys?.[contract.keyState]?.default ??
        -1;
      const storedModifiers =
        hotkeyModule.state?.[contract.modsState] ??
        definition.stateKeys?.[contract.modsState]?.default ??
        0;
      if (recording || (keyCode === storedKey && modifiers === storedModifiers)) {
        const action = contract.actionBase | ((modifiers & 0xf) << 16) | (keyCode & 0xffff);
        audioRef.current?.triggerAction(hotkeyModule.id, action, true);
        if (recording) {
          patchActions.setModuleState(hotkeyModule.id, [
            [contract.keyState, keyCode],
            [contract.modsState, modifiers],
          ]);
          patchActions.setModuleParam(hotkeyModule.id, contract.recordParam, 0);
          onStatus(message("status.stroke.hotkeyRecorded", { key: event.key }));
        }
        return true;
      }
    }

    const key = event.key.toLowerCase();
    for (const binding of hoverActions) {
      if (binding.key.toLowerCase() !== key || (binding.modifiers ?? 0) !== modifiers) continue;
      if (event.repeat && !binding.repeat) continue;
      const phase = binding.phase ?? "press";
      if ((phase === "press" && !active) || (phase === "release" && active)) continue;
      if (binding.param !== undefined) {
        const current = hotkeyModule.params[binding.param] ?? 0;
        const operation = binding.operation ?? "toggle";
        const value =
          operation === "momentary"
            ? active
              ? (binding.value ?? 1)
              : (binding.alternateValue ?? 0)
            : operation === "set"
              ? (binding.value ?? 0)
              : current === (binding.value ?? 1)
                ? (binding.alternateValue ?? 0)
                : (binding.value ?? 1);
        patchActions.setModuleParam(hotkeyModule.id, binding.param, value);
      }
      if (binding.action !== undefined) {
        if (phase === "both")
          audioRef.current?.triggerAction(hotkeyModule.id, binding.action, active);
        else {
          audioRef.current?.triggerAction(hotkeyModule.id, binding.action, true);
          audioRef.current?.triggerAction(hotkeyModule.id, binding.action, false);
        }
      }
      if (binding.hostAction === "clock-autopatch") {
        const clockModules = patch.modules.filter((module) =>
          ["ImpromptuModular/Clocked", "ImpromptuModular/Clocked-Clkd"].includes(module.key),
        );
        const master = clockModules.find((module) => {
          const masterIndex = getWebPlugin(module.key)?.stateKeys?.findIndex(
            (state) => state.key === "clockMaster",
          );
          return (
            masterIndex !== undefined && masterIndex >= 0 && Boolean(module.state?.[masterIndex])
          );
        });
        if (master && master.id !== hotkeyModule.id) {
          patchActions.commitPatch((currentPatch) => {
            const targetDefinition = getWebPlugin(hotkeyModule.key),
              masterDefinition = getWebPlugin(master.key),
              bpmDetectionIndex = targetDefinition?.stateKeys?.findIndex(
                (state) => state.key === "bpmDetectionMode",
              ),
              targetResetHighIndex = targetDefinition?.stateKeys?.findIndex(
                (state) => state.key === "resetClockOutputsHigh",
              ),
              masterResetHighIndex = masterDefinition?.stateKeys?.findIndex(
                (state) => state.key === "resetClockOutputsHigh",
              ),
              additions = [4, 5, 6]
                .filter(
                  (port) =>
                    !currentPatch.cables.some(
                      (cable) => cable.toModule === hotkeyModule.id && cable.toPort === port,
                    ),
                )
                .map((port, index) => ({
                  id: `cable-${crypto.randomUUID()}`,
                  fromModule: master.id,
                  fromPort: port,
                  toModule: hotkeyModule.id,
                  toPort: port,
                  color:
                    editor.cableColors[
                      (currentPatch.cables.length + index) % editor.cableColors.length
                    ] ?? "#f26a4f",
                }));
            return {
              ...currentPatch,
              modules: currentPatch.modules.map((module) => {
                if (module.id !== hotkeyModule.id) return module;
                const state = [...(module.state ?? [])];
                if (bpmDetectionIndex !== undefined && bpmDetectionIndex >= 0)
                  state[bpmDetectionIndex] = 0;
                if (
                  targetResetHighIndex !== undefined &&
                  targetResetHighIndex >= 0 &&
                  masterResetHighIndex !== undefined &&
                  masterResetHighIndex >= 0
                )
                  state[targetResetHighIndex] = master.state?.[masterResetHighIndex] ?? 0;
                return { ...module, state };
              }),
              cables: [...currentPatch.cables, ...additions],
            };
          });
        }
      }
      return true;
    }
    return false;
  });

  const handleKeyDown = useStableEvent((event: KeyboardEvent) => {
    // Preserve host priority: browser zoom, editable controls, module hotkeys,
    // Stroke bindings, then the studio's general editing shortcuts.
    const command = event.metaKey || event.ctrlKey;
    const zoomIn = event.key === "+" || event.key === "=" || event.code === "NumpadAdd";
    const zoomOut = event.key === "-" || event.key === "_" || event.code === "NumpadSubtract";
    const zoomReset = event.key === "0" || event.code === "Digit0" || event.code === "Numpad0";
    if (command && (zoomIn || zoomOut || zoomReset)) {
      event.preventDefault();
      viewport.adjustZoom(zoomIn ? 0.1 : zoomOut ? -0.1 : 0, zoomReset ? 1 : undefined);
      return;
    }
    if (isEditableKeyboardTarget(event.target)) return;

    if (dispatchHoveredHotkey(event, true)) {
      event.preventDefault();
      return;
    }
    if (dispatchStroke(event, true)) {
      event.preventDefault();
      return;
    }

    const letter = event.key.toLowerCase();
    if (event.key === "Escape" && editor.contextMenuOpen) {
      event.preventDefault();
      editor.closeContextMenus();
      return;
    }
    if (
      editor.modulesLocked &&
      ((command && ["z", "y", "v", "d"].includes(letter)) ||
        event.key === "Delete" ||
        event.key === "Backspace")
    ) {
      event.preventDefault();
      onStatus(message("status.stroke.exitPerform"));
      return;
    }
    if (command && letter === "z") {
      event.preventDefault();
      if (event.shiftKey) patchActions.redo();
      else patchActions.undo();
      return;
    }
    if (command && letter === "y") {
      event.preventDefault();
      patchActions.redo();
      return;
    }
    if (command && letter === "c") {
      event.preventDefault();
      selection.copySelection();
      return;
    }
    if (command && letter === "v") {
      event.preventDefault();
      selection.pasteSelection();
      return;
    }
    if (command && letter === "d") {
      event.preventDefault();
      selection.duplicateSelection();
      return;
    }
    if (command && letter === "a") {
      event.preventDefault();
      selection.replaceModuleSelection(new Set(patch.modules.map((module) => module.id)));
      selection.replaceCableSelection(new Set());
      onStatus(
        message("status.stroke.modulesSelected", {
          modules: message("count.modules", { count: patch.modules.length }),
        }),
      );
      return;
    }
    if (command && event.shiftKey && letter === "p") {
      event.preventDefault();
      editor.togglePerformanceMode();
      return;
    }
    if (command && event.shiftKey && letter === "r") {
      event.preventDefault();
      automation.toggleRecording();
      return;
    }
    if (command && event.shiftKey && event.code === "Space") {
      event.preventDefault();
      automation.togglePlayback();
      return;
    }
    if (
      event.shiftKey &&
      (event.key === "Delete" || event.key === "Backspace") &&
      selection.moduleIds.size === 1
    ) {
      event.preventDefault();
      selection.healDeleteSelection();
      return;
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      (selection.moduleIds.size || selection.cableIds.size)
    ) {
      event.preventDefault();
      selection.deleteSelection();
    }
  });

  const handleKeyUp = useStableEvent((event: KeyboardEvent) => {
    if (isEditableKeyboardTarget(event.target)) return;
    if (dispatchHoveredHotkey(event, false)) {
      event.preventDefault();
      return;
    }
    dispatchStroke(event, false);
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
