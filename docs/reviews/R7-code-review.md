# R7 code review (reviewer, 2026-10-14)

Scope: AI-R7, STUTTER-R7, quests CORE 0.1-0.4, UI 0.5-0.6, WORLD 0.7. Diff `4a7a4d5` ("R7 started") to HEAD (`0934a57`) for `src/`, `bot/`, `test/`, `e2e/`, `bench/`.
Inputs read: R7-contract, R7-ai, R7-stutter, R7-core-q-notes, ADR-0007 (sections quoted in findings), ADR-0006 amendment as implemented in `src/save/format.js`.
Checks run (read-only): `npm test` = 900 pass, 0 fail (72 s). Scratch scripts in the scratchpad (not in the repo): a cheat/floor-change fuzz (720 states, `schemaProblem` on `toSave`: 0 rejections), `questView` timing, a sq1 soft-lock repro, item-floor distribution over 2000 seeds (3: 990, 4: 1010). Not run: e2e (browser), bench, parity (see progress file).

Verdict: **changes needed** (1 blocking, 6 should, 9 nit).

## Blocking

### CR7-01 sq1 (Intern Overflow) can become impossible to finish in a session
`src/core/systems/world.js:27-29,59-63` (floors keep their killed spawn indexes for the whole session), `src/core/systems/quests.js:36-47` (`reduceSide`: only kills after Accept count), `src/core/config.js:160` (`kill.depths [1, 2]`, count 8).
Repro (run by the reviewer): `newGame(3, {start: "town"})`, enter floors 1 and 2, kill every monster, back to the Lobby, talk to the vendor, `questAccept sq1` (ok), re-enter floors 1 and 2: 0 living zombie interns, `sq1 = {s: "active", p: 0}`. Floors 1-2 hold 16-20 interns (400 seeds), so any player who kills more than about 8-12 of them before accepting, for example someone who explores first and visits the vendor later, has no way to reach 8. There is no abandon and no re-roll; only a reload (the loader resets `killed`) or a new run helps. A deep migrated v3 character is not affected after a reload but is in the same session. ADR-0007 handles the equivalent case for the elite ("never zero while the objective is open"), not for the kill task.
Fix: on `questAccept sq1` (and in `placeQuestObjects`, for the case of a reload mid-quest), make the objective satisfiable: either drop the zombie-intern spawn indexes of floors 1 and 2 from `state.floors[d].killed` (deterministic, no rng, no effect on a run that never accepts), or let `placeQuestObjects` top up quest-tagged interns on floors 1-2 to `count - p`. Add a test: clear floors 1-2, accept, assert `p` can reach 8 by killing what is there.

## Should

### CR7-02 The golden re-pin proof is weaker than the notes say
`test/quests-hash.test.js:12-34`, `docs/reviews/R7-core-q-notes.md` (section 0.1), `src/core/hash.js:21-33`.
Replay of `run-a` ends on depth 1 with `quests.main.m.depth = 0` (I ran it: 890 ticks, 16 events in the log, `m = {memo:false, depth:0, ...}`). `newGame` never emits a `floorEnter` into the quest block, and the run never changes floor, so it never emits a `quest.*` event. The sentence "recorded runs emit no quest.* event" is true only for that reason, and the test's last assertion checks only the final 256-entry window. Consequences:
- The proof covers the tap on `kill`, `takeGround`/`pickups`, `makeMonster` and `hashState` for one single-floor run. It does not cover `enterFloor` with `placeQuestObjects`, stairs, the boss flow, or any run that triggers `quest.step` (every normal run does on its first descent: `floorEnter` depth 1 moves main from step 1 to step 3).
- `hashStateWithout` strips quest events after the 256-entry window was applied, so for such a run the stripped hash can never equal an old hash once the log is full (the notes admit this; it is stated as "not the case here").
- "Gameplay unchanged" is therefore proven for a run that does not use the feature, on one floor. Gameplay with an accepted quest (spawn order and `nextId` shift by the elite, ground entries, pouch) is covered by unit tests only, which is fine, but the notes should say so.
Fix: (a) add a second pre-quest golden that walks stairs and picks up loot, recorded at the commit before `0c2cb57` by the orchestrator (git worktree, the reviewer may not do it), and compare `hashStateWithout` with `eventPrefixes` applied to the **whole** log by running with a log cap raised in the test (`state.eventLog` is only a window); or (b) keep `quest.*` out of `eventLog` (push to `events` only) so the window is identical and the strip needs no prefix rule. (c) Narrow the sentence in R7-core-q-notes.md.

