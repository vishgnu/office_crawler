# R11-1 delta code review (after the R8-T code review)

Reviewer: `reviewer` agent (harness 0.5.1, including the rule on source-text-only tests, L-056). Date: 2026-10-15.
Scope: `r11-delta.patch` (23 files, +497/-96; src, test, bench), read against the current files. Previous findings: `R8T-code-review.md`.
Checks run: the whole unit suite (`node --test`): 1339 tests, 1339 pass, 0 fail, 0 todo. No bench, no e2e, no git. A probe script (scratchpad) reproduced finding 2 on the real `toastqueue.js`.

Verdict: **changes needed**. No blocker. One major (short-landscape skill tree), the rest minor or nit.

## Findings

| id | severity | where | summary |
|---|---|---|---|
| R11-01 | major | `src/style.css:814` (with 654-656) | On a short landscape phone the skill tree is laid out in 3 columns, but every card and tier label is pinned to column 1 |
| R11-02 | minor | `src/ui/toastqueue.js:30` | An urgent line drops every waiting passive line, including level-up and skill-learned lines |
| R11-03 | minor | `src/ui/toastqueue.js:31` | An urgent line replaces the quest line that is on screen; it is not put back in the queue |
| R11-04 | minor | `src/game.js:56` (+ `test/ui-r8t2.test.js`) | `closeDialog` through `game.input` is refused on the dead scene, so that half of the N2 fix does nothing; the test cannot see it |
| R11-05 | minor | `src/game.js:84` | Points nudge: fires on every floor 2 arrival, ignores `storyOn`, skipped after an Emergency Exit, same text as the level-up hint |
| R11-06 | minor | tests (list below) | Source-text-only tests (L-056) stand in for behaviour; N2 has no behavioural test at all |
| R11-07 | minor | `src/ui/panels.js:370`, `src/style.css:800` | Short phone toast strip: one-line clamp, fixed 36 px strip, ignores the text-size option |
| R11-08 | nit | `src/testhook/index.js:423` | "no stray rare" is only true while every base has one unique |
| R11-09 | nit | `src/style.css:345-347`, `:808`, `:831` | Header ellipsis with no title; drag hint dropped on small phones |
| R11-10 | nit | various | Stale comment on depthMult; unused `at` parameter; `lane` only on the short layout; run-c claim "no death" is not asserted |

### R11-01 major: short-landscape skill tree uses one third of the width
`style.css:814` `#ui.short .tree .tnodes { grid-template-columns: repeat(3, minmax(0, 1fr)); }` overrides the phone's single column (654, same specificity, later wins). The cards and tier labels are still `#ui.phone .tree .tnode { grid-column: 1; grid-row: auto }` and `#ui.phone .tree .tl { grid-column: 1 }` (655-656, specificity 1,3,0; nothing under `#ui.short` changes them). Result at 667x375, 740x360, 844x390: all cards stacked in the first of three equal columns, two thirds of the panel empty, each card about a third of the width, and a longer scroll. `ctr2`/`ctr-a*` are `:not(.phone)` so they do not help. The tests only assert that the rule text exists (`ui-r8t3` L-1 contracts), and `e2e/r8t3-fix.mjs` has no check of the tree on a short phone (grep for tree/tnode/skill in its short section: none).
Fix: either delete line 814 (single column, as on the portrait phone), or make the 3-column flow real: `#ui.short .tree .tnode { grid-column: calc(var(--col) + 1); }` and `#ui.short .tree .tl { grid-column: 1 / -1; }` (and keep the connector rules `display:none`). Then add a screenshot or a computed-style check (`getComputedStyle(node).gridColumnStart`) at 667x375 on a branching tree.

