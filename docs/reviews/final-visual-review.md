# Final visual review: whole game (title to victory)

Reviewer: visual-reviewer (lens: combined appeal + craft + usability). Date: 2026-10-14.
Build: `play/index.html?test=1&seed=11`, Chromium via Playwright, driven through `window.__app` (cheats, `ui.open`, `options`, `save`). All shots in `/tmp/claude-0/vr-final/` were opened with Read.
Journey seen: 01-title, 02-lobby, 03-vendor, 04..06 floor 1 fight and ground loot, 07/08/08c inventory and compare tooltip, 11-f5 (basement, consultants, slide projectiles), 15-f2-champ-0..6 (Armored Printer Demon), 16-18 floor 8 (locked start, "floor is clear" toast, lift marker), 20-25 boss (arena, slam telegraph, phase 2 summons, volley, victory), 30-33 options and HC + text 1.5 play, 40-* at 1024x768, 50-* at 390x844 (dpr 2).
Kept: `docs/shots/final-lobby.jpg`, `final-inventory-compare.jpg`, `final-champion-fight.jpg`, `final-boss-phase2.jpg`.

Limits (honest): stills only. Seed 11 has **no champion on floor 5**; the only champion in floors 1-8 is on floor 2, so "champions" were judged there and floor 5 was judged for the basement look and projectiles. Floor 8 was cleared by an auto-driver (level 30, geared) and the boss was beaten in 25 s with HP topped up, so this review says nothing about difficulty. No colour-blind simulation, no audio, no bench run.

## Scores

| # | Criterion | S1 | S2 | Final | Evidence |
|---|---|---|---|---|---|
| 1 | First impression | 4 | 4 | 4 | 02-lobby: warm violet lobby, two plated NPCs, lit hero, mug and jug HUD: reads as a game in 3 s. The title (01-title) is the weak spot: a dark text card on a near-black scene, no hero or art. |
| 2 | Readability | 4 | 3 | 3 | Rarity and loot colours are good (08, 06). But the basement is very dark and monsters outside the light become see-through silhouettes (11-f5-fight, 11-f5-proj-1); in melee the hero is hidden behind the boss and staff (21, 23-boss-p2-volley); floor-1 loot labels pile on the hero's head and chest (06-f1-loot-ground, 17-f8-cleared). |
| 3 | Cohesion | 4 | 4 | 4 | World, plates, drawers, boss bar, victory card share outline weight and palette; arena (20) is a distinct but matching theme. Options and the title card are plain system UI, a step down from the drawers. |
| 4 | Colour and contrast | 4 | 4 | 4 | Compare tooltip (08) uses green/red plus arrows and words; champion plate (15-f2-champ-6) is a red-bordered pill with "Armored". High contrast makes the HUD crisp (33-hc-fight). Minus: basement value range, "-" common labels are low contrast, and the HC active button bug below. |
| 5 | Composition and hierarchy | 4 | 4 | 4 | Drawers leave the hero lit at 1280 and 1024 (07, 40-1024-inventory); phone has tabs and fits the tooltip (50-390-*). Boss bar with a phase tick and "Phase 2" label is clear (21, 23). At text 1.5 the menu stack grows and the tooltip runs off the bottom (33-hc-inv-tooltip). |
| 6 | Motion and feedback | 3 | 3 | 4 | Dashed orange slam circle with hero X mark and the toast "raises a binder. Move!" (21); fan of slides (23-boss-p2-volley); toner orb with ground shadow (15-f2-champ-6); confetti victory (25). Damage numbers no longer sit on plates in the shots I took. Slam telegraph whites out the boss sprite, which is dramatic but removes the figure. |
| 7 | Theme and tone | 4 | 4 | 5 | "Promoted to Nowhere", "Colleagues let go", "Staff are called into the room", Overdue Agenda, Redundant Backlog, executive suite with trophies and city windows. Consistently original and funny. |
| 8 | Polish | 3 | 3 | 3 | Options with high contrast and text 1.5: the open menu button turns white and its label vanishes (31/33-hc-inventory: "Inventory", "File"); Employee File runs labels together ("Experience0 / 506", "ATTRIBUTESPoints to spend") and the compare tooltip is cut at the bottom of the screen, hiding the verdict line (33-hc-inv-tooltip). F1-F4 skill bar is empty at level 6 with "Skills 5" waiting (04, 33). Starting weapon sits unequipped in the bag, so the first compare says "Nothing equipped" (08, 08c needed a manual equip). Renderer crash seen twice (below). |
| | **Total /40** | 30 | 29 | **31** | |
| | **Verdict** | | iterate | **iterate** | 24-31, no item below 3. One point short of ship (32). |

