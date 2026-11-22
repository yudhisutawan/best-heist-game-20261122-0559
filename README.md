[![best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/yudhisutawan/best-heist-game-20261122-0559/rank.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/yudhisutawan/best-heist-game-20261122-0559/reward.svg)](https://make.fun/c/best-heist-game-20261122-0559)

# Neon Cut — a three-floor casino heist

A complete top-down heist game that plays offline in a desktop browser from its own files.
You are a thief working the Meridian Casino after the last guest leaves. Walk the neon
gaming floor in a disguise, slip past patrolling guards, time the laser grids, crack the
safes, lift the target loot on each floor, and walk out the exit before the alarm locks
the place down.

## How to play

- **WASD / arrow keys** — move · **SHIFT** — sprint (loud: guards hear it) · **E** — use / pick locks / crack safes
- **C** — disguise: guards ignore you at a distance, but cameras never are fooled, and snatching loot or sprinting in a cone blows it
- **Q** — smoke bomb (breaks every cone for a few seconds) · **R** — EMP pulse (kills cameras for 8 seconds)
- **P** — pause · **M** — mute · **X** — retry the floor
- Guards patrol with vision cones and chase when they spot you. The alarm meter fills while you are seen; at 100 the casino locks down for 12 seconds, guards converge, and the exit seals. Break line of sight and hide in the shadows until it stands down.
- Laser grids cycle on and off: crossing a live beam spikes the alarm. Safes need three steady hits on the green of the tumbler dial — a miss raises the alarm.
- Collect the target loot to unlock the exit. Finish a floor without raising the alarm past 25 for a **Ghost bonus**. Three floors: The Neon Floor, The High-Roller Suite, The Meridian Vault.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request, no files outside `game/`. All sounds are synthesised
with WebAudio. Click-to-move works too, and `?autopilot=1` plays the game itself.

## Entry

Built for [best-heist-game-20261122-0559](https://make.fun/c/best-heist-game-20261122-0559)
on make.fun. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of the game's own code, staged through
`?shot=start|play|alarm|win&seed=1` in `game/src/shots.js` (see `shots.json`).

## License

MIT — see [LICENSE](LICENSE).
