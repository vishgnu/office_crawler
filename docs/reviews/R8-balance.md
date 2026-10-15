# R8-balance (BAL-R8): spread the deaths over the floors again

## Problem
After floor 1 was made sparse (R8-B1) it gives less XP, so floor 2 became the death hotspot (parity, 24 seeds x 3 classes, quests on: FM 12, SR 5, IT 0 deaths on floor 2); an earlier attempt to soften floor 2 only moved the deaths to floor 3. The customer wants the difficulty spread evenly (brief, decision 6).

## Change (numbers only; one new knob)
- `config.xpMult` (new), per depth multiplier of the XP paid at a kill (normal monsters, not bosses, not summoned): `[2.5, 1.2, 1.1, 1, 1.2, 1.25, 1, 1]`.
  - Pass 1: floor 1 x2.5 only. Floor 2 deaths FM 12 -> 2, SR 5 -> 1.
  - Pass 2: small bonuses on floors 2, 3, 5, 6 (floor 6 FM had 5 deaths / 9 near-deaths).
  - Paid at the kill (`src/core/systems/damage.js`), not in `monsterStats`: AC-R-031-1 requires monster xp to be non-decreasing with depth, and 2.5x on floor 1 would break that. The kill event carries the paid xp.
- Not touched: floor-2 pack sizes, depthMult, potions (the XP lever alone was enough; floor 2 stays as hard as before).
- Tests: `test/balance-legacy.js` also puts `xpMult` back (null); combat.test.js and progression.test.js expect the multiplied xp.
- Goldens (sim changed): run-a.hash, run-class.json, run-c.hash re-pinned; run-c re-recorded (the old script no longer reached floor 3 under the new xp: bot quests off, depth 9, seed 3, 24000 ticks, now floor 4, 124 kills). Proof: under `withLegacyBalance` the stripped legacy run-a still hashes to the pre-quest golden 4a96887c22fea751 (balance-legacy-proof and quests-hash tests green).

## Parity, before / after (24 seeds x 3 classes, quests on, bot route)
Per cell: deaths / near-deaths. Medians: before 24.2 / 24.9 / 24.1 min, after 24.3 / 24.0 / 23.8 min (all within 3 %). Wins 24/24 each, all quests 24/24, watchdog 0. Total deaths before FM 25 SR 16 IT 10 (parity before), after FM 6 SR 6 IT 3.

| floor | FM before | FM after | SR before | SR after | IT before | IT after |
|---|---|---|---|---|---|---|
| 1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| 2 | 12/21 | 2/5 | 5/9 | 1/1 | 0/1 | 0/1 |
| 3 | 1/4 | 0/1 | 4/7 | 2/3 | 0/0 | 0/0 |
| 4 | 2/4 | 0/0 | 1/2 | 0/0 | 0/0 | 0/0 |
| 5 | 0/1 | 1/2 | 0/0 | 0/0 | 0/0 | 0/0 |
| 6 | 7/10 | 1/5 | 2/5 | 1/3 | 1/1 | 1/1 |
| 7 | 0/1 | 0/5 | 0/1 | 0/0 | 1/2 | 0/0 |
| 8 | 1/2 | 1/2 | 4/6 | 1/1 | 1/1 | 0/6 |
| 9 (boss) | 2/5 | 1/1 | 0/1 | 1/2 | 7/8 | 2/4 |

Remaining: floor 2 still the single largest cell for FM (2 deaths, 5 near-deaths) and FM floor 6/7 near-deaths (5 each); IT floor 8 6 near-deaths without a death. No floor stands out by more than 2 deaths per class. The class-spread band: FM "dominant skill" verdict (pallet-slam 55 %) is the pre-existing one, not from this change.

## Honest notes
- Met by bot route: yes, but the lever is the game's XP, not a bot behaviour: a human gets the same 2.5x XP per floor-1 kill. Floor 1 itself: bot deaths 0; the naive clicker (test/r8-core1, naive-clicker.js) stays green in the first 90 s. XP-wise a human who skips floor 1 monsters gets less, same as the bot.
- A third pass would target floor 8 / boss for IT; time-boxed to two passes.
