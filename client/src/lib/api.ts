import { offlineRequest } from "@offline"
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

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  patch: <T,>(path: string, data: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
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
