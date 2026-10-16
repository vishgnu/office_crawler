# Code review: rounds R4 (core), R5 (WORLD + UI) and G / G-FIX

Reviewer: reviewer agent, 2026-10-14. Read-only. Range: `c1be6f3` (last round-3 commit) to HEAD `0034514`, for `src`, `e2e`, `test`.
Inputs read: spec 11, ADR-0005 and ADR-0006, R4-contract, R4-core-notes, R5-world-notes, R5-ui-progress, 40-nfr, both denylists.
Checks run: `npm test` = 574 pass / 0 fail (read-only). A scratch script (outside the repo) exercised the store and the importer to confirm CR-01 and CR-02/03/04 claims. The e2e suite and a real browser were NOT run.

**Verdict: changes needed.** 2 blocking, 13 should, 13 nit.

Where I looked before claiming something is missing (L-016): `grep -rn "another-tab|owner|takeover" src ui test e2e`, `grep -rn forever src`, `grep -rn createSaveStore src test e2e bot`, `git log`/`git diff c1be6f3..HEAD --stat`.

## Blocking

### CR-01 blocking: tab-owner lock never expires, a crashed or killed tab locks every slot for good
- `src/save/slots.js:122` (`ownerOk`), `:135-144` (`setActive`), `:154` (`write`), `:304` (`importText`); `src/main.js:44-45, 160`.
- The index field `owner` is set when a slot becomes active and cleared only by `clearActive()` on `pagehide` (main.js:160) or Quit. There is no timestamp and no timeout. If the page never gets `pagehide` (browser crash, kill, OS reboot, mobile tab eviction, power loss), `owner` stays in localStorage. The next session is a new tab with a new `tabId` (sessionStorage is empty), so `ownerOk` is false for every `setActive`, `create`, `write`, `autosave`, `remove` and `import`. Confirmed with a script: tab "A" creates slot 1 and never clears; tab "B": `setActive -> another-tab`, `create(2) -> another-tab`, `autosave -> another-tab`. The player sees "open in another tab" with no way out except clearing site data (which deletes all five characters). `list()` rebuild does not clear it either (`rebuild(prev)` copies `owner`).
- Second hole in the same design: `tabId` comes from `sessionStorage` (main.js:45). "Duplicate tab" and `window.open` copy sessionStorage, so two live tabs share one id and the lock is bypassed (two writers on one slot).
- Fix: (a) store `owner` as `{ id, beat }` where `beat = now()`; refresh it from a 10 s `setInterval` and on every write; treat an owner whose beat is older than about 45 s as free. (b) Give the player an explicit "Take over" action on the `another-tab` error (`setActive(n, { takeover: true })`). (c) Use a fresh `crypto.randomUUID()` per page load and drop the sessionStorage reuse (pagehide already clears the owner, so reload survival is not needed). Add tests: stale owner (old beat) is taken over; live owner is respected; takeover works.

### CR-02 blocking: imported item ids are injected unescaped into HTML attributes (stored XSS via a shared save file)
- `src/ui/panels.js:128` (`rowItem` writes `data-tip="${tipKey}"`), callers `:138, :140, :146, :147` build `tipKey` as `` `inv:${it.id}` `` / `` `stash:${it.id}` `` without `esc`; `src/save/format.js:101` accepts any string up to 64 chars as `it.id` (`str(it.id)`).
- A save file with an inventory or stash item id such as `x" onmouseover="..."` passes `schemaProblem` (verified: the importer returned `ok: true` for an equipment item whose id was `x" onmouseover="alert(1)`) and, when the Vendor or Locker panel is rendered, ends up inside an attribute of an `innerHTML` string. The CSP (`src/index.html:6`) is `script-src 'unsafe-inline'`, which allows inline event handlers, so this runs script in the game origin. Export/import of character files is a feature (R-226), so a hostile file is a realistic route. Impact: the script can read and rewrite all five slots in localStorage. Every other id sink in panels.js uses `esc(it.id)` (e.g. `:88`, `:140` data-sell), so this is a missed spot, not a design gap.
- Fix (both, defence in depth): escape in `rowItem` (`data-tip="${esc(tipKey)}"`), and constrain ids in the schema: `/^[A-Za-z0-9_-]{1,32}$/` for `it.id`, `a.id`, `a.group`, `it.unique` etc. Add a test: an imported save with a hostile id is rejected or renders with no attribute break (query the DOM or check the generated string).
- Names are safe: `validateName` allows only letters, digits, space, hyphen, apostrophe (no markup, no bidi controls), and every character-name sink uses `textContent`/`esc` (ui/slots.js, charselect.js, panels.js:104). Item `name`, `flavour`, `baseName` are free text but are all `esc`'d at the sinks I read.

