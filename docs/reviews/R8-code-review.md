# R8 code review (reviewer, 2026-10-15)

Range: `de43278` ("R8 started") to HEAD (`c8d059a`), office-crawler. Scope: CORE-R8-1, gear visuals R8-0.1/0.2, UI R8-0.3.
Read-only checks run: full `npm test` (1225 tests, 1216 pass, 0 fail, 9 todo, 130 s), probes in the scratchpad (old tree via `git archive de43278`, never checked out).
Verdict: **pass with changes** (0 blocking, 7 should (CR8-01..07), 7 nit (CR8-08..14)). Nothing found that loses a reward, corrupts a save or breaks determinism.

## Verified without findings (so the next round need not redo them)
- Owed rewards are atomic: gold, xp, mint, autoplace-or-push, pouch removal and `completed` happen in one synchronous call with no throwing step between them (`quests.js:368-381`). Never lost: survives save/load, death and respawn (test r8-core1 :37), delivered in order.
- Save schema: `owed` is optional, bounded (1..20), requires a completed side quest, rejects `consumable`, duplicate ids and a unique duplicated across bag/stash/equipment/belt/cursor/owed. The added `ids.add(cursorItem.id)` closes a small old gap. Legal saves round-trip (tested).
- `settleOwed` cost: measured 7 us/tick with 2 owed items and 58 us/tick worst case (16 owed, 37-item full bag). Fine.
- Goldens: the new run-a is richer than the old one (1800 ticks, 6 kills vs 2, crit event, all 3 classes; old = 900 ticks, 2/1/1 kills). run-a.legacy.json is byte-identical to the old run-a.json (`cmp`), and the stripped-hash proof against `run-a.pre-quests.hash` still runs and passes under `withLegacyBalance`. Coverage is not lost in a way that matters (see CR8-04 for what is).
- Empty-look proof: the painter-level call-stream (every method call and property set, 528 frames = 3 classes x 5 anims x 8 dirs x frames) equals the recorded pre-R8 stream, with and without a gear argument, and the empty signature never enters the cache (world keeps the atlas keys). Call-stream equality implies pixel equality for a deterministic painter; the 3-decimal rounding in the recorder cannot hide a visible difference. Hoisting the arm/hand maths in `heroes.js` is pure arithmetic.
- Forged `look` in the slot index: never reaches HTML or a path. `cleanLook` (ui/slots.js:37) and `parseSignature` re-validate by regex and by code table; a bad value draws the bare bust. No injection.
- AI re-click: in the staged ring with an attacker adjacent, old tree and new tree give identical timings (contact 157, attacker hit 79/81). Normal play is unaffected (a fresh click on a reachable target resets `standT` via `p.next`, in-reach resets it too).
- Entry grace: damage wakes a graced monster and its pack (`damage.js:53-54`), the Lobby has none, `delete state.entryGrace` on every enterFloor, and the key is in the hash so it is deterministic.
- CR7L-01/02/03/04/05/06 are implemented as described.

## Findings

### CR8-01 [should] A full bag plus a pending owed item steals the cell of an item the hero is holding
`src/core/systems/quests.js:392-401` (settleOwed), called every tick from `src/core/step.js:35`.
Probe (`/tmp/.../cur.mjs`): full 10x4 bag, one owed item; the hero picks up the item at (0,0) to rearrange or sell it; on the next tick `settleOwed` places the owed item into the freed cell. The held item can no longer go back (`returnHeld` -> `canPlace` false -> `releaseCursor` drops it on the floor, or a click swaps it for the owed item). Not a loss, but a full-bag hero is exactly the one who is moving items around.
Fix: `if (state.cursorItem) return;` at the top of `settleOwed` (owed waits until the hand is empty), plus a test: pick up, tick, put back at origin succeeds.

### CR8-02 [should] The 8 R7 tests that R8 turned into `todo` are dead coverage, 3 of them not replaced
`test/adv-r7-quests.test.js:269,308,396,572`, `test/adv-r74-quests.test.js:327,477,557`, plus `[R7-kill]` (todo reason R8-B1). A `todo` test that fails is reported but never fails the suite, and one that starts passing again gives no signal. Replaced by r8-core1: the three bag-full hand-in tests. Not replaced: `[R7-kill]` (sq1 completable on the sparse floor 1; I measured 7 zombie interns on floors 1+2 for some seeds against a count of 8, so the top-up is what makes it work and nothing asserts that now), `[R7-pouch]` (belt index 3 now holds a real potion, the test only needs an empty slot index), `[R74-sq5] reward` (the non-refusal part).
Fix: rewrite those three against the new rules instead of todo-flagging them, delete the replaced ones.

