# R6 adversarial pass (test-engineer, adversarial mode, 2026-10-14)

Scope: round 6: BAL-R6 (class power attribute, caster scaling, tuning, parity gate, golden re-record), UI-R6 (respec confirmation, tree connectors, pause and slot layout, class selection polish), WORLD-R6 (face and light polish, loot beam, lazy atlas). I did not write this code and did not read the implementers' tests before writing mine.
Method: read `docs/reviews/R6-contract.md`, the R6 balance, UI and world notes, `src/ui/{tree,panels,savestatus,screens,slots,charselect}.js`, `src/core/{items/derive,systems/progression,treeview}.js`, `src/save/format.js`; probed each hypothesis in Node first, then in Chromium (Playwright 1.56.1), then froze it as a test. No `src/` file was changed. Every page of the e2e script is served from an https origin (`context.route("https://oc.test/**")`), never `file://` (L-027).

Tests: `e2e/adv-r6.mjs` (394 checks, 6 expected failures; registered in `e2e/run-all.mjs`, about 5.5 minutes; `SEC=respec|tree|keys|pause|slots|atlas|det|rslayout|charsel` runs one section), `test/adv-r6-core.test.js` (24 cases, 5 todo). Also changed: `e2e/adv-r5.mjs` (the two red checks: the script now clicks `respec-yes` after `respec`, assertions unchanged; 150/150 again). Screenshots `docs/shots/adv-r6-*.jpg`.

## Summary

| id | severity | title |
|---|---|---|
| ADV-R6-01 | minor | The save importer accepts impossible attribute totals and self-consistent forged affixes; since R6 agility and focus feed damage, a forged level-1 hero hits 5 to 8 times harder than the best legal hero |
| ADV-R6-02 | minor | A respec with nothing to give back still takes the gold (mode gold) or the one allowed respec (mode once), and the UI asks no confirmation for it |
| ADV-R6-03 | trivial | Tree connector elbows stop 2.5 px (one column) to 8 px (two columns) short of the parent's stub |
| ADV-R6-04 | minor | Keyboard: when a Learn button turns disabled under the focus (skill maxed or points spent), focus is dropped to `<body>` |
| ADV-R6-05 | minor | R5 saves with the attribute points in Grit (the only caster damage source in R5) are loaded unchanged: the points now do nothing, nothing refunds or announces it |

Counts: blocker 0, major 0, minor 4, trivial 1.

What held up (all tested, green): see "Attack list" below.

## Findings

### ADV-R6-01 (minor) forged attributes and affixes now buy a lot more damage

- Repro (node, `test/adv-r6-core.test.js` "ADV-R6-01", "ADV-R6-01b"): `toSave(newGame(...))`, set every attribute to 1000 (or give the weapon `{ stat: "focus", value: 900, range: [900, 900] }`), seal with the checksum, `deserialize`. Result: `ok: true`.
- Numbers (largest single skill hit at level 30, skill level 5, `node` probe): legal hero with every point in the power attribute (start + 145): Facilities Manager 138, Sales Rep 97, IT Wizard 92. Forged level-1 import with 1000: 558, 500, 342. Weapon damage of a forged hero: 499-502 / 794-797 / 596-598 (a legal level-30 hero: about 150).
- Expected: attributes plus unspent points bounded by the class's start values plus 5 a level (the same invariant the schema already enforces for skill points, `src/save/format.js:187`), and affix values checked against the affix table, not only against a range the save brings itself.
- Actual: `src/save/format.js:152` accepts 0..1000 per attribute with any level; `format.js:95-103` (`affixOk`) only checks `value` against the `range` written in the same affix. Related to ADV-R5-04 (impossible allocations); R6 raises the value of the hole because agility and focus now add weapon and skill damage (`src/core/items/derive.js:48`).
- Impact: single-player, nothing shared: a player editing their own save. Still the schema says it validates the point invariant. Negative forged values are harmless (damage floors at 0, hit chance clamps, mana floors at 0).
- Test: node todo ADV-R6-01 and ADV-R6-01b.

