const { chromium } = require('/workspace/dolphin/node_modules/playwright')
const URL = 'http://localhost:5174', OUT = '/workspace/puttprint/demo/launch/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  const mk = async () => (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, geolocation: { latitude: 0, longitude: 0 }, permissions: [] })).newPage()
  const shot = (p, n) => p.screenshot({ path: OUT + n })
  const stamp = async (p, c) => { await p.click('button.playbtn'); await p.click(`button.club:has-text("${c}")`); await sleep(300) }
  const I = await mk()
  await I.setContent(`<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(#1f5a37,#0b2416);font-family:system-ui;color:#fff"><img src="${URL}/icon.png" style="width:260px;border-radius:58px;box-shadow:0 12px 40px #000a"><h1 style="color:#e9c46a;margin:28px 0 6px">Putt Print</h1><p style="opacity:.85">Stamp every shot. Chase your ghost.</p></body>`)
  await sleep(500); await shot(I, '01_icon.png')
  const A = await mk(); await A.goto(URL); await sleep(600); await A.fill('input[placeholder="Your name"]', 'Geoff'); await shot(A, '02_login.png')
  // icon check
  console.log('login icon ok:', await A.evaluate(() => [...document.images].every(i => i.complete && i.naturalWidth > 0)))
  await A.click('text=Let\'s play'); await A.waitForSelector('text=Choose course'); await sleep(500); await shot(A, '03_courses.png')
  // seed round for ghost + clubs
  await A.click('text=Thunderhart'); await A.click('text=Tee off'); await A.check('text=Simulate GPS')
  for (let h = 0; h < 3; h++) { await stamp(A, 'Driver'); await stamp(A, '7i'); await stamp(A, 'Putter'); await A.click('text=Hole out')
    if (h < 2) await A.click('text=Next: hole'); else await A.click('text=Finish round now') }
  await sleep(1500); await shot(A, '08_scorecard.png')
  await A.click('text=Done'); await sleep(500)
  await A.click('text=Thunderhart'); await sleep(400); await shot(A, '04_setup.png')
  await A.click('text=Tee off'); await A.check('text=Simulate GPS'); await sleep(500)
  console.log('PLAY img ok:', await A.evaluate(() => { const i = document.querySelector('button.playbtn img'); return !!i && i.complete && i.naturalWidth > 0 }))
  await stamp(A, 'Driver'); await sleep(500); await shot(A, '05_hole_play.png')
  await A.click('button.playbtn'); await sleep(400); await shot(A, '07_learned_clubs.png')
  console.log('avgs:', await A.locator('small.avg').allTextContents())
  const M = await mk(); await M.goto(URL); await M.fill('input[placeholder="Your name"]', 'Geoff'); await M.click('text=Let\'s play'); await M.waitForSelector('text=Choose course')
  await M.click('text=Island Green'); await M.click('text=Host room'); await M.click('text=Create room'); await M.waitForSelector('[data-testid=roomcode]'); await sleep(500)
  await shot(M, '06_multiplayer.png'); console.log('room', await M.textContent('[data-testid=roomcode]'))
  await b.close()
})().catch(e => { console.error(e); process.exit(1) })
