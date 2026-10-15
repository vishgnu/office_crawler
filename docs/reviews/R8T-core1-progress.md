# CORE-R8T-1 progress
- done: R8-A4 test/core-r8t1.test.js (3 classes, same and alternating far target, 60-tick click period): green first time, so no AI change; next: M1
- done: R8-M1 was already in core (questview.mapMarkers, test r8-core1); added snapshot-side test; no core change; next: G-5
- done: G-5 src/testhook/index.js uniqueCheck: giveItem/spawnItem with rarity unique fail loudly ("no unique ...", "already found", or fellback:true); tests added; next: ADV-R7-10
- done: ADV-R7-10: the todo in test/adv-r74-quests.test.js asserts the generator spawns >= 6; the shipped fix is topUpKills on accept, so changing the generator would move floor 5/6 for 12 of 700 seeds (rng stream, goldens). Left the generator; added a passing test of the real guarantee (700 seeds). The todo stays (file owned by the test-engineer): it should be rewritten to the top-up assertion; next: ASSET-LICENCES
- done: docs/ASSET-LICENCES.md (no external asset; evidence listed); next: full suite x3