### ADV-R6-02 (minor) respec with nothing to return is charged

- Repro (browser, variant builds with `config.respec` changed, `e2e/adv-r6.mjs` "[R6-gold]" and "[R6-once]"): mode gold (goldBase 50, 10 a level), level 16, nothing learned: click Respec. No confirmation opens (`src/ui/panels.js:501-504` runs the respec at once when nothing is refundable) and 210 gold is gone (1050 to 840), 0 points returned. Mode once: the same click uses up the only respec; the later real respec fails with `respec-used`.
- Node: `test/adv-r6-core.test.js` "ADV-R6-02", "ADV-R6-02b".
- Expected: nothing to refund means nothing to charge or count: the core answers an error such as `nothing-to-respec` (and the button explains it), or the UI confirms in these two modes too.
- Actual: `src/core/systems/progression.js:118-134` (`respec`): charges `respecCost`, increments `respecsUsed` and emits even when `refunded === 0`. Default mode is `free`, so the shipped config is not affected; the customer's choice of mode (ADR-0005 section 8) makes it live.
- The confirmation itself is right in all three modes (price named in gold mode, "only respec" named in once mode, refund count equals the points really returned, 5/5 re-learn variants).

### ADV-R6-03 (trivial) elbows do not reach the stub

- Repro: `e2e/adv-r6.mjs` "[R6-tree] ... every elbow reaches the centre of its parent's stub", all three classes (screenshot `docs/shots/adv-r6-tree-it-partial.jpg`, zoom on Server Overheat to Power Surge: a 2 px step where the bar starts beside the stub).
- Expected: the horizontal bar ends on the parent's vertical stub (centre of the parent). Actual: it ends 4 px (one column) or 8 px (two columns) short of the centre, minus the 1.5 px half width.
- Suspect: `src/style.css:625`: `width: calc(var(--span) * (100% + var(--gx)) + 1.5px)`; `100%` is the padding box of the absolutely positioned `.lk`, which is the card width minus its two 2 px borders, so each column falls 4 px short. Fix: `(100% + var(--gx) + 4px)`.
- Everything else about the connectors held: every prerequisite of every class has a connector with the right direction and the right colour (met or not), every parent that has dependants has a stub whose colour follows its level, nothing is drawn on a node without a prerequisite, all edges are one tier apart so the half-gap stubs meet (all 27 skills, four states: fresh, level 8, tier 1 learned, everything maxed).

### ADV-R6-04 (minor) focus lost when the focused Learn button becomes disabled

- Repro: level 16 Facilities Manager, focus `learn-floor-buffer` (Tab), press Enter 5 times: the fifth press maxes the skill, the button re-renders disabled and `document.activeElement` is `<body>` (the next Tab starts again from the top of the page). Same when the last skill point is spent. `e2e/adv-r6.mjs` "[R6-keys] after the Learn button became disabled".
- Expected: focus moves to the skill's node button (or the next control) so a keyboard player does not lose their place.
- Suspect: `src/ui/panels.js:199-206` (`restoreFocus` looks up `[data-fk=...]` and calls `.focus()` on a disabled button, which silently does nothing; no fallback), `src/ui/tree.js` Learn button `disabled` attribute.
- Everything else by keyboard held: Tab reaches Respec, every node and every enabled Learn in DOM order, skips disabled Learn, does not trap; Space and Enter assign and unassign F-buttons and keep focus; Respec by keyboard (Enter, Shift+Tab to Yes, Space) works and returns focus to Respec.

### ADV-R6-05 (minor) R5 saves are not migrated for the power-attribute change

