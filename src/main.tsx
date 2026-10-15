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

function showPwaUpdateToast(onReload: () => void): void {
  toast.custom(
    (id) => (
      <div className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-5 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt=""
            className="size-10 shrink-0 rounded-md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">
              There's a newer version of GP Studio!
            </p>
            <p className="mt-1 text-sm font-normal leading-snug text-muted-foreground">
              Reload to apply the changes now
            </p>
          </div>
        </div>
        <div className="flex w-full items-center justify-center gap-2">
          <button
            type="button"
            className="h-8 cursor-pointer rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => toast.dismiss(id)}
          >
            Will reload later
          </button>
          <button
            type="button"
            className="h-8 cursor-pointer rounded-md border-0 bg-lime-400 px-3 text-xs font-medium text-black/80 transition-colors hover:bg-lime-300"
            onClick={() => {
              toast.dismiss(id);
              onReload();
            }}
          >
            Reload the App
          </button>
        </div>
      </div>
    ),
    {
      id: "pwa-update",
      duration: Number.POSITIVE_INFINITY,
    },
  );
}

async function registerProductionServiceWorker(): Promise<void> {
  const { registerSW } = await import("virtual:pwa-register");
  let skipWaiting: (() => Promise<void>) | undefined;
  skipWaiting = registerSW({
    onNeedRefresh() {
      showPwaUpdateToast(() => {
        void skipWaiting?.();
      });
    },
  });
}
