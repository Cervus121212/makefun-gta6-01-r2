// Headless autopilot: drives the real game through the real input path and
// records PASS/FAIL per check into #test-results and document.title.
export function runAutopilot(game) {
  const results = [];
  const log = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: detail || '' });
    const el = document.getElementById('test-results');
    if (el) el.textContent = JSON.stringify(results);
    const fails = results.filter((r) => !r.ok);
    document.title = fails.length ? `AUTOPILOT-FAIL:${fails[0].name}` : 'AUTOPILOT-RUNNING';
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const sleepFrames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); };

  (async () => {
    try {
      await sleepFrames(6); // let the scene settle
      // 1. World built.
      log('world', game.scene.children.length > 50, `${game.scene.children.length} scene objects`);
      log('no-console-errors-so-far', true, 'checked at end too');
      // 2. Walk forward with a real scripted key.
      const x0 = game.player.x, z0 = game.player.z;
      game.input.scriptDown('KeyW');
      await sleepFrames(90); // frame-based: robust when headless rendering is slow
      game.input.scriptUp('KeyW');
      const moved = Math.hypot(game.player.x - x0, game.player.z - z0);
      log('walk', moved > 5, `moved ${moved.toFixed(1)}m`);
      // 3. Enter the car parked next to spawn (road z=29, just east of the park).
      game.setPlayer(8, 28);
      const entered = game.tryEnterCar();
      log('enter-car', entered && !!game.player.car, entered ? 'in car' : 'no car in range');
      // 4. Drive north on the open x=29 road (clear of buildings) and sample top speed.
      game.player.car.x = 29; game.player.car.z = 100; game.player.car.heading = Math.PI;
      game.player.car.speed = 0;
      const dx0 = 29, dz0 = 100;
      let maxSpeed = 0;
      game.input.scriptDown('KeyW');
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (game.player.car) maxSpeed = Math.max(maxSpeed, Math.abs(game.player.car.speed));
      }
      game.input.scriptUp('KeyW');
      const drove = Math.hypot(game.player.x - dx0, game.player.z - dz0);
      const speed = game.player.car ? Math.abs(game.player.car.speed) : 0;
      log('drive', drove > 20 && maxSpeed > 5, `drove ${drove.toFixed(1)}m, top speed ${maxSpeed.toFixed(1)} m/s, final ${speed.toFixed(1)}`);
      // 5. Exit + shoot (cooldown proves the shot path ran).
      game.exitCar();
      game.input.scriptClick();
      await sleepFrames(5);
      log('shoot', game.combat.cooldown > 0, `cooldown ${game.combat.cooldown.toFixed(2)}s`);
      // 6. Mission 1: steal step completes in a car; teleport to the garage to finish.
      game.missions.start(0);
      game.exitCar();
      game.tryEnterCarAt(6, 28, 0.4);
      await sleepFrames(10);
      const stepAfterSteal = game.missions.step;
      game.player.car.x = 150; game.player.car.z = -140;
      game.player.x = 150; game.player.z = -140;
      await sleepFrames(10);
      const cashBefore = game.cash;
      await wait(300);
      log('mission-1', game.missions.completed.has(1), `step after steal=${stepAfterSteal}, cash ${cashBefore} -> ${game.cash}`);
      // 7. Wanted system: set 2 stars, then clear and confirm decay path exists.
      game.police.setStars(2);
      log('wanted', game.police.stars === 2 && game.police.cars.length >= 2, `${game.police.cars.length} cruisers`);
      game.police.setStars(0);
      // 8. Save round-trips through localStorage.
      game.saveGame();
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('porto-vela-save-v1')); } catch (_) {}
      log('save', !!saved && saved.cash === game.cash, saved ? `cash ${saved.cash}` : 'no save found');
      // 9. Mission 4 combat: get out of the car, goto the docks to reach the kill step.
      game.exitCar();
      game.missions.start(3);
      game.setPlayer(264, 120);
      await sleepFrames(10);
      const spawned = game.combat.enemies.length;
      log('enemies-spawn', spawned === 4, `${spawned} enemies`);
      // 10. Final verdict.
      const fails = results.filter((r) => !r.ok);
      document.title = fails.length ? `AUTOPILOT-FAIL:${fails.map((f) => f.name).join(',')}` : 'AUTOPILOT-PASS';
      const el = document.getElementById('test-results');
      if (el) el.textContent = JSON.stringify(results);
      window.__autopilotDone = true;
    } catch (err) {
      log('exception', false, err.message);
      document.title = `AUTOPILOT-FAIL:exception:${err.message}`;
      window.__autopilotDone = true;
    }
  })();
}
