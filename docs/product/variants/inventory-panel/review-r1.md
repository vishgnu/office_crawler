# Visual and usability review r1: inventory panel variants (A, B, C)

Reviewer: visual-reviewer, combined lens (appeal/genre feel plus usability/readability/accessibility). Date: 2026-10-13.
Evidence: own Playwright shots at 1280x800 in `/tmp/claude-0/vr-inv/` (`<V>-both`, `<V>-hover-keycard|opener|vest`, `<V>-drag`, `<V>-afterdrop`; drag = Reorg Letter Opener dragged onto the weapon slot, swap on drop), plus the shipped phone shot for C and the HUD reference `docs/shots/s1-polish-fight.jpg`. Not seen: the slide animation in C and the tab switch in B (static frames only), so motion is scored on drag/drop feedback only.

## Scores (1-5, /40)
| | A Classic split | B Briefcase | C Side drawer |
|---|---|---|---|
| 1 First impression | 4 | 5 | 4 |
| 2 Readability | 5 | 3 | 4 |
| 3 Cohesion | 4 | 5 | 4 |
| 4 Colour/contrast | 4 | 4 | 4 |
| 5 Composition/hierarchy | 3 | 2 | 5 |
| 6 Motion/feedback | 3 | 3 | 3 |
| 7 Theme/tone | 4 | 5 | 4 |
| 8 Polish | 3 | 4 | 3 |
| **Total** | **30** | **31** | **31** |
| Verdict | iterate | iterate | iterate |

Evidence, one line each:
- A: both panels at 44 px cells, attributes next to derived stats, unmet-gear list, stamp and rarity key all visible without scrolling (A-both). Readability 5. Composition 3: the whole game is dimmed and the two plates fill the screen. The tooltip lands on the Employee File and hides exactly the Damage/Defense/Attack speed rows an equip would change (A-hover-opener, A-hover-keycard).
- B: strongest object and theme (leather, stitching, clasps, folder tabs; B-both) and the biggest cells (50 px). But Gear and Employee File are never on screen together, so an equip changes stats you cannot see, and a stat point cannot be checked against item requirements without a tab switch. Tooltip covers neighbouring grid items (B-hover-keycard). The game is fully hidden. Readability 3 and composition 2 are for usability, not for looks.
- C: the only variant where the centre of the play area stays visible and lit (C-both, C-drag). 38 px cells and a scrolling Employee File (the "Gear you cannot use yet" list is cut off at the bottom, C-both). Tooltip opens toward the centre and covers the game and the belt/skill bar (C-hover-keycard, C-hover-vest). The mock game scene behind is a grey placeholder (grey figures, no C2 grade), so fit with the real HUD is judged on layout only.

All three share defects (shot evidence in every `-both` image): see fix 3 below. Rarity is carried by mark shape, border style and word, and the key is in the panel (good, meets NFR-A03). Tooltip text is legible at 13-14 px bright-on-dark in all three.

## Usability and genre feel
- Compare and equip speed: identical in the core loop for all three (hover shows "Compared with equipped" with green up / red down numeric deltas and a one-line verdict "Upgrade: better in every changed stat" / "Downgrade", C-hover-vest; drag onto slot swaps and the old item sticks to the cursor, C-afterdrop). The difference is context. A and C show the sheet live while you do it (afterdrop: Damage 10-18 to 14-23, Health 160 to 167 visible at once in C-afterdrop). B hides that feedback.
- Genre ("stay close to the original"): the original is a left sheet plus right inventory, both open, game visible behind. A and C match this; C matches it best because the game is not blanked. B departs from the mechanic (tabs) in exchange for the best fit to phone.
- HUD fit (s1-polish-fight): the HUD is dark, sparse, hero centred, mug and jug in the corners. C keeps the hero and the fight in the clear middle ~480 px and reads as the same game. A and B cover the hero. Risk for C at the 1024 px minimum (NFR-B02): the two drawers plus the 480 px centre will not fit, so the drawers must narrow or overlap the centre at that width.
- Does the game pause? The brief does not say. If it does not (hack-and-slash with up to 50 monsters), hiding the arena (A, B) is a gameplay hazard, which favours C.

