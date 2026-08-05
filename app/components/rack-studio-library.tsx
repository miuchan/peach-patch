import { Link2, PackagePlus, Search, X } from "lucide-react";
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
  onClose: () => void;
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
  onClose,
}: RackStudioLibraryProps) {
  const { t } = useI18n();
  const registryStatus =
    registryState === "loading"
      ? t("library.modulesLoading")
      : registryState === "error"
        ? t("library.modulesUnavailable")
        : t("library.modulesCount", {
            visible: filteredModules.length,
            total: registryCount,
          });

  const addModule = (module: WebPluginModule) => {
    onModuleUrlChange(module.libraryUrl);
    onAddModule(module);
    if (window.matchMedia("(max-width: 840px)").matches) onClose();
  };

  return (
    <>
      <button
        type="button"
        className="pw-library-scrim"
        aria-label={t("library.close")}
        tabIndex={-1}
        onClick={onClose}
      />
      <aside id="pw-module-library" className="pw-library" aria-label={t("library.title")}>
        <header className="pw-library-header">
          <div>
            <span>{t("library.eyebrow")}</span>
            <h2>{t("library.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("library.close")}>
            <X aria-hidden="true" />
          </button>
        </header>

        <label className="pw-library-search">
          <span className="pw-visually-hidden">{t("library.searchLabel")}</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            autoComplete="off"
            spellCheck={false}
            aria-label={t("library.searchLabel")}
            value={moduleQuery}
            onChange={(event) => onModuleQueryChange(event.target.value)}
            placeholder={t("library.searchPlaceholder")}
          />
          {moduleQuery ? (
            <button
              type="button"
              onClick={() => onModuleQueryChange("")}
              aria-label={t("library.clearSearch")}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </label>

        <div className="pw-library-status">
          <span>{registryStatus}</span>
          {replaceMode && selectedModuleCount === 1 ? (
            <b>{t("library.replaceMode")}</b>
          ) : selectedCableCount === 1 ? (
            <b>{t("library.insertMode")}</b>
          ) : null}
        </div>

        <div className="pw-registry-results">
          {filteredModules.length > 0 ? (
            filteredModules.map((module) => {
              const actionLabel =
                replaceMode && selectedModuleCount === 1
                  ? t("library.replaceTitle", { module: module.key })
                  : selectedCableCount === 1 &&
                      module.inputs.length > 0 &&
                      module.outputs.length > 0
                    ? t("library.insertTitle", { module: module.key })
                    : t("library.addTitle", { module: module.key });
              return (
                <button
                  key={module.key}
                  type="button"
                  draggable={!modulesLocked}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-patchwork-module", module.key);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => addModule(module)}
                  title={actionLabel}
                  aria-label={actionLabel}
                >
                  <span className="pw-library-card-copy">
                    <b>{module.name || module.model}</b>
                    <em>
                      {module.brand || module.plugin} · {module.version}
                    </em>
                  </span>
                  <small>
                    {replaceMode && selectedModuleCount === 1
                      ? t("library.replaceBadge")
                      : selectedCableCount === 1 &&
                          module.inputs.length > 0 &&
                          module.outputs.length > 0
                        ? t("library.insertBadge")
                        : t("library.addBadge")}
                  </small>
                </button>
              );
            })
          ) : (
            <div className="pw-library-empty">
              <Search aria-hidden="true" />
              <b>{t("library.emptyTitle")}</b>
              <span>{t("library.emptyHelp")}</span>
            </div>
          )}
        </div>

        <details className="pw-library-url-disclosure">
          <summary>
            <Link2 aria-hidden="true" />
            <span>
              <b>{t("library.urlSection")}</b>
              <small>{t("library.urlSectionHelp")}</small>
            </span>
          </summary>
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
              <PackagePlus aria-hidden="true" />
              <span>
                {busy
                  ? t("common.loading")
                  : registryState === "loading"
                    ? t("library.registryLoading")
                    : t("library.loadUrl")}
              </span>
            </button>
          </form>
        </details>
      </aside>
    </>
  );
}

export const RackStudioLibrary = memo(RackStudioLibraryView);
