# STUTTER-R7: frame cadence after entering a floor (round 7, R7-2)

## Cause
On entering a floor the monster types of that floor are drawn for the first time: 4 types on floor 2, 8 on floor 5, 112 lazy sprites a type (idle, walk, attack x 8 directions), about 1.1 ms each (figure plus rim bake). `warmFrames` (R6) spreads them at 1.5 ms a frame, which on a machine whose frame is already near 16.7 ms flips frames to 33 / 50 ms for several seconds, plus one hitch where a not yet warm sprite is shown.
Measured with the old method (test mode, one tick and one extra render by hand per real frame, so p50 is about twice real): cold floor 2: 480-596 lazy draws, p99 83 ms, max 83-133 ms; floor 5: 675-706 draws.

## Fix (src/render/world.js `warmAhead`, called by `warmFrames` once the current floor's frames are drawn)
The monster set of a floor is every type with `minDepth <= depth` (src/core/gen/population.js:14), so the set of floor depth+1 is known while the hero is still on floor depth. After the floor's own frames are drawn and a 240-frame (4 s) pause after each floor change, the idle, walk and attack frames of the next floor's types are drawn at 0.7 ms a frame. A normal stairs descent then opens on a warm atlas (0 to 60 lazy draws in the first 5 s instead of 480-600). Drawing a sprite earlier changes nothing on screen. No change in game.js or screens.js was needed (the elevator/stairs transition is not used as a hook; see `needs` in the hand-back).
Not done: lazy death frames, mirrored facings (the figure drawing is not mirror-symmetric per direction, so mirroring would change pixels), shared rim bakes (they would change pixels).

## Bench (bench/bench.mjs, floor load section)
Rewritten: real frames (`realtime=1`, the game's own loop does the ticks and renders), 300 frames after the load, "ahead" (hero waited on the floor above until the idle warm was done: a normal descent) and "cold" (teleport right after the first frames: worst case). The R6 method is kept as "stepped" lines for comparison. `NOAHEAD=1 npm run bench` switches the new warm off (the R6 behaviour).

## Numbers, 5 runs, load 2.3-7.5 (the machine never dropped below 2; other packages were running), so pessimistic
After: floor 2 ahead frame p99 33.4 in 5 of 5, max 33.4 / 33.4 / 66.6 / 33.5 / 50 (median 33.5); floor 5 ahead p99 33.3-33.4, max 33.4 in 5 of 5, 0 lazy draws; cold floor 2 p99 33.4-49.9, max median 49.9 (33.4-66.6); cold floor 5 p99 and max 33.4. fps50 53.3, 44.2, 39.8, 46.8, 50.0 (median 46.8, min 39.8; load 3-5, unchanged render path, load dominated); atlas build 436-653 ms.
Frame times are vsync steps (16.7 / 33.3 / 50 ms): 33.4 is two steps, the p99 floor of this headless software-GL machine at 1080p-class raster under load, not a draw hitch.

## Pixel proof
No sprite is drawn differently: the same lazy draw function runs earlier; only when changes. Test: test/render-r6.test.js (STUTTER-R7) checks the set (minDepth <= depth+1 only, each key drawn once, deeper types untouched, a deeper floor queues its own set).
