// Seeded RNG (mulberry32) + small helpers. Written fresh for Porto Vela.
// Every procedural layout in the city draws from WORLD.seed through this;
// round-3 beach/skyline additions use offset seeds (seed+101, seed+202).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function range(rng, min, max) { return min + rng() * (max - min); }
export function int(rng, min, max) { return Math.floor(range(rng, min, max + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
// Frame-rate independent exponential smoothing: damp(a, b, lambda, dt) moves a
// toward b; lambda ~4-8 feels like a soft spring, lambda ~2 is a slow drift.
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
// Shortest-arc interpolation between two headings (radians).
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Circle (x,z,r) vs AABB {minX,maxX,minZ,maxZ}: push the circle out, return corrected pos.
export function collideCircleAABB(x, z, r, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r };
  }
  // Centre inside the box: push out along the smallest penetration axis.
  const pl = x - box.minX, pr = box.maxX - x, pt = z - box.minZ, pb = box.maxZ - z;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - r, z };
  if (m === pr) return { x: box.maxX + r, z };
  if (m === pt) return { x, z: box.minZ - r };
  return { x, z: box.maxZ + r };
}
