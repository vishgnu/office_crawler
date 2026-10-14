# R5 adversarial pass (test-engineer, adversarial mode, 2026-10-14)

Scope: rounds 4 (core: classes, skill trees, respec, five-slot store, migration), 5 (UI: class selection, slot manager, skill tree panel, options) and G (render). I did not write this code and did not read the implementer's tests before writing mine.
Method: read the spec (11), ADR-0005/0006, the R4 contract and notes, `src/save/**`, `src/core` (classes, skills, progression, treeview), `src/ui/{charselect,slots,tree,options,screens}.js`, `src/main.js`, `src/game.js`; probed each hypothesis in node first, then reproduced in Chromium (Playwright 1.56.1), then froze it as a test.
No `src/` file was changed. Every defect below has a test that is marked as an expected failure (`{ todo: 'ADV-R5-NN' }` in node:test, `xfail(...)` in the e2e script) so the suites stay green.

Tests: `test/adv-r5-save.test.js` (25 cases, 8 todo), `test/adv-r5-core.test.js` (17 cases, 2 todo), `e2e/adv-r5.mjs` (110 checks pass; registered in `e2e/run-all.mjs`; 12 expected failures are printed as `XFAIL ADV-R5-NN` and turn into `XPASS` when fixed). Screenshots: `docs/shots/adv-r5-*.jpg`.

## Summary

| id | severity | title |
|---|---|---|
| ADV-R5-01 | major | Boot migration hides slots 2 to 5 when the index key is missing, and a kept legacy backup overwrites slot 1 |
| ADV-R5-02 | major | A tab that dies without `pagehide` leaves an owner id behind: every other tab is locked out for ever |
| ADV-R5-06 | major | localStorage blocked: the game silently falls back to memory, the player is never told that nothing is saved |
| ADV-R5-07 | major | Slot manager confirmations do not take focus, do not trap it and do not give it back (AC-NFR-A07-1) |
| ADV-R5-03 | minor | `restorePrev` overwrites a slot that holds a save from a newer build |
| ADV-R5-04 | minor | Save schema accepts impossible skill allocations, cross-class skill bars and a stale `secondary` |
| ADV-R5-05 | minor | A new character shows `xpNext` 80, the real level-2 threshold is 146 (changes after the first xp, or after a save and load) |
| ADV-R5-08 | minor | Loading another character from the pause menu has no confirmation dialog (AC-R-223-2) |
| ADV-R5-09 | minor | Rename is not guarded against another tab and is silently reverted on the death screen |
| ADV-R5-10 | minor | Name validator rejects letters with combining marks (decomposed accents, Thai, Devanagari) |
| ADV-R5-11 | minor | Esc pressed after Start (during the elevator transition) closes the screen but the character is still created |

Counts: blocker 0, major 4, minor 7.

What held up (all tested, all green): five-slot isolation and byte-identical neighbours over 100 autosaves; slot numbers 0, 6, -1, 1.5, "2", NaN, null; 27 hostile import payloads (empty, null, arrays, 100 000 nested brackets, 1 MB of numbers, wrong checksum, newer and negative versions, `__proto__`, markup names) with no throw and no write; 13 sealed-but-nonsense saves (bad items, duplicate ids, off-grid items, bad rng, bad names); 200 single-character mutations; corrupt, newer and oversized slots at boot with the other slots loading; quota full on create and on overwrite (failed write changes nothing); delete, undo, replace, undo-of-undo; legacy Clerk migration (idempotent, backup kept, refund, damaged and newer legacy); points conservation over 29 level-ups with random learns and respecs for three classes and three seeds; learn, assign, select, respec, aura rules with hostile arguments; XP edge cases at the cap; per-class determinism of a learn/respec/cast script; every skill of every class cast at hostile tiles (no throw, no slowdown); every skill of every class rendered in real frames on a populated floor; keyboard-only class selection; double Start; 390 px layouts without horizontal scroll; reload, pagehide and bfcache restore.

## Findings

