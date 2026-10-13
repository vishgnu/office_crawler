# Art direction round 2: review 2 of 2 (craft, readability, accessibility, production risk)

Reviewer: visual-reviewer, lens = craft, readability, accessibility and production risk. Date: 2026-10-13.
Evidence viewed with Read: `shots/r2/C2-desk-f30.png`, `C2-desk-f92.png`, `C2-desk-f150.png`, `C2-phone-f92.png`; `shots/r1/C-desk-f92.png`; `docs/shots/s1-first-playable.png` (the game today). I also cropped and upscaled the hero/zombie, the Manager and the skill bar from C2-desk-f92 for detail, and sampled pixel luminance. Motion is judged from three stills, not live playback. Measured fps (supplied): C2 about 54 (range 45 to 60), C about 29, software GL, so pessimistic. Phone is secondary (NFR-B02, min 1024 px) and weighted lightly.

## Scores (C2)

| # | Criterion | r1 C | C2 | Evidence |
|---|---|---|---|---|
| 1 | First impression | 4 | 4 | C2-desk-f30: dark indigo field, hot orange Unique ring, red demon rim and cyan monitor read as one moody picture in 3 s. Not 5 because the left and bottom third is black void. |
| 2 | Readability | 4 | 4 | The 2 px rim rings pull every actor off the dark (white hero, lime zombie, red demon, amber manager). Hero and zombie still overlap (x=600-720, y=300-480 in all three frames), zombie in front of the hero's legs. |
| 3 | Cohesion | 4 | 4 | Outline weight, flat fills, plate language, HUD props (mug, jug) match. Actors are drawn after the darkness, so they ignore the coloured pools and look like stickers on a lit world (the notes admit "cel-lit"). |
| 4 | Colour and contrast | 4 | 4 | Rare yellow vs Unique vermillion plus triple ring and notched plate is clearly better. Globes now differ by shape, glyph and number. Weak spots: floor outside the hero's light is near-black (sampled luminance about 0.0006 left of x=200, wall teal about 0.06), "Empty" slot label is dim purple on purple (about 3:1), skill names about 12 px. |
| 5 | Composition and hierarchy | 4 | 4 | Hero, hit number and the Unique ring now lead; loot plates no longer outrank actors. The Keycard plate still sits on its own beam at the top edge (y=65-100), and the Manager plate nearly touches the fluorescent fixture (x=860-950). |
| 6 | Motion and feedback | 4 | 4 | f92: "63" drifts up-right of the target, clear of the Zombie plate and the hero's face; paper burst and slash wedge read. Printer Demon plate bobs with the sprite (y=110, 119, 127 across f30/f92/f150), so text jitters. |
| 7 | Theme and tone | 3 | 4 | The darker grade, red lamp on the demon side, blood decals and cyan monitors deliver "office gone wrong". Grime is sparse and the fluorescent pool is a faint grey-blue ellipse, not the cold green with a clear edge that was asked for. |
| 8 | Polish | 3 | 4 | Phone is fixed (all 6 slots, labels inside 8 px, C2-phone-f92). Slot badges now sit outside the icons. Remaining: mug and jug sit about 5 px from the screen edge (own safe-area rule is 8 px), the "63" has a stray dark stroke through the "3", the skill bar bottom border is flush with the frame edge. |
| | **Total /40** | **30** | **32** | |
| | **Verdict** | iterate | **ship** (threshold 32, nothing below 3) for freezing the style; the five fixes below ride along with the port | |

Honest note: 32 is the minimum for ship. The gain over C is real (+2 overall, theme 3 to 4, polish 3 to 4), but the look is "freeze with conditions", not "finished".

