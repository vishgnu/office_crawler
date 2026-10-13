# Art direction round 1: review 2 of 2 (craft, readability, production risk)

Reviewer: visual-reviewer, lens = craft, readability and production risk. Date: 2026-10-13.
Evidence: all 12 screenshots in `shots/r1/` were opened and viewed (A, B, C at f30, f92, f150 desktop 1280x800, plus phone f92 at 390x844). Measured software-GL fps: A 23, B 61, C 29 (pessimistic, not real hardware).
Scene in all three: hero (centre-left, sword raised), Zombie Intern overlapping the hero, Printer Demon (upper left), Middle Manager (right), three loot drops with labels, globes left/right, skill bar bottom centre.
Phone is secondary: NFR-B02 puts mobile out of scope for MVP (minimum width 1024 px), so phone defects are noted but weighted lightly.

## Scores

| # | Criterion | A gothic painterly | B pixel | C vector |
|---|---|---|---|---|
| 1 | First impression | 4 | 3 | 4 |
| 2 | Readability | 3 | 3 | 4 |
| 3 | Cohesion | 4 | 4 | 4 |
| 4 | Colour and contrast | 3 | 3 | 4 |
| 5 | Composition and hierarchy | 3 | 3 | 4 |
| 6 | Motion and feedback | 4 | 3 | 4 |
| 7 | Theme and tone | 5 | 4 | 3 |
| 8 | Polish | 3 | 3 | 3 |
| | **Total /40** | **29** | **26** | **30** |
| | **Verdict** | iterate | iterate | iterate (closest to ship) |

Note: motion judged from three still frames (f30 idle/wind-up, f92 hit, f150 recover), not live playback.

## Evidence per variant

### A: gritty gothic (29, iterate)
1. First impression 4: A-desk-f30 has the strongest mood of the three (vignette, red demon glow, amber monitors, riveted globes). It is the picture people say "wow" to.
2. Readability 3: the hero is dark-on-dark and the Zombie Intern merges into the hero's silhouette (A-desk-f30, around x=640-720, y=300-480); the left third of the frame is almost black, so the floor, cubicle walls and demon base have little value separation. Loot is the clearest thing on screen, which is the wrong hierarchy. The Printer Demon reads only because of its red glow; without it, it is a grey box.
3. Cohesion 4: painterly shading, stroke weight and light colour are consistent across sprites, props and HUD.
4. Colour 3: health (red) and mana (blue) are the same circle and differ only by hue and fill height, with no numbers or icon (NFR-A03 asks for shape/fill difference). Yellow Rare and orange Unique labels are close in a deuteranopia simulation; the diamond/star/hexagon markers carry the load, but at ~14 px they are tiny. The dark scene sits at low overall value contrast, so 4.5:1 for body text is only met by the label plates, not by anything in the world.
5. Composition 3: loot labels are the biggest, highest-contrast items in the frame (Keycard label at x=480-850, y=98-142 sits on top of its own beam and the hanging light). Enemy name plates are small and sit away from their sprites. The "63" in A-desk-f92 sits on the hero's face and the zombie plate.
6. Motion 4: f92 shows damage number, spark and flash, but the slash arc is faint against the dark scene; recoil visible between f30 and f150.
7. Theme 5: delivers "moody dungeon crawler in an office" better than the others.
8. Polish 3: Manager's name plate overlaps the fluorescent fixture (A-desk-f30 x=990-1150, y=143-175); on phone (A-phone-f92) the Printer Demon and Lanyard labels are clipped at the left edge, slot 6 is dropped, and about 40 percent of the canvas height at the top is empty black.

### B: crisp pixel art (26, iterate)
1. First impression 3: charming and clean at a glance, but at 1280x800 the 320x180 buffer scaled 4x looks coarse and the Bayer-dither darkening reads as noise in the dark areas (B-desk-f30 left and bottom).
2. Readability 3: the hero (~35 px tall) and the Zombie Intern are both brown/grey and overlap into one blob (B-desk-f30 x=590-720, y=290-520). The Printer Demon is a white/grey box whose name plate (x=315-525, y=165-200) floats a long way from the sprite (x=340-490, y=230-360) and is partly over the desk, so it looks attached to the desk. The Manager's oversized head and the hero are the clearest shapes; small props are fine.
3. Cohesion 4: the strongest consistency of the three, since the 25-colour palette and integer grid enforce it.
4. Colour 3: palette is limited, so many greys and browns fall in one value band; the floor tiles and the monsters share values. Red/blue globes have the same weakness as A (hue only), though the fill and the glass highlight do differ slightly.
5. Composition 3: the Chair loot ring and beam are cut off by the HUD strip (B-desk-f30 x=760-905, y=595-655); the XP bar has no "Lv 7" or percentage, so level is not shown; globes are small relative to the bar.
6. Motion 3: the f92 hit is a small yellow starburst plus "63" plate, readable but modest; paper-scrap burst barely visible. In f150 the demon changes silhouette (smaller, brown stain at left), which looks like a sprite glitch rather than animation.
7. Theme 4: retro dungeon-crawler feel, funny but less dark/gritty.
8. Polish 3: 3x5 all-caps font is crisp but cramped at this size (e.g. "THE CORNER OFFICE KEYCARD" letters touching the icon); phone (B-phone-f92) renders the scene at about a third of the screen width with huge margins and unreadable labels.

