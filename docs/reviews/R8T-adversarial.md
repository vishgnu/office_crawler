# R8-T adversarial pass (test-engineer, package TE-R8T)

Frozen worktree of 4f25e82 (`.../scratchpad/wt-r8t/office-crawler`), Chromium via Playwright 1.56.1, built with `node build.mjs` (703 KB). `src/` untouched. New scripts are `e2e/r8t-*.mjs` plus `e2e/r8t-inpage-entry.js` (bundled into the page by the full-run script). One existing script was hardened: `e2e/adv-r7.mjs` ([R7-tabs]). Screenshots and logs: `/tmp/claude-0/shots-r8t` (never docs/shots).

## Result in one table

| Area | Result |
|---|---|
| Full runs to the boss, 3 classes, browser | all three won (seed 1); see below |
| Save/load (quests, gear looks, slots, stash, belt, cursor item), file:// and http | 60/60 plus 3-slot switch; clean |
| Write-then-immediate-reload, pagehide flush, quit-then-continue | clean |
| Keyboard-only journey | 35/35; one info item (no keyboard movement) |
| Phone layouts (portrait, small, landscape, touch emulation) | 3 findings (N1, N3, plus known U-5) |
| Offline file:// smoke (production mode and real-time mode) | 15/15 |
| Built size, legal, denylist scans of dist | 13/14 (licence file missing: known, CORE-R8T-1) |
| Reachability at 1280x720 and 1366x768 (L-052) | 44/44 and 44/44 once scroll containers are credited; R8-A1 still visible at 1280x720 |
| Existing suites on the frozen tree | unit 1295 pass, 1 todo, 3 runs (1296 tests); e2e run-all: all 19 scripts green |
| [R7-tabs] flake | not reproduced in 79 runs; test hardened; see verdict |

## Findings (new)

### N1 (medium-low) Short landscape phones: buttons fall outside the viewport and cannot be scrolled to
- Repro: `REACH_SIZES=667x375,740x360 node e2e/r8t-reach.mjs` (or open the build at that viewport).
  - 740x360: title screen Options button at y 309-367 (viewport 360); create screen Load and Back buttons at y 314-362 are cut off; death screen Quit to title at y 332-390.
  - 667x375 and 844x390: death screen Quit to title at y 337-395 / 350-408 outside the viewport; the "You have been let go." heading is cut off at the top at 844x390 (`r8t-reach-dead-844x390.png`).
- Evidence: reachability check reports `outside viewport` with no scrollable ancestor, on first look and after scrollIntoView. Portrait 390x844 and 360x640 are clean.
- Why it matters: Back/Load on the create screen and Quit on the death screen are the exits; Esc still works on a keyboard but a touch player has no way out of the create screen or off the death screen except Respawn.
- Suspected: `src/style.css` `.screen` (flex, centered, fixed height, no `overflow-y:auto`; line 6) and `.dead`/title panel sizes in `src/ui/screens.js`. Fix idea: `overflow-y:auto` with `justify-content:safe center`, tighter gaps at `max-height:420px`.

### N2 (low) Death screen leaves drawers, dock and the held-item ghost visible
- Repro: open Desk Drawer and Employee File, pick a bag item with the mouse (item on the cursor), die (`cheat.setHp(0)`), wait 0.7 s. `r8t-states.mjs` check "on death the side drawers are closed" -> `{drawers:2, ghost:true}`. Screenshot `r8t-states-dead-with-panels.png`: both drawers and the dock stay visible (dimmed) and the item ghost (z-index 100, above the overlay at 20) floats over the death stats box.
- Not lost data: the held item survives respawn (checked). HUD is inert while the overlay shows.
- Suspected: `src/game.js` death transition does not close panels; `#ghost` z-index in `src/style.css` / `src/ui/panels.js` (ghost is not hidden when `menu()` is set).

### N3 (low) Phone: Employee File dock button is 39x44, under the 44x44 touch target
- Repro: 390x844 and 360x640, touch emulation, `node e2e/r8t-phone.mjs` -> `dock-character 39x44`. Other dock buttons, skill slots and belt slots pass.
- Suspected: `src/style.css` lines 700-706 (`#ui.phone .dock .hbtn{flex:0 1 auto;min-width:0;overflow:hidden}` and the `max-width:400px` padding), the dock shrinks the button.

### N4 (low) A 16-character wide name overflows the Employee File header on a 390 px phone
- Repro: name `WWWWWWWWWWWWWWWW`, 390x844, open Employee File. `file-name`, `file-class` run from x=93 to x=415 (viewport 390). Desktop 1280x720, pause menu, slot manager and title are clean for W, M, CJK and combining-mark names (zalgo names are clipped by the input to 16 code points as designed).
- Suspected: `src/ui/panels.js` line 130 (`.fh` block, no `min-width:0`/ellipsis on the name) and `src/style.css`.

