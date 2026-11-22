// VAULTBREAK — The Meridian Job: the entrypoint for make.fun
// best-heist-game-20261122-0559 (Node 22, standard library only).
//
// It hands the game in: copies this directory's game/ (plain static files
// a desktop browser loads offline — game/index.html and its ES modules,
// no library and no network request) and screenshots/ (four real renders
// of the game's own code, the first by name the cover) to /output, and
// writes /output/dossier.json with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The hand-in is deterministic: the same bytes every run (no timestamps,
// no randomness in the outputs; the screenshots are fixed files copied,
// never re-rendered).

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (from the kit's RULES.txt): only text_max_bytes
// shapes the bytes; the others refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in
// game/ or 48 MiB of game files in all, or a path under game/ over 1000
// bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// --- checks I wrote for this entry (fail the run, never ship a bad hand-in)
function fail(message) {
  throw new Error('main.ts: ' + message);
}

function checkEntryFiles() {
  const indexHtml = join(here, 'game', 'index.html');
  if (!existsSync(indexHtml)) fail('game/index.html is missing');
  if (statSync(indexHtml).size > 1024 * 1024) fail('game/index.html is over 1 MiB');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail('need 3 or 4 screenshots, found ' + shots.length);
  }
  for (const shot of shots) {
    const size = statSync(join(shotsDir, shot)).size;
    if (size > CAPS.screenshots.max_bytes) {
      fail('screenshot ' + shot + ' is ' + size + ' B, over the 262144 B cap');
    }
  }
  return shots;
}

function checkDossier(bytes) {
  if (bytes.length > 1536 * 1024) fail('dossier.json is over 1.5 MiB');
  const dossier = JSON.parse(new TextDecoder().decode(bytes));
  if (!dossier || typeof dossier !== 'object') fail('dossier.json did not parse to an object');
  if (!dossier.schema && !dossier.version && !dossier.game) {
    fail('dossier.json is missing its expected top-level fields');
  }
}

mkdirSync(out, { recursive: true });
const shots = checkEntryFiles();
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossierBytes = buildDossier(out, CAPS);
checkDossier(dossierBytes);
writeFileSync(join(out, 'dossier.json'), dossierBytes);

// Verify what actually landed in /output: the copied tree must carry the
// same screenshots at the same sizes, and game/index.html must be there.
function checkOutputTree() {
  const outIndex = join(out, 'game', 'index.html');
  if (!existsSync(outIndex)) fail('/output/game/index.html is missing after copy');
  const outShots = readdirSync(join(out, 'screenshots')).sort();
  if (outShots.join('|') !== shots.join('|')) {
    fail('/output/screenshots does not match the source screenshots');
  }
  for (const shot of outShots) {
    const srcSize = statSync(join(here, 'screenshots', shot)).size;
    const dstSize = statSync(join(out, 'screenshots', shot)).size;
    if (srcSize !== dstSize) fail('screenshot ' + shot + ' changed size during copy');
  }
  const html = readFileSync(outIndex, 'utf8');
  if (!html.includes('src="./src/main.js"')) fail('/output/game/index.html does not load src/main.js');
  if (/https?:\/\//.test(html)) fail('/output/game/index.html references a network URL');
}
checkOutputTree();

console.log('VAULTBREAK handed in: ' + shots.length + ' screenshots, dossier ' + dossierBytes.length + ' B');