## Ranking and pick
1. **C Side drawer** (31, tie-break on usability: only variant with the play area visible, both panels open, genre-closest).
2. **B Briefcase** (31, best appeal and theme, loses on usability; keep its art and phone model).
3. **A Classic split** (30, best readability, but it blanks the game and its tooltip hides the stats it compares).
Raw scores of B and C are tied; the pick rests on the usability and genre findings, not on looks. If the customer rates "moody, themed" over "see the fight while managing gear", B is the alternative, not A.

## Top 5 fixes for C
1. **Tooltip placement** (C-hover-keycard, C-hover-vest). It sits in the centre and covers the player's view and the belt/skill bar. Anchor it to the item beside the drawer, flip to stay inside the drawer's own strip when possible, and never cover the bottom bar; cap its height. Option: pin the comparison block to the drawer edge so it does not follow the cursor.
2. **Employee File scrolls** (C-both: unmet-gear list cut off, only the first entry visible). Make attributes + derived stats + unmet-gear fit at 800 px: two-column derived stats already exist; drop the portrait row to a single line, shrink the stamp, or move "Gear you cannot use yet" above the derived stats (it is the actionable part) and let the stats scroll instead. Keep the "+" targets reachable without scrolling.
3. **Fix the shared HUD bar collisions** (all `-both` shots): the F1-F4 and belt 1-4 number badges overlap the icon corners and the rarity mark of the potion in belt slots 1 and 2 (the little square mark and the "1"/"2" badge collide). Move the badge outside the slot corner or inset the icon; this is open must-fix 10 of the art direction.
4. **Cell size 38 px to 44 px minimum** (C-both vs A-both). Small hit targets for 1x3 and 2x4 items and for the "!" unmet marker (which is tiny at 38 px). Reclaim width by dropping the long rarity key to the A-style one-line key with the word next to the mark, and by making the doll slots less wide. Also check NFR-B02 at 1024 px as noted above.
5. **Drag/drop feedback** (C-drag, C-afterdrop). While dragging, the dragged item sits on top of the equipped item and hides it; the swapped item then floats over the doll with no label. Add a green or red outline on the target slot plus a one-line reason ("Needs Level 8"), keep the equipped item visible as a dimmed ghost, and show the stat delta on the sheet (flash the changed derived stat rows, e.g. Damage 10-18 to 14-23 in green) so the player sees the benefit without hunting. Also use a clearer held-item style so the swapped item is obviously "in hand".

## What to borrow
- From A: the sheet layout (attributes beside derived stats, unmet-gear list, stat preview note) and 44 px cells; the one-glance density with no scrolling. Also the inline rarity key with the word, as in A-both.
- From B: the leather/stitching theme as a skin option (or a title strip on each drawer), the 50 px cells for the phone layout, and the tab model for the phone only (single column, one tab at a time), since the stacked phone layout of C (C-390x844-phone) has the Employee File half hidden below the fold.
- From B and A: "Upgrade: better in every changed stat" verdict line (already shared, keep), the "(you have 7, need 1 more)" wording on unmet lines.

## What works (keep)
- Numeric compare block with arrows and colour plus the verdict sentence (all variants).
- Rarity by mark + border style + word + colour, with the key inside the panel.
- The paper Employee File with the probation stamp and the parchment sheet: strong contrast with the dark plates and carries the office tone.

## Machine-readable result
```json
{"ranking":["C","B","A"],"scores":{"A":30,"B":31,"C":31},"pick":"C","fixes":["Move the tooltip so it never covers the bottom bar and keep it inside the drawer strip or beside the item, cap its height","Make the Employee File fit at 800 px: unmet-gear list above derived stats, compact header, no scrolling for attributes","Fix shared HUD bar number badges overlapping slot icons and belt potion marks","Raise cells from 38 to 44 px minimum and check the 1024 px layout","Add drag/drop target feedback with reason text, keep the equipped item visible while dragging, flash changed stats on the sheet"],"borrow":["A: sheet layout and 44 px cells","B: leather theme skin, 50 px cells and tab model for phone","A/B/C shared: keep the compare block with the verdict line and the rarity key inside the panel"]}
```
