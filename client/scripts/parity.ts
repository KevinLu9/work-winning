/**
 * Parity test: replays server/tests/parity_cases.json through the in-browser API (src/offline/routes.ts)
 * and compares every response with the Flask API's output for the same cases on the same database.
 *
 * Run via `npm run test:parity` from the repo root (it prepares the database and the Flask output).
 * Usage: tsx scripts/parity.ts <database> <bootstrap.json> <flask-output.json>
 */
import fs from "node:fs"
import path from "node:path"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import { ApiError } from "@/lib/errors"
import { setDb, value, type WasmDb } from "@/offline/sql"
import { handle, setBootstrap, type Bootstrap } from "@/offline/routes"

const [dbPath, bootPath, flaskPath] = process.argv.slice(2)
const CASES = path.resolve(import.meta.dirname, "../../server/tests/parity_cases.json")
// Timestamps are "now" on each side, so they legitimately differ.
const VOLATILE = new Set(["ts", "created_at", "updated_at", "changed_at"])

function resolve<T>(v: T, newId: string | null): T {
  if (Array.isArray(v)) return v.map((x) => resolve(x, newId)) as T
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, newId)])) as T
  if (typeof v !== "string") return v
  return v.replace(/\{sql:(.*?)\}/g, (_, sql) => String(value(sql))).replace("{new}", newId ?? "") as T
}

function diff(a: unknown, b: unknown, at: string, out: string[]) {
  if (out.length > 12) return
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a))) out.push(`${at}: flask=${a} offline=${b}`)
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${at}: length flask=${a.length} offline=${b.length}`)
    a.slice(0, b.length).forEach((x, i) => diff(x, b[i], `${at}[${i}]`, out))
    return
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) {
      if (VOLATILE.has(k)) continue
      if (!(k in (a as object))) out.push(`${at}.${k}: only in offline`)
      else if (!(k in (b as object))) out.push(`${at}.${k}: only in flask`)
      else diff((a as any)[k], (b as any)[k], `${at}.${k}`, out)
    }
    return
  }
  if (a !== b) out.push(`${at}: flask=${JSON.stringify(a)?.slice(0, 80)} offline=${JSON.stringify(b)?.slice(0, 80)}`)
}

const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: console.error })
const bytes = new Uint8Array(fs.readFileSync(dbPath))
const db = new sqlite3.oo1.DB()
db.checkRc(sqlite3.capi.sqlite3_deserialize(db.pointer!, "main", sqlite3.wasm.allocFromTypedArray(bytes), bytes.length, bytes.length,
  sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE))
setDb(db as unknown as WasmDb)
setBootstrap(JSON.parse(fs.readFileSync(bootPath, "utf8")) as Bootstrap)

const flask = JSON.parse(fs.readFileSync(flaskPath, "utf8")) as { new_id: string | null; results: { case: string[]; status: number; body: unknown }[] }
const cases = JSON.parse(fs.readFileSync(CASES, "utf8")).cases as [string, string, string, unknown?][]

let newId: string | null = null
let failures = 0
cases.forEach(([user, method, rawPath, rawBody], i) => {
  const p = resolve(rawPath, newId)
  const body = rawBody === undefined ? undefined : resolve(rawBody, newId)
  let status = method === "POST" && p === "/content" ? 201 : 200
  let result: unknown
  try {
    result = JSON.parse(JSON.stringify(handle(method, p, body, user)))
    if (status === 201) newId = (result as { id: string }).id
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    status = e.status
    result = { error: e.message, ...(e.fields ? { fields: e.fields } : {}) }
  }
  // The new content id is random on each side; align it before comparing.
  const offline = newId && flask.new_id ? JSON.parse(JSON.stringify(result).replaceAll(newId, flask.new_id)) : result
  const expected = flask.results[i]
  const problems: string[] = []
  if (expected.status !== status) problems.push(`status flask=${expected.status} offline=${status}`)
  diff(expected.body, offline, "body", problems)
  const label = `${method} ${p} as ${user}`
  if (problems.length) {
    failures++
    console.log(`✗ ${label}\n    ${problems.join("\n    ")}`)
  } else {
    console.log(`✓ ${label} (${status})`)
  }
})

console.log(`\n${cases.length - failures}/${cases.length} cases match the Flask API`)
process.exit(failures ? 1 : 0)
