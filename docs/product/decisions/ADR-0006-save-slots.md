# ADR-0006 Five save slots: key layout, index, migration, quotas, atomicity

Date: 2026-10-14. Status: proposed (plan gate for rounds R4-R6). Owner: architect.
Implements R-220..R-227, NFR-D05, NFR-D06; supersedes the single-slot parts of R-090..R-092 and QF-09-1/-4. Customer answers are binding: `circles/circle-02.md` Q6 (PROXY): 5 slots, "Save slots" section in Options plus the same list on title and pause, overwrite and delete name the character, rename, options global, stash per character, autosave to the active slot only, Continue opens the last used slot, old save to slot 1 with the old key kept, per-slot export/import, 400 KB per slot. The customer's own words ("a save with 5 slots to the options menu", Third briefing) fix the number and the Options entry.
Interacts with ADR-0005 (save version 2, class and skill migration), ADR-0002 (core stays pure: no storage, no wall clock).

## Context

Read from the code, 2026-10-14: `save/storage.js` `createSaveStore(adapter)` has one slot (`config.saveKey = "office-crawler.save"`), a rotating three-deep backup of damaged or replaced saves under `office-crawler.save.corrupt[.1/.2]`, and options under `office-crawler.options`. Adapters (`localStorage` or memory) never throw; `setItem` quota errors are caught. `save/format.js` writes canonical JSON with a `checksum`, version 1, cap `config.saveMaxBytes = 1000000`. The stash is already inside the save text (`stash`), so it is per character as soon as there are several saves. `main.js` listens for the core `autosave` event and calls `store.autosave(core, ev)`. The save text contains no wall-clock time (NFR-D01-1).

New needs: five independent characters; a slot list that renders on the title screen without parsing five full saves; per-slot corruption must not hurt the others (R-227); a migration of the existing save and its backups; a storage budget.

## Decision

### 1. Key layout (all under the existing prefix, localStorage, same origin)

| Key | Content | Written when |
|---|---|---|
| `office-crawler.slot.1` .. `office-crawler.slot.5` | Full save text of one character (canonical JSON, save format version 2, checksum), at most 400 000 characters | autosave of the active slot, explicit save, import, create |
| `office-crawler.slots` | The **index**: small JSON (below), about 1.5 KB | after each slot write or slot operation |
| `office-crawler.slot.N.bad` | Raw text of a slot that failed validation, kept for export (one per slot) | on load failure, before the slot is cleared |
| `office-crawler.options` | Options, unchanged, global (language-free; volume, keys, text size, reduced motion). Not part of any slot | on option change |
| `office-crawler.save`, `office-crawler.save.corrupt`, `.corrupt.1`, `.corrupt.2` | Legacy single-slot keys, read only by the migration (section 5), never written again | never |

Nothing else is stored. There is no cross-slot shared stash, no account, no user id. Settings the player expects to survive deleting a character stay in `office-crawler.options` (QF-09-4).

### 2. Index shape (readable without parsing any save)

```json
{ "v": 2, "active": 2, "last": 2,
  "slots": [
    { "n": 1, "state": "ok", "name": "Dana", "class": "sales-rep", "level": 17, "depth": 5, "deepest": 6, "playSec": 5421,
      "lastPlayed": 1791964800000, "bytes": 83211, "sum": 2870131233, "boss": false },
    { "n": 2, "state": "empty" },
    { "n": 3, "state": "bad", "reason": "checksum", "lastPlayed": 1791960000000, "bytes": 51022 },
    { "n": 4, "state": "ok", ... }, { "n": 5, "state": "empty" } ] }
```
Fields: `state` is `ok | empty | bad | newer` (`newer`: written by a newer build, never overwritten, R-227); `name` is plain text (rules in the contract: 1-16 characters, letters, digits, space, hyphen, apostrophe, trimmed); `class` is a class id; `level`; `depth` is the floor the character is on, `deepest` the deepest reached; `playSec` is play time; `lastPlayed` is epoch milliseconds set **by the shell** (the only place a clock is read); `bytes` is the length of the slot text; `sum` is `hash32` over the slot text (cheap, 400 KB hashes in a few ms) used to detect that index and slot disagree; `boss` is `bossDefeated`. `active` is the slot the running game writes to (null on the title); `last` is what Continue opens. Wall-clock time and play time live only in the index and in a `stats.playTicks` counter inside the save (ticks, not time), never as a timestamp inside the save text, so NFR-D01-1 holds and the core stays pure.

