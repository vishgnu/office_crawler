# 09 Save and load

Areas: I Save/load (R-090..R-093), NFR-D01..D04. Contract: `10-tech-and-testability.md`. Per Q4 PROXY default A: autosave to browser local storage at town, floor change and exit; one character slot; export/import file. Everything here is slice S3.

### R-090 Save character and progress in the browser (must · MVP)

- **AC-R-090-1** `S3` `E2E` — Given a game with level 7, changed attributes, 3 learned skills, items in inventory, equipment, belt and stash, gold 321, `deepestDepth 4` and `bossDefeated` false, When `save.write()` and the page is reloaded and "Continue" is chosen, Then these fields in `getState()` are deep-equal to before: `player.level, xp, attrs, attrPoints, skillPoints, skills, skillBar, gold, class`, `inventory`, `equipment`, `belt`, `stash`, `deepestDepth`, `bossDefeated`, `options`.
- **AC-R-090-2** `S3` `Unit` — Given the save text, When parsed, Then it is JSON with an integer `version` equal to `config.saveVersion`, and contains exactly the keys of the documented save schema (no transient fields like `monsters`, `projectiles`, `floaters`).
- **AC-R-090-3** `S3` `Unit` — Given `serialize(state)` then `deserialize(text)`, When applied to 200 random states from seeded play, Then the result equals the input restricted to saved fields, and `serialize` is stable (same state, same text).
- **AC-R-090-4** `S3` `E2E` — Given a saved game, When `localStorage` is inspected, Then the save is stored under one documented key and size at most `config.saveMaxBytes` (QF-09-1).
- **AC-R-090-5** `S3` `E2E` — Given no save, When the title screen is read, Then "Continue" is disabled/absent.
- **AC-R-090-6** `S3` `E2E` — Given storage that throws on write (quota exceeded or blocked, simulated), When autosave is triggered, Then the game keeps running (`scene` unchanged), `ui.notice` shows a save-failed message, and the last good save is untouched.

### R-091 Autosave on leaving a floor, at town, and on exit (must · MVP)

- **AC-R-091-1** `S3` `E2E` — Given a game on floor 1, When the player takes the stairs to floor 2, Then a save write occurs (`save.read().savedAtTick` equals the arrival tick or storage content changed) before the next `step`.
- **AC-R-091-2** `S3` `E2E` — Given the player on floor 3, When they arrive in town (stairs or portal), Then a save write occurs.
- **AC-R-091-3** `S3` `E2E` — Given a running game, When the page `pagehide` / `visibilitychange: hidden` event fires (simulated on exit), Then a save write occurs and `getState()` after reload shows the changes made since the last autosave (for example gold gained).
- **AC-R-091-4** `S3` `E2E` — Given a save made while the player stood on floor 3 with monsters alive, When the page is reloaded and "Continue" chosen, Then the player is placed per `config.resumeAt` (`town` or `floorEntry`, QF-09-2): `depth` is 0 (town) or the floor-3 `entry`, and the previous floor mid-state (monster hp, ground items, player tile) is not restored.
- **AC-R-091-5** `S3` `E2E` — Given autosave, When 100 saves are triggered quickly, Then at most `config.autosaveMinTicks` spacing is respected or the writes are coalesced, and `localStorage` holds exactly one save (no growth).
- **AC-R-091-6** `S3` `E2E` — Given the player is dead (`scene === 'dead'`) and the page is closed, When reloaded and "Continue", Then the character is in the post-death state of AC-R-023-4 (town, hp full), not dead (QF-09-3).

### R-092 Single character slot, export/import of save as a file (should · MVP)

- **AC-R-092-1** `S3` `E2E` — Given a save, When "Export" is chosen, Then a file download starts with name matching `config.saveFileName` and its text equals `save.read()`.
- **AC-R-092-2** `S3` `E2E` — Given an exported file and a fresh browser context, When "Import" is used with that file and "Continue" chosen, Then the state equals AC-R-090-1's saved fields.
- **AC-R-092-3** `S3` `E2E` — Given a garbage file (not JSON or missing version), When imported, Then `ui.notice` shows an import-failed message and the existing save is unchanged.
- **AC-R-092-4** `S3` `E2E` — Given one slot, When "New game" is chosen with a save present, Then the game asks for confirmation before overwriting; cancelling keeps the save; confirming replaces it (only one slot exists).