### N5 (info) A keyboard-only player cannot move or attack
- W/A/D, arrows and Space do nothing (hero did not move over 180 ticks). Panels, menus, slots, create flow, quit/continue, death/respawn are all fully keyboard-operable (35/35). Consistent with the spec ("desktop mouse and keyboard", R-244 keyboard path is for panels), so recorded only as a known limit, not as a defect.

### N6 (info) Loading restores full health
- hp is not in the save (`src/save/format.js` SAVE_KEYS has no hp). Reload at floor entry with 10/68 hp comes back 68/68; write-then-reload on the boss floor resets the hero but not the boss (boss stays undefeated, not duplicated). Requirements note (20-requirements.md:422) says mid-floor state is not saved, so this is by design; a reload is a free heal at floor entry. Mention to the balance owner only.

### N7 (info, test-side) Death screen buttons ignore clicks for 0.5 s
- `.dead .btn{pointer-events:none; animation: unlock 0s .5s}` is a deliberate guard. My first reachability run clicked at 100 ms and saw "covered by screen dead": test artifact, fixed in the script (waits 700 ms). Not a product defect.

## Known open items: confirmed, not re-reported

- R8-A1 still open at 1280x720: inventory drawer spans y 8-588, bag row 4 bottom at y 606 (`r8t-adv.mjs` check fails, drawer has an internal scroller `pb`, so the cells are reachable by scrolling but cut off at rest). At 1366x768 the drawer fits (0 via scroll). All other controls are reachable with the scroll containers credited (skills tree, journal, vendor list, stash list, Options need scrolling at both sizes).
- R8-A2 still open: `.xptip` box 204x29 at (425,604) is what `elementFromPoint` returns at its own centre, over the canvas.
- R8-V2 U-5: `#ui.phone .hbtn[data-open=map]{display:none}` (style.css:269): no Map button on phone; my phone script skips Map for that reason.
- docs/ASSET-LICENCES.md missing (CORE-R8T-1). The NFR also says the licence list is shipped with the build: dist contains no licence text. Worth including in that package.
- R8-A3, A4, Q2/Q3, V1, P1 not re-tested here (assigned). Browser full runs gave a hint on A3: floor 2 damage taken was 36 (FM), 6 (SR), 0 (IT) with 0 deaths on floors 1-4 for all classes on seed 1, so no floor-2 spike in that seed; the one Sales Rep death was on floor 8.

## Full runs per class (no cheats)

`e2e/r8t-fullrun.mjs <class> 1 400000`: start through the real UI (New game, class card, name, Start), then the bot policy runs inside the page through `window.__app.input` (public inputs only, no `cheat.*`), manual test clock (`step(6)` per decision). All three classes ran in parallel, about 9-10 minutes wall each, so the 60-minute fallback was not needed. Note: the policy drives the hook's manual clock, not wall time; wall-time play and real mouse clicks are covered only by the shorter offline script (`r8t-offline.mjs`). The victory screen was reached in each run and "Keep playing" was clicked with the real mouse (scene returned to the Lobby, `bossDefeated` true in the save). First attempt (outer-loop bot at about 150 ms per decision) was abandoned as too slow under the machine load (load average 20-30 from other agents); the in-page loop is 10x faster.

| Class | Result | Game time | Deaths | Level | Boss fight | Side quests |
|---|---|---|---|---|---|---|
| Facilities Manager | won | 23.4 min | 0 | 19 | 58 s, hp min 169 | main, main2, sq1-sq5 done, 2 Lobby trips |
| Sales Rep | won | 25.8 min | 1 (floor 8) | 19 | 57 s, hp min 153 | same |
| IT Wizard | won | 22.1 min | 0 | 19 | 46 s, hp min 163 | same |

No page errors, no network requests beyond the file, in all three. main3 (verdict step) is not in the recorder's list only because the in-page recorder stops before the real click on Keep playing; not a game problem.

## [R7-tabs] flake verdict

