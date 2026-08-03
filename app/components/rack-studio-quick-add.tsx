import type { WebPluginModule } from "../../lib/web-plugin-registry";
import { useI18n } from "../i18n/provider";

export type RackStudioQuickAddState = {
  left: number;
  top: number;
  worldX: number;
  worldY: number;
  query: string;
};

export type RackStudioQuickAddProps = {
  state: RackStudioQuickAddState;
  matches: WebPluginModule[];
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onSelect: (module: WebPluginModule) => void;
  onDismiss: () => void;
};

export function RackStudioQuickAdd({
  state,
  matches,
  onQueryChange,
  onSubmit,
  onSelect,
  onDismiss,
}: RackStudioQuickAddProps) {
  const { t } = useI18n();
  return (
    <div
      className="pw-quick-add"
      style={{ left: state.left, top: state.top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          autoFocus
          aria-label={t("quickAdd.aria")}
          value={state.query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onDismiss();
          }}
          placeholder={t("quickAdd.placeholder")}
        />
        <kbd>↵</kbd>
      </form>
      <div>
        {matches.map((module) => (
          <button key={module.key} type="button" onClick={() => onSelect(module)}>
            <b>{module.model}</b>
            <span>{module.plugin}</span>
            <small>
              {t("quickAdd.inputCount", { count: module.inputs.length })} ·{" "}
              {t("quickAdd.outputCount", { count: module.outputs.length })}
            </small>
          </button>
        ))}
        {!matches.length && <p>{t("quickAdd.noMatches")}</p>}
      </div>
    </div>
  );
}
