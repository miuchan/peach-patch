import { useEffect, useState } from "react";
import type { PatchDocument } from "../../lib/patch-types";
import { hydrateModulesWithDefinitions } from "../../lib/patch-hydrate";
import { loadPeachRegistry } from "../../lib/peach-registry-client";
import { allWebPlugins, replaceRegistryModules } from "../../lib/runtime-plugin-registry";

export type PeachRegistryState = "loading" | "ready" | "error";

type UsePeachRegistryOptions = {
  mutatePatch: (update: (patch: PatchDocument) => PatchDocument) => void;
  onStatus: (message: string) => void;
};

/**
 * Owns the mutable Registry index lifecycle and hydrates any restored modules
 * once trusted definitions become available. The editable patch stays owned by
 * history; this hook only projects Registry metadata into it.
 */
export function usePeachRegistry({ mutatePatch, onStatus }: UsePeachRegistryOptions) {
  const [modules, setModules] = useState(() => allWebPlugins());
  const [state, setState] = useState<PeachRegistryState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadRegistry() {
      try {
        const nextModules = await loadPeachRegistry(undefined, controller.signal);
        if (controller.signal.aborted) return;

        replaceRegistryModules(nextModules);
        setModules(nextModules);
        setState("ready");
        mutatePatch((current) => {
          const hydratedModules = hydrateModulesWithDefinitions(current.modules, nextModules);
          return hydratedModules === current.modules
            ? current
            : { ...current, modules: hydratedModules };
        });
        onStatus(`GitHub registry ready · ${nextModules.length} verified modules`);
      } catch (error) {
        if (controller.signal.aborted) return;

        replaceRegistryModules([]);
        setModules([]);
        setState("error");
        onStatus(
          `GitHub registry unavailable · ${error instanceof Error ? error.message : "request failed"}`,
        );
      }
    }

    void loadRegistry();
    return () => controller.abort();
  }, [mutatePatch, onStatus]);

  return { modules, state };
}
