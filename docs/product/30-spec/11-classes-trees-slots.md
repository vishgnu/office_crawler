# 11 Classes, skill trees, character selection and save slots

Areas: M (R-200..R-234), NFR-D05, NFR-D06, NFR-P06, NFR-A07. Date: 2026-10-14. Author: spec-writer. Status: draft for the architect. Inputs: `../20-requirements.md` area M, `../40-nfr.md`, `../circles/circle-02.md` (PROXY answers, provisional; final class names ESCALATED), `../00-brief.md` (Third briefing, real customer: 3 classes with skill trees, a visually appealing selection screen, 5 save slots in Options). Contract: `10-tech-and-testability.md` (`window.__app`, snapshot, `config.*`).

## Conventions in this file

- Rounds replace slices here. **R4** core: class registry, three trees (prerequisites, tiers, level gates), point spending, respec in town, class-tagged affixes, per-character stash, five-slot storage, migration of the old single save into slot 1. **R5** UI and render: creation and selection screen, skill-tree panel, slot list in Options/title/pause with confirmations. **R6** balance parity per class by bots, polish.
- Level: `Unit` (Node, pure functions, seeded RNG, `content.*`, `config.*`) or `E2E` (Playwright via `window.__app`, `?test=1`). Anything judged by eye is marked `verify: playtest/visual review` (learning L-03) and has no numeric split.
- Names are a proposal for the architect (the Unit surface adds `content.classes`, `content.skillTrees`, `skills.learn/respec`, `slots.*`, `migrate`; the snapshot adds `player.class`, `player.skillPoints`, `slots[]`, `ui.screen`, `ui.dialog`). Numbers the requirements do not fix are `config.*` constants; the AC asserts a relation. Class ids are the working ids `facilities`, `sales`, `it` (names are working names, QF-11-1); ACs read `content.classes` rather than literal names.
- Where an AC replaces an earlier one it says so: AC-R-090-5 and AC-R-092-4 (single slot, `09-save-load.md`), AC-R-010-* and AC-R-014-* (one class, flat skill list, `06-character-and-progression.md`), AC-R-091-5 (one save key, `09-save-load.md`) are superseded for the areas stated in each AC.
- ACs are ranked within each round: the first ones listed are the ones to implement and review first. Order of importance overall: R-225/NFR-D06 (data loss), R-220/R-224 (slot isolation), R-204/R-205 (tree rules), R-221 (destructive ops).

## R4: core (class registry, trees, spending, slots, migration)

### R-200 Three playable classes (must · MVP · agreed)

- **AC-R-200-1** `R4` `Unit` — Given `content.classes`, When listed, Then `length === 3`, ids are distinct, and for each id `newGame(seed, {class:id})` gives `player.class === id`.
- **AC-R-200-2** `R4` `E2E` — Given `?test=1`, When `newGame({seed:1, class:id})` then `step(60)` for each of the three ids, Then `scene === 'floor'`, `depth === 1`, `player.class === id`, and an unknown id returns `{ok:false}` with `scene` unchanged.

### R-201 Class identity (must · MVP)

- **AC-R-201-1** `R4` `Unit` — Given the three classes, When the starting `attrs`, per-level hp/mp growth, basic-attack id and starting weapon are compared, Then the three classes differ pairwise in `attrs`, in growth and in basic-attack id, and every value is read from `config`/content (no class literal in `step`).
- **AC-R-201-2** `R4` `Unit` — Given a new character of each class at level 1 then `setLevel(10)`, When `hpMax` and `mpMax` are read, Then each equals the class's start value plus 9 times its per-level growth (relation on config, within the formula of AC-R-012-*).

### R-202 Per-class skill tree with three branches (must · MVP · agreed)

- **AC-R-202-1** `R4` `Unit` — Given `content.skillTrees`, When inspected, Then each class has exactly 3 branches, and no skill id appears in two classes' trees.
- **AC-R-202-2** `R4` `Unit` — Given a character of class X with skill points, When `skills.learn` is called with a skill id of another class, Then it returns `{ok:false, reason:'wrongClass'}`, no point is spent and `skills` is unchanged.

### R-203 Tree size and content (must · MVP)

- **AC-R-203-1** `R4` `Unit` — Given every class tree, When data is checked, Then each class has between `config.tree.minSkills` and `config.tree.maxSkills` skills (default about 10), each skill has a non-empty name and text, `maxLevel >= 1`, and per-level values for levels 1..`maxLevel` that are non-decreasing in effect, and each branch has at least one active skill (mana cost, no cooldown).

