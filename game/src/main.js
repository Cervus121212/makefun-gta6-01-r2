// Porto Vela — main loop: player, cars, police, missions, HUD, save, shots, autopilot.
import * as THREE from '../vendor/three/three.module.min.js';
import { WORLD, MISSIONS, RADIO, STORY_INTRO, CAR } from './config.js';
import { mulberry32, range, pick, clamp, collideCircleAABB } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { createCarMesh, DriveCar, Traffic } from './vehicles.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { createRenderer, createScene, ChaseCamera } from './render.js';
import { applyShot } from './shots.js';
import { runAutopilot } from './autopilot.js';

const SAVE_KEY = 'porto-vela-save-v1';
const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.canvas = $('game');
    const _q0 = new URLSearchParams(location.search);
    this.lowfx = _q0.get('lowfx') === '1';
    this.renderer = createRenderer(this.canvas, this.lowfx);
    const { scene, sun } = createScene(this.lowfx);
    this.scene = scene; this.sun = sun;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
    this.cam = new ChaseCamera(this.camera);
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.city = buildCity(scene);
    this.traffic = new Traffic(scene, this.city.colliders);
    this.player = this.makePlayer();
    this.police = new Police(scene, this.city.colliders, () => ({ x: this.player.x, z: this.player.z }));
    this.combat = new Combat(scene, this.camera, () => ({ x: this.player.x, z: this.player.z }));
    this.parked = [];
    this.looseCars = []; // cars the player exited (re-enterable)
    this.chaseCar = null;
    this.state = 'title'; // title | playing | paused | end | wasted
    this.cash = 0;
    this.time = 0;
    this.saveTimer = 0;
    this.ePressed = false;
    this.missionFlash = 0;
    this.missions = new MissionManager(scene, {
      getPos: () => ({ x: this.player.x, z: this.player.z }),
      getCar: () => this.player.car,
      getStars: () => this.police.stars,
      setWanted: (n) => this.police.setStars(n),
      spawnEnemies: (x, z) => this.combat.spawnEnemy(x, z),
      spawnChaseCar: () => this.spawnChaseCar(),
      consumeE: () => { const v = this.ePressed; this.ePressed = false; return v; },
      onPickup: () => { this.audio.pickup(); this.hud.message('Package secured.'); },
      onPass: (m) => this.onMissionPass(m),
      onFail: (why) => this.onMissionFail(why),
      onAllDone: () => this.onAllDone(),
      log: (t) => this.hud.message(t, 6000),
    });
    this.combat.onPlayerHit = (dmg) => this.damagePlayer(dmg);
    this.combat.onEnemyDown = () => this.missions.onEnemyDown();
    this.police.onBusted = () => this.busted();
    this.police.onWasted = () => this.wasted();
    this.spawnParkedCars();
    this.loadSave();
    this.bindUI();
    window.addEventListener('resize', () => this.onResize());
    this.hud.show('title');
    $('story-intro').textContent = STORY_INTRO;
    this.updateContinueBtn();
    // Screenshot mode or autopilot: skip the title screen.
    const q = new URLSearchParams(location.search);
    this.shot = q.get('shot');
    this.autopilot = q.get('autopilot') === '1';
    if (this.shot) {
      this.startPlaying();
      applyShot(this, this.shot);
      this.shotCam = true; // freeze the camera on the staged pose (no chase-cam drift)
      setTimeout(() => { document.title = 'SHOT-READY'; window.__shotReady = true; }, 1200);
    } else if (this.autopilot) {
      this.startPlaying();
      runAutopilot(this);
    }
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  makePlayer() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2a6f4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a3240 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), jacket);
    body.position.y = 1.15; body.name = 'body'; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skin);
    head.position.y = 1.95; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
    legL.position.set(-0.22, 0.45, 0); legL.name = 'legL'; g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.22; legR.name = 'legR'; g.add(legR);    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), jacket);
    armL.position.set(-0.58, 1.2, 0); armL.name = 'armL'; g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.58; armR.name = 'armR'; g.add(armR);
    g.position.set(0, 0, 24);
    this.scene.add(g);
    return {
      mesh: g, x: 0, z: 24, heading: Math.PI, health: 100,
      car: null, walkPhase: 0, moving: false,
    };
  }

  spawnParkedCars() {
    // Parked stealable cars, all sitting on road centrelines (x or z on ROAD_LINES).
    const spots = [
      [10, 29, Math.PI / 2, 0xc23b2e], [29, 100, Math.PI, 0x2e6fc2], [87, -58, 0, 0xe8c832],
      [-29, 116, Math.PI / 2, 0x3a9a4a], [-87, 29, 0, 0x8a8f96],
      [145, 58, Math.PI, 0xe8e4da], [-145, -87, -Math.PI / 2, 0x7a4a9a],
      [203, -29, 0, 0xd07028],
    ];
    for (const [x, z, h, c] of spots) {
      const mesh = createCarMesh(c);
      this.scene.add(mesh);
      const car = new DriveCar(mesh, x, z, h);
      car.parked = true;
      this.parked.push(car);
    }
    // The beachfront cash van for mission 7.
    const vanMesh = createCarMesh(0x3a5a7a, { van: true });
    this.scene.add(vanMesh);
    const van = new DriveCar(vanMesh, -180, 232, Math.PI / 2);
    van.parked = true; van.isVan = true;
    this.parked.push(van);
  }

  spawnChaseCar() {
    const mesh = createCarMesh(0x2a8a3a);
    this.scene.add(mesh);
    const car = new DriveCar(mesh, this.player.x + 40, this.player.z - 20, Math.PI / 2);
    car.hp = 100; car.isChase = true; car.ramCooldown = 0;
    this.chaseCar = car;
    this.hud.message('There he is — the green sedan. Ram it until it stalls!');
    return car;
  }

  bindUI() {
    $('btn-start').addEventListener('click', () => { this.audio.ensure(); this.startPlaying(); });
    $('btn-continue').addEventListener('click', () => { this.audio.ensure(); this.startPlaying(); });
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart').addEventListener('click', () => { this.resetRun(); this.resume(); });
    $('btn-title').addEventListener('click', () => { this.state = 'title'; this.hud.show('title'); });
    $('btn-again').addEventListener('click', () => { this.resetRun(); this.startPlaying(); });
    $('btn-wasted-ok').addEventListener('click', () => { this.respawn(); this.startPlaying(); });
    $('btn-title-2').addEventListener('click', () => { this.state = 'title'; this.hud.show('title'); });
  }
  updateContinueBtn() {
    const has = !!this.save;
    $('btn-continue').style.display = has ? 'inline-block' : 'none';
  }

  startPlaying() {
    this.state = 'playing';
    this.hud.show('playing');
    this.audio.ensure();
    this.audio.setRadio(this.audio.radioStation);
    const m = this.missions.current();
    if (m && !this.missions.active && this.missions.completed.size < MISSIONS.length) {
      this.missions.start(this.missions.index);
    }
    this.hud.setCash(this.cash);
  }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this.hud.show('playing'); } }
  resetRun() {
    this.cash = 0; this.player.health = 100;
    this.police.setStars(0);
    this.combat.clearEnemies();
    this.missions.completed = new Set(); this.missions.index = 0; this.missions.active = false;
    this.player.x = 0; this.player.z = 24; this.player.car = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    this.save = null; this.updateContinueBtn();
  }

  onMissionPass(m) {
    this.cash += m.reward;
    this.audio.missionPass();
    this.hud.message(`MISSION PASSED — ${m.name}  +$${m.reward.toLocaleString('en-US')}`, 6000);
    this.hud.setCash(this.cash);
    this.saveGame();
    if (this.missions.index < MISSIONS.length) {
      // Capture the next mission now: if the player starts another job meanwhile,
      // this timer must not clobber it (it used to re-read the live index and
      // restart the current mission, double-spawning its enemies).
      const next = this.missions.index;
      setTimeout(() => {
        if (this.state === 'playing' && this.missions.index === next && !this.missions.active) {
          this.missions.start(next);
        }
      }, 2500);
    }
  }
  onMissionFail(why) {
    this.hud.message(`${why} Mission failed — try again from the pause menu.`, 6000);
    this.audio.busted();
    if (this.missions.current()) setTimeout(() => { if (this.state === 'playing') this.missions.start(this.missions.index); }, 2000);
  }
  onAllDone() {
    this.state = 'end';
    this.hud.setEnd('KING OF VELA', `All 8 jobs done. Dante sails out of Porto Vela with $${this.cash.toLocaleString('en-US')} — a legend.`);
    this.hud.show('end');
    this.saveGame();
  }
  damagePlayer(dmg) {
    if (this.state !== 'playing') return;
    this.player.health -= dmg;
    this.hud.setHealth(this.player.health);
    if (this.player.health <= 0) this.wasted();
  }
  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.cash = Math.max(0, this.cash - 200);
    this.police.setStars(0);
    this.hud.setWasted('WASTED', 'The crew scraped you off the asphalt. Hospital bill: $200. Mara is not happy.');
    this.hud.show('wasted');
    this.audio.busted();
    this.saveGame();
  }
  busted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.cash = Math.max(0, this.cash - 300);
    this.police.setStars(0);
    this.hud.setWasted('BUSTED', 'The precinct has you. Bail: $300. Rook pulls a string and you walk — this time.');
    this.hud.show('wasted');
    this.audio.busted();
    this.saveGame();
  }
  respawn() {
    this.player.health = 100;
    this.hud.setHealth(100);
    this.player.x = 0; this.player.z = 24;
    if (this.player.car) { this.player.car = null; }
    this.player.mesh.position.set(0, 0, 24);
    this.player.mesh.visible = true;
  }

  saveGame() {
    try {
      const data = { cash: this.cash, health: this.player.health, missions: this.missions.saveState() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.save = data;
    } catch (_) {}
  }
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.save = data;
      this.cash = data.cash || 0;
      this.player.health = data.health || 100;
      this.missions.loadState(data.missions);
    } catch (_) {}
  }

  // Helpers used by screenshots (?shot=) and the headless autopilot (?autopilot=1).
  setPlayer(x, z) {
    this.player.x = x; this.player.z = z;
    this.player.mesh.position.set(x, 0, z);
  }
  spawnParkedCarAt(x, z, heading, color) {
    const mesh = createCarMesh(color);
    this.scene.add(mesh);
    const car = new DriveCar(mesh, x, z, heading);
    car.parked = true;
    this.parked.push(car);
    return car;
  }
  tryEnterCarAt(x, z, heading) {
    const car = this.spawnParkedCarAt(x, z, heading, 0xc23b2e);
    this.setPlayer(x + 2, z);
    this.tryEnterCar();
    return car;
  }

  // ---- entering / exiting cars ----
  nearestCar(maxD) {
    let best = null, bd = maxD;
    const consider = (c) => {
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bd) { bd = d; best = c; }
    };
    for (const c of this.parked) consider(c);
    for (const c of this.looseCars) consider(c);
    for (const c of this.traffic.cars) consider(c);
    if (this.chaseCar) consider(this.chaseCar);
    return best;
  }
  tryEnterCar() {
    const c = this.nearestCar(4.2);
    if (!c) return false;
    // Pull a traffic car out of traffic; parked/loose cars just change hands.
    const ti = this.traffic.cars.indexOf(c);
    if (ti >= 0) this.traffic.cars.splice(ti, 1);
    const pi = this.parked.indexOf(c);
    if (pi >= 0) this.parked.splice(pi, 1);
    const li = this.looseCars.indexOf(c);
    if (li >= 0) this.looseCars.splice(li, 1);
    this.player.car = c instanceof DriveCar ? c : new DriveCar(c.mesh, c.x, c.z, c.heading);
    this.player.car.parked = false;
    this.player.mesh.visible = false;
    this.audio.setEngine(0, true);
    this.hud.setHint('WASD drive · E exit · 1/2/3 radio');
    if (c.isVan) {
      this.police.setStars(3);
      this.hud.message('The whole precinct is coming. Get the van to the safehouse!');
    } else if (!this.missions.active) {
      this.police.addHeat(0.2);
      this.hud.message('Car stolen. Keep it clean.');
    }
    return true;
  }
  exitCar() {
    const c = this.player.car;
    if (!c) return;
    this.player.car = null;
    this.player.x = c.x + Math.cos(c.heading) * 2.6;
    this.player.z = c.z - Math.sin(c.heading) * 2.6;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.visible = true;
    this.looseCars.push(c);
    this.audio.setEngine(0, false);
    this.hud.setHint('WASD move · Shift run · E enter car · Click shoot');
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'playing') this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  update(dt) {
    this.time += dt;
    const inp = this.input;
    const p = this.player;
    // Global keys.
    if (inp.pressed('KeyM')) { const m = this.audio.toggleMute(); this.hud.message(m ? 'Sound muted' : 'Sound on'); }
    if (inp.pressed('Digit1')) { this.audio.setRadio(0); this.hud.setRadio(RADIO[0].name); }
    if (inp.pressed('Digit2')) { this.audio.setRadio(1); this.hud.setRadio(RADIO[1].name); }
    if (inp.pressed('Digit3')) { this.audio.setRadio(2); this.hud.setRadio(RADIO[2].name); }
    if (inp.pressed('KeyP') || inp.pressed('Escape')) { this.state = 'paused'; this.hud.show('paused'); return; }
    if (inp.pressed('KeyE')) {
      this.ePressed = true;
      if (p.car) this.exitCar();
      else this.tryEnterCar();
    }
    if (inp.clicked && !p.car) this.combat.shoot(this.audio);

    const axis = inp.axis();
    if (p.car) {
      const others = [...this.traffic.cars, ...this.parked, ...this.looseCars, ...this.police.cars];
      p.car.update(dt, axis, this.city.colliders, others);
      p.x = p.car.x; p.z = p.car.z;
      this.audio.setEngine(Math.abs(p.car.speed) / CAR.maxSpeed, true);
      // Ram the chase target.
      if (this.chaseCar && this.chaseCar !== p.car) {
        const cc = this.chaseCar;
        cc.ramCooldown -= dt;
        const d = Math.hypot(cc.x - p.car.x, cc.z - p.car.z);
        if (d < 3.6 && cc.ramCooldown <= 0) {
          cc.hp -= 25; cc.ramCooldown = 1.2;
          this.audio.noise(0.2, 0.3, 300);
          this.hud.message(`Ram him! Sedan integrity ${Math.max(0, cc.hp)}%`);
          if (cc.hp <= 0) {
            cc.speed = 0;
            this.hud.message('The sedan stalls. The informant talks.');
          }
        }
      }
      // Police ram slows the player car (handled after police.update below).
    } else {
      // On foot: move relative to camera yaw.
      const run = inp.down('ShiftLeft') || inp.down('ShiftRight');
      const speed = run ? 10 : 6;
      const sin = Math.sin(this.cam.yaw), cos = Math.cos(this.cam.yaw);
      let mx = 0, mz = 0;
      if (axis.y !== 0 || axis.x !== 0) {
        // Forward = camera look direction (sin yaw, cos yaw); right = (-cos yaw, sin yaw).
        mx = sin * axis.y + -cos * axis.x;
        mz = cos * axis.y + sin * axis.x;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len; mz /= len;
        p.moving = true;
        p.heading = Math.atan2(mx, mz);
      } else p.moving = false;
      let nx = p.x + mx * speed * dt;
      let nz = p.z + mz * speed * dt;
      for (const b of this.city.colliders) {
        const hit = collideCircleAABB(nx, nz, 0.6, b);
        if (hit) { nx = hit.x; nz = hit.z; }
      }
      for (const c of [...this.traffic.cars, ...this.parked, ...this.looseCars]) {
        const dx = nx - c.x, dz = nz - c.z, d2 = dx * dx + dz * dz;
        if (d2 < 4.4 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = c.x + (dx / d) * 2.1; nz = c.z + (dz / d) * 2.1;
        }
      }
      p.x = clamp(nx, -290, 290); p.z = clamp(nz, -250, 290);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Walk animation: swing legs and arms.
      if (p.moving) {
        p.walkPhase += dt * (run ? 11 : 8);
        const s = Math.sin(p.walkPhase) * 0.55;
        p.mesh.getObjectByName('legL').rotation.x = s;
        p.mesh.getObjectByName('legR').rotation.x = -s;
        p.mesh.getObjectByName('armL').rotation.x = -s * 0.7;
        p.mesh.getObjectByName('armR').rotation.x = s * 0.7;
      }
      this.audio.setEngine(0, false);
    }

    // Chase car AI: flee along roads away from the player.
    if (this.chaseCar && this.chaseCar.hp > 0) {
      const cc = this.chaseCar;
      const dx = cc.x - p.x, dz = cc.z - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let dh = want - cc.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      cc.heading += clamp(dh, -1.4 * dt, 1.4 * dt);
      cc.speed = Math.min(30, cc.speed + 12 * dt);
      let nx = cc.x + Math.sin(cc.heading) * cc.speed * dt;
      let nz = cc.z + Math.cos(cc.heading) * cc.speed * dt;
      for (const b of this.city.colliders) {
        const hit = collideCircleAABB(nx, nz, 1.6, b);
        if (hit) { nx = hit.x; nz = hit.z; cc.speed *= 0.5; }
      }
      cc.x = clamp(nx, -290, 290); cc.z = clamp(nz, -250, 290);
      cc.mesh.position.set(cc.x, 0, cc.z);
      cc.mesh.rotation.y = cc.heading;
    }

    this.traffic.update(dt, p.car);
    const ramHit = { hit: false };
    this.police.update(dt, { x: p.x, z: p.z }, !!p.car, ramHit);
    if (ramHit.hit && p.car) p.car.speed *= 0.7;
    this.combat.update(dt, { x: p.x, z: p.z });
    this.missions.update(dt);

    // Camera follows the player (or the car) — unless a screenshot pose froze it.
    const target = { x: p.x, y: 0, z: p.z };
    if (!this.shotCam) {
      this.cam.update(dt, target, !!p.car, p.car ? Math.abs(p.car.speed) / CAR.maxSpeed : 0, inp);
    }

    // HUD.
    this.hud.setHealth(p.health);
    this.hud.setStars(this.police.stars);
    this.hud.setSpeed(p.car ? p.car.speed * 3.6 : 0, !!p.car);
    const m = this.missions.current();
    if (this.missions.active && m) {
      let timer = '';
      const s = this.missions.currentStep();
      if (s && s.type === 'survive') timer = `${Math.ceil(this.missions.timer)}s`;
      if (s && s.type === 'deliver') timer = `${Math.max(0, Math.ceil(s.time - this.missions.timer))}s`;
      this.hud.setMission(`#${m.id} ${m.name} — ${m.giver}`, this.missions.stepText(), timer);
    } else if (m) {
      this.hud.setMission('Porto Vela — free roam', 'Press Enter or click Start to run the next job. Talk to Mara at the safehouse.', '');
    } else {
      this.hud.setMission('Porto Vela', 'All jobs complete.', '');
    }
    this.hud.drawMinimap({
      px: p.x, pz: p.z, heading: p.car ? p.car.heading : p.heading,
      marker: this.missions.markerPos,
      police: [...this.police.cars, ...this.police.cops],
      enemies: this.combat.enemies,
    });
    // Start next mission with Enter when idle.
    if (!this.missions.active && m && inp.pressed('Enter')) this.missions.start(this.missions.index);
    // Periodic autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 15) { this.saveTimer = 0; this.saveGame(); }
    // Slow health regen out of combat.
    if (this.combat.enemies.length === 0 && this.police.stars === 0 && p.health < 100) {
      p.health = Math.min(100, p.health + dt * 2);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));
  try {
    window.__game = new Game();
  } catch (err) {
    document.title = 'GAME-ERROR';
    const el = document.getElementById('fatal');
    if (el) { el.style.display = 'block'; el.textContent = `Failed to start: ${err.message}`; }
    console.error(err);
  }
});
