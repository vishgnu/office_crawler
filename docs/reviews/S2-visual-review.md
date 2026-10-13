# S2 visual review: the real build with loot, vendors, inventory and skills

Reviewer: visual-reviewer (lens: combined appeal + craft + usability). Date: 2026-10-13.
Build: `npm run build`, `dist/index.html?test=1&seed=7` (seed 5 for the champion fight: seed 7 has no champion on floors 2-5), driven through `window.__app` with the cheats and `input` commands. Chromium, manual clock.
Own screenshots (all opened with Read) in `/tmp/claude-0/vr-s2/`: 01-lobby, 02-vendor, 03-basement-a/b, 04-champ-approach, 05-champ-cast-burst, 06-champ-projectile, 07-champ-mid, 08-loot, 09-loot-ground, 09b-loot-alt, 10/10b-inv-tooltip, 10c-inv-held, 11/11b-file, 12-skills, 13-death, 14-respawn, 15-1024-inv, 15b-1024-world, 16..16d-390, 17-drag-unmet, 17c-after-equip; plus zoom crops of the HUD bar and a nameplate cluster. I also looked at the orchestrator's `docs/shots/s2-world-basement.jpg`.
Kept in `docs/shots/`: `s2-review-fight-loot.jpg`, `s2-review-inventory-compare.jpg`, `s2-review-phone-390.jpg`.
Limits: stills only (projectile and burst frames are single frames); the champion pack was a pair of demons (a champion plus one), not a full pack; the green "can equip" drop outline and the stat flash were not caught; no colour-blind simulation; no bench run.

## Scores

| # | Criterion | Score | Evidence |
|---|---|---|---|
| 1 | First impression | 4 | 01-lobby: warm violet lobby with two readable NPCs and plates, clear hero ring; 09-loot-ground: beams, rarity-framed plates and the orange "Employee of the Month" unique read as a loot game in 3 s. Not 5: fights are dark and busy (05, 07). |
| 2 | Readability | 3 | Rarity is now readable on the ground (blue magic, gold star rare, orange unique, grey common with a "-" mark: 09). But in fights the hero is hidden behind the demon sprites and two identical "Printer Demon" plates stack on one leader line (07, 08); loot labels sit under bodies and a hit burst/leader line crosses "Alert Loafers" (08 crop). |
| 3 | Cohesion | 4 | Panels (leather brown drawer header, paper Employee File, navy skills/vendor) share C2 palette, outline weight and badge style with the world; 02-vendor, 10 look like one game. Paper-white File next to a dark scene is the one loud element. |
| 4 | Colour and contrast | 4 | Tooltips and compare rows: green up / red down with arrows and words (10, 10b), unmet lines in red with a x mark. Rarity carries mark shape + border + word (rarity key, 02, 10). Weak: red-wash hurt flash turns the whole hero red on a red pool (08); small grey "Cold 50" rows and belt number badges are low contrast. |
| 5 | Composition and hierarchy | 4 | Drawers hold the sides and leave the hero and the room lit at 1280 (10, 17); the tooltip lands on the File panel, never on the hero or bottom bar. At 1024 the centre gap is only about 200 px, and the I/C/S buttons float on top of the panels (15-1024-inv). Phone tabs fix the stacked-layout problem (16b). |
| 6 | Motion and feedback | 3 | Cast ring + paper burst (05), flying stapler (06), orange 1 and white-outlined 5 hit numbers, hero hurt flash and XP chip are all present. But a damage number covers a nameplate ("nter Demon" in the world-harness shot and again behind the death overlay in 13-death) and floaters stack on loot labels (08). |
| 7 | Theme and tone | 4 | Office-dungeon voice holds: Overdue Reorg, Lukewarm Coffee, Employee of the Month, "You have been let go", probation Employee File, Desk Drawer. Original names, no genre terms seen. |
| 8 | Polish | 3 | Defects: F1-F4 and belt icons sit low and spill past the slot frames with labels truncated ("Staple...", "Coffee...": HUD crop); XP row "1,080 / 1,400 (0%)" with an empty bar; on 390 px the toast hides the Put back / Drop on floor buttons (16c) and the zone name sits under the menu buttons (16-390-world); the tooltip stays up after equipping (17c). |
| | **Total /40** | **29** | |
| | **Verdict** | **iterate** | 24-31, nothing below 3. Up one step on S1 (30 on a smaller scope) in features, but the new loot and panels bring new collision and size problems. |

