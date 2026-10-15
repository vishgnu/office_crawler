# R8-T code review (FIX-UI-R8T, FIX-WORLD-R8T, CORE-R8T-1)

Reviewer: `reviewer` agent, 2026-10-15. Scope: the 14-file diff (+323/-64). Read-only: no product edits, no git, no processes left running.
Checks run: `node --test test/ui-r8t.test.js test/render-r8t.test.js test/core-r8t1.test.js` = 17 pass, 0 fail (core-r8t1 alone takes 23 s; 21.9 s is one test). No browser run, so layout findings are from reading CSS/JS and need a screenshot to confirm.

Verdict: changes needed. No blocker. Two majors (XP total unreachable without a mouse; bench wait can exit before the warm-up starts), the rest minor/nit.

## Findings

### F1 major - XP total is now mouse-only in practice (a11y regression from R8-A2)
`src/style.css:56`, `src/ui/panels.js:131,210`.
- The HUD box `.xptip` is `pointer-events:none`, so its hover title is gone. It is a `<div tabindex="-1" aria-label=...>` with no role: not in the Tab order, and `aria-label` on a role-less div is ignored or not announced by common screen readers. The HUD box is therefore effectively dead for assistive tech, although the progress note and the CSS comment say it "keeps title/aria-label for assistive tech".
- The only other place for the total is the Employee File: `.xpl` `title` (mouse hover) and the `.xpb2` `role="img"` `aria-label` (reachable by a screen reader only). The total is not visible text. A sighted keyboard-only or touch user cannot see the total anywhere; a screen-reader user can, but only inside the File.
- Fix: (a) print it as text in the File, e.g. in `renderCharacter` add `<span data-stat="xp-total">${T.xpTotal}: ${num(xpv.total)}</span>` next to the XP label; (b) give the HUD element `role="img"` and drop `tabindex="-1"`, or remove the dead element and add the total to the HUD's existing polite status text; (c) update `ui-r8t.test.js:21` to assert the visible text. `e2e/ui.mjs:434` still reads `title` of `hud-xp`; keep or adjust it together with (b).

### F2 major - bench wait can leave before the warm queue has started, and the cost it hides is no longer measured
`bench/bench.mjs:67`, `src/render/gearcache.js:126,131,150`.
- The loop exits on the first sample where `gearCache.builds` equals the previous one (600 ms apart). But `warmGear` returns without building while `st.pause > 0`, and `gearTick` sets `pause = 240` frames on every depth change (`newGame` is a depth change). The bench only waits 1.5 s plus at least 400 ms for the atlas loop. At 60 fps the pause is 4 s and at lower fps longer. During it `builds` is flat (only the handful of on-demand frames), so the loop can break after two samples and the 150-frame window then still contains the 80 warm bakes (about 4 ms each). That is exactly the overlap the change was meant to remove. Flat is also true while a bake debt is repaid (`credit <= 0`), so a slow machine can exit early too.
- Separately, what the wait hides is a cost a player does see: after every equip change or floor change the 80 idle/walk bakes run for several seconds at 4 ms each (budgeted at 0.7 ms average, so roughly one bake per 6 frames), and a hero that walks or turns to a not-yet-warmed frame pays an on-demand bake in that frame (`maxBuildsPerFrame`). The steady-state fps50Geared number no longer shows either.
- Fix: expose "warm done" in `gearPerf` (`warmLeft: (st.queue ? st.queue.length - st.warmI : -1) / 3`, plus `pause`) and wait for `pause === 0 && warmLeft === 0` with a hard cap that fails the scene (or prints WARN) when reached, instead of silently continuing. Add a second small window, "just equipped" (first about 5 s after `wearAll`), that records dt p95/max and `gearCache.maxBuildsPerFrame`/`warmMs` as INFO, so the warm-up cost stays visible.

### F3 minor - sticky footer: possible 10 px clip and focus obscured
`src/style.css:140`.
- `position:sticky;bottom:-10px` makes the stuck footer's bottom edge sit 10 px below the scrollport of `.pb`, i.e. the lower 10 px (padding plus the bottom of the 30 px buttons) are clipped by `overflow:auto` unless `.pb` has bottom padding. `.pb` has none (`style.css:99`). The progress note verified `elementFromPoint`, which would not catch a visual clip. Please confirm with a 1280x720 screenshot; if clipped use `bottom:0` and put the 10 px as `padding-bottom` of the footer, or keep -10 and give `.pb` `padding-bottom:10px`.
- A sticky footer over a scroller also hides the focused cell when tabbing down the grid (focus obscured, WCAG 2.4.11). Fix: `#pright .pb{scroll-padding-bottom:64px}`.

