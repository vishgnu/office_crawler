# 03 Monsters and AI

Areas: D Monsters and AI (R-030..R-035). Contract: `10-tech-and-testability.md`. Monster names below are working names from R-030.

### R-030 Monster archetypes as office characters (must · MVP)

- **AC-R-030-1** `S1` `Unit` — Given the monster registry, When it is read in S1, Then it holds at least 2 types, at least one with `behaviour === 'swarmer'`; each has `hpBase, damage, defense, xp, speed, sightRange` all greater than 0 and a non-empty unique `name`.
- **AC-R-030-2** `S2` `Unit` — Given the registry, When read in S2 and later, Then it holds between 6 and 8 types, and the set of `behaviour` values equals `{swarmer, ranged, elite}` with at least one type each.
- **AC-R-030-3** `S1` `Unit` — Given the registry, When every `name` is scanned, Then none appears in either denylist (AC-NFR-L01-1, AC-NFR-L05-1).
- **AC-R-030-4** `S2` `Unit` — Given the working-name list in R-030, When the registry is read, Then it contains types for the roles listed (a temp worker, middle manager, auditor, printer, consultant, vending machine) or the facilitator-approved replacements (QF-03-1).

### R-031 Monster stats scale with depth (must · MVP)

- **AC-R-031-1** `S2` `Unit` — Given a monster type T, When `monsterStats(T, depth)` is evaluated for depth 1 to 8, Then `hp`, `damage`, `defense` and `xp` are each non-decreasing with depth and strictly greater at depth 8 than at depth 1.
- **AC-R-031-2** `S2` `Unit` — Given kills at depth d, When items drop, Then the item level of the drop `ilvl >= config.ilvlForDepth(d)`, non-decreasing in d, and strictly greater at depth 8 than at depth 1.
- **AC-R-031-3** `S2` `Unit` — Given 5,000 seeded drops at depth 1 and 5,000 at depth 8, When the mean rarity rank (normal 0, magic 1, rare 2, unique 3) is computed, Then depth 8 is higher than depth 1 (loot quality rises).
- **AC-R-031-4** `S2` `E2E` — Given `cheat.teleportFloor(1)` then `(8)` with the same monster type present, When the snapshot is read, Then `monsters[i].hpMax` at depth 8 is greater than at depth 1.

### R-032 Basic AI: idle, notice, chase, attack, flee (must · MVP)

- **AC-R-032-1** `S1` `Unit` — Given a monster in `idle` and the player within `sightRange` with a clear line of sight, When `step(1..k)`, Then `ai` moves to `notice` and then `chase` within `config.noticeTicks`.
- **AC-R-032-2** `S1` `Unit` — Given the player within `sightRange` but a wall blocking the line of sight (fixture), When `step(100)`, Then the monster stays `idle` (line of sight is required).
- **AC-R-032-3** `S1` `Unit` — Given a chasing monster and a walkable path, When `step` runs, Then each tick it moves at most `speed` and only along walkable tiles, its path is found by A* on the tile grid (path length equals the BFS reference), and it ends adjacent to the player (melee types).
- **AC-R-032-4** `S1` `Unit` — Given a monster adjacent to the player, When `step`, Then `ai === 'attack'` and one attack resolves every `config.monsterAttackTicks` ticks (no faster).
- **AC-R-032-5** `S1` `Unit` — Given any number of monsters, When `step(500)` runs in a crowded fixture, Then no two living monsters ever occupy the same tile and none occupies a wall tile.
- **AC-R-032-6** `S2` `Unit` — Given a monster type with `canFlee` and `hp / hpMax < config.fleeHpFraction`, When `step`, Then `ai === 'flee'` and the distance to the player increases over the next 10 ticks; types without `canFlee` never enter `flee` (QF-03-2).
- **AC-R-032-7** `S1` `Unit` — Given a pack of monsters with the same `packId`, When one of them reaches `notice`, Then all pack members with `ai === 'idle'` are in `notice` or `chase` within `config.packWakeTicks` ticks; monsters of other packs stay idle.
- **AC-R-032-8** `S2` `Unit` — Given a ranged monster with a clear line of sight within range, When `step`, Then it stops moving and attacks with a projectile (AC-R-022-4) instead of closing to melee.
- **AC-R-032-9** `S1` `Unit` — Given the player dies (`scene === 'dead'`), When `step`, Then all monsters stop acting (no events with `source` a monster).
- **AC-R-032-10** `S1` `Unit` — Given a chase where the player is unreachable (enclosed fixture), When `step(200)`, Then the monster neither throws nor leaves the walkable region, and does not stall other monsters' updates (QF-03-3, leashing is not specified).

