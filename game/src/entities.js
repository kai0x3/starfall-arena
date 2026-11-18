// entities.js — what everything in the arena IS: the factories that build the
// ship, bullets, cores and particles, and the steering behaviours that make each
// enemy kind fly differently. Drawing lives in render.js and the rules of the
// fight (collisions, score, waves) live in world.js; this file only moves things.

import { CHARGER, DREAD, ENEMIES, ORBITER, PLAYER, VIEW_HEIGHT, VIEW_WIDTH, WAVES, WEAVER } from './config.js';

const rand = (min, max) => min + Math.random() * (max - min);

export function makePlayer() {
  return {
    x: VIEW_WIDTH / 2,
    y: VIEW_HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    hullMax: PLAYER.hull,
    fireTimer: 0,
    invulnerable: 0,
    // Upgradeable stats, all starting at the config's base values.
    fireInterval: PLAYER.fireInterval,
    bulletDamage: PLAYER.bulletDamage,
    projectiles: 1,
    speed: PLAYER.speed,
    magnetRadius: PLAYER.magnetRadius,
    pierce: 0,          // extra enemies each bolt flies through (Piercing Rounds)
    critChance: 0,      // chance a bolt lands triple damage (Critical Systems)
    regen: 0,           // hull patched per second (Repair Swarm)
    dashUnlocked: false, // the Phase Dash drive, once drafted
    dashCooldown: 0,
    dashTime: 0,        // seconds of dash left; while it runs the dash drives
    dashVx: 0,
    dashVy: 0,
    thrust: 0, // 0..1, how hard the engine is burning this frame (for the trail)
  };
}

// The ship steers by acceleration with damping, so it starts and stops crisply
// but still drifts a little, like a thruster-driven craft should.
export function steerPlayer(player, axis, dt) {
  const length = Math.hypot(axis.x, axis.y) || 1;
  const ax = (axis.x / length) * (axis.x !== 0 || axis.y !== 0 ? 1 : 0);
  const ay = (axis.y / length) * (axis.x !== 0 || axis.y !== 0 ? 1 : 0);
  player.vx += ax * PLAYER.acceleration * dt;
  player.vy += ay * PLAYER.acceleration * dt;
  const damp = Math.exp(-PLAYER.damping * dt);
  player.vx *= damp;
  player.vy *= damp;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > player.speed) {
    player.vx = (player.vx / speed) * player.speed;
    player.vy = (player.vy / speed) * player.speed;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.min(VIEW_WIDTH - player.radius, Math.max(player.radius, player.x));
  player.y = Math.min(VIEW_HEIGHT - player.radius, Math.max(player.radius, player.y));
  player.thrust = Math.min(1, speed / player.speed);
}

export function makeBullet(x, y, angle, damage) {
  return {
    x, y,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    radius: PLAYER.bulletRadius,
    damage,
    life: PLAYER.bulletLife,
  };
}

export function makeEnemyBolt(x, y, angle, speed = WEAVER.boltSpeed) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: WEAVER.boltRadius,
    life: WEAVER.boltLife,
  };
}

export function makeEnemy(kind, x, y, wave) {
  const base = ENEMIES[kind];
  const hpBonus = (kind === 'dart' || kind === 'orb') && wave >= 4
    ? Math.floor(wave / 4)
    : 0;
  // The Dreadnought returns tougher each time: its hull grows per boss wave.
  const dreadBonus = kind === 'dread'
    ? DREAD.hpPerReturn * Math.max(0, Math.round(wave / WAVES.bossEveryWaves) - 1)
    : 0;
  const speedScale = 1 + Math.min(0.35, (wave - 1) * 0.02);
  return {
    kind,
    x, y,
    vx: 0,
    vy: 0,
    angle: rand(0, Math.PI * 2),
    hp: base.hp + hpBonus + dreadBonus,
    hpMax: base.hp + hpBonus + dreadBonus,
    radius: base.radius,
    speed: base.speed * speedScale * rand(0.9, 1.1),
    score: base.score,
    touchDamage: base.touchDamage,
    flash: 0,          // white-hit flash timer, set when a bullet lands
    wobble: rand(0, Math.PI * 2), // personal phase, so crowds do not move as one
    fireTimer: rand(1.2, WEAVER.fireInterval),
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: rand(1.5, 3),
    // Charger state: which beat of its hunt rhythm it is on, and its clock.
    mode: 'approach',
    modeTimer: rand(CHARGER.approachMin, CHARGER.approachMax),
    dashAngle: 0,
    // Orbiter state: where it sits on its ring around the ship, and the ring's size.
    orbitAngle: Math.atan2(y - VIEW_HEIGHT / 2, x - VIEW_WIDTH / 2),
    orbitRadius: ORBITER.orbitRadius,
    // Dreadnought state: the two attack clocks, ring and volley.
    radialTimer: 2.2,
    volleyTimer: 1.1,
  };
}

