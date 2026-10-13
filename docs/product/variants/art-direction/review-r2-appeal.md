# Review r2: player appeal and genre feel (C2)

Reviewer: visual-reviewer (lens: would a player say "this looks nice", does it feel like the moody genre classic in an office).
Looked at `shots/r2/C2-desk-f30`, `C2-desk-f92`, `C2-desk-f150`, `C2-phone-f92` and compared with `shots/r1/C-desk-f92`.
Measured fps (headless software GL, from notes.md, not re-measured by me): C2 about 54, C 29.
Verdict rule: ship >= 32 with nothing below 3, iterate 24-31, rework < 24.

## Scores

| # | Criterion | C r1 | C2 | Evidence |
|---|---|---|---|---|
| 1 | First impression | 5 | 5 | C2-desk-f30: dark room, red and cyan pools, glowing rim rings, coffee-mug and water-cooler globes. Moody and funny in under 3 s; clearly more "this is a dungeon" than r1. |
| 2 | Readability | 5 | 4 | Monsters pop thanks to the rim rings (demon red, zombie lime, manager amber). Loot plates no longer fight the characters. Loses a point: in all three desk frames the zombie stands in front of the hero's legs and torso, and the hero's face is a small dark blob (dark hair, dark glasses); the dim floor hides paper debris. |
| 3 | Cohesion | 4 | 4 | Outline weight, shade steps and rim logic are consistent, and the mug/jug HUD matches the office theme. But actors are cel-lit (drawn after the darkness) so they do not take the red/green/cyan pools. The Middle Manager is fully bright while the room around him is dark: slightly "sticker on a dark background". |
| 4 | Colour and contrast | 4 | 4 | Indigo, teal and warm accents survive the grade. Rare (lime-gold star, yellow ring) vs Unique (vermillion hexagon, orange ring, serif italic) now separate by lightness, not only hue. Health red vs mana blue read by glyph, number and liquid pattern. Floor tile lines near the edges are very dark. |
| 5 | Composition and hierarchy | 4 | 4 | Eye goes to the hero/zombie fight, then the Manager. Loot plates are smaller and placed apart (f30), nameplates sit above heads, none overlap. The large globes (about 150 px) take both bottom corners but leave the play area free. |
| 6 | Motion and feedback | 5 | 4 | f92: "63" is now beside the target, clear of the nameplate (fixed), with a paper burst. But the number is smaller and less punchy than r1's, sits on the sword hand, and I see no obvious zombie flash or recoil. The slash arc is still faint. f30 to f150 shows the cooldown counter 4, 3, 2 and the demon moving, so there is life. |
| 7 | Theme and tone | 3 | 4 | The gap is mostly closed: real darkness, vignette, red emergency tint on the demon side, cold pool by the fluorescent, blood decals. Still friendlier than menacing because the monsters are bright and cartoony. That fits "stay close to the feel, not the look". |
| 8 | Polish | 4 | 4 | Clean text and no label collisions on desktop. Phone: the Manager's body is clipped by the right edge, the top third is empty dark, and the label markers are about 12 px. The skill bar is tidy (badges outside the icons, names under them). |
| | **Total /40** | **34** | **33** | |
| | **Verdict** | | **ship** (>= 32, nothing below 3), with the fixes below going into the style port | |

The total is one point under r1 because r1 got a 5 for readability and motion on a bright, uncrowded frame. C2 pays a small readability and hit-punch price for the darker grade, and buys 1 point on tone. The tone item was the one the decision said to fix, so this is the intended trade.

## Must-fix check (decision.md items 1 to 12)

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Damage number clear of nameplate and head | Fixed | f92: "63" is right of the zombie's head, Zombie Intern plate is under its feet, nothing covered. Nameplate fade during the hit is not visible and not needed now. |
| 2 | Hero separates from the Zombie | Fixed | Hero is larger, white shirt, royal-blue suit, yellow tie and cyan lanyard, near-white rim; the zombie is darker green with a ragged hem and a lime rim. They still overlap in the frame and the hero's face is weak (see fix 1). |
| 3 | Label clutter | Fixed | Loot plates about 60% size, leader lines, nothing overlaps another label or the fluorescent in f30/f92/f150. Hover/Alt full-text behaviour cannot be judged from a still. |
| 4 | Manager's head attached | Partly | Head now sits on the collar and is slightly smaller, but it is still an orange ball on a wide suit with no neck; it reads as a mascot head. Acceptable as comedy, not resolved. |
| 5 | Tone / grade / light / decals | Fixed | f30: dark falloff, red pool left, cold pool by the fluorescent, cyan monitor glow, blood stains under the demon and zombie. Walls and floor still read inside the hero radius. |
| 6 | Health/mana without hue | Fixed | Mug with heart glyph and bubbles, jug with drop glyph and ripples, `173/240` and `66/120` numbers. Notes report deuteranopia/protanopia simulation. |
| 7 | Rare vs Unique | Fixed | Star on lime-gold/yellow vs hexagon on vermillion with notched border and serif italic; notes give dE 30 (deuteranopia) and 49 (protanopia). Markers in the plates are about 12 px, below the 16 px asked (beams and rings are big). |
| 8 | High-contrast option noted | Partly | Label text is white or bright on dark plates and looks well above 4.5:1, but C2's notes do not record the option or a measured ratio. |
| 9 | Clamp labels, all 6 slots | Fixed | Phone: all labels inside the viewport (about 12 px margin), all 6 slots shown. Manager sprite itself is clipped at the right edge. |
| 10 | Skill bar badges / simple icons | Partly | Badges sit outside the icons and names are under them. Icon 5 (Invite, calendar grid) is still busy at 70 px; icon 2 (Reply-All) is better. |
| 11 | Perf: cache, 40+ fps, 50-monster test | Partly | 54 fps is a big gain over 29 and passes the 40 target. The 50-monster scene was not tested; notes admit each actor is drawn twice (about 8 fps) and the cache per monster type is not done. |
| 12 | Not generic | Fixed | Indigo with teal walls, red/cyan pools, mug and water-cooler globes, serif Unique labels, and the office props are recognisably this game. |

