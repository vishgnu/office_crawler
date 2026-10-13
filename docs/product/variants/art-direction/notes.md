# Notes: art direction variants

How to compare: open the three files at the same window size. Same content, same animation; only the art style changes.

## A: Gritty gothic office (`A.html`)
- **What is different:** dark desaturated palette, painterly gradient shading with a thin dark stroke, carpet fibre texture and
  grime baked into the floor, heavy vignette and real darkness around the hero. Warm candle-like amber monitor light against a
  sickly green-white fluorescent pool and a red demon glow; additive light bloom, dust motes, serif type, riveted iron-and-glass globes.
- **Suits:** the "moody dungeon-crawling" feel of the genre; players who value atmosphere over readability.
- **Trade-offs:** hardest to keep readable (dark, low contrast; monsters can sink into the gloom, so gameplay needs rim light or
  outline helpers); most fill-rate heavy (gradients, additive lights, full-screen darkness layer); every new sprite needs
  careful shading to avoid looking muddy.
- **Effort for a whole game:** L. Many more art decisions per asset, plus lighting performance work and tuning for readability.

## B: Crisp pixel art (`B.html`)
- **What is different:** the whole frame is a 320x180 index buffer rasterised by our own code (no canvas antialiasing), 25-colour palette,
  integer scaling with nearest-neighbour, light falloff by ordered (Bayer) dithering with palette-ramp darkening and warm/cool tints,
  a built-in 3x5 bitmap font, pixel globes and pixel icons. Rarity uses colour plus marker shape plus border style.
- **Suits:** a retro-genre audience, tiny build and runtime budget, very predictable look at any window size (integer scale), easiest to keep consistent.
- **Trade-offs:** small sprites limit expression (the hero is about 35 pixels tall); text is blocky and all caps; portrait phones get a small
  crisp image with margins, not a larger crop; hand-tuning of sprites will eventually beat the procedural primitives used in this tile
  (it needs a pixel-sprite pipeline: either hand-written sprite arrays or a small procedural pixel-drawing library).
- **Effort for a whole game:** M. The rendering is cheap and consistent, but sprite animation frames and the palette discipline need steady care.

## C: Stylised vector (`C.html`)
- **What is different:** bold dark outlines, flat colours with one shade step per surface, rim light on up-left edges, oversized heads and
  cartoony proportions, banded (toon) lighting instead of smooth gradients, saturated accents on a dark indigo base, flat glossy globes,
  rounded sans-serif UI with outlined text.
- **Suits:** best readability at a glance (silhouettes, rarity and enemies pop), friendly and humorous office tone, scales to any resolution
  without blur, easiest style to extend with new monsters and items because shapes are built from a few primitives.
- **Trade-offs:** least "dark dungeon" atmosphere of the three (the tone is darker than it first looks, but moodiness comes from colour, not
  light); outlines cost fill-rate; risks looking generic unless the palette and proportions are kept distinctive.
- **Effort for a whole game:** M. New assets are cheap; the cost is keeping outline width, shade rules and rim-light rules consistent.

## Cross-cutting findings
- All three met the stated constraints: single file, no external assets or fonts, drawn in code, original names, 390 px wide up, `?frame=N`, `window.__ready`.
- File sizes: A about 49 KB, B about 44 KB, C about 47 KB (the harness rule of ~60 KB is met).
- All three share one scene engine (scene description, animation, hit effect, lighting inputs). A real game would keep that split: a style-independent
  scene and a swappable renderer. That makes a later style change (or a high-contrast accessibility mode) cheaper.
- Performance is likely fine for all three on a laptop with a GPU-backed canvas, but only measured in software rendering (see brief.md).
  A and C each use two half-resolution light layers composed once per frame; the full game needs a test with 50 monsters (NFR).
- Not covered: sound, character art beyond the one hero, tile variety, fonts for localisation, large-screen performance at 4K.

## C2: stylised vector, round 2 (`C2.html`)
Copy of C with the combined round-1 review fixes (`review-r1-appeal.md`, `review-r1-craft.md`). A, B, C and decision.md are unchanged.
- **Tone:** world graded dark with A's lighting model. One baked mask holds a 90 % darkness layer, a toon-banded hero-radius light, a heavier vignette,
  and coloured pools (cold fluorescent, cyan monitor glow, red emergency lamp and demon glow, loot glow). Blood decals, wall smears and tile scuffs added.
  Outlines, flat colours and silhouettes are kept.
- **Readability:** each actor gets a 2 px rim ring drawn from a silhouette pass under the normal pass (hero near-white, zombie lime, demon red, manager amber).
  Hero is bigger (+10 %), brightest and warmest (white shirt, royal-blue suit, yellow tie, cyan lanyard); the zombie is a darker, ragged green.
  Loot labels are about 60 % of nameplate size (serif italic for Unique) and are placed once per layout by a small collision pass against actors, nameplates,
  the damage-number zone and the HUD, with a leader line when displaced. The damage number drifts up-right, and the Zombie nameplate sits under its feet.
- **Rarity (NFR-A03):** Okabe-Ito sky blue / yellow / vermillion. Simulated deuteranopia: Rare-vs-Unique colour difference dE 30 (C: 18), lightness 90 vs 61;
  protanopia dE 49 (C: 30). Markers (diamond, star, hexagon), border styles (plain, double, notched with white inner line) and beam shapes are kept.
- **HUD:** health is a coffee mug with a heart glyph and bubbles, mana is a water-cooler jug with a drop glyph and ripples; both show `current/max`.
  XP bar shows `LEVEL 7` and `38% to level 8`; skill bar has key badges outside the icon area, names under the icons (desktop), and a cooldown number.
- **Phone (390 and 360 px):** all 6 slots, full-width skill bar, globes above the bar corners, labels clamped 8 px inside the viewport, no horizontal scroll.
  The scene is cropped to the action, which leaves empty dark area above it on tall phones (deliberate; no extra tiles drawn).
- **Performance:** world, light mask and HUD frame are baked per layout; labels and nameplates are pre-rendered sprites; only the fluorescent flicker, actors,
  liquid, effects and the cooldown are drawn per frame. Measured in headless Chromium software GL, 1280x800: C2 about 54 fps (range 45 to 60 over repeated runs),
  C 27 to 30 fps in the same run. Still a pessimistic number, not real hardware.
- **Trade-offs:** actors are drawn after the darkness (self-lit, with only a small dimming for the far ones), so they do not receive the coloured pools; the look
  is "cel-lit" rather than physically lit. Each actor is drawn twice (ring + body), which is the main per-frame cost (about 8 fps) and the thing to watch with 50 monsters;
  a sprite cache per monster type would remove it. File size 58 KB (limit about 60 KB).
- **Effort for a whole game:** M, unchanged from C; the lighting bake and the placement pass are reusable engine parts.
