import { WEB_PLUGIN_BY_KEY, WEB_PLUGIN_REGISTRY, type WebPluginModule } from "./web-plugin-registry.ts";

const dynamicModules=new Map<string,WebPluginModule>();

export function registerDynamicModule(pluginDefinition:WebPluginModule){dynamicModules.set(pluginDefinition.key,pluginDefinition)}
export function registerDynamicModules(modules:WebPluginModule[]){for(const pluginDefinition of modules)registerDynamicModule(pluginDefinition)}
export function getWebPlugin(key:string){return dynamicModules.get(key)??WEB_PLUGIN_BY_KEY[key]}
export function allWebPlugins(){return [...new Map([...WEB_PLUGIN_REGISTRY,...dynamicModules.values()].map(module=>[module.key,module])).values()]}
