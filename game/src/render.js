// Three.js scene: golden-hour lighting, sky gradient, chase camera.
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, lerp } from './random.js';

export function createRenderer(canvas, lowfx = false) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx });
  renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !lowfx;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene(lowfx = false) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2c184, 260, 620);
  // Sky: big gradient dome via vertex-coloured sphere (cheap, no texture).
  const skyGeo = new THREE.SphereGeometry(800, 16, 12);
  const colors = [];
  const top = new THREE.Color(0x7fb2e0), mid = new THREE.Color(0xf2c184), bot = new THREE.Color(0xe08a5a);
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 800;
    const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(bot, 1 - (y + 1) / 1.25);
    colors.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffe0b0, 0x3a4a5a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(-80, 130, 200); // low southern sun: sunset over the sea, lit north faces
  sun.castShadow = !lowfx;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  return { scene, sun };
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;      // behind the player looking north
    this.pitch = 0.32;
    this.dist = 11;
    this.pos = new THREE.Vector3(0, 8, 30);
    this.look = new THREE.Vector3(0, 1.5, 0);
  }
  update(dt, target, inCar, speed01, input) {
    // Mouse drag orbits; wheel zooms.
    this.yaw -= (input.mouseDX || 0) * 0.004;
    this.pitch = clamp(this.pitch + (input.mouseDY || 0) * 0.003, 0.08, 1.1);
    if (input.wheel) this.dist = clamp(this.dist + input.wheel * 0.01, 6, 20);
    const wantDist = inCar ? this.dist + speed01 * 4 : this.dist;
    const cx = target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * wantDist;
    const cz = target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * wantDist;
    const cy = target.y + 2 + Math.sin(this.pitch) * wantDist;
    const k = 1 - Math.exp(-dt * (inCar ? 5 : 8));
    this.pos.x = lerp(this.pos.x, cx, k);
    this.pos.y = lerp(this.pos.y, cy, k);
    this.pos.z = lerp(this.pos.z, cz, k);
    this.look.x = lerp(this.look.x, target.x, k);
    this.look.y = lerp(this.look.y, target.y + 1.6, k);
    this.look.z = lerp(this.look.z, target.z, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
  // For screenshot poses: snap the camera to an exact transform.
  snap(x, y, z, lx, ly, lz) {
    this.pos.set(x, y, z); this.look.set(lx, ly, lz);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
