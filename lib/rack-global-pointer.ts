import type { ModuleInstance } from "./patch-types";
import type { GlobalPointerContract, WebPluginModule } from "./web-plugin-registry";

export type RackModifierSource = {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

export function rackModifierMask(event: RackModifierSource): number {
  return (
    (event.shiftKey ? 1 : 0) |
    (event.ctrlKey ? 2 : 0) |
    (event.altKey ? 4 : 0) |
    (event.metaKey ? 8 : 0)
  );
}

function stateValue(
  module: ModuleInstance,
  definition: WebPluginModule,
  index: number | undefined,
  fallback = 0,
): number {
  if (index === undefined) return fallback;
  return Number(module.state?.[index] ?? definition.stateKeys?.[index]?.default ?? fallback);
}

export function globalPointerMatches(
  module: ModuleInstance,
  definition: WebPluginModule,
  contract: GlobalPointerContract,
  modifiers: number,
  hoveredControl: { type: "param" | "in" | "out" } | null,
): boolean {
  if (module.bypassed) return false;
  if (
    modifiers !==
    stateValue(module, definition, contract.modifiersState, contract.modifiersDefault ?? 0)
  )
    return false;
  if (contract.paramHoverOnlyParam === undefined) return true;
  const paramOnly =
    module.params[contract.paramHoverOnlyParam] ??
    definition.params.find((param) => param.id === contract.paramHoverOnlyParam)?.default ??
    0;
  return paramOnly !== 1 || hoveredControl?.type === "param";
}

export function globalPointerMiddleEnabled(
  module: ModuleInstance,
  definition: WebPluginModule,
  contract: GlobalPointerContract,
): boolean {
  const middle = contract.middle;
  if (!middle) return false;
  return (
    stateValue(module, definition, middle.modeState, middle.modeDefault ?? 0) !==
    (middle.disabledValue ?? 0)
  );
}
