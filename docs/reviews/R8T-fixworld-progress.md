# FIX-WORLD-R8T progress
- done: G-1 magic trim gets dark flank + blue + white core line (gearkit.js trimOver); next: G-2
- done: G-2 unique body: rim and vermillion line on shoulders and hem only, centre open (gearparts-armour.js bodyUnder/bodyOver); next: G-3
- done: G-3 wrist brace slim band (3.4 x 7.2 px), no yellow box; G-4 SR cap back: panel seams + dark arc under the dome; next: wish
- done: wish common-tier silhouette: torso ext/shoulder/hem widened on knit, jacket, vest, suit (art-sheet check: 0 clipped, 0 failures); next: N17
- done: N17 quest elite (champion with .quest) drawn at 1.14 (sprite, ring, status, plate height), world.js + labels.js; next: P1
- done: R8-P1 finding: steady-state gear path (gearTick 6 compares, table lookup, one blit) is as cheap as plain (render avg 4.0-4.8 ms both); the geared scene's dips came from the budgeted warm (80 bakes at ~4 ms, 0.7 ms credit) still running inside the 150-frame window. bench now waits for builds to stop (bench.mjs). Under load 9-13 fps numbers are noise (36-59 on identical scenes); orchestrator quiet run decides.
- tests: test/render-r8t.test.js
