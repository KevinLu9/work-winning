/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Shareable build only: "real" (Salesforce export only) or "synthetic" (plus generated demo data). */
  readonly VITE_SHARE_DATA: "" | "real" | "synthetic"
}

declare module "virtual:owwh-offline-data" {
  /** gzip-compressed SQLite database (base64), exported by server/export_offline.py. */
  export const dbGzipBase64: string
  /** /api/meta response and backend constants, exported by server/export_offline.py. */
  export const bootstrap: unknown
}
