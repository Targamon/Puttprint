// E2E: multiplayer across two browser contexts, solo round -> club avgs, and map previews.
const { chromium } = require('/workspace/dolphin/node_modules/playwright')
const URL = process.env.APP_URL || 'http://localhost:5174', OUT = '/workspace/puttprint/demo/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function login(page, name) {
  await page.goto(URL); await page.fill('input[placeholder="Your name"]', name); await page.click('text=Let\'s play'); await page.waitForSelector('text=Choose course')
}
async function stamp(page, club) { await page.click('button.playbtn'); await page.click(`button.club:has-text("${club}")`); await sleep(300) }
;(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  const mk = async () => (await b.newContext({ viewport: { width: 420, height: 900 }, geolocation: { latitude: 0, longitude: 0 }, permissions: [] })).newPage()
  const A = await mk(), B = await mk()
  await login(A, 'Geoff'); await login(B, 'Sam')
  console.log('sync badge A:', await A.textContent('.syncdot'))
  // --- multiplayer ---
  await A.click('text=Island Green'); await A.click('text=Host room'); await A.click('text=Create room')
  const code = (await A.textContent('[data-testid=roomcode]')).trim(); console.log('room code', code)
  await B.click('text=Join room'); await B.fill('input.codein', code); await B.click('button:has-text("Join")')
  await A.waitForSelector('.prow:has-text("Sam")'); await A.click('text=Tee off')
  for (const p of [A, B]) { await p.check('text=Simulate GPS') }
  await stamp(A, 'Driver'); await stamp(B, '3W'); await stamp(B, '7i')
  await sleep(2200)
  console.log('A sees:', await A.textContent('[data-testid=pbar]')); console.log('B sees:', await B.textContent('[data-testid=pbar]'))
  console.log('A dots on map:', await A.locator('svg.holemap circle[stroke="#fff"]').count())
  await A.screenshot({ path: OUT + 'screens/mp_hostA.png' }); await B.screenshot({ path: OUT + 'screens/mp_joinB.png' })
  await A.click('text=Hole out'); await B.click('text=Hole out'); await sleep(2000)
  console.log('A after hole-outs:', (await A.textContent('.done')).slice(0, 80))
  await A.click('text=Finish round now'); await sleep(2500)
  console.log('B after finish:', (await B.textContent('.screen')).slice(0, 60))
  // --- solo round for club learning (3 holes, Driver + 7i each) ---
  await A.goto(URL); await A.click('text=Thunderhart'); await A.click('text=Tee off'); await A.check('text=Simulate GPS')
  for (let h = 0; h < 3; h++) {
    await stamp(A, 'Driver'); await stamp(A, '7i'); await stamp(A, 'Putter'); await A.click('text=Hole out')
    if (h < 2) await A.click('text=Next: hole'); else await A.click('text=Finish round now')
  }
  await sleep(1500); await A.click('text=Done'); await A.waitForSelector('.clubcard')
  console.log('Club card:', await A.textContent('.clubcard'))
  console.log('profile.clubAvgs:', await A.evaluate(() => JSON.stringify(JSON.parse(localStorage['pp.profile']).clubAvgs)))
  await A.click('text=Thunderhart'); await A.click('text=Tee off'); await A.check('text=Simulate GPS'); await A.click('button.playbtn')
  console.log('club picker avg labels:', await A.locator('small.avg').allTextContents())
  await A.screenshot({ path: OUT + 'screens/clubs_learned.png' })
  // --- previews ---
  const P = await mk(); await login(P, 'Preview')
  for (const [id, name] of [['thunderhart', 'Thunderhart'], ['sunnyhill', 'Sunny Hill'], ['islandgreen', 'Island Green'], ['sycamore', 'Sycamore']]) {
    await P.goto(URL); await P.click(`.card:has-text("${name}")`); await P.click('text=Tee off'); await sleep(400)
    await P.locator('.mapwrap').screenshot({ path: OUT + `previews/${id}_hole1.png` })
  }
  // --- offline: block API, app still loads + plays ---
  const O = await mk(); await O.route('**/api/**', r => r.abort()); await login(O, 'Offline Olly')
  console.log('offline badge:', await O.textContent('.syncdot'), '| courses:', await O.locator('.card').count())
  await b.close()
})().catch(e => { console.error(e); process.exit(1) })
