// upgrades.js — the level-up draft. When the core meter fills, the game pauses
// and offers three of these; each one changes how the ship fights in a way the
// player can feel, and a few can be taken again and stack. Repair is always in
// the pool while the hull is hurt, so a draft is never three dead cards.

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Blasters',
    blurb: 'Fire 22% faster. The stream thickens; the trigger stays honest.',
    mark: '»',
    canTake: () => true,
    apply: (player) => { player.fireInterval *= 0.82; },
  },
  {
    id: 'damage',
    name: 'Heavy Rounds',
    blurb: '+1 damage per bolt. Darts pop in two hits, orbs stop shrugging.',
    mark: '◆',
    canTake: () => true,
    apply: (player) => { player.bulletDamage += 1; },
  },
  {
    id: 'multishot',
    name: 'Split Cannon',
    blurb: '+1 bolt per volley, fanned across your aim. Wide where it counts.',
    mark: '⋔',
    canTake: (player) => player.projectiles < 4,
    apply: (player) => { player.projectiles += 1; },
  },
  {
    id: 'thrusters',
    name: 'Ion Thrusters',
    blurb: 'Move 14% faster. Outrun the weave, chase the cores you earned.',
    mark: '➤',
    canTake: () => true,
    apply: (player) => { player.speed *= 1.14; },
  },
  {
    id: 'plating',
    name: 'Aegis Plating',
    blurb: '+25 maximum hull, and patch 25 of it right now.',
    mark: '⬢',
    canTake: () => true,
    apply: (player) => {
      player.hullMax += 25;
      player.hull = Math.min(player.hullMax, player.hull + 25);
    },
  },
  {
    id: 'magnet',
    name: 'Core Magnet',
    blurb: 'Cores fly to you from 70% farther away. Greed, automated.',
    mark: '◎',
    canTake: () => true,
    apply: (player) => { player.magnetRadius *= 1.7; },
  },
  {
    id: 'repair',
    name: 'Field Repair',
    blurb: 'Patch 40 hull immediately. Unglamorous, occasionally priceless.',
    mark: '+',
    canTake: (player) => player.hull < player.hullMax,
    apply: (player) => { player.hull = Math.min(player.hullMax, player.hull + 40); },
  },
];

// Draw three distinct upgrades the ship can still take. Repair is weighted in
// whenever the hull is below half, so a dying pilot is offered a way back.
export function draftUpgrades(player, rng = Math.random) {
  const pool = UPGRADES.filter((u) => u.canTake(player));
  const weighted = [];
  for (const u of pool) {
    weighted.push(u);
    if (u.id === 'repair' && player.hull < player.hullMax * 0.5) weighted.push(u, u);
  }
  const picked = [];
  const used = new Set();
  while (picked.length < 3 && used.size < pool.length) {
    const candidate = weighted[Math.floor(rng() * weighted.length)];
    if (used.has(candidate.id)) continue;
    used.add(candidate.id);
    picked.push(candidate);
  }
  return picked;
}
