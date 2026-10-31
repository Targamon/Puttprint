# Putt Print — App Store listing (draft)

**Name:** Putt Print
**Subtitle:** Stamp every shot. Beat your ghost.
**Category:** Sports  ·  **Age rating:** 4+  ·  **Price:** Free

## Description
Putt Print turns every round into a map of your game. When you reach your ball, tap the golf-ball PLAY button. Putt Print stamps your spot with GPS, you pick the club, and you keep going from tee to cup.

Your rounds turn into ghosts. Before you tee off, choose who you're playing against:
• **Last**: your most recent round
• **Best**: your lowest round on that course
• **Perfect**: your best score on every hole, stitched into one round

A gold dashed line shows how your ghost played each hole and which club it hit, right over a clean overhead map with fairways, greens, bunkers, water, trees, and yardage markers.

Play solo or with up to 4 players, each with their own colored dot. Can't find your course? Add it, and it joins the course list.

## Keywords
golf,gps,shot tracker,scorecard,golf gps,rangefinder,handicap,ghost,club distance,course map,yardage

## What's New (1.0)
• First release: GPS shot stamping, club logging, and Last, Best, and Perfect ghosts
• Overhead hole maps, with Thunderhart fully mapped
• Solo to 4-player rounds and add-a-course

## Privacy (App Privacy / nutrition label notes)
• **Location (precise)**: used only when you tap PLAY, to stamp where your shot was hit. No background tracking.
• Rounds, shots, learned club distances, and added courses are cached on the device and synced to the Putt Print server under your account. Nothing is sold or shared with third parties, and nothing is used for advertising or tracking.
• Data linked to you: Name (display name), Precise Location (shot stamps), User Content (rounds/courses), Other (club averages) — all App Functionality only. No tracking.
• Multiplayer rooms show your name, color, and shot dots to the other players in that room.
• Purpose string: "Putt Print uses your location to stamp where each shot was hit."

## Support / Marketing URLs
Production host TBD — these are the local-dev URLs served by `server/` today; swap the host before submission.
- Support URL: http://localhost:8787/support
- Marketing URL: http://localhost:8787/support (placeholder until a landing page exists)
- Privacy policy URL: http://localhost:8787/privacy
- Support email placeholder: support@puttprint.app

## Screenshots (6.7" and 6.5", 1290×2796 / 1242×2688)
1. Hole map with BEST GHOST ON and the gold ghost line (placeholder: demo/screens/r2_hole1.png)
2. PLAY ball stamping a shot, then the club picker
3. Choose course + Add course
4. Ghost picker: Last / Best / Perfect, Solo / pass-the-phone / Host room
7. Multiplayer room with live colored dots (demo/screens/mp_hostA.png) and learned club averages (demo/screens/clubs_learned.png)
5. Scorecard vs ghost (demo/screens/r2_summary.png)
6. App icon hero (demo/puttprint_app_icon.png)

## Icon
app/public/icon-1024.png — 1024×1024 RGB PNG, no alpha (generated from demo/puttprint_app_icon.png). Also served at /icon-1024.png by the API.

## Bundle
Bundle ID / applicationId: com.puttprint.app · App name: Putt Print · Capacitor shells in app/android and app/ios.

## Pricing (in-app purchases)
- **Free:** stamp shots, scorecard, 1 added course (plus the 4 bundled), Last ghost only, solo.
- **Putt Print Pro — $4.99/month** or **$29.99/year** (yearly highlighted, ~50% off), 7-day free trial on first Pro offer.
- **Lifetime — $59.99** one-time.
- Pro unlocks: Best + Perfect ghosts, cloud sync & multiplayer rooms, learned clubs & unlimited courses. No ads.
- Current build uses mock purchases (device-local); StoreKit / Play Billing to be wired before submission.