- Repro (node, `test/adv-r6-core.test.js` "R6-compat" and "ADV-R6-05"): an R5-style IT Wizard (or Sales Rep) at level 14 with all 65 attribute points in Grit (the R5 bot weighting; Grit was then the only damage attribute of every class) loads fine (`ok: true`) but its weapon damage falls from about +63 / +65 to 8-10 / 7-10, because `derived.powerAttr` is now focus / agility. `saveVersion` is still 2 (`src/core/config.js:159`), so no migration step can tell an R5 save from an R6 one; `unspent attrPoints` stays 0; no notice. There is no attribute respec.
- Expected: either a save version bump with a migration that returns the attribute points of the classes whose power attribute changed (IT Wizard, Sales Rep), or a one-time notice, or an attribute respec in the Lobby; at least a line in the release notes.
- Impact: only players with R5 saves (testers). The Facilities Manager is not affected (grit still its power attribute).
- Loaded R5 saves otherwise behave: the old fixture `save-v1.json` loads; saves with xp between the old and new level-2 threshold (140 against 146 then and 136 now) load, show 140 / 136, and level up on the next xp gain; skill numbers are not stored in saves (only levels), so changed skill numbers apply at once.

## Attack list and results

| Area | What I tried | Result |
|---|---|---|
| Respec confirmation | open, Esc, Cancel, Enter on focused Cancel, two fast clicks on Respec, double click on Yes, learn while open, leave the Lobby while open, close panel with S, pause and resume, Esc twice, respec then save and reload | all held (31 checks); the confirmation closes on any scene change, shows the true refund, applies once, focus lands on Cancel then on Respec |
| Respec modes | once and gold variants built with esbuild from `src/` with `config.respec` replaced (`respec: { mode: "once" ... }`) | text and price correct, charge exactly once, disabled with reason, forced click opens nothing; ADV-R6-02 for the empty tree |
| Respec layout | 1280x720, 720x720, 390x844, 390x560, 390x844 with text 1.5 | confirmation and both buttons on screen, 30 px or more high, no sideways scroll |
| Tree connectors | every class x fresh, level 8, tier 1 learned, everything maxed; geometry from computed styles | ADV-R6-03 only |
| Tree keyboard and phone | see ADV-R6-04; 390 px: connectors hidden, "Needs: x" text visible on every node with a prerequisite, no overlap, buttons 30 px or more, no scroll; 1024x600, 720x720, 1280x720 everything maxed: no overlap, no scroll | held |
| Pause menu | 7 banner states (none, storage blocked, storage full, another tab, take-over confirmation open, stale owner, notice with full) x 5 viewports (1280x720, 1024x600, 720x720, 390x844, 390x560) | heading visible at scroll 0, Quit reachable after scrolling, all buttons inside the width and 30 px or more, Resume visible without scrolling where the height allows, no clipped banner text: 133 checks green. Note: the displaced tab only learns it lost the saves when its next write is refused (not a defect, matches ADV-R5-02 design) |
| Slot manager | five slots (ok, ok, ok, damaged, newer), five viewports, opened from the pause menu | five cards, Close reachable at the top and after scrolling, no sideways scroll, delete confirmation on screen with focus inside, Esc closes only it, damaged and newer slots labelled, the playing slot has Delete, Import and Replace disabled |
| Class selection | 60 fast clicks alternating, wrap-around arrows, reduced motion, six viewports | exactly one selection, flourish ends (no stacked animation after 1.3 s), none in reduced motion, figures at least 40 px, Start inside the width, Start with an empty name starts nothing |
| Caster scaling (node) | attribute 0, 1, 7, 8, 9, 20, 145, 1000 on every attribute of every class; monotonic over 0..1000 in steps of 1; off-attribute points add no damage; gear taking the power attribute to -9999; allocate 30 points right and wrong; respec leaves attributes and damage alone; every active skill at level 5 with the power attribute at 0, 20, 1000 | finite, whole, ordered, monotonic, bounded (largest hit 558); unclassed player objects still use grit; 200 random learn/allocate/respec steps conserve points for every class |
| Save compatibility | fixture v1, R5-style saves at levels 1, 8, 16, 30 with all points in Grit, xp between the old and new threshold, round trip | all load; ADV-R6-05 for the dead Grit points |
| Lazy atlas | each of 8 monster types spawned mid-game (pixel diff of the canvas box before and after, 5 000 to 24 000 pixels each) and fought; the hero walking in 8 directions in each class (no blank frame, at least 3 distinct frames), attack, hurt and death; all nine floors on 3 seeds (150 ticks each); the boss through its phases by damage steps; atlas swap by high contrast and by resize across scale buckets with a new type after each swap | no page error, `atlasMissing` empty, lazy counter rises: 30 checks green |
| Balance gate determinism | the gate runs (floor 4, 45 000 ticks, 3 classes x seeds 1..3) and one whole run to the boss per class (seed 101) in Node and in Chromium (bot bundled with esbuild) | all 12 identical in result, tick, level, deaths, kills and damage per skill |

