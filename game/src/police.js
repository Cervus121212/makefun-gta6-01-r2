// Wanted system: stars, police chasers, foot cops, helicopter at 3+ stars, BUSTED/WASTED.
import * as THREE from '../vendor/three/three.module.min.js';
import { createCarMesh } from './vehicles.js';
import { mulberry32, range, clamp, collideCircleAABB } from './random.js';

export class Police {
  constructor(scene, colliders, getPlayer) {
    this.scene = scene; this.colliders = colliders; this.getPlayer = getPlayer;
    this.stars = 0; this.heat = 0; // heat 0..1 within the current star level
    this.cars = []; this.cops = []; this.heli = null; this.heliRotor = null;
    this.rng = mulberry32(99);
    this.bustedT = 0; this.flashT = 0;
    this.heliAngle = 0; // orbit angle, advanced by dt (not wall clock) so poses can stage it
    this.onBusted = null; this.onWasted = null;
  }
  setStars(n) {
    this.stars = clamp(Math.round(n), 0, 5);
    this.heat = this.stars > 0 ? 0.6 : 0;
    this.syncUnits();
  }
  addHeat(v) { if (this.stars < 5) { this.heat += v; if (this.heat >= 1) { this.stars++; this.heat = 0; this.syncUnits(); } } }
  syncUnits() {
    const wantCars = this.stars === 0 ? 0 : Math.min(1 + this.stars, 5);
    while (this.cars.length < wantCars) this.spawnCar();
    while (this.cars.length > wantCars) this.removeCar(this.cars[0]);
    const wantCops = this.stars >= 2 ? 2 : 0;
    while (this.cops.length < wantCops) this.spawnCop();
    while (this.cops.length > wantCops) this.removeCop(this.cops[0]);
    if (this.stars >= 3 && !this.heli) this.spawnHeli();
    if (this.stars < 3 && this.heli) { this.scene.remove(this.heli); this.heli = null; this.heliRotor = null; this.heliCone = null; }
  }
  // Distance to the nearest police unit — drives siren volume in main.
  nearestDist(playerPos) {
    let nearest = Infinity;
    for (const c of this.cars) nearest = Math.min(nearest, Math.hypot(c.x - playerPos.x, c.z - playerPos.z));
    for (const c of this.cops) nearest = Math.min(nearest, Math.hypot(c.x - playerPos.x, c.z - playerPos.z));
    if (this.heli) nearest = Math.min(nearest, Math.hypot(this.heli.position.x - playerPos.x, this.heli.position.z - playerPos.z));
    return nearest;
  }
  spawnCar() {
    const p = this.getPlayer();
    const ang = this.rng() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(ang) * 70, -240, 240);
    const z = clamp(p.z + Math.sin(ang) * 70, -240, 280);
    const mesh = createCarMesh(0xf2f2f2, { police: true });
    this.scene.add(mesh);
    this.cars.push({ mesh, x, z, heading: 0, speed: 0 });
  }
  removeCar(c) { this.scene.remove(c.mesh); this.cars.splice(this.cars.indexOf(c), 1); }
  spawnCop() {
    const p = this.getPlayer();
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1a2a6e }));
    body.position.y = 1.1; mesh.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshLambertMaterial({ color: 0xd8a070 }));
    head.position.y = 1.9; mesh.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x0a1a4e }));
    cap.position.y = 2.15; mesh.add(cap);
    this.scene.add(mesh);
    this.cops.push({ mesh, x: p.x + range(this.rng, -25, 25), z: p.z + range(this.rng, -25, 25), speed: 5.2 });
  }
  removeCop(c) { this.scene.remove(c.mesh); this.cops.splice(this.cops.indexOf(c), 1); }
  spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 5),
      new THREE.MeshLambertMaterial({ color: 0x2a3a4a }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5),
      new THREE.MeshLambertMaterial({ color: 0x2a3a4a }));
    tail.position.set(0, 0.3, -4.5); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor);
    this.heliRotor = rotor;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 12, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    cone.rotation.x = Math.PI; cone.position.y = -14; g.add(cone);
    this.heliCone = cone;
    this.scene.add(g);
    this.heli = g;
  }
  update(dt, playerPos, playerInCar, playerSpeed) {
    // Wanted decay: only when the player is far from every police unit.
    if (this.stars > 0) {
      let nearest = Infinity;
      for (const c of this.cars) nearest = Math.min(nearest, Math.hypot(c.x - playerPos.x, c.z - playerPos.z));
      for (const c of this.cops) nearest = Math.min(nearest, Math.hypot(c.x - playerPos.x, c.z - playerPos.z));
      if (nearest > 55) {
        this.heat -= dt * 0.06;
        if (this.heat <= 0) { this.stars--; this.heat = this.stars > 0 ? 0.8 : 0; this.syncUnits(); }
      } else {
        this.heat = Math.min(1, this.heat + dt * 0.01);
      }
    }
    // Police cars chase and ram.
    for (const c of this.cars) {
      const dx = playerPos.x - c.x, dz = playerPos.z - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
      const target = dist > 60 ? 34 : 30;
      c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
      let nx = c.x + Math.sin(c.heading) * c.speed * dt;
      let nz = c.z + Math.cos(c.heading) * c.speed * dt;
      for (const b of this.colliders) {
        const hit = collideCircleAABB(nx, nz, 1.6, b);
        if (hit) { nx = hit.x; nz = hit.z; c.speed *= 0.5; }
      }
      c.x = clamp(nx, -290, 290); c.z = clamp(nz, -250, 290);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Ram: slow the player car on contact, damage on foot.
      if (dist < 3.4) {
        if (playerInCar && playerSpeed !== undefined) playerSpeed.hit = true;
        if (!playerInCar) this.bustedT += dt;
      }
      // Flash the light bar.
      this.flashT += dt;
      if (c.mesh.userData.lightBar) {
        const on = Math.floor(this.flashT * 4) % 2 === 0;
        c.mesh.userData.lightBar.material.emissive.setHex(on ? 0xff2020 : 0x2020ff);
      }
    }
    // Foot cops run at the player; close contact on foot = BUSTED.
    for (const c of this.cops) {
      const dx = playerPos.x - c.x, dz = playerPos.z - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      c.x += (dx / dist) * c.speed * dt;
      c.z += (dz / dist) * c.speed * dt;
      c.mesh.position.set(c.x, Math.abs(Math.sin(performance.now() * 0.012)) * 0.08, c.z);
      c.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist < 1.6 && !playerInCar) {
        this.bustedT += dt;
        if (this.bustedT > 1.2 && this.onBusted) this.onBusted();
      }
    }
    if (this.cops.length === 0 && this.cars.length > 0) this.bustedT = Math.max(0, this.bustedT - dt);
    // Helicopter circles above the player, searchlight sweeping the ground.
    if (this.heli) {
      this.heliAngle += dt * 0.4;
      const t = this.heliAngle;
      this.heli.position.set(playerPos.x + Math.cos(t) * 18, 34 + Math.sin(t * 2.3) * 1.2, playerPos.z + Math.sin(t) * 18);
      this.heli.rotation.y = Math.atan2(playerPos.x - this.heli.position.x, playerPos.z - this.heli.position.z);
      if (this.heliRotor) this.heliRotor.rotation.y += dt * 22;
      // The searchlight cone sways side to side, hunting for the player.
      if (this.heliCone) this.heliCone.rotation.z = Math.sin(this.heliAngle * 2.75) * 0.35;
    }
  }
}
