# Putt Print – Thunderhart graphics demo (holes 1–3, at tee)

Files: thunderhart_hole1.png, thunderhart_hole2.png, thunderhart_hole3.png (1170x2532 phone screens), render.py (regenerate: `python3 render.py`).

## What's real (mapped)
- Geometry: OpenStreetMap ways from /workspace/dolphin/data/osm/thunderhart.osm — fairways, greens, tee boxes, bunkers, lateral water hazards, drawn to scale (metres -> pixels, uniform scale per hole).
- Hole line, tee point, green centre: packages/shared/src/courses/courses.json (OSM golf=hole ways 813005392 etc.).
- Each map is rotated so tee is at the bottom and green at top (north is NOT up). Neighbouring holes' features appear around the edges as in reality.
- Par / yardage / handicap: scorecard data (Blue/White tees).
  - H1 Par 4, Blue 344 / White 324, HCP 17 (OSM path 360y; dogleg, tee shot carries the pond)
  - H2 Par 5, Blue 462 / White 442, HCP 1 (OSM path 468y; long straight fairway)
  - H3 Par 4, Blue 345 / White 325, HCP 9 (OSM path 341y)

## What's mock
- Best Ghost gold dashed line + club/yardage labels are invented demo shots placed along the real hole line (birdie each hole). Real ghosts come from stored player shots.
- Blue dot = player at tee. Club row, PLAY button, header are UI mockup only.

## App icon
- puttprint_app_icon.png — golf ball with navy fingerprint on green, red flag soft in background.

## Known gaps
- Decorative (non-OSM) trees fill wooded edges; a few may sit near fairway. Some bunkers may be missing/placed per OSM accuracy; verify against course visit or satellite.
- Best Ghost shots remain sample data.
