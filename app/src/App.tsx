import { useMemo, useState } from 'react'
import type { Course, GhostMode, Player, Profile, Round, Shot, LL, PositionSource } from './types'
import { loadProfile, saveProfile, loadCourses, addCourse, saveRound, ghostFor, roundScore, loadRounds, cloudLogin, sync, onSync, type SyncState } from './store'
import { useEffect } from 'react'
import { usable, MIN_SAMPLES } from './clubs'
import { setToken } from './api'
import { MpLobby, RoomPlay } from './Multiplayer'
import { CLUBS, simulateNext, distM, distYd } from './geo'
import HoleMap from './HoleMap'
import { nativePos } from './native'
import PlayButton from './PlayButton'
import ProSheet from './ProSheet'
import { isPro, userAddedCount } from './pro'

type Gate = (reason: string, fn: () => void, trialFirst?: boolean) => void
let proNow = isPro()

export const COLORS = ['#1e90ff', '#ff3b30', '#ffd60a', '#e040fb'] // high-contrast dots
type Screen = 'login' | 'courses' | 'add' | 'setup' | 'play' | 'summary' | 'mp' | 'room' | 'demo'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile())
  const [screen, setScreen] = useState<Screen>(profile ? 'courses' : 'login')
  const [course, setCourse] = useState<Course | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [mp, setMp] = useState<{ mode: 'host' | 'join'; ghostMode?: GhostMode; code?: string } | null>(null)
  const [pro, setPro] = useState(isPro()); proNow = pro
  const [sheet, setSheet] = useState<{ reason?: string; trial?: boolean; then?: () => void } | null>(null)
  const gate: Gate = (reason, fn, trial) => { if (isPro()) fn(); else setSheet({ reason, trial, then: fn }) }
  const [sy, setSy] = useState<SyncState>({ online: false })
  useEffect(() => { if (profile?.token) { setToken(profile.token); void sync() } return onSync(setSy) }, [])
  return <div className="phone">
    <div className={'syncdot ' + (sy.online ? 'on' : '')} title={sy.err ?? 'synced'}>{sy.online ? '☁ synced' : '⚠ ' + (sy.err ?? 'offline')}</div>
    {screen === 'login' && <Login onDone={async p => { const np = await cloudLogin(p.name, p.color); setProfile(np); setScreen('courses') }} initial={profile} />}
    {screen === 'courses' && profile && <Courses profile={profile} onPick={c => { setCourse(c); setScreen('setup') }} onAdd={() => userAddedCount() >= 1 ? gate('Free includes 1 added course. Pro adds unlimited courses.', () => setScreen('add')) : setScreen('add')} onProfile={() => setScreen('login')} onJoin={() => gate('Multiplayer rooms are Pro.', () => { setMp({ mode: 'join' }); setScreen('mp') })} onDemo={() => setScreen('demo')} />}
    {screen === 'demo' && <LaunchDemo onBack={() => setScreen(profile ? 'courses' : 'login')} />}
    {screen === 'add' && <AddCourse onDone={() => setScreen('courses')} />}
    {screen === 'setup' && course && profile && <Setup course={course} profile={profile} onBack={() => setScreen('courses')}
      gate={gate} onHost={g => gate('Hosting a room is Pro.', () => { setMp({ mode: 'host', ghostMode: g }); setScreen('mp') })} onStart={(players, ghostMode, startHole) => { setRound({ id: 'r-' + Date.now().toString(36), courseId: course.id, date: Date.now(), ghostMode, players, holes: {}, complete: false, startHole }); setScreen('play') }} />}
    {screen === 'mp' && mp && profile && <MpLobby profile={profile} course={course} mode={mp.mode} ghostMode={mp.ghostMode ?? 'best'} onBack={() => setScreen('courses')}
      onRoom={(code, c) => { setCourse(c); setMp({ ...mp, code }); setScreen('room') }} />}
    {screen === 'room' && mp?.code && course && profile && <RoomPlay code={mp.code} course={course} profile={profile}
      onFinish={r => { saveRound(r); setProfile(loadProfile()); setRound(r); setScreen('summary') }} />}
    {screen === 'play' && course && round && <Play course={course} round={round} learned={usable(profile?.clubAvgs)} onFinish={r => { const done = { ...r, complete: true, date: Date.now() }; saveRound(done); setProfile(loadProfile()); setRound(done); setScreen('summary') }} />}
    {screen === 'summary' && course && round && <Summary course={course} round={round} onHome={() => setScreen('courses')} onUnlock={() => gate('Unlock Best Ghost — see your gold line next time.', () => {}, true)} />}
    {sheet && <ProSheet reason={sheet.reason} trialFirst={sheet.trial} onClose={() => setSheet(null)} onUnlocked={() => { const t = sheet.then; setPro(true); proNow = true; setSheet(null); t?.() }} />}
  </div>
}

