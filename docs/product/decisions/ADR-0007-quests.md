# ADR-0007 Quests: data model, step machine, quest stream, generator hooks, pouch, rewards, golden hash

Date: 2026-10-14. Status: proposed (plan gate for R7-0). Owner: architect.
Implements R-240..R-256 (`../30-spec/12-quests-journal.md`, 39 ACs) with the customer-proxy answers of `../circles/circle-03.md` (Q1 to Q7, provisional; titles and text escalated). Closes QF-12-1..5; QF-12-6 stays with the customer.
Interacts with ADR-0002 (pure core, replay), ADR-0003 (test hook), ADR-0006 (slots; save v4 is the amendment dated 2026-10-14 "R7 quests" in that file).

## Context (read from the code, 2026-10-14)

- `state.js newGame` builds one plain JSON state; `state.rng` has four named streams (`world`, `combat`, `ai`, `loot`); the save schema demands exactly those four (`save/format.js schemaProblem`). `hashState` covers the whole canonical state, including `events` and `eventLog` (last 256 events); only `ui.tooltip`, `ui.hud`, `perf` are excluded (`hash.js`).
- `step()` clears `state.events` first, applies inputs, then runs the systems unless the game is paused or not in the Lobby/floor. Events emitted outside `step` (test cheats such as `teleportFloor`, the slot loader) sit in `state.events` and are cleared by the next `step`: **a per-tick scan of `state.events` would lose them.** Every core event goes through `emit(state, ev)` (`events.js`, 6 lines), the one choke point.
- Existing events already carry what the main quest needs: `floorEnter {depth}` (end of `enterFloor`, after `state.depth` changed), `stairsUnlocked` (floor 8 cleared), `bossDefeated`, `kill {source, target, xp}` (emitted after `m.ai = "dead"`, the monster is still in `state.monsters` for `config.deathTicks`), `keepPlaying` (leaving the victory screen).
- **`deepestDepth` is 1 from the first tick, also in the Lobby** (`Math.max(1, floor.depth)`), and the save schema forces `deepestDepth >= 1`. "Never left the Lobby" cannot be read from it.
- The memo (`story.start`) is shown by the shell (`game.ui.story = "start"`, `dismissStory`); the core has no memo event. The victory screen is the scene `victory` (set in `boss.js finishVictory`, autosave reason `victory`), left by `keepPlaying` (screen button, `{t: "keepPlaying"}` input); the bot sends the same input.
- NPCs (`content/npcs.js`): `vendor`, `healer`, `potions` (the potion seller), `stash`; dialogue is `state.ui.dialog = {npc, kind, nameKey, lines}`; `heal` and `moveStash` already require the matching open dialog. Town stairs lead to `townTarget = deepestDepth` (`config.townStairsTarget`); every floor has a way up (`enterFloor(..., {at: "exit"})`). A floor regenerates from `hash32(seed, depth)` on every entry; what persists in a session is the list of killed spawn indexes and the ground items (`parkFloor`); after a reload only the explored map survives.
- Ground entries (`state.groundItems`) are drawn by the renderer from the entry's own `rarity/mark/border/color/label`, gold has no `item`; `keep: true` protects an entry from the ground cap. Potions are 1x1 items; the bag is a 10x4 grid (`autoplace`, `findSpot`).
- `test/fixtures/run-a.hash` and `run-class.json` (three class hashes) are frozen goldens; `AI-R7` re-records them (new `standT` field) before this work starts.

## Decision

### 1. Quests are data: `src/core/content/quests.js` plus `config.quests`

`content.quests` (exported through `content`): an object keyed by quest id, plus `questIds`, `sideIds`. Structure and text live in the content file; every number a balance pass may touch lives in `config.quests` (the ACs assert relations to these constants).

```
quests.main = { id: "main", kind: "main", title, steps: [ {id, title, line}, ... 6 ] }      // the six steps and lines of AC-R-241-1
quests.sqN  = { id, kind: "side", title, giver: <npc id>, salt: <1..9>,
                objective: { type: "kill" | "item" | "elite", ... },
                text: { offer, progress, ready, done },                 // dialogue lines (plain text, original)
                next: { available, active, ready },                      // next-step lines; "{giver}" is replaced by the NPC's name string
                reward: { refDepth, gold, xp, potions?, gear? } }       // numbers read from config.quests.<id>
```
Working ids as in the spec: `sq1` (giver `vendor`, kill), `sq2` (giver `healer`, item), `sq3` (giver `potions`, elite). The stash keeper gives nothing and no NPC is added. Titles, step lines, dialogue, the item name, the elite name and the reward names are working text (escalated, R-255); `test/ip-denylist.test.js` already scans all of `src`, and a new content-walking test (AC-R-255-1) iterates every string of `content.quests`.