### R-204 Prerequisites and tier gates (must · MVP)

- **AC-R-204-1** `R4` `Unit` — Given a skill whose prerequisite (one earlier skill in the same branch) is at level 0, When `skills.learn` is called with points available, Then `{ok:false, reason:'prereq'}` and `skillPoints` is unchanged.
- **AC-R-204-2** `R4` `Unit` — Given a skill with level gate `reqLevel` and the character one level below it with the prerequisite met, When `skills.learn` is called, Then `{ok:false, reason:'level'}` and no point is spent; at `reqLevel` the same call succeeds.
- **AC-R-204-3** `R4` `Unit` — Given every class tree, When graph-checked, Then every prerequisite id exists in the same branch, the graph has no cycle, each branch has 3 tiers whose gate levels are strictly increasing, and tier-1 skills have no prerequisite.

### R-205 Skill points and spending (must · MVP)

- **AC-R-205-1** `R4` `Unit` — Given a character of each class levelled 1 to 30 with random valid learns after each level-up, When points are counted, Then at every level `spent + skillPoints === levelsGained * config.skillPointsPerLevel` (1 per level, 29 at the cap) and `skillPoints >= 0`.
- **AC-R-205-2** `R4` `Unit` — Given a learned skill at its `maxLevel`, or `skillPoints === 0`, When `skills.learn` is called, Then `{ok:false, reason:'max'|'noPoints'}` and the state is unchanged; unspent points are not lost across a level-up.
- **AC-R-205-3** `R4` `Unit` — Given a character at level 30, When a bot learns greedily until points run out at level 30, Then at least one skill in the class tree stays below its `maxLevel` (a character cannot max everything, circle-02 Q2).

### R-207 Learned skills feed the skill bar (must · MVP)

- **AC-R-207-1** `R4` `Unit` — Given an unlearned active skill, When assigned to primary, secondary or a hotkey slot, Then `{ok:false, reason:'notLearned'}` and `skillBar` is unchanged; passives are rejected as bar targets.
- **AC-R-207-2** `R4` `E2E` — Given a learned active skill assigned to the secondary slot, When the player has the mana and uses it in combat (`step`), Then `mp` falls by its cost and its effect event appears in `events[]`.

### R-209 Respec of skill points (should · MVP · default: free, unlimited, in town)

- **AC-R-209-1** `R4` `Unit` — Given a character in town with 6 learned skill levels and bar assignments, When `skills.respec` is called, Then all spent points return to `skillPoints`, `skills` is empty, the bar entries of removed skills are cleared, and attributes are unchanged.
- **AC-R-209-2** `R4` `Unit` — Given the character on a floor (`depth > 0`), When `skills.respec` is called, Then `{ok:false, reason:'notInTown'}` and nothing changes. If `config.respec.mode` is set to `none`, the town call is rejected too.

### R-231 Items shared across classes, class-tagged affixes (should · MVP)

- **AC-R-231-1** `R4` `Unit` — Given an item with level and attribute requirements, When `canEquip` is called for each of the three classes with identical level and attributes, Then the result is identical for all three.
- **AC-R-231-2** `R4` `Unit` — Given 5000 `rollItem` calls with `ctx.class` set to each class, When affixes are collected, Then an affix tagged for class X (for example "+1 to class X skills") appears only in rolls with `ctx.class === X`, appears in at least one roll for each class, and its stat resolves to the skills of that class only.

### R-220 Five save slots (must · MVP · agreed), including per-character stash

- **AC-R-220-1** `R4` `Unit` — Given an empty fake storage, When characters are created in slots 1..5 and a sixth slot (0 or 6) is requested, Then slots 1..5 hold characters, the request for 0 or 6 returns `{ok:false, reason:'badSlot'}`, and storage holds at most 5 slot entries plus the options entry (and the one legacy backup, NFR-D05).
- **AC-R-220-2** `R4` `E2E` — Given characters in slots 1, 2, 4 and 5, When a character is created and played in slot 3 (gold gained, an item picked up, `save.write()`), Then the stored texts of slots 1, 2, 4, 5 are byte-identical to before.
- **AC-R-220-3** `R4` `E2E` — Given an item placed in the stash of the character in slot 2 and a different item in slot 4, When each slot is loaded, Then `getState().stash` contains only that character's item, and putting an item into slot 2's stash never changes slot 4 (stash is per character, circle-02 Q4/Q6).

