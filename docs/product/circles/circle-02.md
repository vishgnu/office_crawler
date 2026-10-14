Status: open
Readiness: 11/20

# Circle 2: classes, skill trees, character selection, five save slots

Date: 2026-10-14. Facilitator: requirements-facilitator.
Trigger: third briefing of the real customer (`../00-brief.md`, verbatim, 2026-10-14, status agreed). Answerer: the real customer or, under the delegation record, `customer-proxy`. Final class names and the game title are brand questions and are not delegated (QF-06-1, QF-07-3).

## Input from circle 1 and what the customer's words change

Circle 1 is answered by PROXY (see `circle-01.md`, `../proxy-log.md`); Q1 (IP) is still escalated. The new briefing overrides two PROXY answers. Both sides are shown; the real customer's words win because they are the customer's own.

| Earlier answer (PROXY) | New customer words | Effect |
|---|---|---|
| Q3: "1 class ... further classes later", QF-06-7 "skill list, no prerequisites", R-010/R-017 | "3 player classes with skill trees" | 3 classes and per-class trees are MVP (R-200..R-208). |
| Q4: "one character slot", R-092 | "a save with 5 slots to the options menu" | 5 slots (R-220..R-227); title access is a usability addition (draft). |
| Q7: run to the boss in 20-40 min | not changed | Becomes a per-class balance target (R-230). |

No conflict between customer words remains. Not conflicting but worth knowing: "3 more rounds of work" is about effort, not scope, so the architect plans the slices (classes and trees, slots and migration, selection screen) in `50-plan.md`.

## Answers turned into requirements this circle

Customer words recorded as `agreed`: R-200 (number of classes), R-202 (a tree per class), R-212 (visually appealing selection screen, intent), R-220 (5 slots), R-223 (reachable from Options). All other new items (R-201, R-203..R-211, R-213..R-215, R-221, R-222, R-224..R-227, R-230..R-234) are `draft`. Full text in `../20-requirements.md`, area M (29 requirements: 23 must, 5 should, 1 could). NFR additions: NFR-D05, NFR-D06, NFR-P06, NFR-A07 in `../40-nfr.md`. No ADR stubs needed yet; the architect owns the storage layout (slot keys) and the tree data schema.

## Definition of Ready, re-scored for the new area

Threshold: 16/20, no item at 0 (`harness/02-lifecycle.md`). Scored for area M only; the rest of the project keeps its earlier state (spec and S1 exist).

| # | Item | Score | Reasoning |
|---|---|---|---|
| 1 | Users and roles | 1 | One role (player). Three classes agreed in number; their concepts, names and roles are only proposed (Q1). |
| 2 | Core flows end to end | 1 | Flow title - slot - class - name - game (R-215) and the slot operations (R-221) are drafted step by step, but the tree learn/respec flow and in-game load/overwrite rest on unconfirmed defaults (Q2, Q3, Q6). |
| 3 | Edge and error cases | 1 | Covered: corrupt slot, quota, overwrite and delete confirmation, migration of the old save, cancel paths (R-221, R-225, R-227). Missing: what a half-spent character looks like after a rule change, losing the tab during a write, name collisions in export/import. |
| 4 | Data entities, retention | 1 | Slot preview fields, tree node (prerequisite, level gate, max level) and class definition are described; the stored schema and what is per slot vs global (stash, options) wait for Q6 and the architect. |
| 5 | Integrations | 2 | None, unchanged: local storage only, no accounts or network (NFR-O02, NFR-D01). |
| 6 | NFR: security, performance | 1 | Storage budget for 5 slots (NFR-D05), selection-screen frame rate (NFR-P06) and name-as-text rule drafted; all numbers ASSUMED. |
| 7 | NFR: accessibility, i18n, browsers | 1 | NFR-A07 drafted: keyboard path, no colour-only state, reduced motion. Not agreed; tree panel on phone width still to be checked in review. |
| 8 | Compliance and data residency | 1 | No personal data; names are local text. IP: class and skill names must be original, final class names are escalated (R-233). Q1 of circle 1 is still open. |
| 9 | Acceptance criteria for every must | 1 | Each must in area M carries a "Testable as" line, so every must is testable. Formal AC ids come in the Spec phase (the spec files for character, skills, UI and save need new ACs). Not 2 until then. |
| 10 | Out-of-scope list agreed | 1 | Proposed out of scope (below); nothing agreed. |
| | **Total** | **11** | No item at 0. Below 16, so not ready. |