### CR8-03 [should] Gear cache: the 32 MB cap counts only the base canvas, and one table does not fit it at the top scale
`src/render/gearcache.js:42` (`bytesOf`), cap at :12. Atlas scale goes up to 2.5 (`main.js:67`): one sprite is 260x240x4 = 250 KB, the full 176-frame set of one signature 44 MB, idle+walk alone 20 MB. Consequences: (a) hit-flash and outline silhouettes are cached on the entry (`atlas.js:8-31`, `e.sil`) and are not counted, so the real use can approach 2x for frames that were flashed; (b) with a previous table still resident, switching gear at scale 2.5 evicts the stale frames of the current signature, which are then rebuilt on demand (one bake, several ms, in a frame) and never re-warmed (`warmGear` returns true once its queue was walked, :125). The test `render-r8-gear.test.js:258` uses a fake atlas at scale 2, so it cannot see either.
Fix: count `sil` canvases in `bytesOf` (or drop them with the entry and charge a fixed factor), and let `warmGear` re-queue evicted idle/walk frames (clear `st.queue` on eviction of the current table). Also note `WARM_MS = 0.7` is a floor not a ceiling: the loop always bakes at least one frame (:133-136), so a warm call costs one full bake; say so in the header comment or measure it in the bench.

### CR8-04 [should] The legacy proof no longer covers what the comment says, and run-c's R7-3 golden is gone
`test/quests-hash.test.js:14` claims the helper "puts all of it back". `withLegacyBalance` (test/balance-legacy.js) does not neutralise `holdFarTicks` 480->180, the AI1 re-click change, the `retarget` goal guard, `rewardOf` or the vendor belt-first buy. The proof passes only because the recorded runs happen not to exercise them (the old run-a has 19 clicks, so the AI1 path is within reach of it). `run-c.json` was re-recorded (first input differs at index 1, 944 -> 1003 inputs) and no legacy copy was kept, so `quests-fix-r7.test.js:101`'s `notEqual(... legacy)` is now trivially true and the R7-3 run-c golden is unreproducible.
Fix: keep `run-c.legacy.json` and prove it under the helper like run-a, and either add holdFarTicks to the helper's knobs or reword the comment to "the numbers it restores; the AI changes are shown inert by this run".

### CR8-05 [should] Direct toasts in one dispatch replace each other; the cap silently drops quest lines
`src/ui/toastqueue.js:25` and :31. Probe: `begin(); offer("A"); offer("B"); end()` shows A then B in the same tick (A is on screen for zero frames; the burst rule "first line keeps the lane" does not hold because `display()` for B is taken by the `pri === 1 && !tq.quest` shortcut). `while (q.length > cap) pop()` drops the newest lines without a trace: 10 quest lines in one burst show 1 and keep 8, lines 9 and 10 are never written to the live region, which is the only channel for some players. The file header says every line that goes on screen is passed to `show()`, so this is by design, but the header also promises "no loss" for quest lines in the UI progress note.
Fix: in `place`, apply the direct shortcut only when the shown line was not held (`!held()` is already handled above, so test `tq.until === 0 || !tq.hold`), and when the cap is hit, drop the oldest passive line first and only then a quest line; at minimum pass dropped quest lines to a `onDrop` hook that writes the live region.

### CR8-06 [should] `save/slots.js` imports from `render/`, and the exception is not enforced
`src/save/slots.js:14`. The layering test (`test/layering.test.js:31`) forbids only ui/input to render. Nothing stops save/ from importing more of render/, and `gearlooks.js` purity is guarded by a regex scan inside a render test (`render-r8-gear.test.js:428`), not by the layering test. The look regex exists three times (`gearlooks.js:79`, `save/slots.js:57`, `ui/slots.js:35`) plus a fourth string "-|-|-|-|-|-" in `figureHost.js:2` and `ui/slots.js:37`; a change to the signature grammar (a 7th slot) must be made in four places and only one is tested against the others.
Fix: move `gearSignature`, `EMPTY_SIG`, `validLook` into a pure module outside render/ (for example `src/shared/looks.js`, imported by render, save and ui), or at minimum add to layering.test.js: "save/ may import only render/gearlooks.js" and "gearlooks.js has no import and no DOM", and export one `validLook` and use it in all three places.