## Must-fix check (decision.md items 1 to 12)

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Damage number not over plate or face | **Fixed** | f92: "63" to the right of the zombie's head, above the Zombie plate, clear of the hero's face. Zombie plate also moved under the feet. |
| 2 | Hero separates from Zombie Intern | **Fixed** | Hero about 15% taller (about 200 vs 173 px), near-white rim, cyan lanyard and yellow tie, headset face; zombie darker green, ragged hem, lime rim. Overlap remains but the silhouettes no longer merge. |
| 3 | Label clutter | **Partly** | Loot plates about 60%, no overlaps, leader lines present. But the zombie plate is under the feet while the others are above heads (decision said directly above each head), and hover/near-hero full-text behaviour cannot be seen in stills. |
| 4 | Manager head attached | **Fixed** | Crop of C2-desk-f92: visible neck and collar, shoulders overlap the head circle. Still a ball on a body, but it reads as one figure. The white belly disc is odd and could read as a ball. |
| 5 | Darker grade, vignette, pools, decals | **Partly** | Dark grade, vignette, red demon pool, cyan monitors, blood decals all present. Fluorescent pool is not green with a clear edge, grime is sparse, actors do not receive pool colour. Floor is lost outside the light, so the floor-to-wall 3:1 rule is met inside the radius but the layout is unreadable beyond it. |
| 6 | Health/mana without hue | **Fixed** | Heart glyph and bubbles on the mug, drop glyph and ripples on the jug, `173/240` and `66/120` inside. Different silhouettes too. (Notes give deuteranopia dE figures; I did not re-run a simulation.) |
| 7 | Rare vs Unique separation | **Partly** | Colours now Okabe-Ito; Unique has serif italic, notched border, triple ring, hexagon. Markers in the plates measure about 12 to 14 px, not the 16 px asked. |
| 8 | High-contrast option noted | **Partly** | Plates pass 4.5:1 for body text, but there is no option and no mention in the C2 notes. Acceptable as "noted for later", so only partly. |
| 9 | Clamp labels, all 6 slots | **Fixed** | C2-phone-f92: all labels inside 8 px, 6 slots, full-width bar. Empty dark top area is deliberate. |
| 10 | Skill bar badges and icons | **Fixed** | Number badges straddle the frame corner, not the art; icons 2 and 5 are simpler. Icon 5 (calendar grid) is still the busiest. |
| 11 | Perf: cache, half-res light, 40+ fps, 50-monster test | **Partly** | 54 fps vs target 40, mask and labels are baked. But the 50-monster test the decision asked for before committing was not run, and actors are still drawn twice per frame (ring pass + body). |
| 12 | Distinctiveness | **Fixed** | Indigo, teal, warm accent palette and office-comedy props (mug, jug, binder, headset) are kept and more distinct once graded. Residual: the Printer Demon box reads like a generic cube ghost. |

Count: fixed 7, partly 5, not 0.

## Top 5 remaining fixes

