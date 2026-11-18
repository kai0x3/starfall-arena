// render.js — everything the player sees: the starfield and nebula backdrop, the
// arena, every entity, the HUD, and the title / level-up / pause / game-over
// screens. It only reads the world; it never changes it. Files and functions are
// named for the thing they draw so the game's outline reads like its screen.

import { COLORS, PLAYER, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';

// A private random stream for the backdrop, so the stars are the same field on
// every load and never eat the gameplay's randomness.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const starRandom = mulberry32(20261117);
const STARS = Array.from({ length: 170 }, () => ({
  x: starRandom() * VIEW_WIDTH,
  y: starRandom() * VIEW_HEIGHT,
  size: starRandom() * 1.7 + 0.4,
  twinkle: starRandom() * Math.PI * 2,
  depth: 0.3 + starRandom() * 0.7,
}));

let nebulaCanvas = null;

// The nebula is painted once onto an offscreen canvas: two soft colour clouds
// over the vertical space gradient, with a faint grid to give the arena depth.
function backdrop() {
  if (nebulaCanvas) return nebulaCanvas;
  nebulaCanvas = document.createElement('canvas');
  nebulaCanvas.width = VIEW_WIDTH;
  nebulaCanvas.height = VIEW_HEIGHT;
  const ctx = nebulaCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, COLORS.spaceTop);
  gradient.addColorStop(1, COLORS.spaceBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const cloud = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  cloud(300, 210, 420, COLORS.nebulaA);
  cloud(1010, 590, 480, COLORS.nebulaB);
  cloud(880, 130, 300, COLORS.nebulaA);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = 64; x < VIEW_WIDTH; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_HEIGHT); ctx.stroke();
  }
  for (let y = 64; y < VIEW_HEIGHT; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_WIDTH, y); ctx.stroke();
  }
  return nebulaCanvas;
}

function drawBackdrop(ctx, time) {
  ctx.drawImage(backdrop(), 0, 0);
  for (const star of STARS) {
    const alpha = 0.35 + 0.4 * star.depth + 0.25 * Math.sin(time * 1.7 + star.twinkle);
    ctx.globalAlpha = Math.max(0.08, alpha);
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawArenaFrame(ctx) {
  ctx.strokeStyle = 'rgba(110, 160, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, VIEW_WIDTH - 12, VIEW_HEIGHT - 12);
  ctx.strokeStyle = COLORS.ship;
  ctx.lineWidth = 3;
  const c = 26;
  const corners = [[6, 6, 1, 1], [VIEW_WIDTH - 6, 6, -1, 1], [6, VIEW_HEIGHT - 6, 1, -1], [VIEW_WIDTH - 6, VIEW_HEIGHT - 6, -1, -1]];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + sx * c, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * c);
    ctx.stroke();
  }
}

// --- Entities ---------------------------------------------------------------