## Should

### CR-03 should: imported `skillBar` is only checked for "valid skill id", not for class, learned state or kind
- `src/save/format.js:150-152`; reader `src/core/systems/basic.js:7`, `skillfx.js:277`.
- `bar.primary` may be any skill id of any class (also a passive or an unlearned one). `basicDef` uses it directly, so a hand-edited or migrated file with `primary: "stapler-throw"` gives a free ranged basic attack with no mana and no learned check (`fireBasic`). Hotkeys may hold passives or other-class skills (the HUD then shows icons that cannot be cast).
- Fix: require `bar.primary === cls.basic`; hotkeys must be `null` or an owned castable (`kind` active/aura, class equal, `p.skills[id] >= 1`); `selected` must index a hotkey. Add a hostile-skillbar import test.

### CR-04 should: `options` inside a save is an unbounded free-form object
- `src/save/format.js:170` (`isObj(d.options)` only), `toSave` `format.js:65`, `game.js:48` (core.options is replaced by the global options after load, so the embedded copy is dead data).
- An imported file can carry up to the 1 MB import cap (400 KB slot cap after canonicalising) of arbitrary nested JSON (also an own key named `__proto__`, verified to survive `load()` as an own property; no pollution happened because clone uses JSON, but any future `Object.assign(x, state.options)` would hit the setter). It also exports the player's key bindings with every character.
- Fix: write `options: {}` in `toSave` (ADR-0006 section 3 says options are global and not part of a slot) and validate `d.options` as empty or as the normalised shape; strip on import.

### CR-05 should: running game is not protected when the pre-switch save fails
- `src/save/session.js:39` (`createCharacter`) and `:48` (`loadSlot`): `store.write(store.activeSlot(), running)` is called and its result ignored; the game is then replaced.
- On `quota`, `too-large`, `another-tab` or `write-failed` the progress since the last autosave is lost silently. The store raises a toast via `onNotice`, but the toast belongs to the game that is about to be replaced (`startState` resets the UI), so the player never sees it.
- Fix: if the pre-save fails, return `fail("save-failed-before-switch", {…})` and do not switch, or ask the player to confirm "discard progress since last autosave". Test: failing adapter, then `loadSlot` keeps the running game.

### CR-06 should: loading the slot you are already playing reloads the older stored copy
- `src/save/session.js:48` (condition `store.activeSlot() !== slot`), UI button `ui/slots.js:101-102`.
- When `slot === active` no save happens first, then `store.load(slot)` returns the last autosave and `startState` replaces the running game: progress since the last autosave is discarded without a confirmation (autosaves are coalesced by `autosaveMinTicks` and fire on events, not continuously). The "Continue here" button is disabled while playing in ui/slots.js, but `slots.run`, the testhook and the `continue` command are not.
- Fix: for `slot === active` either refuse with `playing` (as delete/import do in `game.js:149`) or force-save first.

### CR-07 should: autosave with no active slot is silent, ADR-0006 says it must tell the player
- `src/save/slots.js:172-175` returns `fail("no-active-slot")` without `tell`; `src/main.js:158` ignores `r` unless `r.ok`.
- Reachable after `pagehide` + bfcache restore when `ensureActive` fails (another tab took the slot, main.js:157), or after a lost index. The game keeps running and nothing saves, with no message. ADR-0006 section 4: "with no active slot it does nothing and tells the player".
- Fix: `tell("saveFailed")` (rate-limited) when `autosave` has no active slot or `ensureActive` fails; show a persistent banner while the game runs unsaved.

### CR-08 should: legacy migration can be skipped forever after one failed write
- `src/save/slots.js:329-331` (`migrateLegacy` returns early on `putRoom` failure without writing an index) combined with `index()` at `:116-119` (a missing index is rebuilt from the slot keys and stored).
- If the first boot cannot write `slot.1` (quota), no index exists. The next `list()` rebuilds an empty index (slot 1 is absent) and writes it, so `migrateLegacy` (which runs only while the index is absent) never runs again. The legacy key is kept, but the old character is invisible in the UI. ADR-0006 section 5 step 3 assumes a retry on the next boot.
- Fix: in `index()`'s rebuild path, when `office-crawler.save` exists and slot 1 is empty, run the migration instead of storing an empty index; or have `migrateLegacy` write the index with slot 1 `state: "bad"` + `reason: "quota"` so the legacy text is exportable. Test: failing adapter at boot, then a working one.