1. **Light the actors and ground them** (C2-desk-f30, all actors). Actors ignore the coloured pools and have only faint contact shadows, so the world looks lit and the cast looks pasted on. Change: bake each actor rim colour at its own tint but multiply a cheap per-actor tint sampled from the light mask at its feet (4 to 8 ramp steps, not a per-pixel op); add a dark ellipse contact shadow under every actor.
2. **Make the floor survive the grade and the fluorescent pool real** (f30 left and bottom, fixture top right). Floor outside the hero radius is effectively black (luminance about 0.0006), so the room edge and exits vanish. Change: set a floor floor-value (tile edge lines at about 1.5:1 to 2:1 against the void, beyond the hero's light), make the fluorescent pool a cold green-white with a hard banded edge that flickers, and add two or three more grime decals on walls and floor.
3. **Label discipline** (Zombie plate, Printer Demon plate, Keycard plate). Put every nameplate directly above the head (zombie included, collision pass moves it if needed), snap to integer pixels and anchor to the actor's logical position, not the bobbing sprite; keep the Keycard plate off its beam and the screen top; keep 12 px between plate and fixture.
4. **Text size and contrast (NFR-A04)** (skill bar bottom). Skill names are about 12 px and "Empty" is about 3:1. Raise to 14 px at 1080p with a size option, lighten "Empty", make plate markers at least 16 px, and build the high-contrast option (solid plate, no pool tint, thicker rim) as a mode of the same renderer.
5. **Prove 50 monsters before porting** (perf). Draw twice per actor is the main cost. Bake rim + body into one atlas sprite per type/anim/direction/frame (the game's atlas already does this for body), then run a 50-monster scene in software GL and report fps; also inset the mug and jug to 8 px from the screen edge and fix the stray stroke on the "3" of the hit number.

## What the game looks like today (s1-first-playable.png) vs C2

Game at 1920x1080: single flat-lit room on a black void, thin-outlined actors, no rim ring, no pools, no decals, floor and walls in similar mid-blue greys, a plain text "miss", globe and cup as flat shapes with `50 / 50` text under them, belt as four empty outlined squares, no nameplates, no loot labels, no rarity styling. The hero is about 75 px tall (C2 hero about 200 px at 1280x800), so the camera is much wider than the mock-up tile and every effect must survive at one third of the size. It already has the right bones: a pre-baked vignette (world.js `drawLight`), an atlas with supersampling, a procedural figure rig with INK outlines and one shade level, and a swappable `styles/vector` folder.

## Port checklist (src/render/styles/vector and render layer)

1. Palette (`palette.js`): replace floors/walls with C2's graded values; add `rim` per actor (hero near-white, zombie lime, demon red, manager amber) and the Okabe-Ito rarity trio (sky blue, yellow, vermillion). Keep a floor-floor value so tile edges stay visible beyond the light.
2. Figures (`characters.js`, atlas): bake the 2 px rim silhouette under the body into the same atlas entry (one blit per actor, no second pass). Rim width in logical px so it is 2 px at the game's zoom, not 2 px of mock-up. Hero scale 1.10 relative to others, yellow tie and cyan lanyard, headset; zombie darker green with ragged hem; Manager neck/collar; Printer Demon wings and red eyes (current `printer-imp` is a plain grey box).
3. Light (`world.js drawLight`): replace the single radial vignette with one baked mask per size: 90% darkness, toon-banded hero radius (3 to 4 bands), stronger vignette, coloured pools (warm monitor, cold green-white fluorescent with a hard edge, red lamp near the demon, loot glow). Half resolution, max 4 dynamic lights, flicker applied by changing one alpha, not by rebaking. Add a `lowFx` switch (flat or dithered darkening) targeting 40+ fps.
4. Static layer: bake blood decals, wall smears and tile scuffs into the floor/wall atlas variants (`tiles.js`, `FLOOR_VARIANTS`); give walls the teal body and orange-trim top of C2 so floor/wall value separation is at least 3:1 inside the hero radius.
5. Actors vs light: draw actors after the mask but tint from the mask sample at the feet and add a contact shadow; dim far actors slightly.
6. Labels (new render-layer module): pre-rendered nameplates and loot plates (about 60% size, serif italic for Unique, marker at least 16 px, plain/double/notched border), one placement pass per layout with collision against actors, plates, damage zone, HUD and screen safe area (8 px), leader line when displaced; integer-pixel anchoring; full loot text only on hover/Alt/near hero.
7. Loot (`props.js`/fx): ring and beam per rarity (single, double, triple + chevron), shape markers (diamond, star, hexagon) so rarity is never colour alone.
8. Floaters (`fx.js`): spawn above the target's plate, drift up-right over about 400 ms, large outlined number with dark stroke, paper burst on hit; keep the target nameplate unobscured. Currently plain `miss` text with no plate.
9. HUD (`hud.js`, `ui.js`): replace flat globes with the mug (heart, bubbles) and water-cooler jug (drop, ripples), numbers inside, 8 px inset; replace the four empty belt slots with the 6-slot skill bar (key badges outside the icon, names under icons at 14 px, cooldown number, XP bar with `LEVEL n` and `% to level`). Target bar for the hovered monster stays.
10. Accessibility: high-contrast mode (solid plates, no tint, thick rim), text size option, 4.5:1 on all plates; run deuteranopia/protanopia/tritanopia checks on the in-game screenshot, not only on the mock-up.
11. Responsiveness: clamp labels to a safe area and shrink plates below 1024 px even though mobile is out of MVP scope.
12. Performance gate: 50-monster scene in software GL at or above 40 fps and 60 fps target on a mid-range laptop (NFR-P01) before merging; report numbers in the PR.
13. Zoom check: view every effect at the game's real camera scale (hero about 75 px at 1080p); if the rim, plates or decals vanish, scale them by zoom or raise the camera.

## What to keep
- Rim-ring actor silhouettes (white hero, lime zombie, red demon, amber manager) plus outlines at constant screen width: the main reason crowds will read.
- Rarity system: Okabe-Ito colours, markers, border styles, ring/beam shapes, the serif italic for Unique only.
- Mug and jug globes with glyph, pattern and numbers; XP bar with level text; key badges outside icons.
- Hit feedback: big outlined number placed clear of plates, paper burst, slash wedge.
- The baked-layer architecture (world, mask, HUD frame, pre-rendered labels), with only flicker, actors, liquid and effects drawn per frame.

```json
{"score":32,"verdict":"ship","mustfix":{"fixed":7,"partly":5,"not":0},"fixes":["Light the actors: tint from the light mask at the feet plus contact shadows, so they stop looking pasted on","Keep a floor value beyond the hero's light; make the fluorescent pool cold green-white with a hard banded edge; add more grime decals","Label discipline: every nameplate directly above the head, integer-pixel anchored (no bob jitter), Keycard plate off its beam, 12 px clear of the fixture","Text and contrast: 14 px skill names at 1080p, lighter 'Empty', 16 px rarity markers, build the high-contrast mode","Bake rim+body into one atlas sprite, run the 50-monster software-GL test, inset globes to 8 px, fix the stray stroke on the hit number"],"port_checklist":["Palette: graded floors/walls, per-actor rim colours, Okabe-Ito rarity trio, floor floor-value","Figures: bake 2 px rim into the atlas sprite, hero x1.10 with yellow tie/cyan lanyard, darker ragged zombie, Manager neck, real Printer Demon","Light: replace radial vignette with one baked half-res mask (90% dark, banded hero radius, coloured pools, max 4 lights, flicker via alpha) plus lowFx switch","Static layer: bake blood/grime/smears into tile and wall variants, keep 3:1 floor-to-wall inside the hero radius","Actors drawn after the mask but tinted from the mask at the feet, with contact shadow","Labels: pre-rendered nameplates and 60% loot plates, collision/placement pass, 8 px safe area, leader lines, hover/near full text","Loot: rarity rings, beams, diamond/star/hexagon markers, notched Unique border, serif Unique text","Floaters: spawn above plate, drift up-right about 400 ms, outlined number, paper burst","HUD: mug and jug globes with glyph+numbers, 6-slot skill bar with outside key badges, XP bar with level text","Accessibility: high-contrast mode, text-size option, 4.5:1 plates, colour-blind checks on in-game shots","Safe-area clamp and plate shrink below 1024 px","Perf gate: 50 monsters, 40+ fps in software GL before merge","Zoom check: verify rim, plates and decals at the game's camera scale (hero about 75 px at 1080p)"]}
```
