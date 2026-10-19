/** Normal builds talk to Flask; the in-browser API is only bundled in the shareable build (vite --mode share). */
export const offlineRequest: null | ((method: string, path: string, body: unknown, userId: string) => Promise<unknown>) = null
export const offlineFileUrl: null | ((key: string) => string | null) = null
