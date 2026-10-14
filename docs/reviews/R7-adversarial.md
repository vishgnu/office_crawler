# R7 adversarial pass (test-engineer, adversarial mode, 2026-10-14)

Scope: round 7: the AI fixes (R7-ai: hero retargets an adjacent attacker, hold timeout, bot watchdog reset), the floor warm-ahead (R7-stutter), and the quest system (ADR-0007, spec `12-quests-journal.md`, contract `R7-contract.md`: step machine, pouch, hand-in, placement, elite, save v4 and migration, journal, tracker, NPC window, toasts, markers, bot quest paths). I did not write this code and did not read the implementers' tests before writing mine (I read the sources, the ADR, the spec, the contract and the progress notes). No `src/` file was changed and no git command was used.
Method: probed each hypothesis in Node first (scratch scripts), then in Chromium (Playwright 1.56.1, https origin `https://oc.test`, never `file://`), then froze it as a test. Legal fixtures are real play: the headless bot plays through the public input API (no cheat) and the game's own save writer turns the state into a slot text that the page imports; hostile fixtures name the rule they break and assert the rejection.

Tests: `e2e/adv-r7.mjs` (165 checks, 5 expected failures, about 2 minutes; registered in `e2e/run-all.mjs`; `SEC=journal|phone|dialog|handin|final|slots|xss|toast|motion|markers|pouch|chaos|warm` runs one section), `test/adv-r7-quests.test.js` (30 cases), `test/adv-r7-save.test.js` (50 cases, 4 todo), `test/adv-r7-ai.test.js` (10 cases, 1 todo). Screenshots `docs/shots/adv-r7-*.jpg` (journal desktop and phone, bag-full hand-in, completed journal, elite floor).

## Summary

| id | severity | title |
|---|---|---|
| ADV-R7-01 | minor | The save schema accepts side quests that are `ready` or `completed` with none of the play they need: a level-1 hero that never left floor 1 loads with `sq3` ready and collects a rare weapon, gold and xp |
| ADV-R7-02 | minor | The quest toast is overwritten when the finishing kill also levels the hero up: the "Return to ..." line is never shown nor announced |
| ADV-R7-03 | minor (bot only) | The bot leaves the badge behind on floor 4 and its single Lobby trip is gone: `sq2` never completes (1 of 12 new seeds) |
| ADV-R7-04 | trivial | Phone layout: Escape on the journal returns focus to `<body>` instead of the button that opened it |
| ADV-R7-05 | minor | NPC markers keep bobbing under the OS setting `prefers-reduced-motion`; only the in-game option stops them (AC-R-254-3 asks for both) |
| ADV-R7-06 | trivial | The "bag is full" `role=alert` line stays in the NPC window after the hero has made room |

Counts: blocker 0, major 0, minor 4, trivial 2. Everything else I attacked held (see the attack list).

## Findings

### ADV-R7-01 (minor) forged ready or completed side quests are accepted

- Repro (node, `test/adv-r7-save.test.js`, four todo cases and one demonstration): `serialize(newGame(5, {start: "town"}))`, set `quests.sq3 = { s: "ready", p: 1 }` (or `sq1` ready with `p: 8`, or `sq2` ready with the pouch entry, or any of them `completed`), seal the checksum, `deserialize`: `ok: true`. The hero has `deepestDepth 1`, `stats.kills 0`, level 1. Standing at the potion seller, `questHandIn sq3` pays a magic or rare weapon, 90 gold, 140 xp and 2 potions (test "the bypass is worth something").
- Expected: the block is "exactly what play can produce" (`format.js` comment, contract section 3 "0 forged states accepted"; the R6 round made the same demand of xp against level, ADV-R6-06). Play needs: `sq3` ready or completed only with `deepestDepth >= config.quests.elite.depth` (4); `sq2` ready or completed only with `deepestDepth >= itemFloorOf(seed)` (3 or 4); `sq1` ready or completed only with `stats.kills >= config.quests.kill.count`.
- Actual: `src/save/format.js:205-209` ties progress to the state word and the goal only, and `format.js:217` ties the pouch to `ready`; neither looks at the world flags the other checks already use (`format.js:203`).
- Impact: single-player self-edit of a checksum that is not secret; a free rare weapon and a few levels worth of xp. Rejected correctly in the same file (35 hostile blocks, all refused): unknown keys, `__proto__`, flags that are not booleans, milestones beyond the world flags, progress outside the state, pinned completed, pouch without `ready` and the reverse, hostile pouch ids, duplicate pouch entries, extra fields.