### R-210 Character creation (must · MVP)

- **AC-R-210-1** `R4` `E2E` — Given an empty slot, When `slots.create({slot:2, class:X, name:'Y'})` is called, Then `getState().player.class === X`, the slot's stored name is `'Y'`, `slots[1]` shows class X and name `'Y'`, and the other four slots are unchanged.

### R-221 Slot operations (must · MVP)

- **AC-R-221-1** `R4` `Unit` — Given a slot-ops module with fake storage, When create on an occupied slot is called without `confirm:true`, Then `{ok:false, reason:'needsConfirm', lost:<name of character>}` and the slot is unchanged; with `confirm:true` the slot holds the new character and the old one is gone.
- **AC-R-221-2** `R4` `Unit` — Given an occupied slot, When delete is called without `confirm:true`, Then it is refused and nothing changes; with `confirm:true` the slot is empty, the other slots and the options entry are unchanged (QF-09-4).
- **AC-R-221-3** `R4` `Unit` — Given an occupied slot, When rename is called with a valid name, Then only the character name changes in that slot (level, items and skills unchanged); an invalid name (R-211) is rejected with the slot unchanged.
- **AC-R-221-4** `R4` `E2E` — Given a character in slot 3, When it is loaded from the slot list (`slots.load(3)`), Then the `getState()` fields of AC-R-090-1 (including `skills`, `skillBar`, `stash`) are deep-equal to what was saved, and the active slot is 3.

### R-222 Slot preview (must · MVP)

- **AC-R-222-1** `R4` `Unit` — Given a saved character, When the preview projection runs, Then it returns slot number, name, class id, level, deepest floor, play time in hh:mm derived from game ticks (not wall clock, so a paused game does not advance it) and last-played; an empty slot returns `{empty:true}` and a corrupt slot `{corrupt:true}`.

### R-224 Autosave targets the active slot only (must · MVP)

- **AC-R-224-1** `R4` `E2E` — Given characters in all five slots and slot 2 active, When 100 autosaves are triggered quickly, Then writes are coalesced per `config.autosaveMinTicks`, slots 1, 3, 4, 5 are byte-identical, and storage keys do not grow beyond 5 slots plus options (replaces AC-R-091-5 "exactly one save").
- **AC-R-224-2** `R4` `E2E` — Given play in slot 4 then a reload, When the title shows Continue and it is chosen, Then the game loads slot 4 (last used) without a slot prompt.

### R-225 Migration of the old single save into slot 1 (must · MVP) and NFR-D06

- **AC-R-225-1** `R4` `Unit` — Given the synthetic fixture `fixtures/save-v1.json` (class `clerk`, level 12, 3 learned legacy skills, items, equipment, belt, stash, gold, `deepestDepth 4`, `bossDefeated` false) and empty slots, When `migrate` runs, Then slot 1 holds a new-format character of the melee/heavy class (id from `config.migration.legacyClass`) whose attributes, level, xp, items, equipment, belt, stash, gold, `deepestDepth` and `bossDefeated` deep-equal the fixture, `skills` is empty, `skillPoints` equals the points spent in the fixture plus unspent points, and the slot version equals `config.slotVersion`.
- **AC-R-225-2** `R4` `Unit` — Given a migrated store, When `migrate` runs again, Then the stored texts are unchanged (idempotent), and the legacy key still exists as a one-time backup until the player deletes it.
- **AC-R-225-3** `R4` `Unit` — Given slot 1 already holds a new-format save, When migration runs, Then the old save goes to the first empty slot; if all slots are occupied it stays as backup and a notice id `migration.noSlot` is returned; slot 1 is untouched.
- **AC-R-225-4** `R4` `Unit` — Given a corrupt v1 text (truncated JSON, wrong types), When migration runs, Then no exception is thrown, no slot is created from it, the bad text is kept under the backup key and returned by `save.export('corrupt')`, and the title still loads.
- **AC-R-225-5** `R4` `E2E` — Given a browser context seeded with the v1 fixture under the old key, When the page loads and Continue is chosen, Then `getState()` shows slot 1's character with the refunded `skillPoints`, and AC-NFR-D03-3 behaviour (no crash) holds. (Replaces AC-R-090-5 "no save, no Continue" for the multi-slot case: Continue is absent only when all five slots are empty.)

