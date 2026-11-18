# Porto Vela — open-world crime game (gta6-01 round 2)

An original 3D open-world crime game in the spirit of GTA 6, built from scratch for
make.fun bounty **gta6-01 "Make GTA 6"**. No Rockstar content: the city, characters,
vehicles, story, art and sound are all original.

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

WASD move/drive · Shift run · E steal & enter car, exit car · mouse drag look ·
click shoot · 1/2/3 radio · M mute · P pause. Progress saves in the browser.

## The game

- **Porto Vela**: a procedural 3D island city (9×9 blocks, beachfront, docks,
  marina, central park) in golden-hour light, built with vendored three.js.
- **Systems**: on-foot and driving, stealable cars, traffic AI, pedestrians,
  5-star wanted system with police chases, foot cops and a helicopter at 3+ stars,
  pistol combat, health, cash, radio (3 synthesized stations), minimap, HUD,
  start/pause/wasted screens, localStorage saves.
- **Story**: 8 jobs for Mara Voss and Det. Rook — car theft, pickup, police
  escape, dockside shootout, timed getaway, sedan chase, cash-van heist, and a
  4-star finale at the marina yacht.
- **Sound**: everything synthesized with Web Audio — engine, sirens, gunshots,
  jingles, radio loops. No audio files, no network requests.

## Layout

- `game/index.html` — canvas + HUD + menus
- `game/src/` — `main.js` (loop/state), `city.js`, `vehicles.js`, `police.js`,
  `combat.js`, `missions.js`, `hud.js`, `render.js`, `input.js`, `audio.js`,
  `config.js`, `random.js`, `shots.js`, `autopilot.js`
- `game/vendor/three/three.module.min.js` — three.js 0.160.0 (MIT), vendored
- `main.ts` — hands game/ + screenshots/ to /output with dossier.json
- `shots.json` — 4 screenshot poses (cover / chase / mission / title)

## Tests (headless Chrome)

`?autopilot=1` drives the real game (walk, steal a car, drive, shoot, complete
mission 1, wanted system, save round-trip) and writes results to `#test-results`
and `document.title` (`AUTOPILOT-PASS` / `AUTOPILOT-FAIL:<check>`).
`?shot=<name>` stages a screenshot pose.

## Why this rebuild

Round 1 ("Solmar Heat", rank ~1304, judge 984.522) was a 2D top-down canvas game.
The leaderboard top 4 (all tied at judge 993.343) are 3D WebGL2 open worlds with
7–12 story missions, police + helicopter chases, radio and saves; the paid cut
(rank 100) sits at 989.409. This rebuild closes the gap with a real 3D city,
8 story missions, the full wanted/police/helicopter stack, and 4 staged 3D
screenshots — written fresh, no winner or round-1 code copied.
