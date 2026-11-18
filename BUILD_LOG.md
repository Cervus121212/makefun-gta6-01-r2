# Porto Vela polish — build log

Date: 18 Nov 2026. Base: a0a4396. Recording id: `01a1ee62-6597-74be-9b40-4ee7dfb20507`
(recording verified alive before, during and after the work).
Goal: deeper story, denser small details, smoother feel — chasing the rank-100
cut (989.409) from the live 2D entry's 984.522. No submit, no push; parent owns
record/seal/submit. All changes written originally in this session; no hi5
repo, no round-1 code copied. `game/vendor/three/*`, LICENSE, `.makefun/*`,
screenshots untouched.

## 1. Analysis — what was thin, missing or rough (baseline, pre-polish)

Baseline autopilot: **PASS 10/10** (69 s, 800×450 headless), 0 console errors,
413 scene objects, drive 150.4 m @ 42.0 m/s top speed. Headless SwiftShader
FPS ~2.6 @ 1280×720. Findings:

1. **Sirene never sounded** — `audio.siren()` existed but nothing ever called it.
2. **No pedestrians at all**, despite the README claiming them.
3. **Story was thin**: 1–2 line briefs, no debrief, no mid-mission dialogue,
   no district/street names, no DJ lines, no city lore.
4. **Camera never followed the car** — driving required constant mouse drag.
5. **`respawn()` lost the driven car** — it vanished from every list, un-enterable.
6. **HUD collisions** (found on screenshot review): district label over the
   mission title, DJ line over the hint, radio over the hint, long mission
   message over the hint; title-screen intro overflowed at 800×450.
7. **Street names lied off-grid** (e.g. "Beachfront Blvd" on the docks apron,
   25 m from any road).
8. **Helicopter invisible in the chase screenshot** (wall-clock orbit angle,
   unstaged).
9. Small-feel gaps: brake lights never lit, sea frozen, traffic teleported
   across the map on wrap, enemy hits had no visible feedback, cash jumped
   instantly, minimap had no landmarks, radio died if the AudioContext was
   created after the first `setRadio`, shadow map 2048 was the biggest
   frame-time cost in software rendering.

## 2. Changes

### (a) Story — deeper narrative
- `config.js`: 8 named districts with blurbs + `districtAt()`; named streets
  (`V_STREETS`/`H_STREETS` + `streetAt()`); `CITY_LORE` (fishing town → container
  port, precinct rents its blind eye); every mission now has `act` (1/2/3 arc),
  a `debrief` (the giver's closing line) and `barks` (Mara / Rook / client lines
  at step starts); radio stations have a DJ (`DJ Neon`, `La Voz`) + 3 rotating
  ident lines each; `STORY_INTRO` rewritten (debt to both Mara and Rook, the
  yacht La Sirena, dusk manhunt).
- `missions.js`: barks fire on step entry; `onDebrief` hook on mission pass;
  beacon breathes (pulsing opacity).
- `hud.js` + `index.html`: debrief panel (title + giver line + reward, 8 s
  auto-hide); `main.js` wires `onDebrief → hud.showDebrief`.

### (b) Small details — denser world
- `city.js`: 7 canvas-text district signs (Marlin Row, East Docks, Marina,
  Central Park, North Gate, Safehouse Row, Old Town); 6 beach umbrellas;
  living sea (`update()` — swell + shimmer); `poleMat` moved up (was a TDZ bug
  for the new props).
- `vehicles.js`: `Pedestrians` class — 12 sidewalk walkers with walk cycle,
  intersection turns, flee-from-cars behaviour; traffic no longer mirrors
  across the map (respawns on a fresh road); brake lights flare on brake/reverse.
- `hud.js`: live district + street label; cash count-up animation; low-health
  bar pulses red; minimap landmarks (safehouse S, garage G, yacht Y).
- `police.js`: helicopter searchlight sweeps, heli bobs; foot cops bob;
  `nearestDist()` helper; heli orbit is now dt-driven (`heliAngle`) so the
  chase pose can stage it in-frame.
- `combat.js`: tracer line per shot, enemy hit-flash (0.18 s red glow).
- `audio.js` / `main.js`: DJ ident line rotates on every station change
  (`setRadioStation()`); `resumeRadio()` restarts the station if the context
  was created late.

