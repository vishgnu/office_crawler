# R11-3 regression sweep (test-engineer, adversarial, harness 0.5.1)

Frozen worktree at 6cbcb4f (`.../scratchpad/wt-r11/office-crawler`), `node build.mjs` (716 KB dist), Chromium via Playwright 1.56.1. Screenshots and JSON went to a temp dir (`.../scratchpad/out11`, E2E_SHOTS), never to docs/shots. No git commands, no product edits. New scripts are `e2e/r11-*.mjs` plus `e2e/r11-inpage.js` in the worktree (the orchestrator copies them back).

Known list (R11-01..R11-10, M-1..M-6, U-1..U-4): not re-reported. Fixer progress files re-read at the end (`R11-fix-ui-progress.md`, `R11-fix-render-progress.md`): see "Already being fixed" below.

## Result in one table

| Area | Result |
|---|---|
| `r8t-fullrun` per class, current build, no cheats, to the boss (seed 1) | 3/3 won, 0 deaths, 8/8 checks each, 0 page errors, 0 stuck |
| Real-mouse play, floors 1-4 (real clicks, real keys, Employee File / Skills panels by click), 3 classes x 2 seeds | 6/6 finished floor 4, 0 deaths; lowest hp per floor in the table below |
| Floor 2 re-measure (3 classes x 4 seeds x 3 modes = 36 runs) | 2 deaths (both Facilities Manager, seed 3, 18 s after arrival at level 2); nudge shows in 24/24 runs with unspent points; no measurable effect of the nudge |
| 10 Hz click spam on a changing far target in a crowd (3 classes x 2 seeds, manual clock) + real-time variant | FM 3 to 6 x slower to a first hit than clicking the nearest monster (still open, F-03) |
| Save/load, all features (3 classes http + 1 file://) | 36/36 clean |
| Two tabs (https and file://) | stale tab refused (`another-tab`); 1 low finding (options overwrite, F-04); flake study below: environment |
| Keyboard-only | 33/35; 2 low findings (focus not moved on opening a panel / Options) |
| R8-T fixes regression (death screen, belt hint, phone dock, landscape panels, 1280x720 drawer) | all hold; M-1 reproduced as "Journal button hidden behind the quest tracker at 360x640" (known) |
| Existing suites on the frozen tree | unit 1339/1339 (1 run); e2e: r8t-reach 147/147 (7 sizes incl. 667x375, 740x360, 844x390, 360x640), r8t-phone 40/40, r8t-adv 87/87, r8t-states 14/14, r8t-keys 35/35, r8t2-fix 54/54, r8t3-fix 134/134, r8t-save 60/60, r8t-vendor 6/6, r8t-storage 11/11, r8t-scan 14/14, adv-r7 261/261, r8t-offline 14/15 under load 25 and 3/3 at load below 4 |

## Findings

Severity scale as in R8-T. "Known/fix" in the last column refers to the fixer progress files.

| id | sev | summary | status |
|---|---|---|---|
| F-01 | medium-low | Floor 2 is still dangerous for the Facilities Manager at level 2: 2 deaths in 12 FM runs, lowest hp at or below 35 % in 7 of 12 | open (balance, deferred item re-measured) |
| F-02 | low | Floor 4 near-death: Sales Rep seed 1 dropped to 2 hp (1 %) after 8 potions; no death | open, info for balance |
| F-03 | low | Click spam on a changing far target: FM first hit 168 and 300 ticks vs 48 to 60 when clicking the nearest monster | open (R8-A4 follow-up 3, not in a fix package) |
| F-04 | low | Options are one global object written whole: a stale tab silently reverts options set in another tab | new |
| F-05 | low | Keyboard: opening the Employee File with C and opening Options from the pause menu leave focus on `<body>` | new |
| F-06 | info/low | Skills panel at 1280x720: only tier 1 Learn buttons are in view; tier 2 and 3 sit 270 to 850 px below the fold | new, info |
| F-07 | info | Floor-2 nudge: shown 0.3 to 3 s after arrival in all 24 runs with unspent points, but the level-up hint at floor 1 already said the same; R11-05 as fixed removes the floor-2 line for anyone who saw the hint | design note on the fix |
| F-08 | info | M-1 evidence: at 360x640 the wrapped Journal dock button (x 269-354, y 53-97) is under the quest tracker pill (x 6-354, y 54-84), 70 % of its area | known M-1; fixed in main (not re-verified) |
| F-09 | info (env) | Two-tab check and r8t-offline real-time check fail only under load: classification environment | closed as env |

### F-01 Floor 2, FM, level 2 (re-measure, three modes)
- Repro: `node e2e/r11-play.mjs facilities-manager <spend|nospend|nudge> <seed 1..4> 2 manual` (stops on arrival at floor 3). Real mouse clicks, 10 Hz decisions, belt keys, no cheats. Policy of the bot decides what to do, a translator clicks tiles on screen; `equip`, `buy`, `sell`, `questAccept` stay on the public input.
- Per mode: `spend` = the points are spent through the Employee File / Skills panels (real clicks) as soon as they exist; `nospend` = never spent; `nudge` = ignored (including the floor-1 level-up hint) until the floor-2 toast shows, then spent.
- Floor 2 (all values are the floor-2 visit; ratio = lowest hp / max hp):

| class | mode | seed 1 | seed 2 | seed 3 | seed 4 |
|---|---|---|---|---|---|
| FM | spend | 56 hp (0.45) | 30 (0.30), 3 potions | **died**, 5 hp (0.05), 4 potions | 44 (0.49) |
| FM | nospend | 63 (0.56) | 30 (0.32), 4 potions | 32 (0.34), 4 potions | 62 (0.81) |
| FM | nudge | 34 (0.34), 2 potions | 35 (0.32), 3 potions | **died**, 5 hp (0.05), 4 potions | 44 (0.49) |
| SR | spend | 44 (0.69) | 25 (0.35), 3 potions | 30 (0.43) | 41 (0.62) |
| SR | nospend | 43 (0.70) | 28 (0.38), 4 potions | 23 (0.34), 3 potions | 23 (0.37) |
| SR | nudge | 55 (0.70) | 14 (0.16), 6 potions | 24 (0.34), 2 potions | 46 (0.70) |
| IT | spend | 58 (0.81) | 33 (0.49) | 52 (0.78) | 32 (0.51) |
| IT | nospend | 37 (0.54) | 24 (0.39) | 38 (0.62) | 26 (0.46) |
| IT | nudge | 27 (0.47) | 27 (0.40) | 58 (0.87) | 57 (0.79) |

- Totals: deaths on floor 2: spend 1/12, nospend 0/12, nudge 1/12 (both are FM seed 3: the same pack, 18 s (1090 ticks) after arrival, hpMax 98 to 99, level 2). Median lowest-hp ratio 0.49 (spend), 0.43 (nospend), 0.44 (nudge); mean 0.50 / 0.49 / 0.47. FM: 7 of 12 runs end at or below 0.35 (potions used: up to 4); SR 0.16 in one run. Compared with the R8-T proxy round (3 deaths in 12 runs with points spent) it is better, but FM still dies in 2 of 12 and the three modes cannot be told apart at n = 12 each. Spending the points does not make floor 2 safe; at level 2 the gain is 5 attribute points and 1 skill point.
- The one FM death that did not repeat (nospend seed 3) survived with 32 hp and 4 potions, so it is a close call, not a different outcome of play.
- Evidence: `out11/play2/r11-play-facilities-manager-*-3.json` (events, toasts), full table by `scratchpad/agg.py`.
- Suspected: first pack on arrival at floor 2 for a 98 hp FM (config floor 2 hp multiplier 1.17 x, `src/core/config.js`; pack placement in `src/core/gen/`). Balance owner decides; not a code defect.

### F-02 Floor 4 near-death (Sales Rep seed 1)
- `r11-play.mjs sales-rep spend 1 4 manual`: floor 4 lowest hp 2 (0.01), 8 potions drunk, 0 deaths; same class seed 2: 55 hp. FM floor 4: 65 (0.33) 3 potions and 92 (0.53); IT 58 (0.43) 5 potions and 58 (0.44). Floors 3: 50 to 130 hp, ratio 0.63 to 0.95. The in-page bot run (`r8t-fullrun`) reaches floor 4 with 9 to 32 damage taken in total, so real-click play takes 5 to 12 x more floor-4 damage than the bot (clicks are slower than orders, the bot kites). Info for the balance owner.

### F-03 Click spam, far changing target (still open, not in any fix package)
- Repro: `node e2e/r11-spam.mjs 1,2` (STRATS default far-changing, far-fixed, nearest, rotate, none; CLOCK=real for wall-clock pacing). Setup: empty floor 2, six monsters (zombie interns and printer imps) 4 to 10 tiles away on screen, real clicks every 6 ticks (10 Hz), level-1 hero, first hit = first monster hp below its spawn hp.

| class | far-changing | far-fixed | nearest |
|---|---|---|---|
| FM | 168, 300 ticks | 156, 138 | 60, 48 |
| SR | 90, 60 | 96, 60 | 18, 24 |
| IT | 90, 60 | 96, 60 | 18, 18 |

- FM: first attacker adjacent at 42 to 78 ticks, first hit only at 168 / 300 ticks (2.8 / 5 s) with 2 to 3 attackers adjacent; the hero keeps walking to the far target. Real-time variant (100 ms wall pacing, load about 20): FM far-changing 490 / 245 ticks vs nearest 134 / 74. R8-A4 measured far-fixed FM at 0.8 s with three adjacent monsters; here the same strategy takes 2.3 to 2.6 s (different staging, so not a proof of regression). SR and IT land a first hit in 1 to 1.5 s (60 to 96 ticks). No spam run failed to land a hit; no page error. A hero that makes no click dies in 7 to 12 s (there is no auto attack, as expected).
- Suspected: re-targeting on every click restarts the path (`src/core/systems/intent.js` `mouseDown` -> `issueAttack`), no rule that an adjacent aggressor is hit when the clicked target is not in reach (R8T-acceptance suggestion).

### F-04 Options are overwritten wholesale by a stale tab
- Repro: `TWOTAB_ONLY=1 node e2e/r11-save.mjs`. Tab A plays, tab B takes over (`takeOverSaves`), sets text size 1.5 and high contrast, writes. Stale tab A then sets text size 1.25 (the hero save write is correctly refused, `another-tab`). A third tab reads text 1.25 and high contrast false: B's high contrast is lost, A's value wins. Both https and file://.
- Why: `src/main.js` `commit()` -> `store.saveOptions(game.options)` writes the whole options object under one global key with no ownership check and options are read only at start (`slots.js:470-471`). Hero data is protected (stale tab refused, B's agility point and gold intact), only options are not.
- Impact low (a stale tab changing an option reverts another option from the other tab).

### F-05 Keyboard focus is not moved into a panel or the Options screen
- Repro: `node e2e/r11-keys.mjs` (2 of 35 fail). Press C: focus stays on `<body>` (Tab then reaches the panel, as r8t-keys already proves). Pause menu, Enter on Options: the Options screen is up and focus is on `<body>`. Same screen later returns focus correctly after Back. Story memo (focus on `story-continue`), death screen (focus on Respawn without a Tab), + button, Learn, assign, vendor Buy, Esc chain, key rebinding, restore defaults, victory screen: all keyboard-complete.
- Suspected: `src/ui/panels.js` panel open does not call `focus()`; `src/ui/options.js` build does not focus its first control. Low (screen reader and keyboard users lose context for one Tab).

### F-06 Skills panel needs scrolling to reach tier 2/3 (info)
- `node e2e/r11-learn.mjs` (fails by design: it reports): at 1280x720 and 1366x768, levels 3, 6 and 10, all three classes, the enabled Learn buttons of tier 2 are at y 842 to 912 and tier 3 at 1363 to 1439 while the scroll body spans y 67 to 584 (623 at 1366x768). Plain mouse clicks at those coordinates hit nothing; `Playwright click()` hides this by scrolling. In the real-mouse play the same thing appears as `learn ... covered` (4 times in 6 runs): a person has to scroll. The floor-2 hint "S for skills" is therefore followed by a panel that shows tier 1 only. R8-T already noted that the tree scrolls at both sizes; this is the first measure of how far.

### F-07 Floor-2 nudge (design note for the fixed rule)
- Frozen tree: in the 24 runs that reached floor 2 with unspent points (nospend and nudge modes, 5 attribute points and 1 skill point at level 2) the line "You have points to spend: C for attributes, S for skills." shows after 18 to 180 ticks (median about 100, i.e. 1.7 s) behind the floor name. One run (FM seed 4) shows it 468 ticks late with nothing left to spend, because a passive line waits behind quest lines (this is R11-05, known). In real production flow (story on) the same line has already shown at the level-up on floor 1 (tick 2767 to 3421, 600 to 1100 ticks before floor-2 arrival), so the hero sees it twice.
- Effect on play: none measurable (F-01 table). The player who reads it spends 5 + 1 points at level 2.
- R11-05 as described in `R11-fix-ui-progress.md` (once per run, shared with the level-up hint) means no floor-2 reminder at all for someone who saw the hint on floor 1 (it showed 10 to 18 s before arrival). That removes exactly the second chance the R8-T acceptance asked for ("a single toast when the hero stands on floor 2 with unspent points"). Not verified on the fixed tree; decide whether "once per run" or "once per arrival with points still unspent" is wanted (the old nudge already tested that condition).

### F-08 M-1 as seen by the sweep
- `node e2e/r11-panels.mjs` (SIZES=360x640): dock rects inventory 76-157, file 160-230, skills 233-307, map 310-354 (all y 6-50) and journal 269-354 at y 53-97 (second row). The quest tracker pill is x 6-354, y 54-84, so it covers the Journal button (about 70 %); a tap there reaches the tracker. No dock buttons overlap each other (so the reviewer's x-range reading is the second row). All other sizes (390x844, 667x375, 844x390, 1280x720, 1920x1080) pass the same check. R11-fix-ui says M-1 is fixed in main ("the quest pill top follows the real bottom of the dock"): re-run `r11-panels.mjs` on the fixed tree; the check "the quest tracker pill hides no dock button" is the regression test.

### F-09 Environment classification (L-027)
- Two-tab hand-in check (`e2e/r11-tabs.mjs`, copy of r8t-tabs that records why tab B fails; also `r8t-tabs` and `adv-r7`): under load average 20 to 25 (other agents) 5 failures in about 70 two-tab runs (r11-tabs run 1: https 3/16, file await 0/8; run 2, instrumented: https 1/24; r8t-tabs: 1/24 where tab B had no Lobby at all, a crash in the unmodified script). At load 1 to 3: 48/48 (https await 12, https swallow 12, file await 12, file swallow 12) and adv-r7 261/261. In the one instrumented failure tab B's raw read, `memB`, and the owner record all say completed / self, tab A's `localStorage.getItem` right after B's write returned the old text ("ready") and 400 ms later the new one: Chromium shares localStorage between renderer processes asynchronously. Classification: environment (cross-process localStorage lag under CPU load) plus a test that reads the other tab without waiting; product ownership code not implicated. Not reproduced for the `w: false` (B write refused) variant seen once without instrumentation; 24 further instrumented runs under load and 48 at low load did not show it. The shipped file:// mode uses the same storage path; it showed no failure in 8 + 24 runs, too few to say it is immune.
- `r8t-offline` real-time check "the simulation advances on its own and the hero walks to the clicked tile" failed once at load 25 (frame times of 250 ms in the perf trace) and passed 3/3 at load below 4: environment.

## Full runs per class (`e2e/r8t-fullrun.mjs <class> 1 400000`, no cheats, to the boss)

| class | result | game time | deaths | level | boss fight | stuck / failed moves | wall |
|---|---|---|---|---|---|---|---|
| Facilities Manager | won | 23.0 min | 0 | 19 | 3282 ticks, hp min 190 | 0 / 0 | 528 s |
| Sales Rep | won | 25.0 min | 0 | 19 | 3486 ticks, hp min 111 | 0 / 0 | 570 s |
| IT Wizard | won | 23.1 min | 0 | 19 | 3654 ticks, hp min 135 | 0 / 0 | 521 s |

Real click on "Keep playing" returns to the Lobby, `bossDefeated` true in the save, no page error, no request beyond the file, in all three. Damage per floor (hp): FM floor 2 29, floor 4 32; SR 24 and 28; IT 10 and 9.

## Real-mouse play, floors 1 to 4 (spend mode, `r11-play.mjs <class> spend <seed> 4 manual`)

| class (seed) | end | game ticks | level | deaths | lowest hp F1 / F2 / F3 / F4 (potions used F2, F4) |
|---|---|---|---|---|---|
| FM (1) | floor 4 cleared | 29 971 | 8 | 0 | 68 / 56 / 96 / 65 (0, 3) |
| FM (2) | floor 4 cleared | 28 153 | 8 | 0 | 60 / 30 / 130 / 92 (3, 0) |
| SR (1) | floor 4 cleared | 32 047 | 8 | 0 | 49 / 44 / 50 / **2** (0, 8) |
| SR (2) | floor 4 cleared | 32 605 | 8 | 0 | 49 / 25 / 101 / 55 (3, 2) |
| IT (1) | floor 4 cleared | 29 281 | 8 | 0 | 43 / 58 / 77 / 58 (0, 5) |
| IT (2) | floor 4 cleared | 30 319 | 8 | 0 | 43 / 33 / 98 / 58 (1, 3) |

Other numbers: per run 5 to 12 pickup/equip/buy commands stay on the public input (no mouse path in this translator), 15 to 47 clicks were redirected because the dock, tracker or a toast covers the canvas point, 15 to 148 aim attempts could not select a monster at its sprite (information only; M-6 is fixed in main). Level-up, "Learned ..." and points lines all showed (3 level-ups, 5 matching toasts per run). No page error in any run. Two stalls in my own translator (a click aimed at a tile under the HUD, an unreachable straight-line target) were test bugs, fixed (elementFromPoint must be the canvas, BFS route); they are not product findings.

## Save/load and two tabs (`e2e/r11-save.mjs`, 44/46; the 2 fails are F-04)
- Per class (FM, SR, IT on https, IT on file://): level 14 with unspent points; points spent by real clicks in both panels; skill learned, skill slot assigned, aura toggled where the class has one; quests accepted, pinned, one completed; three rare pieces worn, belt, bag; stash item put by a real click in the Lobby; options changed on the real Options screen (text size, high contrast, mute, low effects, master volume, Skill 1 rebound to Z); an item held on the cursor. Write, reload, Continue: identical (points, skills, bar, respecs, options, quests, pinned, stash, belt, equipment, cursor, gold, deepest). Change then reload with no write (pagehide flush): kept. Die, respawn, write, reload: identical. 36/36.
- Two tabs: a fresh third tab sees `owner: other`; B's spent point and gold survive A's late write (`another-tab`), the stored save loads; options see F-04.
- Existing: r8t-save 60/60 (gear looks, quests, slots, belt, stash, file:// and http), r8t-states 14/14 (reload while dead, on the boss floor, on the victory screen, panels open at death).

## R8-T fix regression (all on the frozen tree)
- Death screen (N1/N2): `r11-panels` at 8 viewports and `r8t-states`/`r8t-reach`: drawers closed, no item ghost, Respawn/Restart/Quit inside the viewport at 667x375, 740x360, 844x390 and the others, held item not lost.
- Belt hint: respawn with an empty belt shows "Back in the Lobby. Your belt is empty: restock potions at the Break Room Barista." at all 8 viewports.
- Phone dock (N3): all dock buttons at least 44x44 and none off screen at 390x844, 360x640, 667x375, 844x390; M-1 see F-08.
- Landscape panels (L-1/L-055): visible height of the scrolling body (px) for Employee File / Skills / Journal; Desk Drawer fits or scrolls: 1920x1080 815 (Drawer and File fit without a scroller), 1366x768 556, 1280x720 517, 390x844 569, 360x640 365, 667x375 270, 740x360 255, 844x390 285. All at least 150 px and at least a third of the viewport height.
- Drawer at 1280x720 (R8-A1): the whole bag, row 4 bottom at y 553 and the gold line inside the viewport (drawer y 8-588); fixed. R8-A2 xptip: `elementFromPoint` returns the canvas (not blocked).
- Options bottom (U-3): last line has at least 12 px below it at all 8 viewports on the frozen tree (already satisfied in this fixture; the fixer's padding is extra).

## Already being fixed (checked against the fixers' progress files at hand-back)
- Fixed in main, not re-verified on the frozen tree: R11-01, R11-02, R11-03, R11-04, R11-05 (see F-07), R11-06 (behaviour tests), R11-07, R11-09, R11-10, M-1 (see F-08), U-1, U-2, U-3, U-4 (R11-fix-ui-progress.md); M-2, M-3, M-4, M-5, M-6 and R11-10 (R11-fix-render-progress.md).
- Not mentioned in any fix file at hand-back: R11-08 (uniqueGuard narrowing).
- My open findings F-01, F-02, F-03, F-04, F-05, F-06 are not in either file.

## Stale or failing-by-design scripts
- `r11-learn.mjs` fails by design (F-06 report); `r11-keys.mjs` 2 fails until F-05 is fixed; `r11-panels.mjs` 1 fail (M-1) on the frozen tree; `r11-save.mjs` 2 fails (F-04). Keep these out of `run-all.mjs` until fixed. `r11-play.mjs`, `r11-spam.mjs`, `r11-tabs.mjs` are measurement scripts (take 6 to 20 min each; `r11-play.mjs` also needs `PLAY_WALL_MIN` for long runs under load). Always green and cheap: none of the new ones.
- Stale fixtures: `e2e/r8t3-fix.mjs` has two `[points]` checks that R11-05 makes stale (reported by the fixer; 134/134 on the frozen tree).

## New scripts
`e2e/r11-play.mjs` and `e2e/r11-inpage.js` (real-mouse player, modes spend / nospend / nudge), `e2e/r11-spam.mjs`, `e2e/r11-save.mjs` (`TWOTAB_ONLY=1`), `e2e/r11-panels.mjs` (`SIZES=WxH,...`), `e2e/r11-keys.mjs`, `e2e/r11-learn.mjs`, `e2e/r11-tabs.mjs`.

processes: none
