# Round R6 visual review (in-game, character select, skill tree, slots, pause, File, toast, refund notice)

Date 2026-10-14. Reviewer: visual-reviewer, same 8-criterion rubric as `G3-visual-review.md` (1-5 each, /40 per lens). Build: `npm run build` (dist/index.html 613 KB), Playwright 1.56.1, preinstalled Chromium, `?test=1`. Input: skills cast through the hook `input {t:"cast", skill, tile}` (F1-F4 are skills, Digit1-4 belt; no key was used for a negative finding), floor entry measured with `?realtime=1`, save fixtures loaded through a seeded `localStorage` slot plus Continue. Every cited shot was opened and looked at, including all 12 `r6fix-ui` equivalents (I re-shot them as `review-r6-fx-*` and the refund and per-class tree set as `review-r6-*`). Scripts: `/tmp/claude-0/vr-r6/`. Shots: `docs/shots/review-r6-*.jpg` (all under 300 KB).

## Verdict

**PASS (gate met).** Appeal 35 and craft 34 in game; character select 35 / 34; tree, slots and pause 35 / 34 (target was at least 34 on appeal and craft). All four G3 in-game findings (N1, N3, N4, N2) and all four UI findings (N5 to N8) are fixed. What remains is small: the loot-star glyph still sits on the hero's hat when a beam is behind him, the select-screen wrench flourish is a timid ring, the tree wastes two thirds of its width on single-chain branches, and floor entry still costs roughly 30 fps for a few seconds. None needs a new variant.

| Area | Appeal | Craft | G3 (appeal/craft) |
|---|---|---|---|
| G: in game | **35** | **34** | 34 / 33 |
| Character select | **35** | **34** | 34 / 33 |
| Tree, slots, pause, File, toast, notice | **35** | **34** | 34 / 33 |

## Part 1: in game (1280x720, 1x)

Shots: `review-r6-f1-fm`, `-f1-it`, `-f5-sr`, `-f9-fm`, `-f3-it` (each with `-crop`, 420x300), `review-r6-skill-<scene>-f0..f2` (three frames per cast, under 900 ms apart; strips were assembled from them for viewing), `review-r6-entry-it-strip` (four frames within 0.4 s of entering floor 3). Scenes as in G3: level 12, 8 monsters and 8 drops near the hero, FM floors 1 and 9, IT floors 1 and 3, Sales Rep floor 5.

| # | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| 1 | First impression | 4 | 4 | `f1-fm`, `f9-fm`: lit pool, panels, windows, vending machine, plants; same crowded-by-design read as G3. |
| 2 | Readability | 5 | 5 | Every actor has a face now: Consultant with glasses (`f1-it-crop` left), bald Middle Manager (`f1-fm-crop` 205,150; `f9-fm-crop` 215,40), the hero ring and class colours read at 1x. The pale-grey figure of G3 is gone. Craft 4 to 5. |
| 3 | Cohesion | 4 | 4 | One outline weight, warm pool on 9, cool on 1, 3, 5. |
| 4 | Colour and contrast | 4 | 4 | Rarity tags blue / yellow / orange stay apart; dark suits keep their tone in cool pools (`f1-it-crop`, `f5-sr-crop`). |
| 5 | Composition and hierarchy | 5 | 4 | Loot beams now run behind the hero (`f1-it-crop`: the yellow beam ends behind the head, no stripe across the torso; `f9-fm-crop`). Appeal 4 to 5. Craft stays 4 because the rarity star at the top of the beam is still drawn over the hero (see N9). |
| 6 | Motion and feedback | 4 | 4 | Slam: flash, paper scraps and 9/13 damage numbers on frame 0, scraps gone by frame 1 (`skill-f1-fm-f0..f2`); IT cast: spark and pixel burst, target ghosts (`skill-f1-it`); Sales: card fan, a vending machine ally appears in frame 1 (`skill-f5-sr-f1`). Visible on a manual clock when frames are under 900 ms apart; the implementer's running-clock proof (`r6w-n2-slam-running.jpg`) agrees. |
| 7 | Theme and tone | 5 | 5 | Cooler, vending machine, lecterns, window skyline, floor 9 distinct (`f9-fm`). |
| 8 | Polish | 4 | 4 | No tag touches a head in the five scenes ("Mandatory Reorg" in `f9-fm` is now clear of the Middle Manager; "Printer Imp" plate beside the head in all four). Remaining: N9, N10. |
| | **Total /40** | **35** | **34** | |

### Floor entry (known: about 3 s of 20 to 30 fps)

Measured with `?realtime=1`, rAF deltas after `teleportFloor(3)`, loaded machine (load average 3), once per class. Idle steady state on floor 1 before the teleport: 21 ms average, 33 ms worst. After entry: first 0.5 s worst frame 83 / 117 / 83 ms (FM / IT / Sales), then 25 to 37 ms average with frequent 50 ms frames for about 5 s (so a mean of 29 to 33 fps, not recovering inside 5 s on this machine). In the four-frame strip taken in the first 0.4 s (`review-r6-entry-it-strip.jpg`) every frame is complete and correct (floor, hero, a monster walking in, no pop-in or black frame); the cost is a single 80 to 120 ms hitch and a slightly uneven cadence, noticeable as mild stutter only in motion, not in stills. Logged as N11 (low).

