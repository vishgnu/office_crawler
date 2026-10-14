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

## C3: stylised vector, round 3 "more detail and polish" (`C3.html`)
Answers the real customer's fifth briefing ("idea is good but more details and polishing", 2026-10-14). C2 stays the frozen identity (bold outlines, readable
silhouettes, dark grade, Okabe-Ito rarity, same actors, loot, hit FX and HUD layout); C3 adds a detail layer on top. Switches: `?scene=office|basement|boardroom`,
`?frame=N` (+ `window.__ready`), `?compare=1` (C2 | C3 wipe, draggable divider or the range input, `&split=NN`), `?legacy=1` (every round-3 addition off, matches
C2 pixel for pixel apart from 6 e-5 of the pixels; it is what the compare view uses for the left half), `?zoom=3&focus=hero|zom|dem|mgr` (review aid, hides labels).
**What read as flat or bare in the current game shots** (final-lobby, polish-basement, s3-boss-phase2, final-champion-fight, final-inventory-compare): one repeated floor
diamond with no tile-to-tile variation; wall panels as flat slabs with only a small framed picture; grey cabinets and desks with no material feel; props sparse and
floating (no contact shadow or occlusion at wall bases); hero and monsters single-tone cel with no cloth, face or secondary motion; HUD panels flat purple with no depth.

What changed, and what each costs when ported to the game engine (S/M/L = small/medium/large, against the C2 renderer):
1. **Baked material textures** (carpet plain/twill/basket weave with mirrored tile orientation and per-tile tone drift, wood grain, brushed metal, concrete, plaster,
   wall panel, paper, cardboard): 11 procedural 64x64 alpha overlays, created once into offscreen canvases and applied as `createPattern` fills with a skew matrix per
   face type (top, left, right). Per-frame cost 0 (static layer). Port: S, one `texture(name)` + `patternFor(face)` helper, material table maps material to texture.
2. **Second shade level + ambient occlusion:** every static vertical face gets a base-darkening gradient on top of the existing flat shade steps; floor gets wall-base AO
   strips and soft contact shadows (four stacked rounded rects) under every prop; bevelled tile seams (dark joint, lit up-left edge). Baked. Port: S for the gradient,
   S for contact shadows if props already have footprints.
3. **Light spill and pools:** extra baked pools in the existing light mask (second fixture pool, monitor floor spill, desk-lamp pool, green exit-sign pool, window light shaft
   across the floor, a brighter inner band on fixture pools); screens spill a cyan glow onto the desk (additive, per frame, 2 sprites). Cost: M-/S (more entries in the
   same bake; the dynamic part is 2 additive draws). Port: S, the bake already exists.
4. **Density (office):** a second fixture, door ajar, door mat, runner carpet with stitch lines, hazard tape, painted chevrons, footprints from the door, coffee rings, scuffs,
   cable tape wraps, plants, bin with paper, wet-floor A-frame sign, box stack, extinguisher, desk lamp, mugs, sticky notes, keyboard keys, filing-cabinet drawers with labels,
   glass partition panes, skirting boards, sockets, vents, wall clock, framed chart, three humour posters, cork board with notices and sticky notes, whiteboard, a skyline window
   with reflections, exit sign. All static. Port: M. This is content, not engine: a prop kit of about 40 sprites or draw functions plus a decal/wall-item placement list per room.
   Wall items draw in a small "wall space" transform (1 unit = 1 design px), which is the reusable piece (S).
5. **Two more scenes** from the same engine and actors: **basement** (concrete, cracked and stained, safe-lane paint, drain, puddles with glint, pipe runs, server racks with
   blinking LEDs, filing cabinets, shelving, boiler, barrels, caged bulbs, breaker panel, signage) and **boardroom** (burgundy lattice carpet with gold inlay and a bordered rug,
   panelled walls, glass-topped table with laptops, high-back chairs, credenza with trophies, projector slide, framed founders, curtained windows, chandeliers). Port: M each
   (content) on top of the shared S engine work; a per-scene table holds palette overrides, textures, fixtures and light list.