// A core: the glowing shard a wreck drops. It drifts, slows, then waits to be
// pulled into the ship by the magnet or flown over.
export function makeCore(x, y, value) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(30, 120);
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: value >= 2 ? 8 : 6,
    value,
    age: 0,
    life: 14, // seconds before it fades out unclaimed
  };
}

export function makeParticle(x, y, color, speed, life, size) {
  const angle = rand(0, Math.PI * 2);
  const pace = rand(speed * 0.3, speed);
  return {
    x, y,
    vx: Math.cos(angle) * pace,
    vy: Math.sin(angle) * pace,
    color,
    life,
    age: 0,
    size: rand(size * 0.5, size),
  };
}

export function burst(particles, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i++) {
    if (particles.length > 420) return;
    particles.push(makeParticle(x, y, color, speed, rand(life * 0.5, life), size));
  }
}

// --- Enemy steering, one behaviour per kind --------------------------------

// The dart simply runs the ship down, with a slight weave so a line of them
// does not stack into a single point.
function steerDart(enemy, player, dt) {
  enemy.wobble += dt * 3.1;
  const toward = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const angle = toward + Math.sin(enemy.wobble) * 0.22;
  enemy.vx = Math.cos(angle) * enemy.speed;
  enemy.vy = Math.sin(angle) * enemy.speed;
  enemy.angle = toward;
}

// The mite is a dart with the brakes cut: faster, straighter, fragile.
function steerMite(enemy, player, dt) {
  const toward = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  enemy.vx = Math.cos(toward) * enemy.speed;
  enemy.vy = Math.sin(toward) * enemy.speed;
  enemy.angle = toward;
}

// The orb plods straight at the ship, in no hurry at all; its threat is its
// hull and what it splits into.
function steerOrb(enemy, player, dt) {
  const toward = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  enemy.vx = Math.cos(toward) * enemy.speed;
  enemy.vy = Math.sin(toward) * enemy.speed;
  enemy.angle += dt * 0.9; // the shell slowly rotates as it comes
}

// The weaver keeps its distance: it closes while far away, backs off when the
// ship presses in, strafes sideways the whole time, and fires on a timer.
// Returns true on the frames it lets a bolt go.
function steerWeaver(enemy, player, dt) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const toward = Math.atan2(dy, dx);
  let radial = 0;
  if (distance > WEAVER.keepFar) radial = 1;
  else if (distance < WEAVER.keepNear) radial = -1;
  enemy.strafeTimer -= dt;
  if (enemy.strafeTimer <= 0) {
    enemy.strafeDir *= -1;
    enemy.strafeTimer = rand(1.5, 3);
  }
  const strafe = toward + Math.PI / 2;
  enemy.vx = (Math.cos(toward) * radial + Math.cos(strafe) * enemy.strafeDir * 0.7) * enemy.speed;
  enemy.vy = (Math.sin(toward) * radial + Math.sin(strafe) * enemy.strafeDir * 0.7) * enemy.speed;
  enemy.angle = toward;
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && distance < 560) {
    enemy.fireTimer = WEAVER.fireInterval * rand(0.85, 1.15);
    return true;
  }
  return false;
}

// The charger's hunt, in four beats. Approach: cruise at the ship. Telegraph:
// brake hard and gather, tracking the ship early and locking its line late —
// the flash render.js adds is the player's warning. Dash: one straight lunge
// at full speed. Recover: drift, slow, while the drive cools.
function steerCharger(enemy, player, dt) {
  const toward = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  enemy.modeTimer -= dt;
  if (enemy.mode === 'approach') {
    enemy.vx = Math.cos(toward) * enemy.speed;
    enemy.vy = Math.sin(toward) * enemy.speed;
    enemy.angle = toward;
    if (enemy.modeTimer <= 0 && distance < CHARGER.lungeRange) {
      enemy.mode = 'telegraph';
      enemy.modeTimer = CHARGER.telegraphSeconds;
      enemy.dashAngle = toward;
    } else if (enemy.modeTimer <= 0) {
      enemy.modeTimer = 0.3; // not in range yet: check again in a blink
    }
  } else if (enemy.mode === 'telegraph') {
    enemy.vx *= Math.exp(-8 * dt);
    enemy.vy *= Math.exp(-8 * dt);
    // The aim is honest but not perfect: it tracks for the first half of the
    // tell, then locks, so a late dodge still beats the lunge.
    if (enemy.modeTimer > CHARGER.telegraphSeconds / 2) enemy.dashAngle = toward;
    enemy.angle = enemy.dashAngle;
    if (enemy.modeTimer <= 0) {
      enemy.mode = 'dash';
      enemy.modeTimer = CHARGER.dashSeconds;
    }
  } else if (enemy.mode === 'dash') {
    enemy.vx = Math.cos(enemy.dashAngle) * CHARGER.dashSpeed;
    enemy.vy = Math.sin(enemy.dashAngle) * CHARGER.dashSpeed;
    enemy.angle = enemy.dashAngle;
    if (enemy.modeTimer <= 0) {
      enemy.mode = 'recover';
      enemy.modeTimer = CHARGER.recoverSeconds;
    }
  } else { // recover
    enemy.vx *= Math.exp(-3 * dt);
    enemy.vy *= Math.exp(-3 * dt);
    enemy.angle = toward;
    if (enemy.modeTimer <= 0) {
      enemy.mode = 'approach';
      enemy.modeTimer = rand(CHARGER.approachMin, CHARGER.approachMax);
    }
  }
}

