import { useEffect, useMemo, useRef, useState } from 'react'
import type { Course, GhostMode, LL, Profile, Round, Shot, PositionSource, HoleResult } from './types'
import { api, setToken } from './api'
import { loadCourses, sync, ghostFor } from './store'
import { CLUBS, distM, distYd, simulateNext } from './geo'
import { usable } from './clubs'
import HoleMap from './HoleMap'
import PlayButton from './PlayButton'
import { getPos } from './App'

export interface RoomState { code: string; courseId: string; ghostMode: GhostMode; maxPlayers: number; hostId: string; holeIndex: number; status: string
  players: { userId: string; name: string; color: string }[]; shots: Record<string, Record<string, Shot[]>>; out: Record<string, Record<string, boolean>>; updated: number }

function useRoom(code: string, ms = 1500) {
  const [room, setRoom] = useState<RoomState | null>(null), [err, setErr] = useState('')
  const refresh = async () => { try { setRoom(await api<RoomState>('/rooms/' + code)); setErr('') } catch (e: any) { setErr(e.message || 'offline') } }
  useEffect(() => { void refresh(); const t = setInterval(refresh, ms); return () => clearInterval(t) }, [code])
  return { room, setRoom, err, refresh }
}

export function MpLobby({ profile, course, mode, ghostMode, onBack, onRoom }: { profile: Profile; course: Course | null; mode: 'host' | 'join'; ghostMode: GhostMode
  onBack: () => void; onRoom: (code: string, c: Course) => void }) {
  const [code, setCode] = useState(''), [err, setErr] = useState(''), [hosted, setHosted] = useState<string | null>(null), [maxP, setMaxP] = useState(4)
  if (profile.token) setToken(profile.token)
  async function host() {
    try { const r = await api<{ code: string }>('/rooms', { body: { courseId: course!.id, ghostMode, maxPlayers: maxP } }); setHosted(r.code) } catch (e: any) { setErr(e.message) }
  }
  async function join() {
    try {
      const r = await api<RoomState>(`/rooms/${code.toUpperCase()}/join`, { body: { token: profile.token } })
      let c = loadCourses().find(x => x.id === r.courseId); if (!c) { await sync(); c = loadCourses().find(x => x.id === r.courseId) }
      if (!c) return setErr('Course not on this device yet — check connection.')
      onRoom(r.code, c)
    } catch (e: any) { setErr(e.message) }
  }
  if (!profile.token) return <div className="screen center"><h2>Play with friends</h2>
    <p className="muted">Room play needs the Putt Print server. Log in again while online (Profile → Let's play).</p><button className="gold" onClick={onBack}>Back</button></div>
  return <div className="screen">
    <div className="hdr"><button className="back" onClick={onBack}>‹</button><img src="/icon.png" className="logo" alt="" /><div><div className="ht">{mode === 'host' ? 'Host a room' : 'Join a room'}</div>
      <div className="hs">{mode === 'host' ? course?.shortName + ' · ' + ghostMode.toUpperCase() + ' ghost' : 'Enter the 4-letter code'}</div></div></div>
    {mode === 'host' ? hosted ? <HostWait code={hosted} onStart={() => onRoom(hosted, course!)} />
      : <><h3>Max players</h3><div className="seg">{[2, 3, 4, 6, 8].map(k => <button key={k} className={k === maxP ? 'on' : ''} onClick={() => setMaxP(k)}>{k}</button>)}</div>
        <p className="muted small">Each friend uses their own phone and login. Dots sync live.</p><button className="gold" onClick={host}>Create room</button></>
      : <><input className="codein" maxLength={4} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCD" autoFocus />
        <button className="gold" disabled={code.length !== 4} onClick={join}>Join</button></>}
    {err && <div className="note">{err}</div>}
  </div>
}
function HostWait({ code, onStart }: { code: string; onStart: () => void }) {
  const { room } = useRoom(code)
  return <><p className="muted small" style={{ textAlign: 'center' }}>Share this code</p><div className="roomcode" data-testid="roomcode">{code}</div>
    <h3>In the room</h3>{room?.players.map(p => <div key={p.userId} className="prow"><span className="pdot" style={{ background: p.color }} />{p.name}</div>)}
    <button className="gold" onClick={onStart}>Tee off ({room?.players.length ?? 1} player{(room?.players.length ?? 1) > 1 ? 's' : ''})</button></>
}

export function RoomPlay({ code, course, profile, onFinish }: { code: string; course: Course; profile: Profile; onFinish: (r: Round) => void }) {
  const { room, setRoom, err } = useRoom(code)
  const [pending, setPending] = useState<Shot | null>(null), [busy, setBusy] = useState(false), [simMode, setSimMode] = useState(false), [note, setNote] = useState('')
  const learned = usable(profile.clubAvgs), me = profile.userId!, done = useRef(false)
  const hi = room?.holeIndex ?? 0, hole = course.holes[hi], hk = String(hi)
  const ghost = useMemo(() => ghostFor(course, room?.ghostMode ?? 'best'), [course, room?.ghostMode]), gh = ghost?.holes[hole.number]
  const shotsOf = (uid: string) => room?.shots[hk]?.[uid] ?? []
  const my = shotsOf(me), last = my[my.length - 1], iamOut = !!room?.out[hk]?.[me]
  const allOut = !!room && room.players.every(p => room.out[hk]?.[p.userId])
  const lie: LL | null = pending ? [pending.lon, pending.lat] : last ? [last.lon, last.lat] : null
  const toPin = lie ? Math.round(distYd(lie, hole.green)) : (Object.values(hole.yards)[0] ?? 0)
  const onGreen = lie ? distYd(lie, hole.green) < 25 : false

  useEffect(() => { if (room?.status === 'finished' && !done.current) { done.current = true; onFinish(toRound(room, course, me)) } }, [room?.status])
  const post = async (path: string, body: unknown = {}) => { try { setRoom(await api<RoomState>(`/rooms/${code}/${path}`, { body })) } catch (e: any) { setNote(e.message) } }
  async function stamp() {
    setBusy(true); let p: LL | null = null, src: PositionSource = 'simulated'
    if (!simMode) { p = await getPos(); if (p && distM(p, hole.green) > 1500) { src = 'simulated-far'; p = null } else if (p) src = 'gps'
      setNote(p ? 'GPS stamped ✓' : 'GPS unavailable / not at course — simulating.') }
    if (!p) p = last ? simulateNext(hole, [last.lon, last.lat], last.club, Date.now() % 1000 + my.length, learned) : hole.tee
    setPending({ hole: hole.number, shotIndex: my.length, lon: p[0], lat: p[1], club: '', positionSource: src, ts: Date.now() }); setBusy(false)
  }
  async function pick(club: string) { if (!pending) return; const s = { ...pending, club }; setPending(null); await post('shot', s) }
  if (!room) return <div className="screen center"><p>Connecting to room {code}…</p>{err && <p className="note">{err}</p>}</div>
  const tracks = room.players.map(p => ({ color: p.color, shots: p.userId === me && pending ? [...shotsOf(p.userId), pending] : shotsOf(p.userId) }))
  const clubs = onGreen ? ['Putter', 'LW', 'SW'] : CLUBS.map(c => c[0])
  return <div className="screen play">
    <div className="playhdr"><div><div className="hn">HOLE {hole.number}</div><div className="hm">PAR {hole.par} · ROOM {code}</div></div>
      <div className={'pill ' + (gh ? 'on' : '')}>{ghost?.label ?? room.ghostMode.toUpperCase()} GHOST {gh ? 'ON' : 'OFF'}</div></div>
    <div className="pbar" data-testid="pbar">{room.players.map(p => <span key={p.userId} className={'pchip' + (p.userId === me ? ' cur' : '')}><i style={{ background: p.color }} />{p.name} {shotsOf(p.userId).length}{room.out[hk]?.[p.userId] ? ' ✓' : ''}</span>)}</div>
    <div className="mapwrap"><HoleMap course={course} hole={hole} ghost={gh?.shots} ghostLabel={ghost?.label} tracks={tracks} />
      <div className="topin">{toPin}<small>yds to pin</small></div>{gh && <div className="ghostscore">Ghost: {gh.score}</div>}</div>
    {(note || err) && <div className="note">{err ? 'Reconnecting… ' + err : note}</div>}
    {allOut ? <div className="done"><div className="big">Hole {hole.number} complete</div>
        {room.players.map(p => <div key={p.userId}><i className="pdot" style={{ background: p.color }} /> {p.name}: {shotsOf(p.userId).length}</div>)}
        <button className="gold" onClick={() => post('advance')}>{hi + 1 >= course.holes.length ? 'Finish round' : `Next: hole ${hole.number + 1} ›`}</button>
        <button className="link" onClick={() => post('finish')}>Finish round now</button></div>
      : iamOut ? <div className="done"><div className="big">You holed out in {my.length}</div><p className="muted small">Waiting for {room.players.filter(p => !room.out[hk]?.[p.userId]).map(p => p.name).join(', ')}…</p></div>
      : pending ? <div className="clubs"><div className="cl">Shot {pending.shotIndex + 1} stamped ({pending.positionSource}) — pick club</div>
          <div className="crow">{clubs.map(c => <button key={c} onClick={() => pick(c)} className="club">{c}{learned[c] ? <small className="avg">your avg {learned[c]}</small> : null}</button>)}</div>
          <button className="link" onClick={() => setPending(null)}>Cancel stamp</button></div>
      : <div className="controls"><PlayButton onClick={stamp} disabled={busy} sub={busy ? 'locating…' : my.length ? `shot ${my.length + 1} · tap to stamp` : 'tap on tee to stamp'} />
          <div className="side"><button className="ghostbtn" disabled={!my.length} onClick={() => post('hole-out')}>⛳ Hole out ({my.length})</button>
            <label className="small"><input type="checkbox" checked={simMode} onChange={e => setSimMode(e.target.checked)} /> Simulate GPS</label>
            {my.length > 0 && <button className="link" onClick={() => post('undo')}>Undo last</button>}</div></div>}
  </div>
}

/** Convert a finished room into a local Round with ME as player 0 (ghosts + club learning use player 0). */
export function toRound(room: RoomState, course: Course, me: string): Round {
  const order = [...room.players].sort((a, b) => (a.userId === me ? -1 : b.userId === me ? 1 : 0))
  const holes: Record<number, HoleResult[]> = {}
  for (const [hk, byUser] of Object.entries(room.shots)) {
    const n = +hk + 1; if (!course.holes[+hk]) continue
    if (!order.some(p => byUser[p.userId]?.length)) continue
    holes[n] = order.map(p => ({ shots: byUser[p.userId] ?? [], score: (byUser[p.userId] ?? []).length }))
  }
  return { id: `room-${room.code}-${me}`, courseId: room.courseId, date: Date.now(), ghostMode: room.ghostMode, players: order.map(p => ({ name: p.name, color: p.color })), holes, complete: true, roomCode: room.code }
}
