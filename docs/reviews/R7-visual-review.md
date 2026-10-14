# Round R7 visual review (quests: journal, tracker, dock badge, NPC dialogue, toasts, markers, map, elite)

Date 2026-10-14. Reviewer: visual-reviewer, same 8-criterion rubric as `R6-visual-review.md` (1-5 each, /40 per lens). Build: `npm run build` (dist/index.html 667 KB), Playwright 1.56.1, preinstalled Chromium, `?test=1`. Staging through `window.__app` (`quests.accept/handIn/setStep/pin`, `cheat.completeQuest`, `cheat.teleportFloor/setLevel/giveItem`, clicks on NPC tiles). Inputs: skills F1-F4, potions Digit1-4 (no key was needed for a negative finding; panels opened with `ui.open`, dialogs by clicking the NPC tile). Viewports 1280x720 and 390x844; "light game" was read as the Reduced-effects option (`lowFx`) and reduced motion set together (`review-r7-light-rm-*`). Every cited shot was opened and looked at, including the implementer shots `r7w-elite`, `r7w-map-marker`, `r7w-npc-handin`, `r7fix-ui-toast-1/2`, `r74-ui-journal-locked-m`. Scripts: `/tmp/claude-0/vr-r7/`. My shots: `docs/shots/review-r7-*.jpg` (all under 300 KB, full frames at 1x; `-crop` files are 1x crops).

## Verdict

**ITERATE (narrow).** Appeal holds at 35 in both areas, the quest layer reads well and is on-theme. Craft falls short of the 34 target: in game 33 (new overlaps on the elite plate and an NPC marker/plate collision on phone, R6 N9 and N10 still open), UI 32 (the phone dock overflows the screen when badges are wide, the tracker pill covers the Skills panel, phone toasts sit on the potion belt). All findings are small CSS or layout fixes; none needs a new variant. R6 low items: N9, N10, N12, N14 still open, N11 not re-measured, N13 and N15 partly.

| Area | Appeal | Craft | R6 (appeal/craft) |
|---|---|---|---|
| G: in game (incl. markers, quest item sign, elite plate, map pin) | **35** | **33** | 35 / 34 |
| UI (journal, tracker, dock, NPC windows, toasts, slot card, pause) | **35** | **32** | 35 / 34 |

## Part 1: in game (1280x720 and 390x844)

Shots: `lobby-avail-d/-m`, `lobby-handin-d/-m`, `tracker-d/-m`, `elite-d` (+`elite-crop`), `elite-m`, `quest-item-d` (+`quest-item-crop`), `quest-item-m`, `map-pin-d`, `map-elite-d/-m`, `n-f9-fm(-crop)`, `n-f5-sr(-crop)`, `n-f1-fm(-crop)`, `light-rm-lobby-d/-m`, `light-rm-floor-d/-m`; implementer `r7w-elite`, `r7w-npc-available`, `r7w-npc-handin`, `r7w-map-marker`, `r7w-quest-item`.

| # | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| 1 | First impression | 4 | 4 | `lobby-avail-d`: lit lobby, two NPCs with yellow discs, tracker under the minimap; calm and legible. Floor 4 (`quest-item-d`) is as atmospheric as R6. |
| 2 | Readability | 5 | 4 | Markers: yellow disc "!" (offer) against blue diamond "?" (hand in) differ in shape and colour, readable at 1x on the NPC (`lobby-handin-d`, `r7w-npc-handin`). "Lost Staff Badge" sign: yellow warning triangle with label, beam, instantly found on a dark floor (`quest-item-crop`). Elite: pink rim and a pink-bordered "The Toner Tyrant" plate separate it from other plates (`elite-crop`). Craft 4: the elite is only distinct by rim and plate, not by size (it looks like a Middle Manager), and in `elite-crop` loot tags ("Revised Fiasco", "Mop Halberd...") sit on its face (G1). |
| 3 | Cohesion | 5 | 5 | New glyphs use the existing outline weight, the same plate chrome and palette (yellow = quest, pink = elite). |
| 4 | Colour and contrast | 4 | 4 | Yellow offer vs blue hand-in works without colour too (shape). Map pin is a small white triangle on the checker floor, low contrast (`map-pin-d` 681,241); the yellow pin in `r7w-map-marker` is better. |
| 5 | Composition and hierarchy | 4 | 3 | The tracker pill duplicates the toast text on screen at once (`tracker-d`: pill and toast both "Why the Lights Went Out: Follow..."). On phone the "!" disc lands on the "Office Supplies" plate (G2). Elite plate is detached from its body by a 120 px stem (`elite-crop`). |
| 6 | Motion and feedback | 4 | 4 | Quest complete: level-up ring, sparkles and a beam on the hero with the "completed (80 gold, 110 experience)" toast (`journal-alldone-d`). Under reduced motion and Reduced effects the lobby, floor and markers still render cleanly (`light-rm-*`, no errors). |
| 7 | Theme and tone | 5 | 5 | "Intern Overflow", "Lost Staff Badge", "The Toner Tyrant", sign-in sheet and memo copy are in the register of the game. |
| 8 | Polish | 5 | 4 | Craft 4 only because of G1 to G3 and N9, N10 below. |
| | **Total /40** | **35** | **33** | |

