import type { Round, ClubAvg } from './types'
import { distYd } from './geo'
/** Mean carry (yds) per full-swing club from completed rounds (player index 0 = you).
 *  Carry of shot i = haversine-ish distance to shot i+1 on the same hole. Putter ignored. n>=3 required to override defaults. */
export const MIN_SAMPLES = 3
export function computeClubAvgs(rounds: Round[]): Record<string, ClubAvg> {
  const acc: Record<string, number[]> = {}
  for (const r of rounds) if (r.complete) for (const res of Object.values(r.holes)) {
    const s = res[0]?.shots ?? []
    for (let i = 0; i + 1 < s.length; i++) {
      const c = s[i].club; if (!c || c === 'Putter') continue
      const d = distYd([s[i].lon, s[i].lat], [s[i + 1].lon, s[i + 1].lat]); if (d < 5 || d > 400) continue
      ;(acc[c] ??= []).push(d)
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([c, v]) => [c, { yd: Math.round(v.reduce((a, b) => a + b, 0) / v.length), n: v.length }]))
}
/** Only averages with enough samples override defaults */
export const usable = (a?: Record<string, ClubAvg>) => Object.fromEntries(Object.entries(a ?? {}).filter(([, v]) => v.n >= MIN_SAMPLES).map(([c, v]) => [c, v.yd]))
