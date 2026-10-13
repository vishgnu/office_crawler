# 06 Character and progression

Areas: B Character (R-010..R-018). Contract: `10-tech-and-testability.md`. Attribute names Grit, Agility, Stamina, Focus are working names (state keys `grit, agility, stamina, focus`).

### R-010 Selectable character class (must · MVP)

- **AC-R-010-1** `S1` `Unit` — Given `content.classes`, When read in MVP, Then it holds exactly 1 playable class, melee, with a non-empty original name not in the denylists.
- **AC-R-010-2** `S1` `Unit` — Given `newGame(seed, {class: content.classes[0].id})`, When the player is read, Then `level === 1`, `xp === 0`, `hp === hpMax > 0`, `mp === mpMax > 0`, `gold === config.startGold`, attributes equal the class's start values, and `damage.min` and `damage.max` are positive with `min <= max`.
- **AC-R-010-3** `S1` `Unit` — Given `newGame(seed)` with no class argument, When called, Then it uses the only class (the default).
- **AC-R-010-4** `S2` `E2E` — Given the title screen, When "New game" is chosen, Then either a class selection is shown with the single class preselected, or the game starts directly with it (QF-06-1).

### R-011 Four primary attributes (must · MVP)

- **AC-R-011-1** `S1` `Unit` — Given a new player, When `attrs` is read, Then it has exactly the keys `grit, agility, stamina, focus`, all integers at least 1.
- **AC-R-011-2** `S1` `Unit` — Given each attribute is increased by 1 (all else fixed), When derived stats are recomputed, Then grit raises `damage.min`/`damage.max` and gear requirement checks; agility raises `defense` and `hitChance`; stamina raises `hpMax`; focus raises `mpMax` (each strictly increases the stated stat and changes no other derived stat, except where the formula lists it).
- **AC-R-011-3** `S2` `E2E` — Given the character panel, When opened, Then the four attributes are shown by their string-table names with their values.

### R-012 Derived stats (must · MVP)

- **AC-R-012-1** `S1` `Unit` — Given attributes and level, When `deriveStats(player)` is called, Then `hpMax = config.derived.hpBase + level*config.derived.hpPerLevel + stamina*config.derived.hpPerStamina` and the analogous formulas hold for `mpMax` (focus), `damage` (grit, weapon), `defense` (agility, armour); the function is pure and rounds as `config.derived.rounding` states.
- **AC-R-012-2** `S1` `Unit` — Given `deriveStats`, When any equipment is empty, Then `damage` equals the unarmed range `config.unarmed` plus attribute bonus.
- **AC-R-012-3** `S1` `Unit` — Given hpMax rises (e.g. stamina +1), When applied, Then `hp` is unchanged (not auto-filled) unless the rise comes from a level-up (AC-R-013-3), and `hp <= hpMax` always holds.
- **AC-R-012-4** `S2` `Unit` — Given `player.resist`, When the player has no gear, Then it has the keys defined in `config.damageTypes` all equal to 0; with a +15 fire-resist affix equipped it is 15 for fire (see AC-R-052-6).
- **AC-R-012-5** `S2` `Unit` — Given "chance to be hit", When `hitChance(monster, player)` is computed, Then it decreases when `player.defense` rises (links AC-R-021-3).

### R-013 Experience and levelling (must · MVP)

- **AC-R-013-1** `S2` `Unit` — Given a monster M of type T at depth d killed by the player, When the kill resolves, Then `player.xp` increases by exactly `monsterStats(T, d).xp` (once, even if several hits land in the same tick).
- **AC-R-013-2** `S2` `Unit` — Given `config.xpTable`, When read, Then it has `config.levelCap` (30) thresholds, strictly increasing, with level 1 at 0.
- **AC-R-013-3** `S2` `Unit` — Given a kill that lifts xp across the threshold for level L+1, When resolved, Then `level === L+1`, `attrPoints` increases by exactly 5, `skillPoints` increases by exactly 1, `hpMax` and `mpMax` are higher than before (base health and mana rise per level, attributes unchanged), `hp === hpMax`, `mp === mpMax`, and a `levelup` event is emitted once.
- **AC-R-013-4** `S2` `Unit` — Given a single kill awarding xp that crosses two thresholds, When resolved, Then `level` rises by 2, `attrPoints` by 10, `skillPoints` by 2, and two `levelup` events or one with `levels: 2` are emitted.
- **AC-R-013-5** `S2` `Unit` — Given `level === 30`, When more xp is gained, Then `level` stays 30, `attrPoints` and `skillPoints` do not change, and `xp` does not overflow its type (capped at `xpTable[29]` or continues counting by `config.xpPastCap`, QF-06-2).
- **AC-R-013-6** `S2` `E2E` — Given `cheat.setLevel(5)`, When `getState()` is read, Then `level === 5`, `xpNext === xpTable[5]`, and `attrPoints`/`skillPoints` equal the points granted for levels 2..5 (20 and 4) minus spent points.

### R-014 Skills: learn and upgrade with skill points (must · MVP)