### New findings (Part 1)

G1. **Medium.** Elite readability in a loot-strewn room. Where: `review-r7-elite-crop.jpg` (205,215): the Tyrant's face is under the rarity tag "Revised Fiasco" and its star, the plate stem runs 120 px down from the plate (pushed up by the hero keep-out) so the plate looks unattached, and a crate icon is drawn over the plate ("The" and a box glyph; also `elite-m` 205,342 where it cuts the word "Toner"). Fix: draw props and crate glyphs under plates (plates last), keep the stem short by moving the plate sideways instead of up, and give the quest elite a larger sprite scale (about 1.15) or a crown glyph so it is distinct before the plate is readable.
G2. **Low.** Phone: the NPC offer marker overlaps the plate. Where: `review-r7-toast-accept-m` crop (110,100 in the 1x crop of 100,300,300,480): the "!" disc sits on "Supplies". In `lobby-avail-m` the disc is above the plate, so the order flips when the hero stands beside the NPC. Fix: pin the marker above the plate top at a fixed offset regardless of plate nudging.
G3. **Low.** Floor map legend and world marker leak. Where: `review-r7-map-pin-d` (first run) and `r7w-map-marker` (400,14): the legend line is partly behind the belt at 720 high, and an NPC "!" is visible through the map title. Fix: raise the legend inside the map card; hide world markers while the map is open.
G4. **Low.** The map shows no pin for the quest elite or badge (`map-elite-d`: only a white stairs triangle), so the objective cannot be found on the map. Fix: draw the yellow pin for the pinned quest's target when its floor is current.

## Part 2: UI (journal, dock, tracker, dialogue, toasts, slot card, pause)

Shots: journal `journal-d/-m`, `journal-rich-d/-m`, `-bottom`, `journal-arc2-m`, `journal-alldone-d/-m`, `light-rm-journal-d/-m`; dialogue `dial-vendor-d/-m`, `dial-ready-d/-m`, `dial-handedin-d/-m`, `dial-stash-d/-m`, `dial-healer-d/-m`, `bagfull-d/-m`; `toast-accept-d/-m`; `slotcard-d/-m`; `pause-d/-m`; dock `n-dock-badges-m`; implementer `r7-ui-*`, `r74-ui-*`, `r7fix-ui-*`.

| # | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| 1 | First impression | 5 | 5 | `journal-rich-d`: card list with state chips, a pinned main quest outlined in yellow, "Next step" and "Reward" labels; looks like the rest of the game's panels. |
| 2 | Readability | 5 | 4 | Offer and ready cards in the NPC window have a state chip, quote, reward text and a yellow primary button (`dial-vendor-d`, `dial-ready-d`: the ready card is outlined and its Hand in is focused). Two quests on the vendor stack cleanly (`dial-vendor-m`). Bag-full is a red alert box above Hand in with the same text as the toast (`bagfull-d`). Craft 4: after focus the window scrolls past the NPC's greeting, so the first line is cut at the top (`dial-vendor-d` 12,87). |
| 3 | Cohesion | 5 | 5 | Journal, dialogue, slot card and pause entry reuse panel header, chip and button styles; locked arcs are dashed like locked skills (`journal-rich-bottom-d`, `r74-ui-journal-locked-m`). |
| 4 | Colour and contrast | 4 | 4 | Yellow chip = ready, plain chip = available/active, red box = refusal. The "Locked" copy is bold white on dashed card and reads. Journal dock badge "!" is yellow on indigo, legible (`dial-ready-d`). |
| 5 | Composition and hierarchy | 5 | 3 | The tracker pill is drawn above wide left panels: with Skills open it covers the F2-F4 "Assign to" buttons (`n-tree-d` 350,185, see U2). On phone the toast covers the potion belt (U3). |
| 6 | Motion/feedback | 4 | 4 | Toast lane holds the quest line first and the level-up line after (`r7fix-ui-toast-1`, `-2`, both opened: single line, no overlap, 4 s apart). Slot card, accept and hand-in respond immediately. |
| 7 | Theme | 5 | 5 | Journal copy, "Read the memo · 1/5" on the slot card (`slotcard-d`, yellow line under the class line), pause entry "Journal" between Resume and Save slots (`pause-d`). |
| 8 | Polish | 4 | 3 | U1 to U3. |
| | **Total /40** | **35** | **32** | |

