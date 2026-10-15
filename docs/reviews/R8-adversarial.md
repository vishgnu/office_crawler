# R8 adversarial pass (test-engineer, adversarial mode, 2026-10-15)

Scope: round 8 so far: CORE-R8-1 (owed reward items instead of the bag-full refusal, sparse floor 1, entry grace, potions to the belt, the re-click AI fix, map pins for item and elite, hold 180, reward by reference hero), the gear visuals (ADR-0008, R8-0.1 and R8-0.2), the UI part R8-0.3 (geared busts, owed UI, toast queue). A balance pass for floor 2 comes after this pass and may change numbers.
Method: each hypothesis was probed in Node first (scratch scripts), then in Chromium (Playwright 1.56.1, https origin `https://oc.test`, never `file://`), then frozen as a test. Legal fixtures come from the game's own core (real inputs, the real step loop) and its own save writer; hostile ones name the rule they violate. I did not read the implementers' tests (`test/r8-core1.test.js`, `r8gear.mjs`). No git, no source edits.

## Updated stale checks (intended new behaviour, nothing weakened)

| check | before | now |
|---|---|---|
| `e2e/adv-r7.mjs` `[R7-handin]` full bag | refused with a visible `role=alert`, nothing granted | hand-in completes, gold and xp paid at once, items owed (no alert, `role=status` owed line, dock count), 80 further attempts pay nothing more, dropping items delivers the owed items by themselves with none lost or doubled, the dock count follows |
| `e2e/adv-r7.mjs` `[R7-nocheat]` | fixture needed sq1..sq3 ready in one Lobby visit | the bot visits the Lobby earlier and hands quests in as they become ready; the fixture is the first visit with at least two of them ready; the claim "all quests complete at the end" is unchanged (and ADV-R7-10 now passes, so it is a plain check) |
| `e2e/adv-r7.mjs` `[R7-handin]` section | sq1 / sq2 / sq3 and a sq5 window | every expectation is derived from the fixture's own state (`ready3`), the full-bag quest is the first ready one, the vendor-only assumptions are gone; the drop input makes room (any giver's window is open) |
| `e2e/adv-r7.mjs` `[R7-toast]` eighth kill | 15 + 8 zombie kills on floor 1 | floor 1 is sparse: kills are tuned by xp measured from real kills (floors 2, 3, 4, 1) so that the eighth counted kill on floor 2 crosses the level threshold: the ADV-R7-02 scenario (level-up and quest line in one tick) is kept |
| `[R7-toast]` / `[R74-toast]` live region | read the last text of the single live region | a MutationObserver logs every write; the check is "the quest line was announced once" (later lines such as the floor name overwrite the text, which is correct) |
| `[R7-slots]` | slot 1 fixture must have sq1..sq3 ready and one pouch entry | compares to the fixture's own state |
| XPASS | ADV-R7-07 (pin of `constructor`, `toString`, `__proto__`) and ADV-R7-10 (consultants on floors 5 and 6) were XFAIL | both fixed: now plain checks. The unit todo for ADV-R7-10 (`test/adv-r74-quests.test.js`, 12 of 700 seeds spawn fewer than 6) stays: the fix is the top-up on accept, not the generator |
| `test/adv-r7-quests.test.js` `[R7-kill]` | 8 zombies on floor 1 | the count is met over floors 1 and 2; the scenario picks the floor that holds two live zombies |
| `[R7-pouch]` | `useBelt` index 3 | the last belt slot is emptied first (the start potions fill the belt), the index is the empty one |
| `[R7-handin]` x2, `[R74-sq4]`, `[R74-sq5]` reward, `[R74-giver]` | "one cell short is refused, state untouched" | one cell short completes, pays gold and xp, owes what did not fit, delivers when a cell is free; the exact fit owes nothing; the same gear as an immediate hand-in; two hand-ins into one bag: both complete, the second reward is owed |
| `[R7-golden]` | replayed `run-a.json` under the legacy balance | replays `run-a.legacy.json` (the pre-quest recording) under the legacy balance; the new `run-a.json` is checked to carry no quest event |

Result: `e2e/adv-r7.mjs` 257/257, 0 XFAIL, 0 XPASS; `test/adv-r7-quests.test.js` and `test/adv-r74-quests.test.js` have no R8 todo left (one ADV-R7-10 todo remains).

## Summary of findings

| id | severity | title |
|---|---|---|
| ADV-R8-01 | minor (forged saves only, existing gap) | The save validator checks item ids for uniqueness but not against `nextItemId`: a forged item (bag, belt, stash or owed) with a future id collides with the item minted later |
| ADV-R8-02 | minor (comfort) | An owed item takes the cell the hero has just freed by lifting an item onto the cursor |
| ADV-R8-03 | minor | A click on every tick or every second tick on a target behind a crowd keeps a melee hero standing while an attacker hits it (the R8-AI1 fix works from every third tick up) |