### CR7-03 Retarget/hold rule: tests miss the branches that can regress, and it overrides an explicit click without feedback
`src/core/systems/intent.js:239-250,273-281`, `test/r7-ai.test.js`.
- `holdMaxTicks` (hold dropped at 120) has no test of its own: the staged test always has an adjacent attacker, so the retarget branch fires first at 60. Setting `holdMaxTicks` to 1e9 keeps every test green. A pair of chasers blocked with nothing in reach is the stated reason for the rule.
- After the hold is dropped the hero repaths, takes one step (`p.next` set, `standT` reset to 0), and the hold applies again at the next tick (`at = p.next` within `holdRadius`), so a blocked pair progresses one step per 120 ticks. Probably enough in practice, but nothing asserts that the hero reaches the target.
- The retarget replaces the player's explicit target (a click) after one second of standing, and selects any awake monster in basic reach, not only adjacent attackers (a ranged hero retargets to a monster 6 tiles away). No event, toast or log tells the player. The R7-ai note justifies it as "as a player would"; keep it, but state in the ADR/spec that an explicit click can be replaced.
- Cost: once `standT >= retargetTicks` and no attacker is found, `reachableAttacker` (a `inBasicReach` ray test per monster) runs every tick while the hero stands blocked. Bounded by monsters on screen; cache or run it every 10th tick.
- Test 3 (`worst < 600` idle ticks) has a threshold 10x the retarget time; use about 200.
Fix: add a staged test without an attacker (two blocked monsters, no adjacent one) that expects the hero to move within `holdMaxTicks + repathTicks`; make the third test's bound tight; throttle `reachableAttacker`.

### CR7-04 Quest toast can be replaced within the same tick (AC "at least toastMs")
`src/game.js:64-67`, `src/core/systems/quests.js:71`, `src/core/systems/damage.js:41-43`.
`game.toast` has one slot. A kill that readies sq1 emits `quest.step` inside `emit(kill)`, then `gainXp` emits `levelup` (very likely at those levels), whose toast replaces the quest line immediately. Same for a floor-name toast followed by `quest.step`, in the other order (quest wins there). The contract table says the toast holds the quest line for at least `config.quests.toastMs`. e2e `r7quest.mjs:84` only checks the accept toast.
Fix: in `game.toast`, do not replace a live quest toast with a non-quest one for the remaining `ms` (queue the second line), or drop the levelup toast when a quest toast is showing. Add a unit test on the shell function with two events in one tick.

### CR7-05 Reward preview and payout are computed in two places
`src/ui/journal.js:13-22` and `src/ui/questdialog.js` re-implement `base + perDepth * refDepth`, `minRarity "magic"`, slot kind from `config.quests`; `src/core/systems/quests.js:198-215` (`rewardOf`) is the payout. `test/quests-0-2-rewards.test.js:20-30` repeats the formula a third time, so the test cannot detect drift (it asserts formula = formula).
Fix: export `rewardSummary(id)` from core (gold, xp, gear slots, min rarity, potion count) and use it in `rewardOf` and in the UI; make the test assert against hard numbers from `config.quests` (30+15*2 etc. spelled out once) or against `rewardOf`.

### CR7-06 Gear reward depends on live hero stats, not only on the seed
`src/core/systems/quests.js:198-209`. The "stateless questRng" claim holds for the stream (`hash32(seed, 0x51535400+salt, purpose, depth)`: verified, no shared cursor, no `state.rng` use, no id use in `spawnMonster`), but the 8-try loop calls `checkReqs(state.player, gear)`, so level and attributes at hand-in time select which of the 8 candidate rolls is paid out. A player can respec or level to fish for a different reward (and two hand-ins of the same seed differ between characters). Not an exploit with real value, but "same reward for the same seed" in ADR-0007 section 6 is not true.
Fix: roll the candidate list from the seed, then pick the first that satisfies `checkReqs` at hand-in time (the candidates themselves stay seed-pure), or accept and document.

### CR7-07 Bench cannot fail on the thing STUTTER-R7 fixed
`bench/bench.mjs:141` (`ok = result.fps50 >= FPS_TARGET` only); floor-load numbers are INFO. `bench.mjs:93,122` poll `window.__atlasStats?.warmLeft ?? 0`: if `__atlasStats` is missing the loop exits at once and "ahead" silently measures a cold load. `src/render/world.js:99,120,126` set `warmLeft` only when `__atlasStats` exists and not on the `depth < 1` early return.
Fix: fail the "ahead" case when `__atlasStats` is undefined; add a soft gate (p99 <= 34 ms ahead, lazy draws in window <= 60 on floors 2 and 5) so a regression of `warmAhead` is visible.

## Nit