### R-033 Champion/unique monsters with affixes (should · MVP)

- **AC-R-033-1** `S2` `Unit` — Given 200 seeded floors, When monsters with `tier === 'champion'` are listed, Then each has between 1 and `config.championMaxMods` modifiers from the registry (for example fast, fire-resistant, extra health), a non-empty generated name not in the denylists, and `hpMax` greater than the normal type at the same depth when it has the extra-health modifier.
- **AC-R-033-2** `S2` `Unit` — Given 5,000 seeded kills each, When mean rarity rank of drops is compared, Then champions' mean is greater than normal monsters' mean (better drops, QF-03-4).

### R-034 Monster population placed by the level generator (must · MVP)

- **AC-R-034-1** `S1` `Unit` — Given `generateFloor(seed, depth)` for seeds 1..200 and depths in S1 (depth 1), When the monster list is read, Then it is non-empty, every monster stands on a walkable tile reachable from `floor.entry`, none stands on `entry` or `exit`, and no two share a tile.
- **AC-R-034-2** `S1` `Unit` — Given a floor, When monsters are grouped by `packId`, Then there is at least one pack (size at least 2) and, with `config.singlesAllowed`, may be singles; every member of a pack lies within `config.packRadius` tiles of the pack's first member.
- **AC-R-034-3** `S2` `Unit` — Given `generateFloor(seed, d)` for d in 1..8, When the sum of monster cost `config.cost[type] * tierFactor` is computed, Then it is at most `floor.budget`, `floor.budget` is non-decreasing in d and strictly greater at d = 8 than at d = 1.
- **AC-R-034-4** `S1` `Unit` — Given the same seed and depth, When generated twice, Then the monster lists (type, tile, packId) are deep-equal; with a different seed they differ.

### R-035 Special-behaviour monsters (could · LATER)

LATER, no AC.

## Not covered by an AC here

- R-035 (LATER). Visual identity of each archetype (readability, "office character" look) is a visual review item (QF-03-6).

## Questions for the facilitator

- **QF-03-1** Final monster names are open to the user (R-030). Until approved, AC-R-030-4 tests working names only.
- **QF-03-2** Which archetypes flee ("some types") and at what health fraction?
- **QF-03-3** Do monsters lose interest or have a leash radius? Not in the requirements; AC-R-032-10 only checks they do not break.
- **QF-03-4** "Better drops" for champions is unquantified; AC uses mean rarity only. Proposal: guaranteed at least magic rarity.
- **QF-03-5** A safe radius around the entry stair is not required but is a standard fairness rule. Add as a requirement? No AC written until decided.
- **QF-03-6** The 6 to 8 archetypes and 3 behaviours: which archetype is which behaviour, and how many are available per zone?

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-030 Monster archetypes as office characters (must · MVP) | R-030-1, R-030-2, R-030-3, R-030-4 | S1, S2 | Unit |
| R-031 Monster stats scale with depth (must · MVP) | R-031-1, R-031-2, R-031-3, R-031-4 | S2 | E2E, Unit |
| R-032 Basic AI: idle, notice, chase, attack, flee (must · MVP) | R-032-1, R-032-2, R-032-3, R-032-4, R-032-5, R-032-6, R-032-7, R-032-8, R-032-9, R-032-10 | S1, S2 | Unit |
| R-033 Champion/unique monsters with affixes (should · MVP) | R-033-1, R-033-2 | S2 | Unit |
| R-034 Monster population placed by the level generator (must · MVP) | R-034-1, R-034-2, R-034-3, R-034-4 | S1, S2 | Unit |
| R-035 Special-behaviour monsters (could · LATER) | none (see below) | - | - |

Total ACs in this file: 24 (S1 13, S2 11, S3 0).
