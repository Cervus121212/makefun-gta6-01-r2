// Story mission state machine: steps, beacon markers, rewards, save progress.
import * as THREE from '../vendor/three/three.module.min.js';
import { MISSIONS } from './config.js';

export class MissionManager {
  constructor(scene, hooks) {
    this.scene = scene; this.hooks = hooks; // {getPos, getCar, spawnEnemies, setWanted, onPass, onFail, log}
    this.index = 0;          // mission index (0-based)
    this.step = 0;
    this.active = false;
    this.timer = 0;
    this.killsLeft = 0;
    this.chaseTarget = null;
    this.beacon = null;
    this.beaconMat = null;
    this.markerPos = null;
    this.completed = new Set();
  }
  current() { return MISSIONS[this.index] || null; }
  currentStep() { const m = this.current(); return m ? m.steps[this.step] : null; }
  stepText() {
    const s = this.currentStep();
    if (!s) return '';
    if (s.type === 'kill') return `${s.text.replace(/\(\d+ left\)/, '')} (${this.killsLeft} left)`;
    return s.text;
  }
  start(idx) {
    this.index = idx; this.step = 0; this.active = true; this.timer = 0;
    this.hooks.log(`Mission ${MISSIONS[idx].id}: ${MISSIONS[idx].name} — ${MISSIONS[idx].brief}`);
    this.enterStep();
  }
  enterStep() {
    const s = this.currentStep();
    if (!s) { this.completeMission(); return; }
    this.timer = 0;
    this.hideBeacon();
    if (s.type === 'goto' || s.type === 'deliver') {
      this.markerPos = { x: s.at[0], z: s.at[1] };
      this.showBeacon(s.at[0], s.at[1]);
    } else if (s.type === 'pickup') {
      const p = this.hooks.getPos();
      this.markerPos = { x: p.x, z: p.z };
      this.showBeacon(p.x, p.z);
    } else if (s.type === 'kill') {
      this.killsLeft = s.count;
      // Line up on the open apron (x 254..274), in the gaps between container
      // rows, so no rival spawns inside a container.
      const zs = [-12, -4, 4, 12];
      for (let i = 0; i < s.count; i++) {
        this.hooks.spawnEnemies(s.at[0], s.at[1] + zs[i % zs.length]);
      }
      this.markerPos = { x: s.at[0], z: s.at[1] };
      this.showBeacon(s.at[0], s.at[1]);
    } else if (s.type === 'wanted') {
      this.hooks.setWanted(s.stars);
    } else if (s.type === 'chase') {
      this.chaseTarget = this.hooks.spawnChaseCar();
    } else if (s.type === 'survive') {
      this.timer = s.time;
    } else if (s.type === 'deliver') {
      this.timer = 0; // counts UP; fail when it passes s.time
    }
  }
  showBeacon(x, z) {
    this.hideBeacon();
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true);
    this.beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, this.beaconMat);
    this.beacon.position.set(x, 15, z);
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.1, z);
    this.beacon.add(ring);
  }
  hideBeacon() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; this.beaconMat = null; }
  }
  advance() {
    this.step++;
    if (this.step >= this.current().steps.length) this.completeMission();
    else this.enterStep();
  }
  completeMission() {
    const m = this.current();
    this.active = false; this.hideBeacon();
    this.completed.add(m.id);
    this.hooks.onPass(m);
    this.index++;
    if (this.index >= MISSIONS.length) this.hooks.onAllDone();
  }
  // Called every frame while a mission is active.
  update(dt) {
    if (!this.active) return;
    const s = this.currentStep();
    if (!s) return;
    const p = this.hooks.getPos();
    if (this.beacon) this.beacon.rotation.y += dt * 1.2;
    switch (s.type) {
      case 'goto':
      case 'deliver': {
        if (s.type === 'deliver') {
          this.timer += dt;
          if (this.timer > s.time) { this.hooks.onFail('Out of time!'); this.active = false; return; }
        }
        const d = Math.hypot(p.x - s.at[0], p.z - s.at[1]);
        if (d < s.r) this.advance();
        break;
      }
      case 'pickup': {
        // Marker sits where the player stood when the step began; allow E within 3m.
        if (this.markerPos && Math.hypot(p.x - this.markerPos.x, p.z - this.markerPos.z) < 3 && this.hooks.consumeE()) {
          this.hooks.onPickup();
          this.advance();
        }
        break;
      }
      case 'steal': {
        const car = this.hooks.getCar();
        if (car) this.advance();
        break;
      }
      case 'wanted': {
        this.advance();
        break;
      }
      case 'escape': {
        if (this.hooks.getStars() === 0) this.advance();
        break;
      }
      case 'kill': {
        if (this.killsLeft <= 0) this.advance();
        break;
      }
      case 'chase': {
        if (!this.chaseTarget || this.chaseTarget.hp <= 0) this.advance();
        break;
      }
      case 'survive': {
        this.timer -= dt;
        if (this.timer <= 0) this.advance();
        break;
      }
      default: break;
    }
  }
  onEnemyDown() { if (this.killsLeft > 0) this.killsLeft--; }
  // Save/load: completed mission ids + cash handled by main.
  saveState() { return { completed: [...this.completed], next: this.index }; }
  loadState(st) {
    if (!st) return;
    this.completed = new Set(st.completed || []);
    this.index = st.next || 0;
  }
}