- Reproduction effort (`e2e/r8t-tabs.mjs`, own fixture from the game's save writer, same two-tab scenario as adv-r7 section 6): https origin sequential 6 + 6, file:// sequential 6 + 6, https with three scenarios in parallel on seeds 101, 102, 105 (12 + 12 + 12 + 12), once more under six CPU-burner processes on top of the machine load (12 + 12), each with the click awaited and with the click swallowed as in the original. Plus `adv-r7.mjs` section `slots` unmodified x3 and hardened x3, and the full run-all (adv-r7 261/261). Total about 79 two-tab runs, 0 failures. The original failure did not recur in any condition, so the cause cannot be classified as product with evidence.
- Assessment: product code path is exercised cleanly (tab B hand-in, stale tab A write refused or merging nothing, pouch rule holds). Candidate cause is the test: `await talk(B,"vendor")` ignores the returned "dialog open" flag, and `B.page.click(...).catch(() => {})` swallowed any click failure, so a slow render under load became a silent no-op and a red "tab B hands in sq1" check with no cause (machine load was 20-35 during this round). Classification: test (probable), environment (load) as trigger, not product. The shipped delivery mode (file://) shares no part of it: the scenario passed from file:// too.
- Change made (hardening, not a proven fix): `e2e/adv-r7.mjs` now waits for the hand-in button to be visible, awaits the click with a timeout, records `{dlgOpen, clickErr}` in the failure detail of the check, in both the first attempt and the bag-full retry. Passed 3/3 after the change and 261/261 in run-all.

## Other results worth knowing

- Hostile imports (rules named in `r8t-adv.mjs`): NaN-string gold, negative gold, gold 1e300, level 0, level 1e9, `__proto__` key, `constructor` skill id, unknown item base, unknown class, markup in the name, checksum mismatch, empty object, array, null, 5000-deep nesting: every one rejected or loaded safely, no prototype pollution, no page error.
- Input spam: 400 random keys, clicks (left and right), resizes (six sizes incl. phone) and Shift holds in real-time mode: no page error, state sane.
- Boundary values: gold past 2^31 stays a safe integer and fits its box; `setLevel(levelCap)` works, cap+1, 0, -1, NaN, 1e9, "7", null refused or harmless; full bag (5 items of 2x3/2x2 fill the 10x4 bag by first-fit, further pickups refused "inventory full" and nothing lost or duplicated, ids unique); Emergency Exit at 40 gold: 14 gold refused, exactly 40 buys it leaving 0, further clicks buy nothing (R8-A6 evidence hole closed for the vendor part).
- Cursor item at reload: the item in the hand comes back exactly once.
- Interrupted states: reload while dead, on the boss floor, on the victory screen, and floor change plus reload in one task all give a valid game (no softlock); quest state intact.
- Storage: my "worst case" fixture reached only 13 KB per slot (bag fit 5 large items; stash fill did not take); by bound (40 + 80 cells + 12 worn, about 500 B per item) a slot stays far under 400 KB; five slots load; quota exhaustion test did not hit a failing write (the write replaced an existing key), so the quota-failure path is only covered by earlier rounds' `slots.fail`.
- Scans: dist 703 KB raw, 242 KB gzip, 204 KB brotli; no external URL, no fetch/XHR/WebSocket/eval/Function, no term of either denylist (whole word and substring), CSP `default-src 'none'`, no local paths or addresses, no runtime dependencies, `play/index.html` equals dist.
- Offline production mode: file:// with network off, title painted and animating, new game by real clicks, real play, immediate reload offers Continue, no `__app` in production, no console errors. Real-time mode: walks on its own, resize x3, hidden tab flushes a save, pause stops ticks, a real-click fight.

## Stale fixtures
None found in this pass; the frozen tree's existing scripts are all green. New scripts that fail by design until the fix packages land (so keep them out of `run-all.mjs` until then): `r8t-reach.mjs` with `REACH_SIZES=667x375,740x360,844x390` (N1), `r8t-adv.mjs` (R8-A1, R8-A2, N4 on phone), `r8t-phone.mjs` (N3), `r8t-states.mjs` (N2). Always green and cheap enough to add: `r8t-save.mjs`, `r8t-keys.mjs`, `r8t-offline.mjs`, `r8t-scan.mjs` (fails only on the licence file), `r8t-vendor.mjs`, `r8t-storage.mjs`. `r8t-fullrun.mjs` takes about 9 minutes per class, run per class on demand (`node e2e/r8t-fullrun.mjs sales-rep 1 400000`).

## New scripts
`e2e/r8t-fullrun.mjs`, `e2e/r8t-inpage-entry.js`, `e2e/r8t-reach.mjs` (REACH_PHONE=1 or REACH_SIZES=WxH,...), `e2e/r8t-save.mjs`, `e2e/r8t-keys.mjs`, `e2e/r8t-phone.mjs`, `e2e/r8t-offline.mjs`, `e2e/r8t-scan.mjs`, `e2e/r8t-adv.mjs`, `e2e/r8t-states.mjs`, `e2e/r8t-vendor.mjs`, `e2e/r8t-storage.mjs`, `e2e/r8t-tabs.mjs`; changed: `e2e/adv-r7.mjs`.

processes: none