### Previous findings (G3 numbering): status

- N1 pale Consultant and bald figure: **fixed.** All actors show a face, none are washed (`f1-it`, `f5-sr`, `f1-fm` crops). Faded-because-in-front-of-hero actors are still translucent grey by design (`f5-sr-crop` centre, `skill-f1-fm` left ghosts); readable, but see N10.
- N2 slam lifetime: **closed, not a defect** (wall-clock effect lifetime; frames under 900 ms apart show it).
- N3 beams through the hero: **fixed** (see criterion 5).
- N4 tag edge on a head: **fixed** in all five scenes.
- G2 #8 loot near plants: no beam beside a plant in `f1-it` or `f9-fm`; the logged 3 % cramped-corner case is core's and not visible here.
- R6-perf (mask fast path): **invisible**, as intended. I saw no seam, flicker or shifted lighting in 15 stills and 12 cast frames; the darkness edge in `f1-fm` and `f9-fm` is smooth.

### New findings (Part 1)

N9. **Low.** The beam's rarity star is drawn on top of the hero when the beam is behind him. Where: `review-r6-f9-fm-crop.jpg` (150,57, a yellow star on the hard hat); also `skill-f9-fm`. The beam itself is correctly behind him, the star glyph is not. Fix: include the glyph in the same hero-redraw (or skip glyphs whose box overlaps the hero rect and draw them above his head instead).
N10. **Low.** Actors faded for standing in front of the hero look like pale ghosts, especially in a crowd (`f5-sr-crop` centre Consultant; `skill-f1-fm-f1` two white figures left). Fix: fade to about 60 % alpha without the white lift, or fade only the part that overlaps the hero.
N11. **Low.** Floor entry: one 80 to 120 ms hitch then about 30 fps for 5 s (measured above). Fix: if warm-up cannot go below the frame budget, spread it over more frames (about 1 ms a frame) or render the first frame behind the existing floor title card.

### Keep

- Beams behind the hero, hero keep-out for tags, head keep-out.
- Faces on every actor in every facing; class colour blocks.
- Slam flash, scraps and big damage numbers; sales vending ally readable.

## Part 2: character select, skill tree, slots, pause, File, toast, notices

Shots: select `review-r6-ui-cs-d-*` (1280x720), `cs-m-*` (390x844), `cs-d-slam-1..3`; tree `review-r6-ui-tree-8-d`, `-8-d-bottom`, `-20-d`, `-20-d-mid`, `-8-m`, `-20-m-mid`, per-class `review-r6-tree-it-wizard-d/-m(-mid)`, `tree-sales-rep-d/-m(-mid)`; respec `review-r6-ui-respec-d/-m`; slots `review-r6-ui-slots-d-five(-bottom)`, `slots-m-five(-bottom)`; pause `review-r6-ui-pause-banners-d/-m`, `pause-takeover-d/-m`; File `review-r6-fx-file-d-*`, `file-m-*`, `review-r6-refundfile-it-d`; toast `review-r6-fx-toast-d/-m`; refund notice `review-r6-refund-it-d`, `refund-sales-m` and the other classes.

| # | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| 1 | First impression | 5 | 5 | `cs-d-facilities-manager`: lobby, spotlight, bigger figures; File panel is paper-styled and reads as a document (`fx-file-d-facilities-manager`). |
| 2 | Readability | 5 | 5 | Figures grew (about 0.62 of stage): the unchosen IT Wizard face is now about 70 px (`cs-d-sales-rep`, was 45). Tree: tier labels, "Needs: Pallet Slam", "Locked, Needs character level 16" in yellow (`tree-8-d-bottom`). Craft 4 to 5. |
| 3 | Cohesion | 4 | 4 | Same palette; File paper card is a deliberate contrast. |
| 4 | Colour and contrast | 4 | 4 | Per-class accent in chips, bars, Start; the disabled Start is now neutral indigo on every class (`cs-d-*`), no brown. Learned = teal edge, available = yellow edge, locked = dashed; distinguishable but yellow and teal are close in value. |
| 5 | Composition and hierarchy | 5 | 4 | Panel stable across classes; five slots fit at 720 with the footer and Close visible (`slots-d-five`); pause title visible in the worst case (below). Tree uses a left-heavy grid (N12). |
| 6 | Motion | 3 | 3 | The FM flourish exists but is timid: a gold ring and four sparkles at the foot, the wrench does not visibly swing (`cs-d-slam-1..3`, 300/80/80 ms after the click; body shift of a few px). Cone and ring follow the selection. |
| 7 | Theme | 5 | 5 | Elevator, skyline, "CONFIDENTIAL, FLOOR 0", Employee File as a paper form. |
| 8 | Polish | 4 | 4 | N5 to N8 fixed (below); no clipping found at 720 or 390; N12, N13 remain. |
| | **Total /40** | **35** | **34** | Scoring the three sub-areas the same: select 35 / 34; tree, slots, pause, File 35 / 34. |