### New findings (Part 2)

U1. **Medium.** Phone dock overflows. Where: `review-r7-n-dock-badges-m.jpg` (390 wide, level 30, one quest ready): "Inventory" is cut at the left edge ("nventory", button x -16 to 77); at 360 wide it starts at -46. The numeric badges (File 145, Skills 29) plus the Journal "!" make the row wider than the screen. At level 1 (`dock-lvl1`) it fits. Fix: cap badge text at "99+", shrink padding below 400 px, or wrap the dock to two rows; never let the first button start left of 8 px.
U2. **Medium.** Tracker pill covers panel content on desktop. Where: `review-r7-n-tree-d.jpg` (350-680,185): the pill sits over the Skills panel (476 px wide), hiding the F2, F3, F4 assign buttons of the basic-attack row. It is also squeezed ("Take the lif...") next to the dock when the NPC window and bag are open (`dial-vendor-d` 350,185). Fix: hide the tracker (or move it under the minimap with a max width equal to the minimap) while a left panel is open, or place the pill below the panel's width.
U3. **Medium.** Phone toasts sit on the potion belt and hotbar. Where: all phone shots with a toast (`bagfull-m`, `journal-rich-m`, `toast-accept-m`): a three to four line toast (the hand-in text is 5 lines in `dial-handedin-m`) covers belt slots 1 to 4 and the top of the hotbar; R6 N15 is the same defect and it is worse with the longer quest toasts. Fix: on phone put the toast at the top under the dock (single line, truncated with the full text in `#live`), or limit the text to the first clause.
U4. **Low.** Desktop toasts overlap the bag's bottom row when the vendor window is open (`bagfull-d` 345,540 over the Desk Drawer grid). Fix: centre the toast on the free play area between the two panels, or move up 60 px while two panels are open.
U5. **Low.** Duplicate message: the tracker pill and the accept/step toast say the same sentence at the same time (`tracker-d`), and the bag-full alert repeats in a toast (`bagfull-d`). Fix: suppress the toast when the text equals the pill or the visible alert.
U6. **Low.** The NPC window scrolls past its opening quote when focus moves to Accept (`dial-vendor-d`, `dial-ready-d`, `dial-stash-d` 12,87). Fix: focus without scrolling (`preventScroll`) when the quote is above the fold, or keep the quote sticky.

## R6 low items

- N9 (rarity star on the hero's hat): **still open.** `n-f9-fm-crop` (150,57): a yellow star sits on the hard hat.
- N10 (pale ghosts for actors in front of the hero): **still open.** `n-f5-sr-crop` (265,130): the Consultant is a bright blue-grey ghost.
- N11 (floor entry cost): **not re-measured** (round targeted quests); no change seen in shots.
- N12 (tree wastes width): **still open.** `n-tree-d`: Maintenance chain in the left column, two thirds empty.
- N13 (micro-copy): **not checked in game** (needs the refused-cast and Grit preview); not seen again.
- N14 (select wrench flourish): **still open.** `n-cs-0`, `n-cs-1` (300 and 80 ms after click): ring and cone only, no swing.
- N15 (toast over the belt on phone): **still open, now larger** (U3). In `n-tree-m` no toast was on screen when the tree was open, so the "toast while a panel is open" case did not reproduce, but phone toasts still cover the belt in every other panel.

## Keep

- Disc "!" versus diamond "?" markers, and the hand-in "?" turning the dock Journal button into a badge.
- Journal card states: pinned outline, "Next step / Reward" labels, dashed locked arcs.
- Offer and ready cards with a single primary button and the red bag-full alert.
- Quest item sign (triangle, label, beam) and the pink elite plate.
- Quest toast lane (quest line first, level-up after).

## Gate

Not yet at target: both areas hold appeal 35, craft is 33 and 32 (target 34). Fix G1, U1, U2, U3 (about a day) and re-shoot; G2 to G4, U4 to U6 and the open R6 lows can ride.

```json
{"verdict":"iterate","g_score":{"appeal":35,"craft":33},"ui_score":{"appeal":35,"craft":32}}
```