Reading the list = one `getItem` on `office-crawler.slots` plus one `JSON.parse` of 1.5 KB. No slot text is read. A selection card needs nothing else (R-222).

**Repair.** The index can be lost or stale because a slot write and the index write are two separate `setItem` calls (section 6). Rules: (a) when the index is missing or unparsable, the store **rebuilds** it by scanning the five slot keys (parse, validate, derive metadata) and stores the result; (b) when a slot is opened and its `bytes`/`sum` differ from the index, the index entry is rebuilt from the slot (silently) before use; (c) a slot key that exists but has no index entry (crash between the two writes in the order below cannot produce this, but a manual import can) is adopted by (a). Rebuild cost (five parses) is paid once.

### 3. Per-character data and what is global

Per slot (inside the slot text): everything the v1 save had (character, name, class, skills, items, equipment, belt, **stash**, gold, depth, boss flags, explored maps, random streams, stats) plus `name` and `stats.playTicks`. The stash is per character (Q4/Q6 default; no shared stash, so class-tagged affixes in ADR-0005 cannot cross classes). Global: `office-crawler.options` and the index. Options are never overwritten by an import or by deleting a slot.

### 4. Operations and who may do them

The store (`save/slots.js`, new) exposes: `list()`, `read(n)`, `write(n, state, {now})`, `create(n, state, {now})`, `remove(n)`, `rename(n, name)`, `copy(from, to)` (could), `exportText(n, which)`, `importText(n, text, {now})`, `setActive(n)`, `lastUsed()`, `migrateLegacy()`, `usage()`. Every call returns plain data and never throws (as today). Rules:
- **Autosave writes only the active slot** (R-224). The `autosave` handler passes `store.activeSlot`; with no active slot (not possible while a game runs) it does nothing and tells the player. A test writes 100 saves to slot 2 and asserts slots 1, 3, 4, 5 and their index entries are byte-identical.
- **Create / overwrite / delete / rename / import** are session commands (shell level), each confirmed in the UI by a dialog that names the character; the store itself does not ask. Overwrite, delete and import first move the old text to the single **undo copy** `office-crawler.slot.N.prev`, which is kept until the next write to that slot and deleted on delete-confirmation ("Delete forever") when space is short. This gives the one-step safety net the old rotating backups gave, but bounded to one copy per slot.
- **Rename** edits `name` in the slot text (a normal save of that slot with new `name`) and the index.
- **In-game load or overwrite** from the pause menu: confirmation naming the character; the running game is saved first to its own slot (unless the player cancels).
- **Continue** opens `index.last`; if that slot is not `ok` it opens the most recently played `ok` slot; if none, Continue is hidden (as today).

### 5. Migration of the existing single save and its backups into slot 1 (R-225)

`migrateLegacy()` runs once at boot, before the title is shown, and only when `office-crawler.slots` is **absent**:
1. If `office-crawler.save` exists: parse and `deserialize` it with the v1 to v2 migration (ADR-0005: Clerk to Facilities Manager, points refunded, name `"Employee"`). On success write the migrated text to `slot.1`, then the index (`state: ok`, `last: 1`, plus `migrated: {from: 1, refunded: n}` shown once as a notice). On a newer version: leave the legacy key untouched, slot 1 stays `newer`-marked via a stub `{state: "newer"}` entry, notice `saveTooNew`. On corrupt input: copy the raw text to `slot.1.bad` (so the player can export it), slot 1 `state: bad`, the other slots empty (never a crash, R-225).
2. The legacy keys are **kept in place** as the backup (the old key is never written again). `office-crawler.save.corrupt`, `.1`, `.2` stay too; they are only deleted by the space-recovery order in section 7.
3. The index is written **last**. A crash before it leaves the legacy keys intact and `slot.1` possibly written; the next boot sees no index, rewrites `slot.1` from the legacy key (same result, idempotent). Running the migration twice, or with the index present, changes nothing.
4. If no legacy key exists, the index is created empty (`active: null`, `last: null`, five `empty` entries).

Save format version 2 is the first version with `name`; the in-save migration (v1 to v2) is the same function that `deserialize` uses for any v1 text, so **import of an old exported file** also works (it lands in the chosen slot).

### 6. Atomicity