Count: fixed 8, partly 4, not 0.

## Top 5 remaining fixes (for the style port into the game)

1. **Hero legibility and spacing (C2-desk-f30/f92/f150, centre).** The zombie stands in front of the hero in every frame, and the hero's face is dark hair plus dark glasses on a small head. Why: the hero must be findable in a crowd; at 50 monsters this gets worse. Change: give the hero a lighter face value and no full-dark glasses (or a bright eye highlight), add a 1 px white outline pass on the head, and in the game add a soft separation rule (monsters slide to a minimum distance and are drawn behind the hero when closer to the camera is not the case). Fade monsters to 60% opacity only where they cover the hero's head.
2. **Let actors take the light (all desk frames).** Actors are cel-lit and ignore the coloured pools; the Manager and demon look cut out. Why: cohesion and menace. Change: multiply a 15 to 25% tint from the nearest pool into each sprite (red near the demon, cold green under the fluorescent, warm at monitors), add a soft elliptical contact shadow under every actor, and darken far actors by distance a little more. Keep the rim rings.
3. **Hit punch (C2-desk-f92).** "63" is smaller than r1, sits on the sword hand, and the zombie shows no flash or recoil. Why: the hit is the core feel of a hack-and-slash. Change: scale the number about 1.3x for crits, spawn it above-right of the head clear of the weapon, add a 2-frame white flash and 6 px recoil on the target, a thicker slash arc with a bright core, and a short freeze (hit-stop, about 50 ms).
4. **Manager neck and phone framing (C2-desk-f30, C2-phone-f92).** The head is a ball on a wide suit; on the phone the Manager is cut off at the right edge and the top third is empty. Why: the boss is the most visible character. Change: add a collar and neck (or a tie knot overlapping the chin) and reduce the head size by about 10%; on narrow screens centre the crop on the hero plus the nearest boss, not a fixed offset, and zoom into the freed top space.
5. **Perf and accessibility hardening (notes C2 performance, skill bar, label markers).** Add a sprite cache with baked rim per monster type before the 50-monster test, keep a "low fx" switch, and record the test result. At the same time raise label markers to 16 px, simplify the Invite icon (fewer calendar cells), and ship the high-contrast option with a measured 4.5:1 for label text. Why: the 54 fps number is for 3 monsters and a single frame budget; the decision asked for the 50-monster test before committing.

## Keep

- The grading model: strong vignette, dark falloff outside the hero's radius, red/cyan/cold-green coloured pools, with outlines and flat fills intact. It is the main gain of C2 and makes the game look like it has a dungeon without losing readability.
- The 2 px rim ring per actor (hero white, zombie lime, demon red, manager amber): makes each monster type findable in the dark and doubles as a faction cue.
- The coffee-mug and water-cooler globes with numbers and glyphs: funny, on-theme, colour-blind safe and a better identity than the iron globe from the decision rules (which was only a borrowed idea; this is more distinctive, so I would keep it and use the riveted idea only on the HUD frame edges).
- The placed, smaller loot plates with leader lines, serif italic for Unique, and the star / hexagon / diamond markers with distinct border styles.

```json
{"score":33,"verdict":"ship","scores":{"first_impression":5,"readability":4,"cohesion":4,"colour_contrast":4,"composition":4,"motion_feedback":4,"theme_tone":4,"polish":4},"mustfix":{"fixed":8,"partly":4,"not":0},"fixes":["Hero legibility: lighter face, white head outline, spacing/overlap rule so monsters do not sit on the hero","Actors take the light: pool tint 15-25% per sprite plus contact shadows","Hit punch: bigger number clear of the weapon, flash, recoil, thicker slash, short hit-stop","Manager neck/collar and phone crop centred on action, no clipped boss","Perf and a11y hardening: sprite cache and 50-monster test, 16 px markers, simpler Invite icon, high-contrast option at 4.5:1"],"keep":["Dark grade with coloured pools and vignette","Per-actor rim rings","Mug and water-cooler globes with numbers and glyphs","Small placed loot plates with tier markers, border styles and serif Unique"]}
```
