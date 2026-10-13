# 04 World and floors

Areas: E World (R-040..R-048), J Office theme (R-100, R-101). Contract: `10-tech-and-testability.md`.

### R-040 Town hub, the Lobby (must · MVP)

- **AC-R-040-1** `S2` `E2E` — Given `newGame({seed:3})`, When the first scene loads, Then `scene === 'town'`, `depth === 0`, and `monsters` is empty.
- **AC-R-040-2** `S2` `E2E` — Given the player in town, When `step(3000)` runs and `cheat.spawnMonster` is not used, Then `monsters` stays empty and `player.hp` never decreases (no hostile can exist in town).
- **AC-R-040-3** `S2` `E2E` — Given the town snapshot, When read, Then it contains a stairs-down tile (`floor.exit` of kind `stairsDown`), and NPC entries for vendor, healer, potion seller and stash, each at a distinct walkable tile reachable from `player.tile`.
- **AC-R-040-4** `S2` `E2E` — Given the player clicks the stairs-down tile in town, When they arrive, Then `depth >= 1` and `scene === 'floor'`.
- **AC-R-040-5** `S2` `Unit` — Given `cheat.spawnMonster` is called while in town, When the call runs, Then it returns `{ok:false}` in normal logic (hostiles are rejected in town) (QF-04-1).

### R-041 Town NPCs: vendor, healer, potion seller, stash (must · MVP)

- **AC-R-041-1** `S2` `E2E` — Given each of the four NPCs, When it is clicked and the player arrives, Then `ui.dialog.npc` equals its id, the dialog has at least one line of text from the string table, and the matching panel opens (vendor: gear stock; potion seller: potion stock; stash: stash grid; healer: heal action).
- **AC-R-041-2** `S2` `E2E` — Given `player.hp < player.hpMax` and the healer dialog open, When the heal action is chosen, Then `player.hp === player.hpMax` (QF-04-2: cost and mana).
- **AC-R-041-3** `S2` `E2E` — Given `player.hp === player.hpMax`, When the heal action is chosen, Then nothing changes and no gold is deducted.
- **AC-R-041-4** `S2` `Unit` — Given the potion seller's stock, When read, Then it always contains at least one health potion and one mana potion item for sale at every strength tier allowed at the player's level (QF-04-3).
- **AC-R-041-5** `S2` `Unit` — Given the NPC registry, When names and dialogue are scanned, Then all are non-empty and not in the denylists (AC-NFR-L01-1, AC-NFR-L05-1).
- **AC-R-041-6** `S2` `E2E` — Given an NPC dialog is open, When the player walks farther than `config.interactRange` or presses `Escape`, Then `ui.dialog === null`.

### R-042 Procedurally generated dungeon levels (must · MVP)

- **AC-R-042-1** `S1` `Unit` — Given seeds 1..200 and depth 1 (S2: depths 1..8), When `generateFloor(seed, depth)` runs, Then the result has `w`, `h` within `config.floorSize`, exactly one entry tile and one exit tile of the right kinds, and tiles outside the playable area are walls.
- **AC-R-042-2** `S1` `Unit` — Given each generated floor, When a breadth-first search runs from `entry` over walkable tiles, Then `exit` is reached and every spawned monster, container and item lies on a reached tile (reachable by construction, validated).
- **AC-R-042-3** `S1` `Unit` — Given 200 different seeds at depth 1, When the layout hashes are computed, Then all 200 hashes are distinct; and given one seed generated twice, Then the outputs are deep-equal.
- **AC-R-042-4** `S1` `Unit` — Given `generateFloor` called 50 times, When the time is measured on the CI runner, Then each call takes under 500 ms (NFR-P03).
- **AC-R-042-5** `S1` `E2E` — Given two `newGame()` calls without a seed, When `floor.seed` is compared, Then they differ (every new game has a different layout).
- **AC-R-042-6** `S1` `Unit` — Given a floor, When `rooms` is read, Then it has at least `config.minRooms` rooms, rooms do not overlap and each is connected to the entry by a corridor or door (room-and-corridor on a tile grid).
- **AC-R-042-7** `S2` `Unit` — Given the generator fails validation on a candidate layout, When a seed is retried, Then the final result still satisfies AC-R-042-2 and generation still ends within the AC-R-042-4 time bound (no infinite retry; `config.maxGenAttempts`).

### R-043 Depth progression (must · MVP)

