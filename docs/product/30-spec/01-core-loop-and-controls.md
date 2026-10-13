# 01 Core loop and controls

Areas: A Core loop and controls (R-001..R-006), NFR-A01 and NFR-A02 (keys, pause).
Test surfaces and field names: see `10-tech-and-testability.md` ("Test contract").

### R-001 Playable game in a desktop browser (must · MVP)

- **AC-R-001-1** `S1` `E2E` — Given the built game opened with `?test=1&seed=1`, When `newGame({seed:1})` is called and `step(120)`, Then `scene === 'floor'`, `tick === 120`, `player.hp > 0` and the game has not thrown (no page error).
- **AC-R-001-2** `S1` `E2E` — Given the title screen, When a user clicks the visible "New game" control (found by role/text from the string table), Then `scene` becomes `floor` (S1) or `town` (S2 onward, see AC-R-004-1).

### R-002 Hack-and-slash action-RPG in the spirit of the original (must · MVP)

R-002 is an intent. It is tested through its concrete parts: real-time (R-020), click-to-move (R-005), monsters (R-030..R-034), loot (R-050..R-052). The criteria below only pin the two properties not covered elsewhere.

- **AC-R-002-1** `S1` `E2E` — Given a hostile monster within its notice range and the player given no input, When `step(60)`, Then at least one of these changed without any input: the monster's `tile`, the monster's `ai`, or `player.hp` (the world is real-time, not turn-based).
- **AC-R-002-2** `S2` `E2E` — Given a fresh game, When the run loop is played via commands (descend, kill a monster, pick up a drop, equip it), Then every step needs only mouse clicks and the documented keys (no text input), shown by the flow in AC-R-004-1.

### R-003 Office environment setting (must · MVP)

R-003 is an umbrella; it is satisfied when R-100, R-101 and R-102 pass.

- **AC-R-003-1** `S1` `E2E` — Given a new game, When the floor snapshot is read, Then `floor.theme` is one of the office themes registered in `content.themes` (S1: `open-plan`; S2: also `lobby`, `basement`).
- **AC-R-003-2** `S2` `E2E` — Given a new game, When the town is entered, Then `floor.theme === 'lobby'` (see AC-R-100-1).

### R-004 Core loop: town, descend, fight, loot, return, upgrade, descend deeper (must · MVP)

- **AC-R-004-1** `S2` `E2E` — Given `newGame({seed:7})`, When the scripted sequence runs: (1) `scene === 'town'` and `depth === 0`; (2) click the town stairs-down tile; (3) at `depth === 1` kill one monster via `cmd.attack`; (4) click the dropped item or gold; (5) click the floor's up stairs; Then the states are in order: `depth` 0, then 1, `player.xp` greater than at start, `inventory.items.length` increased by 1 or `player.gold` increased, and finally `depth === 0` with `scene === 'town'`.
- **AC-R-004-2** `S2` `E2E` — Given the player in town with gold at least the price of the cheapest vendor weapon that raises `damage.max`, When the player buys and equips it (AC-R-057-1, AC-R-053-2), Then `player.damage.max` is higher than before.
- **AC-R-004-3** `S2` `E2E` — Given the player on the exit stairs of floor n (n < boss depth), When the stairs tile is clicked and the player arrives, Then `depth === n+1`, `deepestDepth >= n+1`, and `player.tile` equals the new `floor.entry`.
- **AC-R-004-4** `S2` `E2E` — Given `deepestDepth === 3` and the player back in town, When the player takes the town stairs down, Then the arrival depth equals `config.townStairsTarget` (QF-01-1; default proposal: `deepestDepth`).

### R-005 Mouse-driven controls (must · MVP)

