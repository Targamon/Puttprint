import { useMemo } from 'react'
import type { Course, Hole, LL, Shot } from './types'
import { toM, holePath, pathLen, along, distM, M_PER_YD } from './geo'

interface Track { color: string; shots: Shot[]; live?: LL | null }
interface Props { course: Course; hole: Hole; ghost?: Shot[] | null; ghostLabel?: string; tracks: Track[]; w?: number; h?: number }

export default function HoleMap({ course, hole, ghost, ghostLabel, tracks, w = 390, h = 560 }: Props) {
  const g = useMemo(() => {
    const o = hole.tee, gm = toM(hole.green, o), ang = Math.atan2(gm[0], gm[1])
    const c = Math.cos(ang), s = Math.sin(ang)
    const rot = (p: LL) => { const [x, y] = toM(p, o); return [x * c - y * s, x * s + y * c] as [number, number] }
    const path = holePath(hole), pr = path.map(rot)
    const L = Math.max(...pr.map(p => p[1]), 40), xs = pr.map(p => p[0])
    const pad = 40, top = 20, bot = 30
    const sc = Math.min((h - top - bot) / (L + 2 * pad), w / (Math.max(...xs) - Math.min(...xs) + 140))
    const cx = w / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * sc
    const P = (p: LL) => { const [x, y] = rot(p); return [cx + x * sc, h - bot - (y + pad) * sc] as [number, number] }
    const poly = (pts: LL[]) => pts.map(p => P(p).join(',')).join(' ')
    const inView = ([x, y]: [number, number]) => x > -20 && x < w + 20 && y > -20 && y < h + 20
    const real = course.geometry === 'osm'
    const label = course.mapLabel ?? (real ? 'OSM mapped' : 'schematic')
    const line = (pts: LL[]) => pts.map(p => P(p).join(',')).join(' ')
    // fairway: OSM polygons, else corridor along path (tee box -> ~short of green)
    const corridor = (wM = 42, inset = 25) => {
      const len = pathLen(path), steps = 24, L2: string[] = [], R: string[] = []
      for (let i = 0; i <= steps; i++) {
        const d = inset + (len - inset - 15) * (i / steps), a = P(along(path, d)), b = P(along(path, Math.min(d + 2, len)))
        let dx = b[0] - a[0], dy = b[1] - a[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n
        const hw = (wM / 2) * sc * (0.85 + 0.15 * Math.sin(i * 1.3))
        L2.push(`${a[0] - dy * hw},${a[1] + dx * hw}`); R.unshift(`${a[0] + dy * hw},${a[1] - dx * hw}`)
      }
      return [...L2, ...R].join(' ')
    }
    const fair = hole.features.fairways.length ? hole.features.fairways.map(poly) : (hole.par > 3 ? [corridor()] : [])
    const roughBand = [corridor(78, 8), corridor(58, 14)] // light first-cut rough banding around the playing line
    const rnd = (k: number) => { const x = Math.sin((hole.number * 977 + k) * 12.9898) * 43758.5453; return x - Math.floor(x) }
    // bunkers: OSM if present, else deterministic pads flanking the green (par-based count)
    const pads: [number, number, number, number][] = []
    if (!hole.features.bunkers.length) { const len = pathLen(path), gp = P(along(path, len)), pp = P(along(path, Math.max(0, len - 20)))
      let dx = gp[0] - pp[0], dy = gp[1] - pp[1]; const nn = Math.hypot(dx, dy) || 1; dx /= nn; dy /= nn
      const k = hole.par === 3 ? 3 : 2
      for (let i = 0; i < k; i++) { const side = i % 2 ? 1 : -1, back = i === 2 ? -22 : 6 + rnd(i) * 10, off = (20 + rnd(i + 5) * 6) * sc
        pads.push([gp[0] - dx * back * sc + -dy * side * off, gp[1] - dy * back * sc + dx * side * off, (7 + rnd(i + 9) * 4) * Math.max(sc, .6), Math.atan2(dy, dx) * 57.3]) }
      if (hole.par === 5) { const fp = P(along(path, len * 0.62)); pads.push([fp[0] + 30 * sc, fp[1], 8 * Math.max(sc, .6), 0]) } }
    const ex = course.extras
    const greenPoly = hole.features.green[0]?.length ? poly(hole.features.green[0]) : null
    const G = P(hole.green), T = P(hole.tee)
    // trees: real OSM trees in view + deterministic decorative trees outside the corridor
    const realTrees = course.trees.map(P).filter(inView)
    const deco: [number, number, number][] = []
    for (let i = 0; i < 130; i++) {
      const r = (k: number) => { const x = Math.sin((hole.number * 131 + i) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
      const side = r(1) < 0.5 ? -1 : 1, off = (44 + r(2) * 60) * sc
      const pt = P(along(path, r(3) * pathLen(path))), x = pt[0] + side * off, y = pt[1] + (r(4) - 0.5) * 30
      if (Math.hypot(x - G[0], y - G[1]) < 40 * sc + 14) continue
      deco.push([x, y, 7 + r(5) * 7])
    }
    // cart path: offset polyline on right side
    const cart = path.map((p, i) => { const a = P(p); return `${a[0] + 26 * sc + 14},${a[1] + (i === 0 ? 14 : 0)}` }).join(' ')
    // yardage markers measured back from green along path
    const len = pathLen(path)
    const markers = [100, 150, 200].map(yd => ({ yd, d: len - yd * M_PER_YD })).filter(m => m.d > 30).map(m => ({ ...m, p: P(along(path, m.d)) }))
    return { P, poly, fair, greenPoly, G, T, realTrees, deco, cart, markers, real, sc, label, line, roughBand, pads, ex }
  }, [course, hole, w, h])

  const line = (shots: Shot[], end?: LL | null) => [...shots.map(s => g.P([s.lon, s.lat])), ...(end ? [g.P(end)] : [])]
  const ghostPts = ghost?.length ? line(ghost, hole.green) : null
  const yd = (a: Shot, b: LL) => Math.round(distM([a.lon, a.lat], b) / M_PER_YD)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="holemap" role="img" aria-label={`Hole ${hole.number} map`}>
      <defs>
        <pattern id="stripe" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
          <rect width="22" height="22" fill="#7ccb68" /><rect width="22" height="11" fill="#6db95a" /></pattern>
        <pattern id="gstripe" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#9fe48f" /><rect width="8" height="4" fill="#92d882" /></pattern>
        <radialGradient id="rough" cx="50%" cy="50%" r="75%"><stop offset="0" stopColor="#3b7f3c" /><stop offset="1" stopColor="#285c2c" /></radialGradient>
        <filter id="sh"><feDropShadow dx="1.5" dy="2" stdDeviation="1.5" floodOpacity=".35" /></filter>
      </defs>
      <rect width={w} height={h} fill="url(#rough)" />
      {g.ex?.outline.map((p, i) => <polygon key={'ol' + i} points={g.poly(p)} fill="#3f8a40" opacity=".55" stroke="#9ad08a" strokeDasharray="6 4" strokeWidth="1.5" />)}
      {g.ex?.woods.map((p, i) => <polygon key={'xw' + i} points={g.poly(p)} fill="#1f4f28" opacity=".85" />)}
      {g.roughBand.map((p, i) => <polygon key={'rb' + i} points={p} fill={i ? '#5aa04b' : '#4a8f41'} opacity=".9" />)}
      {g.ex?.water.map((p, i) => <polygon key={'xa' + i} points={g.poly(p)} fill="#3d97d6" stroke="#2b7fb8" strokeWidth="2" />)}
      {g.ex?.streams.map((p, i) => <polyline key={'st' + i} points={g.line(p)} fill="none" stroke="#3d97d6" strokeWidth="4" strokeLinecap="round" />)}
      {g.ex?.cartpaths.map((p, i) => <polyline key={'cp' + i} points={g.line(p)} fill="none" stroke="#d6cfb9" strokeWidth="4" strokeLinecap="round" opacity=".8" />)}
      {hole.features.woods.map((p, i) => <polygon key={'wd' + i} points={g.poly(p)} fill="#1f4f28" opacity=".85" />)}
      {hole.features.water.map((p, i) => <polygon key={'wa' + i} points={g.poly(p)} fill="#3d97d6" stroke="#2b7fb8" strokeWidth="2" />)}
      <polyline points={g.cart} fill="none" stroke="#c9c3b0" strokeWidth="5" strokeLinecap="round" opacity=".85" />
      {g.fair.map((p, i) => <polygon key={'f' + i} points={p} fill="url(#stripe)" stroke="#5ea54d" strokeWidth="1.5" filter="url(#sh)" />)}
      {hole.features.tees.map((p, i) => <polygon key={'t' + i} points={g.poly(p)} fill="#8fd67c" stroke="#5fa04e" />)}
      <rect x={g.T[0] - 9} y={g.T[1] - 6} width="18" height="12" rx="3" fill="#8fd67c" stroke="#5fa04e" />
      {hole.features.bunkers.map((p, i) => <polygon key={'b' + i} points={g.poly(p)} fill="#f4e4b4" stroke="#d9c58a" />)}
      {g.pads.map(([x, y, r, a], i) => <ellipse key={'pd' + i} cx={x} cy={y} rx={r * 1.5} ry={r} transform={`rotate(${a} ${x} ${y})`} fill="#f4e4b4" stroke="#d9c58a" filter="url(#sh)" />)}
      {g.greenPoly ? <polygon points={g.greenPoly} fill="url(#gstripe)" stroke="#6fbf5f" strokeWidth="2" filter="url(#sh)" />
        : <ellipse cx={g.G[0]} cy={g.G[1]} rx={Math.max(14, 16 * g.sc)} ry={Math.max(11, 13 * g.sc)} fill="url(#gstripe)" stroke="#6fbf5f" strokeWidth="2" filter="url(#sh)" />}
      {g.deco.map(([x, y, r], i) => <g key={'dt' + i} filter="url(#sh)"><circle cx={x} cy={y} r={r} fill="#1e5a2a" /><circle cx={x - r * .3} cy={y - r * .3} r={r * .55} fill="#2f7a3a" /></g>)}
      {g.realTrees.map(([x, y], i) => <g key={'rt' + i} filter="url(#sh)"><circle cx={x} cy={y} r={8} fill="#1b5226" /><circle cx={x - 2.5} cy={y - 2.5} r={4.5} fill="#2e7a39" /></g>)}
      {g.markers.map(m => <g key={m.yd}><circle cx={m.p[0] - 34} cy={m.p[1]} r="7" fill={m.yd === 100 ? '#c0392b' : m.yd === 150 ? '#f2f2f2' : '#1f5fbf'} stroke="#fff" strokeWidth="1.5" />
        <text x={m.p[0] - 34} y={m.p[1] - 11} className="mk">{m.yd}</text></g>)}
      {/* flag */}
      <line x1={g.G[0]} y1={g.G[1]} x2={g.G[0]} y2={g.G[1] - 34} stroke="#fff" strokeWidth="2" />
      <path d={`M${g.G[0]},${g.G[1] - 34} l18,6 l-18,6z`} fill="#e23b3b" />
      <circle cx={g.G[0]} cy={g.G[1]} r="2.5" fill="#111" />
      {ghostPts && <g>
        <polyline points={ghostPts.map(p => p.join(',')).join(' ')} fill="none" stroke="#f5c542" strokeWidth="3" strokeDasharray="8 6" />
        {ghost!.map((s, i) => { const a = ghostPts[i], b = ghostPts[i + 1]; if (!b) return null
          const nxt: LL = ghost![i + 1] ? [ghost![i + 1].lon, ghost![i + 1].lat] : hole.green
          return <g key={'gl' + i}><circle cx={a[0]} cy={a[1]} r="4" fill="#f5c542" />
            {s.club !== 'Putter' && <text x={(a[0] + b[0]) / 2 + 10} y={(a[1] + b[1]) / 2} className="gl">{s.club} {yd(s, nxt)}y</text>}</g> })}
        <text x="10" y="18" className="gl">{ghostLabel} GHOST</text>
      </g>}
      {tracks.map((t, ti) => { const pts = line(t.shots); return <g key={'tr' + ti}>
        {pts.length > 1 && <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={t.color} strokeWidth="3" />}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 8 : 4} fill={t.color} stroke="#fff" strokeWidth="2" />)}
      </g> })}
      <text x={w - 8} y={h - 8} className="tag" textAnchor="end">{g.label}</text>
    </svg>
  )
}