Phone (390x844): select fits in one screen with chips, 2x2 stat grid and Start visible (`cs-m-*`); slots scroll with Close pinned (`slots-m-five-bottom`); the tree is a single column with "Needs" text instead of connectors (`tree-20-m-mid`), fine and consistent.

### Previous findings: status

- N5 Close clipped in the slot manager at 720: **fixed.** `slots-d-five`: five cards, footer row with storage text and Close at y 647, fully inside; phone keeps Close pinned while cards scroll.
- N6 pause take-over pushes "Paused" off the top: **fixed.** `pause-takeover-d`: title at y 40 to 80, three banners collapsed to one line each, confirm card, all four buttons inside 720; `pause-takeover-m`: title at y 100, buttons inside 844. Banner text hides while confirming (N7 fixed).
- N7 duplicate banner text with the confirm: **fixed** (`pause-takeover-*`, titles only).
- N8 tree tier-2 card offset and cut: **fixed.** Elbow connectors link tier cards (`tree-8-d`, `tree-20-d-mid`), fixed three-column grid, the cut Learn button is now reachable by scroll. A row split across the panel bottom is still cut mid-card (expected for a scroller).
- 13 unchosen figures small: **fixed.**
- 14 tree is a card list: **fixed** (connectors, tiers, Needs, lock reason).
- 15 tabs differ desktop and phone: **documented** in the code (R6-ui progress), not visible as a defect.
- 17 dull disabled Start: **fixed.**
- Motion (wrench flourish): **partly**, see criterion 6.

New R6 items, checked:
- Respec dialog (`respec-d`, `respec-m`): inline card, yellow border, title "Reset all skills?", "You get 5 skill points back", primary "Reset, get 5 back" in the accent yellow, Cancel; focus lands on Cancel, Tab stays inside, Esc closes the card first (implementer's checks, reproduced in my run of their script). Clear and safe. Wording: "Your skills go back to the signature skill only" is accurate.
- Employee File power attribute: the power attribute carries the effect text ("Focus: raises damage and mana"; Grit for IT: "needed by some gear; no damage for your class"; Sales Agility: "raises damage and defense and aim"), plus a live preview line ("Focus 20 to 21: +2 Max Mana"). Consistent across `fx-file-d-it-wizard`, `fx-file-m-sales-rep`. The preview "Grit 16 to 17: Same stats." on FM reads oddly for the power stat but is correct for an unused attribute; see N13.
- Cast-refused toast (`fx-toast-d`, `-m`): "Pick a direction or a target first." appears centred above the hotbar, same style as the other toasts, readable. It does not name the skill (N13).
- Refund notice (`refund-it-d`, `refund-sales-m`, loaded from `save-v2-r5-it/-sales`): yellow banner under "Paused", names the attribute ("scales from Focus", "from Agility"), Dismiss button, text wraps cleanly at 390; File then shows 65 points to spend and the preview hint. Clear.

### New findings (Part 2)

N12. **Low.** Skill tree wastes width on single-chain branches: Maintenance, Safety and the Sales branches sit in the left column with two thirds of the panel empty (`tree-8-d`, `tree-20-d-mid`, `tree-sales-rep-d-mid`), so a 14-point character scrolls through about 5 screens. Fix: centre a single-column branch, or let tier 2 and 3 cards sit in the same column when the branch is a chain (keep the connectors vertical).
N13. **Low.** Micro-copy: the toast does not say which skill was refused; the FM Grit preview says "Same stats." on a power stat for no gain. Fix: "Dolly Charge: pick a direction or a target first."; show "no effect" wording only for non-power attributes.
N14. **Low.** The select-screen wrench flourish is too small to read at a glance. Fix: scale the ring to the figure's shadow, add a one-frame wrench swing (rotate about 20 degrees) and a 3-frame screen shake of 2 px.
N15. **Low.** A "Learned ..." toast stays over the hotbar while the tree is open on phone and desktop (`respec-m`, `tree-20-d`), partly covering the F1-F4 labels on phone. Fix: dismiss toasts when a panel opens, or move them above the belt on phone.

### Keep
- Stable select panel, accent per class, bigger figures.
- Pause and slot layouts at 720 and 390, collapsed banners during confirm.
- Tree connectors with Needs and lock reasons; respec confirm.
- Refund notice naming the attribute.

## Gate

Pass. Both areas reach appeal 35 and craft 34 (target 34). N9 to N15 are low and may ride into the next round; none blocks a customer view. The customer-proxy acceptance can continue.

```json
{"verdict":"pass","g_score":{"appeal":35,"craft":34},"charselect_score":{"appeal":35,"craft":34},"ui_score":{"appeal":35,"craft":34}}
```
