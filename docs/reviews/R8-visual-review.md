# Round R8 visual review (gear-driven hero looks, geared busts, owed line, toast queue, map pins)

Date 2026-10-15. Reviewer: visual-reviewer, same 8-criterion rubric as R7b. Build `npm run build` (dist/index.html 703 KB), Playwright 1.56.1 with the preinstalled Chromium, 1x JPEG shots under 300 KB (largest 180 KB), `docs/shots/review-r8-*.jpg`. Every cited shot was opened and looked at.

Inputs and drive: F1-F4 skills, Digit1-4 potions (no negative finding rests on a key; the cast strips used F1 then a tile click). `?test=1` sets only the CSS class `noanim` (panel slides); sprite and fx animation run on the core clock, so the in-game motion strips are valid. The select-screen wrench flourish was judged on a page without test flags, frames at 80/300/600 ms. Gear was equipped through `cheat.giveItem {base, rarity, ilvl:20}` plus the `equip` input at level 20 with 16 points in each attribute (requirements). Uniques exist only for 8 bases; for other bases the cheat rolls a rare, so unique looks were checked on hard-hat, blazer, sneakers, extinguisher-club, keyboard-sword, ruler-rapier, clipboard-shield. Not judged in game: the death animation (the game-over panel covers the hero immediately in test mode); I judged it on the repo's own `r8g2-sheet-fm.jpg` death column and mark it "sheet only".

## Verdict

**PASS (iterate-light).** In game 36 / 34, UI 35 / 34 (target at least 34 met in both). The gear looks are a clear appeal gain: every one of the 21 categories reads at game scale, they sit on the class silhouettes without hiding them, and the rarity trims are distinct by shape for unique (diamonds above head and feet, thick double rim) and partly for rare. Two Medium findings are not blockers but should be fixed next round: magic versus normal is not separable without colour (G-1), and the unique body reads as a shield/box (G-2).

| Area | Appeal | Craft | R7b |
|---|---|---|---|
| G: in game | **36** | **34** | 35 / 34 |
| UI | **35** | **34** | 35 / 34 |

## Scores, item by item

| Area | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| G | 1 First impression | 5 | 5 | `review-r8-g-rarity-light.jpg`: three classes in four tiers, instantly "dressed" heroes; `review-r8-g-f3-lit.jpg` |
| G | 2 Readability | 5 | 4 | Hero is distinct from monsters in `review-r8-g-dark-combat.jpg`; categories readable (hat vs cap vs headset, board vs clipboard) in `review-r8-g-rarity-light.jpg`. Craft 4: IT hand braces cluster at the face (G-3), unique body box (G-2) |
| G | 3 Cohesion | 4 | 4 | Parts share the 1-2 px dark outline and the hero rim; trims use the same palette family as the item plates. Normal-tier sleeves and boots (FM) pick up the item colours and match the class palette |
| G | 4 Colour and contrast | 4 | 4 | Magic blue / rare yellow / unique orange are far apart in hue. Greyscale test of the 12-hero sheet: unique stays obvious (diamonds, heavy rim), rare is readable (double line on hat band, jacket hem), magic is almost the same as normal (G-1). Rarity colours are already used as plate colours elsewhere, so the player has a second cue |
| G | 5 Composition | 4 | 4 | Hero stays the focal point; two-handed weapons lean out and do not collide with the plate. In combat an enemy tinted ghost sits over the hero (`dark-combat`); known behaviour from R7b |
| G | 6 Motion | 5 | 5 | `review-r8-g-motion-fm/-sr/-it.jpg` (rows attack, cast, walk, 8 frames at 2-3 tick steps): weapon swing and raise follow the class animation, sleeves follow the body part, no part detaches or pops between frames. Death: sheet only (`r8g2-sheet-fm.jpg`), no part detaches |
| G | 7 Theme and tone | 5 | 5 | Hard hat, visor cap, headset, cardigan, loafers, binder buckler, clipboard shield: office absurdism stays on theme |
| G | 8 Polish | 4 | 3 | No clipping seen in attack, cast or walk (frames above), no errors; craft 3 because the back view of the cap is a plain flat disc and the sales-rep cap back plus quiff reads as one yellow ball (`motion-sr`, rows 2 and 3, facing away), and G-1..G-3 |
| G | Total | 36 | 34 | |
| UI | 1 First impression | 5 | 5 | `review-r8-ui-cs-d-1.jpg` (select, flourish mid-swing, sparkles), `review-r8-ui-slotcards-d.jpg` |
| UI | 2 Readability | 5 | 5 | Slot cards: the three busts differ by class and gear at 56 px, tinted frames per class (`slotcards-d/-m`). Owed line is a clear yellow-bordered row in the vendor window (`owed-d-0`, `owed-m-0`) |
| UI | 3 Cohesion | 5 | 5 | Same panel language; dock badge chips match the Skills and File chips |
| UI | 4 Colour and contrast | 4 | 4 | Rarity key in the Desk Drawer has shape glyphs (square, diamond, star, crown) next to the colours: good colour-blind practice (`owed-d-0`) |
| UI | 5 Composition | 5 | 4 | Vendor and drawer side by side at 1280 (known accepted); phone toast sits above the belt (`owed-m-0`). Craft 4: toast overlaps an item tooltip on desktop (U-2) |
| UI | 6 Motion | 4 | 4 | Wrench swing visible on a normal page (`cs-d-0` raised, `cs-d-1` down with ring and sparkles); toast queue timing verified by sampling (quest line held 4 s, then the queued refusal, duplicates merged) |
| UI | 7 Theme and tone | 5 | 5 | Memo-style owed line wording and "Equipped Clipboard Shield of the Titan." |
| UI | 8 Polish | 4 | 3 | Phone map title collides with the Map button (U-1), tree gutter (U-3), bust crops at the knees so feet gear never shows in the File (U-4) |
| UI | Total | 35 | 34 | |

