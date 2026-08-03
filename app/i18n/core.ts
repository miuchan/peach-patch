export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type MessageValues = Readonly<Record<string, string | number>>;
export type PluralMessage = Readonly<
  Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }
>;
export type MessageTemplate = string | PluralMessage;

export const LOCALE_STORAGE_KEY = "peach-patch.locale.v1";

export function normalizeLocale(locale: string | null | undefined): AppLocale | null {
  if (!locale) return null;
  const normalized = locale.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return null;
}

export function resolveLocale(
  storedLocale: string | null | undefined,
  preferredLocales: readonly string[] = [],
): AppLocale {
  const stored = normalizeLocale(storedLocale);
  if (stored) return stored;
  for (const preferred of preferredLocales) {
    const locale = normalizeLocale(preferred);
    if (locale) return locale;
  }
  return "en";
}

function formatValue(locale: AppLocale, value: string | number) {
  return typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : value;
}

export function formatTemplate(
  locale: AppLocale,
  template: MessageTemplate,
  values: MessageValues = {},
) {
  const source =
    typeof template === "string"
      ? template
      : (template[
          new Intl.PluralRules(locale).select(
            typeof values.count === "number" ? values.count : Number(values.count ?? 0),
          )
        ] ?? template.other);
  return source.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
    const value = values[name];
    return value === undefined ? placeholder : formatValue(locale, value);
  });
}
