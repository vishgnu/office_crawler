# Requirements (working draft, circle 1)

Date: 2026-10-13. Owner: requirements-facilitator.

## Conventions
- **Status**: only the user's explicit words (`00-brief.md`, verbatim) are `agreed`. Everything else is `draft`.
- **Provenance**: OBSERVED = seen in evidence; INFERRED = derived from the brief or from known genre conventions; ASSUMED = my guess, needs an answer.
  Greenfield: there is no as-is model. "Genre knowledge" is recorded as INFERRED (from the brief's "stay close to the original"), not OBSERVED.
- **Scope**: MVP = first playable slice set; LATER = after MVP. Priority is must / should / could within that scope.
- Naming rule (claim G2): the original's names, art, text, music and story are never used. Refer to it only as "the original".
- Acceptance criteria are not written yet (Spec phase). Items marked "AC: pending" need them before leaving Circles.

## Summary

79 requirements: 68 MVP, 11 later. The count is above the 35-60 target because each HUD panel, slot type and testability hook is listed separately; the Spec phase may merge them.

| Area | MVP | Later |
|---|---|---|
| A Core loop and controls | 6 | 1 |
| B Character | 7 | 2 |
| C Combat | 6 | 1 |
| D Monsters and AI | 5 | 1 |
| E World | 7 | 2 |
| F Items and loot | 10 | 2 |
| G UI/HUD | 8 | 0 |
| H Audio | 3 | 1 |
| I Save/load | 3 | 1 |
| J Office theme and tone | 5 | 0 |
| K Tech | 4 | 0 |
| L Testability | 4 | 0 |

---

## A. Core loop and controls

### R-001 Playable game in a desktop browser
- Priority: must | Scope: MVP
- Source: brief (user, verbatim: "browser clone")
- Status: agreed | Provenance: OBSERVED (brief)
- Notes: details in K.

### R-002 Hack-and-slash action-RPG in the spirit of the original
- Priority: must | Scope: MVP
- Source: brief (user: "famous hack and slay", "stay close to the original")
- Status: agreed (intent); detail items below are draft | Provenance: OBSERVED (brief)
- Notes: "close" applies to mechanics and feel only (claim G2).

### R-003 Office environment setting
- Priority: must | Scope: MVP
- Source: brief (user: "in an office environment")
- Status: agreed | Provenance: OBSERVED (brief)
- Notes: see J.

### R-004 Core loop: town, descend, fight, loot, return, upgrade, descend deeper
- Priority: must | Scope: MVP
- Source: brief restatement; genre
- Status: draft | Provenance: INFERRED
- Notes: the player can return to town (via stairs or a portal item) and come back to the deepest reached floor.

### R-005 Mouse-driven controls
- Priority: must | Scope: MVP
- Source: brief ("stay close"); genre
- Status: draft | Provenance: INFERRED
- Notes: left click on ground = move; click on monster = attack; click on item = pick up; click on NPC/object = interact; right click = use the selected secondary skill. Hold button = continuous move/attack. Hotkeys for skills (1-4), potions (belt keys), panels (C, I, S/K, M/Tab), Esc = pause.

### R-006 Run length: a session is meaningful in 20-40 minutes
- Priority: should | Scope: MVP
- Source: ASSUMED (see circle-01 Q7)
- Status: draft | Provenance: ASSUMED

### R-007 Gamepad and touch support
- Priority: could | Scope: LATER
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED
- Notes: desktop mouse and keyboard only for MVP (see K, NFR).

## B. Character

### R-010 Selectable character class
- Priority: must | Scope: MVP
- Source: genre; circle-01 Q3
- Status: draft | Provenance: INFERRED
- Notes: MVP default: 1 playable class (melee). Two more classes (ranged, caster) LATER. Class names are original, office-flavoured (working: "Intern-turned-Enforcer" style, final names open).

### R-011 Four primary attributes
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: strength-like (damage, equipment requirement), dexterity-like (hit chance, defence), vitality-like (health), energy-like (mana). Original names: e.g. Grit, Agility, Stamina, Focus (working).

### R-012 Derived stats
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: max health, max mana, damage range, defence (armour), chance to be hit, resistances (see R-026).

### R-013 Experience and levelling
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: kills give experience; each level raises base health/mana, grants 5 attribute points to spend and 1 skill point. MVP level cap: 30 (draft number, see circle-01 Q3). Level-up restores health and mana.

### R-014 Skills: learn and upgrade with skill points
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: MVP: 1 basic attack + 4 active skills + 2 passives for the one class, each with levels 1..N. Skill choice from a small tree or list. Mana cost, cooldown or none (open, spec).

### R-015 Skill bar with assignable skills
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: primary (left-click) skill and secondary (right-click) skill, plus hotkey slots.

### R-016 Attribute point allocation UI with requirements preview
- Priority: should | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED

### R-017 Multiple classes with distinct skill sets
- Priority: should | Scope: LATER
- Source: genre; circle-01 Q3
- Status: draft | Provenance: INFERRED

### R-018 Respec (reset skill/attribute points)
- Priority: could | Scope: LATER
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED

## C. Combat

### R-020 Real-time combat
- Priority: must | Scope: MVP
- Source: brief restatement; genre
- Status: draft | Provenance: INFERRED

### R-021 Melee attack with swing animation and hit resolution
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: hit chance from attacker level/dexterity-like vs defender defence; damage = random within weapon range plus bonuses.

### R-022 Ranged and spell projectiles
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: at least one projectile skill in MVP, even for a melee class (e.g. thrown item) so that monster ranged attacks and projectiles are shared code.

### R-023 Health and mana; death and respawn
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: on death the player respawns in town, loses some gold (default: none lost, see Q), corpse-run is not required. Death penalty is an open decision.

### R-024 Hit recovery, knock-back and monster stun
- Priority: should | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED

### R-025 Damage feedback: floating numbers, hit flash, death animation
- Priority: should | Scope: MVP
- Source: genre feel
- Status: draft | Provenance: INFERRED

### R-026 Elemental damage types and resistances
- Priority: should | Scope: LATER
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: MVP has physical plus one or two element types in affixes (R-031) so the resistance stat exists.

## D. Monsters and AI

### R-030 Monster archetypes as office characters
- Priority: must | Scope: MVP
- Source: brief (office) + G2 (original names)
- Status: draft | Provenance: INFERRED
- Notes: MVP: 6-8 archetypes in 3 behaviours: melee swarmers, ranged attackers, tough "elites". Working names: Temp Worker, Middle Manager, Auditor, Printer Jam, Consultant, Rogue Vending Machine. Final names open to the user.

### R-031 Monster stats scale with depth
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: health, damage, defence, experience, loot quality rise per floor.

### R-032 Basic AI: idle, notice, chase, attack, flee (some types)
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: pathfinding on the tile grid (A*), line of sight, monsters in packs wake together.

### R-033 Champion/unique monsters with affixes
- Priority: should | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: rare "named" monsters with modifier(s) (fast, fire-resistant, extra health) and better drops. Generated names original.

### R-034 Monster population placed by level generator
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: packs and singles; difficulty budget by depth.

### R-035 Special-behaviour monsters (summoners, ranged support)
- Priority: could | Scope: LATER
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED

## E. World

### R-040 Town hub (the Lobby)
- Priority: must | Scope: MVP
- Source: brief restatement ("safe town hub")
- Status: draft | Provenance: INFERRED
- Notes: no hostile monsters, access to stairs down, vendors, healer, stash. Original layout and names.

### R-041 Town NPCs: vendor (gear), healer (restores health), potion seller, stash
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: NPCs are original characters with original names and short original dialogue.

### R-042 Procedurally generated dungeon levels
- Priority: must | Scope: MVP
- Source: brief restatement ("randomly generated dungeon levels")
- Status: draft | Provenance: INFERRED
- Notes: every new game (and each new floor visit) has a different layout; room-and-corridor on a tile grid; each floor has an entry stair and an exit stair; reachable by construction (validated).

### R-043 Depth progression
- Priority: must | Scope: MVP
- Source: brief restatement ("going deeper")
- Status: draft | Provenance: INFERRED
- Notes: MVP default: 8 floors in 2 themed zones (Floors 1-4 "Open Plan Floors", Floors 5-8 "Basement/Server Room"), then boss. Open: Q3.

### R-044 Floor persistence within a session
- Priority: should | Scope: MVP
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED
- Notes: default: each floor is regenerated on re-entry from its seed (same layout), cleared monsters stay cleared within the run.

### R-045 End boss on the last floor
- Priority: must | Scope: MVP
- Source: genre; circle-01 Q3
- Status: draft | Provenance: INFERRED
- Notes: single end boss (working: "The Regional Director"), multi-phase attack patterns, guaranteed good loot, victory screen, then "keep playing" mode.

### R-046 Waypoint / quick-return item
- Priority: should | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: a consumable portal ("Emergency Exit") to town and back to the same floor.

### R-047 Floor-specific mini-bosses and set pieces
- Priority: could | Scope: LATER
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED

### R-048 Additional difficulty levels (replay at higher difficulty)
- Priority: could | Scope: LATER
- Source: genre

## F. Items and loot
- Status: draft | Provenance: INFERRED

### R-050 Item drops from monsters and containers
- Priority: must | Scope: MVP
- Source: brief restatement ("loot with randomised properties")
- Status: draft | Provenance: INFERRED
- Notes: drops appear on the ground with a label; click to pick up; gold auto-collects on walk-over or click.

### R-051 Rarity tiers: normal, magic, rare, unique
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: distinguished by colour AND label style/icon border (NFR-A03, colour-blind safe). Uniques are original named items with fixed special properties (office-themed puns, original text).

### R-052 Random affixes (prefix/suffix) with value ranges
- Priority: must | Scope: MVP
- Source: brief restatement ("randomised properties")
- Status: draft | Provenance: INFERRED
- Notes: magic = 1-2 affixes, rare = 3-5. Affix pool filtered by item type and item level. Affix names are original. Seeded for determinism (L).

### R-053 Item types and equipment slots
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: slots: head, body, hands, feet, belt, weapon (main), off-hand (shield or second item), two rings, amulet. MVP can start with a subset (head, body, weapon, off-hand, ring x2, amulet) if spec shows cost; decision in Spec.

### R-054 Item requirements (level, attribute) and durability
- Priority: should | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: durability is "could"; a decision to drop it is allowed (circle-01 Q3 mentions scope).

### R-055 Inventory grid with differently sized items
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: 10x4 grid; items occupy 1x1 to 2x4 cells; drag to move; cursor-held item; swap.

### R-056 Belt with quick-use potion slots
- Priority: must | Scope: MVP
- Source: brief restatement ("health/mana potions")
- Status: draft | Provenance: INFERRED
- Notes: 4 slots, number keys 1-4 (rebindable). Health and mana potions in several strengths. Original item names ("Strong Coffee", "Energy Drink").

### R-057 Gold currency, buy and sell at vendors
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: vendor stock is generated per visit/seed; sell value derived from item; buy price higher than sell price.

### R-058 Identify unknown items
- Priority: could | Scope: LATER
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: MVP: all items are identified on pickup.

### R-059 Shared stash
- Priority: should | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: stash in town, persists across game sessions via save (I).

### R-060 Gambling, crafting, socketed gems
- Priority: could | Scope: LATER
- Source: genre
- Status: draft | Provenance: INFERRED

### R-061 Item comparison tooltip
- Priority: should | Scope: MVP
- Source: genre feel
- Status: draft | Provenance: INFERRED
- Notes: hover shows stats; equipped item compare.

## G. UI/HUD

### R-070 Health and mana orbs-equivalent in the HUD
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: shown as original-looking gauges (working: two office-themed vessels, e.g. a coffee cup and a water cooler jug), not the original's orb art.

### R-071 Skill bar and belt on the HUD
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED

### R-072 Character panel (stats, level, points)
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED

### R-073 Inventory and equipment panel
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED

### R-074 Skill panel
- Priority: must | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED

### R-075 Minimap / automap overlay
- Priority: should | Scope: MVP
- Source: genre
- Status: draft | Provenance: INFERRED
- Notes: reveals as explored; toggle with key.

### R-076 Main menu, pause menu, options, game over/victory screens
- Priority: must | Scope: MVP
- Source: INFERRED standard game flow; accessibility needs pause (NFR-A04)
- Status: draft | Provenance: INFERRED

### R-077 Monster health bar on target, experience bar
- Priority: should | Scope: MVP
- Source: genre

## H. Audio
- Status: draft | Provenance: INFERRED

### R-080 Sound effects for core actions
- Priority: should | Scope: MVP
- Source: genre feel
- Status: draft | Provenance: INFERRED
- Notes: attack, hit, death, pickup, UI click, level up, potion, town ambience. All synthesised in code or CC0-free generated; no third-party samples (NFR-L01). Decision: Q5.

### R-081 Background music
- Priority: could | Scope: MVP
- Source: genre; Q5
- Status: draft | Provenance: INFERRED
- Notes: original, procedural or short loops; default: ambient generative tracks per zone.

### R-082 Volume controls and mute
- Priority: must | Scope: MVP
- Source: ASSUMED standard; NFR-A
- Status: draft | Provenance: ASSUMED
- Notes: sound and music volume sliders plus mute, persisted in options.

### R-083 Positional/stereo audio, voice lines
- Priority: could | Scope: LATER
- Source: ASSUMED

## I. Save/load
- Status: draft | Provenance: ASSUMED

### R-090 Save character and progress in the browser
- Priority: must | Scope: MVP
- Source: genre; Q4
- Status: draft | Provenance: INFERRED
- Notes: character, stats, skills, inventory, equipment, stash, belt, deepest floor, boss defeated flag, options. Local browser storage; versioned format.

### R-091 Autosave on leaving a floor, at town, and on exit
- Priority: must | Scope: MVP
- Source: Q4
- Status: draft | Provenance: ASSUMED
- Notes: the current floor mid-state is not saved in MVP (resume in town / floor entry). Open: Q4.

### R-092 Single character slot (MVP), export/import of save as a file
- Priority: should | Scope: MVP
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED
- Notes: export/import protects against browser data loss (NFR-D). Multiple character slots LATER.

### R-093 Multiple character slots
- Priority: could | Scope: LATER
- Source: genre

## J. Office theme and tone
- Status: draft | Provenance: INFERRED

### R-100 Town is the office lobby/break room
- Priority: must | Scope: MVP
- Source: brief (office)
- Status: draft | Provenance: INFERRED

### R-101 Dungeon levels are office floors, then basement/server rooms
- Priority: must | Scope: MVP
- Source: brief (office)
- Status: draft | Provenance: INFERRED
- Notes: tilesets: cubicle maze, conference rooms, copy rooms, storage, server room.

### R-102 Original names, text and story throughout
- Priority: must | Scope: MVP
- Source: claim G2; harness rule 06
- Status: draft | Provenance: INFERRED
- Notes: includes game title (working title "Office Crawler" is generic; Q1 legal check), item names, NPCs, monsters, quest text, UI wording.

### R-103 Tone: light dark-comedy satire of office life; no real brands, companies or people
- Priority: should | Scope: MVP
- Source: ASSUMED; tone is a user decision (circle-01 Q2 option)
- Status: draft | Provenance: ASSUMED
- Notes: weapons and loot as office objects (stapler, letter opener, chair leg), violence stylised, no gore by default. Rating target: suitable for teens/adults, no real-world offensive content.

### R-104 Short original story frame
- Priority: should | Scope: MVP
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED
- Notes: 3-5 lines of text at start, boss, victory. No retelling of the original's story.

## K. Tech

### R-110 Runs in current desktop browsers without install
- Priority: must | Scope: MVP
- Source: brief ("browser"); NFR
- Status: agreed (browser part); rest draft | Provenance: OBSERVED / INFERRED

### R-111 Static, single self-contained build (one HTML file or one folder, no server needed)
- Priority: should | Scope: MVP
- Source: ASSUMED; helps hosting and agent testing; not yet a question, falls out of ADR on stack
- Status: draft | Provenance: ASSUMED
- Notes: "if feasible"; works when opened as a file or from any static host.

### R-112 Render with HTML5 canvas (2D) in the browser; no plug-ins
- Priority: must | Scope: MVP
- Source: ASSUMED; links to art direction Q1/Q2
- Status: draft | Provenance: ASSUMED
- Notes: framework choice belongs to the architect (ADR).

### R-113 Fixed-timestep simulation separate from rendering
- Priority: must | Scope: MVP
- Source: needed for determinism and testing (L)
- Status: draft | Provenance: INFERRED

## L. Testability

### R-120 Deterministic seed mode
- Priority: must | Scope: MVP
- Source: harness testing needs; G5
- Status: draft | Provenance: INFERRED
- Notes: one seed (URL parameter or option) fixes dungeon layout, monster placement, drops and combat rolls. Same seed + same inputs = same state.

### R-121 Automation hook for agents (read game state, send inputs, step time)
- Priority: must | Scope: MVP
- Source: brief ("agent play my role"); G3/G5
- Status: draft | Provenance: INFERRED
- Notes: a documented `window` API in test mode: get state (JSON), issue commands (move to tile, attack, use item), advance N ticks. Disabled or inert in normal play is acceptable.

### R-122 Headless simulation mode (no rendering) for fast tests
- Priority: should | Scope: MVP
- Source: R-113
- Status: draft | Provenance: INFERRED

### R-123 Debug cheats available only in test mode (spawn item, set level, teleport floor)
- Priority: should | Scope: MVP
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED
