// Porto Vela — a 3D open-world crime game for gta6-01 (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html + ES modules + vendored three.js, no network request).
// This program hands it in: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json with the vendored make.fun library.
// It validates the hand-in first (file count / bytes / path length vs the scorer caps),
// so an over-limit bundle fails here instead of at the scorer.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Count the game payload first: the scorer refuses entries over its caps, so
// fail loudly here instead of handing in a bundle the grader would reject.
function countGame(dir) {
  let files = 0, bytes = 0, longest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { const sub = countGame(p); files += sub.files; bytes += sub.bytes; longest = Math.max(longest, sub.longest); }
    else { files++; const s = statSync(p).size; bytes += s; longest = Math.max(longest, Buffer.byteLength(p)); }
  }
  return { files, bytes, longest };
}
const gameStats = countGame(join(here, 'game'));
if (gameStats.files > 993) throw new Error(`game/ has ${gameStats.files} files (cap 993)`);
if (gameStats.bytes > 50331648) throw new Error(`game/ is ${gameStats.bytes} bytes (cap 48 MiB)`);
if (gameStats.longest > 1000) throw new Error(`a game/ path is ${gameStats.longest} bytes (cap 1000)`);
console.log(`game/: ${gameStats.files} files, ${(gameStats.bytes / 1048576).toFixed(2)} MiB`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes;
// the others refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all, or a path
// under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
