# S1 visual review: the real build after the C2 port

Reviewer: visual-reviewer (lens: appeal/genre feel and craft/readability, single in-game reviewer). Date: 2026-10-13.
Build: `npm run build`, `dist/index.html?test=1&seed=3` driven through `window.__app` (ADR-0003), Chromium software GL, manual clock.
Own screenshots (all opened with Read) in `/tmp/claude-0/vr-game/`: 01-idle-start, 01-idle-walking, 02-fight-0..3, 03-lowhp-b, 04-death (scene dead, overlay not yet drawn), 04-death-b, 05-title, 06-fight-hc, 06-fight-lowfx, 07-fight-1280, 07-fight-390.
Also compared: `docs/shots/s1-first-playable.png` (before), `s1-ported-*.jpg`, target `C2-desk-f92.png`.
Kept in `docs/shots/`: `s1-review-fight.jpg`, `s1-review-pile-lowhp.jpg`, `s1-review-death.jpg`.
Limits: stills only (no live motion), ~3 monsters or a 5-monster pile, no loot, no Manager, no `Alt`/hover states. I did not re-run `npm run bench`.

## Scores

| # | Criterion | Score | Evidence |
|---|---|---|---|
| 1 | First impression | 4 | 02-fight-0 / 01-idle-walking: dark indigo room, teal walls with orange trim, cyan monitor glow, red wash on the imp, mug and jug. Reads as a moody office-dungeon in 3 s and is a huge step up from the flat grey s1-first-playable. Not 5: the hero is small and plain next to the C2 mock, and the hero faces away in most fights. |
| 2 | Readability | 4 | Rim rings separate hero (white), zombie (lime) and imp (red) clearly in 02-fight-0 and 06-fight-hc. Drops to 3 in the 5-monster pile (03-lowhp-b): hero is buried between three imps and a zombie, plates stack like a bar chart at y=300-410. Walls/floor survive beyond the light (01-idle-walking), which was the main r2 fail. |
| 3 | Cohesion | 4 | Outline weight, rims, plate language, mug/jug and tiles belong together. Imps in the red pool are washed to pale pink (03-lowhp-b x=700-1100) so they lose the saturated look of the other actors. |
| 4 | Colour and contrast | 4 | Floor/wall separation inside the light is good; red hit numbers vs orange are distinguishable. Health (red mug, heart) vs mana (blue jug, drop) differ by shape and glyph. Weak: "Empty" labels and the belt slots are low-contrast purple on purple (about 3:1); title tagline and hint (05-title) are near unreadable. |
| 5 | Composition and hierarchy | 4 | HUD sits in the corners and bottom centre, play area free (02-fight-0). Target bar on top is clear. Title screen puts the logotype across the hero's head (05-title). The 4+4 empty slots at the bottom read as placeholder weight. |
| 6 | Motion and feedback | 3 | Hit number plus paper burst land clear above the target (02-fight-0 "6" at 1243,344; 06-fight-hc). But: a "miss" floater and the damage-to-player number "2"/"4" overlap and read as "n2s"/"r4s" (03-lowhp-b, 04-death); the number is small (about 35 px at 1080p vs the 63 of the mock); no visible hero hurt flash and no low-HP warning (6/50 on the mug, nothing else changes: 03-lowhp-b). Death tint is good. |
| 7 | Theme and tone | 4 | Blood decals on walls, red lamp on the imps, "You have been let go." (04-death-b) deliver office-horror comedy. Monsters still look friendly-cartoon; acceptable per the frozen direction. |
| 8 | Polish | 3 | Clean text and no clipped HUD at 1080p/720p; phone view keeps plates inside the screen (07-fight-390). Defects: floater collision above; a nameplate sits on a neighbour (02-fight-0 zombie plate at 1094,420 on the imp wing); on 390 px the plate and "6" touch; faint ghost silhouettes of out-of-light monsters at the screen edge (02-fight-0 x=0-40,y=810-900; 06-fight-hc bottom-left behind the mug); title text over hero; the death overlay only appears after a frame (04-death shows the red tint with no text until a later frame). |
| | **Total /40** | **30** | |
| | **Verdict** | **iterate** | 24-31. Good bones, nothing below 3, but 30 is under the C2 mock's 32-33 because of feedback and polish defects, not style. |

