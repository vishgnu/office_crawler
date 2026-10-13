# 05 Items and loot

Areas: F Items and loot (R-050..R-061). Contract: `10-tech-and-testability.md`. All items are identified on pickup (R-058 LATER). No durability in MVP (Q3 PROXY answer).

### R-050 Item drops from monsters and containers (must · MVP)

- **AC-R-050-1** `S2` `Unit` — Given a seeded kill of monster M at tile T, When the kill resolves, Then `groundItems` gains zero or more entries at T or the nearest free walkable tiles, each with a non-empty `label` equal to the item `name`, and gold drops are separate entries `{gold: n}` with `n > 0`.
- **AC-R-050-2** `S2` `Unit` — Given 1,000 seeded kills at depth 1, When drops are counted, Then at least one drop occurs and not every kill drops an item (drop chance strictly between 0 and 1 per `config.dropChance`).
- **AC-R-050-3** `S2` `E2E` — Given a ground item I and a free inventory slot, When `click({tile:I.tile})` and `step(200)`, Then I is in `inventory.items` at a position that fits, `groundItems` no longer holds I, and an `events` entry `pickup` exists.
- **AC-R-050-4** `S2` `E2E` — Given a gold pile of n on the ground, When the player walks over its tile, Then `player.gold` increases by exactly n and the pile is removed; clicking the pile does the same after walking to it.
- **AC-R-050-5** `S2` `E2E` — Given the inventory has no space for item I (every placement fails), When the player clicks I, Then I stays on the ground, `inventory` is unchanged and an `events` entry `inventoryFull` is emitted; the player can still pick up gold.
- **AC-R-050-6** `S2` `E2E` — Given a container on the floor (`containers[i]`), When the player clicks it and arrives, Then it becomes opened (`opened === true`) once, its drops appear in `groundItems`, and clicking it again produces no further drops (QF-05-1: what containers exist).
- **AC-R-050-7** `S2` `Unit` — Given the same seed and kill list, When drops are rolled twice, Then they are identical (AC-R-120-5).

### R-051 Rarity tiers (must · MVP)

- **AC-R-051-1** `S2` `Unit` — Given 20,000 seeded rolls, When rarities are counted, Then all four of normal, magic, rare, unique occur, and the observed frequencies are ordered normal > magic > rare > unique.
- **AC-R-051-2** `S2` `Unit` — Given the rarity display table, When `ui` styles for the four rarities are read, Then each has a distinct label prefix or icon and a distinct border pattern (four pairwise-different values for `mark` and for `border`), independent of colour (NFR-A03).
- **AC-R-051-3** `S2` `E2E` — Given one ground item of each rarity on screen, When their `groundItems[i].label` data are read, Then `label.mark` and `label.border` are pairwise different, and the label colours are pairwise different.
- **AC-R-051-4** `S2` `Unit` — Given every unique item definition, When read, Then each has a unique original `name`, fixed properties with fixed values (rolling it twice gives equal affix lists), flavour text from the string table, and no name in the denylists.
- **AC-R-051-5** `S2` `Unit` — Given a unique that has already been picked up in this game, When another drop is rolled, Then uniqueness policy follows QF-05-2 (proposal: may drop again).

### R-052 Random affixes (prefix/suffix) with value ranges (must · MVP)