## No-cheat runs (the careful bot, real rules, no cheats, whole run from the Lobby to the boss and the victory screen)

Seeds 101 to 106 (not the seeds the balance pass tuned on, 1 to 24), 150 000 tick budget, respawn after death (12 at most), headless on the pure core (the same code runs in Chromium; seed 101 per class was run in both and is identical tick for tick):

| class | wins | median clear (min-max) | median deaths (mean) | deaths at the boss |
|---|---|---|---|---|
| Facilities Manager | 6/6 | 27.0 min (24.9-28.9) | 2 (2.3) | 3 of 14 |
| Sales Rep | 6/6 | 26.6 min (24.4-33.4) | 1.5 (2.2) | 10 of 13 |
| IT Wizard | 6/6 | 26.1 min (24.3-30.5) | 1.5 (2.0) | 8 of 12 |

All 18 runs won, none stuck, all within 20 to 40 minutes, three class medians within 4 % of each other. Observation: the two non-melee classes die mostly at the boss (10 of 13, 8 of 12 deaths); the melee class dies mid-dungeon. Not a defect. A run driven through the real UI (bot over `__app`, one decision per round trip) was started and abandoned: the snapshot per round trip makes it take more than 10 minutes for floor 3 (tooling, not the game); not done.

## Flaky checks (L-027)

No intermittent failure was observed in the final runs. One check failed on every run while I built the pause-menu section (the click on `take-over-saves` timed out for the "take-over dialog open" case at all five viewports): a test set-up error, not product and not environment. The tab that lost the saves to another tab only learns it at its next write; my set-up never made a write after the take-over, so the banner was absent. Fixed with a forced `save.write` (refused) before pausing. After the fix the pause section passed in every run (three full runs of `adv-r6.mjs` including the one under `npm run e2e`, plus four single-section runs); none of the checks is retried and none is quarantined. All pages are served over https, so the file:// storage artefact of ADV-R5 (L-027) cannot occur here.

## Hand-off

- BAL-R6 owner: ADV-R6-02 (core), ADV-R6-05 (migration decision), ADV-R6-01 (schema, with ADV-R5-04).
- UI-R6 owner: ADV-R6-03 (one number in `style.css:625`), ADV-R6-04 (`panels.js:199`).
- The e2e script builds two variants of the game into the OS temp directory to switch the respec mode; it throws with a clear message if the `config.respec` line changes shape.

---

# Round 2 (after the fix round: FIX-R6-CORE and FIX-R6-UI)

Changed by me: `e2e/adv-r5.mjs` (hostile-item fixture is now a magic weapon with a real `health-t1` affix carrying the hostile name; 150/150, the two old XFAILs show XPASS), `e2e/adv-r6.mjs` (+ section `fix2`, XFAIL lines turned into plain checks), new `test/adv-r6-fix.test.js` (27 cases, 6 todo). `test/adv-r6-core.test.js` was already converted by the fix round (26/26, no todo).

## Verified fixed in the browser (variant builds and seeded storage, https origin)