### R11-02 minor: urgent line loses waiting level-up and skill-learned lines
`toastqueue.js:30` `tq.q = tq.q.filter((w) => w.pri !== 2 && ...)` removes every passive line. `PASSIVE_LINES` is levelup, floorEnter, potion, healed, skillLearned. Probe: quest line on screen, "Level 3!" and "Learned skill" waiting, then a respawn line: shown = [Quest A, Back in the Lobby.], waiting = []. Both are gone, and neither reaches the live region (show() is the only writer). A level-up is the prompt to spend points; a death or Emergency Exit right after a kill is a normal sequence. Only potion/floorEnter/healed are really stale after a respawn or a portal.
Fix: drop only `kind` in `{floorEnter, potion, healed}` (a small `STALE_KINDS` set next to `URGENT_LINES`, passed through `kind`), keep levelup and skillLearned in order behind the urgent line. Add a test: quest on screen + levelup waiting + urgent: the level-up is still in `waiting()`.

### R11-03 minor: the quest line on screen is replaced and forgotten
`toastqueue.js:31`: `display({ ...n, hold: true })` while a held quest line is on screen swaps it out; the replaced line is not queued (same probe: "Quest A" is neither waiting nor shown again). The header says "waiting quest lines stay", the one on screen does not. If it had just appeared (accept or step line, seen for under `minMs`) the player never reads it; the tracker pill and the journal still show the step, but the "return for your reward" kind of line is a one-shot.
Fix: keep the shown note (`tq.cur = n` in `display`) and, in the urgent branch, when `tq.quest && now() - tq.at < holdMs`, `tq.q.unshift({ ...tq.cur, hold: true })` before displaying the urgent line (the queue order puts it right after the urgent line). Test with the fake clock.

### R11-04 minor: the shell's `closeDialog` on the dead scene is a no-op
`game.js:56` calls `game.input({ t: "closeDialog" })` while `scene === "dead"`. `intent.js:193,224` `live` is floor/town only and `if (!live) return fail("not in a running game")` runs before `itemCommand`, where `closeDialog` lives (`intent.js:139`). So the core dialog stays open until `respawn` (`world.js:59` clears it, so no lasting harm), and the `|| game.core.ui.dialog` part of the condition re-enters `game.input` on every `emitChange` for the whole death screen (guarded by `deadClosing`, but wasted work and a misleading comment). The `releaseCursor` half is correct: it calls the core function directly, and the core death path already releases (`damage.js:137`), so a held item goes to the bag, else to the floor with `keep: true`: no loss, no duplicate in the paths I read (hero killed by damage; `scene.js` safety net via the shell; `heldOrigin` is cleared so no dim ghost is left). A death with the bag full drops the item on the hero's tile, it stays on that floor.
Fix: import `closeDialog` from `./core/systems/world.js` (or export it through `core/index.js`) and call it directly next to `releaseCursor`, or drop the dialog branch and its comment.

### R11-05 minor: points nudge firing rules
`game.js:84`, checked after the `portalToast` early return (`:77`):
- No `game.storyOn` gate and no `pointsHintSeen` use, unlike the older `pointsHint()` (`:114-118`, once per run). It fires on every arrival at floor 2 with unspent points, including each trip back from the Lobby, and in test/bot mode (a toast the bot fixtures did not have before; check the e2e that read `toast`).
- After an Emergency Exit trip, `floorEnter` returns early, so there is no nudge on that arrival (probably acceptable, say so in the comment).
- Same text as the level-up hint: it is de-duplicated only while the first is on screen or waiting, so a player can see it twice in a minute.
- Passive, so it can wait many seconds behind a quest line and then appear out of context.
Fix: decide the rule and write it down: either once per run (`if (!pointsHintSeen) { pointsHintSeen = true; ... }`, which also stops the repeat from the level-up hint) with `game.storyOn`, or "once per arrival" as the comment claims, but then drop the level-up duplicate. Add a behavioural test of the rule (see R11-06).

