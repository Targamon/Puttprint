import seed from './data/courses.json'
import type { Course, Round, Profile, GhostMode, HoleResult, Hole } from './types'
const K = { profile: 'pp.profile', courses: 'pp.courses', rounds: 'pp.rounds' }
const get = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))
export const SEED = seed as unknown as Course[]
export const loadProfile = () => get<Profile | null>(K.profile, null)
export const saveProfile = (p: Profile) => set(K.profile, p)
/** Shared course DB = seeded Dolphin courses + user-added (localStorage). */
export const loadCourses = (): Course[] => {
  const m = new Map<string, Course>()
  for (const c of [...SEED, ...get<Course[]>('pp.serverCourses', []), ...get<Course[]>(K.courses, [])]) if (!m.has(c.id)) m.set(c.id, c) // bundled seed wins, then server, then local-only
  return [...m.values()]
}
export function addCourse(name: string, address: string, holes: number, lat?: number, lon?: number): Course {
  const user = get<Course[]>(K.courses, [])
  const la = lat ?? 42.36, lo = lon ?? -74.0
  // Schematic: holes laid out as straight corridors marching north; par pattern 4,4,3,5,...
  const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5]
  const hs: Hole[] = Array.from({ length: holes }, (_, i) => {
    const par = pars[i % 9], yd = par === 3 ? 165 : par === 4 ? 370 : 510
    const ox = lo + (i % 6) * 0.0025, oy = la + Math.floor(i / 6) * 0.006
    const tee: [number, number] = [ox, oy], green: [number, number] = [ox, oy + (yd * 0.9144) / 110540]
    return { number: i + 1, par, handicap: null, yards: { White: yd }, tee, green, path: [tee, green],
      features: { green: [], tees: [], fairways: [], bunkers: [], water: [], woods: [] } }
  })
  const c: Course = { id: 'u-' + Date.now().toString(36), name, shortName: name, address, par: hs.reduce((s, h) => s + h.par, 0),
    holeCount: holes, tees: ['White'], geometry: 'user-added (schematic)', location: { lat: la, lon: lo }, trees: [], holes: hs }
  set(K.courses, [...user, c]); markCourseDirty(c.id); void sync(); return c
}
export const loadRounds = () => get<Round[]>(K.rounds, [])
export function saveRound(r: Round) { const rs = loadRounds().filter(x => x.id !== r.id); set(K.rounds, [...rs, r]); if (r.complete) { markRoundDirty(r.id); refreshClubAvgs(); void sync() } }
const holesPlayed = (r: Round) => Object.keys(r.holes).map(Number)
export const roundScore = (r: Round, p = 0) => holesPlayed(r).reduce((s, n) => s + (r.holes[n][p]?.score ?? 0), 0)
export const roundToPar = (r: Round, c: Course, p = 0) => holesPlayed(r).reduce((s, n) => s + (r.holes[n][p]?.score ?? 0) - (c.holes[n - 1]?.par ?? 0), 0)
/**
 * Ghost rules (player 1 = profile owner, completed rounds on this course):
 *  last    = most recently completed round
 *  best    = round with lowest score-to-par (over holes played); ties -> most recent
 *  perfect = per hole, the lowest-score hole from ANY completed round (ties -> fewer strokes to reach the green,
 *            then most recent). Stitched into a composite "perfect" round.
 */
export function ghostFor(course: Course, mode: GhostMode, excludeId?: string): { label: string; holes: Record<number, HoleResult> } | null {
  const rs = loadRounds().filter(r => r.courseId === course.id && r.complete && r.id !== excludeId).sort((a, b) => b.date - a.date)
  if (!rs.length) return null
  const pick = (r: Round) => Object.fromEntries(holesPlayed(r).map(n => [n, r.holes[n][0]]).filter(x => x[1])) as Record<number, HoleResult>
  if (mode === 'last') return { label: 'LAST', holes: pick(rs[0]) }
  if (mode === 'best') { const b = [...rs].sort((a, b) => roundToPar(a, course) - roundToPar(b, course))[0]; return { label: 'BEST', holes: pick(b) } }
  const out: Record<number, HoleResult> = {}
  const toGreen = (h: HoleResult) => h.shots.findIndex(s => s.club === 'Putter') < 0 ? h.shots.length : h.shots.findIndex(s => s.club === 'Putter')
  for (const r of rs) for (const n of holesPlayed(r)) {
    const h = r.holes[n][0]; if (!h) continue
    const cur = out[n]
    if (!cur || h.score < cur.score || (h.score === cur.score && toGreen(h) < toGreen(cur))) out[n] = h
  }
  return { label: 'PERFECT', holes: out }
}

