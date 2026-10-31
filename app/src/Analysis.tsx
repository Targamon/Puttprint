import type { Course, Profile, Round } from './types'
import { loadRounds, loadCourses, roundScore, roundToPar } from './store'
import { MIN_SAMPLES } from './clubs'

const fmt = (d: number) => d === 0 ? 'E' : d > 0 ? '+' + d : '' + d
const nm = (r: Round) => Object.keys(r.holes).length

export default function Analysis({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const cs = loadCourses(), byId = Object.fromEntries(cs.map(c => [c.id, c])) as Record<string, Course>
  const rounds = loadRounds().filter(r => r.complete && nm(r) > 0 && byId[r.courseId]).sort((a, b) => a.date - b.date)
  const hdr = <div className="hdr"><button className="back" onClick={onBack}>‹</button><img src="/icon.png" className="logo" alt="" />
    <div><div className="ht">Player Analysis</div><div className="hs">{profile.name}</div></div></div>
  if (!rounds.length) return <div className="screen">{hdr}
    <div className="card"><div className="ct">No rounds yet</div><p>Play a round first. Then come back here to see your scores, club distances and tips to get better.</p></div>
    <button className="gold" onClick={onBack}>Choose a course</button></div>

  // per-hole stats (player 0)
  let strokes = 0, putts = 0, holes = 0, threePutts = 0, puttHoles = 0
  const par: Record<number, number[]> = { 3: [], 4: [], 5: [] }
  const holeStat: Record<string, { label: string; d: number[] }> = {}
  for (const r of rounds) { const c = byId[r.courseId]
    for (const [k, res] of Object.entries(r.holes)) { const h = res[0]; const ch = c.holes[+k - 1]; if (!h || !ch) continue
      holes++; strokes += h.score
      const p = h.shots.filter(s => s.club === 'Putter').length
      if (h.shots.length) { putts += p; puttHoles++; if (p >= 3) threePutts++ }
      ;(par[ch.par] ??= []).push(h.score - ch.par)
      const key = c.id + ':' + k; (holeStat[key] ??= { label: `${c.shortName} #${k} (par ${ch.par})`, d: [] }).d.push(h.score - ch.par) } }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
  const toPars = rounds.map(r => roundToPar(r, byId[r.courseId]))
  const per18 = rounds.map((r, i) => toPars[i] * 18 / nm(r))
  const hs = Object.values(holeStat).map(h => ({ ...h, a: avg(h.d) })).sort((a, b) => b.a - a.a)
  const worst = hs.slice(0, 3), best = [...hs].reverse().slice(0, 3)
  const courseRows = Object.entries(rounds.reduce((m, r, i) => { (m[r.courseId] ??= []).push(per18[i]); return m }, {} as Record<string, number[]>))
    .map(([id, v]) => ({ name: byId[id].shortName, n: v.length, a: avg(v) })).sort((a, b) => a.a - b.a)
  const clubs = Object.entries(profile.clubAvgs ?? {}).sort((x, y) => y[1].yd - x[1].yd)
  const low = clubs.filter(([, v]) => v.n < MIN_SAMPLES).map(([c]) => c)
  const last5 = rounds.slice(-5)
  const puttPct = strokes ? Math.round(putts / strokes * 100) : 0
  const ppH = puttHoles ? putts / puttHoles : 0

  const tips: string[] = []
  if (!profile.clubAvgs?.Driver || profile.clubAvgs.Driver.n < MIN_SAMPLES) tips.push('Your driver samples are low — log more tee shots so distances get accurate.')
  if (low.length) tips.push(`Need more shots logged with: ${low.join(', ')} (${MIN_SAMPLES}+ each).`)
  if (putts && ppH > 2) tips.push(`You average ${ppH.toFixed(1)} putts a hole (${puttPct}% of strokes) — practice lag putts to get the first putt close.`)
  else if (putts) tips.push(`Putting is ${puttPct}% of your strokes (${ppH.toFixed(1)} per hole) — nice. Keep it up.`)
  if (threePutts) tips.push(`${threePutts} three-putt hole${threePutts > 1 ? 's' : ''} — work on 20–30 ft distance control.`)
  const pw = [3, 4, 5].filter(p => par[p].length).sort((a, b) => avg(par[b]) - avg(par[a]))[0]
  if (pw && avg(par[pw]) > 0.5) tips.push(`Par ${pw}s cost you the most (${fmt(+avg(par[pw]).toFixed(1))} per hole). ${pw === 3 ? 'Focus on iron accuracy to the green.' : pw === 5 ? 'Play the layup safe — avoid the big miss.' : 'Find the fairway off the tee first.'}`)
  if (worst[0] && worst[0].a > 1) tips.push(`Toughest hole: ${worst[0].label}. Try a safer club off the tee there.`)
  if (per18.length >= 2) { const t = per18[per18.length - 1] - avg(per18.slice(0, -1)); tips.push(t < 0 ? `Your last round beat your average by ${Math.abs(t).toFixed(1)} strokes (18-hole pace). Great progress!` : 'Your last round was above your average — chase your Best ghost next time.') }
  if (!putts) tips.push('Pick "Putter" for putts so Putt Print can track your putting.')

  return <div className="screen">{hdr}
    <div className="card"><div className="ct">Overview</div>
      <div className="cm"><span className="badge real">{rounds.length} round{rounds.length > 1 ? 's' : ''}</span><span className="badge">{holes} holes</span>
        <span className="badge">avg {fmt(+avg(per18).toFixed(1))} per 18</span>{putts > 0 && <span className="badge">{ppH.toFixed(1)} putts/hole</span>}</div></div>
    <div className="card"><div className="ct">Tips to improve</div>{tips.map((t, i) => <p key={i}>✅ {t}</p>)}</div>
    <div className="card"><div className="ct">Last rounds</div>
      <table className="sc"><tbody>{last5.slice().reverse().map(r => <tr key={r.id}><td>{new Date(r.date).toLocaleDateString()}</td><td>{byId[r.courseId].shortName}</td><td>{nm(r)} h</td><td>{roundScore(r)} ({fmt(roundToPar(r, byId[r.courseId]))})</td></tr>)}</tbody></table></div>
    {courseRows.length > 0 && <div className="card"><div className="ct">Courses (18-hole pace)</div>{courseRows.map(c => <p key={c.name}>{c.name}: {fmt(+c.a.toFixed(1))} · {c.n} round{c.n > 1 ? 's' : ''}</p>)}</div>}
    <div className="card"><div className="ct">Best holes</div>{best.map(h => <p key={h.label}>⭐ {h.label}: {fmt(+h.a.toFixed(1))}</p>)}
      <div className="ct">Hardest holes</div>{worst.map(h => <p key={h.label}>⚠️ {h.label}: {fmt(+h.a.toFixed(1))}</p>)}</div>
    <div className="clubcard"><b>Club distances learned</b>{clubs.length ? <div>{clubs.map(([c, v]) => <span key={c} className={'badge ' + (v.n >= MIN_SAMPLES ? 'real' : '')}>{c} {v.yd}y ({v.n}{v.n < MIN_SAMPLES ? ' – need more' : ''})</span>)}</div> : <p>None yet — pick a club for each shot.</p>}</div>
    <button className="gold" onClick={onBack}>Done</button>
  </div>
}