6. **Characters:** hero gets eyebrow, nose, smile, blush, lens glint, hair highlight strands and cowlick, headset band and boom, collar, lapel notches, pocket square, tie
   stripes, belt buckle, cuffs, trouser creases, shoe laces and soles, badge photo; zombie gets tears, stitches, eye bags, fangs, drool, skin mottling; manager gets nose,
   stubble, comb-over strands, sweat drop, pinstripes, buttons, folds, belt buckle, sticky note on the binder; the printer demon gets a control panel (flickering LCD,
   buttons, blinking LED), vents and CMY toner stripes. Detail is skipped in the silhouette (rim) pass. **Secondary motion:** tie sway (hero, zombie, manager), cowlick and
   zombie hair-tuft bob, comb-over sway and sweat drip, LCD flicker, monitor scan band and glitch rows, rack LEDs. Cost: about +2 ms per frame for four actors (see below).
   Port: M, and the right place to cache: per-monster-type sprite caches of the static detail with only the swaying parts drawn live (that was already the recommended fix for
   50 monsters, and it now matters a little more).
7. **Outline weight** is clamped (`clamp(2.0*zoom, 1.6, 4.2)` px) instead of growing linearly, so at game scale (hero about 100 px) the line stays about 2.4 px and does not
   get heavier on big screens. Port: S.
8. **UI chrome:** panel with top-to-bottom sheen, brushed-metal grain, inner shadow, top bevel and a stitched dashed border; skill slots with inner shadow, bottom light,
   corner rivets; XP bar with inner shadow and divider; mug with glaze gradient, stitched bands, speckle, rivets; jug with ribbed plastic, rivets, brushed rim; icons snapped to
   whole pixels, with drop shadow and a specular stroke. Baked once per layout, 0 per frame. Port: S (needs the HUD bake that C2 already has).
9. **Ambient motion:** dust motes drifting and twinkling inside fixture and hero pools (about 40 tiny additive dots per frame), a second fluorescent with its own flicker pattern,
   cage-bulb and chandelier glow, blinking rack LEDs. Cost S.
- **Performance** (headless Chromium, software GL, 1280x800; compositor-capped at 60): C3 office 58, basement 59, boardroom 60 fps; C2 60 fps on the same machine.
  Render cost per frame including a forced flush: C2 11.7 ms, C3 office 13.5 ms, basement 13.8 ms, boardroom 12.3 ms (so about 74 fps uncapped for C3, against about 85 for C2).
  Layout/bake on resize: C2 9 ms, C3 14 to 15 ms (textures are built once, patterns re-created per zoom); not per frame.
- **File size:** 124 KB, over the ~60 KB guideline for variant files, because it carries three scenes, the texture generators, the compare view and a legacy path. It is a
  style reference, not a product file; the port does not carry the legacy path or the compare view.
- **Checks:** single self-contained file, no network references (no urls, fetch, link or script src), no ip-denylist terms, no console errors, `window.__ready` set (compare mode
  sets it when both iframes report ready), phone width 390 renders without horizontal scroll. The compare view loads this same file twice in iframes (`?legacy=1` and normal).
- **Trade-offs and risks:** (a) the grade is still dark, so floor weave and wall materials show mostly inside light pools; a brighter ambient floor is a one-number change but
  would dilute the C2 mood; (b) actors are still drawn after the darkness and do not receive pool colour, so monsters can look a touch "pasted on" next to the richer floors;
  (c) the humour posters and signs are tiny text that is readable at 1280x800 but not at game scale: they are texture, not copy to localise; (d) the basement wall pipes are
  busy behind the racks; (e) review at 100% size, the compare divider cuts through the hero at the default 50% split (use `&split=30` or drag).
- **Screenshots:** `shots/r3/C3-default-f92.jpg`, `C3-basement-f92.jpg`, `C3-boardroom-f92.jpg`, `C3-compare-f92.jpg`.
