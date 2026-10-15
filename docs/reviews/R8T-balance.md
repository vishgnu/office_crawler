# R8T-balance (CORE-R8T-2, R8-A3): floor 2 for a level-2 hero

## Problem
Proxy journey (3 classes, seed 7, 10 min on floor 2, level 2 to 4): Facilities Manager died twice, Sales Rep fell to 27 % hp, IT Wizard to 29 %.

## Measure (new tool `bot/floor-measure.mjs`, `node bot/floor-measure.mjs 24 60000`)
Bot route from the Lobby with quests on, seeds 1..24 x 3 classes, stops at first arrival on floor 5. Per floor: median entry level, deaths, near-deaths (hp < 25 %), median of the lowest hp share per run, runs whose lowest hp fell below 40 %. The bot enters floor 2 at level 2, floor 3 at 4, floor 4 at 6 (same before and after).

Before (floor: deaths / near / median lowest hp % / runs under 40 % of 24):

| floor | FM | SR | IT |
|---|---|---|---|
| 1 | 0/0/91/0 | 0/0/94/0 | 0/0/90/0 |
| 2 | 2/5/38/13 | 1/1/44/6 | 0/1/65/2 |
| 3 | 0/1/62/6 | 2/3/73/4 | 0/0/72/4 |
| 4 | 0/0/60/8 | 0/0/59/2 | 0/0/57/1 |

Floor 2 was the clear spike for FM (median lowest hp 38 %, 13 of 24 runs under 40 %), also SR.

## Variants tried (all 24 seeds x 3 classes)
- A: floor 2 hp multiplier 0.72 to 0.62 (chosen).
- B: A plus floor-1 xpMult 2.5 to 3.2: no effect on entry level (still 2: the bot clears floor 1 in about 1.3 min), floor 2 FM 1 death, no better than A. Dropped.
- C: floor 2 hp multiplier 0.56: floor 2 only slightly better than A, floors 3 and 4 got worse (FM floor 3/4 median lowest 53/48 %, SR 57/45 %, runs under 40 % 8-9 each). Dropped: it starts to move the spike.
- Not used: floor-1 potion or gear reward (the bot never needed more than the start kit on floor 1; a reward would only change the human route that the bot cannot measure).

## Change (one number)
`config.depthMult.hp[1]` (floor 2): 0.72 to 0.62. Effective floor 2 hp is 1.17 x hpBase, still above floor 1 (1.0) and below floor 3 (1.55), so AC-R-031-1 (never falls with depth) holds. Damage, pack sizes, xpMult, potions untouched.

## After (same tool)
| floor | FM | SR | IT |
|---|---|---|---|
| 2 | 0/1/51/10 | 0/0/44/9 | 0/0/76/0 |
| 3 | 0/1/66/8 | 2/2/63/2 | 0/0/68/1 |
| 4 | 0/0/56/8 | 0/0/56/6 | 0/0/62/1 |

Floor 2 deaths FM 2 to 0, SR 1 to 0; FM median lowest hp 38 to 51 %; IT clean (0 of 24 under 40 %). FM and SR floor 2 are now level with floor 4 (FM 56-60 %). Floor 3 SR still 2 deaths (as before, was 2), floor 3/4 unchanged within noise. Floor 2 is still the lowest-hp floor for SR (44 %), so a human who is slower than the bot may still feel it; this is a smoothing, not a removal.

## Parity (24 seeds x 3 classes, quests on, `node bot/parity.mjs 24 150000`)
Wins 24/24 each (72/72), medians 23.8 / 24.0 / 23.3 min (before 24.3 / 24.0 / 23.8), all eight quests 24/24 per class, watchdog 0. Total deaths FM 3 SR 5 IT 5 (before FM 6 SR 6 IT 3). Deaths by depth: FM d5, d6; SR d3 x2, d6, d8 x2; IT d8 x2, d9 x3. FM "dominant skill" verdict (pallet-slam 52 %, was 55 %) is the pre-existing one.

## Goldens
run-a.hash, run-class.json, run-a.legacy proof: unchanged (the recordings do not reach a changed number). run-c re-recorded: its old input script no longer holds (monsters die at different ticks, the recording stopped using stairs and fights). New recording by the bot (quests off, depth 9, seed 3, 24000 ticks, no death; deepest floor 3, 118 kills); replay hash equals the live hash: 37fd4406e43949fd to 0792d55d8cdcdf89. Proof that only numbers moved: `quests-hash` and `balance-legacy-proof` tests green under `withLegacyBalance` (it resets depthMult to 1, so the legacy hashes are unaffected), and `CR7-02 run-c without any quest system` (hashStateWithout) green on the new recording.

## Honest notes
Met by bot route; a human gets the same floor 2 hp. The proxy's own 10-minute clicker run is the check that still has to happen (R8-A3 acceptance); the bot's journey is faster and uses potions by rule.
