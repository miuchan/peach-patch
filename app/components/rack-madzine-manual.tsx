import { useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import type { ManualHelpModule } from "../../lib/web-plugin-registry";

export type MadzineManualTarget = {
  moduleSlug: string;
  moduleName: string;
  targetName?: string;
  targetType?: "param" | "input" | "output";
};

type Language = "en" | "zh" | "ja";
const LANGUAGE_NAMES: Record<Language, string> = { en: "EN", zh: "繁中", ja: "日本" };
const LANGUAGE_ORDER: Language[] = ["en", "zh", "ja"];
const stopPointer = (event: PointerEvent) => event.stopPropagation();
const stopDouble = (event: MouseEvent) => event.stopPropagation();

export function RackMadzineManual({
  help,
  target,
  languageValue,
  fontSizeValue,
  displayX,
  displayY,
  displayWidth,
  displayHeight,
  languageX,
  languageY,
  languageWidth,
  languageHeight,
  decreaseX,
  increaseX,
  fontY,
  fontWidth,
  fontHeight,
  scaleX,
  onData,
}: {
  help: Record<string, ManualHelpModule>;
  target: MadzineManualTarget | null;
  languageValue: number;
  fontSizeValue: number;
  displayX: number;
  displayY: number;
  displayWidth: number;
  displayHeight: number;
  languageX: number;
  languageY: number;
  languageWidth: number;
  languageHeight: number;
  decreaseX: number;
  increaseX: number;
  fontY: number;
  fontWidth: number;
  fontHeight: number;
  scaleX: number;
  onData: (data: Record<string, unknown>) => void;
}) {
  const [query, setQuery] = useState(""),
    [selectedSlug, setSelectedSlug] = useState<string | null>(null),
    language = LANGUAGE_ORDER[Math.max(0, Math.min(2, Math.round(languageValue) - 1))] ?? "en",
    fontSize = Math.max(8, Math.min(32, Number.isFinite(fontSizeValue) ? fontSizeValue : 20)),
    modules = useMemo(
      () => Object.entries(help).sort((left, right) => left[1].name.localeCompare(right[1].name)),
      [help],
    ),
    matches = useMemo(() => {
      const needle = query.trim().toLocaleLowerCase();
      if (!needle) return modules;
      return modules.filter(([slug, module]) =>
        `${slug} ${module.name} ${module.description[language]} ${module.entries.map((entry) => entry.name).join(" ")}`
          .toLocaleLowerCase()
          .includes(needle),
      );
    }, [language, modules, query]),
    activeSlug = target?.moduleSlug ?? selectedSlug,
    active = activeSlug ? help[activeSlug] : undefined,
    activeTargetName = target?.targetName,
    activeEntry =
      activeTargetName && active
        ? active.entries.find(
            (entry) =>
              entry.name.localeCompare(activeTargetName, undefined, { sensitivity: "accent" }) ===
              0,
          )
        : undefined,
    body = activeEntry?.text[language] ?? active?.description[language] ?? "",
    title = active?.name ?? target?.moduleName ?? "Manual",
    controlStyle = (left: number, top: number, width: number, height: number) => ({
      left: left * scaleX,
      top,
      width: width * scaleX,
      height,
    });

  const updateFont = (delta: number) =>
    onData({ fontSize: Math.max(8, Math.min(32, fontSize + delta)) });
  return (
    <div className="pw-madzine-manual" aria-label="MADZINE Manual">
      <button
        type="button"
        className="pw-madzine-manual-control language"
        style={controlStyle(languageX, languageY, languageWidth, languageHeight)}
        aria-label={`Manual language ${LANGUAGE_NAMES[language]}`}
        title="Click to change language · double-click to reset to EN"
        onPointerDown={stopPointer}
        onClick={() => onData({ language: ((LANGUAGE_ORDER.indexOf(language) + 1) % 3) + 1 })}
        onDoubleClick={(event) => {
          stopDouble(event);
          onData({ language: 1 });
        }}
      >
        {LANGUAGE_NAMES[language]}
      </button>
      <button
        type="button"
        className="pw-madzine-manual-control font"
        style={controlStyle(decreaseX, fontY, fontWidth, fontHeight)}
        aria-label="Decrease Manual font size"
        title="Decrease font · double-click to reset"
        onPointerDown={stopPointer}
        onClick={() => updateFont(-2)}
        onDoubleClick={(event) => {
          stopDouble(event);
          onData({ fontSize: 20 });
        }}
      >
        A−
      </button>
      <button
        type="button"
        className="pw-madzine-manual-control font"
        style={controlStyle(increaseX, fontY, fontWidth, fontHeight)}
        aria-label="Increase Manual font size"
        title="Increase font · double-click to reset"
        onPointerDown={stopPointer}
        onClick={() => updateFont(2)}
        onDoubleClick={(event) => {
          stopDouble(event);
          onData({ fontSize: 20 });
        }}
      >
        A+
      </button>
      <section
        className="pw-madzine-manual-display"
        style={controlStyle(displayX, displayY, displayWidth, displayHeight)}
        onPointerDown={stopPointer}
      >
        {active ? (
          <>
            <button
              type="button"
              className="pw-madzine-manual-back"
              aria-label="Back to MADZINE module directory"
              onClick={() => {
                setSelectedSlug(null);
                setQuery("");
              }}
            >
              ‹
            </button>
            <h3 style={{ fontSize: fontSize * 1.3, lineHeight: 1.3 }}>{title}</h3>
            {target?.targetName && (
              <strong className={target.targetType ?? ""} style={{ fontSize, lineHeight: 1.4 }}>
                {target.targetName}
              </strong>
            )}
            <hr />
            <p style={{ fontSize, lineHeight: 1.4 }}>{body}</p>
            {!target?.targetName && active.entries.length > 0 && (
              <dl className="pw-madzine-manual-entries">
                {active.entries.map((entry) => (
                  <div key={entry.name}>
                    <dt>{entry.name}</dt>
                    <dd>{entry.text[language]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        ) : (
          <>
            <h3 className="directory-title">MADZINE</h3>
            <input
              type="search"
              aria-label="Search MADZINE manual"
              placeholder={
                language === "zh"
                  ? "搜尋模組或控制項"
                  : language === "ja"
                    ? "モジュールを検索"
                    : "Search modules or controls"
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onDoubleClick={stopDouble}
            />
            <div className="pw-madzine-manual-directory" role="list">
              {matches.map(([slug, module]) => (
                <button
                  key={slug}
                  type="button"
                  role="listitem"
                  onClick={() => setSelectedSlug(slug)}
                >
                  <b>{module.name}</b>
                  <span>{module.description[language]}</span>
                </button>
              ))}
              {!matches.length && (
                <p className="empty">
                  {language === "zh" ? "沒有結果" : language === "ja" ? "結果なし" : "No matches"}
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
