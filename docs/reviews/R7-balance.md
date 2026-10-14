# R7-3 BAL-R7: spread the difficulty (2026-10-14)

Customer decision (docs/product/00-brief.md, decisions item 6): "spread it out better across the floors". Measured with `npm run parity` (24 seeds x 3 classes, 72 runs per setting, `bot/parity.mjs`, now with a per-floor table) with quests on and with quests off (`PARITY_QUESTS=off`). Death and near-death counts are sums over the 72 runs; a near-death is one dip below 25 % hp; minutes and damage are per run, averaged over the 72 runs. Bots cannot tell how a floor feels: see the last section.

## What was wrong (baseline, quests on)

- Deaths: floors 1 to 5 almost none (0, 0, 1, 1, 0), then 8, 10, 5 on floors 6 to 8 and 48 in the boss arena. The boss alone was 66 % of all deaths.
- Damage taken on floors 1 and 2 was 4 and 33 hp per run (the hero has about 50 to 100 hp there): trivially safe.
- The class shift from quests differed by 6.1 points (+15.2 %, +21.3 %, +21.0 %), mostly the fixed trip time: the bot climbed from floor 4 (T1, 2.1 min) and from floor 6 (T2, 3.6 to 3.8 min) through every floor above, walking each one from the down stairs to the up stairs.

## Per floor, before and after (3 classes together, quests on)

| floor | deaths before | deaths after | near-deaths before | near-deaths after | min/run before | min/run after | damage/run before | damage/run after |
|---|---|---|---|---|---|---|---|---|
| Lobby | 0 | 0 | 0 | 0 | 0.9 | 0.9 | 0 | 0 |
| 1 | 0 | 0 | 0 | 0 | 2.2 | 1.9 | 4 | 24 |
| 2 | 0 | 4 | 0 | 7 | 3.3 | 2.2 | 33 | 113 |
| 3 | 1 | 2 | 1 | 6 | 3.8 | 2.4 | 73 | 143 |
| 4 | 1 | 5 | 1 | 7 | 4.3 | 3.6 | 171 | 198 |
| 5 | 0 | 2 | 0 | 5 | 3.7 | 2.9 | 290 | 406 |
| 6 | 8 | 6 | 14 | 16 | 3.9 | 3.4 | 581 | 487 |
| 7 | 10 | 2 | 14 | 3 | 3.6 | 3.2 | 670 | 559 |
| 8 | 5 | 8 | 12 | 12 | 4.8 | 3.8 | 786 | 659 |
| 9 (boss) | 48 | 7 | 82 | 20 | 2.2 | 1.2 | 1252 | 572 |
| total | 73 | 36 | 124 | 76 | | | | |

Reading: the early floors now cost hp (damage per run 6 times higher on floor 1, 3.4 times on floor 2) and kill now and then; the boss no longer stands out (48 to 7 deaths; floor 8 has 8). Not met in full: floors 1 (0 deaths, 0 near-deaths) and 3 (2) are still very safe in the count, which is what a bot with potions and a belt makes of a tutorial floor. Deaths are rare events in 72 runs, so "within a factor of 2 of the neighbours" cannot be read from the deaths alone: the damage column is the smooth one (24, 113, 143, 198, 406, 487, 559, 659) and the near-deaths ramp 0, 7, 6, 7, 5, 16, 3, 12.

Per class, final run (deaths sum / near-deaths sum per floor; full table in the parity output):

| floor | facilities-manager | sales-rep | it-wizard |
|---|---|---|---|
| 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| 2 | 3 / 6 | 1 / 1 | 0 / 0 |
| 3 | 1 / 3 | 1 / 2 | 0 / 1 |
| 4 | 2 / 4 | 2 / 2 | 1 / 1 |
| 5 | 1 / 2 | 1 / 2 | 0 / 1 |
| 6 | 3 / 11 | 3 / 5 | 0 / 0 |
| 7 | 1 / 1 | 0 / 1 | 1 / 1 |
| 8 | 3 / 6 | 3 / 3 | 2 / 3 |
| 9 | 4 / 8 | 0 / 2 | 3 / 10 |

## Parity (quests on, 24 seeds per class, final numbers)

| class | wins | median min (min-max) | dev from the 3-class median | median level | deaths (sum) | before: median min, deaths |
|---|---|---|---|---|---|---|
| facilities-manager | 24/24 | 25.9 (22.9-31.5) | 0 % | 18 | 18 | 32.1, 28 (23/24 wins) |
| sales-rep | 24/24 | 26.2 (23.5-27.4) | +1 % | 18 | 11 | 32.5, 12 |
| it-wizard | 24/24 | 24.8 (22.9-26.9) | -5 % | 18 | 7 | 32.4, 33 (23/24 wins) |

