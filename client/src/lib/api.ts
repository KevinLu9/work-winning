import { offlineFileUrl, offlineRequest } from "@offline"
import { ApiError } from "./errors"

const PERSONA_KEY = "owwh.persona"
export const DEFAULT_PERSONA = "u-transport-bm"

export function getPersona(): string {
  try {
    return localStorage.getItem(PERSONA_KEY) || DEFAULT_PERSONA
  } catch {
    return DEFAULT_PERSONA
  }
}

export function setPersona(id: string) {
  try {
    localStorage.setItem(PERSONA_KEY, id)
  } catch {
    /* storage unavailable: persona lasts for this session only */
  }
}

export { ApiError }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (offlineRequest) {
    // Shareable single-file build: answer from the in-browser database instead of Flask.
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined
    return (await offlineRequest(init.method ?? "GET", path, body, getPersona())) as T
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-OWWH-User": getPersona(), ...(init.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error || res.statusText, body.fields)
  return body as T
}

/** Multipart upload (Flask only: the shareable build has no file storage). */
async function upload<T>(path: string, form: FormData): Promise<T> {
  if (import.meta.env.VITE_SHARE_DATA) throw new ApiError(400, "File uploads need the full app; this shareable file cannot store them")
  const res = await fetch(`/api${path}`, { method: "POST", body: form, headers: { "X-OWWH-User": getPersona() } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error || res.statusText, body.fields)
  return body as T
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  patch: <T,>(path: string, data: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
  upload,
}

/** URL of a file under client/public. The shareable build has no public/ folder and serves an inlined copy instead. */
export function publicUrl(path: string): string {
  if (offlineFileUrl) return offlineFileUrl(path) ?? path
  return path
}

/** URL of an uploaded file. <img>/<a> cannot send the persona header, so it goes in ?as= (see server/app/auth.py).
 * The shareable build bundles the files (server/export_offline.py) and serves them from memory. */
export function uploadUrl(id: string, download = false): string {
  if (offlineFileUrl) return offlineFileUrl(id) ?? ""
  return `/api/uploads/${id}${qs({ as: getPersona(), download: download ? 1 : undefined })}`
}

/** Build a query string, repeating keys for arrays and skipping empty values. */
export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)))
    else sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}
