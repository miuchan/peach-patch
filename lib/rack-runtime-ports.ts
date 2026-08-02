import type { WebPluginModule } from "./web-plugin-registry.ts";

type RuntimePortDefinition = Pick<WebPluginModule, "inputs" | "outputs" | "runtime">;

/**
 * Exposes only ports that the browser runtime can actually route. Audio
 * boundaries currently terminate at the browser's stereo output device, so
 * their first two inputs are valid destinations while device-source outputs
 * and higher hardware channels are not yet implemented.
 */
export function rackRuntimePorts(definition: RuntimePortDefinition) {
  const audioBoundary = Boolean(definition.runtime?.audio);
  return {
    inputs: definition.inputs.filter((port) =>
      !port.hidden && (!audioBoundary || port.id < 2)
    ),
    outputs: audioBoundary
      ? []
      : definition.outputs.filter((port) => !port.hidden),
  };
}
