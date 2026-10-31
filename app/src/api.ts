// Thin client for the Putt Print API (server/). Everything is optional: if the API is down the app runs from localStorage.
const env = (import.meta as any).env ?? {}
export const API: string = (env.VITE_API_URL || '/api').replace(/\/$/, '')  // same-origin in dev (vite proxy) and prod (server strips /api); native builds set VITE_API_URL=https://your-host
let token: string | null = null
export const setToken = (t: string | null) => { token = t }
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; timeout?: number } = {}): Promise<T> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), opts.timeout ?? 5000)
  try {
    const r = await fetch(API + path, { method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'), signal: ctl.signal,
      headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status })
    return j as T
  } finally { clearTimeout(t) }
}
