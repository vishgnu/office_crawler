# 02 Combat

Areas: C Combat (R-020..R-026). Contract: `10-tech-and-testability.md`.

### R-020 Real-time combat (must · MVP)

- **AC-R-020-1** `S1` `Unit` — Given a player and an adjacent hostile monster and no player input, When `step` is called `config.attackTicks + config.monsterAttackTicks` times, Then the monster has attacked at least once (an `events` entry of type `hit` or `miss` with `source === monster.id` exists in that window): combat advances per tick without waiting for player action.
- **AC-R-020-2** `S1` `Unit` — Given two monsters and the player, When `step` is called, Then entities are updated in a fixed order (by id) and the result is identical on two runs with the same seed (no wall-clock use in combat).
- **AC-R-020-3** `S1` `E2E` — Given `paused === true`, When `step(50)`, Then no combat event occurs (combat respects pause, AC-NFR-A02-1).

### R-021 Melee attack with swing animation and hit resolution (must · MVP)

- **AC-R-021-1** `S1` `E2E` — Given the player adjacent to a monster M (distance at most `config.meleeRange` tiles) and `player.target === M.id`, When `step(1)` repeatedly until `player.action === 'attack'`, Then `player.action` stays `'attack'` for exactly `config.attackTicks` ticks, then returns to `idle` (swing animation window) and exactly one hit-resolution event (`hit` or `miss`, `source === 'player'`) is emitted per swing, on tick `config.attackHitTick` of the swing.
- **AC-R-021-2** `S1` `Unit` — Given an attacker and a defender with fixed stats, When 10,000 swings are rolled with seeded RNG, Then the fraction of `hit` events is within 2 percentage points of `hitChance(attacker, defender)` as returned by the pure function.
- **AC-R-021-3** `S1` `Unit` — Given `hitChance(att, def)`, When attacker level and agility rise (def fixed), Then `hitChance` does not decrease; when defender defence rises (att fixed), it does not increase; and it always lies within `[config.hitChanceMin, config.hitChanceMax]` (QF-02-1).
- **AC-R-021-4** `S1` `Unit` — Given a hit with weapon damage range [lo, hi] and bonus b, When 10,000 hits are rolled, Then every damage value is an integer in `[lo+b, hi+b]`, the minimum and the maximum are both reached, and the monster loses exactly that value from `hp` (not below 0).
- **AC-R-021-5** `S1` `Unit` — Given a monster with `hp <= damage` is hit, When the hit resolves, Then `hp === 0`, `ai === 'dead'`, a `kill` event with `monster.id` is emitted exactly once, and `player.target === null` on the next tick.
- **AC-R-021-6** `S1` `Unit` — Given a dead monster, When `step` runs 100 more ticks, Then it deals no damage, does not move, and cannot be targeted (`cmd.attack(id)` returns `{ok:false}`).
- **AC-R-021-7** `S1` `Unit` — Given the same swing, When it misses, Then monster `hp` is unchanged and a `miss` event is emitted (no zero-damage hit).
- **AC-R-021-8** `S1` `Unit` — Given the player targets a monster that is out of melee range, When `step` runs, Then no hit resolution event occurs until the player is within `config.meleeRange`.

### R-022 Ranged and spell projectiles (must · MVP)

- **AC-R-022-1** `S2` `Unit` — Given the player with a learned projectile skill P with mana cost c and `mp >= c`, When P is used toward tile T, Then `projectiles` gains one entry with `owner === 'player'`, direction pointing toward T, and `mp` decreases by exactly c.
- **AC-R-022-2** `S2` `Unit` — Given a projectile of speed s tiles per tick, When `step(1)` runs, Then its `pos` moves by s along its direction; it is removed when it hits the first monster on its line (damage resolved like AC-R-021-4, one `hit` or `miss` event) or a wall tile (no damage), and never hits its owner or the owner's faction.
- **AC-R-022-3** `S2` `Unit` — Given `mp < c`, When P is used, Then no projectile is created, `mp` is unchanged and an `events` entry `noMana` is emitted.
- **AC-R-022-4** `S2` `Unit` — Given a ranged monster with a clear line of sight in range, When it attacks, Then a projectile with `owner === monster.id` is created using the same projectile code path (`step` handles both), and on reaching the player reduces `player.hp` by its damage (or emits `miss`).
- **AC-R-022-5** `S2` `Unit` — Given two monsters in line, When a player projectile is fired, Then only the nearer is hit (projectile consumed).

