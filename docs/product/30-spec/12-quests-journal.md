# 12 Quest journal, main quest and side quests

Areas: N (R-240..R-256), NFR-A03, NFR-A04, NFR-A05, NFR-A07, NFR-D06 (as they touch quests). Date: 2026-10-14. Author: spec-writer. Status: draft for the architect. Inputs: `../20-requirements.md` area N, `../circles/circle-03.md` (PROXY answers, provisional; brand text escalated), `../00-brief.md` (sixth briefing, real customer: "a place to look at the quest and the next step to solve for them"), `11-classes-trees-slots.md` (slots, migration pattern), `10-tech-and-testability.md` (`window.__app`, snapshot, `config.*`). Round: R7-0.

## Conventions in this file

- One round, tag `R7`. Level: `Unit` (Node, pure functions, seeded RNG, `content.*`, `config.*`) or `E2E` (Playwright via `window.__app`, `?test=1`). Anything judged by eye is marked `verify: playtest/visual review` and has no numeric split (L-03).
- Names are a proposal for the architect: the Unit surface adds `content.quests`, `quests.talk/accept/handIn/pin`, `migrate` (v3 to v4); the snapshot adds `quests` (per quest: `id`, `state` = `unavailable|available|active|ready|completed`, `step`, `progress`, `nextStep`), `quests.pinned`, `player.pouch`, `ui.panels.journal`, `ui.tracker`, `ui.toast`, `ui.badge.journal`, `npcs[].marker` (`none|available|handin`), `map.markers[]`. `ready` is "objectives done, hand-in pending" and is part of `active` for the requirement's four states. Numbers the requirements do not fix are `config.quests.*` constants; the AC asserts a relation.
- Working ids: main quest `main`; side quests `sq1` (vendor, kill), `sq2` (healer, find item), `sq3` (potion seller, named elite). All titles and text are WORKING NAMES (see Brand text below). ACs read `content.quests` rather than literal text, except where the proxy's working next-step lines are the content under test.
- Ranking: the ACs inside each area run most important first. Overall order of importance: save v4 and migration (data loss), the state machine and next-step text (the customer's literal ask), the journal and tracker, rewards, then cues.

## Scope note: drop order if R7 is tight (circle-03 Q1, Q4, Q7)

1. Side quest 1 (`sq1`, the kill task: cheapest to lose, no pacing role). ACs `R-246-1`, the `sq1` half of `R-247-1` and the `sq1` rows of `R-245-1`, `R-256-2` go with it; `config.quests.sideCount` becomes 2 and the slot card shows "N/2".
2. The map marker (`R-248-3`). The tracker and journal already answer the ask.
3. The NPC overhead markers (`R-249-1`). Toast, chime and badge stay (`R-254-*`).

Never dropped: journal, the six main steps, the two gear quests (`sq2`, `sq3`).

## Brand text: working names (ESCALATED)

Quest titles, step titles, next-step lines, dialogue and reward names are working names written by the proxy and are escalated to the real customer for confirmation (R-255, as R-233 for class names). Working titles: main "Why the Lights Went Out"; `sq1` "Intern Overflow"; `sq2` "The Missing Badge"; `sq3` "Toner Tyrant". The ACs test structure and originality, not wording, except `AC-R-241-1`, which pins the working next-step lines of the six main steps so they are visible in one place; a customer rename only changes the content file and that one table.

## Quest state machine, events, determinism (R7-0 CORE)

### R-240 Quest model and states (must)

- **AC-R-240-1** `R7` `Unit` — Given `newGame(seed, {class:id})`, When `snapshot.quests` is read, Then `main` is `active` at step 1, `sq1..sq3` are `available`, none is `completed`, and calling `step` for 600 idle ticks (no kill, pickup, floor change or NPC talk) leaves `quests` deep-equal to the start. Quests change only through the events named in this file (floor entered, boss unlocked, boss defeated, monster killed, quest item picked up, NPC talk/accept/hand-in, victory read); each transition is a pure function `(questState, event) -> questState`.
- **AC-R-240-2** `R7` `Unit` — Given the same seed, class and recorded input list including quest actions, When run twice, Then the final state hashes are equal (R-120, NFR-Q01). Quest placement (item, elite) draws from its own seeded stream: for 50 seeds the floor layouts of floors 1..8 with and without an accepted quest are identical in tiles, stairs and monster placements except for the one quest item or one elite.

### R-241 Main quest steps (must)

- **AC-R-241-1** `R7` `Unit` — Given `content.quests.main`, When its steps are listed, Then there are exactly 6, in this order with these completion events and working next-step lines: (1) completes when the start memo is read (or, if earlier, the first descent), "Take the lift down."; (2) completes on first reaching floor 1, "Reach floor 1 and look for what cut the power."; (3) completes on first reaching floor 4, "Reach floor 4. Visit the Lobby first: the staff may pay in gear."; (4) completes on boss unlocked, "Reach floor 8 and find the way up to the Executive Suite."; (5) completes on boss defeated, "Defeat the Regional Director."; (6) completes when the victory verdict is read, "Read the verdict.". Step 3's line names both the depth hint and the gear nudge. After step 6 `main` is `completed`.
- **AC-R-241-2** `R7` `Unit` — Given a run, When events arrive out of order (for example `cheat.setDepth(4)` straight from step 1) or the player later climbs back to the Lobby, Then every earlier step completes too (catch-up), a step never goes backwards, death changes no step, and the bot run of AC-R-256-2 shows steps 1..6 completing in order with no step skipped on the normal path.

## Side quests, items, elites (R7-0 CORE then WORLD)

### R-245 / R-246 Side quests, objectives, quest item, elite (R-245 should; R-246 should; R-250 must)

- **AC-R-245-1** `R7` `Unit` — Given `content.quests`, When the side quests are listed, Then there are exactly `config.quests.sideCount` (default 3): `sq1` given by the vendor, `sq2` by the healer, `sq3` by the potion seller, none by the stash keeper, and no new NPC exists. Talking to the giver offers the quest; Decline leaves it `available` with no state change; Accept makes it `active`; a hand-in to a different NPC is refused; vendor trading, healing and stash functions give identical results with a quest open (spot check per NPC).
- **AC-R-246-1** `R7` `Unit` — Given `sq1` active and `config.quests.kill.count` N (default about 8) and a basic monster kind K, When K is killed on floors 1-2, Then progress rises by 1 per kill and becomes `ready` at N; kills before Accept do not count; kills of K on other floors do not count; with two fixture quests that both ask for kills of K, one kill advances both.
- **AC-R-246-2** `R7` `Unit` — Given `sq2` accepted, When floors 3 and 4 are generated for 100 seeds, Then exactly one quest item exists in total per accepted quest, on floor 3 or 4 by the quest stream, in a room reachable from the stairs under the layout validity rules of R-042 (every seed passes), and the item is not in the normal loot tables, cannot be sold, dropped or stashed, and is absent when `sq2` is not active.
- **AC-R-246-3** `R7` `E2E` — Given `sq2` active and the bag full (every bag slot filled), When the player walks over the quest item, Then it enters `player.pouch` (visible in the journal and listed as a quest item), the bag is unchanged, `sq2` becomes `ready`, and after death and reload (or a floor change) the item is still in the pouch.
- **AC-R-246-4** `R7` `Unit` — Given `sq3` accepted, When floor 4 is generated for 100 seeds, Then exactly one named elite exists on it (hp at least `config.quests.elite.hpMult` times a normal floor-4 monster's, name from content), placed in a valid room (R-042 passes), and no elite exists when `sq3` is not active or already `ready`/`completed`.
- **AC-R-246-5** `R7` `Unit` — Given `sq3` active and the elite alive, When the elite is killed, Then `sq3` becomes `ready` and the elite is not generated again; if the player leaves floor 4 or dies before the kill, the next generation of floor 4 contains exactly one elite again (never zero while the objective is open, never two).
- **AC-R-250-1** `R7` `Unit` — Given 200 seeds with all three side quests accepted, When floors 1..8 are generated, Then every floor passes validity (R-042), no quest-only level or map exists (`content.levels` unchanged), and the median generation time is within `config.quests.genBudgetFactor` (default 1.05) of the time without quests.

## Rewards (R7-0 CORE)

### R-247 Quest rewards (should; the gear rewards are never dropped)

- **AC-R-247-1** `R7` `Unit` — Given `sq1` `ready`, When it is handed in to the vendor, Then gold and experience rise by the configured floor-scaled amounts, one stack of potions of `config.quests.sq1.potions` is added to the bag or belt, and `sq1` is `completed`.
- **AC-R-247-2** `R7` `Unit` — Given `sq2` `ready` and `sq3` `ready`, When each is handed in, Then `sq2` grants exactly one armour piece (equipment slot in the armour slots) and `sq3` exactly one weapon plus `config.quests.sq3.potions` potions; each gear piece is rolled by the normal item generator with rarity at least `magic`, item level equal to the generator level for floor 4 (`config.quests.gearFloor`, default 4), and is identical for the same seed and inputs; neither is a unique. `player.skillPoints`, `player.attrs` and attribute points are unchanged by any hand-in.
- **AC-R-247-3** `R7` `Unit` — Given a `ready` quest, When hand-in is called twice, Then the reward is granted once only; Given a full bag with no room for the gear piece, Then the hand-in is refused atomically (`{ok:false, reason:'bagFull'}`), no part of the reward is granted, the quest stays `ready`, a notice is shown, and after space is freed the hand-in succeeds. Nothing is ever lost or dropped on the floor.
- **AC-R-247-4** `R7` `E2E` — Given an `available` quest, When its dialogue is open before Accept, Then the reward is listed as text (gold, experience, and for `sq2`/`sq3` the gear kind with "at least magic", potions) in the dialogue and in the journal entry.

## Journal, next step, HUD, pinning, map (R7-0 UI)

### R-242 Next step per active quest (must)

- **AC-R-242-1** `R7` `Unit` — Given every quest in every state, When `nextStep` is read, Then an `active` quest has exactly one non-empty text that is an instruction (names the action and where: floor, NPC or monster), a `ready` quest shows "Return to <giver name>" style text naming its giver, and an `available` side quest shows "Talk to <giver name>"; a `completed` quest has none. After each event of AC-R-241-1 the text equals the new current step's line (never stale, checked by comparing with the step table after every event of a 600-tick scripted run).

### R-243 Journal panel (must)

- **AC-R-243-1** `R7` `E2E` — Given a running game, When key J is pressed, the HUD journal button clicked, or the pause-menu entry "Journal" chosen (three separate runs), Then `ui.panels.journal` is true; pressing J again or Escape closes it, and Escape closes only the journal when it is the top panel. Opening it does not add a pause beyond what the other panels do (`snapshot.paused` equals its value for the inventory panel under the same conditions).
- **AC-R-243-2** `R7` `E2E` — Given `main` at step 3, `sq2` active with progress, `sq1` completed and `sq3` available, When the journal is open, Then the DOM text shows the active quests with the main quest first then side quests, each with title, giver name, the next-step line (equal to `quests[id].nextStep`) and progress ("3/8" style where there is a count); a "Completed" list holds `sq1` with no next step; the pouch's quest items are listed; the pin state is shown as text. All of it updates without reopening when a step completes.
- **AC-R-243-3** `R7` `E2E` — Given the Options keys list, When it is read, Then the journal key appears with the other panel keys, default J; remapping it to another free key makes that key open the journal and J do nothing; a conflicting key is rejected by the existing rule for panel keys.

### R-244 Phone layout and keyboard (must)

- **AC-R-244-1** `R7` `E2E` — Given viewport 1280x720, When the journal is open, Then it is a side panel like the character sheet, no horizontal scroll, and no overlap of the HUD tracker with the panel's controls. Given 390x844, Then the HUD button is present with a touch target at least as large as the other HUD buttons, the journal opens as a full-screen panel with a visible close control, there is no horizontal scroll, long quest text wraps, and every quest and next step is readable by scrolling. Look and layout polish: `verify: playtest/visual review`.
- **AC-R-244-2** `R7` `E2E` — Given keyboard only, When J opens the journal, Tab and arrow keys move focus over the quest entries and the pin controls, Enter activates a pin control, and Escape closes with focus returned to the previous element; every quest state (`available`, `active`, `ready`, `completed`, pinned) is also exposed as text or a shape in an accessible name, not colour alone (NFR-A03, NFR-A07), and body text meets NFR-A04 contrast (computed at least 4.5:1).

### R-248 Tracker line, pinning, map marker (should)

- **AC-R-248-1** `R7` `E2E` — Given a new game, When the HUD is read, Then the tracker shows one line equal to `quests.main.nextStep` ("Take the lift down."), it updates in the same tick as the step completes, it never exceeds one line at 1280x720 and 390x844 (truncated with the full text in the title/accessible name), and it is absent only when no quest is active.
- **AC-R-248-2** `R7` `E2E` — Given `main` and an active side quest, When the player pins the side quest in the journal, Then the tracker shows that quest's next step, exactly one quest is pinned at any time, unpinning returns the tracker to `main`, the pin survives save and reload, and a pinned quest that completes reverts the tracker to `main` (or to the next active quest if `main` is completed).
- **AC-R-248-3** `R7` `E2E` — Given the pinned quest's target is the stairs down or a giver NPC, When the full map (M) is opened, Then a marker with a text label (not colour only) is on the map only if the target is already known (NPC in the Lobby; stairs on a floor already explored or revealed); in a freshly entered floor whose stairs are not yet seen there is no marker and `map.markers` is empty, and once the stairs are seen the marker appears. Quest item and elite positions never get a marker before they have been seen.

## NPC markers and dialogue (R7-0 WORLD)

### R-249 NPC quest indicators (should)

- **AC-R-249-1** `R7` `E2E` — Given the Lobby with `sq1..sq3` `available` then, after `sq2` becomes `ready`, When `npcs[].marker` and the canvas text model are read, Then the vendor, healer and potion seller show marker `available` and the stash keeper `none`; after `sq2` is `ready` the healer shows `handin`; the two marker kinds use different shapes (for example an exclamation sign versus a question mark; the exact glyphs are the renderer's) and the shape set is exposed in the model so colour is not the only cue. Whether the markers look good and read at gameplay scale: `verify: playtest/visual review`.
- **AC-R-249-2** `R7` `E2E` — Given an NPC with a quest, When the player talks to it, Then the dialogue shows the quest's short text with Accept and Decline (available), a progress line (active) or a hand-in line with Hand in (ready), and the normal trade, heal or stash options remain in the same dialogue and work.

## Save v4, migration, slot card, no fail (R7-0 CORE then UI)

### R-251 Quest state in saves, migration v3 to v4 (must)

- **AC-R-251-1** `R7` `Unit` — Given `config.saveVersion === 4` and a character with `main` at step 4, `sq1` completed, `sq2` active with the quest item in the pouch, `sq3` available and `sq2` pinned, When serialised and deserialised, Then `quests`, the pouch, objective progress and the pinned id are deep-equal, the slot text stays within `config.slotMaxBytes` (NFR-D05), `deserialize` never throws on 20 mutated copies, and a slot with `version` above 4 reports `tooNew` (R-227 unchanged).
- **AC-R-251-2** `R7` `Unit` — Given v3 fixtures (synthetic, `fixtures/save-v3-*.json`) with `deepestDepth` 0, 1, 4 and 8 with the boss unlocked, and `bossDefeated` true, When `migrate` runs, Then the main step is 1, 3, 4, 5 and 6 respectively (derived: floor 1 reached completes steps 1-2, floor 4 completes 3, boss unlocked completes 4, boss defeated completes 5), `sq1..sq3` are `available` with progress zero in every case (none `active`, none `completed`), and `gold`, `xp`, `items`, `equipment`, `belt`, `stash`, `skills`, `skillPoints` and `attrs` are deep-equal to the fixture (no retroactive rewards, the quest item and elite are not created); the slot version is 4, a second `migrate` leaves the text unchanged, and a corrupt v3 text still ends as `corrupt` without an exception (extends AC-R-225-2/4).
- **AC-R-251-3** `R7` `E2E` — Given a browser context seeded with the v3 `deepestDepth 4` fixture in slot 2 and a valid slot 1, When the page loads and slot 2 is continued, Then the game starts without error, the journal shows `main` at the derived step with its next-step line, the three side quests are offered by their NPCs, and slot 1's stored text is byte-identical to before.

### R-252 Slot card (should)

- **AC-R-252-1** `R7` `E2E` — Given slots in different quest states, When the slot list (title and pause Options) is read, Then each occupied card shows, in addition to the R-222 fields, the main quest's current step title and "N/`sideCount` side quests done" (for example "Go deeper · 1/3") equal to the projection of the stored state; a migrated slot shows its derived step with "0/3"; an empty or corrupt slot shows no quest text.

### R-253 No fail, no abandon, per character (should)

- **AC-R-253-1** `R7` `E2E` — Given `sq2` active with the quest item in the pouch and `sq3` active with the elite alive, When the player dies, leaves floor 4, saves, quits to title and reloads, Then every quest keeps its state and progress (deep-equal to before except time and position), the pouch item remains, no quest is `failed`, and the API has no abandon action (`quests.abandon` is absent from `describe()` and the journal shows no abandon control).
- **AC-R-253-2** `R7` `E2E` — Given slot 1 with `main` at step 4 and slot 3 newly created, When slot 3 is played to a side quest hand-in and slot 1 is overwritten or deleted with confirmation, Then slot 3 starts at `main` step 1 with all side quests `available`, its quest state differs from slot 1's, slot 1's reward does not appear in slot 3, and the other slot's text is byte-identical after each operation (AC-R-220-2 pattern).

## Cues (R7-0 UI)

### R-254 Sound and visual cues (should)

- **AC-R-254-1** `R7` `Unit` — Given the events accept, step done and quest complete (main and side), When they occur, Then each raises exactly one cue event (`quest.accepted`, `quest.step`, `quest.completed`) carrying the quest title and the new next-step text (none for a completed quest), and no cue is raised for a no-op (declined, repeated hand-in, catch-up to the same step).
- **AC-R-254-2** `R7` `E2E` — Given a quest event, When it happens, Then `ui.toast` shows the quest title and the new next step as text for at least `config.quests.toastMs`, the procedural chime plays through the global audio kit (logged by the audio test model, no sound file), the journal button's badge (`ui.badge.journal`) is set until the journal is opened and then clears, and with audio muted or volume 0 the chime is silent while the toast and badge still appear. How the toast, chime and badge feel: `verify: playtest/visual review`.
- **AC-R-254-3** `R7` `E2E` — Given reduced motion (option or `prefers-reduced-motion`), When a quest event happens, Then the toast is shown without animation (computed animation and transition none, appears and disappears in one frame), the badge and NPC markers do not animate, and no element flashes more than 3 times per second (NFR-A05).

## Originality (R7-0 CORE)

### R-255 Original quest names and text (must)

- **AC-R-255-1** `R7` `Unit` — Given every string of `content.quests` (titles, step titles, next-step lines, dialogue, hand-in lines, elite name, quest item name, reward names, toast templates), When scanned against `ip-denylist.txt` and `ip-denylist-brands.txt`, Then there are zero hits, and none contains a real person, company or brand name; the scan test iterates the content module so a new quest string is covered without editing the test. Final wording is an escalation, not testable here.

## Testability, bot, determinism (R7-0 CORE)

### R-256 Test hook, bot playability, golden replay (must)

- **AC-R-256-1** `R7` `E2E` — Given `?test=1`, When `__app.describe()` is read, Then it also lists `quests.state()`, `quests.talk/accept/handIn/pin`, `quests.setStep(id, n)` and `cheat.completeQuest(id)`, each of which works (setStep and completeQuest produce the same state as the event path, including the cue and reward), and without `?test=1` none is reachable (AC-NFR-S01-1).
- **AC-R-256-2** `R7` `Unit` — Given the headless bot, fixed seeds `config.bot.seeds` (at least 3 per class) and no quest-specific cheats, When it plays from the Lobby to the victory screen, Then every run ends with `main` `completed` and `sq1..sq3` `completed` (the bot talks to the three givers, takes the quest item into the pouch, kills the elite and the kill-task monsters, and hands in using only snapshot data and the public input API), and game time to the boss stays within the R-006 range of 20-40 minutes (ticks / `tickHz`) with the quests added (extends AC-R-230-1).
- **AC-R-256-3** `R7` `Unit` — Given the recorded run `fixtures/run-a.json` (a run that never talks to a quest giver), When it is replayed after R7-0, Then the golden hash WILL CHANGE once, and only for this reason: the state gains a `quests` subtree (main quest `active` at step 1, steps completing on depth events) and `player.pouch`. It is re-pinned exactly once, as in R4 (R-256). Proof that gameplay is unchanged: the canonical hash of the final state with the `quests` subtree, `player.pouch` and quest-only `ui.*` keys removed equals the previous golden value (kept as `fixtures/run-a.pre-r7.hash`), which holds only if the quest stream is separate and nothing spawns or drops without an accepted quest (AC-R-240-2). Same seed and inputs give equal hashes in Node and the three browsers (AC-NFR-Q01-2 pattern).

## Coverage

| Requirement | ACs | Levels |
|---|---|---|
| R-240 (must) | 240-1, 240-2 | Unit |
| R-241 (must) | 241-1, 241-2 | Unit |
| R-242 (must) | 242-1 | Unit |
| R-243 (must) | 243-1, 243-2, 243-3 | E2E |
| R-244 (must) | 244-1, 244-2 | E2E (244-1 partly visual review) |
| R-245 (should) | 245-1 | Unit |
| R-246 (should) | 246-1..246-5 | Unit, E2E |
| R-247 (should) | 247-1..247-4 | Unit, E2E |
| R-248 (should) | 248-1, 248-2, 248-3 | E2E |
| R-249 (should) | 249-1, 249-2 | E2E (249-1 partly visual review) |
| R-250 (must) | 250-1 | Unit |
| R-251 (must) | 251-1, 251-2, 251-3 | Unit, E2E |
| R-252 (should) | 252-1 | E2E |
| R-253 (should) | 253-1, 253-2 | E2E |
| R-254 (should) | 254-1, 254-2, 254-3 | Unit, E2E (254-2 partly visual review) |
| R-255 (must) | 255-1 | Unit |
| R-256 (must) | 256-1, 256-2, 256-3 | E2E, Unit |

Total ACs in this file: 39 (limit L-03: 40). By area: state machine and determinism 4 (240-1, 240-2, 241-1, 241-2); side quests, item, elite, generator 7 (245-1, 246-1..5, 250-1); rewards 4; journal, next step, phone, keyboard 6 (242-1, 243-1..3, 244-1..2); tracker, pinning, map 3; NPC markers and dialogue 2; save, migration, slot card, no fail 6 (251-1..3, 252-1, 253-1..2); cues 3; originality 1; test hook, bot, golden replay 3. Of these, 18 test a must requirement and 21 a should requirement.

## Not covered by an AC here

- In-world quest arrow, story collectibles, special rooms, quest chains, abandon or re-accept, timed or failable quests, new NPCs, notice board, rewards that grant skill or attribute points, unique quest items, achievements, voice and localisation: out of scope (circle-03 out-of-scope list).
- The side quest count is a proxy choice (3, not the proposed 6); going to 6 is content only (R-240) and raises `sideCount`, the slot card text and the bot AC.
- Wording quality, toast and chime feel, marker legibility and layout polish are reviews, not assertions.

## Questions for the facilitator

- **QF-12-1** Step 1 completion event: is there an existing "start memo dismissed" event (R-104)? The AC accepts memo read or first descent, whichever comes first. Confirm which one the architect exposes.
- **QF-12-2** Inventory full on a gear hand-in (R-247 leaves "keeps the quest open or drops to the floor"): the AC takes keep-open and atomic (nothing granted). Confirm.
- **QF-12-3** Characters that are already past floor 4 (a migrated v3 save, or a player who skipped the quests) can still accept `sq2`/`sq3` only if floors 3-4 can be revisited and regenerated by the stairs; if floors are not revisitable that deep, should those quests be offered? The ACs assume revisits work (AC-R-246-2, 246-5).
- **QF-12-4** AC-R-256-3 changes the golden hash because the state gains `quests` even for a run that never talks to a giver. If the architect prefers to keep the golden unchanged, `quests` must be excluded from `hashState` (like `ui.hud` and `perf`), which hides quest drift from replay checks; the spec recommends re-pinning.
- **QF-12-5** The victory verdict (main step 6) needs a "verdict read" event from the victory screen; confirm that screen exists as an event source.
- **QF-12-6** Escalations carried from circle-03: confirm 3 side quests with the customer, confirm the working titles and the six step lines, and confirm that quests hand out gear rather than only gold and experience.
