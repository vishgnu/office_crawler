# R8 adversarial progress (test-engineer)
- 2026-10-15: stale checks updated (adv-r7 e2e handin / nocheat / toast / slots, 8 todo flags of adv-r7-quests and adv-r74-quests re-expressed for owed items, floor 1, the belt and the legacy golden); adv-r7 257/257.
- new: test/adv-r8-owed.test.js, test/adv-r8-core.test.js, test/adv-r8-ai.test.js, e2e/adv-r8.mjs (registered in run-all, 480 s).
- findings ADV-R8-01..03 (todo in unit tests); docs/reviews/R8-adversarial.md.
- verify: npm test 3x (1281 tests, 1277 pass, 4 todo each time), build, npm run e2e (see the report).
