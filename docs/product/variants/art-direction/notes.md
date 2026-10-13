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
