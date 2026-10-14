# R7 contract: quest journal and next steps (architect, 2026-10-14)

Scope: `docs/product/50-plan.md` "Round R7", item R7-0 (work packages R7-0.1 to R7-0.7). Inputs: `docs/product/30-spec/12-quests-journal.md` (39 ACs, QF-12-1..6), `docs/product/circles/circle-03.md` (proxy answers), `docs/product/decisions/ADR-0007-quests.md` (the decisions; this file only lists names, owners, domains and tests), the ADR-0006 amendment "R7 quests" (save v4). Playbook rules applied: contract feasibility by the owning package (L-026), consumer tables for every shared name (L-026, L-039), fixtures that are built by hand must be legal (L-038), every e2e script has an owner (L-022), input map for new keys (L-025), no golden change except the one named here.

Customer-owned open points (L-05), not decided here: number of side quests, working titles and step lines, gear versus gold-only rewards (spec QF-12-6). Everything below works with either answer.

## 1. Packages, files, order

| Package | Work packages | May edit | Must not edit |
|---|---|---|---|
| **CORE-R7Q** | R7-0.1, 0.2, 0.3, 0.4 | `src/core/**` (new: `content/quests.js`, `systems/quests.js`, `systems/questview.js`; edited: `events.js`, `state.js`, `config.js`, `hash.js`, `index.js`, `cheats.js`, `systems/world.js` (one call), `systems/loot.js` (`takeGround`), `systems/intent.js` (command hook)), `src/save/**`, `bot/**`, `src/audio/cues.js` (**only** the quest rows of section 4.3, because `test/audio.test.js` fails on any unmapped core event), `test/` except `test/ui-*`, `test/render-*`, `test/adv-*`, `test/fixtures/**`, ADR amendments (only to record a deviation, with the reason) | `src/ui`, `src/render`, `src/input`, `src/game.js`, `src/main.js`, `src/testhook`, `e2e/**`, `src/core/gen/**` |
| **UI-R7Q** | R7-0.5, 0.6 | `src/ui/**`, `src/input/**`, `src/game.js`, `src/main.js`, `src/testhook/**`, `src/style.css`, `src/index.html`, `test/ui-*`, `e2e/**` except `e2e/adv-*.mjs` and `e2e/run-all.mjs` (one added line for the new script is allowed), `src/audio/cues.js` gain and delay values of the quest rows (not the table keys) | core, save, render, bot |
| **WORLD-R7Q** | R7-0.7 | `src/render/**`, `test/render-*`, `docs/shots/r7q-*`, `bench/**` only to add a check | core, ui, save, e2e |

Two exceptions to the `test/adv-*` and `e2e/adv-*` rule, both one line, both named so nobody guesses: `test/adv-r6-fix.test.js:191` (`assert.equal(JSON.parse(t).version, 3)` becomes `config.saveVersion`) is edited by CORE-R7Q; `e2e/adv-r6.mjs:686` (`saved.version === 3` becomes `=== config.saveVersion`, `config` is already imported there or is read from `__app.getState().config.saveVersion`) is edited by UI-R7Q. Nothing else in an `adv-*` file may change.

**Order.** CORE-R7Q first: R7-0.1, then R7-0.2 and R7-0.3 (parallel-ok: disjoint files, both need 0.1), then R7-0.4 (needs 0.2). UI-R7Q (0.5 then 0.6) and WORLD-R7Q (0.7) start after R7-0.1..0.3 have handed back (state, events, snapshot names, save and cheats exist) and run **in parallel** (disjoint directories). R7-0.4 (bot) may run beside them (it touches `bot/**` only).

**Running now, and what starts when.** AI-R7 (`src/core` AI and pathing) and STUTTER-R7 (`src/render`) are running. CORE-R7Q starts **after AI-R7 hands back**; WORLD-R7Q **after STUTTER-R7 hands back**; UI-R7Q after CORE-R7Q's first three packages and, if STUTTER-R7 turns out to edit `src/game.js`, `src/main.js` or `src/ui/screens.js` (its plan says the stutter is hidden behind the elevator transition), also after STUTTER-R7.

### Files that would overlap with the running packages

