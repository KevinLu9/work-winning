/**
 * Single-file shareable build only: runs the API inside the page. SQLite (WASM) opens the bundled
 * synthetic database in memory, and routes.ts answers the requests the React app would send to Flask.
 * Changes (submissions, approvals) last until the page is closed.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import { bootstrap, dbGzipBase64 } from "virtual:owwh-offline-data"
import { setDb, type WasmDb } from "./sql"
import { handle, setBootstrap, type Bootstrap } from "./routes"

let ready: Promise<void> | null = null

async function gunzip(base64: string): Promise<Uint8Array> {
  const bin = atob(base64)
  const gz = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i)
  const stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function init() {
  const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: console.error })
  const bytes = await gunzip(dbGzipBase64)
  const ptr = sqlite3.wasm.allocFromTypedArray(bytes)
  const db = new sqlite3.oo1.DB()
  const { capi } = sqlite3
  db.checkRc(capi.sqlite3_deserialize(db.pointer!, "main", ptr, bytes.length, bytes.length,
    capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE))
  setDb(db as unknown as WasmDb)
  setBootstrap(bootstrap as Bootstrap)
}

export async function offlineRequest(method: string, path: string, body: unknown, userId: string): Promise<unknown> {
  ready ??= init()
  await ready
  // Round-trip through JSON so responses look exactly like the Flask ones (no shared references).
  return JSON.parse(JSON.stringify(handle(method, path, body, userId)))
}