export function drawShipShape(ctx, x, y, angle, scale, thrust, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  if (thrust > 0.1) {
    // Engine flame: a flickering teardrop behind the hull.
    const flame = (10 + Math.sin(time * 42) * 2.5) * thrust;
    ctx.fillStyle = 'rgba(120, 220, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-11, 4);
    ctx.lineTo(-11 - flame, 0);
    ctx.lineTo(-11, -4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowColor = COLORS.ship;
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#0e2a3a';
  ctx.strokeStyle = COLORS.ship;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-7, 7);
  ctx.lineTo(-12, 11);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-7, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.shipCore;
  ctx.beginPath();
  ctx.arc(3, 0, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, enemy, time) {
  const flash = enemy.flash > 0;
  const body = flash ? '#ffffff' : COLORS[enemy.kind];
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.shadowColor = body;
  ctx.shadowBlur = 12;
  ctx.fillStyle = body;
  ctx.strokeStyle = body;
  if (enemy.kind === 'dart') {
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-9, 8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-9, -8);
    ctx.closePath();
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (enemy.kind === 'mite') {
    ctx.rotate(enemy.angle + Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = flash ? '#ffffff' : '#5c2e00';
    ctx.fillRect(-2.5, -2.5, 5, 5);
  } else if (enemy.kind === 'orb') {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius - 3, 0, Math.PI * 2);
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.rotate(enemy.angle);
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (enemy.radius - 6), Math.sin(a) * (enemy.radius - 6));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'weaver') {
    ctx.rotate(enemy.angle);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius - 2, 0.5, Math.PI * 2 - 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(enemy.radius + 5, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'charger') {
    // A spined dart. Telegraphing, it strobes white-hot and shivers in place:
    // the tell a player learns to dodge on.
    const telling = enemy.mode === 'telegraph';
    if (telling && Math.sin(time * 46) > 0) ctx.fillStyle = '#ffffff';
    ctx.rotate(enemy.angle);
    if (telling) ctx.translate(Math.sin(time * 90) * 1.6, 0);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-4, 5);
    ctx.lineTo(-13, 11);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-13, -11);
    ctx.lineTo(-4, -5);
    ctx.closePath();
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (enemy.kind === 'orbiter') {
    // A ring with a satellite bead riding it, forever mid-circle.
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(enemy.angle * 2.2);
    ctx.beginPath();
    ctx.arc(enemy.radius + 3, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'dread') {
    // The Dreadnought: a hex hull the size of a house, a turning toothed ring
    // around it, and one white eye that never blinks.
    ctx.rotate(enemy.angle * 0.4);
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * (enemy.radius + 7);
      const py = Math.sin(a) * (enemy.radius + 7);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.rotate(-enemy.angle * 0.4);
    // The hull keeps its own colour under fire — a hull this big flashing
    // white on every hit would strobe; the flash lives in the inner disc.
    ctx.fillStyle = COLORS[enemy.kind];
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(a) * enemy.radius;
      const py = Math.sin(a) * enemy.radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#2a0a16';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A thin health arc over anything tougher than a mite, once it is hurt.
  // The Dreadnought's health rides the boss bar in the HUD instead.
  if (enemy.kind !== 'dread' && enemy.hpMax > 1 && enemy.hp < enemy.hpMax) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 6, -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (enemy.hp / enemy.hpMax));
    ctx.stroke();
  }
}

function drawCore(ctx, core, time) {
  const pulse = 1 + Math.sin(time * 5 + core.x) * 0.12;
  const blink = core.life - core.age < 2.5 ? (Math.sin(time * 14) > 0 ? 1 : 0.25) : 1;
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(time * 2.2 + core.x * 0.05);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = blink;
  ctx.shadowColor = COLORS.core;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.core;
  const r = core.radius;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  if (core.value >= 2) {
    ctx.strokeStyle = COLORS.core;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBolt(ctx, x, y, vx, vy, color, radius) {
  const angle = Math.atan2(vy, vx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * 1.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-radius * 1.8, 0);
  ctx.lineTo(radius * 0.6, 0);
  ctx.stroke();
  ctx.restore();
}

// --- HUD ----------------------------------------------------------------------

function bar(ctx, x, y, w, h, share, color, label) {
  ctx.fillStyle = 'rgba(10, 16, 36, 0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(140, 180, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  if (share > 0) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, (w - 2) * Math.min(1, share), h - 2);
  }
  if (label) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 4);
  }
}