- **AC-R-014-1** `S2` `Unit` — Given `content.skills`, When read in MVP, Then it holds exactly one basic attack, four active skills and two passive skills, each with an original name, `maxLevel` at least 2 (`config.skillMaxLevel`), and all in the denylists-free string table.
- **AC-R-014-2** `S2` `Unit` — Given `skillPoints >= 1` and skill X at level k < maxLevel, When "learn/upgrade X" is used, Then `skills[X] === k+1` and `skillPoints` decreases by 1.
- **AC-R-014-3** `S2` `Unit` — Given `skillPoints === 0`, When upgrade is attempted, Then it is rejected; `skills` and `skillPoints` are unchanged.
- **AC-R-014-4** `S2` `Unit` — Given a skill at `maxLevel`, When upgrade is attempted, Then it is rejected and no point is spent.
- **AC-R-014-5** `S2` `Unit` — Given an active skill X, When its level rises, Then its effect value (damage or area, per `content.skills[X].perLevel`) is non-decreasing and strictly higher at maxLevel than at level 1; its mana cost is as `content.skills[X].mana(level)`.
- **AC-R-014-6** `S2` `Unit` — Given a passive skill at level k, When learned, Then the matching derived stat changes by `content.skills[P].perLevel * k` (for example +defence), and removal is not possible without respec (R-018 LATER).
- **AC-R-014-7** `S2` `Unit` — Given an unlearned skill (level 0), When used (hotkey/click), Then it does nothing and emits no cost.
- **AC-R-014-8** `S2` `Unit` — Given a skill with cooldown or mana cost, When used, Then `mp` falls by the cost; cooldown behaviour follows the decision in QF-06-5 (cooldown vs. none).
- **AC-R-014-9** `S2` `Unit` — Given one of the four actives is a projectile skill, When used, Then AC-R-022-1 applies (shared projectile code).

### R-015 Skill bar with assignable skills (must · MVP)

- **AC-R-015-1** `S2` `E2E` — Given a learned active skill X, When assigned to the primary slot via the skill panel/bar, Then `skillBar.primary === X`, and a left-click on a monster uses X (effect as for X: mana spent, damage dealt).
- **AC-R-015-2** `S2` `E2E` — Given X assigned to secondary, When right-click on a tile, Then X is used (AC-R-005-5).
- **AC-R-015-3** `S2` `E2E` — Given hotkey slots `skillBar.hotkeys[0..3]` assigned, When the corresponding keys (per QF-01-4) are pressed, Then the assigned skill is used.
- **AC-R-015-4** `S2` `Unit` — Given an unlearned skill, When assignment is attempted, Then it is rejected; the basic attack is always assignable and is the default primary.
- **AC-R-015-5** `S3` `E2E` — Given skill-bar assignments, When saved and reloaded (AC-R-090-1), Then `skillBar` is deep-equal.

### R-016 Attribute point allocation UI with requirements preview (should · MVP)

- **AC-R-016-1** `S2` `E2E` — Given `attrPoints >= 1`, When the "+" control of attribute A in the character panel is clicked, Then `attrs[A]` increases by 1, `attrPoints` decreases by 1, and derived stats are recomputed (AC-R-011-2).
- **AC-R-016-2** `S2` `E2E` — Given `attrPoints === 0`, When "+" is clicked, Then nothing changes and the controls are disabled (`ui` flag `disabled`).
- **AC-R-016-3** `S2` `E2E` — Given an item in the inventory with attribute requirements not yet met, When the panel is open, Then the preview marks the item as unmet and shows the missing amount (QF-06-6: what "requirements preview" shows).

### R-017 Multiple classes (should · LATER), R-018 Respec (could · LATER)

LATER, no AC.

## Not covered by an AC here

- R-017, R-018 (LATER). Class names are open (QF-06-1). The exact meaning of the preview in R-016 (QF-06-6) is open; only the point-spending part is covered.

## Questions for the facilitator

- **QF-06-1** Is there a class selection screen when only one class exists? Final class name is open to the user.
- **QF-06-2** Behaviour of xp at level cap (stop counting, or count for display).
- **QF-06-3** Experience for kills by non-player causes: not in the requirements; no AC written.
- **QF-06-4** Level-difference scaling of xp: not specified; no AC written (AC-R-013-1 assumes the table value).
- **QF-06-5** R-014 leaves "mana cost, cooldown or none" open ("spec"). Proposal: mana cost only, no cooldowns, for the four actives.
- **QF-06-6** R-016 "requirements preview": preview of what? Item requirements vs. the allocation, or the stat effect of the allocation?
- **QF-06-7** Skill tree vs. list ("small tree or list"): are there prerequisites? ACs assume none.
- **QF-06-8** Starting attributes, starting gold, starting gear, base hp/mana and per-level gains are not specified; `config` values.

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-010 Selectable character class (must · MVP) | R-010-1, R-010-2, R-010-3, R-010-4 | S1, S2 | E2E, Unit |
| R-011 Four primary attributes (must · MVP) | R-011-1, R-011-2, R-011-3 | S1, S2 | E2E, Unit |
| R-012 Derived stats (must · MVP) | R-012-1, R-012-2, R-012-3, R-012-4, R-012-5 | S1, S2 | Unit |
| R-013 Experience and levelling (must · MVP) | R-013-1, R-013-2, R-013-3, R-013-4, R-013-5, R-013-6 | S2 | E2E, Unit |
| R-014 Skills: learn and upgrade with skill points (must · MVP) | R-014-1, R-014-2, R-014-3, R-014-4, R-014-5, R-014-6, R-014-7, R-014-8, R-014-9 | S2 | Unit |
| R-015 Skill bar with assignable skills (must · MVP) | R-015-1, R-015-2, R-015-3, R-015-4, R-015-5 | S2, S3 | E2E, Unit |
| R-016 Attribute point allocation UI with requirements preview (should · MVP) | R-016-1, R-016-2, R-016-3 | S2 | E2E |
| R-017 Multiple classes (should · LATER) | none (see below) | - | - |

Total ACs in this file: 35 (S1 8, S2 26, S3 1).
