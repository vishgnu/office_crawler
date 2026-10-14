# R4 core progress (CORE-R4, implementer)

Progress lines (L-15): one line per finished item, "done: X; next: Y".

- done: read ADR-0005/0006, contract, spec 11, existing core/save/bot; v1 Clerk fixture test/fixtures/save-v1.json generated with the pre-R4 code; next: R4-1 data model (classes, trees, curves, strings, name, save v2 migration).
- done: R4-1 data (classes, 30 skills as data, curves, strings, name, treeview, save v2 + v1 migration), R4-2/3 runner (skillfx, statuses, allies, zones, dash, crit, resist), R4-4 class affixes; core imports load; next: fix legacy tests the ADRs supersede, new tests, slots store, bot per class.
- done: legacy tests adapted (character, progression, skills, projectiles, combat, inventory, s2-fix, s3-final, ui-hudstate, ui-itemview), bot policy generic per class (bot/policy.js + run-headless --class/all), rayClear fix for projectile LOS; headless bot wins to the boss with all 3 classes; next: golden hash, bot/audio test updates, new R4 tests (classes, trees, skillfx, allies, zones, respec, affixes, migration, name), slots store (src/save/slots.js).
- done: src/save/slots.js (five-slot store), src/save/session.js (session commands as pure functions for the shell), test/save-slots.test.js (21 tests); next: remaining new R4 tests, golden hash + per-class replay hashes, e2e/hook notes, final runs.
- done: test/classes, skilltrees, learn-respec, skillfx tests green; next: buffs-allies-zones-dash, basic-attacks, affixes-class, migrate-v2, name, determinism per class, bot-class tests; golden hash; e2e check; final 3x npm test + bot runs.