Blocking question open: none for readiness; Q1 (class concepts) gates the spec, and the final names are a brand escalation.

### Proposed out of scope for this round (draft)
Fourth class or multiple characters visible in one world; attribute respec; skill synergies as must (R-208 stays could); cloud saves or accounts; class-locked items; party play; cosmetic customisation (hair, colour) on the selection screen; hardcore or ladder modes; copy-slot (could in R-221).

## Questions (ordered by impact)

### Q1 Which three classes, and what happens to the existing Clerk?
- **Why it matters:** decides content volume (3 trees, 3 rigs, 3 sets of animations and sounds), the name risk (brand check) and the migration of existing saves. The genre trio is melee/heavy, ranged/agile, caster. Names must be original (R-233); no name or branch may echo the original's classes or skill names.
- **Options:**
  - A. Facilities Manager (melee, heavy, tough: keys, trolleys, floor buffers, fire doors), Sales Rep (ranged, agile: throws business cards, pens, staplers; dodge, speed, crits), IT Wizard (caster: scripts, firewalls, reboots, summons a helpdesk ticket bot).
  - B. As A, but the caster is a Compliance Officer (audits, debuffs, rule-based area effects, damage over time).
  - C. Another concept the customer names.
- **Working skill-branch sketch for A (all names provisional and original):**
  - Facilities Manager, branches Heavy Lifting (Dolly Charge, Floor Buffer Sweep, Pallet Slam), Safety Officer (Hard Hat, Fire Drill, Lockout), Maintenance (Duct Tape, Master Key, Mop Up).
  - Sales Rep, branches Cold Calling (Stapler Throw, Pen Volley, Business Card Fan), Networking (Quick Exit, Smooth Talk, Handshake), Closing (Upsell, Hard Close, Commission).
  - IT Wizard, branches Scripting (Hotfix, Fork Bomb, Cron Job), Network Admin (Firewall, Reboot, Lockout Policy), Helpdesk (Ticket Bot, Restore Backup, Have You Tried Turning It Off).
- **Existing Clerk:** the working class "Clerk" (all attributes 10, Stapler Throw, Reply-All, Coffee Break, Mute, Dress Code, Hustle) is retired as a class. Proposed: its skills are redistributed into the new trees (Stapler Throw to Sales Rep, Reply-All and Mute to IT Wizard or Sales Rep, Dress Code and Coffee Break to Facilities Manager, Hustle to Sales Rep), and old saves migrate to the Facilities Manager with skill points refunded (R-225).
- **Proposed default: A** with the Clerk handling above. Final names ESCALATE for the brand check; they stay working names until the customer confirms.
- Affects: R-200, R-201, R-203, R-225, R-232, R-233.

### Q2 How is a skill tree built?
- **Why it matters:** the biggest design lever; it defines the skill panel, data format, tests and balance.
- **Options:**
  - A. 3 branches (tabs) per class, about 10 skills per class (3 + 3 + 4), 3 tiers per branch, 1 skill point per level (R-013, 29 points at the level cap of 30), max skill level 5 (single level for capstones and some passives), prerequisites: a character level per tier (for example tiers at levels 1, 8, 16) plus one earlier skill in the branch; synergies optional (could). A character cannot max everything, so it chooses a build.
  - B. As A but 2 points per level so a player can fill about half of the tree.
  - C. Flat list per class (no prerequisites), as in the earlier proxy answer QF-06-7.
- **Proposed default: A.** Basic attack is free and not part of the 10.
- Affects: R-202..R-208, R-014 (replaced), R-013 (points).

### Q3 Respec rules
- **Why it matters:** with three classes and 20-40 minute runs, players want to try builds; free respec also lowers the test cost for bots.
- **Options:**
  - A. Skill points: unlimited and free in town; attributes are not respecced (LATER).
  - B. Skill points respec for gold, rising with level, in town.
  - C. One free respec at level 10, none after; or no respec at all (genre purist).
  - D. Delete and recreate the character is the only way (no feature).
