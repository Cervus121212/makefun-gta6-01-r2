// Combat: player pistol (raycast from camera centre), enemy NPCs that shoot back.
import * as THREE from '../vendor/three/three.module.min.js';
import { mulberry32, range, clamp } from './random.js';

export class Combat {
  constructor(scene, camera, getPlayerPos) {
    this.scene = scene; this.camera = camera; this.getPlayerPos = getPlayerPos;
    this.enemies = [];
    this.raycaster = new THREE.Raycaster();
    this.rng = mulberry32(777);
    this.onPlayerHit = null; // (dmg) => void
    this.onEnemyDown = null; // (enemy) => void
    this.cooldown = 0;
    // Weapons: pistol (infinite, 34 dmg) + SMG pickup (120 rounds, 18 dmg,
    // fast fire). Slots 3-4 are locked teasers — see the HUD.
    this.weapon = 'pistol';
    this.hasSmg = false;
    this.ammoSmg = 0;
    this.flash = null;
    this.flashT = 0;
    this.tracer = null;
    this.tracerT = 0;
  }
  spawnEnemy(x, z) {
    const g = new THREE.Group();
    // Rival crew: vivid red jacket + a bright yellow cap, so they read
    // against the grey docks apron at a glance instead of blending into it.
    // The cap is emissive (not a light), so it costs nothing at dusk.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xc22a2a }));
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshLambertMaterial({ color: 0xc89868 }));
    head.position.y = 1.9; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x8a6d00 }));
    cap.position.y = 2.2; g.add(cap);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.2, 0.4); g.add(gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { mesh: g, x, z, hp: 100, shootT: range(this.rng, 1, 2.5), strafe: range(this.rng, -1, 1), hitFlash: 0 };
    this.enemies.push(e);
    return e;
  }
  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }
  setWeapon(name) {
    if (name === 'smg' && (!this.hasSmg || this.ammoSmg <= 0)) return false;
    this.weapon = name === 'smg' ? 'smg' : 'pistol';
    return true;
  }
  giveSmg() {
    this.hasSmg = true;
    this.ammoSmg = 120;
    this.weapon = 'smg';
  }
  weaponState() {
    return { weapon: this.weapon, hasSmg: this.hasSmg, ammoSmg: this.ammoSmg };
  }
  shoot(audio) {
    if (this.cooldown > 0) return false;
    if (this.weapon === 'smg' && this.ammoSmg <= 0) { this.setWeapon('pistol'); return false; }
    const w = this.weapon === 'smg' ? { dmg: 18, cd: 0.09 } : { dmg: 34, cd: 0.28 };
    if (this.weapon === 'smg') {
      this.ammoSmg--;
      // Ran dry on this shot: fall back to the pistol automatically.
      if (this.ammoSmg <= 0) this.setWeapon('pistol');
    }
    this.cooldown = w.cd;
    if (audio) audio.gunshot();
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const targets = this.enemies.map((e) => e.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    let hitEnemy = null;
    let hitPoint = null;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== this.scene) obj = obj.parent;
      hitEnemy = this.enemies.find((en) => en.mesh === obj) || null;
      hitPoint = hits[0].point.clone();
    }
    if (!hitEnemy) {
      // Aim assist: the chase camera sits above and behind the player, so a
      // centred crosshair can pass just over a rival's shoulder at range even
      // when the player is aiming straight at them. If the ray misses, the
      // closest rival inside a small cone around the ray still counts as a
      // hit — same damage, same tracer and hit-flash feedback.
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      const origin = this.camera.position;
      const to = new THREE.Vector3();
      let best = null, bestAng = 0.09; // ~5 degrees
      for (const e of this.enemies) {
        to.set(e.x - origin.x, 1.2 - origin.y, e.z - origin.z);
        const dist = to.length();
        if (dist > 45) continue;
        const ang = dir.angleTo(to.normalize());
        if (ang < bestAng) { bestAng = ang; best = e; }
      }
      if (best) {
        hitEnemy = best;
        hitPoint = new THREE.Vector3(best.x, 1.2, best.z);
      }
    }
    // Tracer: a brief bright line from the camera to the impact (or to the
    // horizon on a miss) so every shot reads, hit or not.
    const from = this.camera.position.clone();
    const to = hitPoint || from.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(60));
    if (!this.tracer) {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.9 }));
      this.scene.add(this.tracer);
    } else {
      this.tracer.geometry.setFromPoints([from, to]);
    }
    this.tracer.visible = true;
    this.tracerT = 0.07;
    if (hitEnemy) {
      const e = hitEnemy;
      e.hp -= w.dmg;
      e.hitFlash = 0.18; // the rival flashes white-red so the hit is unmistakable
      this.muzzle(e.x, e.z);
      if (e.hp <= 0) {
        this.scene.remove(e.mesh);
        this.enemies.splice(this.enemies.indexOf(e), 1);
        if (this.onEnemyDown) this.onEnemyDown(e);
      }
      return true;
    }
    return false;
  }
  muzzle(x, z) {
    if (!this.flash) {
      this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe98a }));
      this.scene.add(this.flash);
    }
    this.flash.position.set(x, 1.4, z);
    this.flash.visible = true;
    this.flashT = 0.08;
  }
  update(dt, playerPos) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.flash) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    if (this.tracer) {
      this.tracerT -= dt;
      if (this.tracerT <= 0) this.tracer.visible = false;
    }
    for (const e of this.enemies) {
      // Hit flash: body glows for 0.18s after a hit, then settles back.
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        e.mesh.children[0].material.emissive.setHex(0xaa2020);
        if (e.hitFlash <= 0) e.mesh.children[0].material.emissive.setHex(0x000000);
      }
      const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      // Strafe slowly and keep ~9m: close enough that the player's crosshair
      // stays on a torso, far enough to still feel like a gunfight.
      e.strafe += (this.rng() - 0.5) * dt * 0.6;
      e.x += clamp(e.strafe, -0.7, 0.7) * dt * 0.9;
      if (dist > 12) { e.x += (dx / dist) * dt * 2; e.z += (dz / dist) * dt * 2; }
      if (dist < 6) { e.x -= (dx / dist) * dt * 2; e.z -= (dz / dist) * dt * 2; }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < 40) {
        e.shootT = range(this.rng, 1.2, 2.6);
        // Hit chance falls with distance; a hit costs 8 HP.
        if (this.rng() < clamp(0.55 - dist * 0.01, 0.12, 0.55) && this.onPlayerHit) this.onPlayerHit(8);
      }
    }
  }
}