### R-023 Health and mana; death and respawn (must · MVP)

- **AC-R-023-1** `S1` `Unit` — Given `player.hp <= damage` of an incoming hit, When it resolves, Then `player.hp === 0`, `player.action === 'dead'` and on the same tick `scene === 'dead'`; `hp` is never negative and never above `hpMax`.
- **AC-R-023-2** `S1` `E2E` — Given `scene === 'dead'`, When the game-over screen is inspected, Then it shows a visible "restart" control, `tick` stops advancing under `step(100)` and no monster acts.
- **AC-R-023-3** `S1` `E2E` — Given `scene === 'dead'`, When the restart control is clicked, Then (S1) `scene === 'floor'`, `player.hp === player.hpMax` and `player.mp === player.mpMax` (QF-02-2), `player.tile === floor.entry`, and a new game is playable (AC-R-005-1 passes).
- **AC-R-023-4** `S2` `E2E` — Given the player died on floor n with gold g, level L, xp X and inventory I, When the restart control is clicked, Then `scene === 'town'`, `depth === 0`, `player.gold === g` (Q7: no gold loss), `level === L`, `xp === X`, inventory and equipment unchanged, and `hp === hpMax`. This supersedes AC-R-023-3 from S2.
- **AC-R-023-5** `S2` `Unit` — Given mana use and regeneration, When a skill costs more than `mp`, Then `mp` never goes below 0; `mp` never exceeds `mpMax` after a mana potion (AC-R-056-2).
- **AC-R-023-6** `S2` `E2E` — Given the player died holding items on the cursor (`cursorItem` set), When respawned, Then the item is back in the inventory (or on the town floor if full), not lost (edge case, QF-02-3).
- **AC-R-023-7** `S1` `Unit` — Given regeneration is configured (`config.regen`), When no damage is taken for `k` ticks, Then `hp` and `mp` change by exactly what `config.regen` states and never exceed their max (QF-02-4).

### R-024 Hit recovery, knock-back and monster stun (should · MVP)

- **AC-R-024-1** `S2` `Unit` — Given a monster is hit for damage at least `config.hitRecoveryMinDamage`, When `step` runs, Then its `ai` shows a stagger state for `config.hitRecoveryTicks` ticks in which it makes no attack and does not move.
- **AC-R-024-2** `S2` `Unit` — Given a knock-back hit and a free tile behind the monster, When resolved, Then the monster ends 1 tile further from the attacker; if the tile behind is a wall, the monster does not move.

### R-025 Damage feedback (should · MVP)

- **AC-R-025-1** `S2` `E2E` — Given a hit of value v on a monster, When the next snapshot is read, Then `floaters` contains `{value: v, tile: <monster tile>}` with remaining life `config.floaterTicks`, and it is removed after that many ticks.
- **AC-R-025-2** `S2` `E2E` — Given a hit, When read, Then the monster has `flashTicks > 0`; given a kill, the dead monster remains in `monsters` with `ai === 'dead'` for `config.deathTicks` ticks (death animation) and is then removed.
- **AC-R-025-3** `S3` `E2E` — Given the reduced-motion option on (NFR-A05), When a hit occurs, Then `options.reducedMotion === true` and screen shake amplitude in `ui.fx.shake` is 0.

### R-026 Elemental damage types and resistances (should · LATER)

LATER; only the stat exists in MVP. See AC-R-052-6 (affix with a resist stat changes `player.resist`). No combat AC.

## Not covered by an AC here

- R-026 elemental damage in combat (LATER). Hit-feel quality ("juice") is a visual judgement (QF-02-5).

## Questions for the facilitator

- **QF-02-1** The hit chance formula and its clamp bounds are not specified. Architect to define in ADR; spec asserts only monotonicity and bounds from `config`.
- **QF-02-2** Does the player respawn with full health and mana? (Q7 says "forgiving"; proposal: yes.)
- **QF-02-3** Edge case from circle 1 (dying with an item on the cursor): not in the requirements. Proposal given in AC-R-023-6; confirm or drop.
- **QF-02-4** Natural health/mana regeneration is not mentioned anywhere. Is there any? AC-R-023-7 is conditional on a decision.
- **QF-02-5** R-025 "feel" criteria (animation quality, readability) cannot be asserted in state. Accept screenshot review by the independent visual reviewer instead?

## Coverage

<!--COVERAGE-->
