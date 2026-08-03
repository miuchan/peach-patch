import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./globals.css";

function RackLoadingFallback() {
  return (
    <main className="pw-app-loading" aria-live="polite">
      Loading Peach Patch…
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

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