### R-226 Per-slot export and import (should · MVP)

- **AC-R-226-1** `R4` `E2E` — Given slot 2 exported to a file, When the file is imported into slot 4 (with `confirm:true` because slot 4 is occupied), Then both slot previews are equal except the slot number, and slots 1, 2, 3, 5 are unchanged. A garbage file leaves all slots unchanged and shows `ui.notice` (extends AC-R-092-3). Options are global: changing volume in one slot changes `options` for all.

### R-227 Slot failure handling (must · MVP)

- **AC-R-227-1** `R4` `E2E` — Given slot 3 holds corrupt text or a `version` above `config.slotVersion` and the other slots are valid, When the page loads, Then `scene === 'title'`, no uncaught error, slot 3 reports `corrupt` or `tooNew`, slots 1, 2, 4, 5 load normally, and slot 3's text is untouched until the player exports or deletes it.
- **AC-R-227-2** `R4` `E2E` — Given storage that throws on write for slot 2 only (simulated), When an autosave runs in slot 2, Then the game keeps running, `ui.notice` shows save-failed, slot 2's last good text is unchanged, and an autosave in slot 4 succeeds.

### R-233 Original names for classes and skills (must · MVP)

- **AC-R-233-1** `R4` `Unit` — Given all strings of `content.classes` and `content.skillTrees` (names, blurbs, tooltips, branch names), When scanned against `ip-denylist.txt` and `ip-denylist-brands.txt`, Then there are zero hits. (Vacuous until the denylists are supplied, as AC-NFR-L01-1; see QF-11-2. Final class names are an escalation, not testable.)

### R-234 Testability for classes, trees and slots (must · MVP)

- **AC-R-234-1** `R4` `E2E` — Given `?test=1`, When `__app.describe()` is read, Then it also lists `slots.create/load/delete/rename/list`, `skills.learn/respec/tree`, `cheat.setSkillPoints(n)` and the existing `cheat.setLevel(n)`, each of which exists; without `?test=1` none of them is reachable (AC-NFR-S01-1).
- **AC-R-234-2** `R4` `Unit` — Given `newGame(seed, {class:id})` and the same recorded input list, When run twice for each class, Then the final state hashes are equal per class (R-120, NFR-Q01).

### NFR-D05 Five-slot storage budget (must)

- **AC-NFR-D05-1** `R4` `Unit` — Given the worst-case character (full inventory, full stash, level 30, all skills at max) in each of 5 slots, When serialised, Then each slot text is at most `config.slotMaxBytes` (400 000), the total of 5 slots plus options plus a legacy backup is below `config.storageMaxBytes` (2 500 000), and a failing write for one slot never changes another (AC-R-227-2).

### NFR-D06 Save version bump and migration (must)

- **AC-NFR-D06-1** `R4` `Unit` — Given the slot format version, When `config.slotVersion` is read and compared with the v1 version, Then it is greater; `deserialize` of the new format never throws on 20 mutated copies (extends AC-NFR-D03-4); the migration of AC-R-225-1..2 is the data-preservation test for this NFR.

## R5: UI and render (selection screen, tree panel, slot list)

### R-206 Skill-tree panel (must · MVP)

- **AC-R-206-1** `R5` `E2E` — Given a level 5 character with 2 skill points, When the skill key (S or K) is pressed, Then `ui.panels.skills` is true, 3 branch tabs are present with the branch names of the class, and the panel shows "Points: 2" (text).
- **AC-R-206-2** `R5` `E2E` — Given the open panel, When an available skill is clicked, Then its level in `getState().player.skills` rises by 1 and the displayed points fall by 1; clicking a locked skill changes nothing and the tooltip text names the reason ("Requires level N" or "Requires <skill>").
- **AC-R-206-3** `R5` `E2E` — Given the panel, When all nodes are read, Then each node exposes its state as text (`locked`, `available`, `learned`, `maxed`) in an accessible name in addition to any visual cue, and tooltip text is non-empty with current and next level values and mana cost.
- **AC-R-206-4** `R5` `E2E` — Given viewport 1280x720 and 390x844, When the panel is open, Then no node overflows the viewport horizontally and the page has no horizontal scroll. Layout polish: `verify: playtest/visual review`.

### R-210 / R-211 Creation flow and name rules (must / should)