### C: stylised vector (30, iterate)
1. First impression 4: bright, clean, instantly friendly; the loot rings and the 63 number pop at once (C-desk-f92).
2. Readability 4: bold outlines make each actor distinct: pink demon, green zombie, blue-suited manager with red tie, hero with dark hair and white shirt. The hero and zombie still overlap (C-desk-f30 x=600-720, y=280-480) but the green skin separates them better than in A or B. Floor, walls and furniture are clearly lower in saturation than actors.
3. Cohesion 4: outline width, flat fills and rim light are consistent; the HUD uses the same outline language.
4. Colour 4: best value contrast; red/blue globes also share a circle shape with only hue and fill height different (same fix as A/B); orange Unique vs yellow Rare are close, the markers and border styles carry it, and the marker shapes are larger and cleaner here than in A or B.
5. Composition 4: HUD is compact and legible; label plates are readable but the three loot plates still dominate over enemy plates. Damage number in f92 covers the Zombie Intern plate and part of the hero.
6. Motion 4: clearest hit feedback (large number, paper burst, flash); wind-up and recover poses read in f30 and f150.
7. Theme 3: this is "cheerful office comedy", with only a light dungeon feel; the dark indigo and rim glow keep some menace, but it is the least grim.
8. Polish 3: C-phone-f92 clips the Printer Demon, Lanyard and Manager labels at the screen edges and drops slot 6; the small slot number overlaps the icon corner (C-desk-f30 slots 1-5); skill icons 2 and 5 are busy at 70 px.

## Production risk at full scale (8 floors, ~10 monsters, dozens of items, a boss, 60 fps, up to 50 monsters per NFR-P01)

| Risk | A | B | C |
|---|---|---|---|
| Measured fps (software GL) | 23 (fails; 2x half-res light layers, full-screen additive darkness, gradients) | 61 (fixed 320x180 buffer; cost nearly independent of scene size) | 29 (outlines and vector paths; fine with caching) |
| Cost of each new monster/item | High: gradient shading per sprite plus tuning rim light so monsters do not sink in the dark | Medium: needs a sprite pipeline (hand-written arrays or a generator) and palette discipline | Low: built from a few primitives; outline and rim rules are mechanical |
| Scales to 50 monsters | Unproven and doubtful; each dynamic light costs fill rate | Best | Likely fine if sprites are pre-rendered to offscreen canvases per frame/type and outlines are baked |
| Readability at scale (crowds) | Worst: crowd of dark silhouettes in a dark scene | Medium: small sprites, same-value palette | Best: silhouettes and outlines hold up in crowds |
| Biggest unknown | Whether a readability pass (rim light, outlines) erases the painterly look | Whether 35 px actors can express 10 monsters and a boss | Whether the style stays distinctive and not generic |

Overall production effort: A = L (the notes say so, and the screenshots agree), B = M, C = M and the lowest risk per asset.

## Top 5 fixes

### A
1. Readability of actors: add a 1-2 px warm or cool rim light on the hero, a different tint on each monster (cold for zombie, red for demon, amber for manager) and lift the shadow floor so the left third of A-desk-f30 is not black. Why: hero and zombie merge now.
2. Separate hero from zombie: lighter shirt or lanyard colour for the hero, desaturated blue-green for the zombie, plus a 1 px darker ground shadow under each. Why: they are one silhouette in all three desk frames.
3. Reduce label dominance: shrink loot plates to ~60 percent, show full text only on hover or when the hero is near, and put the enemy name plate directly above each head. Why: the plates currently out-rank the characters.
4. Health/mana accessibility: add numeric value inside or under each globe and a distinct shape cue (e.g. mana globe with a hex facet ring, health with a heart notch) per NFR-A03.
5. Performance: replace full-screen additive darkness with a pre-baked low-res light mask plus sprite-level glow, cap dynamic lights to 4, and re-measure; target at least 45 fps in software GL before committing. Add a high-contrast/low-fx option.

