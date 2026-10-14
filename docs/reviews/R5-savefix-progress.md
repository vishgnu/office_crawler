done: core fixes (setName whitelist, name marks, xpNext), format.js (safe ids, skill/bar/points, options strip); next: slots.js/session.js rewrite (owner heartbeat, notices, migration, rename, prev), main.js, game.js
done: slots.js/session.js/main.js/game.js first pass; next: run tests, fix old tests, delete createSaveStore, add tests, ADR amendment
done: createSaveStore removed + tests ported (save.test, s3-final); next: new tests (save-fix.test.js), ADR amendment, e2e
done: new tests test/save-fix.test.js (23), npm test 3x green except ui-r5 (UI-FIX file); next: ADR-0006 amendment, build + e2e
done: ADR-0006 amendment, pagehide/visibility release fix in main.js, e2e hook/replay green; adv-r5 and r5ui reds are caused by script assumptions / UI-FIX work; next: report
done: restorePrev confirm swap (+playing guard, tests); owner after reload verified 'none' in browser (live second tab = 'other', correct); next: verify
done: restore swap, future-beat stale (ADV-R5-13), r5ui 106/106, hook ok
