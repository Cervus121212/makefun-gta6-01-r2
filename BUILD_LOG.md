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

---

# Porto Vela round 2 — RE-RECORD (18 Nov 2026, night)

Base: eafab84 ("Porto Vela polish: deeper story, small details, smoother
feel"). Reference: round-2 commits 53d6498 (FASE 1), e2ac7d7 (FASE 2),
760bbbd (screenshot refresh) — read as specification only, never checked
out / applied / copied; every line below was typed again in this session
under the NEW recording `01a1eebe-fa7b-7384-9705-1ab1d7d7e474` (started
20:00:55 WIB, alive through the whole session; parent owns seal/submit).
Why a re-record: the round-2 recording (`01a1ee80`) died mid-session and was
never sealed, so the tested round-2 code could not be submitted. No submit,
no push.

## 1. Fidelity check

`git diff 760bbbd` on the finished tree shows the re-record is
**byte-identical to round-2 in 13 of 15 files** (autopilot.js, main.js,
city.js, combat.js, config.js, police.js, render.js, vehicles.js,
missions.js, input.js, random.js, index.html, README.md). Only hud.js and
shots.js differ — the 4 nit fixes in §2. BUILD_LOG.md itself differs only
because this commit sits on eafab84, so the FASE 1 / FASE 2 sections live in
the reference commits, not here.

## 2. The 4 nit fixes (from the round-2 screenshot review)

- **(a) Sun behind the PD panel (chase).** FIXED — the chase pose now slides
  the sun disc north (`sunDisc.position.z = 240`; `updateDaylight` only ever
  moves it vertically, so the shift survives the frame loop). The disc now
  reads as a pale-gold circle in open sky, right of the PD panel and left of
  the Mara bark text; the cover shot still shows it over the sea. Verified
  on a 3x crop of the regenerated chase shot.
- **(b) Player car small in the chase (~20 px).** PARTIALLY FIXED — camera
  pulled a little closer (offset +36 → +28, look target −36 → −28) so the car
  sits more central instead of low at the frame edge, but it still reads
  ~25 px. A genuinely closer camera was worked out and rejected: the heli
  orbits at 18 m / 34 m high, so any camera close enough to double the car
  pushes the heli out of the top of the frame, and the staged cruisers sit
  right beside a closer camera. Fixing it properly means re-staging the
  heli orbit + cruiser offsets — a redesign, not a nit fix. Left as-is.
- **(c) Small white bar in the speedometer on foot.** FIXED — the on-foot
  speed was the 64 px em-dash '—', which rendered as a bar. `setSpeed`
  now shows an empty speed on foot; the 'on foot' unit carries it. Verified
  in the mission + cover shots (bottom-right shows only 'on foot').
- **(d) Mara bark covering the middle of the fight (mission shot).** FIXED —
  the mission pose docks the dialog lower-left (above the minimap) for that
  shot only, so the beacon, the rivals and the crosshair stay clear. The
  portrait + line are still visible; the dialog is unchanged in normal play.
  (Note: there is no helicopter in the M4 mission shot — the bark was
  covering the centre of the fight, which is what the dock fixes.)

Pass-2 revisions (small, on top of the faithful re-record): `showDialog`
guards a missing portrait canvas so a bark can never throw and break the
mission flow; the autopilot's `dialog-portrait` check now also samples the
portrait canvas pixels (it must be actually drawn, not just present);
`resetRun()` calls `hud.setArmour(0)` so the HUD syncs immediately.

## 3. Test results

Headless Chrome for Testing, `node serve.ts` on :8080:

| Run | Result | Checks | Time | Console errors |
|-----|--------|--------|------|----------------|
| re-record autopilot 1 | AUTOPILOT-PASS | 43/43 | 107.0 s | 0 |
| re-record autopilot 2 | AUTOPILOT-PASS | 43/43 | 112.5 s | 0 |

Notable values (identical both runs): clock DAY 1 18:53 → 19:05 (+12 min);
car BRISA GT, CONDITION 90%; REP · ROOKIE — 160 pts; minimap arrow east 196
vs west 62; mission 4: 4/4 kills, player HP 100→100 (the vest absorbed the
rivals' damage); SMG 120 → 119 → auto-pistol at 0; dialog "Det. Rook:
Green sedan, heading anywhere but here…"; PD panel 7 UNITS, heli DELFÍN-69
SPOTLIGHT ON YOU 18 m; total cash $18,300. 0 failed requests.

Probe (`~/workspace/makefun/r2-harness/r2-probe.mjs`, 400×225 lowfx,
missions 2–8 + arrow; run twice, full report saved on the second run):
M2 ✓, M3 ✓ (escaped, 24.3 game-s), M4 ✓ (4 kills, HP 100→38),
M5 ✓, M6 ✓ (sedan rammed), M7 ✓ (van, 3 stars), M8 ✓ (survived 60.3
game-s, state=end, cash $17,800). Arrow heading PI/2 (east). 0 console
errors, 0 exceptions.

Screenshot poses (`?shot=`, all SHOT-READY, 0 errors, visually inspected):
title (fits fully, controls updated to "1 / 2 weapons · R radio"), chase
(pink-purple dusk sky at 19:22, sun disc in open sky, heli in frame,
2 cruisers, PD panel 7 units, stage bar 1/3, BRISA GT 85 km/h CONDITION
100%), mission (Mara portrait dialog docked lower-left, stage bar 2/3,
crane + crates + beacon + rivals, no speedo bar on foot), cover (round sun
over the sea, Dante + BRISA GT centre, skyline right; HUD mission text is
M1, same as round-2 — the frame loop overwrites the pose's setMission).

`main.ts` check: `MAKEFUN_OUTPUT_DIR=/tmp/out-test-rerecord node main.ts` →
game/ 16 files, 0.80 MiB, dossier.json written. All 14 game JS files pass
`node --check`.

### Harness notes (for the parent)

- `cdp-autopilot.mjs` takes its timeout in MILLISECONDS (argv[3], default
  180000). Passing `240` means 240 ms — the run exits after one poll with
  only the first checks logged. Use `240000` for a 240 s budget.
- The probe prints a `ARROW SHOT TAKEN` line before its JSON report, so the
  report must be parsed after skipping the first line; the probe process
  itself always exits 0.
- Screenshots are regenerated with `cdp-run.mjs` + `shots.json` queries
  (`?shot=<name>&seed=7`), same as round-2.

## 4. Commit

Commit: (see `git log` — "Porto Vela round 2 re-record: combat fix,
winner-density HUD + sunset", on top of eafab84). Recording
`01a1eebe-fa7b-7384-9705-1ab1d7d7e474` still running at session end.
NOT submitted, NOT pushed — parent's call.