| id | how | result |
|---|---|---|
| ADV-R6-01 | forged saves (1000 in every attribute; forged focus affix) seeded into slot 1 and pasted into Import | slot shown as not ok, Continue never starts it, import refused, no page error |
| ADV-R6-02 | once and gold variants: Respec with nothing learned | button disabled with "Nothing to respec" hint, forced click and API refuse with `nothing-to-respec`, no gold taken, the once not used; a real respec after learning works and charges / uses the once. Free mode still allows an empty respec (nothing to lose) |
| ADV-R6-03 | computed geometry of every elbow, three classes | reaches the parent stub |
| ADV-R6-04 | Enter x6 on Learn until maxed | focus stays in the panel |
| ADV-R6-05 | the three real R5 fixtures (v2) loaded by Continue | IT Wizard and Sales Rep: 65 points back, attributes at class start, notice naming Focus / Agility in the pause menu with Dismiss, slot rewritten as v3, reload: no second refund and no notice, spending them raises damage; Facilities Manager unchanged, no notice |
| CR6-07 | 120 refused casts (mana 1) | the reason is shown at most about once a second |

## Re-attack of the new code

- No false rejections: 2 000+ generated gear items (every base x normal/magic/rare x 6 item levels x 3 class tags x 12 seeds, worn), every unique at three item levels (all uniques round-trip, affixes identical, the dotted ids of the four resist uniques included), every potion strength and consumable, vendor purchases of all three classes, and the careful bot's real state every 2 500 ticks over 16 000 ticks for 3 classes x 3 seeds, and levels 1 to 30 by xp with random allocation, learning, respec and loot: all save, load and re-save identically.
- Attribute invariant: exactly at the limit loads, one over is refused, for every class at levels 1, 2, 16, 30; a hero below the start values and gear attributes are not counted against it.
- v2 to v3: refund arithmetic over levels 1 to 30 and mixed allocations (attributes back to class start, points conserved, note numbers right), unspent points kept, nothing allocated gives no note, idempotent after re-save, hostile v2 attribute tables (strings, negatives, arrays, fractions, null, 1e9, missing attrPoints) are refused without a throw, a forged v2 over the limit is refused rather than clamped; old fixtures v0 and v1 still load.
- Dotted affix ids: still refused for item ids, path-like ids and 41-character ids.

## New findings

| id | severity | title |
|---|---|---|
| ADV-R6-06 | minor | The level in a save is not tied to its xp: a level 30 hero (145 attribute points, 29 skill points) loads at xp 0 |
| ADV-R6-07 | minor | Rollable-gear validation stops at gear affixes: potions (restore up to 1 000 000), consumable effect ids, requirements, a head base in the weapon slot and duplicated uniques are accepted |

### ADV-R6-06
Repro: `test/adv-r6-fix.test.js` "ADV-R6-06". Expected: `xp >= config.xpTable[level - 1]` (every legal save satisfies it, also R5 saves, because the R6 curve is lower). Actual: `src/save/format.js:182` only range-checks level and xp separately, so the new attribute invariant (`format.js:185-188`) and the skill-point invariant are bounded by a level the player can claim freely. Impact: the damage ceiling of a forged hero is now the legal maximum at level 30 (about 150 weapon damage), no longer 500+, but a free level 30.

### ADV-R6-07
Repros (`test/adv-r6-fix.test.js`, five todo cases): a belt potion `{ restore: 1000000, restores: "hp" }` loads; a consumable with `effect: "anything"`; `makeItem("hard-hat")` in the weapon slot; gear with `reqs: {}`; the same unique twice in the bag. Expected: `kind !== "gear"` items match their base (restore, restores, effect), gear matches its base (`reqs`, `w`, `h`, `twoHanded`, slot against the equipment key), and a unique id appears at most once. Actual: `rollableOk` (`src/save/format.js:109-131`) is called for gear only (`format.js:150`) and compares affixes, `damage` and `defense` only. Impact: single-player self-edit; the infinite potion is the cheapest.

Counts after round 2: blocker 0, major 0, minor 2 new (ADV-R6-06, -07); ADV-R6-01 to -05 fixed and verified.