### F4 minor - testhook unique contract: loud failure still leaves the item, and the partial-taken case is not predicted
`src/testhook/index.js:392-407`.
- `rollItem` does `rng.pick(pool)` over all matching uniques and falls back to a rare when the picked one is taken. The guard only refuses when every unique in the pool is taken, so with two uniques on a base and one taken, half of the rolls fall back. The after-the-fact check then returns `{ok:false, fellback:true, id}` but the rare already exists (in the bag for `giveItem`, on the floor for `spawnItem`). A test that retries on `ok:false` accumulates junk and burns bag cells; one that only checks `ok` misses the item. This path is untested (the rig stub always pushes to `uniquesFound`).
- The guard also duplicates the pool filter of `rollItem` in the adapter (ADR-0003: "no game logic here"); a change to `rollItem` will silently desynchronise it.
- Fix: add to core `rollItem` an option `strictUnique` (pick only among untaken matches, return `null` when none) and have `spawnItem` return `{ok:false,error}` for it; the hook passes it and drops the local pool logic and the after-the-fact check. If that is out of scope for CORE-R8T-1, at least document `fellback:true` as "an item was created" in the hook header and add a test for the partial-taken case (two uniques on one base, one pre-taken, loop the seed until it falls back).

### F5 minor - redundant 22 s test, and the old todo is still there
`test/core-r8t1.test.js:96-113`, `test/adv-r74-quests.test.js:453`.
- The new ADV-R7-10 test generates 1400 floors (21.9 s of a 23 s file, about 8 % of the whole suite's former runtime) and re-proves what `test/quests-sq45.test.js:128-160` already proves on 1000 seeds with the real `topUpKills`. The progress note says the full run twice hit the timeout under load.
- The `todo` test `adv-r74-quests.test.js:453` that the plan calls "the unit-test todo" is still marked todo (and states the generator "still spawns fewer than 6"), so the todo is not retired.
- Fix: cut the new test to the 15 known short seeds (102, 105, ...; compute once and pin them) with the top-up assertion, or delete it; turn the old `todo` into a normal test (or delete it as a duplicate of `quests-sq45`).

### F6 minor - quest elite at 1.14: icon and ground shadow are not scaled
`src/render/world.js:303-305,491-496,733`.
- `drawStatus` receives `it.head * it.k`, but `drawIcon` (alert "!", muted, flee, stagger sparks) still uses `it.head`, so on the 14 % taller sprite the alert sits about 7 px inside the head. The contact shadow `k = dm.shadowR*2.25/62` is not scaled while the champion ring is, so the shadow looks smaller than the ring.
- Fix: in `drawIcon` use `(it.head * it.k + 2)`; scale the shadow by `a.quest && champ ? QUEST_ELITE_K : 1` (compute the factor once as `kq` in `addActor` and reuse it for `champRing`, shadow and `it.k`).
- Perf and caching: no concern. `zk` is one compare per actor, no new atlas keys (outline/tint/shade cache by sprite entry; scale is applied at blit), the pool item is reset in `grab`. Non-integer 1.14 scaling goes through the same `Math.round` blit as other zoom levels; at z=1 it will resample slightly softer than other sprites (nit, accepted for a single unit).

### F7 minor - several new tests assert source text, not behaviour
- `test/render-r8t.test.js:84-89`: G-3 matches the literal coordinates `[[-4.6, -3], [-2, -3]` in the source, N17 matches `QUEST_ELITE_K = 1.1\d?` and `it.k = champ && a.quest` in `world.js`. They pass for any broken use of the value and fail on a harmless refactor. The G-2 test (counts rim strokes with a recording context) and G-1 (records strokeStyle) are real behaviour tests and good. Fix for G-3: draw `PART_PAINTERS.brace` into the recording proxy and assert the painted polygon's extent (track `lineTo`/`moveTo`) is at most about 8x4 px; for N17 export a pure `actorScale(a)` from `world.js` (or put the constant in `keys.js`) and assert `actorScale({tier:"champion",quest:"sq3"}) > 1` and `=== 1` for a plain champion.
- `test/ui-r8t.test.js`: every test but the last reads CSS/JS source. The U-5 assertion `.map-open ... {display:flex}` (line 21) matches a rule that existed before this diff (`style.css:79`) and so proves nothing about the Map button's return; the A2 test proves a declaration, not that a click reaches the canvas. The stated reliance on screenshots is fine for pixels, but click-through and "button exists on the phone dock" are cheap to assert: add an e2e (TE owns `e2e/**`) with `elementFromPoint` on the old XP box and a 390 px check that `[data-open=map]` is visible. For U-5 assert the dock markup instead (does `hudHtml` render the Map button when `D.phone`?).
- `e2e/ui.mjs` is reported at 174/175 with a stale phone-Map assertion; it must be updated by TE before the fix round or the next full e2e is red for a known reason.

### F8 minor - tooltip/toast: stale `dup` class and one-way re-placement
`src/ui/panels.js:367,380-383,300`.
- `tipBottom` skips the toast when it has class `dup`, but `syncToastDup()` runs after `syncToast()` (line 300), so when the re-placement runs inside `syncToast` the class still belongs to the previous toast: a new real toast can be ignored (tip stays under it) or a new duplicate one honoured (tip is shrunk for nothing). Fix: call `syncToastDup()` before the re-placement in `syncToast` (it only reads the text and tracker).
- The tip is re-placed when a toast appears, not when it disappears (3.2 s later); it stays lowered until the next hover. Harmless; mention only.
- If the toast is tall or sits high (narrow window), `bottom` can drop below `top+80`; `placeTip` clamps `maxH` to 80 and the tip gets a content-clipped box while `maxHeight` in `showTip` is still `hudTop-16`. Cap the effect: `Math.max(b, D.hudTop - 8 - 120)`-style lower bound, or accept the overlap when the band is below about 120 px.

### F9 nit - cap back-view art code
`src/render/gearparts-armour.js:51`: `1.6 * (k < 0 ? 1 : 1)` is a dead conditional (both seams share the same radius); simplify to `+ 1.6`, and hoist the `for` loop's identical `ellipse` radii. The dark arc (line 52) runs 2-3 px below the dome bottom and can read as a hair line; fine visually if the art sheet was checked. Bake cost is not an issue (baked once per frame into the gear cache; LRU keys are signature-based and do not change with painter art).

### F10 nit - magic trim on small parts and a lineCap leak
`src/render/gearkit.js:19-22`, `gearparts-armour.js:75,80`.
- The tier-1 trim is now three strokes (3, 1.7 and 0.8 px) on every part, including gloves/brace bands that are 6 px wide: the white 0.8 core plus the dark flank will fill those bands. Looks like noise at 60 px; check on the brace/boots in the art sheet. Bake cost: about 3x the stroke calls of a magic part, a few percent of a 4 ms bake, not in the per-frame path.
- `bodyUnder`/`bodyOver` set `g.lineCap = "round"` and never restore it. Painters are called inside the baker's `save/restore` (gearcache/gearparts lines 45-51), so no leak in production, but the new test's context shows it is state kept on `g`. No change needed; keep the baker's save/restore as the contract.

## Checked, no finding
- Layout of the other R8-T UI changes by reading: `.photo` 60x72 / canvas 120x144 and `paintBust` crop (`sw = 280*cw/ch` = 233, x range 123..357 inside the 480 px sheet, same call for the 1:1 badge canvases); chain-tree CSS (ID selector beats the inline `--col` rule, both columns spanned, `.lk::before` stem kept, `.lk.l/.r::after` hidden, phone unaffected); phone map button rule `padding/min-width` (44 px target kept); `T.mapTitle` read by `render/map.js`.
- `messageFor` respawn: `game.js:69` passes the core, `core.belt` exists; the hint appears only when all belt slots are empty. Behaviour test is real.
- Render hot path: the new per-actor `zk` and `it.k`/`o.big` fields are pooled and reset in `grab`/`slot`; no allocation added. `labels.js` `a.big` is always defined on monster and NPC slots.
- CORE-R8T-1 added no `src/core` change: R8-A4 and R8-M1 are tests that pass on the current core (the A4 test is deterministic, 9 classes x 2 target patterns, real asserts on first swing and swing count).
- Scope: no file outside the three owners' lists was touched except the bench (FIX-WORLD owns it).

processes: none