- **Proposed default: A.**
- Affects: R-209, R-207, R-018.

### Q4 What do classes share: items, attributes, stash?
- **Why it matters:** controls loot design (class-locked items multiply the item tables) and balance.
- **Options:**
  - A. All items usable by all classes (level and attribute requirements only); classes differ in starting attributes, growth, basic attack and tree; a few class-tagged affixes ("+1 level to Sales Rep skills") roll only for that class. The four attributes (Grit, Agility, Stamina, Focus) stay the same for all.
  - B. Class-restricted weapon types and armour (genre-like).
  - C. Fully class-locked unique items on top of A.
- **Proposed default: A.** Stash is per character slot (see Q6).
- Affects: R-201, R-231, R-053/R-054, item tables in `05-items-and-loot.md`.

### Q5 Character creation and the selection screen
- **Why it matters:** the customer asked explicitly for "visually appealing"; it is judged by eye, so the content and the review route must be fixed. It is also the first screen of the game.
- **Options (content):**
  - A. Three class cards in a carousel in the lobby scene; the selected class shows a large animated character from the same rig (idle loop, attack demo on hover or click), class name, role tag, a 2-3 line original blurb, starting stat bars (health, mana, strength-like and so on), the three branch names with icons, a name field with "suggest a name" button, Begin and Back.
  - B. As A plus a skill demo reel (the first active of each branch plays on a dummy).
  - C. Static portraits only (cheapest, weaker).
- **Name entry:** 1-16 characters, letters, digits, space, hyphen, apostrophe, trimmed, stored as plain text; same name allowed in several slots.
- **Review route:** 2-3 layout variants, independent visual review at desktop and phone width, as for art direction and the inventory panel; the real customer may overrule on screen.
- **Proposed default: A** with the review route above; reduced motion shows a static pose.
- Affects: R-210..R-214, R-232, NFR-P06, NFR-A07.

### Q6 Save slots: placement, rules and migration
- **Why it matters:** touches every save path; destructive actions are the main risk. The customer fixed the number (5) and the Options entry; the rest is open.
- **Options:**
  - Placement: Options menu section "Save slots" (agreed) on title and pause; plus the title's New game and Continue using the same list (proposed).
  - Rules: overwrite and delete need confirmation that names the character; rename edits the character name; stash is per character (default) or shared across slots; options are global; autosave writes only to the active slot; Continue opens the last used slot.
  - Slot card: slot number, name, class, level, depth, play time, last played (R-222).
  - Migration: the old single save goes to slot 1 with the old key kept as backup; skills refunded (Q1).
  - Export/import per slot (R-226).
- **Proposed default:** all of the above as written, stash per character, 400 KB per-slot cap (NFR-D05). In-game load/overwrite from the pause menu asks for confirmation.
- Affects: R-215, R-220..R-227, R-090..R-092 (adapted), NFR-D05, NFR-D06.

### Q7 Per-class balance targets and how they are checked
- **Why it matters:** three classes with different power curves can break the 20-40 minute target (R-006, Q7 circle 1); without targets the bots cannot judge it.
- **Options:**
  - A. Each class reaches the end boss in 20-40 minutes by the bot and by a normal player; parity band: median clear time and deaths of each class within 25% of the three-class median; no dominant skill in a tree; numbers in one config module; checked by release-gate bot runs per class with fixed seeds (one bot policy per class).
  - B. Same targets, but only as a soft report with no gate.
  - C. No numeric parity (tune by feel).
- **Proposed default: A**, with B as the fallback if bot policies for casters prove unreliable.
- Affects: R-230, R-234, `bot/policy.js`.

## Answers
(pending)

## Next
After answers: update area M statuses, add ADR stubs if the answers change storage (stash scope) or tree schema, and ask the spec-writer to add ACs for the new requirements (character, skills, HUD, save files). Expected readiness after defaults are accepted: about 14-15/20 (items 1, 2, 4 and 10 rise to 2; items 3, 6, 7, 9 reach 2 only with ACs in Spec). A short circle 3 on edge cases is likely, and the class names stay a brand escalation.
