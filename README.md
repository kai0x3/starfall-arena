[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/kai0x3/starfall-arena/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/kai0x3/starfall-arena/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Starfall Arena

A neon arena survival game for make.fun's **best-game-01** bounty ("Make the best
game", $1,000). You pilot the last ship in a walled arena while a swarm pours in
in escalating waves. Shoot it down, bank the cores the wrecks drop, and spend
every level on an upgrade you choose — then see how many waves the arena lets
you keep.

## How to play

Serve the `game/` folder with any static file server and open `game/index.html`
in a desktop browser — no build step, no network requests, everything it needs
is in that folder. For a quick local game:

```
python3 -m http.server 8080 --directory game
# then open http://localhost:8080
```

| Input | Action |
| --- | --- |
| WASD / arrow keys | Fly |
| Mouse | Aim |
| Hold left mouse button / Space | Fire |
| Shift / right-click | Dash (once the Phase Dash upgrade is drafted) |
| 1 · 2 · 3 or click a card | Choose an upgrade at level-up |
| P / Esc | Pause |
| M | Mute |
| Enter / click | Launch from the title screen |
| R / click | Restart after game over |

## The game

- **Six enemy kinds, six tempers.** *Darts* run you down with a weave.
  *Orbs* plod in behind a thick hull and split into three fast *mites* when
  destroyed. *Weavers* hold their range, strafe, and shoot back. *Chargers*
  cruise in, flash white as they gather themselves, then lunge in a straight
  line. *Orbiters* take a ring around your ship and tighten it, plinking
  bolts inward. And every fifth wave the **Dreadnought** arrives — a boss
  with a hull bar of its own, rings of bolts, aimed volleys, and a shower of
  cores when it finally breaks.
- **Cores and levels.** Destroyed enemies drop cores; fly over them (or let the
  magnet pull them in) to fill the level meter. Each level pauses the fight and
  drafts three of twelve upgrades — fire rate, damage, extra cannons, piercing
  rounds, critical systems, thrusters, plating, a repair swarm, the dash
  drive, and more — several of which feed each other, and the choice is yours.
- **Combo scoring.** Kills raise a score multiplier that leaks away between
  kills, so the bold line through the swarm pays better than camping a corner.
  Clearing a wave pays a bonus on top.
- **A complete loop.** Title screen, HUD (score, combo, wave, level, cores,
  hull, next-level meter, the boss bar and the dash charge when they apply),
  escalating waves, a game-over screen with your final score, wave, kills and
  best combo — and one-key restart.
- **Sound, synthesized.** Every effect and the music loop are generated with
  WebAudio in `game/src/audio.js`; the game ships no audio files. The music
  answers the fight: hats join in the late waves, and the sequencer doubles
  its pace while the Dreadnought is out.

## Structure

```
main.ts                  the entry program: copies game/ + screenshots/ to the
                         output and writes dossier.json (vendored library)
vendor/makefun-game.ts   make.fun's dossier library, byte for byte the kit's
game/
  index.html             the page: one canvas, one module script
  style.css              the stage around the canvas
  src/
    config.js            palette, arena size and every tuning number
    input.js             keyboard and mouse state
    audio.js             WebAudio effects and the music sequencer
    entities.js          the ship, bullets, cores, particles, enemy steering
    upgrades.js          the level-up draft and what each upgrade does
    world.js             waves, collisions, combo, cores, levels — the rules
    render.js            backdrop, entities, HUD and every screen
    main.js              bootstrap, the state machine, the attract-mode pilot
screenshots/             the title, a live fight, the draft, and the boss
```

The screenshots were taken with the game's own attract mode (the `?shot=…`
modes in `game/src/main.js`): the pilot flies real runs under the real rules,
and the game-over shot is a run the swarm actually won.