### ADV-R5-01 (major) Boot migration hides slots 2 to 5 when the index key is missing; a legacy backup overwrites slot 1

- Repro (node): create characters in slots 2 and 4, remove the key `office-crawler.slots`, create a fresh store on the same storage and call `migrateLegacy()` (what `main.js` does before anything reads the index). `list()` then shows five empty slots; the texts `office-crawler.slot.2` and `.4` are still in storage but invisible. Choosing New game then fills the "empty" slot without any confirmation (`create` on `state: "empty"`), so the old character is overwritten with no undo copy.
- Repro 2: same with the legacy key `office-crawler.save` still present (it is kept on purpose as a backup, ADR-0006 section 5): slot 1 holds a character with progress; after the index is lost the next boot migrates the stale legacy save over it (observed: gold 123456 became the legacy fixture's 777, name "Factory One" became "Employee").
- Browser repro: `e2e/adv-r5.mjs` "slot texts without an index key..." (context seeded with slot 1 and 2 texts, no index): the title shows five empty slots.
- Expected: when the index is missing, rebuild it from the slot keys (repair rule a of ADR-0006) before deciding anything; migrate the legacy save only into a slot that is empty (AC-R-225-3: slot 1 occupied means the old save goes to the first empty slot or stays as backup).
- Actual: `migrateLegacy()` starts from `emptyIndex()` whenever the index key is absent and writes it; it never looks at existing slot keys and never checks that slot 1 is free.
- Suspect: `src/save/slots.js:320-343` (`migrateLegacy`: lines 321-322 `emptyIndex()`, 329 `putRoom(slotKey(1), ...)`, 341 `writeIndex(idx)`); contrast `rebuild()` at 102-113 which would have found the slots.
- How the index goes missing in practice: the index write failing under quota (the code explicitly tolerates `indexed: false`, line 166) followed by a reload; partial site-data clearing; restoring a partial backup. A reload with a healthy page does not trigger it because `pagehide` calls `activeSlot()` which rebuilds the index first (I verified this: removing the key and reloading in the same tab heals), so the browser repro seeds the storage before the first boot.
- Tests: `test/adv-r5-save.test.js` "ADV-R5-01a", "ADV-R5-01b"; `e2e/adv-r5.mjs` two `XFAIL ADV-R5-01` lines.

### ADV-R5-02 (major) Dead tab locks every other tab out for ever

- Repro (node): tab A creates a character (index `owner: "A"`), is killed without `pagehide` (crash, mobile tab discard, power loss; Playwright `page.close()` also does not run `pagehide`). A day later a new tab B (new `sessionStorage`, so a new tab id) opens: `continue` returns `another-tab`, `createCharacter` returns `another-tab`, delete and import too.
- Browser repro: set `owner` in the stored index to a foreign id, reload: Continue stays on the title with "This game is open in another tab. Close it there to play here." and so does New game. There is no way out in the UI; the player has to clear site data, which destroys all five characters.
- Expected: ownership must expire or be takeable. The ADR's own safeguard (ADR-0006 section 6) is meant to stop two live tabs from interleaving writes, not to survive the tab. A heartbeat (`ownerSeen` timestamp refreshed on each write, taken over after N minutes), or a "Play here anyway" action on the notice, would do.
- Actual: `ownerOk(idx)` is `!tabId || !idx.owner || idx.owner === tabId` with no time component; the only code that clears `owner` is `clearActive()` and `remove()` of the active slot, both run by the same tab (`pagehide`, quit to title).
- Suspect: `src/save/slots.js:122` (`ownerOk`), `:139-140` (`setActive`), `:145` (`clearActive`); `src/main.js:36-37` (tab id from `sessionStorage`), `:136` (`pagehide` is the only release).
- Tests: node "ADV-R5-02" (clock jumps 24 h, Continue must work); e2e two `XFAIL ADV-R5-02` lines (Continue and New game).

### ADV-R5-03 (minor) `restorePrev` overwrites a newer-build slot

- Repro (node): delete slot 1 (undo copy kept), then slot 1's text becomes a save with `version` above `config.saveVersion` and the index is rebuilt (`state: "newer"`); `restorePrev(1)` writes the undo copy over it. `write`, `create`, `importText` all refuse `newer` ("never overwritten"), `restorePrev` only refuses `ok`.
- Not reachable from the shipped UI (the Undo button only exists on empty cards); reachable through `slots.run({t:"restoreSlot"})` and any future caller.
- Suspect: `src/save/slots.js:246` (`if (idx.slots[n - 1].state === "ok") return fail("occupied")`; should be `!== "empty"` or at least exclude `newer`).
- Test: node "ADV-R5-03".

### ADV-R5-04 (minor) Schema accepts impossible or inconsistent characters

- Repro (node): take a valid level 1 sales rep, set every skill to its max level, re-seal the checksum: accepted (`deserialize(...).ok === true`). Also accepted: `skillBar.hotkeys` holding other classes' skills (`pallet-slam`, `server-overheat`), `skillBar.primary` set to another class's basic attack (`zap`), and `secondary` that does not match `hotkeys[selected]` (selected hotkey empty, `secondary: "stapler-throw"`: the right mouse then fires a skill that is not on the selected slot).
- Expected: the schema keeps the point invariant of AC-R-205-1 (`spent + skillPoints <= levelsGained * perLevel`), checks prerequisites and level gates per learned skill (otherwise the panel shows `canLearn` true but `learnSkill` answers `level-gate`/`prereq`), requires bar entries to be class skills and `primary` to be the class basic, and re-derives `secondary` from `hotkeys[selected]` on load (`syncBar`).
- Impact: not anti-cheat (the checksum is not meant to be), but an imported or hand-edited file can put the UI and the core in states that the rules say cannot exist; the cross-class cases are the ones most likely to hit untested render or cast paths. I saw no throw with them, only wrong behaviour.
- Suspect: `src/save/format.js:150-156` (skills and skill bar checks), `loadSave` at `:199` (no `syncBar`).
- Tests: node "ADV-R5-04a/b/c".

### ADV-R5-05 (minor) New character xpNext is 80, the level-up needs 146

- Repro (node): `newGame(1, {class:"sales-rep"})` has `player.xpNext === 80`, but `config.xpTable[1] === 146`; `gainXp(st, 80)` leaves the character at level 1 with `xpNext` suddenly 146. After a save and load `xpNext` is 146 straight away (`loadSave` uses `xpNextFor(level)`), so a fresh character and the same character reloaded differ in `getState()` (AC-R-221-4 wants them deep-equal), and `hashState` of the two differs for that reason.
- Expected: `xpNext` at level 1 is `xpNextFor(1)` = 146, the HUD bar reads 0 / 146 from the start.
- Suspect: `src/core/config.js:80` (`player.xpNext: 80`, a stale constant) used by `src/core/state.js:36`; `xpNextFor` at `src/core/systems/progression.js:12`.
- Note: changing it changes the golden hash (`test/fixtures/run-a.hash`); that is why it was probably left. Report only.
- Tests: node (save) "ADV-R5-05", node (core) "ADV-R5-05 (xp bar at level 1)".

### ADV-R5-06 (major) Blocked storage: silent in-memory fallback

- Repro (browser): a context where reading `window.localStorage` throws `SecurityError` (blocked site data, some private modes). `createAdapter()` returns a memory adapter flagged `fallback: true`; nothing reads that flag. The game starts a character, shows it as slot 1 in the Load list, autosaves "successfully", and on the next visit everything is gone. No notice, no toast, no title line.
- Expected: AC-R-090-6 (storage that is blocked: the game keeps running and `ui.notice` shows a save-failed message), and the same wording for "saving is not available here" (`strings.errNoStorage` exists but is only used for a missing session).
- Suspect: `src/save/storage.js:41-46` (`fallback` is set and never read); `src/main.js:37` (adapter creation; no check of `store.adapter.fallback`).
- Test: e2e `XFAIL ADV-R5-06`.

### ADV-R5-07 (major) Slot confirmations: no focus move, no trap, no return of focus

- Repro (browser, keyboard): title, Load game, press Delete on slot 1. The Delete button is removed by the re-render, so `document.activeElement` becomes `<body>`. Tab goes to the dialog's close X, then Yes, then No, then leaves the page (focus on `<body>`), then starts again; Shift+Tab likewise. After Cancel the focus is lost again instead of returning to Delete.
- Expected: AC-NFR-A07-1: "focus is trapped inside a confirmation dialog and returned on close". The class-screen replace confirmation does it right (`yes.focus()`), the slot manager's does not (delete, import-replace).
- Suspect: `src/ui/slots.js:127` (`button()` sets `focusKey` to the pressed button, which no longer exists after `render()`), `:150-158` (`confirmBox` never focuses its first button, no keydown trap), `:233` (restores focus only to an element that still exists).
- Tests: e2e `XFAIL ADV-R5-07` x3 (focus enters, Tab stays inside, focus returns).

### ADV-R5-08 (minor) Load from the pause menu has no confirmation

- Repro (browser): play slot 2, pause, Save slots, Load on slot 1. The game switches at once. AC-R-223-2: "a dialog warns that unsaved floor progress is lost and names the affected character; Cancel leaves the running game and all slots unchanged".
- What is true: the running game is saved first (verified: gold 550 reached slot 2), so no inventory or level is lost; only the floor state (monsters, ground loot, position, which `resume` can only put back at the floor entry) is dropped, silently.
- Suspect: `src/ui/slots.js:96` (`slot-load-N` calls `run({t:"loadSlot"})` directly), `src/save/session.js:48`.
- Test: e2e `XFAIL ADV-R5-08`.

### ADV-R5-09 (minor) Rename: no tab guard, and lost on the death screen

- (a) `store.rename` does not call `ownerOk`, unlike delete, import, write. Tab B renames the character tab A is playing and gets `ok`; tab A's next autosave writes its own state and the new name is gone. Expected: `another-tab`, like the other writes.
- (b) With the character on the death screen (`scene: "dead"`) `renameSlot` on the active slot returns `ok` and updates the slot text, but `applyInput(setName)` is refused for the running state (or never reached), so the running game keeps the old name and the next autosave reverts the rename. Not reachable from the shipped UI (the death screen has no slot manager), reachable through `slots.run`.
- Suspect: `src/save/slots.js:255-270` (no `ownerOk`), `src/game.js:184` (`renameSlot` branch only sets the name through `game.input`, ignores its result).
- Tests: e2e two `XFAIL ADV-R5-09` lines.

### ADV-R5-10 (minor) Names with combining marks are rejected

- `validateName("José")` (decomposed accent, which is what macOS and some IMEs produce), Devanagari "नमस्ते" and Thai "สวัสดี" are all `bad-name`, because the allowed set is `\p{L}\p{N}` and vowel signs and accents are `\p{M}`. The error text promises "letters, digits, spaces, hyphens or apostrophes".
- Fix: add `\p{M}` (the zero-width joiner and the bidi controls can stay out).
- Suspect: `src/core/name.js:6` (`ALLOWED`).
- Test: node (core) "ADV-R5-10".

### ADV-R5-11 (minor) Esc after Start does not cancel the start

- Repro (browser, animations on): fill a name, press Start, press Esc while the elevator doors close (1.1 s). The class screen closes (`game.closeCreate`) but the transition callback still runs `createCharacter`, so the game starts anyway. AC-R-214-1: "Esc goes back one step without creating anything".
- Suspect: `src/ui/screens.js` `playTransition` (callback not cancelled when the screen is destroyed), `src/ui/charselect.js:271-277` (`begin` has no "still current" guard); `game.key` handles Escape for `ui.create` regardless of `busy`.
- Test: e2e `XFAIL ADV-R5-11`.

## Other observations (not defects, or not reproducible through the shipped UI)

- Class parity smoke (report only, three seeds, whole run to the boss, `node bot/run-headless.mjs 3 150000 - 9 all`): Facilities Manager 3/3 won, median 26.3 min, median 2 deaths; Sales Rep 2/3 won, median 34.1 min, median 6 deaths; IT Wizard 3/3 won, median 32.0 min, median 3 deaths; median level 14 for all. Spec band is 20 to 40 min; the Sales Rep has the most deaths and one failed run. Three seeds is far too few for a conclusion; R6 owns tuning. A floor-1 smoke on three seeds per class runs inside `test/adv-r5-core.test.js` and prints one line per run.
- `learnSkill` accepts a one-element array as an id (`["pallet-slam"]` coerces to the string); harmless (the UI only sends strings), noted because `Object.hasOwn(skills, id)` is the only type check.
- Import of a file between 400 000 and 1 000 000 characters is refused as "not a usable character" (`ERR["too-large"]` maps to `errCorrupt`; `strings.errTooLarge` exists and is unused). A hand-placed valid text in that range is indexed as `bad/size` yet `store.load` would load it (`deserialize` uses `saveMaxBytes`, the index uses `slotMaxBytes`). Not reachable with real saves (worst case is far below 400 000).
- Delete with a full storage proceeds without an undo copy (the confirmation was given, and the Undo button correctly does not appear). Fine.
- Tab and the modal slot dialog at 390 px, class screen at 390 px (screenshots `adv-r5-create-390.jpg`, `adv-r5-tree-390.jpg`, `adv-r5-slots-390.jpg`): no horizontal overflow, Start stays reachable; the skill tree panel at 390 px is a single column and works.
- Respec has no confirmation and is free and unlimited (`config.respec.mode: "free"`): by design (proxy answer), noted because one click removes all skills.
- Delete of a non-active slot is refused with `another-tab` while another tab plays a different slot (owner is index-wide, not per slot). Conservative, consistent with ADR-0006.
- The "Undo" for delete/replace is remembered per page session (`undoable` map in `ui/slots.js`); after a reload the undo copy is still in storage but the button is gone.

## Coverage against the attack areas

Save slots (5 slots, index key, corrupt/oversized/newer JSON, quota, hostile import, delete/undo/replace races, two tabs, migration, autosave to the active slot): covered in `test/adv-r5-save.test.js` and `e2e/adv-r5.mjs`. Skill trees (prerequisites, points, respec only in the Lobby, F1 to F4, aura, level edges, determinism): `test/adv-r5-core.test.js` and the tree block of the e2e. Character select (keyboard only, Esc/focus, double Start, 390 px): e2e. Class parity via bots: report above. Pause/rename/quit/resume: e2e. Rendering with each class and skill: e2e (all active and aura skills of the three classes at level 30 with monsters in view, real frames, zero page errors).

---

## Round 2 (after the fix round: SAVE-FIX, UI-FIX, WORLD-FIX)

Files: `test/adv-r5b-save.test.js` (17 cases, 1 todo ADV-R5-12 and 1 todo ADV-R5-14), `e2e/adv-r5.mjs` (extended; 150 checks pass, 2 expected failures), screenshots `docs/shots/adv-r5b-takeover.jpg`, `docs/shots/adv-r5b-load-confirm.jpg` (both viewed). `test/adv-r5-save.test.js` and `adv-r5-core.test.js` were left to SAVE-FIX; all their former todo cases now pass.

### Round 1 findings: status

| id | status | evidence |
|---|---|---|
| ADV-R5-01 | fixed | e2e: slot texts without an index are found; a played slot 1 survives a kept legacy backup; node: retry flag keeps slots 2-5 visible |
| ADV-R5-02 | fixed | e2e: stale owner (60 s old beat) is taken over by Continue and New game; live owner blocks with a banner and Take over |
| ADV-R5-03 | fixed | node: restorePrev leaves newer slots and live characters alone |
| ADV-R5-04 | fixed | node: 20 illegal skill, point and bar cases rejected, legal edges accepted |
| ADV-R5-05 | fixed | node: xpNext 146 fresh and after load |
| ADV-R5-06 | fixed | e2e: blocked storage is announced |
| ADV-R5-07 | fixed | e2e: delete, import-replace, load and take-over dialogs take focus, trap Tab, Esc closes only the dialog, focus returns |
| ADV-R5-08 | fixed | e2e: load confirmation names both characters, Cancel keeps the game |
| ADV-R5-09 | fixed | e2e/node: rename refused with another-tab; death-screen rename survives autosave |
| ADV-R5-10 | fixed | combining marks accepted |
| ADV-R5-11 | fixed | e2e: Esc during the elevator creates nothing |

### Re-attack results (all green unless listed under new findings)

- Heartbeat and stale timing (node, injected clock): two live tabs refused on every write path (create, load, delete, rename, import, copy, restore) over 20 beat periods; boundary at exactly 15 s is still live, +1 ms is stale; a tab opened before the last beat needs Take over (no silent takeover); a frozen background tab (20 s without beats) is displaced and, when it thaws, cannot write, beat or steal the lock back; takeOver while the old owner is still beating makes the old owner lose its next write and beat; legacy string owners and nine kinds of junk owner values (NaN, null, wrong types, arrays) read as stale and never crash; a beat in the future (clock set back, tampered index) was a lock-out for as long as the offset (found and fixed within this round, now covered in node and in the browser).
- Heartbeat in a real browser: the playing tab refreshes `beat` on its own about every 5 s without any save; the second tab sees `owner: "other"`, shows the banner, Take over asks first (focus on Cancel, Tab trapped, Esc closes and returns focus), and afterwards the displaced tab's save is refused and does not touch the new owner's slot.
- Hostile import against the id regex: 12 sinks (item id, equipment id, affix id/group/kind/class, slot, unique, effect, restores, reqs key, uniquesFound) x 20 unsafe values (quotes, angle brackets, backtick, ampersand, trailing/leading newline, Arabic-Indic digit, bidi override, 33 characters, empty, null, objects, arrays): all rejected. No bypass found. Free-text fields (`name`, `baseName`, `flavour`, affix `name`) are still accepted (64/200 characters) by design.
- XSS in the browser: a sealed save with `<img src=x onerror=...>` and `"><svg onload=...>` in item name, base name, flavour and affix name on the weapon, an inventory item, a stash item and a belt potion, plus a tampered index entry (name, class and level fields): Load dialog, inventory, character sheet, every tooltip (all `[data-tip]` hovered) and the pause slot list show the text as text; no script ran, no element was injected. The one page error there is ADV-R5-14, not an injection.
- Skill-bar and skill rules in the schema: passive, unlearned, foreign-class, basic attack and non-basic primary all rejected; stale `secondary` re-derived; `__proto__`, `constructor`, `toString`, numbers, objects as bar entries rejected.
- Migration retry flag: a failed slot-1 write keeps slots 2-5 visible with `pendingMigration`, the notice `migration-failed` shows, the next boot migrates only while slot 1 is empty; a character the player started in slot 1 in between is never replaced; a hand-set flag on a played slot 1 changes nothing; deleting slot 1 does not resurrect the legacy save; an index lost entirely with a played slot 1 does not replace it.
- Replace then undo then redo (node): the replaced character returns, the replacement becomes the redo copy; in the UI the replace-undo restores the old character (this was red in the first pass of this round, green after SAVE-FIX landed).
- Esc during the elevator: nothing is created. Focus traps in the new dialogs: green (see ADV-R5-07 row).
- Every single-affix hostile save with a positive or zero value, on all 20 stats and 3 classes, loads without a throw and with finite stats.

### New findings

#### ADV-R5-12 (minor) A sealed save with a negative hpMax or stamina affix leaves the hero alive in town with negative health
- Repro (node): `toSave(newGame(...))`, `equipment.weapon.affixes = [{ stat: "hpMax", value: -100 }]` (or `stamina`), re-seal, `deserialize`: accepted; after 30 ticks `player.hp === player.hpMax === -34` (facilities manager), scene `town`. Same in the browser (Continue, HUD shows negative health). The schema only bounds `value` to +-1e6; no affix definition allows a negative value.
- Expected: reject affix values outside the definition's range (or at least below 0 for these stats), or clamp `hpMax >= 1` in `applyDerived`.
- Suspect: `src/save/format.js` `affixOk` (`num(a.value)` with the default lower bound -1e6), `src/core/items/derive.js` (no floor on hpMax).
- Tests: node `ADV-R5-12` (todo), e2e `XFAIL ADV-R5-12`.

#### ADV-R5-14 (minor) An affix without `range` is accepted but throws in the tooltip and in the price
- Repro: import a sealed save whose item has `affixes: [{ stat: "defense", value: 5 }]` (`range` is optional in the schema). Hover the item: uncaught `TypeError: Cannot read properties of undefined (reading '1')`, the tooltip does not appear. `sellValue(item)` and `buyPrice(item)` throw the same way, so selling or buying it would throw as well (vendor path not reached in my probe, the functions throw on their own).
- Expected: either `range` is required (two numbers) in `affixOk`, or `price.js` tolerates a missing range.
- Suspect: `src/core/items/price.js:11` (`a.range[1]`), `src/save/format.js` `affixOk` (`a.range !== undefined && ...`).
- Tests: node `ADV-R5-14` (todo), e2e `XFAIL ADV-R5-14` (page error seen in Chromium).

#### ADV-R5-13 (minor, fixed during this round) A beat in the future locked other tabs out
- Found with an owner beat three days ahead (clock set back or tampered index): `status.owner` stayed `other` for days. SAVE-FIX landed `Math.abs(now() - beat)` and `beat > now()` takeover while I was testing; confirmed in node and in the browser. Listed so the regression stays covered (node test is a plain test now, e2e check is a plain check).

### Observations (no id)
- A frozen background tab is displaced silently after 15 s without a beat: Chrome throttles timers in hidden tabs (to once per minute after about five minutes), so a tab the player merely left in the background can lose the lock to a newer tab, and its unsaved progress is then refused. The displaced tab does show the banner when the player returns, and the flush on `visibilitychange: hidden` writes before the throttling starts, so the loss window is only the progress made while the tab was visible but timers were frozen (rare). Worth a manual check on a real mobile browser.
- The two-store race (tab B takes over between A's slot write and A's index write, A then writes its stale index copy) cannot be reproduced reliably with synchronous localStorage; not tested.
- At 1280x720 the title card with the take-over banner and its confirmation open pushes the game title above the visible area (`adv-r5b-takeover.jpg`); the page is not blocked and the dialog is complete.

### Round 2 addendum: the flaky "second boot does not migrate again" check (root cause c: a Chromium file:// storage race, not a product defect)

Symptom: in about 1 of 3 runs the reloaded page migrated the legacy save again. Evidence (init script logging before any game code): in failing runs the reloaded document sees `Object.keys(localStorage) = []` at document start and 1.2 s later still only `["advseed","office-crawler.save"]` (what the test's own init script re-seeded), although `office-crawler.slots`, `.slot.1` and `.save` were all present in the old document right before `reload()`. The game code had not run yet when the empty storage was observed, so no pagehide/visibilitychange write (or missing write) of the game can explain it, and the quit path had written synchronously (keys present before reload). The empty read made the test's seed guard (`advseed` in localStorage) fire again, so migration ran again: a test artefact on top of a browser race.
Rates (8 parallel runs, same script and load): file:// 4 failures in 23; http://localhost 0 in 24; https origin served through `context.route` 0 in 24. A minimal page without the game on file:// did not reproduce it in 100 reloads, so it needs the large page plus write-then-reload timing; it is specific to Chromium's file:// storage across the process swap and cannot affect players on https.
Fix (harness only, assertion unchanged): `seeded()` contexts serve `dist/index.html` from `https://oc.test/` through `context.route`; the check still asserts unchanged slot text and no notice. No finding id (ADV-R5-15 unused).
