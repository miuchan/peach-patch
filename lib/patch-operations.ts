/**
 * Stable public facade for immutable Patch document operations.
 *
 * Implementations live in focused domain modules. Keeping this facade avoids
 * coupling callers to the internal module layout and preserves the existing
 * import surface.
 */
export {
  connectPatchCable,
  disconnectModuleCables,
  reconnectPatchCableEndpoint,
  removeModuleAndHealCable,
  spliceModuleIntoCable,
} from "./patch-cable-topology.ts";
export {
  duplicatePatchModules,
  replaceModuleKeepingCompatibleCables,
} from "./patch-module-editing.ts";
export {
  applyRackModulePreset,
  mergeModuleData,
  randomizeModuleControls,
  resetModuleControls,
  updateModuleParam,
  updateModuleState,
} from "./patch-module-state.ts";
export {
  anchoredViewportPan,
  fittedPatchViewport,
  modulePortPosition,
  modulesIntersectingViewportRect,
  moveRackModulesWithoutOverlap,
  RACK_GRID_HEIGHT,
  RACK_GRID_WIDTH,
  rackModulesOverlap,
  rackSurfaceBounds,
  resolvedModulePortPosition,
  snapRackPosition,
} from "./rack-patch-layout.ts";
