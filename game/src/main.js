// main.js — the bootstrap and the state machine. It owns the canvas, the clock
// and the four screens' comings and goings (title, playing, the level-up draft,
// paused, game over); the world owns the fight and render.js owns the drawing.
//
// Three URL parameters exist for the maker's own screenshot harness, in the open:
//   ?seed=<n>     replace Math.random with a seeded stream, for repeatable shots
//   ?shot=play    attract mode: the game starts itself and an autopilot flies
//   ?shot=end     attract mode that stops flying after a few seconds, so the
//                 swarm wins honestly and the game-over screen is a real one
//   ?shot=boss    attract mode staged at the boss wave, guns already upgraded
//   ?shot=draft   attract mode with cores scattered on the ship, so the first
//                 level-up draft opens at once and can be photographed
//   ?wave=<n>     with a shot mode, begin the run at wave n instead of wave 1
// With none of them, a human plays.

import { SoundBank } from './audio.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { makeCore } from './entities.js';
import { Input } from './input.js';
import { drawFrame, drawGameOver, drawLevelDraft, drawPaused, drawTitle, levelCardRects } from './render.js';
import { World } from './world.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');

// A seeded stream, installed before anything rolls a die, when a shot asks.
if (params.has('seed')) {
  let a = (Number(params.get('seed')) >>> 0) || 1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new SoundBank();
const world = new World(sound);

let state = 'title'; // title | playing | levelup | paused | gameover
let time = 0;
let hoverChoice = -1;
let doomAt = Infinity; // in shot=end, the moment the autopilot lets go
let draftSince = 0;    // when the current level-up draft opened

// --- The attract-mode pilot ---------------------------------------------------
// Flies well enough to make a real fight for a screenshot: it shoots the nearest
// enemy, keeps a fighting distance from it, and detours for cores.
const autopilot = {
  aimAngle(w) {
    const target = nearestEnemy(w) || nearestCore(w);
    if (!target) return -Math.PI / 2 + Math.sin(w.time * 0.7) * 0.6;
    return Math.atan2(target.y - w.player.y, target.x - w.player.x);
  },
  firing(w) {
    return w.enemies.length > 0;
  },
  moveAxis(w) {
    const player = w.player;
    const core = nearestCore(w);
    const enemy = nearestEnemy(w);
    let tx = null;
    let ty = null;
    if (core && Math.hypot(core.x - player.x, core.y - player.y) < 320) {
      tx = core.x; ty = core.y;
    } else if (enemy) {
      const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (d < 170) { tx = player.x * 2 - enemy.x; ty = player.y * 2 - enemy.y; }
      else if (d > 300) { tx = enemy.x; ty = enemy.y; }
      else { tx = player.x + -(enemy.y - player.y) * 0.4; ty = player.y + (enemy.x - player.x) * 0.4; }
    }
    if (tx === null) return { x: 0, y: 0 };
    const dx = tx - player.x;
    const dy = ty - player.y;
    return { x: Math.abs(dx) > 14 ? Math.sign(dx) : 0, y: Math.abs(dy) > 14 ? Math.sign(dy) : 0 };
  },
};

function nearestEnemy(w) {
  let best = null;
  let bestD = Infinity;
  for (const e of w.enemies) {
    const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function nearestCore(w) {
  let best = null;
  let bestD = Infinity;
  for (const c of w.cores) {
    const d = (c.x - w.player.x) ** 2 + (c.y - w.player.y) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// An input-shaped stand-in so the world cannot tell the autopilot from a person.
function autopilotInput(w) {
  return {
    moveAxis: () => autopilot.moveAxis(w),
    mouseX: w.player.x + Math.cos(autopilot.aimAngle(w)) * 100,
    mouseY: w.player.y + Math.sin(autopilot.aimAngle(w)) * 100,
    firing: () => false, // the autopilot object itself answers firing
    dashPressed: () => false, // the autopilot never dashes
  };
}

function autopilotActive() {
  if (shotMode === 'play' || shotMode === 'boss' || shotMode === 'draft') return true;
  if (shotMode === 'end') return time < doomAt;
  return false;
}

// --- State changes --------------------------------------------------------------

// The audio context must be created inside a real gesture at least once;
// these listeners make the click or keypress itself do it, not a later frame.
window.addEventListener('keydown', () => sound.unlock());
window.addEventListener('mousedown', () => sound.unlock());

function startRun() {
  sound.unlock();
  world.startRun();
  sound.startMusic();
  state = 'playing';
  if (shotMode === 'end') doomAt = time + 6;
  // Screenshot staging, the same honesty as the attract modes above: a boss
  // shot begins at the boss wave with a fought-in ship, a draft shot begins
  // with the first level's cores already scattered at the ship's nose, and a
  // ?wave=<n> shot begins at that wave. A human's run never takes this path.
  if (shotMode) {
    const startWave = shotMode === 'boss' ? 5 : Number(params.get('wave')) || 1;
    if (startWave > 1) {
      world.wave = startWave - 1;
      world.waveTimer = 0.4;
    }
    if (shotMode === 'boss') {
      world.player.bulletDamage = 2;
      world.player.projectiles = 2;
      world.player.fireInterval *= 0.8;
    }
    if (shotMode === 'draft') {
      for (let i = 0; i < 7; i++) {
        world.cores.push(makeCore(world.player.x + (i - 3) * 16, world.player.y + 26, 1));
      }
    }
  }
}

function togglePause() {
  if (state === 'playing') state = 'paused';
  else if (state === 'paused') state = 'playing';
}

function updatePlaying(dt) {
  if (autopilotActive()) {
    world.update(dt, autopilotInput(world), autopilot);
  } else {
    world.update(dt, input, null);
  }
  if (world.over) {
    state = 'gameover';
  } else if (world.pendingLevels > 0) {
    world.openLevelDraft();
    draftSince = time;
    state = 'levelup';
  }
}

// Apply one draft card, then either draft again (banked levels) or resume.
function chooseDraftCard(pick) {
  const choices = world.levelChoices;
  if (!choices || pick < 0 || pick >= choices.length) return;
  world.chooseUpgrade(choices[pick]);
  if (world.pendingLevels > 0) {
    world.openLevelDraft();
    draftSince = time;
  } else {
    state = 'playing';
  }
}

function updateLevelDraft() {
  const choices = world.levelChoices;
  if (!choices) { state = 'playing'; return; }
  const rects = levelCardRects(choices.length);
  hoverChoice = rects.findIndex((r) =>
    input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h);
  let pick = -1;
  if (input.mouseClicked && hoverChoice >= 0) pick = hoverChoice;
  if (input.wasPressed('Digit1')) pick = 0;
  if (input.wasPressed('Digit2')) pick = 1;
  if (input.wasPressed('Digit3')) pick = 2;
  // The screenshot harness cannot click cards: in a shot mode the draft takes
  // its middle card after a beat, so an attract-mode run never stalls here.
  if (pick < 0 && shotMode && time - draftSince > 0.9) pick = 1;
  if (pick >= 0) chooseDraftCard(pick);
}

// --- The loop -------------------------------------------------------------------

let lastStamp = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0005, (now - lastStamp) / 1000));
  lastStamp = now;
  time += dt;

  if (input.wasPressed('KeyM')) sound.toggleMuted();
  sound.unlock();
  // The music follows the fight: hats from wave 4, full drive under the boss.
  sound.setIntensity(world.enemies.some((e) => e.kind === 'dread') ? 2 : world.wave >= 4 ? 1 : 0);
  sound.update();

  if (state === 'title') {
    if (input.wasPressed('Enter') || input.mouseClicked) startRun();
  } else if (state === 'playing') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) togglePause();
    else updatePlaying(dt);
  } else if (state === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) togglePause();
  } else if (state === 'levelup') {
    updateLevelDraft();
  } else if (state === 'gameover') {
    world.update(dt, input, null); // debris keeps drifting behind the screen
    if (input.wasPressed('KeyR') || input.mouseClicked) startRun();
  }

  // Draw.
  if (state === 'title') {
    drawTitle(ctx, time);
  } else {
    drawFrame(ctx, world, { time, muted: sound.muted });
    if (state === 'levelup') drawLevelDraft(ctx, world, world.levelChoices ?? [], hoverChoice);
    else if (state === 'paused') drawPaused(ctx);
    else if (state === 'gameover') drawGameOver(ctx, world);
  }

  input.endFrame();
}

requestAnimationFrame(frame);

// Attract modes begin on their own; a human's game waits for its launch click.
if (shotMode === 'play' || shotMode === 'end' || shotMode === 'boss' || shotMode === 'draft') startRun();

// A handle for the maker's test harness: read the state, never write it.
window.__starfall = { world, get state() { return state; } };
