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
    // Hero spot at x -52 sits between the beach palms (x -58 and -40), so no
    // trunk crosses the sightline to Dante.
    p.x = -52; p.z = 268; p.heading = Math.PI * 0.75;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    game.spawnParkedCarAt(-44, 272, Math.PI / 2, 0xc23b2e);
    game.cam.snap(-76, 5, 286, -46, 2, 264);
    game.hud.setMission('PORTO VELA', 'Eight jobs. One yacht. No way back.', '');
    game.hud.setDjLine('DJ Neon: "Sunset over the marina, synths on the radio."');
  } else if (name === 'chase') {
    // Coastal chase on the open beach: player car eastbound at 102 km/h, two
    // cruisers flanking behind, 3 stars, mission 7 active for the HUD.
    game.tryEnterCarAt(0, 270, Math.PI / 2);
    game.player.car.speed = 30;
    game.missions.start(6); // Beachfront Heist: steal step completes at once (in a car)
    game.police.setStars(3);
    game.police.cars.forEach((c, i) => {
      c.x = game.player.x - 14 - i * 5; c.z = game.player.z + (i % 2 ? 7 : -7);
      c.mesh.position.set(c.x, 0, c.z);
      c.heading = Math.PI / 2;
      c.mesh.rotation.y = c.heading;
    });
    game.cam.snap(game.player.x - 30, 8, game.player.z + 16, game.player.x + 10, 2, game.player.z);
    game.hud.setSpeed(30 * 3.6, true);
    // Stage the helicopter ahead of the player, inside the frame: the orbit
    // angle is dt-driven, so it stays roughly here for the screenshot.
    if (game.police.heli) game.police.heliAngle = -0.6;
    document.getElementById('msg').style.display = 'block';
    game.hud.message('Mara: "The helicopter is already in the air — don\u2019t give it a clean look at your plates."', 6000);
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
    game.cam.snap(252, 7, 150, 264, 1, 116);
    game.hud.setMission('#4 Dockside Deal — Mara Voss', 'Take out the rival crew (4 left)', '');
  } else {
    // 'play' fallback: free roam on foot downtown.
    p.x = 0; p.z = 24;
    p.mesh.position.set(p.x, 0, p.z);
    game.cam.snap(-10, 6, 40, 0, 2, 10);
  }
}
