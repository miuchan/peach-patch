import type { BlockedVcvPatchError } from "../../lib/vcv-patch-compatibility";

export type PatchOpenFailure =
  { kind: "blocked"; error: BlockedVcvPatchError } | { kind: "invalid"; message: string };

type PatchStorageUrlDialogProps = {
  value: string;
  error: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
};

export function PatchStorageUrlDialog({
  value,
  error,
  busy,
  onChange,
  onSubmit,
  onDismiss,
}: PatchStorageUrlDialogProps) {
  return (
    <div
      className="pw-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss();
      }}
    >
      <form
        className="pw-patch-url-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-patch-url-title"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onDismiss();
        }}
      >
        <header>
          <div>
            <span>OPEN FROM LINK</span>
            <b id="pw-patch-url-title">PatchStorage patch</b>
          </div>
          <button type="button" aria-label="Close" disabled={busy} onClick={onDismiss}>
            ×
          </button>
        </header>
        <label htmlFor="pw-patch-url">Paste the public PatchStorage page link</label>
        <input
          id="pw-patch-url"
          type="url"
          value={value}
          placeholder="https://patchstorage.com/meditation-patch/"
          autoFocus
          required
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <small>The patch is downloaded from PatchStorage and opened in this browser.</small>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onDismiss}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !value.trim()}>
            {busy ? "Loading…" : "Open patch"}
          </button>
        </footer>
      </form>
    </div>
  );
}

type PatchOpenFailureDialogProps = {
  failure: PatchOpenFailure;
  onDismiss: () => void;
};

export function PatchOpenFailureDialog({ failure, onDismiss }: PatchOpenFailureDialogProps) {
  const blocked = failure.kind === "blocked";

  return (
    <div
      className="pw-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <section
        className="pw-patch-url-dialog pw-patch-error-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pw-patch-error-title"
        aria-describedby="pw-patch-error-description"
        onKeyDown={(event) => {
          if (event.key === "Escape") onDismiss();
        }}
      >
        <header>
          <div>
            <span>{blocked ? "PATCH BLOCKED" : "PATCH NOT LOADED"}</span>
            <b id="pw-patch-error-title">
              {blocked ? "Commercial or unavailable modules" : "Unsupported or invalid VCV patch"}
            </b>
          </div>
          <button type="button" aria-label="Close" onClick={onDismiss}>
            ×
          </button>
        </header>
        <p id="pw-patch-error-description">
          {failure.kind === "blocked" ? (
            <>
              Nothing was loaded. This patch contains {failure.error.instanceCount} module instance
              {failure.error.instanceCount === 1 ? "" : "s"} that the verified browser runtime
              cannot use.
            </>
          ) : (
            <>Nothing was loaded. {failure.message}</>
          )}
        </p>
        {failure.kind === "blocked" ? (
          <ul className="pw-patch-error-list">
            {failure.error.blocked.map((module) => (
              <li key={module.key}>
                <b>{module.key}</b>
                <span>
                  {module.count > 1 ? `${module.count} instances · ` : ""}
                  {module.reason === "commercial-license"
                    ? `commercial license (${module.license})`
                    : "not available in the verified browser registry"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <footer>
          <button type="button" autoFocus onClick={onDismiss}>
            Keep current patch
          </button>
        </footer>
      </section>
    </div>
  );
}