- **AC-R-210-2** `R5` `E2E` — Given the class screen reached from an empty slot, When class X is selected, a valid name typed and Begin pressed, Then `scene` becomes `town`, `player.class === X`, and the slot preview shows the name.
- **AC-R-211-1** `R5` `Unit` — Given the name validator, When called with empty, 17 characters, `<img src=x>`, leading and trailing spaces, a name with an emoji, a letters-digits-space-hyphen-apostrophe name of 16 characters, Then the results are: rejected, rejected, rejected, accepted trimmed, rejected, accepted. In the E2E UI an invalid name disables Begin, the name appears in the DOM as text (`textContent`, not markup), and the suggest button fills a name that passes the validator.

### R-212 Visually appealing selection screen (must · MVP · agreed intent)

- **AC-R-212-1** `R5` `E2E` — `verify: playtest/visual review` — Given 2 or 3 layout variants under `variants/character-select/`, When screenshots at 1280x720 and 390x844 are reviewed by the independent visual reviewer (same route as art direction and the inventory panel), Then a review file records a pick; the customer may overrule on screen. No pixel assertions.
- **AC-R-212-2** `R5` `E2E` — Given the chosen variant in production, When the screen is captured at the same sizes, Then the screenshot is not flat (at least 64 distinct colours) and contains no third-party asset (no external request; AC-NFR-L05-*).

### R-213 Selection screen content (must · MVP)

- **AC-R-213-1** `R5` `E2E` — Given the class screen, When each of the three classes is selected, Then name, role tag, blurb, starting stat bars (values equal `content.classes`), three branch names and a name field plus Begin and Back are present in the DOM or canvas text model (`ui.selection`).
- **AC-R-213-2** `R5` `E2E` — Given a selected class and reduced motion off, When two canvas captures are taken 500 ms apart, Then they differ (idle animation); an attack demo starts on hover or click and returns to idle. Whether it looks good: `verify: playtest/visual review`.

### R-214 Interaction and accessibility of the selection screen (must · MVP)

- **AC-R-214-1** `R5` `E2E` — Given the title screen, When only keys are used (arrows to choose class, Enter, typing a name, Tab to Begin, Enter), Then a game is started in an empty slot with the chosen class; Esc goes back one step without creating anything.
- **AC-R-214-2** `R5` `E2E` — Given reduced motion enabled (option or `prefers-reduced-motion`), When two captures are taken 500 ms apart, Then they are equal (static pose, no background drift) and no element flashes more than 3 times per second.

### R-215 Flow: title, slot, class screen, game (must · MVP)

- **AC-R-215-1** `R5` `E2E` — Given slots 1 and 3 occupied, When New game is chosen, Then the slot list opens; choosing empty slot 2 opens the class screen; Begin starts a game in slot 2.
- **AC-R-215-2** `R5` `E2E` — Given the slot list from New game, When occupied slot 3 is chosen, Then a dialog names the character that will be lost; Cancel returns to the list with slot 3 unchanged; Confirm opens the class screen and, after Begin, slot 3 holds the new character (replaces AC-R-092-4).
- **AC-R-215-3** `R5` `E2E` — Given no occupied slot, When the title is read, Then Continue is absent or disabled; with at least one occupied slot, Continue loads the last used slot, and Load opens the slot list (replaces AC-R-090-5).

### R-221 / R-222 / R-223 Slot list in the UI (must · MVP)

- **AC-R-223-1** `R5` `E2E` — Given the title screen and, separately, the pause menu in game, When Options is opened, Then a "Save slots" section lists 5 cards; each card for an occupied slot shows number, name, class name and icon, level, deepest floor, play time (hh:mm) and last played, equal to the projection of AC-R-222-1; empty and corrupt cards show their state with Export and Delete on corrupt (R-227).
- **AC-R-223-2** `R5` `E2E` — Given the pause menu in game, When Load on another slot or Overwrite is chosen, Then a dialog warns that unsaved floor progress is lost and names the affected character; Cancel leaves the running game and all slots unchanged; Confirm performs the operation.
- **AC-R-223-3** `R5` `E2E` — Given the slot list, When Delete on an occupied slot is chosen, Then a dialog names the character; Cancel changes nothing; Confirm empties the slot and leaves the other slots and the options values intact; Rename opens a name field that uses the validator (R-211) and keeps all other fields.

