import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

const webDescription =
  "Independent controller for Valeton GP-5 and GP-50. Connect over USB or Bluetooth to edit patches, the audio chain, and .prst files.";

const host = process.env.TAURI_DEV_HOST;
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const packageVersion = (
  JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
    version: string;
  }
).version;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // Chrome loads the manifest with credentials omitted. Staging basic auth
      // then answers 401, so beforeinstallprompt never fires.
      useCredentials: true,
      devOptions: {
        enabled: false,
      },
      includeManifestIcons: true,
      manifest: {
        name: "GP Studio",
        short_name: "GP Studio",
        description: webDescription,
        start_url: "/",
        scope: "/",
        id: "/",
        display: "standalone",
        lang: "en",
        theme_color: "#010f24",
        background_color: "#010f24",
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // A waiting worker stays inactive until the reload prompt calls skipWaiting.
        skipWaiting: false,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        globIgnores: [
          "**/pwa-192.png",
          "**/pwa-512.png",
          "**/pwa-maskable-192.png",
          "**/pwa-maskable-512.png",
        ],
        // Server-side paths on the same domain (nginx): the app shell must not answer them.
        navigateFallbackDenylist: [/^\/usage$/, /^\/stats(\/|$)/, /^\/download\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Bind all interfaces so the web UI is reachable on LAN, not only localhost.
    // TAURI_DEV_HOST still wins when Tauri (e.g. mobile) needs a specific address.
    host: host || true,
    allowedHosts: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    port: 1420,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
});
