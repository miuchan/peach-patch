import type { WebPluginModule } from "../../lib/web-plugin-registry";

export type RackStudioLibraryProps = {
  moduleUrl: string;
  moduleQuery: string;
  busy: boolean;
  registryState: "loading" | "ready" | "error";
  filteredModules: WebPluginModule[];
  registryCount: number;
  modulesLocked: boolean;
  replaceMode: boolean;
  selectedModuleCount: number;
  selectedCableCount: number;
  onModuleUrlChange: (value: string) => void;
  onModuleQueryChange: (value: string) => void;
  onAddFromUrl: () => void;
  onAddModule: (module: WebPluginModule) => void;
};

export function RackStudioLibrary({
  moduleUrl,
  moduleQuery,
  busy,
  registryState,
  filteredModules,
  registryCount,
  modulesLocked,
  replaceMode,
  selectedModuleCount,
  selectedCableCount,
  onModuleUrlChange,
  onModuleQueryChange,
  onAddFromUrl,
  onAddModule,
}: RackStudioLibraryProps) {
  return (
    <aside className="pw-library">
      <form onSubmit={(event) => { event.preventDefault(); onAddFromUrl(); }}>
        <input aria-label="VCV Library module URL" value={moduleUrl} onChange={(event) => onModuleUrlChange(event.target.value)} placeholder="https://library.vcvrack.com/Plugin/Model" />
        <button disabled={busy || registryState !== "ready"} type="submit" title="Load a module published in the GitHub registry">
          {busy ? "Loading…" : registryState === "loading" ? "Registry…" : "Load URL"}
        </button>
      </form>
      <div className="pw-registry">
        <label>
          <span>{registryState === "loading" ? "MODULES · LOADING FROM GITHUB…" : registryState === "error" ? "MODULES · GITHUB UNAVAILABLE" : `MODULES · ${filteredModules.length}/${registryCount}`}</span>
          <input aria-label="Search web builds" value={moduleQuery} onChange={(event) => onModuleQueryChange(event.target.value)} placeholder="VCO, mixer, brand…" />
        </label>
        <div className="pw-registry-results">
          {filteredModules.map((module) => (
            <button key={module.key} draggable={!modulesLocked} onDragStart={(event) => { event.dataTransfer.setData("application/x-patchwork-module", module.key); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => { onModuleUrlChange(module.libraryUrl); onAddModule(module); }} title={replaceMode && selectedModuleCount === 1 ? `Replace the selected module with ${module.key}` : selectedCableCount === 1 && module.inputs.length > 0 && module.outputs.length > 0 ? `Insert ${module.key} on the selected cable` : `Add ${module.key} to the patch`}>
              <b>{module.key}</b><em>{module.version}</em>
              <small>{replaceMode && selectedModuleCount === 1 ? "REPLACE" : selectedCableCount === 1 && module.inputs.length > 0 && module.outputs.length > 0 ? "INSERT" : "WASM"}</small>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