### R-093 Multiple character slots (could · LATER)

LATER, no AC.

### NFR-D01 Data stored (must)

- **AC-NFR-D01-1** `S3` `E2E` — Given 5 minutes of play with saves and option changes, When browser storage is inspected, Then the only keys in `localStorage` are the documented save and options keys, `document.cookie === ''`, IndexedDB has no databases, and no key contains a user identifier, timestamp of real time of day, or any personal data (only tick counts).
- **AC-NFR-D01-2** `S3` `E2E` — Given the page, When its HTML and scripts are scanned, Then there is no analytics script, tracking pixel or consent banner.

### NFR-D02 Retention (must)

- **AC-NFR-D02-1** `S3` `E2E` — Given a saved character, When "Delete character" is chosen and confirmed, Then the save key is removed from `localStorage`, "Continue" is gone, and the options key remains (QF-09-4).
- **AC-NFR-D02-2** `S3` `E2E` — Given a save, When any amount of fake time passes (clock mocked forward 5 years), Then the save loads unchanged (no expiry).

### NFR-D03 Save format versioning (must)

- **AC-NFR-D03-1** `S3` `Unit` — Given a fixture save with `version` lower than current (`fixtures/save-v1.json` once a v2 exists; before that, a synthetic `version: 0` fixture with a migration defined), When loaded, Then it is migrated to the current schema and all character data is preserved (QF-09-5).
- **AC-NFR-D03-2** `S3` `E2E` — Given a save with `version = config.saveVersion + 1`, When "Continue" is attempted, Then the game does not crash, `ui.notice` shows a message that the save is from a newer version, the save is untouched, and "New game" remains available.
- **AC-NFR-D03-3** `S3` `E2E` — Given a corrupt save (truncated JSON, or valid JSON with wrong types), When the game starts, Then there is no uncaught error, `scene === 'title'`, a notice offers a fresh start, the corrupt text is kept under a backup key and is returned by `save.export('corrupt')`, and "New game" works without deleting the backup.
- **AC-NFR-D03-4** `S3` `Unit` — Given 20 randomly mutated copies of a valid save (flipped chars, removed keys), When loaded in Node, Then `deserialize` never throws; it returns either a valid state or a typed error `{ok:false, reason}`.

### NFR-D04 Save integrity (could)

No AC (no anti-cheat in MVP). Not tested.

## Not covered by an AC here

- R-093 (LATER). NFR-D04 (could, no anti-cheat).

## Questions for the facilitator

- **QF-09-1** Maximum save size is unspecified; local storage is typically 5 MB per origin.
- **QF-09-2** R-091 note says "resume in town / floor entry". Which one (`config.resumeAt`)? Q4 says "resume in town or at floor entry".
- **QF-09-3** Should a save made while dead resume in town? (The death penalty is none per Q7.)
- **QF-09-4** Does "Delete character" also reset options (volume, keys)?
- **QF-09-5** Until a second save version exists, migration can only be tested with a synthetic fixture; accept?
- **QF-09-6** Corrupt-save "backup key": the NFR says "keeps the bad file for export". How many backups are kept (one proposed)?

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-090 Save character and progress in the browser (must · MVP) | R-090-1, R-090-2, R-090-3, R-090-4, R-090-5, R-090-6 | S3 | E2E, Unit |
| R-091 Autosave on leaving a floor, at town, and on exit (must · MVP) | R-091-1, R-091-2, R-091-3, R-091-4, R-091-5, R-091-6 | S3 | E2E |
| R-092 Single character slot, export/import of save as a file (should · MVP) | R-092-1, R-092-2, R-092-3, R-092-4 | S3 | E2E |
| R-093 Multiple character slots (could · LATER) | none (see below) | - | - |
| NFR-D01 Data stored (must) | NFR-D01-1, NFR-D01-2 | S3 | E2E |
| NFR-D02 Retention (must) | NFR-D02-1, NFR-D02-2 | S3 | E2E |
| NFR-D03 Save format versioning (must) | NFR-D03-1, NFR-D03-2, NFR-D03-3, NFR-D03-4 | S3 | E2E, Unit |
| NFR-D04 Save integrity (could) | none (see below) | - | - |

Total ACs in this file: 24 (S1 0, S2 0, S3 24).
