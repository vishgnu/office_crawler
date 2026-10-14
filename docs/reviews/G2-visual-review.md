# Round G2 visual review (in-game gate re-review, plus character select, skill tree, save slots)

Date 2026-10-14. Reviewer: visual-reviewer. Build from `npm run build` (dist/index.html 577 KB), Playwright 1.56.1 + bundled Chromium, `?test=1`, via `window.__app` (character.create for each class, floors 1, 3, 5, 9, level 12, 8 monsters + 7 loot drops, attack, skill key F1, panels). 1280x720 full frames and 1x crops. Every cited shot was opened and looked at. Scratch scripts: `/tmp/claude-0/vr-g3/`.

Shots (`docs/shots/`): `review-g2-f1-fm`, `-f1-it`, `-f5-sr`, `-f9-fm`, `-f3-it` (each with `-crop`, 420x300 at 1x around the hero), `review-g2-calm-fm`, `review-g2-heroes-1x` (3 frames x 3 classes + FM on floor 5), `review-g2-skills-1x` (4 frames x 3 classes), `review-g2-cs-d-*`, `review-g2-cs-m-*`, `review-g2-title-*`, `review-g2-tree-d/m/it`, `review-g2-slots-d/m`.

## Part 1: Round G gate (in game)

Verdict: **iterate (narrow)**. Both lenses are up but short of the 34 target. Appeal **33/40** (was 32), craft **32/40** (was 31). The remaining gap is the same cluster as before (washed actors, label placement), plus one new visible defect (a loot tag over the hero). It needs one small fix pass, no new variants.

### Scores

| # | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| 1 | First impression | 4 | 4 | `calm-fm`: lit teal pool, wall panels, desks, plants, hero in hard hat and vest, red demon halo. Reads as a finished room in 3 s. |
| 2 | Readability | 5 | 4 | `heroes-1x`: all three classes identifiable at 1x at ~110 px (hard hat + wrench, headset + pink suit + card, hood + glowing laptop). Hero ring is clear. Craft docks it for pale/washed enemies (`f1-fm`, `f5-sr`). |
| 3 | Cohesion | 4 | 4 | One outline weight and palette on all four floors; actors take pool colour (`f9-fm` warm, `f5-sr` cool). |
| 4 | Colour and contrast | 4 | 4 | AMBIENT_LIFT shows panels and floor weave outside the pool. But additive pool wash pushes pale and dark actors toward white (`f1-fm`: the two blank pale figures at x 500-560; `skills-1x` rows 1-3: Middle Manager is grey-teal, not dark suit). |
| 5 | Composition and hierarchy | 4 | 4 | Hero, then monsters, then loot. HUD small and out of the way. |
| 6 | Motion and feedback | 3 | 3 | Idle bob and steam read in `heroes-1x` (frame-to-frame shift of hero and light). F1 skill use in `skills-1x` shows no visible effect in my 4 frames at 1x (hero stays in walk pose); I could not confirm skill VFX, no credit. |
| 7 | Theme and tone | 5 | 5 | Water cooler, copier, vending machine, lecterns, window panes; floor 9 clearly different (`f9-fm`). |
| 8 | Polish | 4 | 4 | Fewer collisions than round 1 (see below), but a loot tag sits on the hero and nameplate lines still cross bodies. |
| | **Total /40** | **33** | **32** | |

Rubric verdict (>=32, no item below 3) is "ship" for both, but the round's own gate (target 34, under 33 means another fix pass) says **iterate**.

### Previous findings: status