function drawHud(ctx, world, time) {
  const player = world.player;
  ctx.textBaseline = 'alphabetic';
  // Score and combo, top-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('SCORE', 22, 34);
  ctx.fillStyle = COLORS.textMain;
  ctx.font = '700 30px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(Math.floor(world.score)).padStart(6, '0'), 20, 64);
  const comboShare = (world.combo - 1) / 4;
  ctx.fillStyle = world.combo > 1.05 ? COLORS.combo : COLORS.textDim;
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(`COMBO x${world.combo.toFixed(1)}`, 22, 88);
  bar(ctx, 22, 96, 120, 5, comboShare, COLORS.combo, null);
  // Wave, top-centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('WAVE', VIEW_WIDTH / 2, 34);
  ctx.fillStyle = COLORS.textMain;
  ctx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(Math.max(1, world.wave)), VIEW_WIDTH / 2, 62);
  // Level and banked cores, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('LEVEL', VIEW_WIDTH - 22, 34);
  ctx.fillStyle = COLORS.textMain;
  ctx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(world.level), VIEW_WIDTH - 22, 62);
  ctx.fillStyle = COLORS.core;
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(`◆ ${world.coresBanked} CORES`, VIEW_WIDTH - 22, 88);
  // Hull, bottom-left; the bar changes colour as it empties, and pulses when
  // the ship is nearly gone.
  const hullShare = player.hull / player.hullMax;
  const hullColor = hullShare > 0.5 ? COLORS.hullGood : hullShare > 0.25 ? COLORS.hullHurt : COLORS.hullBad;
  bar(ctx, 22, VIEW_HEIGHT - 34, 230, 13, hullShare, hullColor, 'HULL');
  if (hullShare <= 0.25 && hullShare > 0 && Math.sin(time * 7) > 0) {
    ctx.strokeStyle = COLORS.hullBad;
    ctx.lineWidth = 2;
    ctx.strokeRect(21, VIEW_HEIGHT - 35, 232, 15);
  }
  ctx.fillStyle = COLORS.textMain;
  ctx.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.ceil(player.hull)} / ${player.hullMax}`, 260, VIEW_HEIGHT - 23);
  // The dash drive's charge, above the hull, once the upgrade is drafted.
  if (player.dashUnlocked) {
    const ready = player.dashCooldown <= 0;
    bar(ctx, 22, VIEW_HEIGHT - 58, 120, 6, ready ? 1 : 1 - player.dashCooldown / PLAYER.dashCooldown,
      ready ? COLORS.ship : COLORS.textDim, null);
    ctx.fillStyle = ready ? COLORS.ship : COLORS.textDim;
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText(ready ? 'DASH READY' : 'DASH', 148, VIEW_HEIGHT - 51);
  }
  // Experience, bottom-right.
  bar(ctx, VIEW_WIDTH - 252, VIEW_HEIGHT - 34, 230, 13, world.xp / world.xpNext, COLORS.xp, 'NEXT LEVEL');
  // The boss bar, top-centre under the wave, while a Dreadnought lives.
  const boss = world.enemies.find((e) => e.kind === 'dread');
  if (boss) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.dread;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('DREADNOUGHT', VIEW_WIDTH / 2, 84);
    bar(ctx, VIEW_WIDTH / 2 - 190, 92, 380, 9, boss.hp / boss.hpMax, COLORS.dread, null);
  }
}

// --- Screens ------------------------------------------------------------------

function centreText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_WIDTH / 2, y);
}

export function drawTitle(ctx, time) {
  drawBackdrop(ctx, time);
  drawArenaFrame(ctx);
  // The ship, parked and gleaming at the centre of its arena.
  drawShipShape(ctx, VIEW_WIDTH / 2, 356, -Math.PI / 2 + Math.sin(time * 0.8) * 0.14, 2.1, 0.4, time);
  ctx.save();
  ctx.shadowColor = COLORS.ship;
  ctx.shadowBlur = 26;
  centreText(ctx, 'STARFALL ARENA', 218, '800 76px system-ui, sans-serif', COLORS.textMain);
  ctx.restore();
  centreText(ctx, 'The swarm is coming. Bank cores. Bend the odds.', 258, '500 19px system-ui, sans-serif', COLORS.textDim);
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textMain;
  ctx.textAlign = 'center';
  const lines = [
    'WASD / ARROWS — fly        MOUSE — aim        HOLD CLICK / SPACE — fire',
    'Shoot the swarm, gather the cores it drops, and spend each level on an upgrade.',
    'Darts chase. Orbs split. Weavers shoot back. Chargers flash, then lunge.',
    'Orbiters circle and close in. Every fifth wave, the Dreadnought comes.',
    'P — pause        M — mute',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_WIDTH / 2, 452 + i * 27));
  if (Math.sin(time * 3.2) > -0.25) {
    centreText(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', 618, '700 21px system-ui, sans-serif', COLORS.core);
  }
}

// The level-up draft cards. The same rectangles are used to draw and to hit-test
// mouse clicks, so what the player sees is exactly what they can click.
export function levelCardRects(count) {
  const w = 308;
  const h = 208;
  const gap = 26;
  const total = count * w + (count - 1) * gap;
  const x0 = (VIEW_WIDTH - total) / 2;
  const y = 318;
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export function drawLevelDraft(ctx, world, choices, hoverIndex) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.78)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  centreText(ctx, 'LEVEL UP', 218, '800 44px system-ui, sans-serif', COLORS.textMain);
  centreText(ctx, 'Choose one upgrade — keys 1 · 2 · 3 or click', 254, '500 17px system-ui, sans-serif', COLORS.textDim);
  const rects = levelCardRects(choices.length);
  choices.forEach((choice, i) => {
    const rect = rects[i];
    const hovered = i === hoverIndex;
    ctx.fillStyle = hovered ? 'rgba(28, 44, 84, 0.95)' : 'rgba(14, 22, 48, 0.95)';
    ctx.strokeStyle = hovered ? COLORS.ship : 'rgba(120, 160, 255, 0.4)';
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.combo;
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.fillText(choice.mark, rect.x + rect.w / 2, rect.y + 66);
    ctx.fillStyle = COLORS.textMain;
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillText(choice.name, rect.x + rect.w / 2, rect.y + 106);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 14.5px system-ui, sans-serif';
    wrapText(ctx, choice.blurb, rect.x + rect.w / 2, rect.y + 138, rect.w - 36, 20);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '700 13px ui-monospace, Menlo, monospace';
    ctx.fillText(`[ ${i + 1} ]`, rect.x + rect.w / 2, rect.y + rect.h - 16);
  });
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.66)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  centreText(ctx, 'PAUSED', 380, '800 52px system-ui, sans-serif', COLORS.textMain);
  centreText(ctx, 'P or Esc to resume · M to mute', 424, '500 17px system-ui, sans-serif', COLORS.textDim);
}

export function drawGameOver(ctx, world) {
  ctx.fillStyle = 'rgba(20, 4, 10, 0.72)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.save();
  ctx.shadowColor = COLORS.hullBad;
  ctx.shadowBlur = 22;
  centreText(ctx, 'SHIP LOST', 268, '800 64px system-ui, sans-serif', COLORS.hullBad);
  ctx.restore();
  centreText(ctx, 'The arena keeps your score.', 306, '500 17px system-ui, sans-serif', COLORS.textDim);
  const rows = [
    ['FINAL SCORE', String(Math.floor(world.score)).padStart(6, '0')],
    ['WAVE REACHED', String(Math.max(1, world.wave))],
    ['KILLS', String(world.kills)],
    ['BEST COMBO', `x${world.bestCombo.toFixed(1)}`],
    ['CORES BANKED', String(world.coresBanked)],
  ];
  ctx.font = '600 19px system-ui, sans-serif';
  rows.forEach(([label, value], i) => {
    const y = 368 + i * 36;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(label, VIEW_WIDTH / 2 - 18, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textMain;
    ctx.font = '700 19px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText(value, VIEW_WIDTH / 2 + 18, y);
    ctx.font = '600 19px system-ui, sans-serif';
  });
  centreText(ctx, 'PRESS R OR CLICK TO FLY AGAIN', 592, '700 20px system-ui, sans-serif', COLORS.core);
}

// --- The whole frame ------------------------------------------------------------

export function drawFrame(ctx, world, ui) {
  ctx.save();
  if (world.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawBackdrop(ctx, ui.time);
  drawArenaFrame(ctx);
  for (const core of world.cores) drawCore(ctx, core, ui.time);
  for (const bullet of world.bullets) drawBolt(ctx, bullet.x, bullet.y, bullet.vx, bullet.vy, COLORS.bullet, bullet.radius);
  for (const bolt of world.enemyBolts) drawBolt(ctx, bolt.x, bolt.y, bolt.vx, bolt.vy, COLORS.enemyBolt, bolt.radius + 1);
  for (const enemy of world.enemies) drawEnemy(ctx, enemy, ui.time);
  if (!world.over) {
    // A ship in its invulnerable blink is drawn on alternating slices of time.
    const blink = world.player.invulnerable > 0 && Math.sin(ui.time * 34) > 0;
    if (!blink) {
      drawShipShape(ctx, world.player.x, world.player.y, world.player.angle, 1, world.player.thrust, ui.time);
    }
  }
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const t of world.texts) {
    ctx.globalAlpha = Math.max(0, 1 - t.age / t.life);
    ctx.font = `700 ${t.size}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (world.hurtFlash > 0) {
    const g = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.36,
      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.78);
    g.addColorStop(0, 'rgba(255,40,60,0)');
    g.addColorStop(1, `rgba(255,40,60,${(world.hurtFlash * 0.5).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  drawHud(ctx, world, ui.time);
  if (ui.muted) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('MUTED (M)', VIEW_WIDTH / 2, VIEW_HEIGHT - 14);
  }
}