### NFR-A07 Selection screen and tree accessibility (must)

- **AC-NFR-A07-1** `R5` `E2E` — Given the class screen, slot list, name entry and skill-tree panel, When driven only by keyboard, Then every action of AC-R-206-2, AC-R-214-1 and AC-R-223-3 can be done, the focused element is visible (non-empty focus outline), and focus is trapped inside a confirmation dialog and returned on close.
- **AC-NFR-A07-2** `R5` `E2E` — Given the same screens, When scanned, Then every state (class selected, slot occupied, skill locked/learned) also has a text or shape cue and text meets the contrast and size rules of NFR-A04 (computed contrast at least 4.5:1 for body text).

### NFR-P06 Selection screen performance (should)

- **AC-NFR-P06-1** `R5` `E2E` — Given the class screen, When `perf()` is sampled for 5 s and the selection is switched 200 times, Then the median frame time is at most the NFR-P01 target and the JS heap grows by at most `config.perf.selectionHeapMb` (default 10 MB) after a forced GC (ASSUMED threshold, reference-runner caveat as QF-10-1).

## R6: balance parity and polish

### R-230 Per-class balance targets (must · MVP)

- **AC-R-230-1** `R6` `Unit` — Given the bot with its class policy, fixed seeds `config.bot.seeds` (at least 5 per class) and the headless simulation, When each class plays from level 1 to the end boss, Then each run reaches the boss in game time between 20 and 40 minutes (ticks / `tickHz`), and the report lists per class median clear time and median deaths.
- **AC-R-230-2** `R6` `Unit` — Given the report of AC-R-230-1, When medians are compared, Then for every class the median clear time and median death count are within `config.balance.parityBand` (0.25) of the three-class median. If the caster policy proves unreliable the check runs as a report, not a gate (circle-02 Q7 fallback B, QF-11-4).
- **AC-R-230-3** `R6` `Unit` — Given each class tree and the damage-per-mana model, When each skill's value is compared inside its tree at equal level, Then no skill exceeds `config.balance.dominance` (default 1.5) times the median value of its tier, and no branch has all skills below `config.balance.unusable` times the median (no dominant skill, no unusable branch).

### R-232 Distinct look and feel per class (should · MVP)

- **AC-R-232-1** `R6` `Unit` — Given the renderer's animation keys, When the atlas is built, Then each class has every key the renderer needs (idle, walk, attack, hit, death, cast) and a silhouette bounding box within `config.render.spriteBox`.
- **AC-R-232-2** `R6` `E2E` — `verify: playtest/visual review` — Given a screenshot of each class in town and in combat at gameplay scale, When reviewed by the visual reviewer, Then the three silhouettes and palettes are distinguishable and class skill effects differ per class. No pixel assertions.

### R-208 Skill synergies (could · MVP)

- **AC-R-208-1** `R6` `Unit` — If implemented: Given a passive with a named target skill at level L, When the target skill's damage is computed, Then it rises by the passive's per-level value times L and the tooltip shows the bonus. Not required for round sign-off.

## Appendix: balance and content details kept out of the AC list

- Per-class balance numbers (start attributes, growth, skill values, boss times) live in `config`; the architect and customer proxy own the table (QF-05-7).
- Branch sketch from circle-02 Q1 option A is a design input only: Facilities Manager (Heavy Lifting, Safety Officer, Maintenance), Sales Rep (Cold Calling, Networking, Closing), IT Wizard (Scripting, Network Admin, Helpdesk). All provisional; the Clerk's six skills are redistributed (R-225) and refunded on migration.
- Class-tagged affix examples for AC-R-231-2: "+1 to Facilities skills", "+1 to Sales skills", "+1 to IT skills" (names provisional).

## Coverage

