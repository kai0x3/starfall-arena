// Starfall Arena — entry program for make.fun's best-game-01 bounty (Node 22+, standard
// library only). The game itself is the static site under game/: plain files a desktop
// browser opens offline, no build step and no network request. This program is only the
// courier. It copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there with the vendored make.fun library, so the
// grader sees exactly the bytes buildDossier produces from those two folders.
//
// Run it locally the way the starter suggests:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and the output is /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the playable game first, then the screenshots the judge's contact sheet is
// built from. Both folders travel whole; nothing is filtered or rewritten.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the gate's own limits, restated so a local run refuses an entry
// the sealed scorer would refuse: at most 4 screenshots of 256 KiB each, at most 993
// files and 48 MiB under game/, no game path longer than 1000 bytes, and the dossier
// text capped at 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`starfall-arena: game, screenshots and dossier.json (${dossier.byteLength} bytes) written to ${outputDir}`);
