# R7-4.1 CORE-R74 notes (2026-10-14)

## Golden re-pin (AC-R-259-4, ADR-0007 amendment A4)

Reason: the state gains `quests.sq4` and `quests.sq5` for every run (two more `available` entries), nothing else. One re-pin, step 1 of R7-4.1.

| Golden | Before R7-4 | After R7-4 | Stripped (`hashStateWithout`: `quests`, `player.pouch`, `quest.*` events) | Baseline (unchanged) |
|---|---|---|---|---|
| `run-a.hash` = `run-class.json` facilities-manager | `60a33ace8c544a3c` | `ddf99b3dec3d65dd` | `4a96887c22fea751` | `run-a.pre-quests.hash` `4a96887c22fea751` (equal) |
| `run-class.json` sales-rep | `f498c8fb2837087c` | `1a6a4c4e6686ebcf` | `f8676f7f5ab6bb2b` | `run-class.pre-quests.json` equal |
| `run-class.json` it-wizard | `934fb325dd581dd7` | `e05ade5467891ec0` | `602769930849f1d4` | `run-class.pre-quests.json` equal |
| `run-b.hash` | `96042aff73a81d46` | `b016a71628c0bc15` | with `config.quests.arc.*` zeroed: `6c70792233585181` | `run-b.pre-quests.hash` `6c70792233585181` (equal) |

- Guard: `test/quests-hash.test.js` asserts that `run-a` (all three classes) never reaches floor 3 (`quests.main.m.depth < 3`), so no arc reward is paid there; if it ever does the test says the proof must zero the arc rewards.
- `run-b` reaches floor 3 (`m.depth` 3): arc 1 pays 50 gold and 65 experience there, which the pre-quest game could not. The proof (`test/quests-fix-r7.test.js`) asserts that the stripped hash with the reward paid differs (`30969ee631712272`) and equals the pre-quest baseline with `config.quests.arc` set to zero (test copy of the config, restored in `finally`). The "no quest system" run-b test and `AC-R-240-2` (`quests-0-2-gen.test.js`, floors 1 to 8) zero the arc rewards the same way.
- Same seed and inputs give the same hash in Node (replayed twice in `determinism.test.js`); the browser replay is part of `e2e/replay.mjs`.

## Deviations and additions against the ADR text (all content or tooling, no machine change)

- `rewardSummary(id).gear.slot` is `"accessory"` when every slot is ring, amulet or belt (sq5), `"armour"` for sq2, `"weapon"` for sq3; `maxRarity` is new (`magic` for sq5, `rare` for the others). `rewardSummary("main3")` is `null` (pays nothing), `rewardSummary("main"|"main2")` is `{gold, xp, potions: 0, gear: null}`.
- `questPin` error `locked` (a main quest that is not open yet) is new; `questPin "main"` is the alias for the active main quest, so a completed arc 1 cannot be pinned by its own id `main` (it resolves to the active arc); with all three done it answers `already done`.
- `quest.step` carries `step` = the step inside its quest (1..3, 1..3, 1..4) and the optional `unlocked: true`; `snapshot.quests.<main id>`: `step` is the step inside the quest (0 while `unavailable`, its length when completed), `stepCount` the length of that quest (3, 3, 4), `state` is `unavailable|active|completed`; main2 and main3 have no `m` field in the snapshot (only `main` carries the milestones).
- New exports of `src/core/index.js`: `mainState(m, id)`, `reviveKills(state, id)` (`reviveInterns` stays as the sq1 form), `content.mainIds`, `content.mainSteps` (ten entries `{..step, arcId, arc, arcStep, n}`), `content.lockedLine`.
- Slot index: `qv: 5` (new), `mainStep` 1..10 (the global step), `mainDone` only when all three main quests are done, `sidesDone` 0..5. `upgradeIndex` treats an `ok` entry without `qv: 5` (or without an integer `mainStep`) as stale and rebuilds it from the slot text; if the rebuild fails the old entry is kept without its quest fields (no card quest line, no crash) and is retried at the next boot.
- `bot/parity.mjs`: `PARITY_QUESTS=off` runs the same seeds without the quest part of the bot (used for the shift measurement); the quest rows list all eight quests and the trip time per stage.

## Parity (24 seeds x 3 classes, `npm run parity`, quests on; "off" = the same seeds, the bot accepts nothing, arcs still pay)

| class | wins | median min (min-max), on | median min, off | shift | deaths on / off (sum) |
|---|---|---|---|---|---|
| facilities-manager | 23/24 | 32.1 (27.4-38.3) | 27.8 | +4.3 min (+15.2 %) | 28 / 67 |
| sales-rep | 24/24 | 32.5 (30.7-34.9) | 26.8 | +5.7 min (+21.3 %) | 12 / 61 |
| it-wizard | 23/24 | 32.4 (27.9-40.4) | 26.7 | +5.7 min (+21.0 %) | 33 / 83 |

- All eight quests completed in 70 of 72 runs; the two others (facilities-manager seed 15, it-wizard seed 2) hit the 150000-tick cap in the boss fight (deaths 7 and 8 in the arena), every quest except `main3` done. 0 give-ups, 0 watchdog fires, trips 72 of 72 runs (T1 median 2.1 min, T2 median 3.6 to 3.8 min).
- Time to the boss: medians inside the 20 to 40 minute window; the three medians are 32.1, 32.5 and 32.4 (deviation from the three-class median -1 %, +1 %, 0 %, band 25 %). The class shift of the median against quests off differs by 6.1 points (15.2 % against 21.3 %): above the 5 point target of AC-R-259-3, see the hand-back. The median deaths differ (1, 0, 1: sales-rep at 0 reads as -100 % in the existing deaths band; the same band was already out for sales-rep with quests off, 2 against 3).