## Findings (severity, concrete fix)

G-1 **Medium.** Magic and normal gear are not separable without colour. `review-r8-g-rarity-light.jpg` columns 1 and 2: the magic tier is the normal shape with a blue tint and a faint lighter trim; the greyscale of the same sheet shows both as the same value and line weight. Fix: give magic a shape cue that does not need hue, for example a single bright 1 px highlight line on the hat brim / jacket lapel / weapon edge (rare keeps its double line, unique its diamonds), and keep the colour as the second channel.
G-2 **Medium.** The unique body (Golden Parachute, blazer) is drawn as a large orange-rimmed rectangle covering the torso and reads as a tower shield, not a jacket (`rarity-light`, row 1 column 4 where no off-hand is worn at all, and rows 2 and 3 column 4). Fix: keep the torso inside the class body width, put the heavy rim on the shoulders and hem only, and leave the centre open so lapels and tie show.
G-3 **Low.** IT wizard hands (wrist brace tier normal to rare) are yellow boxes that cluster around the face in the front idle and cast poses, competing with glasses and headset (`motion-it`, row 1 frames 1-3). Fix: draw braces as a 2 px band at the wrist rather than a filled box, or drop them under the glasses layer.
G-4 **Low.** Sales rep back view: cap and quiff merge into one yellow disc (`motion-sr` rows 2-3). Fix: add the cap's back strap/seam line (a dark 1 px arc) in the back-facing cap painter.
G-5 **Low (test aid, not game).** `cheat.giveItem {rarity:"unique"}` silently returns a rare for the 17 bases without a unique, so a "unique gear" test can pass with rares. Fix: return `{ok:false, error:"no unique for this base"}` or add `fellback:true`.
G-6 **Low (carry-over N17).** The Toner Tyrant is still about the size of a manager (`review-r8-w-elite-d-crop.jpg`); crown, rim and plate carry it. Fix: sprite scale 1.1 for elites.
U-1 **Low-Medium (N16 residue).** On phone the map title now stays out of the dock, but the long floor names run under the Map button: `review-r8-w-map-elite-m.jpg` (title "Floor map: Floor 4: Open-plan floor" is cut by the button at x 340-390). The Lobby title fits (`map-lobby-m`). Fix: shorten to "Map: Floor 4" on phone, or `max-width: calc(100% - 64px)` with ellipsis.
U-2 **Low.** The toast covers the lower half of a hovered item tooltip on desktop (`review-r8-ui-owed-d-0.jpg`: "Paper Cup of Water ... Restores 15 mana" under "Slide Deck Surplus: completed ..."). Fix: hide the tooltip while a toast is up, or lift the toast above the tooltip anchor.
U-3 **Low (N12 residue).** Skill tree: tier 1 card sits at the left with an empty right half; tier 2 fills two columns (`review-r8-ui-tree-d.jpg`). Fix: centre the tier 1 card over its children or put tier 1 and 2 in a grid with equal columns.
U-4 **Low.** The Employee File bust crops at the knees, so boots (and the hands on the lower arm) never show; gear in the three-slot busts is limited to head, torso and weapon (`review-r8-ui-file-d.jpg`, `slotcards-d.jpg`). Fix: crop to the full body or add a feet inset when the player has boots.
U-5 **Low.** The phone has no Map button outside the map (dock: Inventory, File, Skills, Journal; `review-r8-ui-dock-full-m.jpg`), so the map opens only by key M. Check whether a touch route exists; if not, add the Map button back and hide it only when the title would collide.
U-6 **Info.** Entry grace: nothing visible, as intended (no banner, no flash in the first frames of `review-r8-g-f3-lit.jpg`).

