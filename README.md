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
| 1 · 2 · 3 or click a card | Choose an upgrade at level-up |
| P / Esc | Pause |
| M | Mute |
| Enter / click | Launch from the title screen |
| R / click | Restart after game over |

## The game

- **Three enemy kinds, three tempers.** *Darts* run you down with a weave.
  *Orbs* plod in behind a thick hull and split into three fast *mites* when
  destroyed. *Weavers* hold their range, strafe, and shoot back.
- **Cores and levels.** Destroyed enemies drop cores; fly over them (or let the
  magnet pull them in) to fill the level meter. Each level pauses the fight and
  drafts three upgrades — fire rate, damage, an extra cannon, thrusters,
  plating, magnet range, repairs — and the choice is yours.
- **Combo scoring.** Kills raise a score multiplier that leaks away between
  kills, so the bold line through the swarm pays better than camping a corner.
- **A complete loop.** Title screen, HUD (score, combo, wave, level, cores,
  hull, next-level meter), escalating waves, a game-over screen with your final
  score, wave, kills and best combo — and one-key restart.
- **Sound, synthesized.** Every effect and the music loop are generated with
  WebAudio in `game/src/audio.js`; the game ships no audio files.

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
screenshots/             the title, a live fight, and an honest game over
```

The screenshots were taken with the game's own attract mode (`?shot=play` and
`?shot=end` in `game/src/main.js`): the pilot flies real runs under the real
rules, and the game-over shot is a run the swarm actually won.
