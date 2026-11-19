// Screenshot poses: each ?shot= name stages a real gameplay moment, then the
// harness screenshots it. Poses use only the game's own public API.
// NOTE: staged positions stay on open ground (beach / docks apron) — the last
// city block row reaches z≈254, so beach poses use z>=260 and the camera never
// sits inside a block.
export function applyShot(game, name) {
  const p = game.player;
  const hideMsg = () => { document.getElementById('msg').style.display = 'none'; };
  if (name === 'title') {
    // City vista behind the title screen.
    game.state = 'title';
    game.hud.show('title');
    game.cam.snap(-120, 90, 320, 40, 10, 0);
    return;
  }
  hideMsg();
  document.getElementById('hud').style.display = 'block';
  if (name === 'cover') {
    // Dante on the beach at sunset: the camera sits east of him and looks
    // west, so the setting sun disc over the sea and the CERVEZA VELA
    // billboard are in frame behind him, with the red BRISA GT at his side.
    p.x = -52; p.z = 268; p.heading = Math.PI / 2;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    game.spawnParkedCarAt(-44, 272, Math.PI / 2, 0xc23b2e);
    game.cam.snap(-20, 5, 284, -52, 2, 268);
    game.hud.setMission('PORTO VELA', 'Eight jobs. One yacht. No way back.', '');
    game.hud.setDjLine('DJ Neon: "Sunset over the marina, synths on the radio."');
  } else if (name === 'chase') {
    // Coastal chase on the open beach, WESTBOUND into the sunset: player car
    // at a staged 108 km/h, cruisers flanking, 3 stars, mission 7 active.
    // The session clock is set to 19:22 (dusk) so the sky reads pink-purple
    // sunset and the low sun is in frame.
    game.time = 300;
    game.tryEnterCarAt(0, 270, -Math.PI / 2);
    // Held tableau: the car keeps its staged 30 m/s for the frame (the
    // speedo reads 108 km/h) but the shot-mode freeze in main.js stops
    // the convoy driving west out of the frozen camera — in round 2 the
    // moving convoy is why the player car read ~25 px / vanished.
    game.player.car.speed = 30;
    game.missions.start(6); // Beachfront Heist: steal step completes at once (in a car)
    game.police.setStars(3);
    // Cruisers flank the player car on the far (north) side, in a line
    // alongside it — never between the camera (south-east) and the car —
    // plus one south-west ahead of the car, in the open road ahead.
    const cruiserSpots = [[-12, -11], [-6, -9], [0, -11], [-20, 11]];
    game.police.cars.forEach((c, i) => {
      const [ox, oz] = cruiserSpots[i % cruiserSpots.length];
      c.x = game.player.x + ox; c.z = game.player.z + oz;
      c.mesh.position.set(c.x, 0, c.z);
      c.heading = -Math.PI / 2;
      c.mesh.rotation.y = c.heading;
    });
    // Camera closer than round 2 (+28 -> +20, look -28 -> -20): at ~25 m
    // the 4.4 m car reads ~60+ px instead of ~25 px. The look target sits
    // low (y 3), so the car rides in the upper half of the frame, clear of
    // the portrait dialog docked at the bottom — and the sunset stays in
    // frame. The heli is staged low (22 m) for the same reason. Measured
    // from the regenerated shot: the red BRISA reads ~66 px wide.
    game.cam.snap(game.player.x + 20, 10, game.player.z + 12, game.player.x - 20, 3, game.player.z - 4);
    game.hud.setSpeed(30 * 3.6, true);
    // Stage the helicopter north-west of the player, low enough to stay
    // inside the frame (the 34 m orbit height puts it above the top edge
    // from this closer camera): 22 m up, 26 m west, 12 m north.
    if (game.police.heli) {
      game.police.heli.position.set(game.player.x - 26, 22, game.player.z - 12);
      game.police.heli.rotation.y = Math.atan2(26, 12);
    }
    // Re-record nit fix: the low sun sat exactly behind the PD panel in this
    // framing. updateDaylight only ever moves the disc vertically, so sliding
    // it north here puts the disc in open sky just right of the panel (and
    // left of the Mara bark text); the cover shot still shows it over the sea.
    if (game.sunDisc) game.sunDisc.position.z = 240;
    // Mara's line is a bark, so it goes through the portrait dialog like
    // every other bark — not the centre-screen feed, which used to cover
    // the road and the helicopter for 6 s in this shot.
    game.hud.showDialog('mara', 'Mara: "The helicopter is already in the air — don\u2019t give it a clean look at your plates."');
  } else if (name === 'mission') {
    // Dockside shootout: finish the goto step so 4 rivals + beacon are visible.
    p.x = 264; p.z = 120; p.heading = -Math.PI / 2;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    game.missions.start(3); // Dockside Deal
    game.missions.update(0.05); // complete goto (player already at the marker)
    game.combat.muzzle(264, 116);
    // Camera west of the container row, low over the apron: the player + 4
    // rivals mid-frame, beacon behind them, containers to the right, city left.
    // Round 3: pulled closer (36 m -> ~28 m to the fight) so the rivals read
    // at ~30 px instead of hiding behind the beacon and the crates.
    game.cam.snap(254, 7, 140, 264, 1, 114);
    game.hud.setMission('#4 Dockside Deal — Mara Voss', 'Take out the rival crew (4 left)', '');
    // Re-record nit fix: the Mara bark dialog sat centre-frame and covered
    // the middle of the fight. For this shot only, dock it lower-left (above
    // the minimap) so the beacon, the rivals and the crosshair stay clear.
    // The dialog itself is unchanged in normal play.
    const dlg = document.getElementById('dialog');
    if (dlg) {
      dlg.style.left = '16px'; dlg.style.transform = 'none';
      dlg.style.bottom = '196px'; dlg.style.width = '340px';
    }
  } else {
    // 'play' fallback: free roam on foot downtown.
    p.x = 0; p.z = 24;
    p.mesh.position.set(p.x, 0, p.z);
    game.cam.snap(-10, 6, 40, 0, 2, 10);
  }
}
