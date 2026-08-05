import type { WebPluginModule } from "./web-plugin-registry.ts";

const registryModules = new Map<string, WebPluginModule>();

export function replaceRegistryModules(modules: WebPluginModule[]) {
  const next = new Map<string, WebPluginModule>();
  for (const pluginDefinition of modules) next.set(pluginDefinition.key, pluginDefinition);
  registryModules.clear();
  for (const [key, pluginDefinition] of next) registryModules.set(key, pluginDefinition);
}
export function getWebPlugin(key: string) {
  return registryModules.get(key);
}
export function allWebPlugins() {
  return [...registryModules.values()];
}

export function isRegistryModuleDiscoverable(module: WebPluginModule) {
  return module.hidden !== true;
}

export function discoverableRegistryModules(modules: readonly WebPluginModule[]) {
  return modules.filter(isRegistryModuleDiscoverable);
}
