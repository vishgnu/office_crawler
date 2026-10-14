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
