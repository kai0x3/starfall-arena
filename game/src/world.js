// world.js — the state of one run and the rules that move it: waves and their
// spawning, gunfire, collisions, wrecks and the cores they drop, the combo that
// feeds the score, and the meter that feeds the level-up draft. Rendering reads
// this; input steers it; nothing here knows about the DOM.

import { COLORS, ENEMIES, SCORE, VIEW_HEIGHT, VIEW_WIDTH, WAVES, WEAVER } from './config.js';
import {
  burst, makeBullet, makeCore, makeEnemy, makeEnemyBolt, makePlayer, steerEnemy, steerPlayer,
} from './entities.js';
import { draftUpgrades } from './upgrades.js';

const rand = (min, max) => min + Math.random() * (max - min);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class World {
  constructor(sound) {
    this.sound = sound;
    this.reset();
  }

  reset() {
    this.player = makePlayer();
    this.bullets = [];
    this.enemyBolts = [];
    this.enemies = [];
    this.cores = [];
    this.particles = [];
    this.texts = []; // floating score popups: {x, y, text, age, life, color}
    this.score = 0;
    this.kills = 0;
    this.combo = 1;        // the live multiplier; kills raise it, time leaks it
    this.bestCombo = 1;
    this.coresBanked = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = SCORE.xpFirstLevel;
    this.wave = 0;
    this.waveState = 'intermission'; // intermission -> spawning -> fighting -> intermission
    this.waveTimer = 1.2;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.shake = 0;
    this.hurtFlash = 0;
    this.time = 0;
    this.over = false;
    this.pendingLevels = 0;
    this.levelChoices = null;
  }

  startRun() {
    this.reset();
    this.waveTimer = 1.4;
  }

  // --- Waves ---------------------------------------------------------------

  #planWave(n) {
    let budget = WAVES.baseBudget + WAVES.budgetPerWave * n;
    const kinds = ['dart'];
    if (n >= WAVES.unlockWave.orb) kinds.push('orb');
    if (n >= WAVES.unlockWave.weaver) kinds.push('weaver');
    const queue = [];
    while (budget > 0) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (WAVES.cost[kind] > budget && kind !== 'dart') continue;
      budget -= WAVES.cost[kind];
      queue.push(kind);
    }
    // A wave should arrive mixed, not sorted: shuffle the queue.
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  #spawnPoint() {
    // Just inside a random wall, never on top of the ship.
    for (let tries = 0; tries < 8; tries++) {
      const side = Math.floor(Math.random() * 4);
      const point = {
        x: side === 0 ? 30 : side === 1 ? VIEW_WIDTH - 30 : rand(40, VIEW_WIDTH - 40),
        y: side === 2 ? 30 : side === 3 ? VIEW_HEIGHT - 30 : rand(40, VIEW_HEIGHT - 40),
      };
      if (dist2(point, this.player) > 260 ** 2) return point;
    }
    return { x: 40, y: 40 };
  }

  #advanceWaves(dt) {
    if (this.waveState === 'intermission') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.wave += 1;
        this.spawnQueue = this.#planWave(this.wave);
        this.waveState = 'spawning';
        this.spawnTimer = 0;
        this.#addText(VIEW_WIDTH / 2, 150, `WAVE ${this.wave}`, COLORS.textMain, 1.6, 30);
      }
    } else if (this.waveState === 'spawning' || this.waveState === 'fighting') {
      if (this.spawnQueue.length > 0) {
        this.waveState = 'spawning';
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = WAVES.spawnInterval;
          const kind = this.spawnQueue.shift();
          const point = this.#spawnPoint();
          this.enemies.push(makeEnemy(kind, point.x, point.y, this.wave));
        }
      } else if (this.enemies.length === 0) {
        this.waveState = 'intermission';
        this.waveTimer = WAVES.intermission;
      } else {
        this.waveState = 'fighting';
      }
    }
  }

  // --- Combat ---------------------------------------------------------------

  #fireGuns(dt, aimAngle) {
    const player = this.player;
    player.fireTimer -= dt;
    if (player.fireTimer > 0) return;
    player.fireTimer = player.fireInterval;
    const count = player.projectiles;
    const spread = 0.085;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread;
      const nose = {
        x: player.x + Math.cos(aimAngle) * (player.radius + 4),
        y: player.y + Math.sin(aimAngle) * (player.radius + 4),
      };
      this.bullets.push(makeBullet(nose.x, nose.y, aimAngle + offset, player.bulletDamage));
    }
    this.sound.shoot();
  }

  #killEnemy(enemy) {
    this.kills += 1;
    this.combo = Math.min(SCORE.comboMax, this.combo + SCORE.comboPerKill);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const gained = Math.round(enemy.score * this.combo);
    this.score += gained;
    this.#addText(enemy.x, enemy.y - 10, `+${gained}`, COLORS.combo, 0.8, 15);
    const stats = ENEMIES[enemy.kind];
    burst(this.particles, enemy.x, enemy.y, COLORS[enemy.kind], enemy.kind === 'orb' ? 26 : 15,
      enemy.kind === 'orb' ? 300 : 240, 0.6, 3.4);
    this.sound.explosion(enemy.kind === 'orb');
    this.shake = Math.min(9, this.shake + (enemy.kind === 'orb' ? 5 : 2.2));
    if (enemy.kind === 'orb') {
      // The splitter's promise: three mites boil out of the wreck.
      for (let i = 0; i < 3; i++) {
        const mite = makeEnemy('mite', enemy.x + rand(-14, 14), enemy.y + rand(-14, 14), this.wave);
        this.enemies.push(mite);
      }
    }
    if (Math.random() < stats.coreChance) {
      this.cores.push(makeCore(enemy.x, enemy.y, stats.coreValue));
    }
  }

  damagePlayer(amount) {
    const player = this.player;
    if (player.invulnerable > 0 || this.over) return;
    player.hull -= amount;
    player.invulnerable = 0.7;
    this.hurtFlash = 0.55;
    this.shake = Math.min(12, this.shake + 6);
    burst(this.particles, player.x, player.y, COLORS.ship, 12, 220, 0.45, 3);
    this.sound.hurt();
    if (player.hull <= 0) {
      player.hull = 0;
      this.over = true;
      burst(this.particles, player.x, player.y, COLORS.ship, 46, 380, 1.1, 4.2);
      burst(this.particles, player.x, player.y, COLORS.bullet, 24, 260, 0.9, 3);
      this.shake = 14;
      this.sound.explosion(true);
      this.sound.gameOver();
      this.sound.stopMusic();
    }
  }

  #gainXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = SCORE.xpFirstLevel + (this.level - 1) * SCORE.xpPerLevel;
      this.pendingLevels += 1;
    }
  }

  // Called by the game loop when a level-up is pending and the fight can pause.
  openLevelDraft() {
    this.levelChoices = draftUpgrades(this.player);
    this.sound.levelUp();
    return this.levelChoices;
  }

  chooseUpgrade(upgrade) {
    upgrade.apply(this.player);
    this.pendingLevels -= 1;
    this.levelChoices = null;
    this.#addText(this.player.x, this.player.y - 30, upgrade.name.toUpperCase(), COLORS.xp, 1.1, 17);
    this.sound.uiClick();
  }

  #addText(x, y, text, color, life, size) {
    this.texts.push({ x, y, text, color, life, size, age: 0 });
  }

  // --- The frame ------------------------------------------------------------

  // autopilot, when given, replaces the human's aim and trigger (the attract
  // mode the screenshot harness uses); movement still comes from the input.
  update(dt, input, autopilot = null) {
    if (this.over) {
      this.#updateDebris(dt);
      return;
    }
    this.time += dt;
    const player = this.player;

    steerPlayer(player, input.moveAxis(), dt);
    if (player.invulnerable > 0) player.invulnerable -= dt;

    // Aim: at the mouse, or wherever the autopilot points.
    const aimAngle = autopilot
      ? autopilot.aimAngle(this)
      : Math.atan2(input.mouseY - player.y, input.mouseX - player.x);
    player.angle = aimAngle;
    const wantsFire = autopilot ? autopilot.firing(this) : input.firing();
    if (wantsFire) this.#fireGuns(dt, aimAngle);
    else player.fireTimer = Math.min(player.fireTimer, 0.03);

    // Engine trail: a small exhaust spark every few frames while thrusting.
    if (player.thrust > 0.35 && Math.random() < 0.55) {
      const back = aimAngle + Math.PI + rand(-0.5, 0.5);
      this.particles.push({
        x: player.x - Math.cos(player.angle) * 0 + rand(-3, 3),
        y: player.y + rand(-3, 3),
        vx: Math.cos(back) * 60 + player.vx * 0.3,
        vy: Math.sin(back) * 60 + player.vy * 0.3,
        color: COLORS.ship, life: 0.32, age: 0, size: 2.4,
      });
    }

    this.#advanceWaves(dt);
    this.#updateBullets(dt);
    this.#updateEnemies(dt);
    this.#updateCores(dt);
    this.#collide();
    this.#updateDebris(dt);

    // The combo leaks away between kills; a quiet arena is a resetting one.
    if (this.combo > 1) {
      this.combo = Math.max(1, this.combo - SCORE.comboDecayPerSecond * dt);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
  }

  #updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0
      && b.x > -20 && b.x < VIEW_WIDTH + 20 && b.y > -20 && b.y < VIEW_HEIGHT + 20);
    for (const bolt of this.enemyBolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
    }
    this.enemyBolts = this.enemyBolts.filter((b) => b.life > 0
      && b.x > -20 && b.x < VIEW_WIDTH + 20 && b.y > -20 && b.y < VIEW_HEIGHT + 20);
  }

  #updateEnemies(dt) {
    for (const enemy of this.enemies) {
      const event = steerEnemy(enemy, this.player, dt);
      if (event === 'fire') {
        const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        this.enemyBolts.push(makeEnemyBolt(enemy.x, enemy.y, angle));
        this.sound.enemyHit();
      }
    }
  }

  #updateCores(dt) {
    const player = this.player;
    for (const core of this.cores) {
      core.age += dt;
      core.x += core.vx * dt;
      core.y += core.vy * dt;
      core.vx *= Math.exp(-2.4 * dt);
      core.vy *= Math.exp(-2.4 * dt);
      const d2 = dist2(core, player);
      if (d2 < player.magnetRadius ** 2) {
        // The magnet takes it: accelerate the core straight at the ship.
        const d = Math.sqrt(d2) || 1;
        core.vx = ((player.x - core.x) / d) * 340;
        core.vy = ((player.y - core.y) / d) * 340;
      }
      if (d2 < (player.radius + core.radius + 4) ** 2) {
        core.age = core.life; // collected: the filter below removes it
        this.coresBanked += core.value;
        this.#gainXp(core.value);
        this.sound.pickup();
        burst(this.particles, core.x, core.y, COLORS.core, 6, 130, 0.35, 2.4);
      }
    }
    this.cores = this.cores.filter((c) => c.age < c.life);
  }

  #collide() {
    const player = this.player;
    // Ship's bullets against enemies.
    for (const bullet of this.bullets) {
      if (bullet.life <= 0) continue;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        if (dist2(bullet, enemy) < (bullet.radius + enemy.radius) ** 2) {
          bullet.life = 0;
          enemy.hp -= bullet.damage;
          enemy.flash = 0.09;
          burst(this.particles, bullet.x, bullet.y, COLORS.bullet, 3, 150, 0.25, 2.2);
          if (enemy.hp > 0) this.sound.enemyHit();
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    // Reap the dead (a splitter's children were already added by #killEnemy).
    const dead = this.enemies.filter((e) => e.hp <= 0);
    if (dead.length > 0) {
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      for (const enemy of dead) this.#killEnemy(enemy);
    }
    // Enemy bolts against the ship.
    for (const bolt of this.enemyBolts) {
      if (dist2(bolt, player) < (bolt.radius + player.radius) ** 2) {
        bolt.life = 0;
        this.damagePlayer(WEAVER.boltDamage);
      }
    }
    this.enemyBolts = this.enemyBolts.filter((b) => b.life > 0);
    // Bodies against the ship: the enemy is wrecked too, which keeps a touch
    // from draining the hull every frame.
    for (const enemy of this.enemies) {
      if (dist2(enemy, player) < (enemy.radius + player.radius - 2) ** 2) {
        enemy.hp = 0;
        this.damagePlayer(enemy.touchDamage);
      }
    }
    const touched = this.enemies.filter((e) => e.hp <= 0);
    if (touched.length > 0) {
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      for (const enemy of touched) this.#killEnemy(enemy);
    }
  }

  #updateDebris(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-1.6 * dt);
      p.vy *= Math.exp(-1.6 * dt);
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const t of this.texts) {
      t.age += dt;
      t.y -= 26 * dt;
    }
    this.texts = this.texts.filter((t) => t.age < t.life);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
  }
}