`config.quests` (new, defaults): `sideCount 3`, `kill {monster "zombie-intern", count 8, depths [1, 2]}`, `item {floors [3, 4], pickupRange 1}`, `elite {type "middle-manager", depth 4, hpMult 1.6, level 4}`, `gearFloor 4`, per-quest reward numbers (`sq1 {gold {base 30, perDepth 15}, xp {base 40, perDepth 25}, potions 3}`, `sq2 {slots ["body","head","hands","feet"]}`, `sq3 {slots ["weapon"], potions 2}`, all with `refDepth`), `rewardRerolls 8`, `genBudgetFactor 1.05`, `toastMs 4000`. Going to 6 side quests is content plus `sideCount`.

### 2. State shape

Runtime (`state.quests`, created by `newGame`, plain JSON, hashed):
```
state.quests = {
  main: { m: { memo: false, depth: 0, unlocked: false, defeated: false, verdict: false } },   // milestones, monotone
  sq1:  { s: "available", p: 0 },  sq2: { s: "available", p: 0 },  sq3: { s: "available", p: 0 },   // s: available | active | ready | completed
  pinned: "main",
}
state.player.pouch = []          // [{ id: "qi-sq2", quest: "sq2" }]
```
- **The main quest stores milestones, not a step number.** `step` is derived: step 1 is done when `memo || depth >= 1`, 2 when `depth >= 1`, 3 when `depth >= 4`, 4 when `unlocked || defeated`, 5 when `defeated`, 6 when `verdict`; the current step is the first one not done (1..6), `completed` when all six are. Milestones only grow, so a step never goes backwards, an event out of order catches up (`cheat.teleportFloor(4)` from step 1 sets `depth = 4` and steps 1 to 3 are done), and death or leaving a floor changes nothing (AC-R-241-2, AC-R-253-1). `newGame` always starts with `m.depth = 0`, also for the legacy `start: "floor"` fixtures and `gameOn` test floors (AC-R-240-1 wants step 1 for `newGame(seed, {class})`, which begins on floor 1): the first `floorEnter` completes steps 1 and 2 by catch-up. The real game starts in the Lobby.
- `s`/`p` of a side quest: `available` (p 0), `active` (0 <= p < goal), `ready` (p = goal), `completed` (p = goal). Goal: `kill.count`, 1 for item and elite. There is no `failed` and no abandon.
- `pinned`: `"main"` or a side id whose state is not `completed`.
- The snapshot (`snapshot(state)`) adds derived data, never stored: per quest `{id, state, step, stepCount, progress, goal, nextStep, title, giver}` under `quests[id]` (the stored fields stay under `quests[id]` too, so `quests.pinned` is the stored string), plus `npcs: [{id, tile, marker}]` and `map: {markers: [...]}` (section 10). `ready` is a state of its own; the requirement's four states are `unavailable` (never produced this round: every side quest is offered from the start), `available`, `active` (+`ready`), `completed`.

### 3. The event-driven step machine

`src/core/systems/quests.js` (new). Every quest change is `(questState, event) -> questState` in a pure reducer; the system applies it and emits the cue events. Two entry points, both deterministic:

1. **A tap on `emit()`.** `events.js emit(state, ev)` calls `questEvent(state, ev)` after pushing the event (an ES-module import cycle `events.js <-> systems/quests.js`; both sides only call each other inside functions, so it is safe; `test/layering.test.js` only checks that core files import core files). `questEvent` returns at once if `state.quests` is missing (hand-built fixture states) and ignores every event type that starts with `quest.` (no re-entrancy). Because it runs inside `emit`, cheats, loaders and input commands feed the machine exactly like the simulation does, paused or not, and **no event can be lost**. Events it reacts to:

