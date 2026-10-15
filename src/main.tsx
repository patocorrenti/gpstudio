/// <reference types="vite-plugin-pwa/vanillajs" />
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { App } from "@/app/App";
import { isTauriRuntime } from "@/midi/detect";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (!isTauriRuntime()) {
  void registerProductionServiceWorker();
}

async function registerProductionServiceWorker(): Promise<void> {
  const { registerSW } = await import("virtual:pwa-register");
  let skipWaiting: (() => Promise<void>) | undefined;
  skipWaiting = registerSW({
    onNeedRefresh() {
      toast("A new version is ready.", {
        id: "pwa-update",
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "Reload",
          onClick: () => {
            void skipWaiting?.();
          },
        },
      });
    },
  });
}