`localStorage.setItem` on one key is atomic: a quota error throws before the old value changes. Two keys (slot and index) cannot be atomic together, so the order is chosen so every crash point is repairable:
1. serialise to text; check `text.length <= config.slotMaxBytes (400000)` else fail with `too-large` and **change nothing**;
2. if the slot is occupied and this is a first write after load, copy the current text to `slot.N.prev` (skipped on routine autosaves; the undo copy is made at overwrite/delete/import moments only);
3. `setItem(slot.N, text)`; on failure return the error, nothing else was touched (the previous slot text is still there);
4. `setItem(slots, newIndex)`; on failure the slot is new and the index old: the next list sees `bytes`/`sum` mismatch and repairs (rule b);
5. only then clear `lastError` and emit success.
A tab closed between 3 and 4 is covered by repair; a tab closed in the middle of 3 cannot corrupt (single-key write). Two tabs: the running game stamps its random tab id into the index field `owner` when it becomes active, and re-reads the index before each write; if the owner is another tab, it shows "open in another tab" and does not write. This is best effort, not a guarantee (storage events are the next step, LATER).

### 7. Quotas

- `config.slotMaxBytes = 400000` characters per slot text (NFR-D05); `config.saveMaxBytes` (1 MB) remains only as the cap on legacy and import input.
- Budget: 5 slots x 400 KB = 2 MB characters worst case, plus one `prev` and one `bad` per slot in the worst case; browsers allow about 5 million characters (5 MB) per origin, so a **soft ceiling** of 4.0 million characters of own keys is enforced by `usage()` (sum of lengths of all `office-crawler.*` keys). Typical saves are 30-100 KB (explored maps are run-length coded), so the ceiling is not expected to bite; the test uses a synthetic oversize slot.
- Over the ceiling or on `QuotaExceededError`, space is recovered in this fixed order, each step followed by a retry: (1) legacy `.corrupt*` keys, (2) `slot.N.bad` of slots that are not `bad` in the index, (3) `slot.N.prev` of non-active slots, (4) the legacy `office-crawler.save` **only if** slot 1 reads back `ok`. If still failing: error `quota`, notice "Could not save: storage is full. Export a slot or delete a character", nothing deleted without a step above and never a slot with `state: ok`.
- The save cannot exceed the cap by growth alone: explored maps are coded as before; if a character legitimately reaches 400 KB, the write is refused with `too-large` and the previous save stays (R-227).

### 8. Failure handling (R-227)

A slot that fails validation (parse, checksum, schema, size) becomes `state: bad`, its text moves to `slot.N.bad`, the slot key is cleared, and a notice names the slot. The title still loads; the other four slots work. `newer` slots are never touched. Export of a bad slot returns the `.bad` text. The adapter fallback (memory when localStorage is blocked) keeps the same API: slots work for the session and a banner says nothing persists.

### 9. Export and import (R-226)

`exportText(n)` returns the slot text (the file name is `office-crawler-slot-N-<name>.json`, name sanitised to `[a-z0-9-]`). `importText(n, text)` runs the full validation (including v1 to v2 migration), requires the target slot to be chosen by the player (confirmation if occupied; the old text goes to `.prev`), stores the text in canonical form and updates the index. The imported character keeps its `name`; a name collision across slots is allowed (Q5).

## Options considered

1. **One key holding all five slots** (a single JSON): one atomic write, but every autosave rewrites up to 2 MB and one corrupt character poisons the lot. Rejected.
2. **Per-slot metadata key** next to each save (`slot.N.meta`): five reads for the list, no single place for `active`/`last`. Rejected for the single index (one read, one place for pointers); the index is small enough that rewriting it on every autosave is cheap.
3. **IndexedDB:** async, more complex tests, no benefit at these sizes; `file://` and offline are already served by localStorage. Rejected (ADR-0002 prefers boring).
4. **Metadata inside the save only**: forces parsing of up to 5 x 400 KB for the title screen. Rejected.
5. **Keep the rotating 3-deep backup per slot:** up to 15 extra copies, too much of the budget. Replaced by one `prev` per slot plus `bad`.

## Consequences