### CR-09 should: `rename` skips the tab-owner check and `create` over a damaged slot deletes the exportable text
- `src/save/slots.js:255-270` (`rename` has no `ownerOk`, unlike write/remove/import); `:189` (`create` calls `adapter.removeItem(badKey(n))` after overwriting a `bad` slot, no undo copy is made because `keepPrev` is only set for `ok` slots, `:188`).
- First: a second tab can rewrite the text of the slot the first tab is playing; the next autosave of tab A overwrites it, so the visible effect is a lost rename. Second: overwriting a damaged slot (confirmed in the UI) destroys the only copy of that text, which the whole `bad` feature exists to preserve.
- Fix: add the `ownerOk` guard to `rename`; for a `bad` slot move `.bad` to `.prev` instead of deleting it.

### CR-10 should: `setName`-while-paused workaround can leave the game unpaused
- `src/game.js:151`: `running.paused = false; game.input(...); running.paused = was;` has no `try/finally`; if `applyInput` or an event listener throws, the game stays unpaused with the pause menu open.
- Better fix: let the core accept `setName` while paused (a one-entry whitelist in `applyInput`'s paused gate), then delete the flip. It is the only place where shell code mutates a core flag to bypass a core rule. Minimum fix: `try { … } finally { running.paused = was; }`.

### CR-11 should: the single-slot `createSaveStore` is dead in production but still carries the old save ACs
- `src/save/storage.js:59-150`, exported at `src/save/index.js:4`; used only by `test/save.test.js` and `test/s3-final.test.js` (grep: no use in `src`, `e2e`, `bot`).
- About 100 lines ship in the bundle and ~15 tests (AC-R-090-6, -091-5, -092, NFR-D03-3 etc.) now pin the behaviour of a store the game no longer calls, so they give false assurance about the live path. Several have no slot-store twin (e.g. "a burst of 100 autosave triggers writes once" has one in save-slots.test.js; "a write that throws keeps the game running" has `:141`; "tampered files are refused" is covered only for the old store).
- Fix: keep the format/adapters, delete `createSaveStore`, port the remaining unique assertions to `createSlotStore`, and remove the `saveKey` use except in `migrateLegacy`. ADR-0006 "Consequences" says storage.js is reworked into slots.js.

### CR-12 should: slot cards show current location, not deepest floor; last played is relative, not date and time
- `src/ui/slots.js:57-58` (`where(e)` uses `e.depth`), `:49-56` (`fmtWhen`).
- R-222 asks for "deepest floor (depth)" and "last played (local date and time)". The index already stores `deepest` and `lastPlayed`; `deepest` is never rendered; dates are shown only after 24 h and then without a time.
- Fix: render `T.slFloor deepest` (and keep the Lobby/current floor as a second hint if wanted); print `toLocaleString` after 24 h. Update `ui-r5.test.js` which pins the old summary string.

### CR-13 should: `usageChars()` reads every own key on each write
- `src/save/slots.js:75, 85-93`: `putRoom` computes `usageChars() - get(key).length + …` before every write, which calls `getItem` for all `office-crawler.*` keys (up to 5 slots x 400 KB plus `.prev`/`.bad`) on each autosave, and again in the retry loop. `slotsView` (session.js:21) also calls `store.usage()` each time the slot cache is invalidated, i.e. after every autosave.
- Cost is small at typical 30-100 KB saves but grows to several MB of string traffic per autosave near the cap, on the main thread, during play.
- Fix: keep a running total updated by `put`/`removeItem` in the store, or read `usage()` only when the slot manager is open and use the `bytes` already in the index for the ceiling check.

### CR-14 should: per-frame allocation and re-sorting in the loot-plate path
- `src/render/fx.js:640-641` (`order.sort` with `Math.hypot` in the comparator, every frame), `:675` (`vis.filter(...).sort(...)` allocates two arrays in a crowd), `:678` (`vis.sort` with a three-way comparator), and per plate `{x,y,w,h}` + `gapRect(r)` inside the placement loops (`:693-702`).
- Bounded by the number of ground items on screen, but this is the exact case (a pile after a kill) where frames are already tight: bench median is 47 fps (G-fix-progress) against NFR-P01 60 fps target / 30 floor, with a thin margin. S4 in the earlier review demanded allocation-free hot paths.
- Fix: precompute `d` once when building `order` (store distance, sort by the cached key), reuse scratch rect objects, replace the `elig` filter+sort with a bounded partial selection of `CROWD_CAP` items, and skip the whole pass when the item set and hero tile are unchanged since the last frame.

### CR-15 should: slot store and UI duplicate storage knowledge and the UI reads the adapter
- `src/ui/slots.js:14` redefines the `.prev` key name, `:109, :119, :138` call `h.adapter.getItem(prevKey(n))` directly; `src/main.js:164` passes `adapter` through `shell`.
- Layering intent (ADR-0002) is that `ui` talks to the shell through commands. A key-format change in `slots.js` would silently break the Undo buttons. The undo-for-replace also re-imports through `importSlot` (two writes, and it overwrites `.prev` with the current text, which is correct but undocumented).
- Fix: add `store.hasPrev(n)` and a session command `undoSlot` (wrapping `restorePrev` and the swap), expose through `game.slots.view` (e.g. `entry.undo: "replace"|"delete"|null`), and remove `h.adapter`.

## Nit

- CR-16 nit, `src/save/slots.js:33-38`: `validIndex` checks only `n` and `state`; entry fields (`name`, `class`, `level`, `bytes`) come straight from localStorage into the UI. All sinks use `textContent`, so no injection, but a tampered index shows `undefined` in cards. Validate entry shapes and drop to `rebuild` on mismatch.
- CR-17 nit, `src/save/slots.js:9`: unused import `classById`. Other unused: `src/core/systems/skills.js:3` (`getCtx`), `src/ui/panels.js:9` (`xpRatio`), `src/ui/screens.js:7` (`resetDraft`).
- CR-18 nit, `src/core/systems/skillfx.js:17`: `alive()` is defined and never used (it would allocate a filtered array per call, good that it is unused). Delete.
- CR-19 nit, dead UI code: `src/ui/slots.js:167` (`void occupied` plus the variable), `:227` (`if (msg.undo) { /* reserved */ }` and the `undo` field of `say`), `:213` (`.replace(/^Replace /, "Replace ")` is a no-op, and building the title by string-replacing "this character" is brittle), `src/ui/charselect.js:297` (`.replace(/^Replace Replace/, "Replace")`), `src/ui/text.js:100` (`slDeleteForever` string and `store.remove({forever})` at slots.js:222-229 have no caller: the "Delete forever" choice of ADR-0006 section 4 was dropped without a note).
- CR-20 nit, `src/ui/slots.js:163`: the file picker calls `await f.text()` before any size check; a multi-hundred-MB file is read into memory and only then rejected by `importText` (1 MB cap). Check `f.size > 1_000_000` first and show `errCorrupt`/"too large".
- CR-21 nit, `src/save/slots.js:60, 286`: `safeName` collapses non-ASCII names (valid per `validateName`, e.g. "Zoë", "李明") to `character` or strips letters; two exports then share the file name. Acceptable but note it in the UI help or transliterate with `normalize("NFKD")`.
- CR-22 nit, `test/layering.test.js:31-38` (N5): the test only matches `from "..."`. A side-effect import (`import "../render/x.js"`) or a dynamic `import("../render/…")` in `ui/` or `input/` passes. Extend the regex to `import\s+["']` and `import\(`. (Currently clean: the shell injects the figure painter through `ui/figureHost.js`, `main.js:36`.)
- CR-23 nit, `test/render-g.test.js:15-26, :36`: several assertions restate constants (`AMBIENT_LIFT === 0.12`, `TEXTURES.length === 11`, `TEX_GAIN === 1.5`, `AMBIENT_LIFT <= 0.15` right after `=== 0.12`). They break on any tuning and verify nothing about output. Keep the table-completeness tests (weights sum, every theme has textures, decor keys required) and the tint test (`:28-43`), which does assert behaviour; drop or loosen the rest.
- CR-24 nit, `src/render/draw/effects.js:30-40`: `SKILL_LOOK` is a fallback table "for older cores"; every skill in the repo carries `fx.cast`, so it duplicates data and can drift. Remove it and let a missing `fx` draw nothing, with a test that every skill has `fx.cast` (render-r5 test line 44 already checks the archetype keys). Also `skillLook` returns a fresh object per call (`:68`); cache it per id+level if it is called per event in a burst.
- CR-25 nit, `src/render/light.js:123, :188`: `sprite(colour, bands)` builds the cache key `colour + bands.length` as a new string for every light on every frame (and the key scheme relies on the three band tables having distinct lengths: 18, 14, 8). Cache by object identity (`Map` keyed by the bands array, then colour) or precompute per light kind; `flicker()` (`:55`) creates a closure per call.
- CR-26 nit, `src/ui/charselect.js:319`: the `resize` handler calls `layout()` on every event (rebuilds the backdrop canvas and both sprites). Debounce with `requestAnimationFrame`.
- CR-27 nit, IP/denylist: the denylists are clean for `src`, `test`, `e2e` (grep over every term of both files, word-boundary, no hits; skill names are generic office terms and the Diablo "Fire Wall" skill is renamed "Packet Filter", id `firewall`, covered by `classes.test.js:102`). Gap: only `ip-denylist.txt` is enforced over the whole source tree (`test/ip-denylist.test.js`, `legal.test.js`); `ip-denylist-brands.txt` is checked only for story text and suggested names (`s3-final.test.js:134`, `name.test.js:31`). New skill, item, affix and monster names are not checked against the brands list. Point the two tree-wide tests at both files.
- CR-28 nit, test hook ships in the release bundle behind `?test=1` (ADR-0003 section "Consequences", accepted) and now also exposes `slots.fail(on)`, `slots.run(cmd)` and `cheat.damageMonster`. Not new risk class, but any visitor can open `?test=1` and rewrite saves via `__app`; when the release decision in ADR-0003 is taken, strip `src/testhook` from the release build. `src/testhook/index.js` also passes `characterHook({...}, { start: () => {} })`, whose `start` callback is a no-op, so `character.create` relies on `game.session` to start the game: simplify the hook.

## Checked and found fine
- Core purity and determinism: `test/layering.test.js` (no DOM, clock, `Math.random`, transcendental maths, only core imports) passes; I found no `Date`, `performance` or `Math.random` in `src/core`. Skill effects draw from the `combat` stream only; iteration order is array order (`statuses.js`, `allies.js`, `zones.js`). Allies, zones and dash are cleared on floor change (`world.js:56, :62`) and are not persisted (the save resumes in the Lobby or at the floor entry), so no stale-reference risk.
- `castSkill` rejects unlearned and passive skills before mana is spent (`skills.js:27-31`), `learnSkill`/`respec`/`toggleAura` use `Object.hasOwn` for ids and return stable error codes; respec refunds exactly the learned levels except the free signature and clears allies, zones, buffs, aura, dash.
- Save robustness: size cap before parse, checksum, schema with `hasOnly` key lists, `Object.hasOwn` for base/skill ids, explored-map bounds, item-grid overlap check, per-slot corruption isolation (`load` moves damaged text to `.bad`), `newer` slots never overwritten, index repair (rules a and b), write order slot-then-index, quota ladder. Importing `{"__proto__": …}` does not pollute `Object.prototype` (verified).
- Name handling end to end: `validateName` in core, UI, session and schema; all sinks use `textContent` or `esc`.
- N5 holds: `ui/` and `input/` have no import from `render/`; figure painter and accent colours arrive through `ui/figureHost.js`.
- Test quality: no test without an assertion (scripted scan of all `test(` blocks), no skipped or todo tests; the slot-store tests assert byte-identical neighbours, crash-between-writes repair, quota order and migration idempotence. Gaps are listed above (hostile id, hostile skill bar, stale owner, failed pre-save).

## Not done
- No browser run: the XSS in CR-02 is confirmed by reading the template code and by the importer accepting the id, not by executing it in a DOM.
- `npm run e2e`, the bench and the bot were not run (the orchestrator's note says e2e 12/12 at HEAD).
- No numeric balance review of the 30 skill rows (ADR-0005 values), no visual judgement of the G / G-FIX art (covered by the two visual reviews), no audio listening.
- Core diff was reviewed for progression, skill runner, statuses, allies, zones and the step order; `damage.js`, `derive.js`, `loot.js`, `treeview.js` and the render style files were skimmed only for hot-path patterns and purity.
