// config.js — every shared constant for Starfall Arena in one place: the arena's size,
// the neon palette, and the tuning numbers the other modules read. Nothing here runs;
// it only names things, so balancing the game means editing this file alone.

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 800;

// The one palette the whole game is drawn in: deep space blues, a cyan ship, hot
// magenta and amber enemies, green cores. Render and entities both read these.
export const COLORS = {
  spaceTop: '#070b1e',
  spaceBottom: '#0d1030',
  nebulaA: 'rgba(64, 44, 148, 0.20)',
  nebulaB: 'rgba(16, 92, 122, 0.16)',
  grid: 'rgba(90, 120, 255, 0.07)',
  ship: '#59f2ff',
  shipCore: '#e8feff',
  bullet: '#aefcff',
  enemyBolt: '#ff5d8f',
  dart: '#ff5d7a',
  mite: '#ff9f43',
  orb: '#c86bff',
  weaver: '#ff4fd8',
  core: '#7dff9a',
  textMain: '#eaf6ff',
  textDim: '#8fa8c8',
  hullGood: '#57ffa4',
  hullHurt: '#ffd257',
  hullBad: '#ff5d6c',
  xp: '#7dc4ff',
  combo: '#ffd257',
};

// The pilot's ship: a small, quick hull that answers the keys at once.
export const PLAYER = {
  radius: 12,
  speed: 268,
  acceleration: 2400,
  damping: 6.5,
  hull: 100,
  invulnerableSeconds: 0.7,
  fireInterval: 0.155,
  bulletSpeed: 660,
  bulletDamage: 1,
  bulletRadius: 3,
  bulletLife: 0.95,
  magnetRadius: 92,
  corePullSpeed: 340,
};

// One row per enemy kind: hit points, pace, size, what a kill pays, and the hull a
// collision costs. world.js scales some of these gently as the waves climb.
export const ENEMIES = {
  dart:   { hp: 3, speed: 138, radius: 11, score: 50,  touchDamage: 10, coreChance: 0.85, coreValue: 1 },
  mite:   { hp: 1, speed: 196, radius: 7,  score: 25,  touchDamage: 6,  coreChance: 0.45, coreValue: 1 },
  orb:    { hp: 9, speed: 60,  radius: 21, score: 120, touchDamage: 16, coreChance: 1.0,  coreValue: 2 },
  weaver: { hp: 5, speed: 108, radius: 13, score: 150, touchDamage: 12, coreChance: 0.9,  coreValue: 1 },
};

export const WEAVER = {
  keepNear: 235,      // the weaver closes until it is this far from the ship
  keepFar: 320,       // and backs away when the ship comes closer than this
  strafeSpeed: 74,    // sideways drift while it holds its range
  fireInterval: 2.3,  // seconds between its bolts
  boltSpeed: 246,
  boltRadius: 4,
  boltDamage: 8,
  boltLife: 3.4,
};

// Waves: wave n fields a budget of points and spends them on the kinds it has
// unlocked; dearer kinds cost more of the budget. Spawn points trickle in so a wave
// arrives as a fight, not a wall.
export const WAVES = {
  baseBudget: 5,
  budgetPerWave: 3,
  cost: { dart: 1, orb: 3, weaver: 3 },
  unlockWave: { orb: 2, weaver: 3 },
  spawnInterval: 0.65,
  intermission: 2.6,
  hpBonusEveryWaves: 4,   // +1 hp to darts and orbs this often
  speedGrowth: 0.02,      // +2% enemy speed per wave, capped below
  speedGrowthCap: 0.35,
};

// Scoring and growth: a kill feeds the combo multiplier, which then leaks away
// until the next kill; cores feed the level meter, and each level asks for more.
export const SCORE = {
  comboPerKill: 0.2,
  comboMax: 5,
  comboDecayPerSecond: 0.55,
  xpFirstLevel: 6,
  xpPerLevel: 4,
};