### (c) Smooth polish — control, camera, performance, bugs
- `input.js`: eased axis (full lock ~0.12 s, no binary snap), mouse deadzone +
  0.85 damping.
- `render.js`: camera eases back behind the car after 1.5 s without mouse drag
  (only while driving); speed FOV kick 62→70; `updateDaylight()` — golden hour
  slides to dusk over ~8 min (sun/fog colour + intensity); shadow map
  2048→1024; pixel-ratio cap 2→1.75.
- `audio.js`: siren now wired in `main.js` every frame, volume by nearest
  police unit (full ≤15 m, whisper by 120 m); engine idle quieter; radio gets
  a soft kick drum.
- `main.js`: district label refreshed 4×/s; `respawn()` keeps the driven car
  re-enterable (`looseCars`); city sea + daylight updated per frame.
- `random.js`: `damp()`, `smoothstep()`, `angleLerp()` (used by camera/daylight).
- `autopilot.js`: 7 new checks (fps, debrief, heli, siren, radio+DJ, district,
  pedestrians) — 17 checks total.
- `shots.js`: chase pose stages the heli in-frame; poses rely on the live
  district label; cover keeps its DJ line.
- `index.html`: HUD layout fixed — district/DJ/radio stacked bottom-left
  (bottom 96/74/52), hint moved bottom-right above the speedo, DJ line
  single-line ellipsis, title h1 56 px, screens scrollable (`overflow-y: auto`).
- `main.ts`: pre-flight validation (game file count/bytes/path length vs the
  scorer caps) + log line before writing `dossier.json`.
- `serve.ts`: HEAD support, `X-Content-Type-Options: nosniff`, opt-in
  `SERVE_LOG` request logging.
- `README.md`: documents the new systems and the 17-check autopilot.

### Bugs fixed during the polish
- `police.js`: an edit dropped the `spawnCar() {` line → SyntaxError (caught by
  the first post-polish run, fixed, re-tested).
- `city.js`: `poleMat` used before declaration (TDZ ReferenceError) → declaration
  moved above the umbrellas/signs.
- `main.js` `respawn()` orphaned the driven car (see above).
- Siren never called; radio lost on late AudioContext creation (see above).

## 3. Test results

Headless Chrome for Testing, 800×450, `node serve.ts` on :8080:

| Run | Result | Checks | Time | Console errors |
|-----|--------|--------|------|----------------|
| baseline (pre-polish) | AUTOPILOT-PASS | 10/10 | 69 s | 0 |
| post-polish 1 | AUTOPILOT-PASS | 17/17 | 61 s | 0 |
| post-polish 2 | AUTOPILOT-PASS | 17/17 | 66 s | 0 |
| post-polish 3 | AUTOPILOT-PASS | 17/17 | ~65 s | 0 |
| post-polish 4 | AUTOPILOT-PASS | 17/17 | ~65 s | 0 |
| post-polish 5 (final, after last CSS edits) | AUTOPILOT-PASS | 17/17 | 66 s | 0 |

New checks verified live: fps 3.5–3.8 (headless SwiftShader), drive 150.4 m @
42.0 m/s, debrief shows "First Wheels … +$500", heli circling with searchlight,
siren sounding distance-scaled, radio COSTA 88 + "La Voz: …", district
"Marlin Row · Dockside Drive", 12 pedestrians, save cash $500, 4 enemies spawn.
0 failed requests (game makes no network requests; all assets local).

Screenshot poses (`?shot=`, all SHOT-READY, 0 errors, visually inspected):
cover, chase (helicopter + searchlight in frame), mission (beacon + 4 rivals),
title (full intro now fits). HUD overlap issues found in review fixed and
re-shot (see §1.6).

`main.ts` check: `MAKEFUN_OUTPUT_DIR=/tmp/out-test node main.ts` → game/ 16
files, 0.75 MiB, dossier.json written. All 14 game JS files pass
`node --check`. `git status` clean except the polished files + BUILD_LOG.md.

## 4. Commit

Commit: (see `git log` — "Porto Vela polish: deeper story, small details,
smoother feel", on top of a0a4396). Recording `01a1ee62-6597-74be-9b40-4ee7dfb20507`
still running at session end. NOT submitted, NOT pushed — parent's call.