- **AC-R-043-1** `S2` `E2E` — Given a game, When `cheat.teleportFloor(d)` is called for d = 1..8, Then it succeeds for each, `floor.theme` is `open-plan` for d = 1..4 and `basement` for d = 5..8 (QF-04-4).
- **AC-R-043-2** `S2` `E2E` — Given the player on floor 8 (last floor), When the snapshot is read, Then there is no stairs-down tile and `cheat.teleportFloor(9)` returns `{ok:false}` (QF-04-5: boss on floor 8 or after it).
- **AC-R-043-3** `S2` `E2E` — Given the player descends from floor n to n+1 for the first time, When arrived, Then `deepestDepth === max(previous deepestDepth, n+1)`.
- **AC-R-043-4** `S2` `E2E` — Given each floor from 1 to 7, When the exit stairs tile is clicked, Then `depth` increases by 1; the up stairs at the entry tile decrease `depth` by 1 (floor 1 up leads to town).

### R-044 Floor persistence within a session (should · MVP)

- **AC-R-044-1** `S2` `E2E` — Given floor 2 visited with seed s2 and 3 monsters killed, When the player goes up and back down, Then `floor.seed === s2`, `floor.tiles` are identical, and the killed monsters are absent (cleared stay cleared) while the others are alive at their initial tiles.
- **AC-R-044-2** `S2` `E2E` — Given an item left on the ground of floor 2, When re-entered, Then whether it is still there follows QF-04-6 (proposal: lost, since only layout and cleared monsters persist).

### R-045 End boss on the last floor (must · MVP)

- **AC-R-045-1** `S3` `E2E` — Given `cheat.teleportFloor(config.bossDepth)`, When the snapshot is read, Then exactly one monster has `tier === 'boss'` and it stands on a walkable tile reachable from `entry` (working name "The Regional Director").
- **AC-R-045-2** `S3` `Unit` — Given the boss at full health, When its `hp / hpMax` falls to or below `config.boss.phase2At`, Then `phase` changes from 1 to 2 exactly once, its attack pattern id differs between phases, and it never returns to phase 1 (two phases, Q3).
- **AC-R-045-3** `S3` `Unit` — Given the boss is killed, When the kill resolves, Then `groundItems` gains at least `config.boss.guaranteedDrops` items, each with rarity rank at least `config.boss.minRarity` (rare unless QF-04-7 says otherwise), at the boss tile or adjacent free tiles.
- **AC-R-045-4** `S3` `E2E` — Given the boss is killed, When the snapshot is read, Then `bossDefeated === true` and `scene === 'victory'` within `config.victoryDelayTicks` ticks, and the victory screen shows story text (AC-R-104-1) and a visible "keep playing" control.
- **AC-R-045-5** `S3` `E2E` — Given the victory screen, When "keep playing" is chosen, Then `scene` is `floor` or `town` (QF-04-8), `bossDefeated` stays `true`, `player` and inventory unchanged, and the boss is not respawned on the same floor.
- **AC-R-045-6** `S3` `E2E` — Given the boss encounter, When the player dies, Then AC-R-023-4 applies (respawn in town) and the boss, if not yet dead, returns to full health and phase 1 on re-entry (QF-04-9).
- **AC-R-045-7** `S3` `Unit` — Given the boss's phase 1 and phase 2 attack patterns, When each is stepped for 300 ticks against a stationary player, Then each produces at least one attack event and the two patterns produce different event sequences.

### R-046 Waypoint / quick-return item (should · MVP)

- **AC-R-046-1** `S2` `E2E` — Given the player on floor 3 with one "Emergency Exit" item in the inventory, When it is used and the player steps through, Then `depth === 0`, the item count decreased by 1, and `portal` records `{floor:3}`.
- **AC-R-046-2** `S2` `E2E` — Given a recorded portal, When the player uses the town portal, Then `depth === 3`, `floor.seed` equals the earlier floor seed and cleared monsters are still cleared.
- **AC-R-046-3** `S2` `E2E` — Given no portal item, When `cmd.use` of a missing item id is called, Then `{ok:false}` and no state change.

### R-047, R-048 (LATER)

Not specified here.

### R-100 Town is the office lobby/break room (must · MVP)