## Port checklist at the real camera scale (zoom 1.8, hero about 160 px tall at 1080p)

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Graded palette, rims, rarity trio | Done | 02-fight-0; rarity unused until S2. |
| 2 | Figures with baked rim, hero 1.10, zombie, imp | Partly | Zombie (ragged hem, spiky hair, mug) and imp (paper wings, red eyes) read well. Hero's lanyard, tie and headset only visible when he faces the camera (01-idle-walking); in fights he shows the back of a brown head (02-fight-2/3, 06-fight-hc). Manager is S2. |
| 3 | Baked light mask, banded radius, pools, lowFx | Done | Banded teal-green fluorescent ring and cyan monitor pools visible (01-idle-walking); 06-fight-lowfx is flat but readable. |
| 4 | Grime, blood, teal walls with trim | Done | Blood on walls and floor, scuffs, orange trim; still sparse on the floor. |
| 5 | Actors tinted by light, contact shadows | Partly | Tint works but over-washes imps in the red pool; contact shadows are barely visible at this scale. |
| 6 | Nameplates, collision pass, leader lines | Partly | Above heads and integer-snapped, leader lines on 720/390; but in a 5-pile plates form a stacked wall and still land on bodies (02-fight-0, 03-lowhp-b). |
| 7 | Loot rings, beams, markers | Missing | Deferred to S2 (no loot in the game). |
| 8 | Floaters | Partly | Spawn clear of the plate and face, outlined, paper burst; but small, no visible target flash in stills, and miss and damage floaters collide. |
| 9 | HUD: mug, jug, XP bar, skill bar, belt, target bar | Done | All present and legible at 1080p/720p/390. Four skill slots, three of them "Empty", belt empty. |
| 10 | High-contrast mode | Partly | 06-fight-hc: solid black plates with white border, no pool tint, brighter floor, white panel borders: works. Text-size option and colour-blind checks not done (as the implementer says). |
| 11 | Safe-area clamp, small-screen floors | Done | 07-fight-390: all plates and HUD inside, 8 px margin. |
| 12 | Perf gate | Done (not re-run) | Implementer reports about 47 fps full fx / 52 lowFx at 50 monsters; I only saw smooth stepping in my runs. |
| 13 | Zoom check at real scale | Done | Rims, plates and decals all survive at 1080p, 720p and 390 px. |

Count: done 7, partly 5, missing 1.

## Top 5 fixes for the next slice

1. **Keep the hero findable in a pile and from behind** (03-lowhp-b, 02-fight-2). The hero loses tie, lanyard and headset when facing away, and in a 5-monster swarm sits under three imps. Why: the player must always find themselves, and this gets worse with the 50-monster bench. Change: add a hero-only marker (white floor ring or bright underlay and a slightly thicker rim), always draw the hero after enemies within one tile or fade overlapping enemies to about 65% opacity over the hero's head, and add the headset/lanyard to the back view (white lanyard cord, tie knot visible at the collar).
2. **Feedback for danger and for floaters** (03-lowhp-b, 04-death). Floaters stack on one spot ("n2s", "r4s"); the hero has no hurt flash; at 6/50 nothing but the mug level changes. Change: stack floaters with a vertical offset or queue them 80 ms apart, give the player-damage number its own spawn point (above the hero, red), add a 2-frame hero hurt flash and a pulsing red edge vignette and mug shake below 30% HP, enlarge hit numbers about 1.4x at zoom 1.8 (target about 50 px at 1080p).
3. **Plate discipline in packs** (02-fight-0, 03-lowhp-b, 07-fight-390). Plates sit on neighbouring sprites and, with 5 enemies, line up as a wall. Change: show the full plate for the target, hovered and nearest 2; others become a short bar (name hidden) or a 2-px tick; place plates above the sprite's rim (not on the head of a closer actor); on narrow screens keep at least 8 px from the floater.
4. **Title and death screens** (05-title, 04-death). Title text runs over the hero's head; tagline and hint are about 2:1. Dead scene has no overlay for the first frame. Change: offset the title block above the hero or dim the world behind it by 50% with a panel; raise tagline and hint to 4.5:1 and at least 16 px; show the death overlay on the same frame as the state change and add a one-line run summary (time, kills, floor) to give the screen weight.
5. **Light the actors without washing them and fill the empty UI** (03-lowhp-b imps; HUD bottom). Cap pool tint at about 20% so the imp's red eyes, paper and rim stay saturated, strengthen the contact shadow to about 35% black ellipse, and hide the "Empty" captions and the four empty belt slots until S2 (or draw a ghost icon) so the bottom bar stops looking like a placeholder. Also clip or hide out-of-light monster silhouettes at the screen edge (02-fight-0 bottom-left), which look like glitches.

## Keep

- Rim-ring figures baked into the atlas (white hero, lime zombie, red imp) at constant screen width: they carry readability in every shot and in hc and lowfx.
- The light model: near-black void with a banded cold-green ring, cyan monitor pools and a red lamp; floor and wall edges still survive beyond the light (01-idle-walking), unlike the first-playable.
- Mug and jug globes with glyph and number, XP bar with level text, target bar, F-key badges outside icons; high-contrast mode as a real second look; the death copy "You have been let go."

```json
{"score":30,"verdict":"iterate","checklist":{"done":7,"partly":5,"missing":1},"fixes":["Keep the hero findable in a pile and from behind: hero marker/ring, draw-order or fade of overlapping enemies, headset/lanyard/tie visible from the back","Danger and hit feedback: stack or stagger floaters (miss and damage collide as 'n2s'), hero hurt flash, low-HP vignette and mug shake, larger hit numbers","Plate discipline in packs: full plate only for target, hovered and nearest 2; stop plates sitting on neighbouring sprites","Title and death screens: move or dim behind the title block, raise tagline/hint contrast, draw the death overlay on the same frame, add a run summary","Cap pool tint on actors (imps washed pink), strengthen contact shadows, hide empty skill/belt placeholders until S2, hide edge ghost silhouettes"]}
```
