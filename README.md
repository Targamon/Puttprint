# Putt Print

Stamp every shot with GPS, pick your club, and play against your own ghost. Flat 2D aerial hole maps, no 3D.
(Separate from Dolphin's 3D Expo app; reuses its course data.)

## Run
```bash
cd /workspace/puttprint/app
npm install && npm run dev      # http://localhost:5173 (--host is on, so a phone on the same Wi-Fi can open it)
npm run build                   # type-check + production build in dist/
```
GPS in a phone browser needs HTTPS, or localhost. Over plain LAN HTTP the browser blocks location and the app simulates shots instead.

## Flow
Login (name + dot color) → Choose course (tab: **+ Add course**) → pick ghost **Last / Best / Perfect** and Solo/2/3/4 players → **Tee off**
→ on each hole tap the **PLAY ball** to stamp your lie → pick a club → repeat until you're on the green, then putt → **Hole out** → next hole or **Finish round now** → scorecard vs ghost.

## Product rules
- **Shot** = where you hit from (`lat, lon`), the club, `hole`, `shotIndex`, and `positionSource`. Strokes on a hole = number of stamps.
- **positionSource**: `gps` = real fix within 1.5 km of the green. `simulated-far` = you have GPS but aren't at the course. `simulated` = GPS denied, unavailable, or the *Simulate GPS* box is on. A simulated stamp moves the previous lie forward along the hole path by the club's typical carry (±7%, a little left/right). Shots that reach the green land 3–12 m from the pin, and each putt rolls about 85–95% of the way to the cup.
- **Avatars** are colored dots only (blue / red / yellow / magenta).
- **Multiplayer** is same-device and turn-based: after each stamp, the turn passes to the next player who hasn't holed out. A hole is complete when everyone has holed out.
- **Ghosts** come from player 1 (the profile owner) in completed rounds on that course:
  - **Last** = the most recently completed round.
  - **Best** = the round with the lowest score-to-par over the holes played (ties go to the most recent).
  - **Perfect** = a composite built hole by hole: the lowest score that hole has had in any completed round. Ties go to fewer strokes to reach the green (shots before the first putt), then to the most recent round.
  - Drawn as a gold dashed line with a club and yards label on each segment. The **GHOST ON** pill lights up when that hole has ghost data.
- **Course DB** = 4 seeded courses (from Dolphin `courses.json`) plus courses users add (localStorage `pp.courses`). Added courses start as schematic straight holes, optionally anchored to your GPS position.

## Storage (localStorage)
`pp.profile`, `pp.courses` (user-added), `pp.rounds` (every round with per-hole, per-player shots). Ghosts are worked out from rounds when needed. Each hole is saved as soon as everyone holes out.

## Real vs mock
| | |
|---|---|
| Thunderhart | **Real OSM geometry**: hole paths, greens, tees, fairways, bunkers, water, woods, and 108 OSM trees |
| Sunny Hill, Island Green, Sycamore | **Schematic**: tee/green/path from courses.json, fairway drawn as a corridor, labeled "schematic" on the map |
| Scorecards (par/yards/HCP) | from courses.json (Dolphin research) |
| Decorative trees, cart path, 100/150/200 markers | drawn in, not surveyed (markers are measured back from the green along the hole path) |
| Club distances (for simulation) | standard defaults, not learned from the player yet |
| Login | name only on this device. No accounts and no server; the course DB is shared on the device only |

## Gaps / next
Server-side shared course DB and accounts; learning club distances from logged shots; mapping added courses from their logged shots; offline PWA/native wrapper for App Store; real multi-device multiplayer.

## Files
- `app/` – Vite + React + TS SPA (`src/App.tsx` screens, `HoleMap.tsx` SVG map, `PlayButton.tsx`, `store.ts` persistence/ghosts, `geo.ts`)
- `app/scripts/export_courses.py` – rebuilds `src/data/courses.json` from Dolphin courses.json + OSM trees
- `demo/previews/*_hole1.png` – hole 1 of all 4 courses from the app renderer
- `demo/screens/` – screenshots from the end-to-end test (round 1 with no ghost, round 2 with the ghost on)
- `APP_STORE.md` – store listing draft

---
## v0.2 — cloud, multiplayer, learned clubs, better maps, store + native packaging

### Layout
- `app/` — React + Vite client (offline-first). New: `src/api.ts`, `src/clubs.ts`, `src/Multiplayer.tsx`, `src/native.ts`, `capacitor.config.ts`, `android/`, `ios/`, `scripts/enrich_osm.py`
- `server/` — Fastify 5 + libsql (SQLite file `server/data/puttprint.db`), port 8787. Static `/privacy`, `/support`, `/icon-1024.png` from `server/public/`
- `tests/e2e.cjs` — Playwright run: two-browser multiplayer, solo round → club averages, map previews, offline check

### Run
```bash
cd server && npm install && npm run dev          # http://localhost:8787  (PORT, DB_URL env overrides)
cd app && npm install && npm run dev             # http://localhost:5173  (/api is proxied to :8787)
cd tests && node e2e.cjs                         # APP_URL=http://localhost:5174 by default
```
API: `POST /auth/login {name,color}` → `{token,userId,name,color}` · `GET/POST /courses` · `GET/POST /rounds` (Bearer) · `PUT /me/club-avgs` ·
`POST /rooms {courseId,ghostMode,maxPlayers}` → `{code}` · `POST /rooms/:code/join` · `GET /rooms/:code` (+ `/events` SSE) · `POST /rooms/:code/{shot,undo,hole-out,advance,finish}`.
Client API base: `VITE_API_URL` if set, else `/api` (Vite proxy) in dev, else `http://localhost:8787`.

### Offline-first sync
localStorage stays the source of truth on the phone. Completed rounds / added courses are marked dirty and pushed on login, after each round, on the browser `online` event, and every 30 s while offline. Server courses + your rounds are pulled and merged. Header shows `☁ synced` or `⚠ offline`.

### Multiplayer
Setup → **📡 Host room** → 4-letter code. Friends: Courses → **Join room** on their own phone/login. Each player stamps their own shots; all phones poll the room every 1.5 s and draw everyone's colored dots. When everyone holes out, anyone taps Next hole. Finished room rounds are saved to each player's history (you as player 1, so ghosts + club learning work). Solo and pass-the-phone still work offline.

### Learned club distances
`src/clubs.ts`: per completed round, carry of shot *i* = distance to shot *i+1* on the same hole (Putter ignored, 5–400 yd sanity). Mean per club; ≥3 samples overrides the stock yardage for Simulate GPS and shows "your avg" in the club picker. Stored in `profile.clubAvgs` and on the server.

### Maps
`npm run courses` = `export_courses.py` + `enrich_osm.py` (reads `/workspace/dolphin/data/osm/*.osm`, read-only).
- Island Green — **OSM partial (18/18 holes)**: hole ways attached by `ref`, greens/fairways/tees/bunkers assigned per hole, water, streams, cart paths, outline. Yardages on the card don't always match the OSM ways — numbering/geometry is community data.
- Sycamore — **OSM outline + schematic holes**: real club boundary, streams, cart paths; holes are schematic, centered inside the outline.
- Sunny Hill — **schematic (enhanced)**: its OSM file only contains Thunderhart's holes, so those are excluded; nearby water/woods kept.
- Renderer: wider fairway corridors, two-tone rough banding, ~2× edge trees, near-green bunker pads (by par) when OSM has none. Previews: `demo/previews/*_hole1.png`.

### HTTPS for phone GPS
Browsers only give GPS in a secure context. `cd app && npm run dev:https` (uses `@vitejs/plugin-basic-ssl`, self-signed) → open `https://<this-box-LAN-IP>:5173` on the phone, accept the cert warning. API calls go through the same-origin `/api` proxy, so no mixed-content block.

### Native shells (Capacitor 7)
`appId com.puttprint.app`, `appName Putt Print`, `webDir dist`. `npm run build:native` = build + `npx cap sync`. GPS uses `@capacitor/geolocation` inside the shell (browser geolocation on web). Location permissions are added to AndroidManifest and Info.plist.
- Android: install Android Studio + JDK 21 → `npx cap open android` → Run / Build ▸ Generate Signed Bundle (.aab) → Play Console.
- iOS: needs a Mac with Xcode → `npx cap open ios` → set Team/signing → Archive → App Store Connect.
- Point the shell at a real API: `VITE_API_URL=https://api.example.com npm run build:native`. Live-reload: `CAP_SERVER_URL=https://<lan-ip>:5173 npx cap sync`.
- This Linux box can't compile/sign iOS and has no Android SDK, so nothing ships from here alone.