function Header({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  return <div className="hdr">{onBack && <button className="back" onClick={onBack}>‹</button>}<img src="/icon.png" className="logo" alt="" />
    <div><div className="ht">{title}{proNow && <span className="probadge">PRO</span>}</div>{sub && <div className="hs">{sub}</div>}</div></div>
}

function Login({ onDone, initial }: { onDone: (p: Profile) => void | Promise<void>; initial: Profile | null }) {
  const [name, setName] = useState(initial?.name ?? ''), [color, setColor] = useState(initial?.color ?? COLORS[0])
  return <div className="screen center">
    <img src="/icon.png" className="bigicon" alt="Putt Print" />
    <h1>Putt Print</h1><p className="muted">Stamp every shot. Chase your ghost.</p>
    <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoFocus />
    <div className="dots">{COLORS.map(c => <button key={c} className={'dot' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}</div>
    <button className="gold" disabled={!name.trim()} onClick={() => onDone({ name: name.trim(), color })}>Let's play</button>
  </div>
}

function Courses({ profile, onPick, onAdd, onProfile, onJoin, onDemo }: { profile: Profile; onPick: (c: Course) => void; onAdd: () => void; onProfile: () => void; onJoin: () => void; onDemo: () => void }) {
  const cs = loadCourses(), rounds = loadRounds()
  return <div className="screen">
    <Header title="Choose course" sub={`Hi ${profile.name}`} />
    <div className="tabs"><button className="tab on">Courses</button><button className="tab" onClick={onAdd}>+ Add course</button><button className="tab" onClick={onJoin}>Join room</button><button className="tab" onClick={onDemo}>Demo</button><button className="tab" onClick={onProfile}>Profile</button></div>
    <ClubCard profile={profile} />
    {cs.map(c => { const n = rounds.filter(r => r.courseId === c.id && r.complete).length
      return <button key={c.id} className="card" onClick={() => onPick(c)}>
        <div className="ct">{c.name}</div><div className="cs">{c.address || '—'}</div>
        <div className="cm"><span>{c.holeCount} holes · par {c.par}</span><span className={'badge ' + (c.geometry.startsWith('osm') ? 'real' : '')}>{c.mapLabel ?? (c.geometry === 'osm' ? 'OSM mapped' : 'schematic')}</span>{c.addedBy && <span className="badge">by {c.addedBy}</span>}{n > 0 && <span className="badge">{n} round{n > 1 ? 's' : ''}</span>}</div>
      </button> })}
  </div>
}

function AddCourse({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState(''), [loc, setLoc] = useState(''), [holes, setHoles] = useState(18), [ll, setLL] = useState<[number, number] | null>(null)
  return <div className="screen">
    <Header title="Add a course" sub="Shared with all players (syncs to cloud)" onBack={onDone} />
    <label>Course name<input value={name} onChange={e => setName(e.target.value)} /></label>
    <label>Location<input value={loc} placeholder="Town, State" onChange={e => setLoc(e.target.value)} /></label>
    <label>Holes<select value={holes} onChange={e => setHoles(+e.target.value)}><option>9</option><option>18</option></select></label>
    <button className="ghostbtn" onClick={() => navigator.geolocation?.getCurrentPosition(p => setLL([p.coords.latitude, p.coords.longitude]), () => alert('Location unavailable — course will be placed schematically.'))}>
      {ll ? `📍 ${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}` : 'Use my location as hole 1 tee (optional)'}</button>
    <p className="muted small">New courses start as schematic straight holes; mapping comes from shots logged there.</p>
    <button className="gold" disabled={!name.trim()} onClick={() => { addCourse(name.trim(), loc.trim(), holes, ll?.[0], ll?.[1]); onDone() }}>Save course</button>
  </div>
}

function Setup({ course, profile, onStart, onBack, onHost, gate }: { gate: Gate; course: Course; profile: Profile; onBack: () => void; onStart: (p: Player[], g: GhostMode, startHole: number) => void; onHost: (g: GhostMode) => void }) {
  const [mode, setMode] = useState<GhostMode>(proNow ? 'best' : 'last'), [n, setN] = useState(1), [start, setStart] = useState(1)
  const [names, setNames] = useState<string[]>([profile.name, 'Player 2', 'Player 3', 'Player 4'])
  const others = COLORS.filter(c => c !== profile.color), colors = [profile.color, ...others]
  const has = ghostFor(course, mode)
  return <div className="screen">
    <Header title={course.shortName} sub={`Par ${course.par} · ${course.holeCount} holes`} onBack={onBack} />
    <h3>Ghost</h3>
    <div className="seg">{(['last', 'best', 'perfect'] as GhostMode[]).map(m => <button key={m} className={m === mode ? 'on' : ''} onClick={() => m === 'last' ? setMode(m) : gate(`${m === 'best' ? 'Best' : 'Perfect'} ghost is Pro.`, () => setMode(m))}>{m.toUpperCase()}{m !== 'last' && !proNow && <span className="lock">🔒</span>}</button>)}</div>
    <p className="muted small">{has ? `${has.label} ghost ready (${Object.keys(has.holes).length} holes).` : 'No saved rounds here yet — play one to create your ghost.'}</p>
    <h3>Start on hole</h3>
    <select className="startsel" aria-label="Start hole" value={start} onChange={e => setStart(+e.target.value)} style={{ fontSize: 18, padding: 8, width: '100%' }}>{course.holes.map(h => <option key={h.number} value={h.number}>Hole {h.number} · Par {h.par}</option>)}</select>
    <h3>Players</h3>
    <div className="seg">{[1, 2, 3, 4].map(k => <button key={k} className={k === n ? 'on' : ''} onClick={() => k === 1 ? setN(k) : gate('Playing with friends is Pro — free is solo.', () => setN(k))}>{k === 1 ? 'Solo' : k}{k > 1 && !proNow && <span className="lock">🔒</span>}</button>)}</div>
    {Array.from({ length: n }, (_, i) => <div key={i} className="prow"><span className="pdot" style={{ background: colors[i] }} />
      <input value={names[i]} disabled={i === 0} onChange={e => setNames(names.map((x, j) => j === i ? e.target.value : x))} /></div>)}
    <p className="muted small">{n > 1 ? 'Pass-the-phone: one device, turn-based.' : 'Solo round.'} Friends on their own phones? Host a room instead.</p>
    <button className="ghostbtn" onClick={() => onHost(mode)}>📡 Host room (each phone syncs)</button>
    <button className="gold" onClick={() => onStart(Array.from({ length: n }, (_, i) => ({ name: names[i] || `P${i + 1}`, color: colors[i] })), mode, start)}>Tee off{start > 1 ? ` on ${start}` : ''}</button>
  </div>
}

async function getPos(): Promise<LL | null> {
  const nat = await nativePos(); if (nat !== undefined) return nat
  return new Promise(res => {
    if (!navigator.geolocation) return res(null)
    navigator.geolocation.getCurrentPosition(p => res([p.coords.longitude, p.coords.latitude]), () => res(null), { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 })
  })
}
export { getPos }

function Play({ course, round, onFinish, learned }: { course: Course; round: Round; onFinish: (r: Round) => void; learned?: Record<string, number> }) {
  const H = course.holes.length, s0 = Math.min(Math.max((round.startHole ?? 1) - 1, 0), H - 1)
  const [hi, setHi] = useState(s0), [count, setCount] = useState(1)
  const [r, setR] = useState(round)
  const np = r.players.length
  const [shots, setShots] = useState<Shot[][]>(() => r.players.map(() => []))
  const [out, setOut] = useState<boolean[]>(() => r.players.map(() => false))
  const [cur, setCur] = useState(0)
  const [pending, setPending] = useState<Shot | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [simMode, setSimMode] = useState(false)
  const hole = course.holes[hi]
  const ghost = useMemo(() => ghostFor(course, r.ghostMode), [course, r.ghostMode])
  const gh = ghost?.holes[hole.number]
  const teeName = course.tees.includes('White') ? 'White' : course.tees[0]
  const yards = hole.yards[teeName] ?? Object.values(hole.yards)[0]
  const my = shots[cur], last = my[my.length - 1]
  const lie: LL | null = pending ? [pending.lon, pending.lat] : last ? [last.lon, last.lat] : null
  const toPin = lie ? Math.round(distYd(lie, hole.green)) : yards
  const onGreen = lie ? distYd(lie, hole.green) < 25 : false

  async function stamp() {
    setBusy(true)
    let p: LL | null = null, src: PositionSource = 'simulated'
    if (!simMode) {
      p = await getPos()
      if (p && distM(p, hole.green) > 1500) { src = 'simulated-far'; p = null } else if (p) src = 'gps'
      if (!p) setNote(src === 'simulated-far' ? 'You are not at this course — simulating shot position.' : 'GPS unavailable — simulating shot position.')
      else setNote('GPS stamped ✓')
    }
    if (!p) p = last ? simulateNext(hole, [last.lon, last.lat], last.club, Date.now() % 1000 + my.length, learned) : hole.tee
    setPending({ hole: hole.number, shotIndex: my.length, lon: p[0], lat: p[1], club: '', positionSource: src, ts: Date.now() })
    setBusy(false)
  }
  function pickClub(club: string) {
    if (!pending) return
    const ns = shots.map((s, i) => i === cur ? [...s, { ...pending, club }] : s)
    setShots(ns); setPending(null)
    if (np > 1) nextPlayer(out)
  }
  function nextPlayer(o: boolean[]) {
    for (let k = 1; k <= np; k++) { const j = (cur + k) % np; if (!o[j]) { setCur(j); return } }
  }
  function holeOut() {
    if (!my.length) return
    const o = out.map((x, i) => i === cur ? true : x); setOut(o)
    if (o.every(Boolean)) {
      const res = shots.map(s => ({ shots: s, score: s.length }))
      const nr = { ...r, holes: { ...r.holes, [hole.number]: res } }; setR(nr); saveRound({ ...nr })
    } else nextPlayer(o)
  }
  function nextHole() {
    if (count >= H) return onFinish(r)
    setHi((hi + 1) % H); setCount(count + 1); setShots(r.players.map(() => [])); setOut(r.players.map(() => false)); setCur(0); setNote('')
  }
  const allOut = out.every(Boolean)
  const tracks = r.players.map((p, i) => ({ color: p.color, shots: i === cur && pending ? [...shots[i], pending] : shots[i] }))
  const clubs = onGreen ? ['Putter', 'LW', 'SW'] : CLUBS.map(c => c[0])
  const played = Object.keys(r.holes).length

  return <div className="screen play">
    <div className="playhdr">
      <div><div className="hn">HOLE {hole.number}</div><div className="hm">PAR {hole.par} · {yards} YDS · HCP {hole.handicap ?? '–'}</div></div>
      <div className={'pill ' + (gh ? 'on' : '')}>{ghost?.label ?? r.ghostMode.toUpperCase()} GHOST {gh ? 'ON' : 'OFF'}</div>
    </div>
    <div className="pbar">{r.players.map((p, i) => <span key={i} className={'pchip' + (i === cur && !allOut ? ' cur' : '')}><i style={{ background: p.color }} />{p.name} {shots[i].length}{out[i] ? ' ✓' : ''}</span>)}</div>
    <div className="mapwrap"><HoleMap course={course} hole={hole} ghost={gh?.shots} ghostLabel={ghost?.label} tracks={tracks} />
      <div className="topin">{toPin}<small>yds to pin</small></div>
      {gh && <div className="ghostscore">Ghost: {gh.score}</div>}
    </div>
    {note && <div className="note">{note}</div>}
    {allOut ? <div className="done">
        <div className="big">Hole {hole.number} complete</div>
        {r.players.map((p, i) => <div key={i}><i className="pdot" style={{ background: p.color }} /> {p.name}: {shots[i].length} ({fmt(shots[i].length - hole.par)}){i === 0 && gh ? ` · ghost ${gh.score}` : ''}</div>)}
        <button className="gold" onClick={nextHole}>{count >= H ? 'Finish round' : `Next: hole ${course.holes[(hi + 1) % H].number} ›`}</button>
        {count < H && <button className="link" onClick={() => onFinish(r)}>Finish round now ({played} hole{played > 1 ? 's' : ''})</button>}
      </div>
      : pending ? <div className="clubs"><div className="cl">Shot {pending.shotIndex + 1} stamped ({pending.positionSource}) — pick club</div>
          <div className="crow">{clubs.map(c => <button key={c} onClick={() => pickClub(c)} className="club">{c}{learned?.[c] ? <small className="avg">your avg {learned[c]}</small> : null}</button>)}</div>
          <button className="link" onClick={() => setPending(null)}>Cancel stamp</button></div>
      : <div className="controls">
          <PlayButton onClick={stamp} disabled={busy} sub={busy ? 'locating…' : my.length ? `shot ${my.length + 1} · tap to stamp` : 'tap on tee to stamp'} />
          <div className="side">
            <button className="ghostbtn" disabled={!my.length} onClick={holeOut}>⛳ Hole out ({my.length})</button>
            <label className="small"><input type="checkbox" checked={simMode} onChange={e => setSimMode(e.target.checked)} /> Simulate GPS</label>
            {np > 1 && <div className="small muted">Up: {r.players[cur].name}</div>}
          </div>
        </div>}
  </div>
}
const fmt = (d: number) => d === 0 ? 'E' : d > 0 ? '+' + d : '' + d

function Summary({ course, round, onHome, onUnlock }: { course: Course; round: Round; onHome: () => void; onUnlock: () => void }) {
  const nums = Object.keys(round.holes).map(Number).sort((a, b) => a - b)
  const par = nums.reduce((s, n) => s + course.holes[n - 1].par, 0)
  const prior = loadRounds().filter(x => x.courseId === course.id && x.complete && x.id !== round.id)
  const g = ghostFor(course, round.ghostMode, round.id) // ghost from rounds BEFORE this one
  return <div className="screen">
    <Header title="Round complete" sub={`${course.shortName} · ${nums.length} holes`} />
    <table className="sc"><thead><tr><th>Hole</th><th>Par</th>{round.players.map((p, i) => <th key={i} style={{ color: p.color }}>{p.name}</th>)}<th>Ghost</th></tr></thead>
      <tbody>{nums.map(n => { const gs = prior.length ? g?.holes[n]?.score : undefined
        return <tr key={n}><td>{n}</td><td>{course.holes[n - 1].par}</td>{round.players.map((_, i) => <td key={i}>{round.holes[n][i]?.score}</td>)}<td className="gold-t">{gs ?? '–'}</td></tr> })}
        <tr className="tot"><td>Tot</td><td>{par}</td>{round.players.map((_, i) => <td key={i}>{roundScore(round, i)} ({fmt(roundScore(round, i) - par)})</td>)}<td className="gold-t">{prior.length ? nums.reduce((s, n) => s + (g?.holes[n]?.score ?? 0), 0) : '–'}</td></tr></tbody></table>
    {!proNow && <button className="probanner" onClick={onUnlock}>👻 Unlock Best Ghost — Try Pro free 7 days</button>}
    <p className="muted small">Saved. Your Last / Best / Perfect ghosts on {course.shortName} now include this round.</p>
    <button className="gold" onClick={onHome}>Done</button>
  </div>
}

function ClubCard({ profile }: { profile: Profile }) {
  const a = Object.entries(profile.clubAvgs ?? {}).sort((x, y) => y[1].yd - x[1].yd)
  if (!a.length) return <p className="muted small">Club distances: play a round — after {MIN_SAMPLES}+ shots with a club, Putt Print uses your average.</p>
  return <div className="clubcard"><b>Your club averages</b><div>{a.map(([c, v]) => <span key={c} className={'badge ' + (v.n >= MIN_SAMPLES ? 'real' : '')}>{c} {v.yd}y ({v.n})</span>)}</div></div>
}

const DEMO_SLIDES: { src: string; title: string; body: string }[] = [
  { src: '/demo/01_icon.png', title: 'Putt Print', body: 'Stamp every shot. Chase your ghost.' },
  { src: '/demo/02_login.png', title: 'Login', body: 'Name + colour, synced to the cloud.' },
  { src: '/demo/03_courses.png', title: 'Courses', body: 'Shared course list — OSM-mapped or schematic, add your own.' },
  { src: '/demo/04_setup.png', title: 'Setup', body: 'Pick LAST / BEST / PERFECT ghost and 1–4 players.' },
  { src: '/demo/05_hole_play.png', title: 'Hole play', body: 'BEST GHOST ON — gold ghost line, tap the ball to stamp each shot.' },
  { src: '/demo/06_multiplayer.png', title: 'Multiplayer', body: 'Host a room; friends join with the code on their own phones.' },
  { src: '/demo/07_learned_clubs.png', title: 'Learned clubs', body: 'After 3+ shots, the picker shows your real average per club.' },
  { src: '/demo/08_scorecard.png', title: 'Scorecard', body: 'Your round vs the ghost — saved to build next time\'s ghost.' },
]

function LaunchDemo({ onBack }: { onBack: () => void }) {
  const [k, setK] = useState(0)
  const s = DEMO_SLIDES[k]
  return <div className="screen demo">
    <Header title="Launch demo" sub={`${k + 1} / ${DEMO_SLIDES.length}`} onBack={onBack} />
    <div className="demotitle">{s.title}</div>
    <p className="muted demobody">{s.body}</p>
    <div className="demoframe"><img src={s.src} alt={s.title} /></div>
    <div className="demnav">
      <button className="ghostbtn" disabled={k === 0} onClick={() => setK(k - 1)}>‹ Prev</button>
      <button className="gold" onClick={() => k + 1 < DEMO_SLIDES.length ? setK(k + 1) : onBack()}>{k + 1 < DEMO_SLIDES.length ? 'Next ›' : 'Done'}</button>
    </div>
  </div>
}

