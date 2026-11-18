// Three.js scene: golden-hour lighting, sky gradient, chase camera.
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, lerp, damp, angleLerp, smoothstep } from './random.js';

// Golden hour slides toward dusk as the game clock advances: the sun sinks
// and reddens, the fog warms toward pink-purple, the sky tints, the
// streetlights matter more, and the low sun disc over the sea drops toward
// the water. Purely cosmetic; it never touches gameplay. duskT is 0 at
// 18:52 and 1 at 19:40 (see main.js gameMinutes()).
export function updateDaylight(scene, sun, duskT, lampMat, skyMat, sunDisc) {
  const t = smoothstep(0, 1, clamp(duskT, 0, 1));
  sun.intensity = lerp(1.6, 1.05, t);
  sun.color.setHex(0xffd9a0).lerp(_duskSun, t);
  scene.fog.color.setHex(0xf2c184).lerp(_duskFog, t);
  // Streetlight bulbs brighten as the sun goes down, so the city visibly
  // lights up at dusk instead of the lamps staying flat all session.
  if (lampMat) lampMat.emissiveIntensity = lerp(0.7, 2.4, t);
  // The sky dome tints pink-purple at dusk (its vertex colours are
  // multiplied by the material colour).
  if (skyMat) skyMat.color.setHex(0xffffff).lerp(_duskSky, t);
  // The sun sinks toward the sea and reddens as it sets.
  if (sunDisc) {
    sunDisc.position.y = lerp(34, 19, t);
    sunDisc.material.color.setHex(0xffc46b).lerp(_duskDisc, t);
  }
}
const _duskSun = new THREE.Color(0xff7a45);
const _duskFog = new THREE.Color(0xa85a7a);
const _duskSky = new THREE.Color(0xdd99bb);
const _duskDisc = new THREE.Color(0xff8a5c);

export function createRenderer(canvas, lowfx = false) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx });
  // Cap pixel ratio at 1.75: retina-sharp enough, ~25% fewer fragments than 2x.
  renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio, 1.75));
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

  // Low sun over the western sea: a sphere, so it reads as a round sun from
  // every direction (a flat disc turns edge-on and vanishes from the side).
  // Warm gold and big enough to read against the bright sky.
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(28, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false, transparent: true, opacity: 0.95 }),
  );
  sunDisc.position.set(-300, 34, 340);
  scene.add(sunDisc);

  const hemi = new THREE.HemisphereLight(0xffe0b0, 0x3a4a5a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(-80, 130, 200); // low southern sun: sunset over the sea, lit north faces
  sun.castShadow = !lowfx;
  // 1024 shadow map: still crisp at street level, roughly 4x cheaper to render
  // than 2048 in software rasterisers — the biggest single frame-time win.
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  return { scene, sun, skyMat: sky.material, sunDisc };
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;      // behind the player looking north
    this.pitch = 0.22;       // low default: the crosshair ray stays near torso height
    this.dist = 11;
    this.pos = new THREE.Vector3(0, 8, 30);
    this.look = new THREE.Vector3(0, 1.5, 0);
    this.lastDragT = -10;    // seconds since the player last dragged the mouse
    this.baseFov = 62;
  }
  update(dt, target, inCar, speed01, input, carHeading) {
    // Mouse drag orbits; wheel zooms. Remember the drag so the camera can
    // gently swing back behind the car once the player lets go.
    if ((input.mouseDX || 0) !== 0 || (input.mouseDY || 0) !== 0) this.lastDragT = 0;
    else this.lastDragT += dt;
    this.yaw -= (input.mouseDX || 0) * 0.004;
    // On foot the pitch stays low (0.05..0.55): a high chase camera looks down
    // at the player's head, so the crosshair ray dives into the ground before
    // it reaches a rival 10m away. In a car the full range is fine.
    this.pitch = clamp(this.pitch + (input.mouseDY || 0) * 0.003, 0.05, inCar ? 1.1 : 0.55);
    if (input.wheel) this.dist = clamp(this.dist + input.wheel * 0.01, 6, 20);
    // While driving and the mouse has been idle >1.5s, ease the camera back
    // behind the car's direction of travel — no more steering blind.
    if (inCar && carHeading !== undefined && this.lastDragT > 1.5 && speed01 > 0.05) {
      this.yaw = angleLerp(this.yaw, carHeading, 1 - Math.exp(-dt * 0.9));
    }
    // Speed FOV kick: the world rushes a little at full throttle.
    const wantFov = this.baseFov + (inCar ? speed01 * 8 : 0);
    if (Math.abs(this.camera.fov - wantFov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, wantFov, 4, dt);
      this.camera.updateProjectionMatrix();
    }
    const wantDist = inCar ? this.dist + speed01 * 4 : this.dist;
    const cx = target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * wantDist;
    const cz = target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * wantDist;
    // On foot the camera rides low and flat (base 1.35m, pitch counts half):
    // the sightline from the camera stays near torso height out to ~15m, so
    // aiming at a rival actually hits them. In a car it keeps the old high
    // chase framing.
    const cy = target.y + (inCar ? 2 : 1.35) + Math.sin(this.pitch) * wantDist * (inCar ? 1 : 0.6);
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
