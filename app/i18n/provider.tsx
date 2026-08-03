import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translateMessage, type MessageKey } from "./catalogs";
import { LOCALE_STORAGE_KEY, resolveLocale, type AppLocale, type MessageValues } from "./core";

export type Translate = (key: MessageKey, values?: MessageValues) => string;

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: Translate;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function detectBrowserLocale() {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Language detection still works when storage is unavailable or blocked.
  }
  return resolveLocale(
    stored,
    navigator.languages.length ? navigator.languages : [navigator.language],
  );
}

export function updateLocalizedMetadata(locale: AppLocale) {
  const t: Translate = (key, values) => translateMessage(locale, key, values);
  document.documentElement.lang = locale;
  document.documentElement.dir = "ltr";
  document.title = t("meta.title");
  const updates: ReadonlyArray<readonly [string, string]> = [
    ['meta[name="description"]', t("meta.description")],
    ['meta[property="og:title"]', "Peach Patch"],
    ['meta[property="og:description"]', t("meta.ogDescription")],
    ['meta[property="og:locale"]', locale === "zh-CN" ? "zh_CN" : "en_US"],
  ];
  for (const [selector, content] of updates) {
    document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
  }
}

export function initializeI18n() {
  const locale = detectBrowserLocale();
  updateLocalizedMetadata(locale);
  return locale;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: AppLocale;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale ?? detectBrowserLocale);
  const t = useCallback<Translate>(
    (key, values) => translateMessage(locale, key, values),
    [locale],
  );
  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The active language still changes for this session when storage is unavailable.
    }
  }, []);
  const formatNumber = useMemo<I18nContextValue["formatNumber"]>(() => {
    const formatter = new Intl.NumberFormat(locale);
    return (value, options) =>
      options ? new Intl.NumberFormat(locale, options).format(value) : formatter.format(value);
  }, [locale]);

  useEffect(() => updateLocalizedMetadata(locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, formatNumber }),
    [formatNumber, locale, setLocale, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