### CR8-07 [should] Old builds reject a save that holds `owed` as corrupt
`src/save/format.js:200`: the key is added without a schema version bump. A build from before R8 sees an unknown key in `quests` (`hasOnly`) and moves the slot to the bad key. Acceptable if downgrade is unsupported, but ADR-0007's amendment does not say so.
Fix: state "no downgrade" in the ADR, or bump `version` when `owed` is present on write (the loader already migrates upwards).

### CR8-08 [nit] `OWED_MAX` is a fixed 20 regardless of progress
`quests.js:385`. A save with one completed side quest may carry 20 owed items. Bound by `4 * completedSideQuests` in `format.js:282`. Cheap, tightens forgeries.

### CR8-09 [nit] Entry grace is anchored on the arrival tile, not on the hero
`ai.js:62`. A hero who walks 11 tiles in the first 7 s passes packs near the entry unnoticed; a pack-mate outside the radius that does see the hero wakes the graced ones through `wakePack` (`ai.js:46`). Not exploitable beyond a free first strike and a free walk-past on the first 12 tiles; say it in the ADR so the balance owner knows. Re-entering a floor (stairs back and forth, reload) grants a new grace by design.

### CR8-10 [nit] Dead code after the bag-full refusal was removed
`bot/quests.js:3,17,44,68` (bagFull sell/stash rounds), `src/audio/cues.js:160` (`quest.handInRefused`), `src/core/cheats.js:75` comment. The event and the error can no longer occur. Remove or mark; the bot branches are untestable now.

### CR8-11 [nit] A part painter that throws kills its slot for the whole signature, frames already cached keep the part
`gearparts.js` gearHook marks `G.dead[slot]` for the signature. If a painter throws only on, say, the cast pose, the idle frames baked earlier show the part and later frames do not (flicker between poses). Painters are pure and tested, so low risk; to be safe bake the failing signature again without the slot (drop the table) when `fallbacks` increments.

### CR8-12 [nit] Vacuous assertions
`render-r8-gear.test.js:282` `evictions > 0 || peak < GEAR_CAP_BYTES` cannot fail given the previous assert. The `[R8-B1]` 20-seed clicker test has no timing bound for slow runs but runs fast. `quests-hash.test.js` third test asserts `notEqual(stripped, pre)`, true by construction since the numbers differ.

### CR8-13 [nit] `lookField` swallows all errors
`save/slots.js:59` `catch { return {}; }` hides a thrown error in `gearSignature` (it never throws today, it is documented as such). Fine, but a count in `store.lastError` would make a regression visible.

### CR8-14 [nit] `fresh` core detection warms 80 frames unbudgeted on the main thread
`gearcache.js:118` (`warmGear(..., Infinity, true)`). 80 bakes of several ms each is a visible stall if the shell ever replaces `game.core` outside a transition (a respawn path that rebuilds core would). Verify that no in-run path swaps `core`; the e2e render checks do not cover respawn timing.

## Answers to the focus list
- Atomicity / never lost: yes. Schema false rejections: none found; bypass: only the loose bound (CR8-08) and the cursor interplay (CR8-01).
- Per-tick settle cost: negligible (measured).
- Goldens: new run-a has more fights, not fewer; lost inputs are the 17 extra click commands (covered by chase-orbit/intent tests). Legacy proof is meaningful for run-a only (CR8-04).
- entryGrace: not exploitable beyond a free walk-past and first strike (CR8-09); AI and quests unaffected (quest elite/item objects are placed after, grace does not touch them).
- AI re-click: no regression in the probed scenarios; the new `p.goal` guard delays the retarget only when the click is held back before its first plan, bounded by holdMaxTicks/holdFarTicks (180). Not demonstrated to bite, left to the adversarial tester.
- Gear cache: correct LRU and protected set, memory accounting incomplete (CR8-03).
- Empty-look proof: call-stream at painter level, adequate; DOM `figure.js` with `look=null` is covered by a separate byte-for-byte test (:229).
- Layering and forged look: CR8-06, forged look safe.
- Toast queue: CR8-05.
