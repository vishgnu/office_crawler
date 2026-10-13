# Review r1: player appeal and genre feel

Reviewer: visual-reviewer (lens: would a player say "this looks nice", does it feel like the moody genre classic in an office).
Looked at all 12 screenshots in `shots/r1/` (desk f30/f92/f150, phone f92, for A, B, C). Measured fps (software GL): A 23, B 61, C 29.
Verdict rule: ship >= 32 with nothing below 3, iterate 24-31, rework < 24.

## Scores

| # | Criterion | A gothic | B pixel | C vector |
|---|---|---|---|---|
| 1 | First impression | 5 | 4 | 5 |
| 2 | Readability | 3 | 3 | 5 |
| 3 | Cohesion | 4 | 4 | 4 |
| 4 | Colour and contrast | 4 | 3 | 4 |
| 5 | Composition and hierarchy | 3 | 3 | 4 |
| 6 | Motion and feedback | 4 | 3 | 5 |
| 7 | Theme and tone | 5 | 4 | 3 |
| 8 | Polish | 3 | 3 | 4 |
| | **Total /40** | **31** | **27** | **34** |
| | **Verdict** | iterate (just under ship) | iterate | ship (with fixes below) |

## A: gritty gothic office (painterly)

Evidence per criterion
1. A-desk-f30: the fluorescent light pool, red demon glow, amber monitors and heavy vignette make a "wow, moody" frame in three seconds. This is the only variant that looks like the genre's dungeon mood.
2. The three monsters and the hero separate well through lighting, and the Middle Manager is a striking silhouette. But the Printer Demon's body is a grey-pink block against grey walls, and the cubicle walls and floor are close in value, so the room structure (A-desk-f30, left half) is hard to parse. The zombie overlaps the hero's lower body.
3. One painterly language with stroke, grime and bloom throughout. The hero and the Manager are drawn more finely than the furniture.
4. Warm/green/red lights are well balanced. Magic blue, rare yellow and unique orange (A-desk-f92) are close: yellow and orange are near-identical for red-green colour-blind players, so rarity relies on the marker shapes and borders, which do work.
5. The four loot labels, three enemy names and two globes fight for attention. The labels are the brightest, largest things on screen (Keycard label is wider than the Printer Demon). The eye goes to text before the hero.
6. f92: the 63 damage number, white spark and recoil read clearly. The numerals are big and in-genre. The slash arc is faint on dark. Light flicker and liquid surface add life.
7. Iron-and-glass globes, serif type, candle-like monitor glow: the closest to the classic's tone, with an office joke intact (stapler, printer, binder).
8. Phone (A-phone-f92): a third of the screen is empty black above the scene, and the Printer Demon and Lanyard labels are cut off at the edges. 23 fps in software GL is the worst of the three, so smoothness on mid laptops is at risk.

Top 5 fixes
1. Shrink and demote the loot labels (A-desk-f92, all four): about 60% of the current size, show full text only on hover/Alt, and show only a coloured diamond/star/hexagon plus a one-word name otherwise. Why: the labels bury the characters and the mood.
2. Add rim light / 1-2 px lighter outline to monsters and the hero (Printer Demon especially, A-desk-f30 left). Why: they sink into grey walls; the notes already admit this.
3. Raise floor-to-wall value contrast to at least 3:1 and lighten the near-floor tiles in the hero's light radius so the cubicle layout reads. Keep the black at the edges.
4. Separate the rarity colours for colour-blind players: shift rare to a clearly lighter, greener gold and keep unique a deep orange-red with the notched border, or add a fixed icon per tier on the beam. Test with a deuteranopia filter.
5. Fix the phone layout (A-phone-f92): crop the scene to the hero rather than letterbox, clamp labels inside the viewport, and cut the light layers (half resolution, fewer additive passes) to hit at least 40 fps in software GL.

Keep: the atmosphere (light pool, vignette, warm/cold light contrast); the riveted-glass globes; the serif loot labels with tier border styles.

## B: crisp pixel art

Evidence per criterion
1. B-desk-f30: charming and readable as "retro isometric" in three seconds, the dithered light falloff is a nice touch, but it looks like a good indie jam game, not a standout.
2. The hero is about 35 px tall, and at B-desk-f30 the hero and the Zombie Intern merge into one brown-grey mass. The Printer Demon is a white cube with scraps and reads as a box. The Manager's head is a big brown disc that looks flat next to his body.
3. The strictest cohesion of the three (one palette, one grid, labels share it). The hard-edged text and bevelled boxes match.
4. The 25-colour palette is muted and uniform; rare yellow and unique orange are close (B-desk-f30 labels), and the dither noise around the beams fights the colours.
5. The labels are as big as the sprites, so UI-over-world is worse than in C. The globes (tiny, bottom corners) are almost nothing, and the HUD is a thin dark strip. The black bars at the top and bottom waste space.
6. f92: the 63 box and yellow burst are visible but small, the hero's swing is a few pixels, so the hit has less impact than in A or C.
7. Office props and the dither mood work and the genre is clear, but it reads as "retro game" more than "moody dungeon crawl". Pleasant, not menacing.
8. 61 fps is the clear winner. But the phone shot (B-phone-f92) shows a scene 320 px wide in a 390x844 screen with large black margins, which is unusable (text near unreadable). The all-caps blocky font reduces legibility of the long item names.