- **AC-R-052-1** `S2` `Unit` — Given 5,000 magic items, When `affixes.length` is counted, Then it is always 1 or 2 and both values occur; for 5,000 rare items it is always between 3 and 5 and each of 3, 4, 5 occurs; normal items have 0.
- **AC-R-052-2** `S2` `Unit` — Given any affix on a generated item, When read, Then `value` is an integer within `[range[0], range[1]]` of that affix definition, and over 5,000 rolls both bounds are reached.
- **AC-R-052-3** `S2` `Unit` — Given an item of type T and item level L, When affixes are rolled, Then every affix has `types` including T and `minIlvl <= L`; over 5,000 rolls no violation occurs.
- **AC-R-052-4** `S2` `Unit` — Given an item, When its affixes are read, Then no affix id appears twice and no two affixes modify the same stat group (QF-05-3: stat group definition).
- **AC-R-052-5** `S2` `Unit` — Given magic and rare items, When `kind` is read, Then each affix is a `prefix` or `suffix`, every name comes from the original affix name table and is not in the denylists, and the item name is built from them (magic: prefix and/or suffix name around the base; rare: generated original name).
- **AC-R-052-6** `S2` `Unit` — Given an equipped item with a resistance affix (for example +15 fire resist), When equipped, Then `player.resist.fire` increases by exactly that value and returns on unequip (stat exists although elemental combat is LATER).
- **AC-R-052-7** `S2` `Unit` — Given the same seed and context, When `rollItem` runs twice, Then the items are deep-equal.

### R-053 Item types and equipment slots (must · MVP)

- **AC-R-053-1** `S2` `E2E` — Given a new game, When `equipment` is read, Then its keys are exactly `head, body, hands, feet, belt, weapon, offhand, ring1, ring2, amulet` (full list, Q3), each `null`.
- **AC-R-053-2** `S2` `E2E` — Given a weapon in the inventory meeting its requirements, When the item is picked up and placed on the weapon slot (click item, click slot), Then `equipment.weapon` holds it, it is removed from `inventory`/`cursorItem`, and `player.damage` changes by exactly the item's damage contribution plus its affix bonuses.
- **AC-R-053-3** `S2` `E2E` — Given a ring is held, When it is placed on ring1 then another ring on ring2, Then both slots are filled; a third ring placed on a full pair swaps with the targeted ring slot.
- **AC-R-053-4** `S2` `E2E` — Given an item of slot type X held on the cursor, When it is placed on a slot of a different type Y, Then the placement is rejected: `equipment` unchanged and the item still on the cursor.
- **AC-R-053-5** `S2` `E2E` — Given an equipped item, When it is unequipped to the inventory, Then the derived stats return exactly to their pre-equip values; if the inventory has no space the unequip is rejected and the item stays equipped.
- **AC-R-053-6** `S2` `Unit` — Given body, head, hands, feet and belt items with defence values, When all are equipped, Then `player.defense` equals base defence plus the sum of item defence plus affix defence, in any equip order.
- **AC-R-053-7** `S2` `Unit` — Given a two-handed weapon (if any exist, QF-05-4), When equipped, Then offhand handling follows the decision.

### R-054 Item requirements (level, attribute) and durability (should · MVP)

- **AC-R-054-1** `S2` `Unit` — Given an item with `reqs.level = 10` and a level 5 player, When equip is attempted, Then it is rejected with `events` `reqNotMet` and `equipment` unchanged; at level 10 it is accepted. The same holds for each attribute requirement (grit, agility, stamina, focus).
- **AC-R-054-2** `S2` `Unit` — Given any item, When read, Then it has no `durability` field (dropped per Q3, PROXY).

### R-055 Inventory grid with differently sized items (must · MVP)

- **AC-R-055-1** `S2` `Unit` — Given a new game, When `inventory` is read, Then `w === 10`, `h === 4`, and every item type has size within 1x1 to 2x4 (`w` at most 2, `h` at most 4, both at least 1).
- **AC-R-055-2** `S2` `E2E` — Given an item at cell (x, y), When it is clicked (picked up to `cursorItem`) and then a free cell block is clicked, Then it is placed with its top-left at that cell, and `cursorItem === null`.
- **AC-R-055-3** `S2` `Unit` — Given a placement that would exceed the grid (for example a 2x4 item at x = 9), When attempted, Then it is rejected and the item stays on the cursor.
- **AC-R-055-4** `S2` `Unit` — Given a held item dropped onto a block overlapping exactly one placed item, When confirmed, Then the placed item is swapped onto the cursor and the held item is placed; given overlap with two or more items, the drop is rejected.
- **AC-R-055-5** `S2` `Unit` — Given a random sequence of 1,000 pick-up, place, swap and reject operations (seeded), When each result is checked, Then no two items ever overlap, all lie within the grid, and the multiset of items (inventory + cursor) is conserved.
- **AC-R-055-6** `S2` `Unit` — Given autoplace for pickups, When an item of size 2x4 is added to an inventory with a free 2x4 block elsewhere, Then it is placed at the first top-left-first fitting position; when no block fits, it fails (AC-R-050-5).