### ADV-R7-02 (minor) a level-up on the finishing kill erases the quest toast

- Repro (browser, `e2e/adv-r7.mjs` section `toast`, two XFAIL lines; real kills through the game's own damage path): Sales Rep, 15 zombie interns killed before the quest, then Accept `sq1`, then 8 kills. The eighth kill makes `sq1` ready and takes the hero past the 136 xp level. `ui.toast` is "Level up! Now level 2." and the live region says the same; "Intern Overflow: Return to Office Supplies in the Lobby for your reward." was shown for 0 ms and never announced.
- Expected (AC-R-254-2): the toast shows the quest title and the new next step for at least `config.quests.toastMs` (4000 ms); a screen-reader user hears it.
- Actual: `src/core/systems/damage.js:41-42` emits `kill` (the quest tap emits `quest.step` at once) and then `gainXp` emits `levelup`; `src/game.js:325` (`game.toast`) replaces whatever is showing and `game.js:67` only gives the quest line a longer time of its own, not a protection. Same for the elite (big xp), any `potion`, `inventoryFull` or `castRefused` toast within four seconds of a quest line, and for the live region (`panels.js:333` replaces its text).
- Suggested: a quest toast keeps the lane until its time is up and later lines queue behind it (or the level-up line is appended to it); the live region should get both.

### ADV-R7-03 (minor, bot only) the bot misses the badge on some seeds

- Repro (node, `test/adv-r7-ai.test.js` todo): `runOne(104, 400000, { depth: 9, respawn: true, maxDeaths: 12, class: "sales-rep" })` ends `won` with `quests.all === false`: `sq1`, `sq3` and main completed, `sq2` ready with the badge still in the pouch. Trace: floor 4 is entered at tick 20011 with the badge on 26,23; the bot issues three `pickup` orders at ticks 20016, 21006 and 21288 while 48 monsters are awake and fights pre-empt each of them; `lootTries` reaches `BOT.lootTries` (3) and the entry is skipped; the single Lobby trip at tick 31411 happens with `sq2` still active; the badge is picked up on the way back (tick 40027), but `questTrip` allows one trip only (`mem.q.trips > 0`), so it is never handed in. 11 of 12 new runs (seeds 101-104 x 3 classes) complete everything; with `wearStartKit` (the shipped start) the same seed completes.
- Expected (AC-R-256-2): every run ends with all four quests completed.
- Actual: `bot/policy.js:54` counts an order as a try when it is issued, not when it fails; `bot/policy.js:117` then skips the entry; `bot/quests.js` `questTrip` has no second trip.
- Impact: the bot's quest coverage and the parity table, not the game. A human can always pick the badge up (reachability verified on 600 floors).

### ADV-R7-04 (trivial) phone: focus is lost when the journal closes

- Repro (browser, 390x844, `[R7-phone]` XFAIL): focus the dock Journal button, Enter, Escape. `document.activeElement` is `<body>`; at 1280x720 it is `dock-journal`.
- Expected (AC-R-244-2): focus returns to the previous element. Suspect: `src/ui/panels.js:293-297` (`syncJournalFocus`) focuses the remembered button at the moment the drawer closes; on the phone layout the dock is still hidden then. The inventory, character and skills panels also end on `<body>` there (existing behaviour), so it is a family, not a quest bug.

### ADV-R7-05 (minor) markers ignore `prefers-reduced-motion`

- Repro (browser, `[R7-motion]`): the vendor's marker is a yellow disc (#f0e442); the spread of its centroid over 3.5 s is 2.4 px with no setting, 2.4 px with `reducedMotion: "reduce"` on the browser context, 0.0 px with the in-game option "Reduce motion". The toast and badge do stop under the media query (CSS `@media`, `style.css:714`).
- Expected (AC-R-254-3): "reduced motion (option or prefers-reduced-motion): the badge and NPC markers do not animate".
- Actual: `src/game.js:453` sets `fx.reducedMotion` from the option only; nothing reads `matchMedia("(prefers-reduced-motion: reduce)")` for the canvas (`src/render/questmark.js:11` is the bob). Same gap for the older canvas effects (`fx.js:296`, `:456`, `:783`), so a default could be taken from the media query once, in `src/ui/options.js` (`defaults`).

### ADV-R7-06 (trivial) stale bag-full alert

- Repro (browser, `[R7-handin]` XFAIL): full bag, Hand in (refused, alert shown), sell items through the vendor window; the alert (`role=alert`, "Your bag is full ...") is still there until the window closes or the quest completes (`src/game.js:75-78` keeps `questNotice`). It is no longer true and a screen reader has it as the last alert. Expected: cleared when the bag changes (or the hand-in is retried).

## Not defects, worth knowing

- Reward gear and requirements: after eight rerolls the last roll stands (`quests.js:rewardOf`). Level-1 heroes get an unwearable piece in 18 of 1 200 cases (level 5 to 8 gear); a level-8 specialist with every point in the power attribute in 3 of 1 200; the bot's real heroes at hand-in time (35 hand-ins) never. The reward is a function of seed and hero stats, so retrying a refused hand-in after changing attributes can change the item; nothing reveals it beforehand.
- After the retarget rule moves the hero from a held target to an adjacent attacker, the original target is forgotten (the hero stands idle after the attacker dies, as it does after any kill; the player clicks again).
- Pressing J while an NPC window is open closes the window (the dialog is closed in the core) and opens the journal; one Escape then returns to the plain game.
- `quest.handInRefused` appends an event to the log, so "state byte-identical" holds for everything except `events` and `eventLog` (compared without them).
- The real bot's bag is full at its first Lobby visit; the quest dialog handles it (alert, then sell, then success).

## Attack list and results

| Area | What I tried | Result |
|---|---|---|
| Step machine | Lobby straight to floor 4 (one cue, step 4), climbing back (no cue, no step back), memo read twice, floorEnter before quest.step, verdict before the boss refused, verdict by `storyRead` and by `keepPlaying` alone, together and in both orders (one `quest.completed`), death and respawn, kills before Accept, other monster types, floor 3, summoned zombies, corpse hit twice, 8th kill once, reload with 5/8 and carry on | all held (the "step 3" in my first draft was my error: the cue names the step that is now current) |
| Cheats against real play | every `setQuestStep(id, n)` from a fresh hero and from floor 4, `completeQuest` of every quest in three orders: each result serialises and loads, quests and pouch deep-equal | held |
| Pouch iff ready | real pickup with a full bag, floor change, Lobby, death, respawn, save and load, second visit (no second badge), 6 seeds x 400 random operations (accept, hand in, floors from either stairs, pickup, death, respawn, reload, bag fills, pins), invariant and a legal save after every operation; `sell`, `drop`, `stash`, `toBelt`, `equip`, `useItem`, `unequip`, `pickup`, `useBelt` aimed at the pouch id | held |
| Hand-in | exact-fit bag and one cell short for each quest x 4 seeds x 3 classes (gear first, potions after, real autoplace order): refusal leaves every byte of state (gold, xp, pouch, bag, quests) and grants nothing, the exact fit pays; two hand-ins in one tick and a later one pay once; a hand-in that levels up (completes once, attributes and skills untouched, points = the level's points, legal save); wrong NPC, dialog closed, hero walked off | held |
| Rerolls and requirements | 200 seeds x 3 classes x sq2/sq3 at level 8; reward identical for the same seed and hero; magic or rare, never unique, ilvl as configured; refused-then-retried gives the same gear as an immediate hand-in | held (see the note on the tail) |
| Placement determinism | 60 seeds: badge and elite tile identical on revisit, from either stairs, after a Lobby trip and after save, load; 300 seeds x floors 3 and 4: the spot exists, is walkable, reachable from the entry, outside the safe radius, not on a stair | held |
| Golden and rng | 40 seeds x floors 1..8: no quest accepted means no elite and no badge on any floor; accepting all three changes only the badge floor and the elite on floor 4 (monsters identical otherwise) and leaves `state.rng` identical; the recorded runs replay to the pre-quest hash once the quest subtree, the pouch and quest events are removed (3 classes) and emit no quest event; the golden runs play identically with the new AI rules off | held |
| Elite | 100 seeds: exactly one while `sq3` is open over five revisits, a death and a reload, at full health; killed once it is not generated again; a kill while the quest is not accepted (cheat) gives no credit and accepting again brings it back once; none on other floors, none once ready or completed | held |
| Save v4 | 35 hostile quest blocks rejected; `__proto__` own key rejected without pollution; 300 mutated saves never throw and every accepted one survives a write; every autosave and quest event of three real bot runs loads again with the block and pouch unchanged and re-saves byte-identically; block under 400 characters | held, except ADV-R7-01 |
| Migration | every real fixture (v0, v1, v2 x3, v3 x5): loads, side quests untouched, no retroactive reward, derived steps right, re-save is v4 and stable; a second `migrate` changes nothing and the input is not mutated; a v3 file carrying a forged `quests` block gets the derived block; v1 and v2 saves then play quests (accept, floor 4, reload, elite back) | held |
| Slot index | an index from an R5/R6 build (ok entries without quest fields) upgrades once and the slot texts stay byte-identical; a hostile index (name, class and every number as markup) renders as text, nothing executes; hostile slot names and pouch ids are refused at import; hostile key names in stored options do not execute in the dock | held |
| Journal, tracker, NPC window | keyboard only: Enter on the dock opens (focus on the first quest), arrows, Tab to the pin, Enter pins and unpins with focus kept, Escape closes only the journal and returns focus (desktop), pause-menu entry resumes and opens, J twice, J over an NPC window; Accept and Decline by keyboard, three clicks on Accept in one frame accept once, focus never falls to `<body>` when the focused button disappears; accessible names on every control; state as text; no abandon; tracker one line and not overlapping at 1280 and 390; text scale 1.25 to 2 at 390, 320 and 1280 | held, except ADV-R7-04 |
| Phone | 390x844: tracker inside the viewport, journal button at least as large as the others, journal full-screen with a 40 px close, pins at least 24 px, lines wrap, no horizontal scroll | held |
| Toasts and spam | 40 refused hand-ins in a row: one toast element, bounded live region, nothing granted; 61 presses of J | held; ADV-R7-02 |
| Markers | shapes exposed (exclamation for an offer, question for hand-in) and different; follow the quest state; map markers only for the pinned quest's known target, never the badge or the elite (20 seeds x floors) | held; ADV-R7-05 |
| Interruptions | four resizes desktop to phone with the journal open, blur and a hidden tab with an NPC window open, quit to title in the middle of an active step and Continue, death with a window open and respawn | held |
| Two tabs | tab B refused the slot while tab A owns the saves (`another-tab`); after the explicit take-over B hands in, its save is legal, and A's later write is refused: the stored slot never goes back to "ready" | held |
| Slot switch | second character in slot 2 starts clean; slot 1's text byte-identical after creating it, after the switch and back; the pouch follows its character | held |
| Hero retarget | stays on the clicked target while in reach (400 ticks), no strike before `retargetTicks`, answers the attacker after it, no oscillation, a ground click and a click on another monster win at once, hold timeout, standing counter stays below the limit in the open; whole bot runs (IT Wizard 24, FM 5, SR 9) with zero watchdog give-ups | held |
| Warm-ahead | 28 floor changes in about a second including the boss arena, then 6 s on floor 5: no page error, no missing atlas key, 35 fps; floor 4 with the elite quest active loads with the named elite | held |
| Bot | 12 new runs (seeds 101-104 x 3 classes, whole game, respawn): all won, no watchdog give-up, 11 complete all quests | ADV-R7-03 |

## No-cheat runs (whole game, real rules, no cheat)

Per class one real run through the public input API (the bot): played from the Lobby to the victory screen and `keepPlaying`, then the end state and the state at the first Lobby visit with all three side quests ready went through the game's save writer into slot texts that the page imported:

| class | seed | result | UI part |
|---|---|---|---|
| Facilities Manager | 102 | won, main and sq1..sq3 completed | Lobby save (all ready) loaded by the slot dialog; markers, pouch in the journal, bag filled by real pickups, refused hand-in, spam, sell, double click, sq2 (pouch) and sq3 through the real NPC window by mouse clicks; journal lists 3 completed; the end state shows 4 completed, no tracker, slot card 3/3 |
| Sales Rep | 101 | same | same |
| IT Wizard | 101 | same | same |

A run through the DOM from the first tick was not feasible: 41 000 ticks through `__app` round trips did not finish in 10 minutes (the snapshot per call; the same observation as in R6). The walk, accept and hand-in clicks are real; the 30 game minutes in between ran on the same core with the same inputs (one run per class was also replayed in Chromium in R6 and was identical).

## Flaky checks (L-027)

Three runs of `e2e/adv-r7.mjs` in a row gave the same 163 results (two checks were added afterwards: 165 in the full run). During development five checks failed and each was a test error, classified and fixed, none retried: the step cue names the current step (4 not 3); `talk` needs the hero in the Lobby; Decline closes the window (my script clicked a button that was gone); the second Escape opens the pause menu; the hostile index was overwritten by the page's own write on unload (fixed by an init script that edits storage before the game boots). No product or environment cause was seen; all pages are served over https, so the file:// storage artefact cannot occur here.

## Hand-off

- CORE-R7Q owner: ADV-R7-01 (`format.js:205-217`, three comparisons against `deepestDepth` and `stats.kills`), ADV-R7-02 (event order or toast policy with UI), bot ADV-R7-03 (`bot/policy.js:54`, `bot/quests.js`).
- UI-R7Q owner: ADV-R7-02 (`game.js:325`, `panels.js:333`), ADV-R7-04 (`panels.js:293`), ADV-R7-05 (`options.js` default from `matchMedia`, `game.js:453`), ADV-R7-06 (`game.js:75`).
- Not done: `docs/product/60-test-coverage.md` (the file is not in this round's edit list; the AC ids are in the test names: `[R7-step]`, `[R7-kill]`, `[R7-pouch]`, `[R7-handin]`, `[R7-place]`, `[R7-elite]`, `[R7-forge]`, `[R7-legal]`, `[R7-migrate]`, `[R7-slots]`, `[R7-journal]`, `[R7-phone]`, `[R7-dialog]`, `[R7-toast]`, `[R7-motion]`, `[R7-markers]`, `[R7-tabs]`, `[R7-xss]`, `[R7-chaos]`, `[R7-warm]`, `[R7-ai]`, `[R7-bot]`).

## Verification

`npm test` three times: 990 tests, 985 pass, 0 fail, 5 todo (ADV-R7-01 x4, ADV-R7-03) every time; `npm run build` ok; `npm run e2e` once as one command: all 17 scripts ok (adv-r7 165/165 with 5 XFAIL, adv-r6 429/429, adv-r5 150/150, r7quest 54/54, r7journal 59/59). No process left running.

## Addendum R7-4 (2026-10-14): defects found against the three-arc, five-side-quest model
| id | where | what | repro | status |
|---|---|---|---|---|
| ADV-R7-07 | `systems/quests.js` `questPin` (pre-existing, missed in R7) | the id is looked up with `quests[id]`, so `constructor`, `toString`, `__proto__` pass as quests and are written to `quests.pinned`; the next save fails the schema ("bad pinned quest") and cannot be loaded | `test/adv-r74-quests.test.js` "[R74-xss] ADV-R7-07", `e2e/adv-r7.mjs` "[R74-pin]" (todo / XFAIL) | open; fix: `Object.hasOwn(quests, id)` in `questPin` (and the same guard in `setQuestStep`/`completeQuest`) |
| ADV-R7-08 | `save/format.js` quest block | `sq5` `{active, p: 3}` with `deepestDepth` 4 loads (ready and completed are tied to floor 5, a partial progress is not) | `test/adv-r74-save.test.js` "ADV-R7-08" (todo) | open, low (the hero can reach floor 5 anyway) |
| ADV-R7-09 | `save/format.js` quest block | `sq1` ready (8 kills) and `sq5` ready (6 kills) load with `stats.kills` 8: each kill quest is checked against the shared counter on its own, not their sum | `test/adv-r74-save.test.js` "ADV-R7-09" (todo) | open, low |
| ADV-R7-10 | `config.quests.sq5` / population | floors 5 and 6 spawn fewer than 6 consultants on 15 of 1000 seeds (102: 3+2, 105: 0+2, 173, 183, 194, 412, 446, ...): the revive rule only returns killed spawns, so `sq5` can never be completed; AC-R-258-3 checks seeds 1 to 100 only; the bot (all three classes) ends seeds 102 and 105 with `sq5` active 5/6 and 2/6, so AC-R-259-3 fails on them | `test/adv-r74-quests.test.js` "ADV-R7-10" (700 seeds), `test/adv-r7-ai.test.js` "ADV-R7-10", `e2e/adv-r7.mjs` "[R7-nocheat] ... seeds 101, 102 and 105" (todo / XFAIL) | open; fix options: lower `count` in config to the smallest total over a wide seed range, or make the generator guarantee `count` consultants on floors 5 and 6 when `sq5` is accepted (as the elite does) |
