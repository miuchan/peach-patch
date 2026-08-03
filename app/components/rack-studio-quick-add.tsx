import type { WebPluginModule } from "../../lib/web-plugin-registry";

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
          aria-label="Quick add module"
          value={state.query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onDismiss();
          }}
          placeholder="Add module at this position…"
        />
        <kbd>↵</kbd>
      </form>
      <div>
        {matches.map((module) => (
          <button key={module.key} type="button" onClick={() => onSelect(module)}>
            <b>{module.model}</b>
            <span>{module.plugin}</span>
            <small>
              {module.inputs.length} in · {module.outputs.length} out
            </small>
          </button>
        ))}
        {!matches.length && <p>No matching web build</p>}
      </div>
    </div>
  );
}