| Requirement | ACs | Rounds | Levels |
|---|---|---|---|
| R-200 (must) | 200-1, 200-2 | R4 | Unit, E2E |
| R-201 (must) | 201-1, 201-2 | R4 | Unit |
| R-202 (must) | 202-1, 202-2 | R4 | Unit |
| R-203 (must) | 203-1 | R4 | Unit |
| R-204 (must) | 204-1, 204-2, 204-3 | R4 | Unit |
| R-205 (must) | 205-1, 205-2, 205-3 | R4 | Unit |
| R-206 (must) | 206-1..206-4 | R5 | E2E |
| R-207 (must) | 207-1, 207-2 | R4 | Unit, E2E |
| R-208 (could) | 208-1 | R6 | Unit |
| R-209 (should) | 209-1, 209-2 | R4 | Unit |
| R-210 (must) | 210-1, 210-2 | R4, R5 | E2E |
| R-211 (should) | 211-1 | R5 | Unit, E2E |
| R-212 (must) | 212-1, 212-2 | R5 | E2E (visual review) |
| R-213 (must) | 213-1, 213-2 | R5 | E2E |
| R-214 (must) | 214-1, 214-2 | R5 | E2E |
| R-215 (must) | 215-1, 215-2, 215-3 | R5 | E2E |
| R-220 (must) | 220-1, 220-2, 220-3 | R4 | Unit, E2E |
| R-221 (must) | 221-1..221-4 (logic, R4); UI in 215-2, 223-2, 223-3 (R5) | R4, R5 | Unit, E2E |
| R-222 (must) | 222-1 (R4); card text in 223-1 (R5) | R4, R5 | Unit, E2E |
| R-223 (must) | 223-1, 223-2, 223-3 | R5 | E2E |
| R-224 (must) | 224-1, 224-2 | R4 | E2E |
| R-225 (must) | 225-1..225-5 | R4 | Unit, E2E |
| R-226 (should) | 226-1 | R4 | E2E |
| R-227 (must) | 227-1, 227-2 | R4 | E2E |
| R-230 (must) | 230-1, 230-2, 230-3 | R6 | Unit |
| R-231 (should) | 231-1, 231-2 | R4 | Unit |
| R-232 (should) | 232-1, 232-2 | R6 | Unit, visual review |
| R-233 (must) | 233-1 | R4 | Unit |
| R-234 (must) | 234-1, 234-2 | R4 | E2E, Unit |
| NFR-D05 (must) | D05-1 | R4 | Unit |
| NFR-D06 (must) | D06-1 (plus 225-1, 225-2) | R4 | Unit |
| NFR-P06 (should) | P06-1 | R5 | E2E |
| NFR-A07 (must) | A07-1, A07-2 | R5 | E2E |

Total ACs in this file: 70 (R4 43, R5 21, R6 6). Of these, must ACs: R4 38, R5 19, R6 3 (each round within the L-03 limit of about 40); the other 10 belong to should/could items (R-208, R-209, R-211, R-226, R-231, R-232, NFR-P06).

## Not covered by an AC here

- Synergies beyond one optional AC; copy-to-slot (could in R-221); the "skill demo reel" on the selection screen (could, circle-02 Q5 B); attribute respec (LATER); a fourth class, class-locked items, cosmetics (out of scope, circle-02).
- "Visually appealing" and class feel are reviews, not assertions (AC-R-212-1, AC-R-232-2).

## Questions for the facilitator

- **QF-11-1** Final class names and ids are ESCALATED (brand). The ACs use content-driven ids; the working names stay until the customer confirms. Does any change to names after R4 need a re-scan (AC-R-233-1)?
- **QF-11-2** The denylists are still to be supplied (QF-10-2), so AC-R-233-1 is vacuous until then.
- **QF-11-3** Mapping of the legacy Clerk's skills: R-225 refunds them as points; circle-02 Q1 also proposed redistributing the skills into the new trees. The AC follows R-225 (refund). Confirm that the redistribution is for tree content only.
- **QF-11-4** Parity band measures median clear time and deaths "within 25% of the three-class median". For deaths near 0 a relative band is unstable; propose an absolute floor of 2 deaths (`config.balance.deathFloor`). The bot policy per class must exist before R6 (R-234).
- **QF-11-5** Resume position after Load or Continue (town or floor entry) is still QF-09-2; the slot ACs read `config.resumeAt`.
- **QF-11-6** Where "last played" comes from: local time of the save is a real-time stamp, which collides with AC-NFR-D01-1 ("no real time of day in keys"). Proposal: store it in the slot text, not in key names, and amend D01-1 to cover keys only.
- **QF-11-7** Skill-point refund on migration: should the migrated character also keep its attribute points as spent? AC-R-225-1 assumes yes.
- **QF-11-8** Cooldowns: R-203 says "mana cost, no cooldown" as a note; confirm QF-06-5 holds for all three classes.
- **QF-11-9** Does R-206's "S and K" key open the panel, with S in conflict with any movement or stop key (QF-01-4 family)?