- **AC-R-100-1** `S2` `E2E` — Given the town, When the snapshot is read, Then `floor.theme === 'lobby'` and `floor.name` is the string-table entry for the Lobby; the town `rooms` contain kinds `reception` and `breakroom` (QF-04-10).
- **AC-R-100-2** `S2` `E2E` — Given a screenshot of the town, When pixel-sampled at the NPC tiles, Then the NPC sprites are drawn (more than `config.minNpcPixels` non-background pixels per NPC tile) (smoke only; look is a visual review, QF-04-11).

### R-101 Dungeon levels are office floors, then basement/server rooms (must · MVP)

- **AC-R-101-1** `S1` `Unit` — Given floor 1 for seeds 1..50, When `rooms[i].kind` is read, Then every kind is in `{cubicle, conference, copy, storage, server}` and floor 1 uses at least 2 distinct kinds over the sample.
- **AC-R-101-2** `S2` `Unit` — Given depths 1..4 and 5..8 over 50 seeds each, When room kinds are read, Then depths 1..4 have `floor.theme === 'open-plan'` and depths 5..8 have `'basement'`, and the `server` kind appears on depths 5..8 in at least one seed and on none of depths 1..4 (QF-04-4).
- **AC-R-101-3** `S1` `E2E` — Given floor 1, When the tile list is read, Then walls and floor tiles carry a `style` taken from the theme's tileset and the tileset id equals `floor.theme`.

## Not covered by an AC here

- R-047, R-048 (LATER). The visual quality of the tilesets (look of cubicle maze etc.) is a visual review item (QF-04-11).

## Questions for the facilitator

- **QF-04-1** Is spawning a hostile in town a cheat-level concern? Proposal: cheats reject it (AC-R-040-5) to keep "no hostiles in town" an invariant.
- **QF-04-2** Does the healer cost gold? Restores mana as well? R-041 says only "restores health". Proposal: free, health only.
- **QF-04-3** Potion seller stock: which strengths per player level?
- **QF-04-4** Zone boundary and which room kinds belong to which zone: R-043/R-101 give floors 1-4 and 5-8 and five tilesets but no mapping. Proposal as in AC-R-101-2.
- **QF-04-5** R-043 says "8 floors then boss", R-045 says "boss on the last floor". Is the boss on floor 8 (proposal, `config.bossDepth = 8`) or a ninth boss arena?
- **QF-04-6** R-044: do ground items persist on a re-entered floor?
- **QF-04-7** "Guaranteed good loot": what is the minimum rarity and the number of items?
- **QF-04-8** After "keep playing", where does the player stand (town, or the boss floor)?
- **QF-04-9** Boss reset on death (not in the requirements).
- **QF-04-10** R-100 names no sub-areas of the Lobby; AC-R-100-1 proposes `reception` and `breakroom`.
- **QF-04-11** Visual identity of town and tilesets: decided by the art-direction variant pick; acceptance by independent visual review, not by state ACs.

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-040 Town hub, the Lobby (must · MVP) | R-040-1, R-040-2, R-040-3, R-040-4, R-040-5 | S2 | E2E, Unit |
| R-041 Town NPCs: vendor, healer, potion seller, stash (must · MVP) | R-041-1, R-041-2, R-041-3, R-041-4, R-041-5, R-041-6 | S2 | E2E, Unit |
| R-042 Procedurally generated dungeon levels (must · MVP) | R-042-1, R-042-2, R-042-3, R-042-4, R-042-5, R-042-6, R-042-7 | S1, S2 | E2E, Unit |
| R-043 Depth progression (must · MVP) | R-043-1, R-043-2, R-043-3, R-043-4 | S2 | E2E |
| R-044 Floor persistence within a session (should · MVP) | R-044-1, R-044-2 | S2 | E2E |
| R-045 End boss on the last floor (must · MVP) | R-045-1, R-045-2, R-045-3, R-045-4, R-045-5, R-045-6, R-045-7 | S3 | E2E, Unit |
| R-046 Waypoint / quick-return item (should · MVP) | R-046-1, R-046-2, R-046-3 | S2 | E2E |
| R-047 , R-048 (LATER) | none (see below) | - | - |
| R-100 Town is the office lobby/break room (must · MVP) | R-100-1, R-100-2 | S2 | E2E |
| R-101 Dungeon levels are office floors, then basement/server rooms (must · MVP) | R-101-1, R-101-2, R-101-3 | S1, S2 | E2E, Unit |

Total ACs in this file: 39 (S1 8, S2 24, S3 7).
