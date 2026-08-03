import type { BlockedVcvPatchError } from "../../lib/vcv-patch-compatibility";
import { useI18n } from "../i18n/provider";
import { formatUserMessage, type UserMessage } from "../i18n/user-message";

export type PatchOpenFailure =
  { kind: "blocked"; error: BlockedVcvPatchError } | { kind: "invalid"; message: UserMessage };

type PatchStorageUrlDialogProps = {
  value: string;
  error: UserMessage | null;
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
  const { t } = useI18n();
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
            <span>{t("dialog.link.eyebrow")}</span>
            <b id="pw-patch-url-title">{t("dialog.link.title")}</b>
          </div>
          <button type="button" aria-label={t("common.close")} disabled={busy} onClick={onDismiss}>
            ×
          </button>
        </header>
        <label htmlFor="pw-patch-url">{t("dialog.link.label")}</label>
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
          <p role="alert">{formatUserMessage(t, error)}</p>
        ) : (
          <small>{t("dialog.link.help")}</small>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onDismiss}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={busy || !value.trim()}>
            {busy ? t("common.loading") : t("dialog.link.open")}
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
  const { t } = useI18n();
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
            <span>
              {blocked ? t("dialog.failure.blockedEyebrow") : t("dialog.failure.invalidEyebrow")}
            </span>
            <b id="pw-patch-error-title">
              {blocked ? t("dialog.failure.blockedTitle") : t("dialog.failure.invalidTitle")}
            </b>
          </div>
          <button type="button" aria-label={t("common.close")} onClick={onDismiss}>
            ×
          </button>
        </header>
        <p id="pw-patch-error-description">
          {failure.kind === "blocked"
            ? t("dialog.failure.blockedDescription", { count: failure.error.instanceCount })
            : t("dialog.failure.invalidDescription", {
                message: formatUserMessage(t, failure.message),
              })}
        </p>
        {failure.kind === "blocked" ? (
          <ul className="pw-patch-error-list">
            {failure.error.blocked.map((module) => (
              <li key={module.key}>
                <b>{module.key}</b>
                <span>
                  {module.count > 1
                    ? t("dialog.failure.instanceCount", { count: module.count })
                    : ""}
                  {module.reason === "commercial-license"
                    ? t("dialog.failure.commercial", {
                        license: module.license ?? t("common.unknown"),
                      })
                    : t("dialog.failure.unavailable")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <footer>
          <button type="button" autoFocus onClick={onDismiss}>
            {t("dialog.failure.keepCurrent")}
          </button>
        </footer>
      </section>
    </div>
  );
}