- `save/storage.js` is reworked into `save/slots.js` (slot store) over the same adapters; `config.saveKey`/`saveBackupKey` become legacy constants used only by the migration; `config.slotMaxBytes` and `config.slotCount = 5` are added.
- Save format becomes version 2: `name`, `stats.playTicks`, `class` validated against the new class table, `skills` against the merged tree; the in-save migration `MIGRATIONS[1]` lives in `save/migrate.js`.
- The shell (`game.js`, `main.js`) gains an active-slot concept and session commands (see `docs/reviews/R4-contract.md`); the core never learns about slots.
- Playwright tests that wrote to `office-crawler.save` are updated by the R4 WP; the memory adapter's `keys()` is used by the quota tests.
- The storage ceiling and the repair rules are the main residual risks; both have unit tests with an adapter that can fail writes (`failWrites` exists).

## Questions for the customer (L-05)

None block the design. Two UX defaults are stated for the customer to overrule: (1) the soft one-tab lock shows a read-only message in the second tab; (2) Delete keeps one undo copy of the slot until the next write there ("Delete forever" in the dialog clears it). Both are UI wording and flow, owned by the customer or the proxy.

## Amendment 2026-10-14 (R5 fix round: owner lock, migration, schema)

Source: code review CR-01..CR-13 and adversarial findings ADV-R5-01..10 (`docs/reviews/R4-R5-G-code-review.md`, `docs/reviews/R5-adversarial.md`). Where this section differs from the text above, this section wins.