### B
1. Fix the Printer Demon: redraw with a recognisable silhouette (paper wings in a contrasting colour, red eyes, tray mouth), fix its jumping silhouette between f92 and f150, and attach the name plate directly above it.
2. Widen the hero/zombie value gap: give the hero a lighter shirt and orange tie highlight and the zombie a green skin ramp that is two steps away from any grey; consider a 1 px dark outline around actors only.
3. Stop the HUD clipping the Chair loot (B-desk-f30 y=595-655) by keeping the play-field above the HUD strip; show "Lv 7" and the XP percent in the 3x5 font.
4. Phone/small windows: integer-scale up to the width (or crop to the hero) instead of a third-width image (B-phone-f92); at minimum enforce the 1024 px minimum from NFR-B02.
5. Replace Bayer darkening with a lighter two-step dither or flat palette darkening in the left and bottom areas, to cut the noise, and add a number to each globe.

### C
1. Move the damage number so it never covers the target's name plate or face: spawn it above the plate, and let it rise over 400 ms (C-desk-f92 "63" hides "Zombie Intern").
2. Make health and mana distinguishable without hue (NFR-A03): a heart or flame glyph in each globe plus numeric value, different liquid-surface pattern (e.g. bubbles vs. ripples). Test with deuteranopia and protanopia simulations.
3. Rarity: separate Rare and Unique further than yellow vs orange: make Unique plate border notched and darker orange/red-brown with a white inner stroke, and increase marker size to at least 16 px; keep the shape markers.
4. Phone/narrow views: keep label plates inside the safe area (clamp x to 8 px from the edge) and show all 6 skill slots or scroll; C-phone-f92 clips three labels and slot 6.
5. Add some atmosphere without losing readability: a stronger vignette, a cooler floor in dark corners and a flickering light pool, so the style delivers more of the "gone wrong" tone, and keep outlines at constant screen width. Cache sprites to offscreen canvases so 50 monsters stay at 60 fps.

## What works well (keep)
- A: the vignette plus the coloured pools of light (amber monitor, green-white fluorescent, red demon glow) and the riveted iron-and-glass globes; best theme delivery.
- B: the 25-colour palette discipline, integer scaling, and the loot labels with shape marker plus border style (readable with no colour). Cheapest by far (61 fps).
- C: bold outline plus rim-light actors, the rarity plates (marker + double/notched border, clean sans text), the loot ring and beam design, and the large readable hit number.
- All: the shared scene engine separate from a swappable renderer (notes.md); the shape/border rarity coding already satisfies the "not colour alone" half of NFR-A03.

## Ranked recommendation
1. **C**: best readability, lowest production risk per asset, fast enough once sprites are cached; weakest on tone, which can be bought back cheaply.
2. **A**: the most atmospheric but fails the readability and performance lens (23 fps, dark-on-dark actors); keep as a lighting reference, not as the base style.
3. **B**: cheapest and most consistent, but actors are too small and similar in value to read a crowd, and the demon and phone views are weak.

**Pick: C**, borrowing A's lighting and vignette and B's discipline.

Borrow:
- From A: a stronger vignette and the coloured light pools (amber monitor, green-white fluorescent, red demon glow) as a cheap pre-baked mask; the serif tooltip look for Unique item text.
- From B: the strict small palette and integer/pixel snapping discipline for the HUD; the Bayer-dither darkening as a low-spec "performance mode" option; the idea of caching all sprites.
- Cross-cutting: numbers in globes, safe-area clamping of labels, and a high-contrast option for NFR-A03/A04.

```json
{"ranking":["C","A","B"],"per_variant":{"A":{"score":29,"verdict":"iterate"},"B":{"score":26,"verdict":"iterate"},"C":{"score":30,"verdict":"iterate"}},"pick":"C","borrow":["A: vignette and coloured light pools as a pre-baked mask","A: serif tooltip look for Unique items","B: strict small palette and pixel-snapping discipline for HUD","B: dithered darkening as a low-spec performance mode","B: pre-cached sprites","all: numeric values and shape glyphs in the health/mana globes (NFR-A03)","all: clamp labels to a safe area on narrow screens"]}
```
