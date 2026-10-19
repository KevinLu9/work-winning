import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

const OFFLINE_DATA = path.resolve(__dirname, "offline-data")

/** Serves client/offline-data (written by server/export_offline.py) as `virtual:owwh-offline-data`. */
function offlineData(): Plugin {
  const id = "virtual:owwh-offline-data"
  return {
    name: "owwh-offline-data",
    resolveId: (source) => (source === id ? `\0${id}` : null),
    load(source) {
      if (source !== `\0${id}`) return null
      const db = path.join(OFFLINE_DATA, "owwh.db.gz")
      const boot = path.join(OFFLINE_DATA, "bootstrap.json")
      if (!fs.existsSync(db) || !fs.existsSync(boot)) {
        throw new Error("Offline data missing: run `npm run build:share` from the repo root (it exports the database first).")
      }
      return `export const dbGzipBase64 = ${JSON.stringify(fs.readFileSync(db).toString("base64"))}\n` +
        `export const bootstrap = ${fs.readFileSync(boot, "utf8")}\n`
    },
  }
}

function shareDataMode(): string {
  const boot = path.join(OFFLINE_DATA, "bootstrap.json")
  return fs.existsSync(boot) ? JSON.parse(fs.readFileSync(boot, "utf8")).mode : "real"
}

export default defineConfig(({ mode }) => {
  // `vite build --mode share` produces one self-contained HTML file with the API running in the browser.
  const share = mode === "share"
  return {
    plugins: [react(), tailwindcss(), ...(share ? [offlineData(), viteSingleFile()] : [])],
    // "real" or "synthetic": which dataset the shareable file contains (set by server/export_offline.py).
    define: { "import.meta.env.VITE_SHARE_DATA": JSON.stringify(share ? shareDataMode() : "") },
    resolve: {
      alias: [
        { find: "@offline", replacement: path.resolve(__dirname, share ? "./src/offline/browser.ts" : "./src/offline/disabled.ts") },
        // Main-thread SQLite build only: skips the Worker/OPFS helpers the package entry also pulls in.
        { find: /^@sqlite\.org\/sqlite-wasm$/, replacement: path.resolve(__dirname, "node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3-bundler-friendly.mjs") },
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
    },
    optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
    build: share
      ? { outDir: "dist-share", assetsInlineLimit: Number.MAX_SAFE_INTEGER, chunkSizeWarningLimit: 8000 }
      : {
          rollupOptions: {
            output: {
              manualChunks: {
                react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
                charts: ["recharts"],
                ui: ["radix-ui", "lucide-react", "sonner", "cmdk"],
              },
            },
          },
        },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: "http://127.0.0.1:5001", changeOrigin: true },
      },
    },
  }
})
