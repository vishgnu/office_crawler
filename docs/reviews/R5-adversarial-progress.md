# R5 adversarial progress (test-engineer, ADVERSARIAL mode)

Progress lines (L-15): one line per finished item, "done: X; next: Y".

- done: read ADR-0005/0006, spec 11, contract, notes, src/save, src/core skills/progression, ui (charselect, slots, tree, options, screens), main.js, game.js; probed store, schema, migration and UI in node and Chromium; next: test/adv-r5-save.test.js.
- done: test/adv-r5-save.test.js (25 cases: 17 pass, 8 todo for ADV-R5-01..05, all reproduced first in a probe); next: test/adv-r5-core.test.js (trees, respec, aura, xp, names, class smoke).
- done: test/adv-r5-core.test.js (17 cases: 15 pass, 2 todo for ADV-R5-05 and ADV-R5-10: points conservation x3 classes x29 levels, learn/respec/assign/aura rules, xp edges, per-class determinism, hostile cast tiles, bot smoke); next: e2e/adv-r5.mjs.
- done: e2e/adv-r5.mjs (110 checks pass, 12 expected failures XFAIL for ADV-R5-01/02/06/07/08/09/11; 9 screenshots in docs/shots/adv-r5-*.jpg, all viewed) and registered in e2e/run-all.mjs (script entry plus a 420 s timeout entry); next: docs/reviews/R5-adversarial.md final numbers, then verification (npm test x3, npm run e2e once).
- done: docs/reviews/R5-adversarial.md (11 findings: 4 major, 7 minor); next: verification run.
- done: verification: npm test 3x green (616 tests, 606 pass, 0 fail, 10 todo = my ADV-R5 demonstrations), npm run e2e OK (13 scripts incl. adv-r5 110/110, 12 XFAIL); next: nothing, report returned.
