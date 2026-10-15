# FIX-UI-R8T progress
- done: R8-A1 Desk Drawer: the drag hint moved out of the narrow side column (it made the doll row ~75 px taller than the doll), legend/gaps trimmed: content 596 -> 549 px. 1366x768: fits without scrolling (556 px body); 1280x720: body scrolls (517 px) and the footer (gold, owed line, Put back / Drop on floor) is sticky, so it is always in view and hit-testable (elementFromPoint ok for drop-floor, put-back, inv-owed, cell-9-3 after scroll). Files: ui/panels.js (renderInventory), style.css.
- done: R8-A2 `.xptip` pointer-events none (title and aria-label stay); elementFromPoint on its old box is now the canvas at 1280 and 1366. Cost: the mouse hover tooltip with the XP total is gone (the total is in the Employee File).
- done: R8-V2 U-5 phone Map button back in the dock (key caps hidden on the phone dock so five buttons fit 390 px); U-1 map title shortened via `T.mapTitle` "Floor map" -> "Map" (render/map.js reads T.mapTitle; I did not touch render): "Map: Floor 4: Open-plan floor" is 238 px at 17 px, clear of the compact 44 px close button at 390 and 360 px.
- done: U-2 tooltip bounds end above the measured toast box (tipBottom) and an open tip is re-placed when a toast appears; checked 1280/1366 (tip bottom 540 < toast top 548).
- done: U-4 bust crops the whole figure at the canvas aspect (hat to boots); File photo 60x72 (canvas 120x144), slot badge gets bottom padding so the accent bar no longer covers the boots.
- done: R8-V1 N16 verified (phone map-open dock keeps only Map), N12/U-3 single-chain skill branch stacks centred over both columns, elbow dropped (markup unchanged, so ui-r6 / ui-vfix7 tests still hold).
- done: R8-Q2/Q3 were already in src/game.js (invByDialog closes the bag with the NPC window; toastDrop drops the stale "return for your reward" line). Verified by real UI at 1920x1080 and 1280x720: sq1 + sq5 hand-ins show their own lines in order (60 gold line, then 120 gold line, then level-up), and Escape closes the NPC window and the Desk Drawer. No change needed.
- done: wish: respawn toast with an empty belt reads "Back in the Lobby. Your belt is empty: restock potions at the Break Room Barista." (ui/messages.js, ui/text.js).
- tests: test/ui-r8t.test.js (7).
- verify: node --test full run 1310 tests, 1309 pass, 0 fail (1 todo, ADV-R7-10); two further full runs were killed by the timeout under load from parallel agents (not red); build ok; e2e/ui.mjs 174/175 (stale: phone Map button assertion).

## Fix round (R8-T code review)
- done: F1 Employee File prints "Total experience: N" as visible text (`xpFileHtml`, `.xpt`); HUD `.xptip` is `role="img"` (no tabindex), title/aria-label kept so e2e/ui.mjs:434 (reads `title` of hud-xp) still holds. Tested on the pure builders.
- done: F3 footer sticky `bottom:0` + `padding-bottom:10px` + `#pright .pb{scroll-padding-bottom:64px}`; 1280x720 screenshot (scratchpad, viewed): footer bottom == body bottom (584), nothing clipped.
- done: F8 `syncToastDup()` before the tip re-placement; `tipLimit(hudTop, toastTop)` pure with a 130 px lower bound, unit tested.
- done: F7 UI: ui-r8t tests use builders/pure functions (xpFileHtml, xpTipHtml, tipLimit); U-5 pre-existing-rule assertion dropped. CSS-only items (A1, A2 pointer-events, U-4 crop, N12) remain declaration checks.
- done: F4 testhook: partly taken uniques are narrowed to an untaken unique's base before rolling (no stray rare); fellback:true documented as "a rare was created"; partial-taken test added.
- done: F5 ADV-R7-10 test uses the 12 short seeds (102 105 173 183 194 412 446 447 468 565 597 657); adv-r74 todo converted to a real assertion on those seeds.
- verify: node --test x2: 1315 pass, 0 fail, 0 todo; build ok.