| File | Running package (what it does there) | Quest package | Consequence |
|---|---|---|---|
| `src/core/systems/intent.js` | AI-R7: `playerIntent` retarget (`standT`, `retargetTicks`, `holdMaxTicks`) | CORE-R7Q: one `default:` hook in `itemCommand`, `storyRead` whitelist next to `setName` in `applyInput` | different functions; CORE-R7Q edits the post-AI-R7 file |
| `src/core/state.js` | AI-R7: new player/monster fields (`standT`) | CORE-R7Q: `quests`, `player.pouch`, `makeMonster` options | rebase on AI-R7's version; golden baseline is AI-R7's |
| `src/core/config.js` | AI-R7: `retargetTicks`, `holdMaxTicks` | CORE-R7Q: `saveVersion`, `quests` | textual merge only |
| `bot/policy.js` | AI-R7: watchdog does not count a Lobby trip as a stall (R7-3) | CORE-R7Q (0.4): two call sites into `bot/quests.js` (Lobby, cleared floor) | quest code lives in a new file; the call sites go in after AI-R7's watchdog change, and the Lobby trip of the bot **depends on that watchdog fix** |
| `test/fixtures/run-a.hash`, `run-class.json` | AI-R7: re-recorded (new `standT`) | CORE-R7Q (0.1): copies as `*.pre-quests.*`, then re-pinned once | the proof baseline is the post-AI-R7 golden; if AI-R7 re-records again after CORE-R7Q started, CORE-R7Q redoes the baseline copy and the one re-pin |
| `test/r7-ai.test.js`, `test/bot.test.js` | AI-R7 | CORE-R7Q may add quest runs to `test/bot*.test.js` | do not edit `r7-ai.test.js` |
| `src/render/world.js` | STUTTER-R7: `warmAhead` (next floor's monster frames), floor-load bench | WORLD-R7Q: NPC marker drawing (near `addNpc`), ground entries without `item` (near line 615), warm the elite type | WORLD-R7Q edits the post-STUTTER file; the elite's type must be added to the warm set (risk 4) |
| `src/render/fx.js`, `src/render/keys.js`, `bench/**` | STUTTER-R7 may touch for the same warm-up | WORLD-R7Q: loot plate for quest entries (`fx.js`), no new atlas keys (`keys.js`) | rebase; atlas budget rule below |
| `src/game.js`, `src/main.js`, `src/ui/screens.js` | STUTTER-R7: only if the transition hides the warm-up | UI-R7Q: panels, hook, dock, pause entry, story overlay | UI-R7Q waits for STUTTER-R7 in that case |
| `src/render/map.js`, `src/render/hud.js` | none expected | WORLD-R7Q: map marker; nothing in `hud.js` (the dock button is a DOM button, `src/ui/panels.js`) | none |

## 2. Shared names (single source: this table; ADR-0007 gives the meaning)

### 2.1 State and snapshot paths

| Path | Type and domain | Written by | Read by |
|---|---|---|---|
| `state.quests.main.m` | `{memo: bool, depth: int 0..9, unlocked: bool, defeated: bool, verdict: bool}`, all monotone | core (tap, `storyRead`, cheats) | core views, save |
| `state.quests.sq1`, `.sq2`, `.sq3` | `{s: "available"\|"active"\|"ready"\|"completed", p: int 0..goal}` (goal: 8 for the kill task, 1 for item and elite) | core | core views, save |
| `state.quests.pinned` | `"main"` or a side id that is not `completed` | `questPin`, hand-in | tracker, map markers, save |
| `state.player.pouch` | array of `{id: "qi-<questId>", quest: <side id>}`, at most one per item quest; present iff the quest is `ready` | `takeGround`, hand-in, load | journal, save |
| `snapshot.quests[id]` | stored fields **plus** `{id, state, step 1..6, stepCount 6 (main) \| 0, progress int, goal int, nextStep string ("" when completed), title string, giver string\|null}`; `state` here is `available\|active\|ready\|completed` (for `main`: `active\|completed`) | `snapshot()` (derived) | tests, hook, UI |
| `snapshot.quests.pinned` | the stored string | | |
| `snapshot.npcs[]` | `{id, tile, marker: "none"\|"available"\|"handin"}` for the Lobby NPCs (`[]` on floors) | `snapshot()` via `npcMarker` | tests |
| `snapshot.map.markers[]` | `{quest, kind: "stairs-down"\|"stairs-up"\|"npc"\|"elevator", tile, label}`; only the pinned quest's target, only when known; `[]` otherwise | `snapshot()` via `mapMarkers` | tests, map renderer |
| `state.groundItems[]` quest entry | `{id: "qi-sq2", quest: "sq2", label, rarity: "normal", mark: "!", border: "none", color, keep: true, tile}`, **no `item`, no `gold`** | `placeQuestObjects` | loot.js, render, game.js hover, bot |
| monster `quest` field | `"sq3"` on the named elite (tier `champion`, empty `mods`, own `name`); not saved | `makeMonster` option | `kill` handler |
| `game.ui.left === "journal"`; `snapshot.ui.panels.journal` | boolean | shell (UI-R7Q) | tests |
| `snapshot.ui.tracker` | `{id, title, text}` or `null` (null only when no quest is active); `text` equals `quests[id].nextStep` | shell | tests |
| `snapshot.ui.toast` | existing string field; for quest events it holds `"<title>: <next step>"` for at least `config.quests.toastMs` | shell | tests |
| `snapshot.ui.badge.journal` | boolean; set by any `quest.accepted`/`quest.step`/`quest.completed`, cleared when the journal opens | shell | tests |
| `game.slots.list[i]` / index entry | `mainStep` int 1..6, `mainDone` bool, `sidesDone` int 0..`sideCount`; absent on `empty`, `bad`, `newer` | `save/slots.js` | `ui/slots.js` |

### 2.2 Core API (exports of `src/core/index.js`) and input commands

Functions: `content.quests`, `content.questIds`, `questView(state)`, `nextStep(state, id)`, `npcMarker(state, npcId)`, `mapMarkers(state)`, `placeQuestObjects(state)`, `questSpot(floor, rng, avoid)`, `questRng(seed, salt, purpose, depth)`, `hashStateWithout(state, opts)`, cheats `setQuestStep(state, id, n)` and `completeQuest(state, id)` (returns `{ok}` or the refusal, for example `bagFull`).
Input commands (through `applyInput`, recordable): `{t: "questAccept", id}`, `{t: "questHandIn", id}`, `{t: "questPin", id}`, `{t: "storyRead", id: "start"\|"victory"}`. No `questAbandon`, no `questTalk` (talking is `interact`). Results: `{ok: true}` or `{ok: false, error}` with `error` in `no dialog`, `wrong npc`, `unknown quest`, `not available`, `not ready`, `already done`, `bagFull`, `not defeated`, `bad id`.

### 2.3 Events (core `emit`, plain data; all names start with `quest.` and are ignored by the tap)

| Event | Payload | Emitted when | Audio | Toast, badge |
|---|---|---|---|---|
| `quest.accepted` | `{id, title, next}` | accept succeeded | cue | toast + badge |
| `quest.step` | `{id, step?, title, next}` | main step advanced (once per event, catch-up gives one); side quest became `ready` | cue | toast + badge |
| `quest.completed` | `{id, title, rewards: {gold, xp, items: [name]}}` | main step 6 done, or hand-in succeeded | cue | toast + badge |
| `quest.item` | `{id, quest, name}` | quest item entered the pouch | cue | none (the `quest.step` that follows toasts) |
| `quest.progress` | `{id, p, goal}` | a kill advanced a kill objective but did not finish it | silent | none (tracker/journal update) |
| `quest.pinned` | `{id}` | pin changed (also automatic revert) | silent | none |
| `quest.handInRefused` | `{id, reason}` (`bagFull`) | hand-in refused | reject cue | notice text `bagFullNotice`, shown by the UI |

No cue event for a declined offer, a repeated hand-in, a re-pin of the same quest or a catch-up that ends on the same step (AC-R-254-1). New event input `storyRead` emits no event of its own (its effect is the `quest.step` it causes).

### 2.4 `config.quests` (core, defaults; tests assert relations to these names)

`sideCount 3`, `kill {monster "zombie-intern", count 8, depths [1, 2]}`, `item {floors [3, 4], pickupRange 1}`, `elite {type "middle-manager", depth 4, hpMult 1.6, level 4}`, `gearFloor 4`, `sq1 {refDepth 2, gold {base 30, perDepth 15}, xp {base 40, perDepth 25}, potions 3}`, `sq2 {refDepth 4, gold {...}, xp {...}, slots ["body","head","hands","feet"]}`, `sq3 {refDepth 4, gold, xp, slots ["weapon"], potions 2}`, `rewardRerolls 8`, `genBudgetFactor 1.05`, `toastMs 4000`. `saveVersion` becomes 4.

### 2.5 Text keys

- **Quest content text** lives only in `src/core/content/quests.js` (titles, step titles and lines, `text.offer/progress/ready/done`, `next.*`, item name and description, elite name, reward names). CORE-R7Q writes it in the style of the proxy's working lines (circle-03 Q2: six step lines are given), keeps every string original and runs the scan test (AC-R-255-1). `{giver}` is the only placeholder in `next.*`.
- **UI text keys in `src/ui/text.js` (`T`)**, owned by UI-R7Q, referenced by tests by name: `journalTitle`, `openJournal`, `journalClose`, `journalActive`, `journalCompleted`, `journalEmpty`, `journalPouch`, `journalPouchEmpty`, `nextStepLabel`, `giverLabel`, `progressLabel` (`{n}/{goal}`), `pinAction`, `unpinAction`, `pinnedMark`, `stateAvailable`, `stateActive`, `stateReady`, `stateCompleted`, `mainQuestLabel`, `sideQuestLabel`, `questAccept`, `questDecline`, `questHandIn`, `rewardLabel`, `rewardGold`, `rewardXp`, `rewardGear` (`{kind}`, `{rarity}`), `rewardPotions`, `bagFullNotice`, `readVerdict`, `trackerLabel`, `mapMarkerStairsDown`, `mapMarkerStairsUp`, `mapMarkerNpc`, `mapMarkerElevator`, `slotQuestLine` (`{step} · {n}/{m}`), `toastQuest` (`{title}: {next}`), `keyJournal`, `pauseJournal`. No new `S.*` (string table) key is needed; if UI-R7Q adds one, `test/strings-used.test.js` requires it in `content/strings.js` (CORE-R7Q's file): put it in `T` instead.
- **Accessible names:** every quest state is exposed as text in the accessible name (`stateAvailable` and so on), never colour alone (NFR-A03, NFR-A07).

### 2.6 Key table (L-025)

| Item | Value | Owner |
|---|---|---|
| default key | `KeyJ` (`DEFAULT_KEYS.journal`; `ACTIONS` gains `journal`), remappable, listed in Options with the other panel keys, conflict rule unchanged (`bindKey`) | UI-R7Q (`src/input/keymap.js`) |
| panel key map | `PANEL_KEYS.KeyJ = "journal"` (`src/input/keys.js`), `isLeft("journal")`, `panels().journal` in `game.js` | UI-R7Q |
| Escape | closes the journal only when it is the top panel (existing rule for left drawers) | UI-R7Q |
| `J` is free today | confirmed: not in `DEFAULT_KEYS`, `PANEL_KEYS`, `RESERVED` | checked by architect |

### 2.7 Test hook (ADR-0003; only with `?test=1`, absent otherwise)

`__app.quests = {state(), talk(npcId), accept(id), handIn(id), pin(id), setStep(id, n), readVerdict()}` and `__app.cheat.completeQuest(id)`. `state()` is `snapshot.quests`; `talk` forwards to `interact`; `accept/handIn/pin` forward the input commands; `setStep(main, n)` n = 1..6 (forward only; the result is the same state, events and cue as the event path), `setStep(side, n)` n = 0 available, 1 active, 2 ready (item into the pouch for `sq2`), 3 completed (reward through the hand-in path; `bagFull` is returned, not hidden); `readVerdict` sends `storyRead victory`. `describe()` gains the member `quests` (`e2e/hook.mjs` expected list: UI-R7Q).

## 3. Value domains and feasibility notes (each owner confirms by test before relying on it)

| Item | Domain | Feasibility note | Owner |
|---|---|---|---|
| main step | derived 1..6, `completed` after 6 | milestones monotone; `newGame` starts with `m.depth = 0` also on floor-1 fixtures | CORE |
| step 1 | memo read or first `floorEnter` with depth >= 1 | memo is a shell overlay: `dismissStory` sends `storyRead start`; `?test=1` has no story, descent completes it | CORE (command), UI (send) |
| step 6 | `keepPlaying` event or `storyRead victory` | the journal action "Read the verdict" appears on step 6 when `scene !== "victory"`; refused unless `m.defeated` | CORE (command), UI (action) |
| kill count | integer 0..8 | `kill` event: the monster is in `state.monsters` until `deathT`; `summoned` kills do not count | CORE |
| item floor | 3 or 4, from `questRng(seed, 2, 1, 0)` | stateless draw: same on every visit and reload | CORE |
| item and elite tile | walkable, not a spawn start, not entry or exit, > `safeRadius` from entry, in a room that is neither the entry nor the exit room (fallback scan) | `validateFloor` guarantees every walkable tile is reachable; test over 100 seeds incl. `fallbackFloor` | CORE |
| elite hp | at least `hpMult x monsterStats(type, 4).hp` | champion tier x1.5 and `hpMult` 1.6; balance gate may tune `hpMult`, the AC asserts the relation | CORE |
| reward gear | rarity `magic` or `rare` (never `unique`), `ilvl = gearFloor x ilvlPerDepth` (12), slot per quest | `rollItem` options `ilvl, minRarity, maxRarity, slot, affixTag`; reroll up to 8 times for `checkReqs` | CORE |
| hand-in with a full bag | `{ok: false, error: "bagFull"}`, state byte-identical to before the call, quest stays `ready` | dry run on `structuredClone(inventory)` with the real `autoplace` order (gear first, then potions); also test with a bag full of 2x3 and 1x1 items where only a 1x1 hole is left | CORE |
| pouch | 0 or 1 entries per item quest | no bag, stash, belt, cursor or equipment code touches it (`sell`, `dropCommand`, `moveStash` find only bag items) | CORE |
| tracker text | one line, equals `quests[pinned].nextStep`, full text in `title`/accessible name when truncated | DOM element (UI), never canvas, so it stays accessible and testable | UI |
| map marker | only pinned quest, only known targets, text label | `exploredAt(state, x, y)` is the "known" test; Lobby counts as explored | CORE (data), WORLD (draw), UI (text label key) |
| NPC marker | `none`, `available`, `handin`; two shapes (exclamation sign for `available`, question mark for `handin`) not colour-only | `npcMarker` allocates nothing (returns constants), safe to call per frame | CORE (value), WORLD (shape) |
| slot card | step title + `N/3` | title looked up from content by `mainStep`; index fields from ADR-0006 amendment point 6 | CORE (data), UI (text) |
| save block | under 400 characters, 0 forged states accepted | invariants in the ADR-0006 amendment point 3 | CORE |
| v3 fixtures | five legal v3 saves built from real `toSave` output, never typed by hand | helper in `test/helpers.js`: delete `quests`, `version: 3`, `checksumOf`; "deepestDepth 0" of the spec = `deepestDepth 1` with no `explored[1]`, `resume.depth 0`, `stats.kills 0` (the v3 schema forbids 0) | CORE |
| reduced motion | toast without animation, badge and NPC markers static | shell reads `options.reducedMotion` or `prefers-reduced-motion`; markers are static shapes with at most a slow bob that is switched off | UI (toast, badge), WORLD (markers) |

## 4. Consumer tables (L-026, L-039): every place that must learn each new name

### 4.1 New core events (`quest.*`)
| Consumer | Change | Owner |
|---|---|---|
| `src/audio/cues.js` `EVENT_MAP` / `SILENT_EVENTS` | rows of 4.3; `test/audio.test.js` ("every event type the core emits has a cue or a documented reason") fails until they exist | CORE-R7Q (rows), UI-R7Q (gains) |
| `src/ui/messages.js` `messageFor` | `quest.accepted`, `quest.step`, `quest.completed` give the toast line (`toastQuest`); `quest.handInRefused` gives `bagFullNotice`; others `null` | UI-R7Q |
| `src/game.js` bus listener | sets `ui.badge.journal` on the three cue events, clears it when the journal opens; tracker refresh on any `quest.*` | UI-R7Q |
| `src/render/fx.js` `handle` | must ignore unknown `quest.*` types without throwing (checked by `test/render-r7q.test.js`) | WORLD-R7Q |
| `bot/report.js`, `bot/policy.js` | count `quest.completed` per run for AC-R-256-2; ignore the rest | CORE-R7Q (0.4) |

### 4.2 `state.quests`, `player.pouch`, snapshot additions
| Consumer | Change | Owner |
|---|---|---|
| `hashState` | hashed (decision 11); `hashStateWithout` for the proof | CORE |
| `game.getState()` (`src/game.js`) | `base.hash` already hashes `{...core, options: {}}` (includes quests, as intended); `base.ui` gains `tracker`, `badge` | UI |
| `save/format.js` (`SAVE_KEYS`, `schemaProblem`, `toSave`, `loadSave`), `save/migrate.js`, `save/slots.js` (`entryFromState`, `entryFromText`, `upgradeIndex` inside `migrateLegacy`), `save/session.js` (`slotsView.list`) | v4 | CORE |
| `restartInPlace` (death "restart" input) | builds a fresh `newGame`: quests reset with it (a fresh run); no code change, noted so nobody expects otherwise | CORE |
| every test that builds states by hand (`gameOn`, `floorFromRows`) | get `quests` from `newGame`; helpers do not need changes; tests that deep-compare whole states against literals must be updated by their owner | CORE (unit), UI (e2e) |

### 4.3 Audio table (rows added to `src/audio/cues.js`; names are what the audio test model logs)
| Event | Descriptors (existing kit cues only, no new sound files, procedural kit unchanged) |
|---|---|
| `quest.accepted` | `d("uiOpen", "questAccepted", {gain: 0.9})`, `d("ding", "questAccepted", {gain: 0.7, delay: 0.12})` |
| `quest.step` | `d("ding", "questStep", {prio: 6})` |
| `quest.completed` | `d("pickupRare", "questCompleted", {prio: 7})`, `d("ding", "questCompleted", {gain: 0.8, delay: 0.25})` |
| `quest.item` | `d("pickupItem", "questItem")` |
| `quest.handInRefused` | `reject()` (existing helper) |
| `quest.progress` | silent: "each kill already has its death cue; progress is shown in the tracker and the journal" |
| `quest.pinned` | silent: "the pin button already plays the UI click" |
`SFX_IDS` is unchanged. Mute and volume 0 silence the chime through the existing engine (AC-R-254-2); toast and badge do not depend on audio.

### 4.4 Ground entries without `item` (readers to check)
`src/core/systems/loot.js` (`takeGround` quest branch, `evictOne` reads `e.item?.rarity`, safe), `src/core/systems/intent.js` (`issuePickup` uses `entry.tile`, `entry.id`), `src/render/fx.js` (`lootSync`, `lootRing`, plates: read `rarity`, `label`, `mark`, `border`, `color`, `gold`), `src/render/world.js` (ground sprite: `gi.gold ? gold : keys.loot("item")`), `src/game.js` line ~237 (hover by tile, uses `id` only), `bot/policy.js` `nextLoot` (tile and id only), `src/ui/panels.js` (no ground tooltips today; if one is added it must guard `entry.item`). WORLD-R7Q and UI-R7Q confirm by a test that draws a quest entry; CORE-R7Q confirms the core readers.

### 4.5 Slot index fields and `game.slots`
`src/save/slots.js` writes, `src/ui/slots.js` (the card), `src/ui/charselect.js` (reads `index.slots[n].state` and `.name` only: no change expected), `src/testhook/index.js` (`slots.view`), `e2e/s3ui.mjs`, `e2e/r5ui.mjs` (card assertions: UI-R7Q checks they still pass).

### 4.6 Key and panel tables
`src/input/keymap.js` (`DEFAULT_KEYS`, `ACTIONS`), `src/input/keys.js` (`PANEL_KEYS`, `panelFor`), `src/game.js` (`isOpen`, `isLeft`, `panels()`, `openPanel`, `closePanel`, `togglePanel`), `src/ui/options.js` (the key list renders from `ACTIONS`), `src/ui/panels.js` (dock button `dock-journal`, drawer), `src/ui/screens.js` (pause entry), `test/ui-keymap.test.js`, `test/ui-options.test.js`, `e2e/s3ui.mjs` (key list). Owner UI-R7Q for all.

### 4.7 Hook and describe list
`src/testhook/index.js` (member `quests`, docs line), `e2e/hook.mjs` (expected list), ADR-0003 text is not edited (this contract is the record). Owner UI-R7Q.

## 5. Tests affected and owners (L-022, L-038)

**Unit (`npm test`), owner CORE-R7Q unless stated**

| Test | Effect | Action |
|---|---|---|
| `test/determinism.test.js`, `test/class-determinism.test.js` | golden hashes change (state gains `quests`, `player.pouch`) | re-pin **once** in R7-0.1 after the proof test passes; baseline files `test/fixtures/run-a.pre-quests.hash`, `run-class.pre-quests.json` |
| `test/hash.test.js` | new helper | add `hashStateWithout` cases |
| `test/audio.test.js`, `test/ui-audiowire.test.js` | red until 4.3 rows exist | rows ship in R7-0.1, the package that first emits a `quest.*` event (a red test at hand-back is not allowed) |
| `test/save.test.js`, `test/save-fix.test.js`, `test/save-slots.test.js`, `test/save-migrate-v2.test.js`, `test/s3-final.test.js`, `test/adv-r5-save.test.js`, `test/adv-r5b-save.test.js` | `SAVE_KEYS` gains `quests`; version-relative asserts (`config.saveVersion + 1`) stay valid | run; fix expectations that list the keys (`save.test.js` AC-R-090-2) |
| `test/save-v3.test.js` lines 38, 43, 55 | `r.save.version === 3` is now 4 | CORE-R7Q: expect `config.saveVersion`; keep the v2 to v3 refund asserts |
| `test/adv-r6-fix.test.js` line 191 | `version, 3` | the one-line exception of section 1 |
| `test/bot.test.js`, `test/bot-class.test.js`, `test/balance-gate.test.js`, `bot/parity.mjs` | bot now accepts quests and climbs to the Lobby once: time to boss, win rate | R7-0.4 re-runs the gate; any threshold change is reported, not silently edited |
| `test/town.test.js`, `test/inventory.test.js`, `test/s2-fix.test.js` (dialog, vendor, bag) | unchanged behaviour with quests open (AC-R-245-1 spot check) | add the spot checks in `test/quests-npc.test.js` |
| `test/strings-used.test.js`, `test/ip-denylist.test.js`, `test/legal.test.js` | must still pass; denylist scan already covers `src/core/content/quests.js` | no edit |
| `test/layering.test.js` | cycle `events.js <-> systems/quests.js` is core-internal, allowed | run |
| **New:** `quests-model`, `quests-machine`, `quests-gen`, `quests-rewards`, `quests-npc`, `quests-hash` (proof), `quests-bot`, `save-v4`, `save-v4-migrate` (`test/*.test.js`) | AC-R-240-1/2, 241-1/2, 242-1, 245-1, 246-1/2/4/5, 247-1/2/3, 250-1, 251-1/2, 254-1, 255-1, 256-2/3 | CORE-R7Q |
| `test/ui-quests.test.js` (new), `test/ui-keymap.test.js`, `test/ui-options.test.js`, `test/ui-layout.test.js`, `test/ui-r6.test.js` | key table, text keys, toast mapping, tracker/journal view models, slot card line, dock layout at 390x844 | UI-R7Q |
| `test/render-r7q.test.js` (new), `test/render-*.test.js` | marker shape set, `npcMarker` to shape, no new atlas keys, quest ground entry draws, `fx.handle` ignores `quest.*` | WORLD-R7Q |

**E2E (`npm run e2e`), owner UI-R7Q unless stated (`e2e/run-all.mjs`: orchestrator, one added line)**

| Script | Effect | Action |
|---|---|---|
| `e2e/hook.mjs` | `describe()` expected list gains `quests` | UI-R7Q |
| `e2e/replay.mjs` | golden changes (same file the unit test uses; the browser hash covers the same state) | none beyond CORE-R7Q's re-pin; UI-R7Q runs it |
| `e2e/s3ui.mjs`, `e2e/r5ui.mjs`, `e2e/ui.mjs` | slot card text, key list with the journal key, dock with a fifth button, pause menu with an extra entry | UI-R7Q fixes expectations |
| `e2e/adv-r6.mjs` line 686 | `saved.version === 3` becomes 4 | the one-line exception of section 1 (UI-R7Q) |
| `e2e/adv-r5.mjs`, other `adv-*` | not edited; if red, UI-R7Q lists them in the hand-back for the orchestrator | |
| `e2e/smoke.mjs`, `combat.mjs`, `input.mjs`, `render.mjs`, `realtime.mjs`, `audio.mjs`, `polish.mjs` | dock layout, pause menu and toast lane at 1280x720 and 390x844 could move pixel expectations | UI-R7Q runs all; WORLD-R7Q runs `render.mjs` |
| **New:** `e2e/r7quest.mjs` | AC-R-243-1/2/3, 244-1/2, 247-4, 248-1/2/3, 249-1/2, 251-3, 252-1, 253-1/2, 254-2/3, 256-1; real-time, over http (L-027), phone and desktop viewports; fixtures: `save-v3-floor4.json` in slot 2 (legal, built by the CORE helper) | UI-R7Q (WORLD-R7Q supplies the 249-1 shape assertions through `perf().npcMarkers`) |

## 6. Per-package task lists and gates

**CORE-R7Q** (feasibility first: confirm by a throwaway test that `emit` is the only writer of `state.events`, that `teleportFloor` while paused reaches the tap, that `spawnMonster` forwards options, that `autoplace` on a cloned grid is side-effect free).
- R7-0.1 (about 550 lines): `content/quests.js` (data, the six steps, three side quests, text), `config.quests`, `systems/quests.js` (reducer, tap, `questAccept`, `questPin`, `storyRead`, `nextStep` hooks), `systems/questview.js`, `events.js` tap, `state.js` (`quests`, `pouch`), `intent.js` hook, `index.js` exports and snapshot, `hash.js` helper, audio rows, proof test, **the one golden re-pin** with `docs/reviews/R7-core-q-notes.md` (old and new hashes, reason).
- R7-0.2 (about 450): `questRng`, `questSpot`, `placeQuestObjects`, `enterFloor` call, `makeMonster` options, `takeGround` branch, `questHandIn` (atomic), reward gear, potions, pouch invariants, `quest.item`/`quest.handInRefused`.
- R7-0.3 (about 480): save v4 (keys, schema, `toSave`, `loadSave` order), `MIGRATIONS[3]`, slot index fields and `upgradeIndex` inside `migrateLegacy`, `cheats.js` (`setQuestStep`, `completeQuest`), fixtures helper and the five v3 fixtures.
- R7-0.4 (about 300): `bot/quests.js` and the call sites, `quests-bot` test, parity and balance runs.
- Hand-back: the list of red tests it did not own (section 5), the new snapshot paths exactly as built, any deviation from this contract with the reason.

**UI-R7Q**: R7-0.5 (about 550): `KeyJ`, keymap and options key list, `game.js` panel plumbing (`left: "journal"`, `panels().journal`, badge), `ui/journal.js` (list, next step, progress, pouch, pin, "Read the verdict"), dock button `dock-journal` with badge, pause-menu entry, tracker DOM line, hook members, `dismissStory` sending `storyRead start`, story overlay `victory`. R7-0.6 (about 450): NPC dialogue quest section (offer with reward text, Accept and Decline, progress line, Hand in, bag-full notice), toasts through `messageFor` for `quest.*`, slot card line, reduced motion, accessible names, `e2e/r7quest.mjs` and the expectation fixes of section 5. Phone: full-screen journal with a visible close control; touch targets as large as the other HUD buttons.

**WORLD-R7Q** (R7-0.7, about 350): NPC marker shapes (exclamation for `available`, question mark for `handin`) drawn **procedurally on the existing canvas** above the NPC (no new atlas sprites: the atlas build is at about 4.3 to 4.8 s of the 5 s budget, ADR-0004), exposed as `perf().npcMarkers = [{id, shape}]`; the map marker from `mapMarkers` on the minimap and the full map (text label next to the glyph); the quest ground entry (mark `!`, distinct colour from the Okabe-Ito set, plate text = label) and a check that the champion elite reads as a named monster (nameplate shows `name`, empty modifier line); warm the elite's monster type when `quests.sq3.s === "active"` (see risk 4); markers static under reduced motion.

**Gates for every package:** `npm test` green at hand-back (a red test it does not own is listed with its owner, not edited); CORE-R7Q also `npm run bot` smoke; UI-R7Q and WORLD-R7Q `npm run e2e`; WORLD-R7Q keeps fps50 and floor-load p99 of STUTTER-R7 (no per-frame allocation in marker drawing); the orchestrator does the quiet-machine bench (L-020) after WORLD-R7Q and UI-R7Q.

## 7. Risks

1. **Golden proof (high value, medium risk).** The proof needs the quest events filtered out of `eventLog`; if AI-R7 re-records its goldens after R7-0.1 started, the baseline copy and the single re-pin must be redone.
2. **Elite balance.** A champion `middle-manager` with 1.6x hp on floor 4 must be beatable by all three bot classes; the balance gate decides the final `hpMult` (the AC asserts the relation to the constant).
3. **Bot time.** The one climb from floor 4 to the Lobby adds about 3 to 5 minutes; AC-R-256-2 keeps the 20 to 40 minute window; depends on AI-R7's watchdog change (a Lobby trip must not count as a stall).
4. **First draw of the elite's sprite frames.** `middle-manager` may not be among floor 4's spawn types, so its frames would be drawn cold the first time (a stutter, which STUTTER-R7 is removing). WORLD-R7Q adds the type to the warm set when `sq3` is active.
5. **Ground entry without `item`.** Seven readers (4.4); a missed reader throws on the first quest pickup. Covered by tests in CORE, WORLD and UI.
6. **Index upgrade.** `upgradeIndex` rebuilds the index once; the existing `rebuild(prev)` keeps `active`, `last`, `owner`; a failure falls back to the old index (entries without quest fields show no quest text).
7. **Deep migrated characters** get level-4 reward gear and must walk up from floor 8 to reach floors 3 and 4 (ADR-0007 section 9); a fast-travel option is a LATER item for the customer.
8. **Text is working text** (R-255); the customer may rename everything; only `content/quests.js` and the `T` keys change.
