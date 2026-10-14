# PERF-R6: fps50 variance and headroom (round 6)

## Measurement (before), 5 runs, load average 0.4-1.2 (quiet)
fps50 (full fx): 38.9, 41.9, 39.1, 40.7, 41.6 (median 40.7, min 38.9); lowFx 49.7, 55.8, 54.5, 49.7, 59.0.
Frame ms p50 16.7-33.3, p95 33.4, p99 33.4-50.0, max 50.1. Render() JS 3.3 ms avg (p95 4.7-6.0).
Inside the measured window: 0 lazy atlas draws, 0 silhouette builds, 0 heap drops (no GC), heap growth 0.

## Cause
Not first-use draws, not GC, not the scene changing. Frames are vsync-quantised (16.7 / 33.3 / 50 ms) and the raster, not the JS, decides which one a frame gets:
`getImageData` after `render()` shows 15-19 ms of raster per frame at 1080p full fx against 3-6 ms of JS. 17 ms is the 16.7 ms budget, so a few ms of
machine noise flips many frames to 33 ms (fps50 swings 38 to 46 with the same code). Raster breakdown (skip-one-category, full fx, 1920x1080):
darkness mask draw 6.5 ms (a bilinear 2x upscale of a screen-sized area every frame), multiply tints 3.6, alpha source-over (shades, washes, shadows) 3.5,
opaque sprites and tiles 2.7, additive pools 2.

## Fixes
1. Mask fast path (src/render/light.js `drawMaskFast`): the upscale is done once per bake into a device-resolution canvas 1.5 screens wide and high; each frame copies it 1:1 at a whole device pixel (1 ms instead of 6.5 ms). Falls back to the old draw when the hero is outside the middle half of the screen, the transform is not a plain scale, or the copy would exceed 9 M device pixels (36 MB). Memory: 18.7 MB at 1920x1080 dpr 1.
2. CR6-04: `warmFrames` (src/render/world.js, called from `drawWorld`): each frame, 1.5 ms of budget draws the lazy frames of the monster types on the floor (idle, walk, attack, all 8 directions; death is a single sprite a kill and is left lazy) and of the hero class. Per floor and on demand, not at boot (atlas build stays 0.4-0.5 s). `warmHero` is superseded by it (it has no caller; left in place).
3. CR6-03: `lazyDraw` (vector/index.js) saves and restores the ink factor and texture resolution (`restoreInkScale`, `texRes` added to draw/shapes.js, draw/textures.js).
4. CR6-12: silhouette and outline caches are two-level (mode, colour / colour, width): no string built per lookup.
5. bench: frame p50/p95/p99/max, frames over 25 ms, lazy draws and silhouette builds inside the window, heap drops (GC), load average; the window starts after the lazy warm has finished; new "floor load" section (floors 2 and 5, 180 frames with a tick a frame). Atlas debug counters in `window.__atlasStats`.

Tried and dropped: opaque canvas (`alpha:false`) on the main canvas: no gain (an earlier +13 fps reading was an artefact of applying it to every canvas). Trimming actor blits to the sprite's pixel box: no measurable gain, edge pixels differ by up to 15/255; reverted.

## After, 5 runs
Load average 2.5-5.2 during the runs (a tester and a reviewer were running; it never dropped below 2 in 12 minutes), so these numbers are pessimistic:
fps50 52.2, 46.5, 58.1, 56.2, 46.8 (median 52.2, min 46.5); lowFx 60, 60, 60, 60, 59.5. Frame p99 33.3-33.4, max 33.3-33.5, frames over 25 ms 4-42 (before 67-79). In-window lazy draws 0.
Target (median >= 48, none below 42): met under load. The orchestrator's quiet run is the gate.

## Floor load (informational, load 1.7-4)
Floors 2 and 5, one tick a frame (double render, so p50 is 50 ms for both builds): without warm 639 / 869 lazy draws in 180 frames, worst step+render 13.5-17 ms; with warm 478 / 667 lazy draws, worst 13-17 ms. First-use draws never made a hitch above about 17 ms in these scenes; the warm moves the rest off the first sight of a type.

## Pixel proof
Frozen frames (performance.now and rAF pinned, manual clock, 14 monsters) of 8 scenes (floors 1, 3, 5, 9; zoom 1, 1.2, 1.8; lowFx; high contrast; dpr 2; 1920x1080), old draw vs mask fast path: 0 differing pixels at zoom 1; elsewhere 1.0-3.2 % of pixels differ with max delta 3/255 and mean 1/255 (the mask is placed at a whole device pixel instead of a fractional one). Warm and cache changes draw the same sprites earlier, no pixel change by construction. Scripts: scratchpad only (frozen.mjs, diff.mjs).

## Not done / notes
- The remaining raster cost is per-draw (about 1000 draws a frame, 6-8 per lit actor: sprite, shade, multiply tint, wash, restore pass). Fewer draws would need baked lit sprites (cache keyed by sprite, shade, tint) which costs memory and first-use time; not attempted.
- A temporary one-line edit of src/game.js (`alpha:false`) was made and reverted; if a commit snapshot caught it, the working tree is the correct state (line 25 is `canvas.getContext("2d")`).
