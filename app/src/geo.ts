import type { LL, Hole } from './types'
export const M_PER_YD = 0.9144
export function toM(p: LL, o: LL): [number, number] {
  return [(p[0] - o[0]) * 111320 * Math.cos((o[1] * Math.PI) / 180), (p[1] - o[1]) * 110540]
}
export function fromM(m: [number, number], o: LL): LL {
  return [o[0] + m[0] / (111320 * Math.cos((o[1] * Math.PI) / 180)), o[1] + m[1] / 110540]
}
export const distM = (a: LL, b: LL) => { const m = toM(b, a); return Math.hypot(m[0], m[1]) }
export const distYd = (a: LL, b: LL) => distM(a, b) / M_PER_YD
/** Hole path guaranteed to start at tee and end at green. */
export function holePath(h: Hole): LL[] {
  const p = h.path.length >= 2 ? [...h.path] : [h.tee, h.green]
  if (distM(p[p.length - 1], h.green) > 3) p.push(h.green)
  return p
}
/** Point at distance d (m) along polyline, plus remaining length */
export function along(path: LL[], d: number): LL {
  for (let i = 1; i < path.length; i++) {
    const s = distM(path[i - 1], path[i])
    if (d <= s) { const t = d / s; return [path[i-1][0] + (path[i][0]-path[i-1][0]) * t, path[i-1][1] + (path[i][1]-path[i-1][1]) * t] }
    d -= s
  }
  return path[path.length - 1]
}
export function pathLen(path: LL[]) { let s = 0; for (let i = 1; i < path.length; i++) s += distM(path[i-1], path[i]); return s }
/** Distance along path of the closest point to p */
export function project(path: LL[], p: LL): number {
  let best = Infinity, bestD = 0, acc = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i-1], b = toM(path[i], a), q = toM(p, a), L2 = b[0]*b[0] + b[1]*b[1] || 1
    const t = Math.max(0, Math.min(1, (q[0]*b[0] + q[1]*b[1]) / L2))
    const dd = Math.hypot(q[0] - b[0]*t, q[1] - b[1]*t)
    if (dd < best) { best = dd; bestD = acc + t * Math.sqrt(L2) }
    acc += Math.sqrt(L2)
  }
  return bestD
}
export const CLUBS: [string, number][] = [['Driver',240],['3W',215],['5W',200],['4H',190],['5i',175],['6i',165],['7i',152],['8i',140],['9i',128],['PW',115],['GW',100],['SW',80],['LW',60],['Putter',0]]
export const clubYd = (c: string, learned?: Record<string, number>) => learned?.[c] ?? CLUBS.find(x => x[0] === c)?.[1] ?? 150
/** Simulated next lie: advance previous lie by club carry along hole path (±7%, slight lateral). */
export function simulateNext(h: Hole, prev: LL, club: string, seed: number, learned?: Record<string, number>): LL {
  const path = holePath(h), L = pathLen(path), at = project(path, prev)
  const rnd = (k: number) => { const x = Math.sin(seed * 9301 + k * 49297) * 233280; return x - Math.floor(x) }
  if (club === 'Putter') { // roll most of the way to the cup
    const rem = distM(prev, h.green); const m = toM(h.green, prev), f = rem < 3 ? 1 : 0.85 + rnd(1) * 0.1
    return fromM([m[0] * f, m[1] * f], prev)
  }
  let d = at + clubYd(club, learned) * M_PER_YD * (0.93 + rnd(1) * 0.14)
  if (d >= L - 6) { // on/near green: land within a few yards of pin
    const a = rnd(2) * Math.PI * 2, r = 3 + rnd(3) * 9
    return fromM([Math.cos(a) * r, Math.sin(a) * r], h.green)
  }
  const p = along(path, d), q = along(path, d + 2), dir = toM(q, p), n = Math.hypot(dir[0], dir[1]) || 1
  const lat = (rnd(4) - 0.5) * 22
  return fromM([-dir[1] / n * lat, dir[0] / n * lat], p)
}
