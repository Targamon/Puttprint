import Fastify from 'fastify'
import cors from '@fastify/cors'
import fstatic from '@fastify/static'
import { createClient } from '@libsql/client'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR ?? join(here, '../data')
mkdirSync(DATA_DIR, { recursive: true })
const db = createClient({ url: process.env.DB_URL ?? 'file:' + join(DATA_DIR, 'puttprint.db') })
// Built SPA (app/dist). In Docker it's copied to server/public/app.
const APP_DIST = process.env.APP_DIST ?? [join(here, '../public/app'), join(here, '../../app/dist')].find(d => existsSync(join(d, 'index.html')))
const SEED_FILE = process.env.SEED_FILE ?? join(here, '../../app/src/data/courses.json')
const PORT = +(process.env.PORT ?? 8787)

await db.batch([
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, token TEXT UNIQUE, club_avgs TEXT DEFAULT '{}', created INTEGER)`,
  `CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY, data TEXT NOT NULL, owner TEXT, seeded INTEGER DEFAULT 0, created INTEGER)`,
  `CREATE TABLE IF NOT EXISTS rounds(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER)`,
  `CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER)`,
], 'write')

// Seed / refresh the 4 bundled courses from the app's data file
const seed = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as any[]
for (const c of seed) await db.execute({ sql: `INSERT INTO courses(id,data,seeded,created) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`, args: [c.id, JSON.stringify(c), Date.now()] })

// The web app calls the API under /api/* (same origin); strip it so routes work both at / and /api.
const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024, trustProxy: true,
  rewriteUrl: req => { const u = req.url ?? '/'; return u === '/api' ? '/' : u.startsWith('/api/') ? u.slice(4) : u } })
const CORS = process.env.CORS_ORIGIN
await app.register(cors, { origin: CORS ? CORS.split(',').map(s => s.trim()) : true })
await app.register(fstatic, { root: join(here, '../public'), prefix: '/static/' })
if (APP_DIST) {
  await app.register(fstatic, { root: APP_DIST, prefix: '/', decorateReply: false, index: ['index.html'] })
  const indexHtml = readFileSync(join(APP_DIST, 'index.html'))
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && (req.headers.accept ?? '').includes('text/html')) return reply.type('text/html').send(indexHtml)
    reply.code(404).send({ error: 'not found' })
  })
}

async function auth(req: any) {
  const h = (req.headers.authorization ?? '') as string
  const tok = h.startsWith('Bearer ') ? h.slice(7) : (req.body as any)?.token
  if (!tok) return null
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE token=?', args: [tok] })
  return r.rows[0] ? { id: String(r.rows[0].id), name: String(r.rows[0].name), color: String(r.rows[0].color), clubAvgs: JSON.parse(String(r.rows[0].club_avgs || '{}')) } : null
}
const need = async (req: any, reply: any) => { const u = await auth(req); if (!u) reply.code(401).send({ error: 'login required' }); return u }

app.get('/health', async () => ({ ok: true, service: 'puttprint-api' }))
app.get('/privacy', (_q, r) => r.type('text/html').sendFile('privacy.html'))
app.get('/support', (_q, r) => r.type('text/html').sendFile('support.html'))
app.get('/icon-1024.png', (_q, r) => r.sendFile('icon-1024.png'))

// Login-by-name: same name (case-insensitive) returns the same account + a fresh-or-existing token.
app.post('/auth/login', async (req, reply) => {
  const { name, color } = (req.body ?? {}) as { name?: string; color?: string }
  if (!name?.trim()) return reply.code(400).send({ error: 'name required' })
  const ex = await db.execute({ sql: 'SELECT * FROM users WHERE lower(name)=lower(?)', args: [name.trim()] })
  if (ex.rows[0]) {
    const u = ex.rows[0]
    if (color && color !== u.color) await db.execute({ sql: 'UPDATE users SET color=? WHERE id=?', args: [color, u.id] })
    return { token: u.token, userId: u.id, name: u.name, color: color ?? u.color, clubAvgs: JSON.parse(String(u.club_avgs || '{}')) }
  }
  const id = 'u_' + randomUUID().slice(0, 8), token = randomBytes(18).toString('hex'), c = color ?? '#1e90ff'
  await db.execute({ sql: 'INSERT INTO users(id,name,color,token,created) VALUES(?,?,?,?,?)', args: [id, name.trim(), c, token, Date.now()] })
  return { token, userId: id, name: name.trim(), color: c, clubAvgs: {} }
})
app.get('/me', async (req, reply) => { const u = await need(req, reply); return u && u })
app.put('/me/club-avgs', async (req, reply) => {
  const u = await need(req, reply); if (!u) return
  await db.execute({ sql: 'UPDATE users SET club_avgs=? WHERE id=?', args: [JSON.stringify((req.body as any)?.clubAvgs ?? {}), u.id] })
  return { ok: true }
})

app.get('/courses', async () => (await db.execute('SELECT data FROM courses ORDER BY seeded DESC, created')).rows.map(r => JSON.parse(String(r.data))))
app.post('/courses', async (req, reply) => {
  const u = await need(req, reply); if (!u) return
  const c = req.body as any
  if (!c?.id || !c?.name || !Array.isArray(c.holes)) return reply.code(400).send({ error: 'course {id,name,holes[]} required' })
  c.seeded = false; c.addedBy = u.name
  await db.execute({ sql: 'INSERT INTO courses(id,data,owner,created) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING', args: [c.id, JSON.stringify(c), u.id, Date.now()] })
  return c
})

app.get('/rounds', async (req, reply) => {
  const u = await need(req, reply); if (!u) return
  return (await db.execute({ sql: 'SELECT data FROM rounds WHERE user_id=? ORDER BY updated', args: [u.id] })).rows.map(r => JSON.parse(String(r.data)))
})
app.post('/rounds', async (req, reply) => {
  const u = await need(req, reply); if (!u) return
  const b = req.body as any, list = Array.isArray(b) ? b : Array.isArray(b?.rounds) ? b.rounds : [b]
  for (const r of list) if (r?.id) await db.execute({ sql: 'INSERT INTO rounds(id,user_id,data,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated=excluded.updated WHERE rounds.user_id=excluded.user_id', args: [r.id, u.id, JSON.stringify(r), Date.now()] })
  return { ok: true, count: list.length }
})

// ---------- Multiplayer rooms ----------
type RShot = { hole: number; shotIndex: number; lat: number; lon: number; club: string; positionSource: string; ts: number }
interface Room { code: string; courseId: string; ghostMode: string; maxPlayers: number; hostId: string; holeIndex: number; status: 'lobby' | 'playing' | 'finished'
  players: { userId: string; name: string; color: string }[]; shots: Record<string, Record<string, RShot[]>>; out: Record<string, Record<string, boolean>>; updated: number }
const getRoom = async (code: string) => { const r = await db.execute({ sql: 'SELECT data FROM rooms WHERE code=?', args: [code.toUpperCase()] }); return r.rows[0] ? JSON.parse(String(r.rows[0].data)) as Room : null }
const putRoom = async (r: Room) => { r.updated = Date.now(); await db.execute({ sql: 'INSERT INTO rooms(code,data,updated) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data, updated=excluded.updated', args: [r.code, JSON.stringify(r), r.updated] }); return r }
const PALETTE = ['#1e90ff', '#ff3b30', '#ffd60a', '#e040fb', '#34c759', '#ff9f0a', '#5ac8fa', '#ffffff']
function colorFor(r: Room, want: string) { const used = new Set(r.players.map(p => p.color)); return !used.has(want) ? want : PALETTE.find(c => !used.has(c)) ?? want }

app.post('/rooms', async (req, reply) => {
  const u = await need(req, reply); if (!u) return
  const { courseId, ghostMode = 'best', maxPlayers = 4 } = (req.body ?? {}) as any
  if (!courseId) return reply.code(400).send({ error: 'courseId required' })
  let code = ''
  do code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join(''); while (await getRoom(code))
  const room: Room = { code, courseId, ghostMode, maxPlayers: Math.min(Math.max(+maxPlayers || 4, 1), 8), hostId: u.id, holeIndex: 0, status: 'playing',
    players: [{ userId: u.id, name: u.name, color: u.color }], shots: {}, out: {}, updated: 0 }
  await putRoom(room); return { code, room }
})
app.post('/rooms/:code/join', async (req, reply) => {
  const u = await need(req, reply); if (!u) return
  const r = await getRoom((req.params as any).code); if (!r) return reply.code(404).send({ error: 'room not found' })
  if (!r.players.some(p => p.userId === u.id)) {
    if (r.players.length >= r.maxPlayers) return reply.code(409).send({ error: 'room full' })
    r.players.push({ userId: u.id, name: u.name, color: colorFor(r, u.color) }); await putRoom(r)
  }
  return r
})
app.get('/rooms/:code', async (req, reply) => { const r = await getRoom((req.params as any).code); return r ?? reply.code(404).send({ error: 'room not found' }) })
// SSE stream (optional; client polls by default)
app.get('/rooms/:code/events', async (req, reply) => {
  const code = (req.params as any).code; let last = 0
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' })
  const t = setInterval(async () => { const r = await getRoom(code); if (r && r.updated !== last) { last = r.updated; reply.raw.write(`data: ${JSON.stringify(r)}\n\n`) } }, 1000)
  req.raw.on('close', () => clearInterval(t))
})
async function member(req: any, reply: any) {
  const u = await need(req, reply); if (!u) return null
  const r = await getRoom(req.params.code); if (!r) { reply.code(404).send({ error: 'room not found' }); return null }
  if (!r.players.some(p => p.userId === u.id)) { reply.code(403).send({ error: 'join first' }); return null }
  return { u, r, hk: String(r.holeIndex) }
}
app.post('/rooms/:code/shot', async (req, reply) => {
  const m = await member(req, reply); if (!m) return
  const { u, r, hk } = m, s = req.body as any
  if (r.status === 'finished') return reply.code(409).send({ error: 'round finished' })
  if (typeof s?.lat !== 'number' || typeof s?.lon !== 'number') return reply.code(400).send({ error: 'lat/lon required' })
  r.shots[hk] ??= {}; const mine = (r.shots[hk][u.id] ??= [])
  if (r.out[hk]?.[u.id]) return reply.code(409).send({ error: 'already holed out' })
  mine.push({ hole: r.holeIndex + 1, shotIndex: mine.length, lat: s.lat, lon: s.lon, club: s.club ?? '', positionSource: s.positionSource ?? 'gps', ts: Date.now() })
  return putRoom(r)
})
app.post('/rooms/:code/undo', async (req, reply) => { const m = await member(req, reply); if (!m) return; m.r.shots[m.hk]?.[m.u.id]?.pop(); return putRoom(m.r) })
app.post('/rooms/:code/hole-out', async (req, reply) => {
  const m = await member(req, reply); if (!m) return
  if (!m.r.shots[m.hk]?.[m.u.id]?.length) return reply.code(409).send({ error: 'no shots this hole' })
  ;(m.r.out[m.hk] ??= {})[m.u.id] = true; return putRoom(m.r)
})
app.post('/rooms/:code/advance', async (req, reply) => {
  const m = await member(req, reply); if (!m) return
  const holes = JSON.parse(String((await db.execute({ sql: 'SELECT data FROM courses WHERE id=?', args: [m.r.courseId] })).rows[0]?.data ?? '{"holes":[]}')).holes.length || 18
  if (m.r.holeIndex + 1 >= holes) m.r.status = 'finished'; else m.r.holeIndex++
  return putRoom(m.r)
})
app.post('/rooms/:code/finish', async (req, reply) => { const m = await member(req, reply); if (!m) return; m.r.status = 'finished'; return putRoom(m.r) })

await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`Putt Print on http://localhost:${PORT}` + (APP_DIST ? ` (web app from ${APP_DIST})` : ' (API only, no app build found)'))
