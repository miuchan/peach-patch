import { memo } from "react";
import type { WebPluginModule } from "../../lib/web-plugin-registry";
import { useI18n } from "../i18n/provider";

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

function RackStudioLibraryView({
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
  const { t } = useI18n();
  return (
    <aside className="pw-library">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAddFromUrl();
        }}
      >
        <input
          aria-label={t("library.urlLabel")}
          value={moduleUrl}
          onChange={(event) => onModuleUrlChange(event.target.value)}
          placeholder="https://library.vcvrack.com/Plugin/Model"
        />
        <button
          disabled={busy || registryState !== "ready"}
          type="submit"
          title={t("library.loadTitle")}
        >
          {busy
            ? t("common.loading")
            : registryState === "loading"
              ? t("library.registryLoading")
              : t("library.loadUrl")}
        </button>
      </form>
      <div className="pw-registry">
        <label>
          <span>
            {registryState === "loading"
              ? t("library.modulesLoading")
              : registryState === "error"
                ? t("library.modulesUnavailable")
                : t("library.modulesCount", {
                    visible: filteredModules.length,
                    total: registryCount,
                  })}
          </span>
          <input
            aria-label={t("library.searchLabel")}
            value={moduleQuery}
            onChange={(event) => onModuleQueryChange(event.target.value)}
            placeholder={t("library.searchPlaceholder")}
          />
        </label>
        <div className="pw-registry-results">
          {filteredModules.map((module) => (
            <button
              key={module.key}
              draggable={!modulesLocked}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-patchwork-module", module.key);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => {
                onModuleUrlChange(module.libraryUrl);
                onAddModule(module);
              }}
              title={
                replaceMode && selectedModuleCount === 1
                  ? t("library.replaceTitle", { module: module.key })
                  : selectedCableCount === 1 &&
                      module.inputs.length > 0 &&
                      module.outputs.length > 0
                    ? t("library.insertTitle", { module: module.key })
                    : t("library.addTitle", { module: module.key })
              }
            >
              <b>{module.key}</b>
              <em>{module.version}</em>
              <small>
                {replaceMode && selectedModuleCount === 1
                  ? t("library.replaceBadge")
                  : selectedCableCount === 1 &&
                      module.inputs.length > 0 &&
                      module.outputs.length > 0
                    ? t("library.insertBadge")
                    : "WASM"}
              </small>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export const RackStudioLibrary = memo(RackStudioLibraryView);