Counts: blocker 0, major 0, minor 3. Everything else I attacked held (see the attack list). Three hypotheses turned out not to be defects and are listed as observations.

## Findings

### ADV-R8-01 (minor, forged saves only) item ids are not bounded by nextItemId

- Repro (node, `test/adv-r8-owed.test.js`, todo): serialize a hero who owes items, set one owed item's id to `"i" + (nextItemId + 5)`, re-seal, `deserialize` -> accepted; the same forged id in `inventory.items[0]` is accepted as well. Mint items until the counter reaches that id: a second item with the same id exists.
- Expected: ids of stored items are below `nextItemId` (the counter is the only minting source), else a later mint collides.
- Actual: `src/save/format.js` `gridOk` / `itemOk` / the belt, equipment and owed loops only keep a set of seen ids. Two items with one id break `findById` (the first wins), the owed delivery (`splice` by index is fine) and any UI keyed by id.
- Impact: a hand-edited save with a checksum anyone can recompute; no state reachable by play. It is not specific to R8 (owed inherits it). Suggested: one check, `ids all matching /^i(\d+)$/ => n < nextItemId` (the fixtures `fill*`, `t1` style ids are test-only).

### ADV-R8-02 (minor) owed items snatch the cell the hero is rearranging

- Repro (node, `test/adv-r8-owed.test.js`, todo): a full bag with items owed; `invClick` on the first item (it goes onto the cursor); `step`: the owed potion is placed into the freed cell at once. The lifted item can then not go back to its cell and may have no cell at all (the cursor holds it).
- Expected: while `state.cursorItem` is set, no owed item is delivered (or the freed cell is kept free), so a player who rearranges a full bag is not outrun by the owed pouch.
- Actual: `settleOwed` runs every tick and uses `autoplace` on any free spot.
- Impact: annoying when the bag is crowded and rearranging is how the hero makes room for a big piece of gear. The hero can drop or put the item elsewhere, nothing is lost.

### ADV-R8-03 (minor) a click on every tick defeats the retarget

- Repro (node, `test/adv-r8-ai.test.js`, todo; scratch script gave the numbers): corridor `#@.....>......#`, three awake zombie interns in a row at x=3..5, the hero (Facilities Manager) clicks `attack` on the last one every `n` ticks for 600 ticks. n = 1 or 2: the adjacent attacker is never hit, 26 of 68 hp lost; n = 3..30 and a single click: first hit at tick 79 to 89 (one seed: 156 at n = 30). The ranged classes answer at tick 10 for any n.
- Expected: R8-AI1 ("re-clicking an unreachable monster must not keep it from answering an attacker").
- Actual: `issueAttack` sets `p.goal = null` at every click and the retarget in `playerIntent` requires `p.goal`, so at 30 to 60 clicks a second the condition never holds at the tick it is checked.
- Impact: needs an auto-clicker or a very fast touch repeat; human click rates work. Suggested: keep `p.goal` when the new target equals the old one (a re-click of the same monster is not a new order).

## Observations that are not defects

- The validator treats item names and `x`/`y` on unplaced items as free data (`itemOk(..., {placed: false})` allows both keys). A forged owed name `<img src=x onerror=...>` loads, is shown as text in the owed tooltip, the toast and the live region (e2e `[R8-xss]`: nothing executes, no element appears). Positions are overwritten on delivery (`test/adv-r8-owed.test.js`).
- The entry grace shields the 419 ticks before the one that deletes it (the 420th `ai` call removes it and also un-shields), harmless. After a load the hero stands on the floor's entry stairs and a new grace of an arrival applies there (load = arrival), never in the middle of a floor. On floor 1 the grace changes nothing in 200 seeds: with the sparse tutorial rules nobody within 12 tiles of the stairs can see the hero (legacy and grace runs wake the same monsters).
- Two quest lines 300 ms apart: the second replaces the first on screen at once (CR7L-02 burst rule, documented in `toastqueue.js`); both reach the live region once.

## What held (attack list)