### R11-06 minor: source-text-only tests (L-056) and missing behaviour tests
Tests whose only assertion is a regex over source or CSS text:
- `ui-r8t2.test.js` N2 (death closes panels, returns the held item): regexes over `game.js` only. This is the one with real logic and it has no behavioural test; R11-04 went unseen because of it. Needed: build `newGame`, put an item on `cursorItem`, kill the hero (`setHp` or damage), emit through the shell (`createGame` with a stub canvas, as the hook tests do) and assert bag/floor holds exactly one copy, `ui.left/inventory/map` false, `heldOrigin` null; also with a full bag.
- `ui-r8t2.test.js` N1, N3, N4: CSS regexes (acceptable only if a computed-style e2e covers them: `e2e/r8t2-fix.mjs` exists, not run here; name it in the test header).
- `ui-r8t3.test.js`: "L-6 game.js" (the URGENT/PASSIVE set text and the nudge line as one regex; this should run the real event path), "L-1 contracts", "L-2", "L-3", "acceptance" (all text).
- `ui-r8t.test.js`: "R8-A1 CSS contract" and the `syncToastDup(); // before the re-placement` assert (a comment text).
Good ones, for the record: `tipLimit`, `xpFileHtml`/`xpTipHtml`, `effCol`, the toast-queue cases, `drawerLayout`, `actorScale`, `render-r8t3` (recording context, save/restore balance, arcTo/clip). Weak spot in `render-r8t3`: the brace outline check `e.ss === "#1b1530" || e.lw >= 1.7` passes on any thick stroke; the first G-1 rare test filters strokes by an lw window (1 to 1.2) that is redundant next to the exact count.
The sq5 pins (`adv-r74`, `core-r8t1`) replaced a `todo` and a 700-seed scan with a 12-seed list duplicated in two files and the 1000-seed scan in `quests-sq45.test.js:128` (verified present): not a weakening, but share the list.

### R11-07 minor: short-phone toast strip
`panels.js:370` sets `--tb: 3px`; `style.css:800` clamps to one line with 2 px padding in a 36 px strip (`SHORT_LANE`). A 3 px border x2 + one 14 px line is about 27 px at text scale 1; with the text-size option (`--ts` above 1) the toast grows past the strip and over the panel footer, and a long quest line is cut to one line with an ellipsis (the full text stays in `title` and the live region, but a touch user has no hover). Fix: set `min-height`/`max-height` from `SHORT_LANE / ts`, allow `-webkit-line-clamp: 2` when the line is a quest line, or give the strip `ts`-aware height in `drawerLayout`. Check at 667x375 with the largest text size.

### R11-08 nit: `uniqueGuard` narrowing
`testhook/index.js:423` narrows to `free.base`, but `rollItem` (`roll.js:107-111`) picks at random among all uniques of that base and turns a taken pick into a rare. Today every base has exactly one unique (probed: 10 bases, 1 each), so it holds; with two uniques on a base it would again produce the stray rare. Fix: narrow only when `pool.filter((u) => u.base === free.base).every((u) => !taken.has(u.id))`, else refuse; the `fellback` branch remains the net. The new test relies on that one-per-base fact: say so in it.

### R11-09 nit: accessibility
- `style.css:345-347`: the Employee File name and class lines are clipped with an ellipsis and have no `title`; add `title` on the h2/p (the text is complete in the DOM for screen readers, so this is sighted users only).
- `style.css:808, 831`: the drag hint is hidden on the short phone and at 700 px height; the comment says tooltip and Esc teach it, but a touch user has neither. Keep one line of it in the footer, or confirm that the phone flow does not use drag.
- Verified fine: `.xptip` is now `role="img"` without `tabindex` (no dead focus stop); the XP total is visible text (`.xpt`); the h2 hidden in the short header uses a clip pattern, not `display:none`; the dock and HUD hide with `visibility:hidden` (out of the tab order); the death screen hides the toast visually but the `#live` region stays; `.footrow .notice { display: contents }` is safe here because `.notice` is not a live region (`panels.js:131`); the held line is `nowrap` with an ellipsis, so a long item name is cut visually.
- Moved tabs: `renderInto` moves `.tabs` into `.ph` after `innerHTML`, and `restoreFocus` runs after the move, so a focused tab keeps focus; the panel signature contains `game.w/h`, so a rotation re-renders and the tabs go back (`panels.js:294-303`).

