// Procedural Porto Vela: ground map texture, buildings, palms, docks, marina.
// All geometry is built from boxes/cylinders with canvas textures — no external assets.
import * as THREE from '../vendor/three/three.module.min.js';
import { WORLD } from './config.js';
import { mulberry32, range, int, pick } from './random.js';

// Roads run BETWEEN blocks (half a pitch off the block centres), so no building
// ever spawns on a road. Lines: -203, -145, -87, -29, 29, 87, 145, 203.
export const ROAD_LINES = [];
for (let k = -WORLD.blocks; k < WORLD.blocks; k++) ROAD_LINES.push(k * WORLD.pitch + WORLD.pitch / 2);

function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function windowTexture(base, lit) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let y = 8; y < s - 8; y += 16) {
      for (let x = 8; x < s - 8; x += 14) {
        g.fillStyle = Math.random() < 0.35 ? lit : '#1d2733';
        g.fillRect(x, y, 9, 11);
      }
    }
  });
}

export function buildCity(scene) {
  const rng = mulberry32(WORLD.seed);
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const buildings = [];
  const half = WORLD.blocks * WORLD.pitch; // 232
  const MAP = 640; // texture covers -320..320

  // ---- ground: one canvas paints roads, blocks, beach and sea ----
  const groundTex = canvasTexture(1024, (g, s) => {
    const toPx = (v) => ((v + MAP / 2) / MAP) * s;
    g.fillStyle = '#2e6f8e'; g.fillRect(0, 0, s, s);               // sea
    g.fillStyle = '#e8cf9a'; g.fillRect(0, toPx(WORLD.beachZ), s, s - toPx(WORLD.beachZ)); // sand
    g.fillStyle = '#3a3f46'; g.fillRect(0, 0, s, toPx(WORLD.beachZ)); // city asphalt base
    // blocks
    for (let i = -WORLD.blocks; i <= WORLD.blocks; i++) {
      for (let j = -WORLD.blocks; j <= WORLD.blocks; j++) {
        const cx = i * WORLD.pitch, cz = j * WORLD.pitch;
        g.fillStyle = (i === 0 && j === 0) ? '#4d7a4a' : '#565b63'; // central park
        g.fillRect(toPx(cx - WORLD.blockHalf), toPx(cz - WORLD.blockHalf),
          toPx(WORLD.blockHalf * 2) - toPx(0), toPx(WORLD.blockHalf * 2) - toPx(0));
      }
    }
    // roads
    g.fillStyle = '#24272c';
    for (const r of ROAD_LINES) {
      g.fillRect(toPx(r - WORLD.roadHalf), 0, toPx(WORLD.roadHalf * 2) - toPx(0), toPx(WORLD.beachZ));
      g.fillRect(0, toPx(r - WORLD.roadHalf), toPx(half + WORLD.roadHalf), toPx(WORLD.roadHalf * 2) - toPx(0));
    }
    // lane dashes
    g.fillStyle = '#d8c25a';
    for (const r of ROAD_LINES) {
      for (let v = -half; v < WORLD.beachZ; v += 16) {
        g.fillRect(toPx(r) - 1, toPx(v), 2, 7);
        g.fillRect(toPx(v), toPx(r) - 1, 7, 2);
      }
    }
    // docks apron (east)
    g.fillStyle = '#6b6f75';
    g.fillRect(toPx(WORLD.docksX - 14), toPx(40), toPx(28) - toPx(0), toPx(140) - toPx(0));
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP, MAP),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0);
  scene.add(ground);

  // Sea plane (waterline at z=300, in front of the sand strip).
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP, 120),
    new THREE.MeshLambertMaterial({ color: 0x2e7fa8, transparent: true, opacity: 0.9 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.15, 360);
  scene.add(sea);

  // ---- buildings ----
  const winTex = [
    windowTexture('#8a6f5c', '#ffd98a'), windowTexture('#5c6e8a', '#ffe9a8'),
    windowTexture('#7a8a7a', '#fff2b0'),
  ];
  const roofColors = [0x9a7b5f, 0x6f7f95, 0x8a8f7a, 0xb08a6a];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = -WORLD.blocks; i <= WORLD.blocks; i++) {
    for (let j = -WORLD.blocks; j <= WORLD.blocks; j++) {
      if (i === 0 && j === 0) continue; // park
      const cx = i * WORLD.pitch, cz = j * WORLD.pitch;
      // Keep the safehouse (-60,-180) and garage (150,-150) blocks clear so no
      // building spawns on top of a story landmark.
      if (Math.hypot(cx + 60, cz + 180) < 40 || Math.hypot(cx - 150, cz + 150) < 40) continue;
      const n = int(rng, 1, 3);
      for (let b = 0; b < n; b++) {
        const w = range(rng, 12, 20), d = range(rng, 12, 20), h = range(rng, 8, 42);
        const ox = range(rng, -8, 8), oz = range(rng, -8, 8);
        const bx = cx + ox, bz = cz + oz;
        const side = new THREE.MeshLambertMaterial({ map: pick(rng, winTex) });
        const roof = new THREE.MeshLambertMaterial({ color: pick(rng, roofColors) });
        const m = new THREE.Mesh(boxGeo, [side, side, roof, roof, side, side]);
        m.scale.set(w, h, d); m.position.set(bx, h / 2, bz);
        scene.add(m);
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
        buildings.push({ x: bx, z: bz, h });
      }
    }
  }

  // ---- park: trees + fountain ----
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
  const leafGeo = new THREE.SphereGeometry(1.8, 8, 6);
  for (let t = 0; t < 26; t++) {
    const x = range(rng, -20, 20), z = range(rng, -20, 20);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.set(x, 1.5, z); scene.add(trunk);
    const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(x, 4, z); leaf.scale.y = 0.8; scene.add(leaf);
  }
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.6, 1, 16),
    new THREE.MeshLambertMaterial({ color: 0x9fb4c0 }),
  );
  fountain.position.set(0, 0.5, 0); scene.add(fountain);

  // ---- palms along the beach ----
  const palmTrunk = new THREE.CylinderGeometry(0.22, 0.35, 6, 6);
  const palmLeaf = new THREE.ConeGeometry(2.4, 2.2, 7);
  const palmLeafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  for (let x = -220; x <= 220; x += 18) {
    if (Math.abs(x % 54) < 9) continue;
    const z = WORLD.beachZ + 6 + range(rng, 0, 8);
    const trunk = new THREE.Mesh(palmTrunk, trunkMat);
    trunk.position.set(x, 3, z); trunk.rotation.z = range(rng, -0.12, 0.12); scene.add(trunk);
    const leaf = new THREE.Mesh(palmLeaf, palmLeafMat);
    leaf.position.set(x, 6.6, z); scene.add(leaf);
  }

  // ---- docks: one row of containers along the east edge, 18 m apart so the
  // apron (x 254..274) stays open to walk and fight on. ----
  const contColors = [0xb0503c, 0x3c6fb0, 0x4a8a4a, 0xc0a040];
  const contGeo = new THREE.BoxGeometry(8, 3, 3);
  for (let c = 0; c < 8; c++) {
    const m = new THREE.Mesh(contGeo, new THREE.MeshLambertMaterial({ color: pick(rng, contColors) }));
    const x = WORLD.docksX + 8, z = 50 + c * 18 + range(rng, -1, 1);
    m.position.set(x, 1.5 + (c % 3 === 0 ? 3 : 0), z);
    m.rotation.y = (c % 2) * 0.06;
    scene.add(m);
    colliders.push({ minX: x - 4, maxX: x + 4, minZ: z - 1.6, maxZ: z + 1.6 });
  }

  // ---- marina boats (south, on the sand edge) ----
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  for (let b = 0; b < 5; b++) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), hullMat);
    hull.position.set(40 + b * 14, 0.8, WORLD.beachZ + 22);
    scene.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 4), new THREE.MeshLambertMaterial({ color: 0x2f5f8a }));
    cabin.position.set(40 + b * 14, 2.2, WORLD.beachZ + 22);
    scene.add(cabin);
  }

  // ---- beach umbrellas: the beachfront reads as a beach, not an empty strip ----
  // (poleMat is declared here — the umbrellas and district signs below use it too.)
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const umbrellaColors = [0xd64545, 0x3a7bd5, 0xe8c832, 0x3a9a4a];
  for (let u = 0; u < 6; u++) {
    const x = -200 + u * 62 + range(rng, -6, 6);
    const z = WORLD.beachZ + 14 + range(rng, 0, 10);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), poleMat);
    pole.position.set(x, 1.3, z); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8),
      new THREE.MeshLambertMaterial({ color: pick(rng, umbrellaColors) }));
    top.position.set(x, 2.9, z); scene.add(top);
  }

  // ---- district signs: canvas-text boards on poles so every neighbourhood names itself ----
  const makeSign = (text, x, z, rotY) => {
    const tex = canvasTexture(256, (g, s) => {
      g.fillStyle = '#1d2733'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#ffd23e'; g.fillRect(0, 0, s, 10); g.fillRect(0, s - 10, s, 10);
      g.fillStyle = '#f8f9fa'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, s / 2, s / 2 + 2);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(x, 3.4, z); board.rotation.y = rotY; scene.add(board);
    for (const px of [-3.6, 3.6]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), poleMat);
      pole.position.set(x + Math.cos(rotY) * px, 1.7, z - Math.sin(rotY) * px); scene.add(pole);
    }
  };
  makeSign('MARLIN ROW', 138, -128, Math.PI / 2);
  makeSign('EAST DOCKS', 252, 40, 0);
  makeSign('MARINA', 60, 240, 0);
  makeSign('CENTRAL PARK', 0, -30, 0);
  makeSign('NORTH GATE', -150, -224, 0);
  makeSign('SAFEHOUSE ROW', -72, -166, Math.PI / 2);
  makeSign('OLD TOWN', -150, 8, Math.PI / 2);

  // ---- streetlights along main roads ----
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd76a });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const bulbGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (const r of ROAD_LINES) {
    for (let v = -200; v <= 200; v += 58) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(r + WORLD.roadHalf + 1, 3, v); scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(r + WORLD.roadHalf + 1, 6.1, v); scene.add(bulb);
    }
  }

  // ---- safehouse + garage landmarks ----
  const safehouse = new THREE.Mesh(
    new THREE.BoxGeometry(16, 7, 12),
    new THREE.MeshLambertMaterial({ color: 0xc08a5a }),
  );
  safehouse.position.set(-60, 3.5, -180); scene.add(safehouse);
  colliders.push({ minX: -68, maxX: -52, minZ: -186, maxZ: -174 });
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(18, 6, 12),
    new THREE.MeshLambertMaterial({ color: 0x5a6f8a }),
  );
  garage.position.set(150, 3, -150); scene.add(garage);
  colliders.push({ minX: 141, maxX: 159, minZ: -156, maxZ: -144 });

  return {
    colliders, buildings, sea,
    // Ambient life: the sea breathes (gentle swell + shimmer) so the beachfront
    // never looks frozen. Called every frame from main with the session clock.
    update(_dt, t) {
      sea.position.y = 0.15 + Math.sin(t * 0.8) * 0.08;
      sea.material.opacity = 0.86 + 0.04 * Math.sin(t * 0.5);
    },
    spawns: {
      player: [0, 24],
      garage: [150, -138],
      safehouse: [-60, -168],
      docks: [264, 60],
      marina: [60, 232],
      beachVan: [-180, 232],
      northGate: [-150, -232],
    },
  };
}

// Nearest point on a road line to (x,z) — used to keep traffic on roads.
export function nearestRoadPoint(x, z) {
  let bx = ROAD_LINES[0], bz = z, bd = Infinity;
  for (const r of ROAD_LINES) {
    const d = Math.abs(x - r);
    if (d < bd) { bd = d; bx = r; }
  }
  let bz2 = ROAD_LINES[0], bd2 = Infinity;
  for (const r of ROAD_LINES) {
    const d = Math.abs(z - r);
    if (d < bd2) { bd2 = d; bz2 = r; }
  }
  // Pick the closer axis: if the point is near a vertical road, snap x; else snap z.
  return bd < bd2 ? { x: bx, z, vertical: true } : { x, z: bz2, vertical: false };
}