| Event | Effect |
|---|---|
| `floorEnter {depth}` | `main.m.depth = max(m.depth, depth)`; if the Lobby is entered with a ready or active item/elite quest nothing changes |
| `stairsUnlocked` | `main.m.unlocked = true` |
| `bossDefeated` | `m.defeated = true`, `m.unlocked = true` |
| `keepPlaying` | `m.verdict = true` if `m.defeated` (leaving the victory screen = the verdict was read) |
| `storyRead {id}` | `id: "start"` sets `m.memo`; `id: "victory"` sets `m.verdict` if `m.defeated` (section 5) |
| `kill {target}` | look the monster up in `state.monsters` (type, `summoned`, `quest`); for each `active` side quest with a `kill` objective whose monster type and depth range match and the kill is not `summoned`: `p += 1`, `ready` at the goal; for an `elite` objective whose id equals `m.quest`: `ready` |

   After the reducer, the tap compares the derived main step before and after: a change emits **one** `quest.step {id: "main", step, title, next}` (a catch-up over several steps is one event, for the new step), or `quest.completed {id: "main", title}` when step 6 was the last. A side quest that becomes `ready` emits `quest.step {id, title, next}` (its next line now says "Return to <giver>"). Repeated or no-op events emit nothing (AC-R-254-1).

2. **Commands** (inputs, applied in `applyInput` through one `default:` hook in `itemCommand`, so the table of `intent.js` gains one line): `{t: "questAccept", id}`, `{t: "questHandIn", id}`, `{t: "questPin", id}`, `{t: "storyRead", id}`. Accept and hand-in need the dialogue of the giver NPC to be open (`state.ui.dialog.npc === def.giver`, in the Lobby, hero within `interactRange`, the same gate as `heal` and `moveStash`): a hand-in to another NPC is refused (`{ok: false, error: "wrong npc"}`). Decline is `closeDialog`: no state change. `questPin` works anywhere in a running game; `storyRead` is whitelisted before the paused and not-live gates like `setName` (the memo and the victory screen are not live scenes) and validates its `id`. All commands return `{ok, error?}`, and emit `quest.accepted {id, title, next}`, `quest.pinned {id}`, `quest.handInRefused {id, reason}` or the hand-in events of section 8. The inputs are part of recorded input lists, so replays with quest actions are deterministic (AC-R-240-2).

There is no `quests.talk` command: talking is the existing `interact` input; the hook's `quests.talk(npc)` forwards to it. `quests.abandon` does not exist (AC-R-253-1).

### 4. nextStep and views (pure, in the core)

`src/core/systems/questview.js`: `questView(state)` (the snapshot data), `nextStep(state, id)`, `npcMarker(state, npcId)`, `mapMarkers(state)`. `nextStep`: main active, the current step's `line`; side `available`, `next.available` ("Talk to the {giver} ..."); `active`, `next.active`; `ready`, `next.ready` ("Return to {giver} ..."); `completed`, no text. `{giver}` is the NPC name string of the giver. After every event the text equals the current step's line because it is computed, not stored (AC-R-242-1). The renderer and the UI call these functions on the live state; the snapshot embeds their results.

### 5. Step 1 event (QF-12-1) and the verdict event (QF-12-5)

- **Step 1 completes when the memo is read or on the first descent, whichever comes first.** The memo is a shell overlay, so the shell reports it with the new core input `{t: "storyRead", id: "start"}` (sent by `dismissStory` when the dismissed overlay is the start story; recorded like any input). The first `floorEnter` with `depth >= 1` completes the step too: this covers `?test=1` runs and the bot, which never show the story, and a player who skips it. The step line "Take the lift down." therefore disappears at the first of the two.
- **The verdict.** The screen exists as an event source: leaving it fires `keepPlaying`, which the tap treats as "verdict read". Two gaps are closed: (a) a player who quits to the title from the victory screen is saved with step 6 open; (b) a migrated v3 save with the boss defeated starts at step 6 (AC-R-251-2). Both land in the Lobby with no victory screen. Decision: the **journal shows a "Read the verdict" action on step 6** whenever the scene is not `victory`; it opens the existing story overlay with the victory text (`content.story.victory`, `game.ui.story = "victory"`), and dismissing it sends `{t: "storyRead", id: "victory"}`. `storyRead victory` is refused unless `m.defeated`. No new screen.

### 6. The quest random stream: derived and stateless, not a fifth state stream (separate, QF-12 determinism)