- CR7-08 `src/core/cheats.js:93-103`: `setQuestStep(id, 2)` on a `completed` quest sets it back to `ready` (`q.s !== "ready"`), so a completed quest can be handed in again for another reward (cheat only, but `completeQuest` is in the hook). Refuse n < current state, like the main quest does.
- CR7-09 `src/core/systems/quests.js:174-182`: if all 12 `spawnMonster` tries fail, sq3 has no elite and cannot be finished. Add the scan fallback `questSpot` already has, or log a `blockedSpawns` entry.
- CR7-10 `src/core/systems/quests.js:159-170`: `used` contains the hero tile and current ground items, so on a later visit or after a reload the item tile can differ from the first visit when a candidate collides (random-try path). Harmless (the tile is never shown), but the ADR wording "same on every visit" is only true for the floor.
- CR7-11 `src/core/config.js:164,171`: `quests.item.pickupRange` and `quests.genBudgetFactor` are read nowhere (`grep`); the pickup uses `config.pickupRange`. Remove or use.
- CR7-12 `src/ui/text.js` keys `mapMarkerStairsDown/Up/Npc/Elevator`, `journalPanel` are unused; map labels come from `content/quests.js` `markerLabels` (English in core), so the contract's "UI text label key" split is not followed. Pick one place.
- CR7-13 `src/ui/panels.js` `syncTracker` calls `questView(c)` (4 `structuredClone`s, about 7 us measured) every frame, and `game.getState` does the same; cache on `c.quests` identity or compute the tracker from `nextStep` only. Not a frame-time problem, but the map marker cache was written to allocate nothing and this one does.
- CR7-14 `src/core/systems/intent.js:59-65,275`: `issueAttack` and the target clear in `killMonster` do not reset `p.standT`, so a stale 59 can make the next target retarget after one tick. Reset it in `issueAttack` and where `p.target = null`.
- CR7-15 Test quality: `test/render-r7q.test.js:35` (`fx.npcMarkers === undefined || Array.isArray`) cannot fail; the "no new atlas keys" test greps source text; `test/r7-ai.test.js` last test asserts `mem.prog === null` after one `decide` rather than that the watchdog stays quiet across a Lobby trip. e2e `r7quest.mjs:111` swallows the elite wait with `.catch(() => {})` (the next check still fails, so no masking, but the cause is lost).
- CR7-16 `src/core/systems/quests.js:63-64` the tap reads `state.monsters.find` on every `kill`; trivial. No finding on re-entrancy: nested `emit` of `quest.*` is ignored by the prefix test, `kill` loop mutates `qs[id]` only, order in the log is outer event first.

## Areas checked without a finding

- **Emit tap** (`events.js`, `quests.js:61-74`): re-entrancy safe (prefix guard; nested emits happen after the outer push); events during loading (`enterFloor` from `loadSave` after `state.quests` is set, depth never above `m.depth` for a legal save, so no event) and during cheats/paused (`teleportFloor` reaches the tap) behave as the ADR says; no tick-scan loss. The events/quests module cycle works in Node and was not flagged by the layering test.
- **Atomic hand-in** (`quests.js:218-243`): the dry run on `structuredClone(state.inventory)` uses the real `autoplace` in the real order (gear, then potions), `mint` only changes the id, the item size is unchanged, so clone and real placement cannot diverge in the current code. `handInRefused` pushes an event (the test strips events for the "byte-identical" claim; the contract wording says "state", fine but note it).
- **Save v4** (`format.js:193-215`, `migrate.js:67-85`, `slots.js`): pouch invariant is enforced both ways (held iff `ready` item quest, id `qi-<quest>`, at most one each); `p`/`s` coupling, pinned not completed, milestones inside the world flags. 720 random cheat/floor-change states saved without a false rejection; forged states the schema cannot see (a `completed` quest never done) are accepted, which is unavoidable in a local single-player save and grants nothing at load. Migration is pure, never throws, and yields a legal block (tests cover five fixtures).
- **Injection**: journal, quest dialog, slot card and tracker escape every dynamic value with `esc()` or use `textContent`; all quest text is core content; the only player-controlled string (character name) is not placed in the quest markup. `data-fk`/`data-pin` ids come from content.
- **Per-frame cost**: `npcMarker` allocates nothing, map marker cache is keyed on depth, pin, state signature and hero tile; `warmAhead` queues about 3k keys once per floor change and draws at 0.7 ms a frame after a 4 s delay; atlas has no eviction, bounded by all monster types.
- **Contract conformance**: state paths, event names and payloads, audio rows (`cues.js` rows equal section 4.3, silent entries documented), hook members and `describe()` list, key table (`KeyJ`), snapshot additions, slot index fields. Deviations noted above (CR7-11, CR7-12) only.
- **Bot changes**: `bot/quests.js` uses only public inputs; the watchdog reset on depth change (`policy.js`) is justified by the trace in R7-ai (false positive after a death and a Lobby trip); it also means a stair ping-pong never trips the watchdog, which is acceptable.
