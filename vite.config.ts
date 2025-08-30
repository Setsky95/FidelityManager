// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Podés sobreescribir el target del proxy con VITE_PROXY_TARGET si querés.
// Por defecto apunta al server Express que corre en 127.0.0.1:5000.
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:5000";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer()
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    // 🔁 En dev, todo lo que empiece con /api se envía al server de Express
    proxy: {
      "/api": {
        target: PROXY_TARGET,
        changeOrigin: true,
        // Opcional: si tu backend redirige, habilita followRedirects:
        // followRedirects: true,
      },
    },
    // Para que Vite lea sólo lo permitido
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Opcional: abrir en todas las interfaces o mantener default
    // host: true,
    // port: 5173,
    // HMR overlay off si te molesta:
    // hmr: { overlay: false },
  },
});
