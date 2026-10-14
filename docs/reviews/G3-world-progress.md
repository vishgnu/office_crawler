# WORLD-FIX progress (round G, second fix round, G3)

- done: F1 root cause (loot keep-out used the logical hero tile, the sprite is drawn at the interpolated position: tag sat on the hero) -> fx.heroS = drawn hero position (world.js), keep-out rect from hero head height, hero never relaxed; enemy bodies avoided (relaxed only for rare/unique/hovered); next: F4.
- done: F4 gap 6 px (was 2.5) plus sideways slide past the blocking tag (<= own width + 6); CR-14 loot layer rewritten (reused records/orders/rects, sort only when set or hero tile changes, crowd choice without filter+sort); next: F2.
- done: F2 actors in a pool are redrawn at 72 % over the additive pass (light.after hook, world.restoreActors), keeps shade + multiply tint; dark suits stay dark, pale actors keep faces; next: F3.
- done: F3 leader line dropped or plate moved beside the head when the line would cross a body or the hero (labels.js lineCrossesBody); FM face (white eyes, 2.5 px pupils, thin brim); Pallet Slam VFX (flash, thick ink ring, dust clouds, 900 ms). Note: the G2 review pressed Digit1 (belt slot) not F1, and F1 with no hover tile is rejected for area-at-target skills; real cast verified via input {t:"cast"}.
- done: test/render-g3.test.js (5 tests), shots docs/shots/g3-{before,after}-*, g3-fm-face-1x, g3-skill-f1-fm-1x; e2e render 29/29, replay 5/5, polish 20/20; next: report.