## Inventory decision: the 9 must-fix items

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Tooltip never covers bottom bar or hero; anchored toward inner edge, capped, flips | Fixed | 10, 10b, 15-1024-inv: tooltip sits over the File panel's lower left, bottom bar and hero clear. Cost: it hides the stats it compares against (the +/attributes at 1024). After equipping, the tooltip lingers at the top and covers the menu buttons (17c). |
| 2 | Employee File fits at 1280x800 without scrolling for attributes, unmet list, "+" | Fixed | 11-file-points, 10c: all four "+" buttons, preview note and unmet list above the derived stats; only the last derived rows ("Cold...") clip and scroll, which the decision allows. |
| 3 | HUD badge collisions (F1-F4, belt 1-4) | Partly | HUD crop: badges now sit on the slot's top edge, clear of icons and of the rarity mark. But icons are bottom-aligned and spill below the frame (stapler on F1, coffee on F3), and skill names are cut off. |
| 4 | Cells >= 44 px desktop; 1024 usable | Partly | Measured 44 px inventory cells at 1280 and 1024. HUD skill slots are 44/35 px and belt slots 34/27 px at 1280/1024, below the rule. 1024 keeps the hero visible but the gap is narrow (15-1024-inv). |
| 5 | Drag/drop feedback | Partly | 17-drag-unmet: red dashed outline on the target slot, "Needs Level 12 (you have 7)", the source cell becomes a dimmed ghost, "In hand: Hostile Memo" plus Put back / Drop buttons. Not seen: green outline for a valid drop, the changed-stat flash on the sheet (derived stats did update live, 17c). Held item covers the slot it hovers. |
| 6 | Real game scene behind drawers, real HUD, no centre dim | Fixed | 02, 10: real lobby, lit hero and NPC, HUD below; only the panel backing is dark. |
| 7 | Keyboard, live region, contrast, I/C, Esc | Fixed | I and C toggle both drawers; `aria-live` present; Esc put the held item back (cursor null after Escape). Focus ring and tab order not inspected in stills. |
| 8 | Phone: tabs, targets >= 44 px | Partly | Gear / Employee File / Skills tabs work (16b, 16d). Cells are 33 px, HUD skill slots 26 px, belt 20 px at 390 px, all under the 44 px (50 px cell) rule. |
| 9 | Original names, no genre names | Fixed | All names seen are in-world office jokes (see 7). |

Count: fixed 5, partly 4, missing 0.

## Top 5 fixes

1. **Keep floaters, plates and loot labels apart** (13-death, `s2-world-basement.jpg`, 08 crop). A damage number sits on a nameplate ("nter Demon"), the plate leader line runs through a ground label ("Alert Loafers") and a burst covers it. Why: it is the main readability and polish defect of the new fights and loot. Change: give floaters their own lane above the plate (never overlap a plate rect), draw ground-item labels above sprites and burst fx, and route leader lines around labels.
2. **Phone sizes and toast** (16c, 16-390-world). Move the toast above the panel actions or hide it while a drawer is open; place the zone name below the menu buttons. Raise inventory cells, skill and belt slots to at least 44 px (50 px cells for the gear grid) or scroll the grid.
3. **HUD slots** (HUD crop). Centre icons inside the frame, allow two-line or shorter skill names (or the tooltip), and make desktop belt and skill slots 44 px. At 1024 let the bar wrap or scale instead of shrinking to 27 px.
4. **Fight readability in a pack** (07, 08). The hero is hidden behind the pack; identical "Printer Demon" plates stack at one x with a long leader line through the lower one. Keep the S1 fixes working on S2 sprites: fade overlapping enemies to about 60 percent, show full plates only for the target and champion, put the hero ring above enemy sprites, and soften the full-body red hurt flash to a rim flash.
5. **XP row and tooltip behaviour** (10, 11-file-points, 17c). "1,080 / 1,400 (0%)" mixes total XP with a within-level percent, so the bar looks broken; show "0 / 320 to level 8 (0%)" or fill by total. Also close the tooltip after equip/drop, and at 1024 anchor it clear of the "+" buttons (or let it follow the cursor).

## Keep

- Loot presentation: coloured beams, rarity-framed plates, the unique plate and the "-" mark on commons (09-loot-ground), kept readable by mark + border + word.
- Compare tooltip: green up / red down with arrows, "Mixed" / "Upgrade" verdict line, "you have 7, need 1 more" wording and the unmet list in the File (10, 10b, 11).
- Drawer skins and drag feedback: leather Desk Drawer header, paper Employee File, ghost + "In hand" + red reason line (10c, 17).
- Phone tabs (Gear / Employee File / Skills) and the death card with Kills / Time / Depth and "Nothing is lost" (16b, 13).

```json
{"score":29,"verdict":"iterate","mustfix":{"fixed":5,"partly":4,"missing":0},"fixes":["Keep floaters, nameplates and ground labels apart: a damage number covers a plate (nter Demon) and a burst/leader line crosses the loot label","Phone: toast hides Put back/Drop buttons and the zone name; cells 33 px and HUD slots 20-26 px are under the 44-50 px target","HUD slots: centre icons in frames, fix truncated skill names, desktop belt/skill slots 44 px, do not shrink to 27 px at 1024","Pack readability: hero buried behind demons, stacked identical plates on one leader line, whole-body red hurt flash","XP row mixes total XP with within-level percent (empty bar at 0%); close the tooltip after equip and keep it off the + buttons"]}
```
