/**
 * Minimal synchronous SQLite helpers over an @sqlite.org/sqlite-wasm `oo1.DB`, shaped like the
 * Python sqlite3 calls the Flask routes use, so the offline port reads line-for-line the same.
 */

type Bind = (string | number | null)[]

export interface WasmDb {
  exec(opts: { sql: string; bind?: Bind; rowMode: "object"; returnValue: "resultRows" }): Record<string, unknown>[]
  exec(sql: string, opts?: { bind?: Bind }): unknown
  selectValue(sql: string, bind?: Bind): unknown
}

let db: WasmDb | null = null

export function setDb(instance: WasmDb) {
  db = instance
}

function conn(): WasmDb {
  if (!db) throw new Error("Offline database not initialised")
  return db
}

/** sqlite-wasm rejects a bind array on statements without placeholders (Python accepts []), so omit it then. */
function clean(params: unknown[]): Bind | undefined {
  if (!params.length) return undefined
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? Number(p) : (p as string | number | null)))
}

export function all<T = Record<string, any>>(sql: string, params: unknown[] = []): T[] {
  return conn().exec({ sql, bind: clean(params), rowMode: "object", returnValue: "resultRows" }) as T[]
}

export function get<T = Record<string, any>>(sql: string, params: unknown[] = []): T | undefined {
  return all<T>(sql, params)[0]
}

export function value<T = any>(sql: string, params: unknown[] = []): T {
  return conn().selectValue(sql, clean(params)) as T
}

export function run(sql: string, params: unknown[] = []): number {
  conn().exec(sql, { bind: clean(params) })
  return Number(conn().selectValue("SELECT last_insert_rowid()"))
}

// Same as server/app/db.py: JSON text columns are decoded and body_json is exposed as `body`.
const JSON_FIELDS = ["body_json", "restricted_flags", "tags", "sectors", "expertise", "roles", "clients", "service_lines", "detail"]

export function rowToDict<T = Record<string, any>>(row: Record<string, any>): T {
  const d: Record<string, any> = { ...row }
  for (const k of JSON_FIELDS) {
    if (typeof d[k] === "string") {
      try {
        d[k] = JSON.parse(d[k])
      } catch {
        /* keep raw string, as the Python version does */
      }
    }
  }
  if ("body_json" in d) {
    d.body = d.body_json
    delete d.body_json
  }
  return d as T
}

export function rows<T = Record<string, any>>(sql: string, params: unknown[] = []): T[] {
  return all(sql, params).map((r) => rowToDict<T>(r))
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${todayIso()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Python's round(x, n) for the display values the API returns. */
export function round(x: number, n = 1): number {
  const f = 10 ** n
  return Math.round(x * f) / f
}