### R11-10 nit: housekeeping
- `config.js:65`: the trailing comment still says effective hp "1.0 to 2.5": floor 2 is now 1.88 x 0.62 = 1.17, floor 3 1.55 (monotonic, AC-R-031-1 holds: 1.00, 1.17, 1.55, 1.75, 1.94, 1.97, 2.36, 2.50). Update the comment with the floor 2 value.
- `gearparts-armour.js:196`: `bodyOver(g, p, tier, at)` no longer uses `at` for tier 3 (the diamond is fixed to the torso); drop it from the tier 3 path or the callers.
- `layout.js:80-84`: `lane` exists only on the short return; give the other returns `lane: TOAST_LANE`/0 so the shape is stable.
- run-c: the golden is pinned by self-replay only (as `quests-fix-r7.test.js:102` already says). The progress note's "no death" is not asserted anywhere; add `assert.equal(s.stats.deaths, 0)` to the run-c test so a future re-record cannot hide one.

## Focus items

**Held item on death.** Core: `damage.js:135-138` releases the cursor before the scene flips (bag, else floor with `keep`; never destroyed). Shell: `syncUi` repeats it through the core function for any other route (safety net in `scene.js`, setHp cheat). Paths read: bag has room (item goes to the bag), bag full (item on the hero's tile), item picked from a slot or belt (it returns to the bag or floor, not to the slot, so no duplicate of the equipped one), item picked from the grid (`heldOrigin` cleared, the "dim origin" copy is only drawn while held). No loss, no duplicate found. Open: R11-04 (dialog) and R11-06 (no behaviour test).

**Urgent toasts.** Order inside one dispatch is correct (urgent first, holds the lane, the rest queue behind it; verified by reading `place`/`end`, and `QP` ranks urgent first). A later direct line can replace an urgent line after `minMs` (700 ms); acceptable. Losses: R11-02 (level-up, skill-learned), R11-03 (the quest line on screen). A waiting quest line is never dropped.

**Balance and goldens.** `depthMult.hp[1]` 0.72 to 0.62: floors 1 to 8 stay non-decreasing. Full unit suite green, including `quests-hash`, the legacy-balance proofs and "run-c without any quest system" on the new recording. The proof in `R8T-balance.md:42` is sound for "only numbers moved" (legacy goldens run under `withLegacyBalance`); run-c itself has no legacy copy, which was already the case since R8.

**Layout (by reading).** 1280x720 and 1366x768: not phone, `short` false; changes are the sticky footer (`bottom:0`, `margin-bottom:-10px`, `padding-bottom:10px`, equal net box), the held-item footer in two rows, the extra XP total line in the Employee File (the body already scrolls), `.screen` scrolling. Phones: portrait `#ui.phone:not(.short)` rules do not touch landscape; the dock wraps and keeps 44 px buttons; short landscape (h <= 430 and w > h) panels: header row 48 px, 34 px cells, 36 px strip: the inventory column is about 250 px high next to a 204 px equipment block, plus footer; it scrolls inside `.pb` with the footer sticky (needs the e2e/screenshot to confirm it fits at 667x375). R11-01 is the one real regression.

**Render.** Tier 3 body: one `save` in `bodyUnder`, one `restore` in `bodyOver`, a second balanced `save/restore` for the ink and lines: the test asserts balance on all four body categories and three classes; the clip is released before the collar diamond. Rare trim: one edge, two studs, as the doc says. Brace: bigger outline, colours changed with the layering test updated. Quest elite: `actorScale` is pure and now also used for the status icon height (`drawIcon` fix); `it.k` is always set in `addActor` before `drawIcon`. Gear cache `warmLeft`/`warmMs` read existing fields; no cache-key change.

processes: none
