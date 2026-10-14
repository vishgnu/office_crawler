# R7 CORE-R7Q notes

## R7-0.1 golden re-pin (2026-10-14), done once

Reason: `newGame` now builds `state.quests` (main quest milestones, three side quests, pinned) and `player.pouch = []`, and both are hashed
(ADR-0007 section 11, AC-R-256-3). Nothing else changed for a run that never talks to a giver.

| File | Old (post-AI-R7, kept as `*.pre-quests.*`) | New |
|---|---|---|
| `test/fixtures/run-a.hash` (facilities-manager) | 4a96887c22fea751 | 60a33ace8c544a3c |
| `run-class.json` sales-rep | f8676f7f5ab6bb2b | f498c8fb2837087c |
| `run-class.json` it-wizard | 602769930849f1d4 | 934fb325dd581dd7 |

Proof (`test/quests-hash.test.js`): `hashStateWithout(state, {paths: ["quests", "player.pouch"], eventPrefixes: ["quest."]})` of the replayed
run-a (and of the per-class runs) equals the old value for all three classes.

What this proves, exactly (narrowed after code review R7, CR7-02): run-a never leaves floor 1, so it covers the `kill` tap, `takeGround`, `makeMonster`
and `hashState` for one single-floor run, not `enterFloor` with `placeQuestObjects`, stairs or the boss flow. That gap is closed in the fix round
(next section).

## Fix round (FIX-R7-CORE, 2026-10-14): the golden proof for runs with stairs and loot

- `src/core/events.js`: `quest.*` entries no longer count towards the 256-entry `eventLog` window (the other events keep exactly the window a build without
  quests keeps; quest entries older than the oldest kept other event are dropped, at most 64 are kept). Stripping `quest.*` from `eventLog` therefore
  gives the pre-quest log for a run of any length, also with a full log and also for runs that emit quest events (`test/quests-fix-r7.test.js`, window test).
  Consumers that read quest events from `eventLog` still find them (recent ones).
- New recorded run `test/fixtures/run-b.json` (seed 3, Lobby start, the bot with quests off: stairs Lobby to floor 3, loot pickups, 95 kills, no quest accepted;
  16000 ticks) with its golden `run-b.hash` (96042aff73a81d46, the current build).
- Proof for run-b, three parts, all in `test/quests-fix-r7.test.js`:
  1. the stripped hash equals the hash of the same run with `state.quests` removed before the first tick (no quest tap, no quest hook): gameplay with
     and without the quest system is identical for a run with stairs and loot (spawn order, ids, loot, rng, log);
  2. the run plays identically with the R7 retarget/hold rules switched off, so the AI changes of this round do not touch it;
  3. the stripped hash equals `run-b.pre-quests.hash`, the value of the commit before the quests: **not recorded**, no git here. The test is `todo` until the
     orchestrator records it (the command is in the test file: in a worktree of the commit before `0c2cb57`, copy `run-b.json`, replay it with
     `{ start: "town" }`, print `hashState`). Parts 1 and 2 are the proof within the current tree; part 3 would tie it to the old code.
- No golden changed in this fix round: run-a and the class goldens are unchanged (the full suite is green with the old values).
- What is still not covered by a golden: a run that accepts a quest (spawn order and `nextId` shift by the elite, ground entry, pouch). That is covered by the
  unit tests in `quests-0-2-gen.test.js` and `quests-0-2-rewards.test.js`.

## Fix round: other changes (code review R7, ADV-R7)

- CR7-01: `reviveInterns` (systems/quests.js), called by `questAccept` and the `setQuestStep(.., 1)` cheat: if fewer living zombie interns exist on floors 1 and 2
  than the quest still needs, the killed intern spawn indexes of those floors come back (floor by floor, spawn order; no rng, nothing is spawned that the
  floor did not have; nothing happens for a quest that is not accepted).
- CR7-05: `rewardSummary(questId)` is the one source of gold, xp, potion count and gear slots/minimum rarity; `rewardOf` pays from it.
- CR7-06: the gear reward is a function of the seed and the class (affix tag) only: `rewardRerolls` candidates are rolled from the seed stream at the quest's fixed
  item level and the one that asks least of its wearer is paid (level first, then attribute points; the first of equals). Level, attributes and bag no longer matter.
  Wearability is no longer guaranteed for every hero, it is likely for a level 1 hero (test: at least 90 % over 60 seeds x 3 classes x 2 quests).
- ADV-R7-01: save schema: `ready`/`completed` side quests need their play: sq1 `stats.kills >= count`, sq2 `deepestDepth >= itemFloorOf(seed)`, sq3
  `deepestDepth >= elite.depth`. The quest cheats keep the state legal (kills and deepest depth are raised to match; a completed quest is not made ready again, CR7-08).
- CR7-03 / CR7-14: `playerIntent` keeps the stand count after the hold has run out (the hold does not return after one step), a new order resets it, a held mouse button
  is never replaced, and the attacker search runs every `config.retargetEvery` (10) ticks, not every tick. An explicit click is still answered after `retargetTicks`
  when the target cannot be reached and an attacker is in reach (deliberate: this is the stall fix); to be stated in the ADR/spec by ARCH.
- ADV-R7-03: bot: a pickup of the quest item is not given up after 3 pre-empted orders (limit 40), and `maxTrips` is 2.

If AI-R7 re-records again, redo the two `*.pre-quests.*` copies and the one re-pin (contract risk 1).

## Deviations from the contract (R7-0.1)

- `questHandIn` is not stubbed: the input stays "unknown input" until R7-0.2 (the hook in `itemCommand` has `questAccept` and `questPin` only).
- `config.saveVersion` stays 3 until R7-0.3 (the save schema, migration and version-relative tests move together there).
- `snapshot.quests` exists for states that have quests; states built without `state.quests` still snapshot (no `quests` view, `npcs` and `map.markers` empty).
- `content.quests` also exports `markerLabels` through `content/quests.js` (English labels for map markers) and `newQuestState()`; `content.questIds` and `content.sideIds` are on `content`.
- `mapMarkers` in 0.1 covers the main quest (elevator in the Lobby, stairs down on a floor, only when explored) and the giver NPC of an `available` or `ready` side quest. Item and elite are never listed.
