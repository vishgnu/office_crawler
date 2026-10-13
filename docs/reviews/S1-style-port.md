# S1 style port: C2 into the game (status of the port checklist)

Date: 2026-10-13. Style frozen as C2 (`docs/product/variants/art-direction/decision.md`). Checklist from `review-r2-craft.md`.
Screens: `docs/shots/s1-ported-{1920x1080,1280x720,390x844}.jpg` (the real game, a fight caught on the tick a hit lands).

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Graded palette, rim colours, rarity trio | Done (rarity colours stored, used from S2) | `styles/vector/palette.js` |
| 2 | Figures with 2 px rim baked into the atlas sprite (one blit per actor); hero x1.10, yellow tie, cyan lanyard, headset, keyboard sword; zombie darker, ragged hem, spiky hair, mug; Printer Imp with paper wings, cables, red eyes, paper mouth | Done (Middle Manager is S2: not added) | `styles/vector/characters.js`, `index.js` (`figureWithRim`) |
| 3 | Baked half-res light mask: 90% dark, banded hero radius, warm tint; coloured pools (cyan monitors, cold green-white fluorescent with hard bands and flicker by one alpha, red lamp on the imps), max 4 lights; `lowFx` | Done | `render/light.js` (`?lowfx=1`) |
| 4 | Grime, blood and scuffs baked into floor variants 3-5 and wall variants 1-2; teal walls with orange trim; edge lines that survive the grade | Done | `styles/vector/tiles.js`, `world.js` |
| 5 | Actors tinted from the light model at the feet (shade and pool-colour silhouettes, cached per sprite) plus contact shadows | Done | `light.js sample()`, `world.js addActor` |
| 6 | Nameplates: pre-rendered, above the head, anchored to the logical position at integer px, collision pass (plates, hero, HUD, 8 px safe area), leader line when moved, at most 5 plates | Done (loot plates are S2) | `render/labels.js` |
| 7 | Loot rings, beams, markers | S2 (no loot yet) | |
| 8 | Floaters: larger outlined number spawning above the head and clear of the plate, drifting up-right in about 560 ms, hit flash, hit-stop 55 ms (95 ms on a kill), paper burst, impact star | Done | `render/fx.js`, `game.js` loop |
| 9 | HUD: coffee mug (heart, bubbles) and water-cooler jug (drop, ripples) with numbers inside, 8 px inset; XP bar with level text; skill bar with F1-F4 key badges and names; belt 1-4; target bar | Done (4 skill slots, see deviations in the hand-back) | `render/hud.js`, `ui/layout.js`, `styles/vector/ui.js` |
| 10 | High-contrast mode (`?hc=1`): solid black plates with white border, no pool tint, flat lighter darkness, 3.5 px rim, white panel borders; plate text 4.5:1 unit-tested | Done (text-size option and colour-blind checks on the in-game shot not done) | `palette.js plateHc`, `main.js` |
| 11 | Safe-area clamp, plate and text floors below 1024 px | Done | `labels.js`, `layout.js fontPx` |
| 12 | Perf gate: 50 monsters on screen, software GL | Done: see `npm run bench` (1080p at zoom 1: about 47 fps full fx, about 52 fps lowFx) | `bench/bench.mjs` |
| 13 | Zoom check at the real camera scale | Done: `viewConfig.zoom = 1.8` (hero about 135 px tall at 1080p, 100 px at 720p, 55 px on a phone); rims, plates and decals verified in the screenshots | `ui/layout.js` (`?zoom=`) |

Options: `?hc=1`, `?lowfx=1`, `?zoom=N` (0.4 to 4). Camera follow is eased in real time (140 ms time constant, at most 2.5 tiles of lag); in the manual test clock it snaps, and picking always goes through the camera that is on screen.