All medians are inside 20 to 40 minutes and inside the 25 % band (-5 % to +1 %). 72 of 72 runs win, all eight quests are completed in 72 of 72 runs, 0 quest give-ups, 0 bot watchdog give-ups, 0 stuck events. Median deaths 1, 0, 0 (the "deaths" band compares medians of 0 and 1: a count difference of one death reads as 100 % either way, as in the R7-4 table). The "dominant skill" flag on facilities-manager (pallet-slam 53 % of tree damage, limit 50 %) is the R6 finding, unchanged by this pass (it was 55 % before).

## Class shift from quests (AC-R-259-3, target spread of at most 5 points)

| class | median min on | median min off | shift | before (R7-4) |
|---|---|---|---|---|
| facilities-manager | 25.9 | 25.4 | +0.5 min (+2.0 %) | +4.3 min (+15.2 %) |
| sales-rep | 26.2 | 25.7 | +0.5 min (+1.9 %) | +5.7 min (+21.3 %) |
| it-wizard | 24.8 | 24.4 | +0.4 min (+1.6 %) | +5.7 min (+21.0 %) |

Spread of the three shifts: 0.4 points (before 6.1). The lever was trip cost: the median trip is now 0.1 min from floor 4 and 0.2 min from floor 6 (before 2.1 and 3.6 to 3.8), see changes. The rewards were not touched.

## Changes (file, old to new, why)

Numbers and data
1. `src/core/config.js` new `depthMult: { hp: [1, .72, .56, .48, .43, .365, .375, .35]` (floors 1 to 8), `damage: [2.3, 1.98, 1.74, 1.53, 1.37, 1.24, 1.2, 1.21] }`: a per-depth multiplier on the depth-scaled hp and damage of normal monsters (depths past the table use the last entry, bosses are not touched). Why: the old linear scaling made floors 1 to 5 trivial and left all the difficulty to 6 and beyond. Effective damage is now about 2.3 times the old one on floor 1 and 2.8 times on floor 8 (never falls with depth, AC-R-031-1), effective hp (in units of the new hpBase) rises 1.0, 1.35, 1.55, 1.75, 1.94, 1.97, 2.36, 2.51. Floors 4 and 6 are kept level with 3 and 5 on purpose: the quest rewards of the two Lobby trips arrive after them, so they were the death peaks.
2. `src/core/content/monsters.js` `hpBase` of the eight normal monsters times 2.3 (zombie intern 14 to 32, printer imp 8 to 18, temp worker 10 to 23, printer demon 12 to 28, middle manager 60 to 138, vending machine 90 to 207, consultant 22 to 51, auditor 70 to 161): AC-R-031-1 pins depth 1 hp to the registry, so floor 1 gets its teeth from the registry and the `depthMult.hp` table above is the same effect divided by 2.3 on the deeper floors. `monsterStats` applies the table with one rounding (`scale(base, pct, depth, mult)`), boss entries skip it.
3. `src/core/content/monsters.js` vending machine `minDepth` 4 to 5: floor 4 carried the elite quest target (middle manager, hp x 1.6) plus a vending machine and was a death peak before its reward; floor 5 had spare room. The scaling test still holds (auditor first on floor 5).
4. `src/core/config.js` `championChance` 0.3 to 0.4 (champion packs from floor 2 on): more variety on the early floors.
5. `src/core/config.js` `scaling.xpPct` 20 to 26: deeper kills pay more, so the hero reaches floor 6 one level higher (median level at the boss 17 to 18).
6. `src/core/config.js` `boss.hpMult` 3 to 2.5 and `boss.damageMult` 0.7 to 0.62: the arena had 48 of 73 deaths; with the stronger hero of the new curve the same numbers would have made it a wall for the casters. After: 7 deaths (4, 0, 3), fight 1.2 min per run instead of 2.2.
7. `src/core/content/items.js` Emergency Exit value 25 to 5 (vendor price 200 to 40 gold, affordable with the 50 starting gold): the item that makes the trip cheap must be buyable before the first descent. It is the same item a player can buy, so the shortcut is a real game route, not a bot trick.

Bot route (`bot/**`, route only)
8. `bot/quests.js`, `bot/policy.js`: the trip uses the Emergency Exit. The bot buys one at the first Lobby visit (and again after the first trip), uses it on the cleared stage floor (`useItem`), hands in, then takes the Lobby door back to the very tile (`usePortal`), instead of climbing four floors and riding the elevator. Fallback: stairs when no Exit is in the bag (`mem.profile.exitTrips === false` also forces the old route). Trip time from floor 4: 2.1 to 0.1 min, from floor 6: 3.6 to 0.2 min.
9. `bot/policy.js` chase fix found by the parity run: a monster written off by the watchdog kept its open attack order on the hero (the hero walked after it while it walked after the hero, round a block of cabinets, 85 000 ticks on facilities-manager seed 6 in two intermediate passes). The bot now drops the order of a written-off monster and fights it again once it attacks. (The pattern itself, two actors of equal speed orbiting a block, is a core chase property: see not_done.)
10. `bot/report.js`, `bot/parity.mjs`: per-floor ticks, damage taken and near-deaths per run, printed as the "Per floor" table of the parity output (the table above).

