# Brief: art direction

## Question being decided
Which art style should the whole game be built in? The customer wants "nice graphics and sound" and everything generated
by us (no external assets, no fonts from CDNs, no image files; see addendum in `../../00-brief.md`). The style choice
fixes the renderer design, the asset pipeline (all drawn in code), the lighting approach, the HUD look and the effort of every
later art task, so it is cheaper to decide now than after the first slice.

## Requirements involved
- R-070 health and mana gauges (here drawn as glass globes with a liquid level; R-070's office-vessel idea, e.g. coffee cup / water jug, is not yet applied)
- R-071 skill bar (5 icon slots plus one empty slot, XP bar, level)
- R-112 HTML5 canvas 2D renderer, no plug-ins
- NFR-A03 colour-blind-safe loot and UI (rarity is shown by colour, marker shape, border style and beam shape)
- NFR-L01 no third-party names, assets or text (everything on screen is drawn procedurally; names and items are original)
- NFR performance target: 60 fps on a mid-range laptop (see "Performance" below)
- Sound (R-080) is not part of this topic; it is a separate synthesis question.

## What all three variants share (same content, different style)
Each file is one `<canvas>` living style tile, animated with `requestAnimationFrame`:
- an isometric 2:1 slice of an office level gone wrong: carpet tiles, cubicle partition walls (one collapsed, one doorway),
  two desks with glowing monitors, a water cooler, a filing cabinet, a hanging fluorescent fixture that flickers and casts a
  light pool, floor cables, a coffee puddle, stains, scattered paper
- the hero (office worker, tie, lanyard, keyboard-sword) with a breathing/bob idle and a swing every 2.0 s (wind-up, strike, recover)
- three monsters: a shambling "Zombie Intern", a hovering "Printer Demon" (paper wings, cable tentacles, orbiting sheets, chomping tray),
  a hulking "Middle Manager" (elite, binder club)
- three loot drops, each with a floor ring, light beam, floating label and sparkles:
  Magic "Sturdy Lanyard of Focus" (blue, diamond marker, plain border, thin beam),
  Rare "Ergonomic Chair of Haste" (yellow, star marker, double border, wide beam),
  Unique "The Corner Office Keycard" (orange, hexagon marker, notched double border, widest beam with rising chevrons)
- a hit effect when the swing lands: flash, damage number, spark and paper-scrap burst, slash arc, target recoil and flash
- bottom HUD: health and mana globes with an animated liquid surface, skill bar with drawn icons (stapler strike, reply-all, coffee break,
  mute shield, meeting invite), a cooldown sweep on slot 3, XP bar, level
- lighting: darkness with a light radius around the hero, the flickering fluorescent pool, monitor glows, cooler, demon and loot glows

## How to view
Open `A.html`, `B.html` or `C.html` directly from disk. Everything is inline; no network.
`?frame=N` renders deterministic frame N (60 frames per second of scene time) and stops animating; this is for screenshots.
Good frames: `?frame=92` (just after the hero's hit lands: damage number, particles, flash), `?frame=20` (idle),
`?frame=70` (sword raised in wind-up). `window.__ready` is set after the first frame.
The attack loop is 2.0 s; the hit lands at 1.42 s of each cycle.

## Common technique (so the comparison is fair)
Same scene description and animation code in all three; only the renderer differs (materials, shading, outlines, lighting, HUD, text).
Static geometry (floor, walls, furniture, decals) is drawn once into a cached layer and re-drawn only on resize.
Responsive from 390 px wide up; the scene scales with the window and the HUD scales with the viewport height.

## Performance
Measured in headless Chromium with software rendering (no GPU, 1440x900, worst case): A and C about 14 ms of frame work, B about 4 ms.
With a GPU-backed canvas on a laptop this should be well inside 16 ms, but it has not been measured on real hardware
(open question for the Spec phase). B is cheapest because it renders 320x180 pixels and scales the result.