Delta vs S2: **+2** (29 to 31): motion and feedback up (boss telegraphs, projectiles, victory) and theme up (full story arc). Readability and polish did not move.

## Crash seen (needs a look, severity unknown)
Twice in my driven runs the game showed the "Something went wrong" card: `drawImpact` threw `arc/ellipse radius is negative` (`src/render/fx.js` around line 527). The cause is `k = (now - im.born) / im.life` going negative when an impact is born with `performance.now()` inside a test-hook `step()` and drawn in a later rAF frame with an earlier timestamp. It happens only when the hook steps ticks between frames, and did not happen when I interleaved frames normally, so it is probably test-mode only, but a real player on a throttled tab might hit it. I worked around it by wrapping `requestAnimationFrame` in my harness. Fix: clamp `k` to 0..1 in `drawImpact` (and the other fx draws).

## Top 5 fixes (most impactful first)
1. **High contrast / big text bugs** (31, 33-hc-inventory, 33-hc-file, 33-hc-inv-tooltip). Open-state menu buttons are white on white; Employee File labels collide at 1.5; the tooltip overflows the bottom. Why: this is the accessibility path and it breaks on first use. Change: give the active state a dark label (or a yellow outline, not white fill), add spacing and flex-wrap to File rows, cap tooltip height to the viewport and scroll or flip it upward.
2. **Equip the starting weapon and fill the skill bar.** The hero starts with the Ruler Rapier in the bag, nothing equipped, F1 empty, and levels bring "25 points" badges with no guidance. Why: the first 5 minutes feel unfinished and the first compare is meaningless. Change: start with the rapier equipped and "Strike" on F1; pulse the File and Skills buttons once on the first level.
3. **Basement visibility** (11-f5-fight, 11-f5-proj-1, 18). Raise ambient floor/wall value outside the light, and keep monsters opaque (or outline-only) beyond the light edge instead of ghosting; stop the hero turning into a back-of-head silhouette. Why: floors 5-8 are most of the game.
4. **Loot label pile-up** (06-f1-loot-ground, 17-f8-cleared). Stack labels in a column with a minimum gap and hide common ("-") labels unless hovered or Alt held; keep them off the hero's body. Why: after any fight the hero is hidden under text.
5. **Title and first screen** (01-title). Put the hero and a lit lobby slice behind the card (or an art banner) and give the card the drawer styling; show a one-line goal ("Reach the executive suite"). Also clamp fx `k` (crash above) so a hidden-tab frame cannot end a run.

## Keep
- The lobby and boss arena lighting and the C2 look (final-lobby, 20-boss-arena-enter).
- Compare tooltip with arrows, verdict and unmet requirements (final-inventory-compare), and the phone tab layout (50-390-*).
- Boss readability: dashed slam circle, toast warnings, phase-marked bar, summons, and the "Promoted to Nowhere" victory card with stats.
- Champion plates and toner projectile reading (final-champion-fight).

## What a first-time player would notice in the first 5 minutes
The title card is plain, but "New game" drops you in a lovely violet lobby: a headset clerk, a supplies vendor and a first aider with name plates, a lift with a green arrow. It looks good immediately. Then the friction starts. Nobody tells you the goal. Your bar is empty, the rapier in your drawer is not equipped, and clicking an NPC walks you over rather than opening anything until you arrive. Floor 1 is the best part: teal offices, red-glowing printer imps, orange hit numbers, loot beams in blue, gold and orange with distinct shapes. A fight against four monsters is readable and satisfying until the drops land: labels stack over your own head and you start clicking on text. Opening the Desk Drawer is a delight (compare tooltip, "Upgrade: better in every changed stat") but you quickly meet "you cannot use this yet" gates, and your skill points and attribute badges (25, 5) pile up with no prompt. By floor 3-5 the dark basement makes monsters ghostly, and you lose track of the hero behind walls. If they try high contrast and big text, the menu buttons go blank when opened. It is charming, funny and mostly clear, but it still feels like a polished build with a few unfinished first-run and accessibility edges.

```json
{"score":31,"verdict":"iterate","delta_vs_S2":"+2","fixes":["High contrast and text 1.5: open menu buttons turn white-on-white (label invisible), Employee File labels run together, compare tooltip overflows the viewport","Start with the rapier equipped and Strike on F1; prompt the first level-up points (25 file / 5 skill badges with an empty bar)","Basement visibility: raise ambient value, keep monsters opaque outside the light, keep the hero legible","Loot labels pile on the hero after fights: stack with min gap, hide common labels until hover","Title screen is a bare dark card; add hero/lobby art and a goal line; clamp fx k in drawImpact (negative-radius crash seen under stepped frames)"]}
```
