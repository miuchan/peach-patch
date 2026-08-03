import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./globals.css";
import { I18nProvider, initializeI18n, useI18n } from "./i18n/provider";

function RackLoadingFallback() {
  const { t } = useI18n();
  return (
    <main className="pw-app-loading" aria-live="polite">
      {t("loading.app")}
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: "*",
    HydrateFallback: RackLoadingFallback,
    lazy: async () => {
      const { RackWebStudio } = await import("./rack-web-studio");
      return { Component: RackWebStudio };
    },
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("Peach Patch root element is missing");
const initialLocale = initializeI18n();

createRoot(root).render(
  <StrictMode>
    <I18nProvider initialLocale={initialLocale}>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
);