Fixed (seen in game at 1x):
- Hero and zombie flat blocks, small faces (appeal #1): now 2-tone, larger faces, class-specific colour blocks (`heroes-1x`, `f1-fm-crop`). Class sprites match the identities in the character-select decision. Fixed.
- Pool colour on actors plus coloured ground shadow (appeal #2): visible, warm on floor 9, cool on 3 and 5. Fixed.
- Actor-versus-wall clipping (appeal #4, g-fix wall ghost): the server rack in `f5-sr` fades where it overlaps actors; no clipped zombie at a wall in any of my five scenes. Fixed.
- HP-bar stacking: bars of rear enemies are small pips above heads and no longer sit on shins (`f1-fm`, `f9-fm`). Mostly fixed.
- Red vending machine now blue (`f3-it`: blue vending machine distinct from the red demon). Fixed.
- Tag overlaps: in my 5 busy scenes, tag-on-tag touch only once (`f1-fm`: "Padded Cardigan..." touches "Mandatory Reorg"); round 1 counted 9. Loot tags are mostly vertically fanned. Largely fixed.
- Secondary motion: bob visible across frames. Partly fixed (tie sway too small to see).

Still open:
- Additive pool wash on dark monsters (known). `f1-fm`, `f5-sr`: faceless pale figures; `skills-1x`: manager washed grey. Hero also washes toward white in a cyan pool (IT wizard face and Sales Rep in `heroes-1x` rows 2-3 lose saturation).
- Nameplate body avoidance (known). `f1-fm`, `f1-it`, `f3-it`: "Printer Imp" plate leader line runs straight through the imp's body.
- Horizontal loot-tag nudge (known). `f1-fm`: "Padded Cardigan of the Hazmat Drill" and "Mandatory Reorg" abut, and "Mandatory Reorg" sits over the hero's hard hat (see new defect).
- FM face eye-band (known). `heroes-1x` FM: visor/eye band reads as a dark bar; the face loses the eyes at 1x.
- Loot spawn near props: `f9-fm` "Pink Slip" tag sits on the plant; `f1-it` the plant still stands beside a loot beam. Partly fixed.

### Numbered findings (Part 1)

1. **Major.** Loot tag covers the hero. Where: `review-g2-f1-fm.jpg` (651, 299): "Mandatory Reorg" is drawn over the hero's hard hat. Breaks the round-1 rule that no label covers the hero. Fix: add hero body rect (feet to head, ~50x95 px) as a keep-out for tag placement, same as for damage numbers; push the tag up or sideways until clear.
2. **Major.** Pool wash on actors (known). Where: `f1-fm` pale figures, `skills-1x` manager. Fix: clamp the pool addition on actors (multiply tint 15-25% only, no additive term above ~0.25 of the actor's own luminance), or exclude actors from the additive pass and keep only the multiply tint. Dark suits (manager, auditor) must stay darker than the floor in the pool.
3. **Medium.** Nameplate lines cross bodies (known). Where: `f1-fm`, `f3-it`, `f1-it` "Printer Imp". Fix: draw the plate to the side of the head (offset by body half width) or drop the leader line when the plate is within 40 px of the target; keep plate-to-body overlap at 0.
4. **Medium.** Horizontal loot-tag nudge (known). Where: `f1-fm` top-right pair. Fix: when two tags overlap in x within 14 px of y, nudge the later by its own width + 6 px, not only vertically.
5. **Medium.** FM eye band (known). Where: `heroes-1x` rows 1 and 4. Fix: lighten the visor/eye band one step and add two 2-3 px pupils so the face reads at 1x.
6. **Medium.** Skill-use feedback not visible at 1x. Where: `skills-1x`, F1 at frame 2: no slam ring, spark or cone, hero stays in walk pose. Fix: verify the effect plays on key press in the test hook path (may be a timing artefact of `step`); if real, add a 2-frame ring/arc at skill cast.
7. **Low.** Tie sway and breathing too small to read in stills; keep, but raise amplitude 1.5x or add one more cue (e.g. mug steam on the hero is not needed, rack LEDs are fine).
8. **Low.** Loot beam spawns near plants and racks (`f9-fm`, `f1-it`): extend the existing +1000 penalty from tall props to 1-tile radius around plants.

### Keep
- Class sprites with per-class colour blocks and props (wrench, card, glowing laptop).
- Demon red halo and blue vending machine.
- AMBIENT_LIFT at 0.12; pools still clearly brighter.
- Floor identity (teal office, concrete basement, burgundy suite).

## Part 2: Character select, skill tree, save slots (R5)

Compared with the picked variant A "Lobby lineup" (`variants/character-select/A.html`, `shots/A-1280-facilities-flourish.jpg`) and its decision.

Scores: **appeal 33/40, craft 30/40** (character select alone: appeal 34, craft 32; tree and slots pull craft down). Verdict for this screen set: **iterate** (small fixes, no re-design).

| Criterion | Appeal | Craft | Evidence |
|---|---|---|---|
| First impression | 5 | 5 | `cs-d-default`: lobby, window skyline, spotlight cone, ringed hero, accent colour follows class. Matches A. |
| Readability | 4 | 4 | Name, class chips and stats clear; unchosen classes now bright with rim light (decision must-fix 2 done). |
| Cohesion | 4 | 4 | Same outline and palette as the game; figures reuse in-world sprites. |
| Colour and contrast | 4 | 4 | Accent per class on chips, bars and Start (`cs-d-it-wizard` cyan, `cs-d-named` pink/yellow). Disabled Start is a dim brown with hint "Type a name to start" in yellow: legible. |
| Composition | 4 | 3 | Stage and panel balanced; but the panel changes height by class (name field jumps from y 453 to 478 between FM and Sales Rep/IT), so Start moves under the cursor. |
| Motion | 3 | 3 | Cone and ring follow selection; flourish from mock-up (wrench sparkle) not seen. |
| Theme | 5 | 5 | Elevator, skyline, "CONFIDENTIAL, FLOOR 0". |
| Polish | 4 | 2 | See findings below. |
| **Total** | **33** | **30** | |

Compared with A: layout, ring, cone, chips, borrowed stats bars and "SKILL BRANCHES" all present. Differences: figures are smaller and simpler than the mock (IT Wizard is ~90 px against ~190 px for the mock; at 1280x720 the unchosen two are quite small); no wrench flourish; stats are Health/Mana/Damage/Agility instead of the mock's four; no difficulty badge (the mock had one, fine to drop).

### Numbered findings (Part 2)

9. **Must fix, high.** Tree/skills panel header icon is a blank cream rectangle (`tree-d`, `tree-it`, `tree-m`, top left next to "Skills"). Looks like a missing icon. Fix: use the skills branch icon or a book/tree glyph from `icons.js`.
10. **Must fix, medium.** "CONFIDENTIAL, FLOOR 0" micro-copy runs underneath the Facilities Manager chip and is cut by it (`cs-d-default`, bottom left; also in `cs-d-it-wizard`, `cs-d-named`). Fix: move it to bottom-right of the stage or above the chips, or hide it when it would collide; keep at least 12 px gap.
11. **Must fix, medium.** Skill branch descriptions are clipped in the info panel at 1280x720 for FM: "Evacuation Drill," ends mid-line, "Traffic Cone Wall" cut by the Character Name block (`cs-d-default`). Fix: allow the branch list to take 2 lines max with ellipsis, or reduce the first-line copy; do not let a later block cover it.
12. **Must fix, medium.** Info panel height depends on class text length, so the name field, Start and Load buttons move between classes (`cs-d-default` vs `cs-d-it-wizard` vs `cs-d-named`: name label y 453 vs 453 vs 478). Fix: fix the info block height (min-height for the longest class) so the form stays in place.
13. **Medium.** Unchosen figures small, the IT Wizard especially (`cs-d-default`). Decision's "figures feedback" asks for readable classes; at 1280x720 the IT Wizard face is about 40 px. Fix: scale stage figures to a common height ~ 70% of the stage for the unchosen, ~100% for the chosen, and use the larger bust art.
14. **Medium, tree.** Skills panel is a card list, not a tree: no connectors between tiers, large help text and the "Basic attack: Strike" card take ~40% of the height at 1280x720, so only one branch tier is visible without scrolling (`tree-d`). Phone (`tree-m`): one skill card visible, the hotbar overlaps the panel bottom. Fix: collapse the help text to one line (tooltip or "?"), put the Strike card in a single row, draw tier connector lines, and keep the panel above the hotbar on phone.
15. **Low, tree.** Desktop panel has no Gear / File / Skills tabs while phone does (`tree-d` vs `tree-m`); intentional? Mention in notes or align.
16. **Low, slots.** On 1280x720 slots 4 and 5 are below the fold (`slots-d`); on phone Slot 2's action row wraps into three lines with disabled buttons taking space (`slots-m`). Fix: hide disabled actions for the playing slot instead of greying them, and trim the header gap so all five slots fit at 720 or add a visible scroll hint. Otherwise clear: class portrait, "PLAYING NOW" badge, accent border, gold primary Load.
17. **Low.** Disabled Start has a dull brown/dark-pink fill that looks muddy against the accent (`cs-d-default`, `cs-m-sales-rep`); use the accent at ~40% opacity with a lighter label (the decision asked for exactly that).

Phone (`cs-m-default`, `cs-m-sales-rep`): fits 390x844 without scroll, chips ~50 px high, stage small but figures still recognisable. Good; this is better than the desktop panel on information fit (skill list omitted, branches icons only).

## Gate verdict

**ITERATE.** Game: appeal 33, craft 32 (target 34). Must-fix before re-gate: findings 1, 2, 3, 4 (labels and wash), then 9, 10, 11, 12 on the new screens. Everything else can ride along. No new variants needed.

```json
{"status":"done","g_score":{"appeal":33,"craft":32},"charselect_score":{"appeal":33,"craft":30},"verdict":"iterate"}
```