The quest content needs random choices in three places only: which of floors 3 or 4 holds the item, where the item and the elite stand, and which gear the rewards roll. **Decision: none of them touches `state.rng`.** Each draws from a generator seeded by a hash of fixed inputs:

`questRng(seed, quest.salt, purpose, depth) = createRng(hash32(seed, 0x51535400 + salt, purpose, depth))`, `purpose`: `1` item floor, `2` item tile, `3` elite tile, `4` reward gear, `5` reward potions.

Why not `rng.quest` in the state:
- A fifth key in `state.rng` would change every state and every save for every run and break the strict "exactly four streams" schema check; it would also need a stored cursor that depends on the order of accepts.
- A derived stream has no cursor: a floor regenerates identically on every entry (the existing rule), so the item and the elite stand on the same tile on every visit and after a reload; accepting `sq3` before `sq2` changes nothing about `sq2`.
- Gameplay of a run that never accepts a quest is bit-identical: nothing draws, spawns or drops without an accepted quest (AC-R-240-2, AC-R-256-3). `generateFloor` itself is not touched: the hooks run after it, so `generateFloor(seed, depth)` is byte-identical with and without quests (the 50-seed layout comparison of AC-R-240-2 holds trivially for tiles, stairs and the spawn list).
- Two characters on the same seed get the same reward gear. Accepted (the rolled item still depends on class tag and hero level through the reroll rule below).

The elite's drops are rolled by the normal `loot` stream when it dies, which is part of a run that accepted `sq3`; that is allowed to differ.

### 7. Generator hooks: the quest item and the named elite

`placeQuestObjects(state)` (in `systems/quests.js`) is called **once, from `enterFloor`**, after `initFloorMap(state)` and before `emit(floorEnter)`. It is idempotent per entry and does nothing unless a quest is `active`.