// ---------------- Cloud sync (offline-first) ----------------
import { api, setToken } from './api'
import { computeClubAvgs } from './clubs'
const KS = { serverCourses: 'pp.serverCourses', dirtyRounds: 'pp.dirtyRounds', dirtyCourses: 'pp.dirtyCourses', online: 'pp.lastSync' }
export const serverCourses = () => get<Course[]>(KS.serverCourses, [])
export type SyncState = { online: boolean; at?: number; err?: string }
let state: SyncState = { online: false }
const listeners = new Set<(s: SyncState) => void>()
export const onSync = (f: (s: SyncState) => void) => { listeners.add(f); f(state); return () => { listeners.delete(f) } }
const emit = (s: SyncState) => { state = s; listeners.forEach(f => f(s)) }
export const syncState = () => state
export function markRoundDirty(id: string) { set(KS.dirtyRounds, [...new Set([...get<string[]>(KS.dirtyRounds, []), id])]) }
export function markCourseDirty(id: string) { set(KS.dirtyCourses, [...new Set([...get<string[]>(KS.dirtyCourses, []), id])]) }
/** Recompute learned club means from local rounds, persist on profile (and server on next sync). */
export function refreshClubAvgs(): Profile | null {
  const p = loadProfile(); if (!p) return null
  const np = { ...p, clubAvgs: computeClubAvgs(loadRounds()) }; saveProfile(np); return np
}
/** Login against the API (falls back to an offline profile). */
export async function cloudLogin(name: string, color: string): Promise<Profile> {
  const prev = loadProfile()
  try {
    const r = await api<{ token: string; userId: string; name: string; color: string; clubAvgs: Profile['clubAvgs'] }>('/auth/login', { body: { name, color } })
    if (prev && prev.userId && prev.userId !== r.userId) { set(K.rounds, []); set(KS.dirtyRounds, []) } // switching accounts on this device
    const p: Profile = { name: r.name, color: r.color, userId: r.userId, token: r.token, clubAvgs: prev?.userId === r.userId ? prev.clubAvgs : r.clubAvgs }
    saveProfile(p); setToken(p.token!); await sync(); return loadProfile() ?? p
  } catch { const p: Profile = { ...(prev ?? {}), name, color }; saveProfile(p); emit({ online: false, err: 'offline — saved on this device' }); return p }
}
/** Push dirty courses/rounds + club avgs, pull shared courses and my rounds. Safe to call anytime. */
export async function sync(): Promise<SyncState> {
  const p = loadProfile()
  if (!p?.token) { emit({ online: false, err: 'not signed in to cloud' }); return state }
  setToken(p.token)
  try {
    const localUser = get<Course[]>(K.courses, [])
    for (const id of get<string[]>(KS.dirtyCourses, [])) { const c = localUser.find(x => x.id === id); if (c) await api('/courses', { body: c }) }
    set(KS.dirtyCourses, [])
    const dirty = get<string[]>(KS.dirtyRounds, []), rs = loadRounds().filter(r => dirty.includes(r.id))
    if (rs.length) await api('/rounds', { body: { rounds: rs } })
    set(KS.dirtyRounds, [])
    const remote = await api<Round[]>('/rounds'), byId = new Map(loadRounds().map(r => [r.id, r]))
    for (const r of remote) if (!byId.has(r.id)) byId.set(r.id, r)
    set(K.rounds, [...byId.values()].sort((a, b) => a.date - b.date))
    set(KS.serverCourses, await api<Course[]>('/courses'))
    const np = refreshClubAvgs()
    if (np?.clubAvgs) await api('/me/club-avgs', { method: 'PUT', body: { clubAvgs: np.clubAvgs } })
    emit({ online: true, at: Date.now() })
  } catch (e: any) { emit({ online: false, err: e?.status === 401 ? 'session expired — log in again' : 'offline — will sync on reconnect' }) }
  return state
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void sync() })
  setInterval(() => { if (!state.online || get<string[]>(KS.dirtyRounds, []).length) void sync() }, 30000)
}