### R-056 Belt with quick-use potion slots (must · MVP)

- **AC-R-056-1** `S2` `E2E` — Given a health potion of strength s (restore value r) in belt slot 1 and `player.hp = hpMax - 2r`, When `key('Digit1')`, Then `player.hp` increases by exactly r (capped at `hpMax`), the potion is removed from the belt, and an `events` entry `potion` is emitted.
- **AC-R-056-2** `S2` `E2E` — Given a mana potion in slot 2 and `mp = mpMax - 2r`, When `key('Digit2')`, Then `player.mp` increases by r.
- **AC-R-056-3** `S2` `Unit` — Given an empty belt slot, When its key is pressed, Then nothing changes and no event.
- **AC-R-056-4** `S2` `Unit` — Given the registry, When potions are listed, Then health and mana potions each exist in at least 2 strengths with strictly increasing restore values, names from the original string table (for example "Strong Coffee", "Energy Drink" as working names) not in the denylists.
- **AC-R-056-5** `S2` `E2E` — Given `belt.length === 4`, When potions are dragged from the inventory to belt slots 1..4, Then they fill in order; a non-potion item dropped on the belt is rejected.
- **AC-R-056-6** `S2` `Unit` — Given a health potion used at full health, When the key is pressed, Then the outcome follows QF-05-5 (proposal: not consumed).
- **AC-R-056-7** `S3` `E2E` — Given the belt keys rebound in options (NFR-A01), When the new key is pressed, Then the same potion effect occurs and the old key does nothing.

### R-057 Gold currency, buy and sell at vendors (must · MVP)

- **AC-R-057-1** `S2` `E2E` — Given gold g at least the price p of a vendor item and a free inventory slot, When the player buys it, Then `player.gold === g - p`, the item is in the inventory, and it is removed from vendor stock.
- **AC-R-057-2** `S2` `E2E` — Given `g < p`, When buying is attempted, Then `gold` and the inventory are unchanged and an `events` entry `cannotAfford` is emitted.
- **AC-R-057-3** `S2` `E2E` — Given enough gold but no free inventory space, When buying is attempted, Then it is rejected with `inventoryFull` and gold is unchanged.
- **AC-R-057-4** `S2` `E2E` — Given an inventory item with sell value v, When sold, Then `gold` increases by exactly v and the item is removed from the inventory.
- **AC-R-057-5** `S2` `Unit` — Given 1,000 seeded items, When `buyPrice(item)` and `sellValue(item)` are computed, Then `buyPrice > sellValue` for every item, both are positive integers, and the functions are pure (same item, same value).
- **AC-R-057-6** `S2` `Unit` — Given items of the same base and level, When sell value is compared, Then value is non-decreasing in rarity rank and increases with the sum of affix values (derived from the item).
- **AC-R-057-7** `S2` `Unit` — Given the vendor generator with seed s and visit number n, When called twice, Then the stock is equal; with a different n or s it differs (stock generated per visit and seed).
- **AC-R-057-8** `S2` `Unit` — Given the player has an item on the cursor or equipped, When selling is attempted for an equipped item, Then it follows QF-05-6 (proposal: only inventory items can be sold).

### R-058 Identify unknown items (could · LATER)

LATER. One AC pins the MVP behaviour (everything is identified on pickup):