1. **Owner lock with a heartbeat (replaces the permanent tab lock of section 6).** The index field `owner` is `{ id, beat }` (`beat` = epoch ms from the injected clock), no longer a bare tab id. The playing tab refreshes `beat` on every write of its active slot and from a timer every `config.ownerBeatMs` (5 s) while a game runs (`store.heartbeat()`, main.js). An owner whose `beat` is older than `config.ownerStaleMs` (**15 s**, i.e. three missed beats) is *stale*. Decision table for a write by tab T: no owner or T owns it, write; a live owner that is not T, refuse with `another-tab`; a stale owner, write (and take over) only if T started after the stale beat, otherwise `another-tab`. `takeOverSaves` makes T the owner on the player's explicit confirmation. A bare string owner left by an older build reads as `{ id, beat: 0 }`, i.e. stale. The tab id is a fresh `crypto.randomUUID()` per page load and is never kept in `sessionStorage` (a duplicated tab copies sessionStorage and would share the id); `pagehide` still releases the owner, so a reload does not need to keep it. `status.owner` is `none | self | other | stale`. Residual risk: a background tab whose timers are throttled beyond 15 s looks stale; a tab that started later may then take over and the first tab's next write is refused (`another-tab`), never interleaved.
2. **Ids that reach markup are restricted in the schema.** Item, affix and unique ids, item `slot`/`effect`/`restores`, requirement keys and `uniquesFound` entries must match `/^[A-Za-z0-9_-]{1,32}$/`; a save with any other value is rejected on load and import (CR-02). Escaping at the UI sinks stays the UI's job; this is defence in depth.
3. **Skills are validated against the rules (CR-03, ADV-R5-04).** Every learned skill is of the class, at level 1 or more, within `reqLevel` and its prerequisites; points spent (the signature's first level is free) plus `skillPoints` may not exceed `(level - 1) * skillPointsPerLevel`; `primary` must be the class's basic attack, `hotkeys` and `secondary` are `null` or a learned active/aura skill of the class; `secondary` is re-derived from `hotkeys[selected]` on load.
4. **Options are not part of a slot (CR-04).** `toSave` writes `options: {}`; on import and load any stored options are dropped (the checksum is verified first, callers re-seal).
5. **Switching characters never loses progress silently (CR-05, CR-06).** The running game is saved before `loadSlot` / `createCharacter` replaces it, also when it is the slot being loaded. If that save fails the switch is aborted (`save-failed-before-switch`, `reason` = the store error) and `status.notice = "pre-switch-save-failed"`.
6. **Persistent status for the UI.** `slotsView` carries `status { storage: ok | memory | full, owner, notice }`. Notices: `no-active-slot` (autosave with no active slot, also toasted once, CR-07), `pre-switch-save-failed`, `migration-failed`; any successful write clears the first two, `dismissSaveNotice` clears all. `storage: "memory"` means localStorage is blocked and nothing persists (ADV-R5-06). Slot summaries gain `deepest`, `savedAt` (ISO UTC) and `hasPrev`.
7. **Migration (replaces section 5 step 1 to 3 where they differ; CR-08, ADV-R5-01).** A missing or invalid index is rebuilt from the slot keys *before* any decision. The legacy save fills slot 1 only when slot 1 is empty; a played slot 1 is never replaced (the legacy keys remain the backup). If the slot write fails the index is still stored with `pendingMigration: true` (slots 2 to 5 stay visible), `status.notice = "migration-failed"`, and the next boot retries; the flag is removed on success. A later delete of slot 1 does not resurrect the legacy save (it runs only without an index or with the flag).
8. **Smaller rules.** `rename` honours the owner lock (CR-09). Creating over or importing over a damaged slot keeps its text in `.bad` (exportable) instead of deleting it. `restorePrev` refuses `newer` slots and any non-empty slot (ADV-R5-03). The core accepts `setName` while paused or dead (whitelisted before the paused/live gates), so the shell no longer flips `paused` (CR-10). Names may contain combining marks `\p{M}` but not start with one (ADV-R5-10). A new character's `xpNext` is `xpTable[1]` (ADV-R5-05). The old single-slot `createSaveStore` is removed; its acceptance tests run against the slot store (CR-11). The storage total is a running sum, rescanned when the number of own keys changes, on a failed write and on `usage({ exact: true })` (CR-13).

## Amendment 2026-10-14 (R6 fix round: save version 3, attribute and affix invariants)

Source: `docs/reviews/R6-adversarial.md` ADV-R6-01 and ADV-R6-05, `docs/reviews/R6-code-review.md` CR6-02 and CR6-15. Where this section differs from the text above, this section wins.

1. **`saveVersion` is 3.** Version 2 is the R5 format (character name, `stats.playTicks`, class trees). Version 3 has the same keys; what changes is a migration and two validation rules. Chain: 0 to 1 to 2 to 3, each step pure; a version 3 input passes `MIGRATIONS[2]` unchanged.
2. **Migration 2 to 3 (ADV-R6-05).** Until R5, Grit was the only attribute that added damage, for every class; since R6 a class names its own power attribute (`derived.powerAttr`: Facilities Manager Grit, Sales Rep Agility, IT Wizard Focus; ADR-0005 amendment of R6-1). For a class whose power attribute is not Grit, every attribute point beyond the class's start values goes back to `player.attrPoints` (all four attributes return to the start values; a refund is never partial per attribute) so the player can re-spend them where they now count. The Facilities Manager and the Clerk migration (which ends as a Facilities Manager) get nothing. A malformed attribute table is left as it is and fails the schema check. Level, xp, skills, gear, stash, gold and the rest are untouched. `migrate()` reports `{ from: 2, attributePointsRefunded: n }` in `notes` (only when n > 0).
3. **Notice.** When a load, an import or the boot migration of the legacy save returns that note, the slot store sets `status.notice = "attributes-refunded"` (a new entry of the notice list in `slots.js`; shown with a Dismiss button; text key `notices["attributes-refunded"]` in `ui/text.js`). It is shown once per load of a version 2 text; once the game saves the slot as version 3 the note is gone. Reloading an unsaved version 2 slot repeats the refund and the notice, which is harmless (the refund is a pure function of the stored text).
4. **Attribute invariant (ADV-R6-01, CR6-02).** `schemaProblem` requires `sum(attrs) + attrPoints <= sum(class start attrs) + (level - 1) * config.attrPointsPerLevel`, the same kind of rule as the skill-point invariant (section 3 of the R5 amendment). A hero played by the rules sits exactly on the bound; no other source grants attribute points (`allocate` spends, `gainXp` and the `setLevel` cheat grant `attrPointsPerLevel` per level).
5. **Rollable gear only (ADV-R6-01b).** A gear item must be something the generator can produce: every affix has an `id` of the affix table and its `stat`, `kind`, `group`, `tier` and `range` equal the table's, the value is an integer inside that range, the tier is unlocked at the item's `ilvl` (`minIlvl <= ilvl`), the group may roll on the base's slot, groups are unique per item, prefixes and suffixes stay within `config.maxPrefixes / maxSuffixes`, and the number of affixes fits the rarity (normal 0, magic at most `magicAffixes[1]`, rare at most `rareAffixes[1]`). A unique carries exactly the fixed affixes of its definition (same order, ids, stats, values) on its own base. `damage` and `defense`, when present, equal the base's. Class tags are not checked (the values are bounded by the table anyway). A top-tier affix needs `ilvl` 20, so a forged `ilvl` buys nothing beyond what depth 7 drops.
6. **Affix ids may contain a dot.** Affix `id` and `group` use `/^[A-Za-z0-9_.-]{1,40}$/` (section 2 of the R5 amendment keeps the stricter pattern for every other id): the fixed affixes of four uniques are named after the stat key (`unique-resist.fire`), and before this fix a save holding one of them could not be loaded back. Found by the generator sweep of `test/save-v3.test.js`.
7. **Tests.** `test/save-v3.test.js` with real R5-shaped fixtures (`test/fixtures/save-v2-r5-{it,sales,fm}.json`: version 2, sealed, level 14, generated magic and rare gear), `test/adv-r6-core.test.js` (ADV-R6-01, 01b, 05).

Addition (orchestrator request): `status` also carries `noticeAttr`: the class's power attribute key (`"agility"`, `"focus"`) while `notice` is `"attributes-refunded"`, else `null`; the migration note is `{ from: 2, attributePointsRefunded, attr }`.

## Amendment 2026-10-14 (R7 quests: save version 4, quest state per slot, pouch, slot card fields)

Source: `ADR-0007-quests.md` (state shape, rules), `../30-spec/12-quests-journal.md` (AC-R-251-1..3, AC-R-252-1, AC-R-253-1..2), `../circles/circle-03.md` Q6. Where this section differs from the text above, this section wins. Owner of the implementation: CORE-R7Q (`docs/reviews/R7-contract.md`).

1. **`saveVersion` is 4.** Chain: 0 to 1 to 2 to 3 to 4, each step pure; a version 4 input passes `MIGRATIONS[3]` unchanged. A text with a version above 4 reports `newer` (the existing rule: the slot is never overwritten). An older build reading a v4 slot sees `newer` for the same reason; the slot index stays at `v: 2` (entries only gain optional fields, point 6), so an older build still reads the list.
2. **One new top-level save key, `quests`** (added to `SAVE_KEYS`; `PLAYER_KEYS` and the four `rng` streams are unchanged). Shape (every value is a plain integer, boolean or short id; no text is stored, so a content rename never invalidates a save):
   ```
   quests: {
     main: { m: { memo: bool, depth: 0..9, unlocked: bool, defeated: bool, verdict: bool } },
     sq1: { s: "available"|"active"|"ready"|"completed", p: int }, sq2: {...}, sq3: {...},
     pinned: "main" | "sq1" | "sq2" | "sq3",
     pouch: [ { id: "qi-sq2", quest: "sq2" } ]
   }
   ```
   `toSave` writes `{...state.quests, pouch: state.player.pouch}`; `loadSave` splits it again and **sets it before the resume `enterFloor`**, so the placement hook of ADR-0007 section 7 re-creates the quest item and the elite of a character saved on floor 3 or 4. Loading never emits a quest cue (events are cleared after load and the first `floorEnter` finds the milestones already set).
3. **Schema rules (`schemaProblem`, forged data stays inside what play can produce).** `quests` has exactly the keys `main`, the ids of `content.questIds` that are side quests, `pinned`, `pouch`; `m` has exactly its five keys with `depth` an integer in `0..config.bossDepth`; `m.depth <= deepestDepth`, `m.unlocked` implies `bossUnlocked || bossDefeated`, `m.defeated` implies `bossDefeated`, `m.verdict` implies `m.defeated`; each side `s` is one of the four states, `p` an integer in `0..goal` with `available` implying `p = 0`, `active` implying `p < goal`, `ready` and `completed` implying `p = goal`; `pinned` is `main` or a side id that is not `completed`; `pouch` holds at most one entry per item quest, each `{id, quest}` with `id` matching `SAFE_ID` and equal to the content item id of `quest`, and **an entry exists if and only if its quest is `ready`**. Any other key or value is `schema`. `config.slotMaxBytes` is unaffected (the block is under 400 characters).
4. **Migration `MIGRATIONS[3]` (v3 to v4), pure, idempotent, no retroactive reward.** Input: any v3 data (after v2 to v3 if needed). Output: `quests` derived from fields every v3 save has:
   - `m.depth` = `deepestDepth` if `deepestDepth >= 2`; else 1 if the character has ever left the Lobby, which is read from the save as `explored[1]` present or `resume.depth >= 1` or `stats.kills > 0`; else 0. (`deepestDepth` alone cannot say "never descended": it is 1 from the first tick. The v3 schema forces `deepestDepth >= 1`, so the spec's "deepestDepth 0" case is the fixture with `deepestDepth 1` and none of those three signs.)
   - `m.unlocked = bossUnlocked || bossDefeated`, `m.defeated = bossDefeated`, `m.memo = m.depth >= 1`, `m.verdict = false`.
   - `sq1..sq3 = { s: "available", p: 0 }`, `pinned = "main"`, `pouch = []`. Nothing else in the save is read or changed: `gold`, `xp`, `items`, `equipment`, `belt`, `stash`, `skills`, `skillPoints`, `attrs`, `stats`, `rng` are byte-identical (asserted by deep-equal). The quest item and the elite are not created (they appear only after an accept, on the next floor entry).
   - Derived main step (ADR-0007 section 2) for the five legal fixtures: never descended: step 1; floor 1 reached (`explored[1]`, `deepestDepth` 1): step 3; `deepestDepth` 4: step 4; `deepestDepth` 8 with `bossUnlocked`: step 5; `bossDefeated`: step 6 ("Read the verdict", the journal action of ADR-0007 section 5).
   - `migrate()` reports no note for 3 to 4 (no dialog is shown; the journal itself is the notice). A corrupt v3 text still ends as `corrupt` or `schema` without an exception.
5. **Fixtures are legal v3 saves (L-038).** `test/fixtures/save-v3-*.json` are produced by a helper that takes `toSave(state)` of the pre-R7 shape: delete `quests`, set `version: 3`, re-seal with `checksumOf`. They are never hand-typed, so every field the v3 schema checks is real. Five fixtures: `save-v3-lobby.json` (step 1), `save-v3-floor1.json` (3), `save-v3-floor4.json` (4), `save-v3-boss-unlocked.json` (5), `save-v3-boss-defeated.json` (6); the e2e fixture of AC-R-251-3 is `save-v3-floor4.json` placed in slot 2 beside a valid slot 1. Existing `save-v2-r5-*.json` run through 2 to 3 to 4.
6. **Slot index entries gain three optional fields** (index `v` stays 2; no breaking change): `mainStep` (1..6), `mainDone` (boolean, all six steps done), `sidesDone` (0..`sideCount`, the number of side quests `completed`). `entryFromState` and `entryFromText` fill them (for a migrated text from the migration output, so a v3 slot shows its derived step with 0 side quests, AC-R-252-1). The slot card shows the step **title** from `content.quests.main.steps[mainStep - 1].title` and "N/`sideCount`" (the title is looked up, never stored, so a customer rename needs no save change). An `ok` entry without `mainStep` (written by an R5 or R6 build) is stale: **`store.upgradeIndex()`** (new, called once at boot right after `migrateLegacy`) runs `rebuild(readIndex())` when any `ok` entry lacks `mainStep`, which keeps `active`, `last` and `owner` and re-derives every entry (cost: five parses, once). `slotsView().list[i]` carries the three fields; an `empty`, `bad` or `newer` entry has none and shows no quest text.
7. **Per-character isolation (AC-R-253-2).** Quest state is inside the slot text only; `createCharacter` builds a fresh `newGame`, so a new slot starts at step 1 with all side quests available; nothing about quests is global or in `office-crawler.options`. Delete, overwrite, rename, import and copy move the whole text as before.
8. **Tests and owners.** `test/save-v4.test.js` (round trip AC-R-251-1, 20 mutated copies never throw, version above 4 `newer`, schema invariants one by one, 500-character cap on the block), `test/save-v4-migrate.test.js` (the five fixtures, idempotence, no retroactive reward, v2 and v1 chains, corrupt input), `test/save-slots.test.js` additions (index fields, `upgradeIndex` keeps `active/last/owner`, a v3 slot lists with its derived step), all owned by CORE-R7Q. Existing assertions that pin version 3 (`test/save-v3.test.js` lines 38, 43, 55; `test/adv-r6-fix.test.js` line 191; `e2e/adv-r6.mjs` line 686) become `config.saveVersion`-relative; the contract names the one-line edit and who makes it.

## Amendment 2026-10-15 (R8 gear visuals, R8-0.3)
The slot index entry gains one optional field `look`: the gear signature of the saved `equipment` (`render/gearlooks.js` `gearSignature`, regex `^[-a-z0-9]{1,4}(\|[-a-z0-9]{1,4}){5}$`, at most 40 characters), written by `entryFromState` and `entryFromText` only when something visible is worn. Missing or malformed means the bare bust; no save version, index version or state change (ADR-0008 section 5).
