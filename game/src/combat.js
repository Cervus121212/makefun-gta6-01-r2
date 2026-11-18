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
    this.flash = null;
    this.flashT = 0;
  }
  spawnEnemy(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x7a2020 }));
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshLambertMaterial({ color: 0xc89868 }));
    head.position.y = 1.9; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.2, 0.4); g.add(gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { mesh: g, x, z, hp: 100, shootT: range(this.rng, 1, 2.5), strafe: range(this.rng, -1, 1) };
    this.enemies.push(e);
    return e;
  }
  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }
  shoot(audio) {
    if (this.cooldown > 0) return false;
    this.cooldown = 0.28;
    if (audio) audio.gunshot();
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const targets = this.enemies.map((e) => e.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== this.scene) obj = obj.parent;
      const e = this.enemies.find((en) => en.mesh === obj);
      if (e) {
        e.hp -= 34;
        this.muzzle(e.x, e.z);
        if (e.hp <= 0) {
          this.scene.remove(e.mesh);
          this.enemies.splice(this.enemies.indexOf(e), 1);
          if (this.onEnemyDown) this.onEnemyDown(e);
        }
        return true;
      }
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
    for (const e of this.enemies) {
      const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      // Strafe slowly, keep ~14m distance, face the player.
      e.strafe += (this.rng() - 0.5) * dt;
      e.x += clamp(e.strafe, -1, 1) * dt * 1.5;
      if (dist > 16) { e.x += (dx / dist) * dt * 2; e.z += (dz / dist) * dt * 2; }
      if (dist < 8) { e.x -= (dx / dist) * dt * 2; e.z -= (dz / dist) * dt * 2; }
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