- **AC-R-058-1** `S2` `Unit` — Given any dropped item, When picked up, Then all its affixes are visible (`identified` is true or absent).

### R-059 Shared stash (should · MVP)

- **AC-R-059-1** `S2` `E2E` — Given the stash NPC dialog, When an item is moved from the inventory to the stash and back, Then `stash.items` and `inventory.items` change accordingly and item multiset is conserved.
- **AC-R-059-2** `S3` `E2E` — Given an item in the stash, When the game is saved and reloaded (AC-R-090-1), Then the stash contains the item.

### R-061 Item comparison tooltip (should · MVP)

- **AC-R-061-1** `S2` `E2E` — Given the pointer over an inventory item, When `getState().ui.tooltip` is read, Then it lists the name, rarity mark, requirements, and each affix as a text line with its value.
- **AC-R-061-2** `S2` `E2E` — Given the pointer over an item for slot X while another item is equipped in X, When the tooltip is read, Then it also contains the equipped item's comparison with the numeric difference per stat (for example "damage +3").

### R-060 Gambling, crafting, socketed gems (could · LATER)

Not in MVP.

## Not covered by an AC here

- R-058 beyond the MVP behaviour line; R-060 (LATER).

## Questions for the facilitator

- **QF-05-1** R-050 mentions "containers" but no container kind is defined in the requirements (breakable crates? filing cabinets?). Define kind and count per floor.
- **QF-05-2** Can a unique item drop twice in one game?
- **QF-05-3** What counts as "the same stat group" for affix exclusion?
- **QF-05-4** Are there two-handed weapons? How do they interact with the off-hand?
- **QF-05-5** Using a potion at full health: consumed or refused?
- **QF-05-6** Can equipped items be sold directly?
- **QF-05-7** Drop chances, rarity weights, price ratios (buy over sell) and potion values are not given; ACs refer to `config`. Balance owner?
- **QF-05-8** Visual quality of item labels and icons (readability) is a visual review item.

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-050 Item drops from monsters and containers (must · MVP) | R-050-1, R-050-2, R-050-3, R-050-4, R-050-5, R-050-6, R-050-7 | S2 | E2E, Unit |
| R-051 Rarity tiers (must · MVP) | R-051-1, R-051-2, R-051-3, R-051-4, R-051-5 | S2 | E2E, Unit |
| R-052 Random affixes (prefix/suffix) | R-052-1, R-052-2, R-052-3, R-052-4, R-052-5, R-052-6, R-052-7 | S2 | Unit |
| R-053 Item types and equipment slots (must · MVP) | R-053-1, R-053-2, R-053-3, R-053-4, R-053-5, R-053-6, R-053-7 | S2 | E2E, Unit |
| R-054 Item requirements (level, attribute) | R-054-1, R-054-2 | S2 | Unit |
| R-055 Inventory grid with differently sized items (must · MVP) | R-055-1, R-055-2, R-055-3, R-055-4, R-055-5, R-055-6 | S2 | E2E, Unit |
| R-056 Belt with quick-use potion slots (must · MVP) | R-056-1, R-056-2, R-056-3, R-056-4, R-056-5, R-056-6, R-056-7 | S2, S3 | E2E, Unit |
| R-057 Gold currency, buy and sell at vendors (must · MVP) | R-057-1, R-057-2, R-057-3, R-057-4, R-057-5, R-057-6, R-057-7, R-057-8 | S2 | E2E, Unit |
| R-058 Identify unknown items (could · LATER) | R-058-1 | S2 | Unit |
| R-059 Shared stash (should · MVP) | R-059-1, R-059-2 | S2, S3 | E2E |
| R-061 Item comparison tooltip (should · MVP) | R-061-1, R-061-2 | S2 | E2E |
| R-060 Gambling, crafting, socketed gems (could · LATER) | none (see below) | - | - |

Total ACs in this file: 54 (S1 0, S2 52, S3 2).
