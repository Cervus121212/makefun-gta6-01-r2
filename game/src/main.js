// Porto Vela — main loop: player, cars, police, missions, HUD, save, shots, autopilot.
import * as THREE from '../vendor/three/three.module.min.js';
import { WORLD, MISSIONS, RADIO, STORY_INTRO, CAR, districtAt, streetAt, repFor } from './config.js';
import { mulberry32, range, pick, clamp, collideCircleAABB } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { createCarMesh, DriveCar, Traffic, Pedestrians } from './vehicles.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { createRenderer, createScene, ChaseCamera, updateDaylight } from './render.js';
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
    const { scene, sun, skyMat, sunDisc } = createScene(this.lowfx);
    this.scene = scene; this.sun = sun; this.skyMat = skyMat; this.sunDisc = sunDisc;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
    this.cam = new ChaseCamera(this.camera);
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.city = buildCity(scene);
    this.traffic = new Traffic(scene, this.city.colliders);
    this.peds = new Pedestrians(scene, 12);
    this.districtTimer = 0;
    this.djLineIdx = [0, 0, 0]; // rotating DJ ident per station
    this.trackIdx = [0, 0, 0]; // rotating "now playing" track per station
    this.radioIdx = 0;
    this.armour = 0; // vest pickup: absorbs damage before health does
    this.pickups = []; // SMG crates + armour vest (see spawnPickups)
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
      onDebrief: (m) => this.hud.showDebrief(m),
      onFail: (why) => this.onMissionFail(why),
      onAllDone: () => this.onAllDone(),
      log: (t) => this.hud.message(t, 6000),
      onBark: (b) => this.hud.showDialog(b.who, b.text),
    });
    this.combat.onPlayerHit = (dmg) => this.damagePlayer(dmg);
    this.combat.onEnemyDown = () => this.missions.onEnemyDown();
    this.police.onBusted = () => this.busted();
    this.police.onWasted = () => this.wasted();
    // A cruiser clipping the player on foot costs 10 HP and shoves them out
    // of the road — a ram used to do nothing at all unless a foot cop was near.
    this.police.onRamFoot = (cx, cz) => {
      if (this.state !== 'playing' || this.player.car) return;
      const dx = this.player.x - cx, dz = this.player.z - cz;
      const d = Math.hypot(dx, dz) || 1;
      this.player.x = clamp(this.player.x + (dx / d) * 3, -290, 290);
      this.player.z = clamp(this.player.z + (dz / d) * 3, -250, 290);
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.damagePlayer(10);
      this.hud.message('A cruiser clipped you! Get out of the road!');
    };
    this.spawnParkedCars();
    this.spawnPickups();
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

  // Glowing pickups: SMG crates at the docks + the garage, an armour vest
  // by the safehouse door. Taken with E on foot; they bob and spin so the
  // player can spot them from across the street.
  spawnPickups() {
    const mk = (kind, x, z, color, emissive) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshLambertMaterial({ color, emissive }),
      );
      mesh.position.set(x, 0.9, z);
      this.scene.add(mesh);
      this.pickups.push({ kind, x, z, mesh, taken: false, phase: this.pickups.length * 2 });
    };
    mk('smg', 258, 88, 0x8a6d00, 0xffd23e);
    mk('smg', 138, -138, 0x8a6d00, 0xffd23e);
    mk('vest', -50, -168, 0x1a4a8a, 0x4dabf7);
  }
  tryTakePickup() {
    const p = this.player;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.z - p.z) > 3) continue;
      if (pk.kind === 'vest' && this.armour >= 100) continue;
      pk.taken = true;
      pk.mesh.visible = false;
      if (pk.kind === 'smg') {
        this.combat.giveSmg();
        this.hud.message('SMG picked up — 120 rounds. Press 2 to switch.');
      } else {
        this.armour = Math.min(100, this.armour + 50);
        this.hud.setArmour(this.armour);
        this.hud.message('Armour vest +50. It takes hits before you do.');
      }
      this.audio.pickup();
      return true;
    }
    return false;
  }

  // Game clock: day 1 starts 18:52, ~1 game minute per 10 real seconds.
  gameMinutes() { return 18 * 60 + 52 + Math.floor(this.time / 10); }
  clockText() {
    const mins = this.gameMinutes();
    const day = 1 + Math.floor(mins / 1440);
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `DAY ${day} ${hh}:${mm}`;
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
    this.audio.resumeRadio(); // the context may be brand new — restart the station
    const m = this.missions.current();
    if (m && !this.missions.active && this.missions.completed.size < MISSIONS.length) {
      this.missions.start(this.missions.index);
    }
    this.hud.setCash(this.cash);
  }
  // One place for station changes: audio + HUD station + rotating DJ ident
  // line + the "now playing" track (each station cycles its own playlist).
  setRadioStation(i) {
    this.radioIdx = i;
    this.audio.setRadio(i);
    this.hud.setRadio(RADIO[i].name);
    const lines = RADIO[i].lines || [];
    if (lines.length) {
      this.hud.setDjLine(lines[this.djLineIdx[i] % lines.length]);
      this.djLineIdx[i]++;
    } else {
      this.hud.setDjLine('');
    }
    const tracks = RADIO[i].tracks || [];
    if (tracks.length) {
      const t = tracks[this.trackIdx[i] % tracks.length];
      this.trackIdx[i]++;
      this.hud.setSong(`${t.title} — ${t.artist}`);
    } else {
      this.hud.setSong('');
    }
  }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this.hud.show('playing'); } }
  resetRun() {
    this.cash = 0; this.player.health = 100; this.armour = 0;
    this.hud.setArmour(0); // HUD syncs immediately, not a frame later
    this.combat.weapon = 'pistol'; this.combat.hasSmg = false; this.combat.ammoSmg = 0;
    for (const pk of this.pickups) { pk.taken = false; pk.mesh.visible = true; }
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
    // Armour takes hits first; only the remainder reaches health.
    const absorbed = Math.min(this.armour, dmg);
    this.armour -= absorbed;
    this.hud.setArmour(this.armour);
    const rest = dmg - absorbed;
    if (rest <= 0) return;
    this.player.health -= rest;
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
    // The car the player was driving is not lost: it stays where it stopped,
    // re-enterable, instead of vanishing from every list.
    if (this.player.car) { this.looseCars.push(this.player.car); this.player.car = null; }
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
      // A save written by WASTED holds health <= 0 — never load a dead
      // player; respawn at full health instead.
      const h = data.health || 100;
      this.player.health = h > 0 ? h : 100;
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
    this.hud.setHint('WASD drive · E exit · 1/2 weapons · R radio');
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
    if (inp.pressed('Digit1')) this.combat.setWeapon('pistol');
    if (inp.pressed('Digit2')) this.combat.setWeapon('smg');
    if (inp.pressed('KeyR')) this.setRadioStation((this.radioIdx + 1) % RADIO.length);
    if (inp.pressed('KeyP') || inp.pressed('Escape')) { this.state = 'paused'; this.hud.show('paused'); return; }
    if (inp.pressed('KeyE')) {
      // Pickups first (on foot only): a crate by the feet beats entering a car.
      const took = !p.car && this.tryTakePickup();
      if (!took) {
        this.ePressed = true;
        if (p.car) this.exitCar();
        else this.tryEnterCar();
      }
    }
    if (inp.clicked && !p.car) this.combat.shoot(this.audio);

    const axis = inp.axis(dt);
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
    this.peds.update(dt, { x: p.x, z: p.z }, p.car ? { x: p.car.x, z: p.car.z } : null);
    this.city.update(dt, this.time);
    // Dusk follows the game clock: 0 at 18:52, full dusk at 19:40.
    const duskT = clamp((this.gameMinutes() - 1132) / 48, 0, 1);
    updateDaylight(this.scene, this.sun, duskT, this.city.lampMat, this.skyMat, this.sunDisc);
    // Pickups bob and spin so they catch the eye.
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.mesh.position.y = 0.9 + Math.sin(this.time * 2 + pk.phase) * 0.25;
      pk.mesh.rotation.y += dt * 1.2;
    }
    const ramHit = { hit: false };
    this.police.update(dt, { x: p.x, z: p.z }, !!p.car, ramHit);
    // The siren was wired up in this polish pass: it follows the nearest unit.
    this.audio.setSiren(this.police.stars > 0, this.police.nearestDist({ x: p.x, z: p.z }));
    if (ramHit.hit && p.car) p.car.speed *= 0.7;
    this.combat.update(dt, { x: p.x, z: p.z });
    this.missions.update(dt);

    // Camera follows the player (or the car) — unless a screenshot pose froze it.
    const target = { x: p.x, y: 0, z: p.z };
    if (!this.shotCam) {
      this.cam.update(dt, target, !!p.car, p.car ? Math.abs(p.car.speed) / CAR.maxSpeed : 0, inp, p.car ? p.car.heading : undefined);
    }

    // HUD.
    this.hud.setHealth(p.health);
    this.hud.setArmour(this.armour);
    this.hud.setClock(this.clockText());
    this.hud.setRep(repFor(this.missions.completed.size, this.cash));
    this.hud.setCar(p.car ? p.car.name : '', p.car ? p.car.condition : 100, !!p.car);
    this.hud.setWeapons(this.combat.weaponState());
    this.hud.setStars(this.police.stars);
    // Crosshair only on foot — shooting is on-foot only.
    this.hud.setCrosshair(!p.car);
    // District + street label + police response panel, refreshed 4x a second
    // (cheap, and it never flickers).
    this.districtTimer += dt;
    if (this.districtTimer > 0.25) {
      this.districtTimer = 0;
      const street = streetAt(p.x, p.z);
      this.hud.setDistrict(street ? `${districtAt(p.x, p.z).name} · ${street}` : districtAt(p.x, p.z).name);
      this.hud.setResponse(this.police.responseList({ x: p.x, z: p.z }, p.car ? p.car.heading : p.heading), this.police.stars);
    }
    this.hud.setSpeed(p.car ? p.car.speed * 3.6 : 0, !!p.car);
    const m = this.missions.current();
    if (this.missions.active && m) {
      let timer = '';
      const s = this.missions.currentStep();
      if (s && s.type === 'survive') timer = `${Math.ceil(this.missions.timer)}s`;
      if (s && s.type === 'deliver') timer = `${Math.max(0, Math.ceil(s.time - this.missions.timer))}s`;
      this.hud.setMission(`#${m.id} ${m.name} — ${m.giver}`, this.missions.stepText(), timer, this.missions.stageInfo());
    } else if (m) {
      this.hud.setMission('Porto Vela — free roam', 'Press Enter or click Start to run the next job. Talk to Mara at the safehouse.', '', null);
    } else {
      this.hud.setMission('Porto Vela', 'All jobs complete.', '', null);
    }
    // Screen-reader status: the current job, kept in sync with the HUD.
    const statusText = (this.missions.active && m)
      ? `#${m.id} ${m.name} — ${this.missions.stepText()}`
      : (m ? 'Porto Vela — free roam. Next job available.' : 'Porto Vela — all jobs complete.');
    this.hud.setStatus(statusText);
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
