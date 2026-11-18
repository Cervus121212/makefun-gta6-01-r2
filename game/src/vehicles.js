// Cars: mesh factory, arcade driving physics, traffic AI on the road grid.
import * as THREE from '../vendor/three/three.module.min.js';
import { CAR } from './config.js';
import { ROAD_LINES, nearestRoadPoint } from './city.js';
import { mulberry32, range, int, pick, clamp, collideCircleAABB } from './random.js';

const BODY_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3a9a4a, 0x8a8f96, 0x22242a, 0xe8e4da, 0x7a4a9a, 0xd07028];

export function createCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), darkMat);
  cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe98a });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    h.position.set(sx, 0.7, 2.22); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xc02020, emissive: 0x800000 }));
    t.position.set(sx, 0.7, -2.22); g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xff2020 }));
    bar.position.set(0, 1.72, -0.2); g.add(bar);
    g.userData.lightBar = bar;
    const decal = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    decal.position.set(0, 0.65, 0); g.add(decal);
  }
  if (opts.van) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 3.4),
      new THREE.MeshLambertMaterial({ color: 0xd8d4c8 }));
    box.position.set(0, 1.35, -0.3); g.add(box);
  }
  g.userData.wheels = wheels;
  return g;
}

// One drivable car: arcade physics, building collision, car-vs-car push.
export class DriveCar {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh; this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0; this.hp = 100;
    mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  }
  update(dt, input, colliders, others) {
    const fwd = input.y, turn = input.x;
    if (fwd > 0) this.speed += CAR.accel * dt;
    else if (fwd < 0) this.speed -= (this.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    this.speed = clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steerTarget = turn * (this.speed >= 0 ? 1 : -1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    this.heading += this.steer * CAR.turn * dt * clamp(Math.abs(this.speed) / 8, 0.15, 1) * (this.speed >= 0 ? 1 : -1);
    let nx = this.x + Math.sin(this.heading) * this.speed * dt;
    let nz = this.z + Math.cos(this.heading) * this.speed * dt;
    for (const b of colliders) {
      const hit = collideCircleAABB(nx, nz, CAR.radius, b);
      if (hit) { nx = hit.x; nz = hit.z; this.speed *= 0.4; }
    }
    // keep inside the map
    nx = clamp(nx, -290, 290); nz = clamp(nz, -250, 290);
    for (const o of others || []) {
      if (o === this) continue;
      const dx = nx - o.x, dz = nz - o.z, d2 = dx * dx + dz * dz;
      if (d2 < 12 && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (3.5 - d) / 2;
        nx += (dx / d) * push; nz += (dz / d) * push;
        this.speed *= 0.85;
      }
    }
    this.x = nx; this.z = nz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt * 2.4;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}

export class Traffic {
  constructor(scene, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.cars = [];
    this.rng = mulberry32(1234);
    for (let i = 0; i < 14; i++) this.spawn();
  }
  spawn() {
    const rng = this.rng;
    const vertical = rng() < 0.5;
    const road = pick(rng, ROAD_LINES);
    const along = range(rng, -220, 240);
    const lane = range(rng, -3, 3);
    const x = vertical ? road + lane : along;
    const z = vertical ? along : road + lane;
    const heading = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const mesh = createCarMesh(pick(rng, BODY_COLORS));
    this.scene.add(mesh);
    const car = {
      mesh, x, z, heading, speed: range(rng, 8, 14), vertical,
      road, targetSpeed: range(rng, 9, 15), stuck: 0,
    };
    this.cars.push(car);
    return car;
  }
  update(dt, playerCar) {
    for (const c of this.cars) {
      // At an intersection, sometimes turn onto the crossing road.
      const nearX = ROAD_LINES.reduce((a, r) => (Math.abs(r - c.x) < Math.abs(a - c.x) ? r : a));
      const nearZ = ROAD_LINES.reduce((a, r) => (Math.abs(r - c.z) < Math.abs(a - c.z) ? r : a));
      const atCross = Math.abs(c.x - nearX) < 4 && Math.abs(c.z - nearZ) < 4;
      if (atCross && this.rng() < dt * 0.5) {
        c.vertical = !c.vertical;
        c.heading = c.vertical ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
      // Slow down for the car ahead on the same road.
      let want = c.targetSpeed;
      for (const o of this.cars) {
        if (o === c || o.vertical !== c.vertical) continue;
        const ahead = c.vertical
          ? (Math.sin(c.heading) > 0 ? o.z - c.z : c.z - o.z)
          : (Math.cos(c.heading) > 0 ? o.x - c.x : c.x - o.x);
        const lateral = c.vertical ? Math.abs(o.x - c.x) : Math.abs(o.z - c.z);
        if (ahead > 0 && ahead < 12 && lateral < 3) want = 0;
      }
      if (playerCar) {
        const dx = playerCar.x - c.x, dz = playerCar.z - c.z;
        if (dx * dx + dz * dz < 100) want = Math.min(want, 4);
      }
      c.speed += (want - c.speed) * Math.min(1, dt * 2);
      let nx = c.x + Math.sin(c.heading) * c.speed * dt;
      let nz = c.z + Math.cos(c.heading) * c.speed * dt;
      // Snap back onto the road centreline if drifted.
      const snap = nearestRoadPoint(nx, nz);
      if (c.vertical) nx = snap.x; else nz = snap.z;
      if (Math.abs(nx) > 245 || Math.abs(nz) > 285) { // wrap around the map edge
        nx = -nx * 0.9; nz = -nz * 0.9;
      }
      c.x = nx; c.z = nz;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      const spin = c.speed * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
  // Parked stealable cars near the player, for mission 1 and free roam.
  spawnParked(scene, x, z, heading, color) {
    const mesh = createCarMesh(color ?? pick(this.rng, BODY_COLORS));
    scene.add(mesh);
    const car = new DriveCar(mesh, x, z, heading);
    car.parked = true;
    return car;
  }
}
