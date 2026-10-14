# Round G3 visual gate (in-game, character select, tree, slots, save banner)

Date 2026-10-14. Reviewer: visual-reviewer (same rubric as `G2-visual-review.md`, 8 criteria, 1-5 each, /40 per lens). Build: `npm run build` (dist/index.html 593 KB), Playwright 1.56.1 with the preinstalled Chromium, `?test=1`, state set up through `window.__app`. Skills cast through the hook input `{t:"cast", skill, tile}` (the key map is F1-F4 select the right-mouse skill; Digit1 is a belt slot; F1 with no hover tile is rejected for area skills). Every cited shot was opened and looked at. Scratch scripts: `/tmp/claude-0/vr-g4/`. Shots: `docs/shots/review-g3-*.jpg` (all under 300 KB).

## Verdict

**ITERATE (narrow).** Appeal reaches the 34 target in both areas; craft is 33 in both, one point short. The Round G fixes landed: the loot tag no longer covers the hero, tags do not touch each other, leader lines stay off bodies, dark actors keep their faces in the pool, the character-select panel stopped jumping, the icon and label defects are gone. What keeps craft at 33 is a short list of small items (slam VFX lifetime, a Close button clipped at 720, the take-over dialog pushing the "Paused" title off the top at 720, the tree still a card list). None needs a new variant. If the owner accepts 33 as the floor (the round's own rule said "under 33 = another pass"), the gate can pass with these logged as known.

| Area | Appeal | Craft | G2 (appeal/craft) |
|---|---|---|---|
| G: in game | **34** | **33** | 33 / 32 |
| Character select, tree, slots, banners | **34** | **33** | 33 / 30 |

## Part 1: in game (1280x720, 1x)

Shots: `review-g3-f1-fm`, `-f1-it`, `-f5-sr`, `-f9-fm`, `-f3-it` (each with `-crop`, 420x300 at 1x around the hero), `review-g3-skills-f1-fm/-f1-it/-f5-sr` (3 frames after a real cast), `review-g3-slam-1x` (Pallet Slam, 6 frames at 1x). Each scene: level 12, 7 to 8 monsters near the hero, 8 loot drops, one monster attacked. Floors 1, 3, 5, 9, one per class where it shows best (FM floors 1 and 9, IT floors 1 and 3, Sales Rep floor 5).

| # | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| 1 | First impression | 4 | 4 | `f1-fm`, `f9-fm`: lit pool, wall panels, windows, vending machine, plants; hero readable in 3 s. The scenes are crowded by design (8 monsters in one pool). |
| 2 | Readability | 5 | 4 | Hero ring plus class colour blocks read at 1x in every crop. Dark suits (the Middle Manager in `f9-fm-crop`, the Auditor in `f1-it-crop`) now keep faces and stay darker than the floor. Craft: the Consultant on cool pools (`f1-it`, `f5-sr`, left) is still a pale, low-contrast grey figure, and the bald figure in `f1-fm` (535,380) shows no face. |
| 3 | Cohesion | 4 | 4 | One outline weight and palette across floors 1, 3, 5, 9; pool colour reads on actors (warm on 9, cool on 1, 3, 5). |
| 4 | Colour and contrast | 4 | 4 | Rarity tags blue / yellow / orange stay distinct; the blue vending machine is clearly not a red demon (`f5-sr`). Pool wash no longer bleaches dark actors; pale ones are still bright. |
| 5 | Composition and hierarchy | 4 | 4 | Hero, then monsters, then loot, then HUD. Loot beams still pass through the hero body (`f1-it`: yellow beam at x 640, "Final Audit" tag under the feet). |
| 6 | Motion and feedback | 4 | 4 | Pallet Slam now shows at 1x: white flash, thick ring, crack lines, dust and paper scraps (`slam-1x` frame 1, `skills-f1-fm` frame 1). IT and Sales casts show spark and paper bursts and the targets turn white (`skills-f1-it`, `skills-f5-sr`). Caveat: in my manual-clock capture the slam was gone one tick (about 120 ms) later (`slam-1x` frames 2-6), though the code says 900 ms; I could not confirm the life on a running clock, so craft stays at 4, not 5. |
| 7 | Theme and tone | 5 | 5 | Water cooler, vending machine, lecterns, window skyline; floor 9 distinct (`f9-fm`). |
| 8 | Polish | 4 | 4 | The G2 defects are fixed (below). Remaining: one tag edge touches a head (`f9-fm`: "Mandatory Reorg" brushes the Middle Manager's head, see crop), beams through the hero. |
| | **Total /40** | **34** | **33** | Craft is 32 + 1: motion rose from 3 to 4 on the slam. |

### Previous findings (G2 numbering): status

1. Loot tag over the hero: **fixed.** In all five scenes, 8 drops each, no tag touches the hero (`f1-fm`: "Padded Cardigan..." sits right of the wrench with a clear gap, "Mandatory Reorg" below it; before it was on the hard hat).
2. Pool wash on actors: **fixed for dark actors, remaining for pale ones.** Managers and auditors keep faces and suits; the Consultant stays pale grey (new item N1).
3. Nameplate lines through bodies: **fixed.** "Printer Imp" plates in `f1-fm`, `f1-it`, `f3-it`, `f5-sr` have the line running beside or above the head; nothing crosses the imp's body.
4. Horizontal tag abutting: **fixed.** In `f1-fm` the "Padded Cardigan" and "Mandatory Reorg" tags are separated by about 10 px; no tag touches another in any scene.
5. FM eye band: **fixed.** `g3-fm-face-1x` and the FM in `slam-1x` show white eyes with pupils under a thin brim; the face reads at 1x.
6. Skill feedback not visible: **fixed (root cause was the reviewer's key).** Slam, overheat and stapler-throw all show a visible effect on the first frames after the cast. Lifetime caveat above.
7. Tie sway and breathing: not re-tested in stills; low, ignored.
8. Loot spawn near plants: **improved.** `f1-it` plant has no beam beside it; `f9-fm` "Pink Slip" drop is clear of the plant. Not fully proven (8 drops, 5 scenes).

### New findings (Part 1)

N1. **Medium.** Pale Consultant (and bald figure) on lit floors. Where: `review-g3-f1-it.jpg` (410, 330), `f5-sr` (410, 330), `f1-fm` (535, 380). Looks washed and faceless next to the saturated hero. Fix: darken the Consultant's base tone one step or give it a suit colour block; ensure the face is drawn in every facing; the 72 % actor redraw should multiply, not lighten, for luminance above ~0.75.
N2. **Low.** Slam lifetime in the test clock. Where: `review-g3-slam-1x.jpg`, frames 2-6 show nothing. Fix: confirm the effect uses the same clock as the render loop (900 ms of render time) and add a regression check that `efx` is non-empty at +300 ms; if it is a test-clock artefact, no change.
N3. **Low.** Loot beam passes through the hero body. Where: `f1-it` x 640. Fix: draw beams of drops within 1 tile of the hero behind the hero sprite, or fade them under the hero's keep-out rect.
N4. **Low.** One tag edge nicks a head. Where: `f9-fm-crop` top ("Mandatory Reorg" vs the Middle Manager's head). Fix: treat the nameplate head rect (not only the body rect) as a keep-out, with 4 px padding.

### Keep
- Hero keep-out for loot tags and the sideways slide for crowded drops.
- Slam flash, ring and paper scraps; FM face; class colour blocks.
- Leader line avoidance, plates beside heads.

## Part 2: character select, skill tree, slots, save banners

Shots: `review-g3-cs-d-facilities-manager/-sales-rep/-it-wizard/-named` (1280x720), `review-g3-cs-m-*` and `cs-m-all` (390x844, the three classes in one strip), `tree-d`, `tree-m`, `slots-d-five`, `slots-m-five` (five real characters, none deleted), `slots-d-notice`, `slots-d-takeover`, `slots-m-notice`, `slots-m-takeover`, `title-d`, `title-m`, `title-banner-other-d/-m`, `pause-banners-d/-m`, `pause-takeover-d/-m`.

| # | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| 1 | First impression | 5 | 5 | `cs-d-facilities-manager`: lobby, skyline, spotlight cone, ringed hero, accent per class. |
| 2 | Readability | 5 | 4 | Stats bars, branch icons with names and skill lists, hint "Type a name to start" all legible at 720 and 390. Craft: unchosen figures still small (IT Wizard about 45 px face at 720). |
| 3 | Cohesion | 4 | 4 | Same outline and palette as the game; accent follows class in chips, bars, Start. |
| 4 | Colour and contrast | 4 | 4 | Per-class accent works (`cs-d-it-wizard`, `cs-d-sales-rep`); disabled Start is now accent-tinted but still dull on FM (brown). |
| 5 | Composition and hierarchy | 4 | 4 | The panel is stable: the name label is at y 453 for all three classes (was 453 / 453 / 478), Start does not move. |
| 6 | Motion | 3 | 3 | Cone and ring follow selection (seen in three class shots); the mock-up's wrench flourish is still not there; not judgeable from stills beyond that. |
| 7 | Theme | 5 | 5 | Elevator, skyline, "CONFIDENTIAL, FLOOR 0", slots with class portraits. |
| 8 | Polish | 4 | 4 | Fixed: header icon, micro-copy, clipped branch copy, jumping panel. Open: items N5 to N8 below. |
| | **Total /40** | **34** | **33** | |

Phone: all three classes fit 390x844 with no scroll, chips about 50 px, stats in a 2x2 grid, hint visible (`cs-m-all`). Better than desktop on information fit.

### Previous findings: status

9. Tree header icon blank: **fixed.** `tree-d`/`tree-m` show the class helmet icon; branch icon beside "Maintenance".
10. "CONFIDENTIAL, FLOOR 0" under the chip: **fixed.** Now top-left under the lobby clock, clear of the chips (`cs-d-*`).
11. Clipped branch descriptions: **fixed.** All three branches show their full skill lists in 4 lines (FM, IT, Sales).
12. Panel height jumps by class: **fixed** (see criterion 5).
13. Unchosen figures small: **remaining.** Same scale as G2 (`cs-d-it-wizard`: the chosen IT Wizard is bigger, the unchosen two are about 70 % height).
14. Tree is a card list: **partly fixed.** The Strike card is one row and the help text is two lines (`tree-d`), the panel no longer sits under the hotbar on phone (`tree-m`). Still no tier connectors, only tier 1 and half of tier 2 visible at 720, and the tier-2 card is offset to the right with its Learn button cut by the panel bottom.
15. Gear / File / Skills tabs differ between desktop and phone: **remaining**, intentional or not, not noted in the UI notes.
16. Slots below the fold: **fixed for the cards.** Five cards fit at 720 (`slots-d-five`), phone shows three and a half with a scroll (`slots-m-five`), action rows no longer wrap to three lines. Disabled actions are still shown greyed for the playing slot (`slots-d-notice`). New: Close is cut at the bottom (N5).
17. Dull disabled Start: **mostly fixed.** Accent-tinted on IT and Sales, still brownish on FM at 720.

### New findings (Part 2)

N5. **Medium.** Slot manager with five characters at 720: the Close button is clipped at the bottom edge (`review-g3-slots-d-five.jpg`, y 700). Fix: shrink the five-card stack by 12-16 px (card padding 8 to 6, or remove the "Last played" line gap), or make the footer sticky.
N6. **Medium, confirms the known issue.** At 720 the take-over dialog pushes the title out of the top of the screen. It is not on the title screen: `title-banner-other-d` fits (banner under the tagline, title at y 82, whole panel inside the viewport). It happens on the pause screen when the owner banner is open with a confirm: `review-g3-pause-takeover-d.jpg` shows "Paused" at y -34, cut in half, and "Quit to title" at the bottom edge cut. This is the worst case (three banners plus the confirm; one banner alone fits, `pause-banners-d`). On phone it overflows by 17 px (`pause-takeover-m`, scrollHeight 861 over 844), title at y -17. Fix: make the pause container `align-content: start; overflow-y: auto` instead of vertically centred, so overflow runs downward and scrolls; or render the confirm as a modal over the screen (as the slots view does in `slots-d-takeover`, which scrolls correctly).
N7. **Low.** Slots view with banners and a confirm (`slots-d-takeover`): the five slots are pushed below the fold; fine because it scrolls, but the banner text duplicates the confirm text. Fix: collapse the "Another session" line to its title while the confirm is open.
N8. **Low.** Tree tier-2 card offset and cut (`tree-d`, "Floor Buffer Sweep", Learn button under the panel edge). Fix: tier connector lines plus a fixed column grid; keep the panel scrollable with a visible fade at the bottom.

## Gate

Iterate (narrow): craft 33 in both areas, target 34. Fixes that move craft to 34: Part 1 N1, N3, N4 (one point on polish or readability) and Part 2 N5, N6 (one point on polish). N2, N7, N8 can ride along. No new variants.

```json
{"verdict":"iterate","g_score":{"appeal":34,"craft":33},"charselect_score":{"appeal":34,"craft":33}}
```