## Status of the listed items

| Item | Result | Evidence |
|---|---|---|
| 21 categories readable at game scale | Pass | `rarity-light`, `motion-*`, `r8g2-sheet-fm.jpg` |
| Rarity without colour | Partial: unique pass, rare pass, magic fails (G-1) | greyscale of `rarity-light` |
| Clash with class silhouettes | Pass except G-2 (box body) and G-3 | same |
| Clipping in attack, cast, death | None found; death sheet only | `motion-*`, `r8g2-sheet-fm.jpg` |
| Geared busts: File, slot cards, class cards | Pass (U-4 crop) | `ui-file-d/-m`, `ui-slotcards-d/-m`, `ui-cs-d-1`, `ui-cs-m-it` |
| Owed line and dock badge | Pass (yellow "1" chip on Inventory, owed row in vendor and drawer) | `owed-d-0`, `owed-m-0` |
| Toast queue | Pass (sampled: 4 s hold, then refusal, duplicates merged) | sampling log, `owed-m-1` |
| Entry grace | Nothing visible | U-6 |
| Map pins badge and elite | Pass, label "Lost Staff Badge" and "The Toner Tyrant" with yellow diamond, shown once the tile is explored; the legend line does not name quest pins (Low) | `review-r8-w-pin-badge-d/-m.jpg`, `pin-elite-d.jpg` |
| Sparse floor 1 | Reads calm and clean, hero and loot stand out | `review-r8-g-rarity-light.jpg` background, first shot of floor 1 |
| N16 phone map title | Mostly fixed, residue U-1 | `map-elite-m`, `map-lobby-m` |
| N17 elite size | Open (G-6) | `elite-d-crop` |
| N12 tree gutter | Open (U-3) | `ui-tree-d` |

## Keep

- Unique tier: diamonds above head and feet plus the heavy rim read without colour (greyscale test).
- Part shapes per category (hard hat with lamp, headset ring, cap brim) and weapon leans that never hide the face.
- Slot cards and class cards that carry the gear and a class-coloured frame.
- Quest pins with text labels, and the yellow owed row with the dock chip.

Shots: `review-r8-g-rarity-light`, `-g-motion-fm/-sr/-it`, `-g-dark-combat`, `-g-f3-lit`, `-ui-file-d/-m`, `-ui-inv-d/-m`, `-ui-slotcards-d/-m`, `-ui-title-d/-m`, `-ui-cs-d-0/1/2/it`, `-ui-cs-m-0/1/2/it`, `-ui-dock-full-d/-m`, `-ui-npc-d/-m`, `-ui-owed-d-0/1`, `-ui-owed-m-0/1`, `-ui-toastq-m-0/1/2`, `-ui-tree-d`, `-w-elite-d/-m(-crop)`, `-w-map-*`, `-w-pin-*`, all `docs/shots/review-r8-*.jpg`.

```json
{"status":"ok","g_score":{"appeal":36,"craft":34},"ui_score":{"appeal":35,"craft":34},"verdict":"pass","findings":["G-1 Medium magic vs normal indistinct without colour","G-2 Medium unique body reads as shield","G-3 Low IT braces clutter face","G-4 Low SR cap back","G-5 Low cheat unique fallback silent","G-6 Low elite size (N17)","U-1 Low-Med phone map title under Map button","U-2 Low toast over tooltip","U-3 Low tree gutter (N12)","U-4 Low bust crop","U-5 Low phone has no Map button"],"processes":"none"}
```