Owed items (`test/adv-r8-owed.test.js` 30 pass + 2 todo; `e2e/adv-r8.mjs` section `owed`):
- Forged saves rejected with the rule named: owed without a completed side quest, empty list, null / object / string, longer than `OWED_MAX`, id equal to a bag or belt id, two with one id, consumable kind, null / number entries, negative value, unknown rarity, unknown affix, ilvl 99999, affix value out of range. The entry grace key is rejected at the top level and in `player`, and never appears in a written save.
- 50 save/load cycles with items owed change nothing; death on floor 2 with items owed, respawn, restart (new run clears the list), stairs, the elevator and pause (nothing is delivered while paused); a second character never sees the first one's list (also in the browser: slot 2 created, 300 ticks played, slot 1 byte-identical, switching back restores the same ids).
- Freeing by sell, drop, stash and drinking a potion: exactly one cell, exactly one potion arrives, ids stay unique, the state stays a legal save. A tall piece of gear waits while scattered cells free up, potions go ahead, the piece arrives when a block is free (a dropped row of five is not enough for a 1x3 staff: the e2e needs three rows).
- Owed items are not in any container: sell, drop, equip, stash, toBelt, useItem and pickup by an owed id fail and change nothing. Owed plus pouch: handing in sq2 into a full bag removes the badge from the pouch, owes the reward only, no second badge on the floor, a second hand-in is refused and owes nothing more; pouch and owed coexist through a save.
- All five side quests handed in against a full bag, three classes: the list stays within `OWED_MAX`, is a legal save, delivers every reward item exactly once. 300 random hand-ins / fills / frees / saves / deaths x 6 seeds: no duplicate id, no loss, every state a legal save.
- Two tabs on one storage: the second tab is refused (`another-tab`), the stored slot keeps unique ids and at most the paid reward items.

Entry grace (`test/adv-r8-core.test.js`): 1000 seeds x floors 1 and 3, 30 ticks each (60 000 floor-ticks): 0 sleepers inside the radius woke by sight or by a pack mate; 60 seeds on floor 2: nobody wakes before the end, the key is gone after `entryGrace.ticks`, and sleepers in sight notice a standing hero afterwards (no permanent shelter); lift loops (40 stairs round trips) never accumulate more than one grace, the Lobby holds no grace key; a hit graced monster wakes at once; awake chasers are not shielded; deterministic; `entryGrace: null` leaves no key.

Potion belt: buying fills the first free belt slot in order, then the bag; holes in the middle are filled first; hp and mp keep their kind; a consumable goes to the bag; belt full and bag full fails whole (gold, stock, containers byte-identical) while a freed belt slot lets the purchase through with a full bag; 200 random buys, sells and drinks conserve potions and keep gold non-negative; belt items carry no position; every state is a legal save.

Map pins: item marker only on the item's floor, only after the tile is explored, at the ground item's tile, gone after pick-up, hidden by another pin; elite marker follows the living elite and vanishes when it dies or on other floors; hostile pin ids (`__proto__`, `constructor`, arrays, numbers) never throw and markers stay inside the floor (25 seeds each).

Gear looks: 20 000 random equipments (garbage items, prototype names, unknown bases, wrong slots, non-boolean `twoHanded`) always give a parseable signature; two-handed weapons hide the off-hand in the signature even in a malformed state; unknown bases fall back to the slot default; real inputs: a two-hander over a shield sends the shield to the bag and blocks the off-hand, 100 equip / unequip swaps stay legal. In the browser (`e2e/adv-r8.mjs` section `gear`): 309 accepted equips and unequips (209 refused by the rules) in a storm of 600 operations, with a floor change, a death and a respawn in the middle: `perf().gearCache.bytes` peaked at 4.9 MB (cap 32 MB, 0 evictions: only the current and the previous signature stay resident), `maxBuildsPerFrame` 1, no fallback, no page error. The 32 MB cap itself is not reachable with two resident signatures; its unit test is the implementers'.

Slot index: hostile `look` values (markup, unknown codes `zz9|...`, partly valid, too long, number, null, object, array, trailing newline) plus hostile `name` and `class` strings (`<img onerror>`, `<script>`, `__proto__`) in the stored index: the Load dialog renders all cards, nothing executes, every canvas `data-look` is empty or well-formed, and an unknown or partly valid look draws exactly the bare bust (compared by pixels).

Toasts: three quests completed in one burst plus a level-up: each title reaches the live region at least once and no text twice, one toast element at any time, 60 further hand-in attempts add at most three live-region writes. Unit lane with a fake clock: all lines of a mixed dispatch are shown once, in quest-direct-passive order; a busy minute (30 dispatches of 1 to 2 lines) loses nothing; an overload of 60 lines in a second keeps at most 8 waiting and drains.

## Seeds and counts

Sweeps: entry grace 1000 seeds x 2 floors (stepped); 60 + 200 seeds for the grace-end and the legacy comparison; 25 seeds each for map pins; 6 fuzz seeds x 300 operations for owed; 20 000 random equipments for looks. No "always" claim here is a generator claim, so the 1000-seed static sweep of L-046 applies to the grace claim only (done).