- **AC-R-005-1** `S1` `E2E` — Given the player at tile A and a floor tile B reachable from A, When `click({tile:B})` then `step(n)` for n large enough (path length x `config.moveTicksPerTile` + 5), Then `player.tile` equals B, `player.action === 'idle'`, and `player.path` is empty.
- **AC-R-005-2** `S1` `E2E` — Given a living monster M, When `click({tile:M.tile})`, Then `player.target === M.id`, and within `step(200)` either M's `hp` drops below its previous value or M is dead.
- **AC-R-005-3** `S2` `E2E` — Given a ground item I at tile T, When `click({tile:T})` and `step(200)`, Then the item is in `inventory.items` (or gold increased) and `groundItems` no longer contains I.
- **AC-R-005-4** `S2` `E2E` — Given a town NPC at tile T, When it is clicked and the player arrives, Then `ui.dialog` is non-null with `ui.dialog.npc === <that npc id>`.
- **AC-R-005-5** `S2` `E2E` — Given the secondary skill is a learned skill X and its target tile is in view, When `click({tile}, {button:2})`, Then skill X is used: `player.mp` decreases by X's mana cost (if any) and a corresponding `events` entry appears; the primary skill is not used.
- **AC-R-005-6** `S1` `E2E` — Given the left button is held (`hold:true`) at tile B, When the cursor is moved to tile C and `step(10)`, Then `player.path` ends at C (continuous move); and when a monster tile is the held target, the player keeps attacking until it dies or the button is released.
- **AC-R-005-7** `S1` `E2E` — Given a wall tile W, When `click({tile:W})`, Then `player.tile` never equals any non-walkable tile at any tick during `step(100)` and `events` contains `noPath` (or the path ends at the nearest reachable tile, see QF-01-2).
- **AC-R-005-8** `S1` `Unit` — Given a grid fixture with a wall line and one gap, When `findPath(grid, start, goal)` is called, Then every tile of the path is walkable, consecutive tiles are neighbours under `config.movement` rules, the first step is adjacent to start, the last tile is the goal, and the path length equals the length found by a reference breadth-first search in the test.
- **AC-R-005-9** `S1` `Unit` — Given a goal that is unreachable (enclosed), When `findPath` is called, Then it returns `null` and does so in under 50 ms on a 100x100 grid.
- **AC-R-005-10** `S2` `E2E` — Given panel hotkeys at their defaults, When `key('KeyC')`, `key('KeyI')`, `key('KeyS')` (or `KeyK`, QF-01-3), `key('KeyM')` / `key('Tab')` are pressed, Then `ui.panels.character`, `.inventory`, `.skills`, `.map` toggle respectively; a second press closes each.
- **AC-R-005-11** `S2` `E2E` — Given belt slot 1 holds a health potion, When `key('Digit1')`, Then the potion is used (AC-R-056-1). Whether keys 1-4 also trigger skills is open (QF-01-4); this AC asserts the belt only.

### R-006 Run length 20-40 minutes (should · MVP)

Not given an AC (not directly testable; QF-01-5).

### NFR-A01 Remappable keys (must)

- **AC-NFR-A01-1** `S3` `E2E` — Given default bindings, When the options screen rebinds action `inventory` from `KeyI` to `KeyB`, Then `key('KeyB')` toggles `ui.panels.inventory` and `key('KeyI')` does not.
- **AC-NFR-A01-2** `S3` `E2E` — Given the rebinding from AC-NFR-A01-1, When the page is reloaded (same browser context), Then `options.keys.inventory === 'KeyB'` and `key('KeyB')` still opens the panel (persisted).
- **AC-NFR-A01-3** `S3` `E2E` — Given a rebinding to a key already used by another action, When confirmed, Then the outcome follows QF-01-6 (proposal: rejected with `ui.notice` set and `options.keys` unchanged).
- **AC-NFR-A01-4** `S3` `E2E` — Given changed bindings, When "restore defaults" is chosen, Then `options.keys` deep-equals `config.defaultKeys`.
- **AC-NFR-A01-5** `S3` `E2E` — Given mouse bindings, When the options screen is listed, Then the mouse buttons are shown as fixed (not remappable in MVP).

### NFR-A02 Pause (must)

- **AC-NFR-A02-1** `S1` `E2E` — Given scene `floor` and a monster chasing the player, When `key('Escape')`, Then `paused === true`; after `step(100)` `tick`, every `monsters[i].tile` and `player.hp` equal their values before the call.
- **AC-NFR-A02-2** `S3` `E2E` — Given `paused === true`, When `audio.getState()` is read, Then `ctxState === 'suspended'` (or all buses gain 0 and no new cues in `cueLog`); after `key('Escape')` again, `paused === false`, the sim advances and audio resumes.
- **AC-NFR-A02-3** `S2` `E2E` — Given `paused === true`, When `key('KeyI')` is pressed, Then `ui.panels.inventory === true` and items can still be moved (AC-R-055-2), while `tick` does not change.
- **AC-NFR-A02-4** `S1` `Unit` — Given the whole spec, When the game's rules are scanned (config), Then there is no timed prompt: `config` contains no `timeout` for any input or dialog (no time-limited input).

## Not covered by an AC here

- R-006 (should; QF-01-5). R-007 (LATER, gamepad/touch).

## Questions for the facilitator

- **QF-01-1** R-004 says the player can "come back to the deepest reached floor" via stairs or portal. Does the town stairs-down go to floor 1 or to the deepest reached floor? (AC-R-004-4 uses `config.townStairsTarget`.)
- **QF-01-2** When the clicked tile is not reachable (wall), does the player stand still or walk to the nearest reachable tile?
- **QF-01-3** R-005 says "S/K" for the skill panel. One key or both? (Proposal: both bound by default.)
- **QF-01-4** R-005 lists "hotkeys for skills (1-4)" and R-056 puts potions on keys 1-4. These collide. Which keys do skills use? (Proposal: skills F1-F4 or Q/W/E/R; potions 1-4.)
- **QF-01-5** R-006 "meaningful in 20-40 minutes" has no measurable form. Proposal: the customer agent's headless bot reaches the boss in 20-40 minutes of simulated time (`tick / tickHz`) on seed 1; needs a bot and a balance pass. Accept as a release-gate measurement rather than an AC?
- **QF-01-6** What happens when a rebinding collides with an existing binding: reject, swap, or unbind the other?

## Coverage

<!--COVERAGE-->