- **Item (`sq2`).** Conditions: `sq2.s === "active"`, `p === 0`, the pouch has no `qi-sq2`, `state.depth` equals `itemFloor = config.quests.item.floors[questRng(purpose 1).int(0, 1)]`, no ground entry with `quest: "sq2"` is already there (a parked floor keeps its ground list). The tile comes from the pure function `questSpot(floor, rng, avoid)`: candidate rooms are the floor's rooms without the entry room and the exit room; a room and a tile inside it are drawn (up to 30 tries) until the tile is walkable (`getCtx(state).grid.walkable`, which already excludes blocking props and NPCs), is not a spawn start tile, not the entry or exit, and farther than `config.safeRadius` from the entry; then a scan of the same rooms in order, then any walkable tile that passes the same tests. Every walkable tile of a generated floor is reachable from the stairs (`validateFloor`, R-042), so any returned tile satisfies "reachable". The entry is a normal ground entry **without `item`**: `{id: "qi-sq2", quest: "sq2", label, rarity: "normal", mark: "!", border: "none", color, keep: true, tile}`. It is placed directly on the tile (no `freeGroundTile`, no `mint`, so `nextItemId` is untouched).
- **Elite (`sq3`).** Conditions: `sq3.s === "active"`, `state.depth === config.quests.elite.depth`, and no living monster with `quest === "sq3"`. A tile from `questSpot` (purpose 3, the monster start tiles and the player's tile are avoided; if `spawnMonster` refuses the tile, the next candidate is tried). `spawnMonster(state, type, tile, null, {tier: "champion", mods: [], level: elite.level, name, hpMult, quest: "sq3"})`; `makeMonster` gains three optional options (`name`, `hpMult`, `quest`, about 4 lines; the champion tier gives xp x3, hp x1.5 and the champion nameplate and loot floor "at least magic"). Total hp is `round(round(base x 1.5) x hpMult)`, at least `hpMult x monsterStats(type, 4).hp` (AC-R-246-4). The elite has no entry in `floor.spawns`, so `parkFloor` never counts it as killed: if the hero leaves or dies, the next entry creates exactly one again while `sq3` is `active`; once `ready` or `completed`, never (AC-R-246-5). It is not part of the population budget (`floor.spawns` is unchanged).
- **Validity (AC-R-250-1).** No new level, no change to `generateFloor`, no extra work at generation time beyond two random draws and a short scan per accepted quest; the budget assertion (`genBudgetFactor`) is measured by `generateFloor` + `placeQuestObjects` against `generateFloor` alone.

### 8. The pouch, the pickup and the rewards (QF-12-2)

- **Pouch** = `state.player.pouch`, an array of `{id, quest}`; the quest item's name and description come from content. It is separate from `inventory`, `stash`, `cursorItem`, `belt` and `equipment`, so it cannot be sold (`sell` only finds bag items), dropped (`dropCommand` only finds the bag or the cursor), stashed, or lost on death, and a full bag never blocks a pickup. Invariant (checked by the save schema): an entry exists if and only if its quest is `ready`.
- **Pickup.** `takeGround` (loot.js) handles `entry.quest` before the item path: remove the entry, push `{id, quest}` to the pouch, set `sq.p = 1`, `s = "ready"`, emit `quest.item {id, quest, name}` and `quest.step`. Both pickup routes (click/`pickup` input and the walk-over order in `pickups`) call `takeGround`, and the bot's `nextLoot` already issues `pickup` for every ground entry, so no bot change is needed for the pickup. The eviction code `evictOne` reads `e.item?.rarity` (safe) and never evicts `keep` entries.
- **Hand-in** `questHandIn(state, id)` is **atomic**: (1) checks dialogue/giver, `s === "ready"`, the pouch entry for item quests; (2) builds the reward list: gold, xp, gear (0 or 1 item), potions (n items); (3) **dry-runs the placement on a `structuredClone` of the bag grid** with the same `autoplace` order the real placement uses (gear first, then potions): if anything does not fit, return `{ok: false, error: "bagFull"}`, emit `quest.handInRefused {id, reason: "bagFull"}`, and change nothing (QF-12-2: the quest stays `ready`, nothing is dropped on the floor, nothing is granted); (4) otherwise grant gold (`giveGold`), xp (`gainXp`, may level up), place the items (`mint` ids, `autoplace`), drop the pouch entry, set `s = "completed"`, move `pinned` to `main` if it pointed at this quest (or to the first `active`/`ready` side quest when `main` is completed, else keep `main`), emit `quest.completed {id, title, rewards: {gold, xp, items: [names]}}`. A second hand-in finds `s === "completed"` and is refused with no effect. Potions go to the bag only (no belt logic): fewer cases, the player or the bot moves them to the belt as with any pickup.
- **Gear.** Drawn from `questRng(seed, salt, 4, 0)`, rolled by the normal generator: `rollItem(rng, {depth: config.quests.gearFloor, ilvl: gearFloor * config.ilvlPerDepth, minRarity: "magic", maxRarity: "rare", slot: rng.pick(reward.gear.slots), affixTag: affixTagOf(state)})`. `maxRarity: "rare"` keeps uniques out (no unique, `uniquesFound` untouched). The roll is repeated up to `config.quests.rewardRerolls` (8) times with the same stream until `checkReqs(player, item)` passes at hand-in time (a reward the hero cannot wear is a bad reward; after 8 tries the last roll stands). For the same seed, class and hero level the result is identical. `sq2` slots are armour (`body, head, hands, feet`), `sq3` is `weapon`. No skill or attribute point is granted by any hand-in (the reward code has no such branch).
- Gold and xp scale with the quest's `refDepth` (`sq1` 2, `sq2` and `sq3` 4): `base + perDepth x refDepth`.

### 9. The revisit of floors 3 and 4 for migrated v3 saves (QF-12-3)

Floors are revisitable today: every floor has a way up, `enterFloor` regenerates it from the seed and the placement hooks of section 7 run on every entry. **Decision: no special rule.** A migrated character (or a player who skipped ahead) may accept `sq2` and `sq3` in the Lobby and walk up the stairs to floor 3 or 4 (a long way from floor 8, but it is the same way a player returns today); the item and the elite are created on entry. The Lobby elevator is not changed (`townStairsTarget` stays `deepest`): redirecting it to a quest floor would change existing behaviour for every player. Consequences, stated rather than fixed: after a reload the floors come back with all monsters alive (existing rule), and the reward gear is level-4 gear and may be below what a deep character already wears (no retroactive power, by the customer's answer to Q6). The journal's next-step text for an open `sq2` or `sq3` names the floor, so the player knows where to walk. A UI fast-travel is a LATER idea, not part of this round.

### 10. Markers and map targets (derived, never stored)

- `npcMarker(state, npcId)`: `"handin"` if any quest of that giver is `ready`, else `"available"` if any is `available`, else `"none"`. The stash keeper is always `"none"`. The renderer calls it for the Lobby NPCs; the snapshot adds `npcs[].marker`.
- `mapMarkers(state)`: for the **pinned** quest only, the target of its next step if it is on the current floor **and already known**: the giver NPC in the Lobby (`state.depth === 0`, `exploredAt` is true for the whole Lobby), the stairs down or up of the current floor when `exploredAt(exit)` or `exploredAt(entry)` is true, the elevator in the Lobby for steps 1 and 2. Item and elite positions never appear before they have been seen (they are not "known targets"); a freshly entered floor yields `[]`. Each marker is `{quest, kind: "stairs-down" | "stairs-up" | "npc", tile, label}` with a text label. Step targets are data in the step (`target: {kind: "elevator" | "stairs-down" | "npc"}`), so a rename or a new quest changes content only.

### 11. The golden hash (QF-12-4): re-pin once, with a proof

**Decision: the state gains `quests` and `player.pouch` and stays hashed; the goldens (`run-a.hash`, the three hashes of `run-class.json`) are re-pinned exactly once, in package CORE-R7Q step 1, with a proof that gameplay is unchanged.** Exclusion from `hashState` is rejected:
- Quest state is saved state (save v4) and part of cross-engine parity (NFR-Q01, `e2e/replay.mjs` compares the browser hash to the Node golden); excluding it makes replay checks blind to the step machine, the pouch and the rewards, which are exactly the new things that can drift between engines.
- `ui.hud` and `perf` are excluded because they are not simulation state; quest progress is.
- The proof is cheap and strong: `hash.js` gains `hashStateWithout(state, {paths, eventPrefixes})` (the existing `canonical` takes an optional exclusion set and an event filter). The test replays `run-a.json` and the per-class run, strips `quests`, `player.pouch` and any `events`/`eventLog` entry whose type starts with `quest.`, and asserts equality with the pre-quest values, kept as `test/fixtures/run-a.pre-quests.hash` and `run-class.pre-quests.json` (copies of the goldens **as AI-R7 leaves them**; the proof baseline is the golden at the moment CORE-R7Q starts, not an older one). Equality holds only if the tap, the commands and the hooks change nothing for a run that never accepts a quest, which is the property the spec asks for. The same helper backs AC-R-240-2.
- The re-pinned values go to `run-a.hash` and `run-class.json`; the reason and old/new hashes to `docs/reviews/R7-core-q-notes.md`. Nobody else touches them.

### 12. Bot

`bot/quests.js` (new, pure like the policy) decides quest actions from snapshot data and the public input API; `bot/policy.js` gets two small call sites. Path: in the Lobby before the first descent, talk to the three givers (`interact`) and send `questAccept` for each `available` quest; on a cleared floor 4 (all three `ready`, or a ready subset after floor 4) climb with `useStairs up` to the Lobby (floors 1 to 3 are parked with their monsters dead, so the walk is quick), `interact` with each giver and `questHandIn`, then take the elevator (`townStairsTarget` = deepest = 4). The kill task needs no code (the bot hunts everything), the elite is a living champion on floor 4 (the bot clears floors), the item is a ground entry (the bot's `nextLoot`). Hand-in refused with `bagFull`: the bot sells spare gear with the existing vendor logic and retries. Expected cost: about 3 to 5 minutes of game time (three floors of walking); AC-R-256-2 keeps the 20 to 40 minute window.

## Options considered

1. **Per-tick scan of `state.events`** for the step machine: no edit of `events.js`, but loses events emitted outside `step()` (cheats, loaders; `step` clears `events` first) and runs while paused never. Rejected.
2. **Call quest hooks from each producer** (`damage.js`, `boss.js`, `world.js`, ...): four to six small edits in files other work is changing (AI-R7 in `ai.js`, `intent.js`), easy to forget on a new producer. Rejected for the single tap in `emit`.
3. **A stored `step` number** instead of milestones: needs explicit catch-up code in every handler and can drift from the world; migration has to compute it anyway. Milestones are the migration's output and the step is a function of them. Chosen.
4. **A fifth stream in `state.rng`** (`rng.quest`): see section 6. Rejected.
5. **Pouch as a flag on the quest** (`sq2.p`) without an item list: the journal must list "quest items" and AC-R-246-3 names `player.pouch`; a list keeps the model open for a second item quest. Chosen: list.
6. **Quest item as a real bag item** (`kind: "quest"`): full-bag problem returns, and every item validator (`ITEM_KEYS`, `rollableOk`) must learn a new kind. Rejected.
7. **Re-pin vs exclude the golden:** section 11.
8. **Hand-in refusal vs drop on the floor / partial grant** (QF-12-2): atomic refusal is the simplest to test and cannot lose an item. Chosen.
9. **Elevator choice or quest-floor redirect** for QF-12-3: scope and behaviour change. Rejected for this round.

## Consequences

- New files: `src/core/content/quests.js`, `src/core/systems/quests.js`, `src/core/systems/questview.js`, `bot/quests.js`; new test files named in `docs/reviews/R7-contract.md`.
- Edited core files: `events.js` (tap, 3 lines), `state.js` (`quests`, `player.pouch`, `makeMonster` options), `config.js` (`saveVersion` 4, `quests`), `systems/world.js` (one call in `enterFloor`), `systems/loot.js` (`takeGround` quest branch), `systems/intent.js` (command hook in `itemCommand` default, the `storyRead` whitelist), `cheats.js` (`setQuestStep`, `completeQuest`), `hash.js` (`hashStateWithout`), `index.js` (exports, `snapshot` additions). `generateFloor` and every file under `gen/` stay as they are.
- Save v4 and the slot index: ADR-0006 amendment "R7 quests".
- Test goldens change once (section 11). New core events: `quest.accepted`, `quest.step`, `quest.completed`, `quest.item`, `quest.pinned`, `quest.progress`, `quest.handInRefused`; every consumer table is in the contract (audio, text keys, snapshot, hook list, key table, ground-entry consumers).
- Residual risks: (1) the new champion on floor 4 must be beatable by the bot classes (balance gate); (2) the bot's walk up to the Lobby adds game time; (3) the ground entry without `item` meets code written for `item` entries (the contract lists every reader); (4) the cycle `events.js <-> quests.js` is benign but a future bundler change that evaluates module bodies eagerly would matter (nothing in the cycle runs at import time); (5) a deep migrated character gets level-4 gear (accepted).

## Feasibility check (owning package, L-026)

Read and confirmed on 2026-10-14; the owning package re-confirms by test before relying on each line:
- Tap in `emit`: `emit` is the only writer of `state.events` (`grep "events.push"` finds only `events.js`); `killMonster` sets `m.ai = "dead"` before `emit(kill)`; `enterFloor` sets `state.depth` before `emit(floorEnter)`. **CORE-R7Q** checks by a test that a `cheat.teleportFloor` made while paused moves the main step.
- `placeQuestObjects` needs `getCtx(state).grid`, `state.floor.rooms`, `floor.spawns`, `floor.entry/exit`: all present on generated, fallback and arena floors (arena has no rooms list use: hook returns early for depth >= `config.bossDepth` and for `floor.custom`).
- `spawnMonster` forwards `opts` to `makeMonster`; the three new options are read there. A prepared test floor (`floor.custom`) gets no quest objects.
- Reward placement: `autoplace`/`findSpot` are pure on a grid copy; potions and gear use `mint` so ids are fresh (`nextItemId`).
- `storyRead` before the live gate: `applyInput` has the same pattern for `setName` (R5 fix, CR-10).
- Stairs up exist on every floor 1 to 8 and `takeStairs(up)` calls `enterFloor(d - 1, {at: "exit"})`.
- Save: `check()`/`schemaProblem` strictness and `migrate` chain are detailed in the ADR-0006 amendment; feasibility owner **CORE-R7Q** (save part).
- Render and UI readers of ground entries: see the consumer table in the contract; owners **WORLD-R7Q** (`render/fx.js`, `render/world.js`) and **UI-R7Q** (`game.js` hover) confirm they tolerate an entry without `item`.

## Questions for the customer (L-05)

None block the design; all are content or scope and escalated by the spec already: (1) three side quests or more, (2) the working titles and the six step lines, (3) whether quests should hand out gear (the pacing tool for the floor 5 step) or only gold and experience. The design fits each answer: more quests are content plus `sideCount`, new text is `content/quests.js` only, gold-only rewards are `reward.gear` removed.
