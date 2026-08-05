import { useEffect, useState } from "react";
import type { PatchDocument } from "../../lib/patch-types";
import { hydrateModulesWithDefinitions } from "../../lib/patch-hydrate";
import { loadPeachRegistry } from "../../lib/peach-registry-client";
import {
  allWebPlugins,
  discoverableRegistryModules,
  replaceRegistryModules,
} from "../../lib/runtime-plugin-registry";
import { issue, message, type UserMessage } from "../i18n/user-message";

export type PeachRegistryState = "loading" | "ready" | "error";

type UsePeachRegistryOptions = {
  mutatePatch: (update: (patch: PatchDocument) => PatchDocument) => void;
  onStatus: (message: UserMessage) => void;
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
        onStatus(
          message("status.registry.ready", {
            modules: message("count.modules", {
              count: discoverableRegistryModules(nextModules).length,
            }),
          }),
        );
      } catch (error) {
        if (controller.signal.aborted) return;

        replaceRegistryModules([]);
        setModules([]);
        setState("error");
        onStatus(issue(error, "errors.registryUnavailable"));
      }
    }

    void loadRegistry();
    return () => controller.abort();
  }, [mutatePatch, onStatus]);

  return { modules, state };
}