Top 5 fixes
1. Redo the hero and zombie sprites at about 48-56 px tall, with 1 px dark outline and a distinct hero colour (bright tie or lanyard) so it separates from enemies (B-desk-f30 centre).
2. Make the Printer Demon a monster: wings, orange eyes with glow, tentacle motion, not a white cube; give the Manager a body in the same value range as the head.
3. Cut label size by 40% and use a narrower 3x5 font only for numbers; names show on hover. At the moment they hide a fifth of the scene.
4. Scale up the HUD globes and put the skill bar into a full-width bar; fill the letterbox areas with an outer frame instead of black. On phones use a 3:4 crop with a 240x320 buffer instead of the shrunken landscape view.
5. Separate yellow and orange in the palette (rare toward lime-yellow, unique toward red-orange) and reduce the dither on beams to a 2-colour pattern.

Keep: 61 fps and the tiny budget; the Bayer-dithered light falloff; the integer scale and consistent grid.

## C: stylised vector

Evidence per criterion
1. C-desk-f30: instantly appealing: bold outline, saturated palette, funny faces, glossy globes, clean text. Looks like a finished indie game, the most "professional" of the three.
2. Best of the three: hero, zombie (green), Printer Demon (pink-red), Manager (large, blue suit, red tie) are all distinguishable by silhouette and colour. The floor and walls are teal vs indigo and read clearly. Nothing important is lost.
3. Outline weight, shade steps and rim lights consistent across props, characters and HUD. Minor: the Manager's head (oversized orange ball with glasses and headset) looks slightly detached from his body.
4. Indigo base with teal walls and warm accents is harmonious. Red/blue globes are distinguishable by lightness and by the liquid pattern; rarity yellow/orange are again close, but the double border and marker shapes carry it.
5. Better than A and B: the labels have a friendly pill shape and are smaller, the hero is in the centre. Still, four loot labels plus three nameplates crowd the middle (C-desk-f92: damage number covers the Zombie nameplate).
6. f92 is the best hit moment: huge orange "63" with outline, paper-scrap burst, recoil and flash. The swing is readable and has weight.
7. Weakest area. The office comedy is spot-on, but the palette and soft light read "cute mobile game", not "moody genre classic". The darkness is only at the edges (C-desk-f30 corners); nothing feels threatening.
8. Clean anti-aliasing and text. Phone (C-phone-f92): the Printer Demon nameplate and the Lanyard label are clipped at the left edge; the globes are large, so the scene gets about 60% of the screen. 29 fps in software GL is acceptable but not safe.

Top 5 fixes
1. Add mood: darken the floor and wall values by about 25%, a stronger vignette, and a real dark falloff outside the hero's light (C-desk-f30: the scene is lit nearly everywhere). Keep outlines and flat colours.
2. Make the room more menacing: red emergency tint on the demon side, cold green flicker pool from the fluorescent tube with a clear edge, and grime/blood decals on the floor and the cubicle walls.
3. Reduce overlap at hit time (C-desk-f92): put the damage number above the target's head and above its nameplate, and fade the nameplate during the hit.
4. Make the hero distinct from the Zombie: hero face is tiny and shares the same skin value as the Manager. Enlarge the hero by about 10%, add a bright lanyard/tie highlight, and give the zombie a darker green and a ragged silhouette.
5. Phone: clamp all labels to the viewport (C-phone-f92 left edge), and shorten nameplate text to an abbreviation on narrow screens.

Keep: the silhouette and colour readability; the hit feedback (big outlined number, paper burst); the pill-shaped loot labels with tier-specific borders and the clean glossy globes.

## Ranked recommendation

1. **C: pick.** The only variant that is clearly "nice" and clearly readable at a glance. It is the best hit feedback, scales to phones, and extends cheaply (the notes say effort M). Its one real weakness (tone) is fixable by grading, not by redrawing.
2. **A: runner-up and the target mood.** The strongest first impression and tone, but it needs the most work to be playable (readability, clutter, 23 fps, effort L). Raw, A is the game people would screenshot; C is the one they would play for an hour.
3. **B: third.** Fastest and most consistent, but the hero is too small to carry a character-driven game, and the phone view is unusable as shot. It does not beat C on appeal.

Caveat: C's tone gap is the main risk. If the customer values "moody" over "friendly" above all, choose A and budget for the readability and performance work (fixes 1-5 above). The ranking reflects "would someone want to play it", where C leads.

### What to borrow
- From A into C: the lighting model (strong vignette, dark outside the hero's radius, warm monitors versus green fluorescent), the grime and floor texture on a few decals, the riveted metal globe frame (swap C's purple rim), serif or slab type for Unique items only.
- From B into C: the performance discipline (cached static layer, light layers at lower resolution, a quality switch targeting 40+ fps in software GL), and B's strict rule of one palette and one line weight. Also the 3-tier marker shapes, which are already in C.
- From B into A (if A wins): the dither idea as a cheap light falloff fallback for low-end devices.

```json
{"ranking":["C","A","B"],"per_variant":{"A":{"score":31,"verdict":"iterate"},"B":{"score":27,"verdict":"iterate"},"C":{"score":34,"verdict":"ship"}},"pick":"C","borrow":["A: dark vignette and hero-radius lighting, warm monitor vs green fluorescent light, grime decals, riveted-metal globe frame","B: cached static layer and low-res light layers for fps, strict palette and line-weight discipline, tier marker shapes","A and B: rim-light on enemies and a colour-blind-safe rarity palette (separate yellow from orange)"]}
```