Tests
- `test/balance-spread.test.js` (new, 4 tests): depth curve never falls and bosses ignore it; floors 1 and 2 hit harder than the plain linear scaling; the Exit is affordable at the start; the first quest trip takes under a minute (bounded by ticks).
- `test/balance-legacy.js` (new helper) `withLegacyBalance(fn)`: puts the numbers above back to their old values for one call, used by the golden proofs below.

## Golden re-pin and proof

The sim changed on purpose (monster numbers, champion chance, vending machine depth, xp, Exit price), so every recorded run hashes differently. Proof that nothing else moved: replayed under `withLegacyBalance` (old numbers), the stripped hashes (`hashStateWithout`, quest subtree, pouch and `quest.*` events removed) equal the pre-quest baselines exactly; with the new numbers they differ (asserted in `test/quests-hash.test.js`).

| golden | old (R7-4) | new | proof |
|---|---|---|---|
| `run-a.hash` (= facilities-manager in `run-class.json`) | `ddf99b3dec3d65dd` | `64368cab05155adc` | legacy + stripped `4a96887c22fea751` equals `run-a.pre-quests.hash` |
| `run-class.json` sales-rep | `1a6a4c4e6686ebcf` | `d5770142da05808d` | legacy + stripped `f8676f7f5ab6bb2b` equals the pre-quest class golden |
| `run-class.json` it-wizard | `e05ade5467891ec0` | `06d493b6d6e98353` | legacy + stripped `602769930849f1d4` equals the pre-quest class golden |
| `run-b.hash` | `b016a71628c0bc15` | unchanged, now replayed under `withLegacyBalance` | legacy run-b: golden as before; legacy + arc rewards zeroed + stripped equals `run-b.pre-quests.hash` (`6c70792233585181`, the run-b zero-arc method); the R7 retarget rules off equals on |
| `run-c.hash` (new) | none | `c5235a6d8aa00605` | new recording of the same recipe as run-b (seed 3, Lobby start, bot with quests off, stairs to floor 3, 128 kills, 24 000 ticks) under the new numbers, because the old run-b script no longer reaches floor 3 on the tougher floors; tests: golden, no quest touched, quest system removed hashes equal with arc rewards zeroed, differs from its legacy replay |

`run-a` never reaches floor 3 (guard in `quests-hash.test.js`), so no arc reward is paid in it; run-c reaches floor 3, so its zero-arc proof zeroes `config.quests.arc` as run-b does.
Edited tests for this: `test/quests-hash.test.js`, `test/quests-fix-r7.test.js`, `test/adv-r7-quests.test.js` (the [R7-golden] proof now runs under `withLegacyBalance`; the claims are unchanged).

## Two tuning passes and what was tried

Pass 1 (exploratory, three runs): `depthMult` with early teeth and a late drop, deeper floors easier than floor 1 (deaths 25, 12, 12 in a run, medians 26): rejected by AC-R-031-1 (monster stats must not fall with depth) and by the depth-1-equals-registry rule; the curve was rebuilt monotone (effective damage 2.3 to 2.8, hp up) and hpBase rebased. Pass 2 (four runs): ease floors 4 to 6 (the pre-reward floors), vending machine to floor 5, then raise the hp of floors 2 to 4 to fill the 0, 0, 1 deaths there (final numbers above). Along the way one watchdog finding (change 9). Every full parity run is 9 minutes of wall time; nine quests-on runs and two quests-off runs (before and after) were made.

## What the bots cannot tell (feel)

- A bot drinks at 40 % hp, never panics and never mis-clicks: floor 1 shows 0 deaths and a few damage points for the wizard (8 hp per run), a human on their first 10 minutes will die more often, in particular facilities-manager (melee takes 3 to 5 times the wizard's damage) and in the first Lobby-free fights. If floor 1 feels too hard to a new player, `depthMult.damage[0]` and `hpBase` of the three swarmers are the dials.
- The Lobby trip is now almost free: a human may enjoy the walk through the cleared floors or not; the Exit costs 40 gold and the player has to think of it (the quest dialog could say so: UI text, not touched here).
- Quests off: a hero that accepts nothing hits a wall at floor 5 (deaths per floor 4 / 5 / 6 / 7 / 8: 1 / 32 / 25 / 33 / 18; before this pass 1 / 14 / 29 / 38 / 33, total 209 to 134). The side-quest gear and potions after floor 4 carry the quests-on game (2 deaths on floor 5 with quests, 32 without). This is the open question for the customer: whether a no-quest game is supported (then floor 5 needs a softer step and the quest rewards less weight) or quests are the intended route. Not decided here, it cuts into the rewards.
- Death counts per floor are small numbers (0 to 8 out of 72); the near-death and damage columns are the more reliable reading. The spike of near-deaths on floor 6 (16, against 5 and 3 next to it) is the one floor that still stands out, and is explained by the quest gear of the second trip arriving after it.
- The boss fight (1.2 min per run, 7 deaths) is much shorter than before; whether the finale still feels like one is a play-test question, the numbers only say it is winnable.