// The orbiter rides its ring: each frame it steps along the circle around the
// ship and lets the circle shrink a little, so its place is computed outright
// rather than steered. Returns true on the frames it plinks a bolt inward.
function steerOrbiter(enemy, player, dt) {
  enemy.orbitAngle += ORBITER.angularSpeed * enemy.strafeDir * dt;
  enemy.orbitRadius = Math.max(ORBITER.minOrbitRadius,
    enemy.orbitRadius - ORBITER.spiralPerSecond * dt);
  enemy.x = player.x + Math.cos(enemy.orbitAngle) * enemy.orbitRadius;
  enemy.y = player.y + Math.sin(enemy.orbitAngle) * enemy.orbitRadius;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.angle = enemy.orbitAngle + Math.PI / 2;
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0) {
    enemy.fireTimer = ORBITER.fireInterval * rand(0.85, 1.15);
    return true;
  }
  return false;
}

// The Dreadnought holds the same range band a weaver does, grown huge and
// slow, drifting sideways while its two attack clocks run down. Returns
// 'radial' when a bolt ring is due and 'volley' when an aimed volley is.
function steerDread(enemy, player, dt) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const toward = Math.atan2(dy, dx);
  let radial = 0;
  if (distance > DREAD.keepFar) radial = 1;
  else if (distance < DREAD.keepNear) radial = -1;
  enemy.strafeTimer -= dt;
  if (enemy.strafeTimer <= 0) {
    enemy.strafeDir *= -1;
    enemy.strafeTimer = rand(2.5, 4);
  }
  const strafe = toward + Math.PI / 2;
  enemy.vx = (Math.cos(toward) * radial + Math.cos(strafe) * enemy.strafeDir * 0.55) * enemy.speed;
  enemy.vy = (Math.sin(toward) * radial + Math.sin(strafe) * enemy.strafeDir * 0.55) * enemy.speed;
  enemy.angle += dt * 0.35; // the hull's ring turns as it hunts
  enemy.radialTimer -= dt;
  if (enemy.radialTimer <= 0) {
    enemy.radialTimer = DREAD.radialInterval;
    return 'radial';
  }
  enemy.volleyTimer -= dt;
  if (enemy.volleyTimer <= 0) {
    enemy.volleyTimer = DREAD.volleyInterval;
    return 'volley';
  }
  return null;
}

// Move one enemy for a frame. Returns an attack event when one fires:
// 'fire' (a weaver or orbiter bolt), 'radial' or 'volley' (the Dreadnought).
export function steerEnemy(enemy, player, dt) {
  let event = null;
  switch (enemy.kind) {
    case 'dart': steerDart(enemy, player, dt); break;
    case 'mite': steerMite(enemy, player, dt); break;
    case 'orb': steerOrb(enemy, player, dt); break;
    case 'weaver': if (steerWeaver(enemy, player, dt)) event = 'fire'; break;
    case 'charger': steerCharger(enemy, player, dt); break;
    case 'orbiter': if (steerOrbiter(enemy, player, dt)) event = 'fire'; break;
    case 'dread': event = steerDread(enemy, player, dt); break;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  // Nothing leaves the arena: enemies press against its walls instead.
  enemy.x = Math.min(VIEW_WIDTH - enemy.radius, Math.max(enemy.radius, enemy.x));
  enemy.y = Math.min(VIEW_HEIGHT - enemy.radius, Math.max(enemy.radius, enemy.y));
  if (enemy.flash > 0) enemy.flash -= dt;
  return event;
}
