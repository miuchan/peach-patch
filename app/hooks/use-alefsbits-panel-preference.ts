import { useEffect, useState } from "react";

const STORAGE_KEY = "peach-patch.plugin-ui.alefsbits.v1";
const CHANGE_EVENT = "peach-patch:alefsbits-panel-preference";

type ModelPreference = {
  contrast: number;
  useGlobal: boolean;
};

type AlefsbitsPreferences = {
  globalContrast: number;
  models: Record<string, ModelPreference>;
};

const DEFAULT_CONTRAST = 0.9;

function clampContrast(value: number) {
  return Math.max(0.1, Math.min(0.9, Number.isFinite(value) ? value : DEFAULT_CONTRAST));
}

function defaults(): AlefsbitsPreferences {
  return { globalContrast: DEFAULT_CONTRAST, models: {} };
}

function readPreferences(): AlefsbitsPreferences {
  if (typeof window === "undefined") return defaults();
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<AlefsbitsPreferences> | null;
    const models: Record<string, ModelPreference> = {};
    if (parsed?.models && typeof parsed.models === "object") {
      for (const [key, value] of Object.entries(parsed.models)) {
        if (!value || typeof value !== "object") continue;
        models[key] = {
          contrast: clampContrast(Number(value.contrast)),
          useGlobal: value.useGlobal !== false,
        };
      }
    }
    return {
      globalContrast: clampContrast(Number(parsed?.globalContrast)),
      models,
    };
  } catch {
    return defaults();
  }
}

function writePreferences(preferences: AlefsbitsPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAlefsbitsPanelPreference(modelKey: string) {
  const [preferences, setPreferences] = useState<AlefsbitsPreferences>(defaults);

  useEffect(() => {
    const refresh = () => setPreferences(readPreferences());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(CHANGE_EVENT, refresh);
    };
  }, []);

  const model = preferences.models[modelKey] ?? {
    contrast: DEFAULT_CONTRAST,
    useGlobal: true,
  };
  const update = (nextModel: ModelPreference, globalContrast = preferences.globalContrast) => {
    writePreferences({
      globalContrast: clampContrast(globalContrast),
      models: { ...preferences.models, [modelKey]: nextModel },
    });
  };

  return {
    globalContrast: preferences.globalContrast,
    moduleContrast: model.contrast,
    useGlobal: model.useGlobal,
    effectiveContrast: model.useGlobal ? preferences.globalContrast : model.contrast,
    setGlobalContrast(value: number) {
      writePreferences({ ...preferences, globalContrast: clampContrast(value) });
    },
    setModuleContrast(value: number) {
      update({ ...model, contrast: clampContrast(value) });
    },
    setUseGlobal(value: boolean) {
      update({ ...model, useGlobal: value });
    },
    setGlobalFromModule() {
      update({ ...model, useGlobal: true }, model.contrast);
    },
  };
}
