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

108 requirements: 97 MVP, 11 later (79 from circle 1 plus 29 in area M added 2026-10-14; R-010, R-014, R-017, R-018, R-074, R-092 and R-093 are superseded or promoted by area M, see its header). The count is above the 35-60 target because each HUD panel, slot type and testability hook is listed separately; the Spec phase may merge them.

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
| M Classes, skill trees, save slots (added 2026-10-14) | 29 | 0 |

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
- SUPERSEDED 2026-10-14 by R-200..R-215 (3 classes, customer's third briefing).
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
- SUPERSEDED in structure 2026-10-14 by R-202..R-205 (per-class trees).
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
- PROMOTED to MVP 2026-10-14: see R-200..R-208.
- Priority: should | Scope: LATER
- Source: genre; circle-01 Q3
- Status: draft | Provenance: INFERRED

### R-018 Respec (reset skill/attribute points)
- PARTLY PROMOTED 2026-10-14: skill respec is R-209; attribute respec stays LATER.
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
- BECOMES the skill-tree panel 2026-10-14: R-206.
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
- SUPERSEDED 2026-10-14 by R-220 (5 slots, customer's third briefing); export/import continues as R-226.
- Priority: should | Scope: MVP
- Source: ASSUMED
- Status: draft | Provenance: ASSUMED
- Notes: export/import protects against browser data loss (NFR-D). Multiple character slots LATER.

### R-093 Multiple character slots
- PROMOTED to MVP 2026-10-14: see R-220..R-227.
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
- Source: ASSUMED; links to art direction, circle-01 Q2
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

---

## M. Classes, skill trees and save slots (added 2026-10-14, circle 2)

Source of this area: the **third briefing** in `00-brief.md` (user, 2026-10-14, verbatim: "I want to have 3 player classes with skill trees. Also, make a visually appealing character selection screen. Add a save with 5 slots to the options menu"). Status `agreed` is used only where those words cover the item; everything else is `draft` with a proposed default in `circles/circle-02.md`.
Genre convention used for the drafts (INFERRED): three classes in a melee/heavy, ranged/agile and caster split; each class has its own tree of three branches (tabs); about ten skills per class; prerequisites and level gates; one skill point per level; a character-creation step with name and class.

**Supersedes (customer words win; no open conflict, the brief already records the override):**
- R-010 ("MVP default: 1 playable class") and circle-01 Q3 "1 class" (PROXY): now 3 classes (R-200).
- R-017 (multiple classes, LATER): promoted to MVP via R-200..R-208.
- R-014 ("1 basic attack + 4 active skills + 2 passives", "list" per QF-06-7 "list, no prerequisites"): replaced by per-class trees with prerequisites (R-202..R-205). The existing `clerk` content (Strike, Stapler Throw, Reply-All, Coffee Break, Mute, Dress Code, Hustle) is a design input, not a final class (see R-225).
- R-018 (respec, LATER): promoted, see R-209.
- R-092 ("single character slot") and circle-01 Q4 "one save slot" (PROXY): now 5 slots (R-220). R-093 (multiple slots, LATER): promoted and merged into R-220..R-227.
- R-074 (skill panel): becomes the skill-tree panel (R-206). QF-06-1 ("no class screen for one class") and QF-09-4 ("delete character keeps options") stay valid in spirit; see R-221.
- Open tension (not a conflict): R-013 gives 1 skill point per level and a level cap of 30, i.e. 29 points, while a class has about 10 skills with several levels each. The tree is therefore a "choose a build" tree, not "learn everything". Confirmed as default in Q2.

### Classes

### R-200 Three playable classes
- Priority: must | Scope: MVP
- Source: brief third briefing ("3 player classes")
- Status: agreed (number: 3); concepts, names and roles draft (circle-02 Q1) | Provenance: OBSERVED (brief) / INFERRED (genre)
- Notes: working roles: melee/heavy, ranged/agile, caster. Names are original office re-expressions, never the original's class names (R-102, NFR-L01). Final names ESCALATE for the brand check, as for the single class (QF-06-1).
- Testable as: `classes.length === 3`; each id is distinct; each is selectable at creation and playable from floor 1 to the boss.

### R-201 Class identity: attributes, growth, basic attack and weapon affinity
- Priority: must | Scope: MVP
- Source: genre (INFERRED); circle-02 Q4
- Status: draft | Provenance: INFERRED
- Notes: each class has its own starting values for the four primary attributes (R-011), per-level health/mana growth, a distinct basic attack (R-021/R-022) and a starting weapon. Numbers live in `config`/content (QF-05-7), not in code paths.
- Testable as: unit test that the three classes differ in starting attributes, growth and basic attack; a new character of each class has its own starting kit.

### R-202 Per-class skill tree with three branches
- Priority: must | Scope: MVP
- Source: brief ("skill trees"); genre for the structure
- Status: agreed (a skill tree per class); structure of 3 branches draft (circle-02 Q2) | Provenance: OBSERVED / INFERRED
- Notes: each class has its own tree shown as 3 tabs (branches). Skills are not shared between classes; a character only sees and can learn skills of its own class.
- Testable as: each class's tree has exactly 3 branches; no skill id appears in two classes' trees.

### R-203 Tree size and content
- Priority: must | Scope: MVP
- Source: genre; circle-02 Q2
- Status: draft | Provenance: INFERRED
- Notes: about 10 learnable skills per class (for example 3 + 3 + 4 across the branches) in addition to the free basic attack. Mix of active skills (mana cost, no cooldown, QF-06-5) and passives. Every skill has a name, original text and levels 1..N that scale (AC-R-014-5 pattern). Skill names are original and office-flavoured; the existing 6 skills are reused or renamed into the trees.
- Testable as: data check: 3 classes x about 10 skills, every skill has text, max level and per-level values; each branch has at least one active skill.

### R-204 Prerequisites and tier gates
- Priority: must | Scope: MVP
- Source: genre; circle-02 Q2
- Status: draft | Provenance: INFERRED
- Notes: a skill can require (a) a character level and (b) one earlier skill in the same branch at level 1 or higher. The tree is a directed acyclic graph with 3 tiers per branch. Locked skills show why they are locked (UI, R-206).
- Testable as: unit test: learning a skill with an unmet prerequisite is rejected and no point is spent; tree data has no cycles and every prerequisite exists.

### R-205 Skill points, levels and spending rules
- Priority: must | Scope: MVP
- Source: R-013 (1 point per level); genre
- Status: draft | Provenance: INFERRED
- Notes: 1 skill point per character level (R-013), spent on a learnable skill to raise it by one level up to its max (default 5, single-level for some passives and the capstone). No negative points, no spending without a point, points cannot be spent on another class's skill. Points are never lost on level-up while unspent.
- Testable as: unit test of point accounting over levels 1-30: spent plus unspent equals levels gained; max level enforced.

### R-206 Skill-tree panel
- Priority: must | Scope: MVP
- Source: brief ("skill trees"); R-074 (replaced); circle-02 Q2/Q3
- Status: draft | Provenance: INFERRED
- Notes: panel opened with the skill key (S and K, QF-06-3 answer); 3 tabs, nodes with icons and prerequisite lines, state shown by shape and text, not by colour alone (NFR-A03): locked, available, learned, maxed. Hover tooltip with text, current and next level values, mana cost and the reason when locked. Shows points left. Keyboard operable (NFR-A01). Readable at 1280x720 and 390 px wide in the compact layout used for the phone review shots.
- Testable as: E2E: open the panel, 3 tabs present, learn a skill with a click, point counter decreases, tooltip text non-empty; a11y check that state is also in text.

### R-207 Learned skills feed the skill bar
- Priority: must | Scope: MVP
- Source: R-015; genre
- Status: draft | Provenance: INFERRED
- Notes: active skills the character has learned can be assigned to the left/right-click skill and to F1-F4 (QF-01-4); passives apply automatically; unlearned skills cannot be assigned. A respec (R-209) clears assignments of removed skills.
- Testable as: unit and E2E: assigning an unlearned skill is rejected; after learning it can be assigned and used in combat.

### R-208 Skill synergies
- Priority: could | Scope: MVP
- Source: genre; circle-02 Q2
- Status: draft | Provenance: INFERRED
- Notes: optional: a passive or skill grants a bonus to a named related skill per level. Included only if effort allows in the 3 rounds; the tree must work without it.
- Testable as: if implemented: bonus appears in the tooltip and in damage numbers.

### R-209 Respec of skill points
- Priority: should | Scope: MVP
- Source: R-018 (promoted); circle-02 Q3
- Status: draft | Provenance: ASSUMED
- Notes: proposed default: unlimited free skill respec in town; attribute respec stays LATER. Needed because three classes and short runs invite trying builds.
- Testable as: unit test: respec returns all spent points and clears learned skills and bar slots; allowed only in town.

### Character creation and selection

### R-210 Character creation: name and class
- Priority: must | Scope: MVP
- Source: brief ("character selection screen"); genre
- Status: draft (selection agreed, name entry draft; circle-02 Q5) | Provenance: INFERRED
- Notes: new game = choose an empty slot, choose a class, enter a name, confirm. The chosen class and name are stored in the slot.
- Testable as: E2E: creating a character with class X and name Y yields `getState().player.class === X` and the name on the slot preview.

### R-211 Character name rules
- Priority: should | Scope: MVP
- Source: ASSUMED; circle-02 Q5
- Status: draft | Provenance: ASSUMED
- Notes: default: 1-16 characters, letters, digits, space, hyphen and apostrophe; trimmed; not empty; same names allowed across slots (slots are identified by number); a random office-style name suggestion button. Names are stored text only; never evaluated as markup (NFR-S01). English only (NFR-A06).
- Testable as: unit test of the validator with empty, too long, markup and unicode cases; E2E: invalid name disables "Begin".

### R-212 Visually appealing character-selection screen
- Priority: must | Scope: MVP
- Source: brief ("visually appealing character selection screen")
- Status: agreed (intent); concrete design draft (circle-02 Q5) | Provenance: OBSERVED (brief)
- Notes: "visually appealing" is subjective, so it is gated by independent visual review (as QF-07-1, QF-02-5 and the earlier variant picks): produce 2-3 variants, review with screenshots at desktop and phone width, the real customer may overrule. Everything is generated by the team in code (R-102, ADR-0004); no third-party art.
- Testable as: visual review pass recorded in `docs/product/variants/` or a review file; plus automatic checks in R-214.

### R-213 Selection screen content
- Priority: must | Scope: MVP
- Source: circle-02 Q5; genre
- Status: draft | Provenance: INFERRED
- Notes: shows all 3 classes side by side or as a carousel; the selected class has a large animated character built from the same rig and style as in-game (idle loop, attack demo on hover or click), class name, role tag, a short original blurb, starting stat bars, and a preview of the three skill branches; a name field and a Begin button; a Back button. Background uses the art direction (lighting model and palette, `variants/art-direction/decision.md`).
- Testable as: E2E: each class card shows name, blurb, stats, skill preview and an animated preview that changes over frames (canvas differs between two frames).

### R-214 Selection screen interaction, accessibility and performance
- Priority: must | Scope: MVP
- Source: NFR-A01, NFR-A05, NFR-P01
- Status: draft | Provenance: INFERRED
- Notes: operable by mouse and keyboard (arrows, Enter, Esc); class never conveyed by colour alone; reduced-motion option stops the demo animation and the background drift; no flashing; holds 60 fps on the reference laptop; works from 1024 px width up (NFR-B02) and degrades to a stacked layout on phone width in the review shots.
- Testable as: E2E: full keyboard path from title to a started game; reduced-motion flag leaves the preview static; frame-time check in the perf script.

### R-215 Flow: title, slot, class screen, game
- Priority: must | Scope: MVP
- Source: R-076; brief; circle-02 Q6
- Status: draft | Provenance: INFERRED
- Notes: title offers Continue (last used slot) and New game; New game and Load go through the slot list; an empty slot leads to the class screen, an occupied slot to Load or, for New game, to an overwrite confirmation (R-221). Replaces the single "Continue/New game" logic of AC-R-090-5 and AC-R-092-4.
- Testable as: E2E for the flows: new in empty slot, continue, load from list, new over an occupied slot with confirm and cancel.

### Save slots

### R-220 Five save slots
- Priority: must | Scope: MVP
- Source: brief ("a save with 5 slots", agreed; overrides circle-01 Q4)
- Status: agreed | Provenance: OBSERVED (brief)
- Notes: exactly 5 character slots, numbered 1-5; each holds one character with its own progress, inventory, equipment, belt, skills, deepest floor and boss flag.
- Testable as: storage inspection: 5 slot entries at most, addressable by number; a game in slot 3 never changes slots 1, 2, 4, 5.

### R-221 Slot operations: create, load, overwrite, delete, rename
- Priority: must | Scope: MVP
- Source: circle-02 Q6; genre; brief for the existence of slots
- Status: draft | Provenance: INFERRED
- Notes: create (empty slot, via R-210), load, overwrite (creating a new character in an occupied slot, with a clear confirmation naming the character that will be lost), delete (confirmation; slot becomes empty; options are untouched, QF-09-4), rename (the character name, R-211). All destructive actions are confirmed and cancellable. Optional: a copy-to-slot action (could).
- Testable as: E2E per operation, including cancel paths and "no change to other slots".

### R-222 Slot preview
- Priority: must | Scope: MVP
- Source: circle-02 Q6; genre
- Status: draft | Provenance: INFERRED
- Notes: each slot card shows: slot number, character name, class (name and icon), level, deepest floor (depth), play time (hh:mm), last played (local date and time), and an empty-slot state. A corrupt slot is shown as such with Export and Delete (R-227). Play time is accumulated game time, not wall clock while paused.
- Testable as: unit test of the preview projection from a saved character; E2E: card text matches the loaded state.

### R-223 Where the slots are reached
- Priority: must | Scope: MVP
- Source: brief ("to the options menu", agreed); circle-02 Q6 for the title
- Status: agreed (options menu); title and pause access draft | Provenance: OBSERVED (brief) / INFERRED
- Notes: the slot manager is a section of the Options menu (R-076) from both the title screen and the pause menu. The title's New game / Continue (R-215) use the same slot list. In-game, load and overwrite while playing are available from the pause menu and ask for confirmation, since unsaved floor progress is lost (R-091).
- Testable as: E2E: slot manager reachable from Options on title and in game.

### R-224 Autosave targets the active slot only
- Priority: must | Scope: MVP
- Source: R-091 (extended); circle-02 Q6
- Status: draft | Provenance: INFERRED
- Notes: autosave rules of R-091 are unchanged but write to the slot of the running character. Last-used slot is remembered for Continue. Writes are coalesced; storage keys never grow beyond 5 slots plus options (extends AC-R-091-5).
- Testable as: E2E: 100 saves in slot 2 leave slots 1, 3, 4, 5 byte-identical.

### R-225 Migration of existing single-slot saves into slot 1
- Priority: must | Scope: MVP
- Source: circle-02 Q1 and Q6; NFR-D03
- Status: draft | Provenance: INFERRED
- Notes: on first load of the new version, a v1 save (single key, class `clerk`) is converted into slot 1; the old key is kept as a one-time backup (QF-09-6) until the player deletes it. Save version is bumped and the migration is idempotent. The legacy class maps to one of the new classes (default: the melee/heavy class, circle-02 Q1) and the learned legacy skills are refunded as free skill points rather than guessed into the new tree. Attributes, items, stash, gold, depth and boss flag are preserved. If slot 1 already holds a new-format save, the old save goes to the first empty slot, else stays as backup with a notice.
- Testable as: unit test with a synthetic v1 fixture (QF-09-5): after migration slot 1 deep-equals the v1 character on preserved fields; running migration twice changes nothing; corrupt v1 falls back to a fresh start and keeps the bad data for export.

### R-226 Per-slot export/import and options scope
- Priority: should | Scope: MVP
- Source: R-092 (adapted); NFR-D02
- Status: draft | Provenance: ASSUMED
- Notes: export and import work on one slot at a time (import asks which slot and confirms before overwrite). Options (volume, keys, audio kit) are global, not per slot.
- Testable as: E2E: export slot 2, import into slot 4, both previews equal.

### R-227 Slot failure handling
- Priority: must | Scope: MVP
- Source: NFR-D03, AC-R-090-6 (extended)
- Status: draft | Provenance: INFERRED
- Notes: a corrupt or too-new slot never crashes the game and never affects other slots; a write failure or quota exceeded for one slot shows a notice and keeps the last good data of that slot.
- Testable as: E2E: corrupt slot 3 only: title loads, slot 3 shows the corrupt state, the others work.

### Balance, content and testing

### R-230 Per-class balance targets
- Priority: must | Scope: MVP
- Source: R-006, Q7 (20-40 min run); circle-02 Q7
- Status: draft | Provenance: INFERRED
- Notes: each class reaches the end boss with a competent bot or player in 20-40 minutes; class parity band (default: median clear time and death count of any class within 25% of the three-class median); no skill is strictly dominant in its tree and no branch is unusable. Values live in one config module (QF-05-7) and are tuned by playtest bots.
- Testable as: release-gate bot runs (QF-01-5 style) per class with fixed seeds; report with the parity numbers.

### R-231 Items shared across classes
- Priority: should | Scope: MVP
- Source: circle-02 Q4
- Status: draft | Provenance: ASSUMED
- Notes: default: every item can be equipped by every class subject to level and attribute requirements (R-054); class flavour comes from attributes, skills and a small set of class-tagged affixes that roll only for that class's skills.
- Testable as: unit test: item requirement check is class-independent; class-tagged affixes never roll for other classes.

### R-232 Distinct look and feel per class in play
- Priority: should | Scope: MVP
- Source: genre; art direction decision
- Status: draft | Provenance: INFERRED
- Notes: three readable silhouettes and palettes at gameplay scale (rig variants in the Style interface, ADR-0002 section 7), class-specific skill effects and cues (audio kit stays global). Reviewed by the visual reviewer.
- Testable as: visual review plus atlas test: each class has all animation keys the renderer needs.

### R-233 Original names for classes and skills
- Priority: must | Scope: MVP
- Source: claim G2; R-102; NFR-L01, NFR-L05
- Status: draft | Provenance: INFERRED
- Notes: class and skill names, blurbs and tooltips pass the denylist scan (`ip-denylist.txt`) and contain no real brand, company or person. Final class names go to the real customer for confirmation (ESCALATE, as QF-06-1).
- Testable as: legal test scans all class and skill strings.

### R-234 Testability for classes, trees and slots
- Priority: must | Scope: MVP
- Source: R-121, R-123; ADR-0003
- Status: draft | Provenance: INFERRED
- Notes: in test mode the hook can create a character of a class, read the tree and learned skills, learn/respec skills, and run slot operations against a fake storage; cheats can set level and skill points. The headless bot gets one policy per class. Determinism (R-120, NFR-Q01) holds for every class.
- Testable as: hook E2E and unit tests listed above; replay hash per class.

## N. Quest journal, main quest and side quests (added 2026-10-14, circle 3)

Source of this area: the **sixth briefing** in `00-brief.md` (user, 2026-10-14, verbatim: "hey i missing a place to look at the quest and the next step to solve for them can you put that into the next round after all is done?"), scheduled as R7-0 in `50-plan.md`. Customer words cover: a place to look at the quests (the journal, R-243) and the next step for each (R-242). Status stays `draft` for everything, because the words do not yet say how (key, markers, count of side quests); the proposed defaults are in `circles/circle-03.md`. Adding NPC side quests is the orchestrator's interpretation ("stay close to the original": NPC-given quests, a quest log), so R-245..R-247 are INFERRED, not customer words.
Supersedes in spirit: R-104 (story frame): the three text beats stay; the main goal becomes explicit steps (R-241). Existing screens, saves and classes are otherwise unchanged. Save schema: v3 to v4 (R-251, NFR-D06 style).

### R-240 Quest model and states
- Priority: must | Scope: MVP
- Source: sixth briefing; circle-03 Q1
- Status: draft | Provenance: INFERRED
- Notes: quests are data (id, title key, giver, steps with objectives, rewards) in `src/core/content/`; quest state is part of the game state and driven by game events (floor entered, monster killed, item picked up, NPC talked to, boss defeated). States: unavailable, available, active, completed. Core stays deterministic (R-120, NFR-Q01).
- Testable as: unit test: a quest advances only through events; the same seed and inputs give the same quest state and replay hash.

### R-241 Main quest as explicit steps
- Priority: must | Scope: MVP
- Source: sixth briefing; R-104; circle-03 Q2
- Status: draft | Provenance: INFERRED
- Notes: the memo goal ("find out why the floors went dark") becomes one main quest of about six steps from the start of a run to the end boss and victory, each with a one-line next-step text. It starts active in a new game. Step texts are original.
- Testable as: bot run to the boss: every main step completes in order and the journal shows the matching next step at each point.

### R-242 Next step per active quest
- Priority: must | Scope: MVP
- Source: sixth briefing ("the next step to solve for them")
- Status: draft | Provenance: INFERRED
- Notes: every active quest shows exactly one concrete next step as text, derived from state, never stale (for example "Take the lift to floor 3", "Talk to the facilities desk"). Optional hint of where (floor, NPC). Completed quests show no next step.
- Testable as: unit test: for every quest and every state the next-step text key exists and matches the current step; E2E: journal text changes after the step is done.

### R-243 Quest journal panel
- Priority: must | Scope: MVP
- Source: sixth briefing ("a place to look at the quest")
- Status: draft | Provenance: INFERRED
- Notes: a panel listing active quests (main first, then side quests) with title, giver, next step and progress, plus a completed list. Opens with a key (default J, remappable in Options like the other panel keys), a HUD button and a pause-menu entry; closes with Escape or the same key. Does not pause the game more than other panels do.
- Testable as: E2E: the key, the HUD button and the pause entry each open it; Escape closes it; remapped key works.

### R-244 Journal on phone width and keyboard
- Priority: must | Scope: MVP
- Source: sixth briefing; NFR-A04, NFR-A07
- Status: draft | Provenance: INFERRED
- Notes: on phone width the journal is a full-screen panel reached by the HUD button (touch target size as other buttons); desktop shows it as a side panel like the character sheet. Keyboard-operable, no colour-only state, reduced motion respected, long text wraps.
- Testable as: E2E at phone and desktop width: no horizontal scroll, button reachable, all quests readable; keyboard-only open, scroll and close.

### R-245 Side quests: number and givers
- Priority: should | Scope: MVP
- Source: orchestrator interpretation of "stay close to the original"; circle-03 Q1
- Status: draft | Provenance: ASSUMED
- Notes: default 6 side quests, given by the existing town NPCs (vendor 2, healer 2, potion seller 1, stash keeper 1) in `src/core/content/npcs.js`; no new NPCs. A quest is offered in the NPC dialogue, accepted or declined, and handed in by talking to the same NPC again.
- Testable as: E2E: each of the 6 quests can be accepted, advanced and handed in with the right NPC; count equals the configured number.

### R-246 Quest kinds and objectives
- Priority: should | Scope: MVP
- Source: genre; circle-03 Q1
- Status: draft | Provenance: ASSUMED
- Notes: objective types: kill N monsters of a kind or in a zone, find a quest item on a floor (drops once, in a generated room, never lost: it is not in the normal item pool and not sold), reach a floor, defeat a named elite, use a floor feature or the stash. No timed quests, no escort.
- Testable as: unit tests per objective type; quest item spawns exactly once per quest and per run and is deterministic per seed.

### R-247 Quest rewards
- Priority: should | Scope: MVP
- Source: genre; circle-03 Q1
- Status: draft | Provenance: ASSUMED
- Notes: gold and experience scaled to the floor, plus for some quests one item of a fixed rarity rolled by the normal item generator, or a few potions; one reward (a stash capacity step) is allowed if the stash supports it. No skill points, no attribute points, no unique-only items. Reward is shown in the journal before accepting and is granted once on hand-in.
- Testable as: unit test: reward granted once; inventory-full hand-in keeps the quest open or drops to the floor per spec (no loss).

### R-248 Tracker line and map marker
- Priority: should | Scope: MVP
- Source: sixth briefing; circle-03 Q4
- Status: draft | Provenance: ASSUMED
- Notes: HUD shows one tracked quest's next step as a short line (default: the main quest; the player may pin another); the full map (M) marks the known target (stairs, NPC) of the tracked quest. No in-world arrow in MVP (could).
- Testable as: E2E: tracker line equals the journal's next step for the pinned quest; marker appears on the map only for known targets.

### R-249 NPC quest indicators and dialogue
- Priority: should | Scope: MVP
- Source: genre; circle-03 Q1
- Status: draft | Provenance: ASSUMED
- Notes: an NPC with an available quest shows a marker over the figure, one with a hand-in ready a different marker (shape differs, not colour only, NFR-A03); quest dialogue is short original text; existing vendor, healer and stash functions keep working unchanged.
- Testable as: E2E: marker states in the Lobby; trading and healing still work with an open quest.

### R-250 Quest areas reuse generated floors
- Priority: must | Scope: MVP
- Source: circle-03 Q3
- Status: draft | Provenance: ASSUMED
- Notes: no new quest-only levels or maps in this round; quests use the existing Lobby and the 8 floors plus the boss arena. Quest content may place a quest item or a named elite in a generated floor through the existing generator hooks without changing layout validity (R-042) or the floor-generation budget.
- Testable as: generator test: every seed still passes validity with quest content placed; floor generation time within budget.

### R-251 Quest state in saves, migration v3 to v4
- Priority: must | Scope: MVP
- Source: sixth briefing; R-090; circle-03 Q5
- Status: draft | Provenance: INFERRED
- Notes: save version 4 adds quest state per character slot. Migration of a v3 save: main quest step derived from existing fields (deepest depth, boss unlocked, boss defeated); side quests start as available, none active, none completed (no retroactive rewards). A v4 save loaded by older code is rejected as "newer" (existing rule). Checksum and corrupt-slot behaviour unchanged (R-227).
- Testable as: unit tests: v3 fixtures at several progress points migrate to the right step; round trip of v4; E2E: load an old save, open the journal.

### R-252 Quest summary on the slot card
- Priority: should | Scope: MVP
- Source: circle-03 Q5; R-222
- Status: draft | Provenance: ASSUMED
- Notes: the slot card (R-222) adds the main quest's current step title and the count of completed side quests (for example "3/6"). A slot with no quest data shows nothing extra.
- Testable as: E2E: slot card text after progress; migrated old slot shows its derived step.

### R-253 Quests cannot fail; no abandon in MVP; per character
- Priority: should | Scope: MVP
- Source: circle-03 Q7
- Status: draft | Provenance: ASSUMED
- Notes: death, leaving a floor or quitting never fails a quest; an unfinished quest item stays with the character; objectives are re-reachable. Active side quests cannot be abandoned, but may be left unpinned. Each character slot has its own quest state; a new character starts at the first main step. Respeccing, deleting or overwriting a slot affect only that slot.
- Testable as: E2E: die with an active quest, reload, quest and progress intact; two slots hold different quest states.

### R-254 Sound and visual cues for quest updates
- Priority: should | Scope: MVP
- Source: circle-03 Q7
- Status: draft | Provenance: ASSUMED
- Notes: on accept, step done and complete: a short toast with the quest title and new next step, a short chime from the procedural audio kit (global, no files; honours mute and volume), and a badge on the journal button until the journal is opened. Reduced motion: no animation, toast still shown.
- Testable as: unit test: events raise the cue; E2E: toast text, badge clears on opening; audio test: cue is silent when muted.

### R-255 Original quest names and text
- Priority: must | Scope: MVP
- Source: claim G2; R-102; NFR-L01, NFR-L05; circle-03 escalation
- Status: draft | Provenance: INFERRED
- Notes: quest titles, step texts, dialogue and reward names are original, contain no real brand, company or person, and pass the scans against `ip-denylist.txt` and `ip-denylist-brands.txt`. No quest title or plot may echo the original's. Final quest titles and story text go to the real customer for confirmation (ESCALATE, as R-233); working titles proceed.
- Testable as: legal test scans all quest strings against both denylists.

### R-256 Testability and bot support for quests
- Priority: must | Scope: MVP
- Source: R-121, R-123; ADR-0003
- Status: draft | Provenance: INFERRED
- Notes: in test mode the hook exposes quest state, can set a quest step, and cheats can complete a quest; the headless bot completes the main quest from events without special casing and is not slowed below the R-006 run target by quest items. Replay hashes are re-pinned once when quest state enters the state (as in R4).
- Testable as: hook E2E and unit tests; bot run per class reaches the boss with all main steps completed.
