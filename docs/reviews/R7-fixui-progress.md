# FIX-R7-UI progress

- done: CR7-04 / ADV-R7-02 toast lane (src/game.js: quest lines hold for config.quests.toastMs, later lines wait and are shown and announced one after the other; same-quest waiting line replaced, plain waiting lines dropped by a quest line, bag-full refusal does not hold); next: ADV-R7-04
- done: ADV-R7-04 focus return (src/ui/panels.js: the dock opener is remembered before the re-render, restored when all drawers are closed; covers the phone and all drawers); next: ADV-R7-05
- done: ADV-R7-05 reduced motion = option OR matchMedia (game.reduced() in src/game.js drives fx.reducedMotion, shake, flash, hurt vignette; questmark.js unchanged); next: ADV-R7-06
- done: ADV-R7-06 bag-full alert clears when the bag has fewer items than at the refusal (syncUi); next: CR7-07
- done: CR7-07 bench: FAIL if __atlasStats is missing or warm-up not finished in 40 s; floors 2 and 5 ahead: lazy draws <= 60 (FAIL), p99 <= 34 ms (WARN, FAIL with BENCH_STRICT=1); next: rewardSummary
- done: UI reward text reads core rewardSummary(id) (src/ui/journal.js rewardLines, used by questdialog); no formula copied; next: shots and verification
- done: e2e/r7fix-ui-shots.mjs; docs/shots/r7fix-ui-toast-1-quest-line.jpg, -toast-2-levelup-after.jpg, -phone-journal-open.jpg, -phone-focus-returned.jpg (all viewed)
