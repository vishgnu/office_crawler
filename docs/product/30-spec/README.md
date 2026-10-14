# 30-spec: feature specifications

Date: 2026-10-13. Author: spec-writer. Status: draft for the architect (next role). Inputs: `../00-brief.md`, `../20-requirements.md` (79 requirements), `../40-nfr.md`, `../circles/circle-01.md` with its PROXY answers (provisional, per the delegation record), `../proxy-log.md`. Q1 (IP) is escalated; the safe default A (strict originality) is applied.

## How to read the specs

- Acceptance criteria are `AC-<R-id>-<n>` (NFRs: `AC-NFR-<id>-<n>`) in Given/When/Then form. Each carries a slice tag (`S1`, `S2`, `S3`) and a test level (`Unit` = Node test on pure game logic, seeded RNG, state in and state out; `E2E` = Playwright through `window.__app`).
- Slices: S1 playable core (one office floor, click-to-move with pathfinding, 1-2 monster types, melee, HP/mana gauges, death and restart); S2 loot and progression (items, rarities, affixes, inventory and equipment, XP, levels, stats, stairs, multiple floors, town and vendor); S3 sound and finale (procedural SFX and ambient, boss, save/load, options, polish).
- A later-slice AC may supersede an earlier one for the same requirement (for example AC-R-023-3 in S1 and AC-R-023-4 in S2). The text says so where it happens.
- The shared test contract (the `window.__app` API, the snapshot shape, the Node-side pure functions, the `config.*` convention) is in `10-tech-and-testability.md`. Names are a proposal for the architect's ADR. Where the requirements fix no number, the AC refers to a `config.*` constant and asserts a relation, so balance can change without changing the spec.
- Every file ends with a coverage table, a "Not covered" list and "Questions for the facilitator" (IDs `QF-<file>-<n>`).

## Files and AC counts per slice

| File | Areas | S1 | S2 | S3 | Total |
|---|---|---|---|---|---|
| `01-core-loop-and-controls.md` | A, NFR-A01, A02 | 12 | 12 | 6 | 30 |
| `02-combat.md` | C | 14 | 11 | 1 | 26 |
| `03-monsters-ai.md` | D | 13 | 11 | 0 | 24 |
| `04-world-and-floors.md` | E, J (R-100, R-101) | 8 | 24 | 7 | 39 |
| `05-items-and-loot.md` | F | 0 | 52 | 2 | 54 |
| `06-character-and-progression.md` | B | 8 | 26 | 1 | 35 |
| `07-hud-and-ui.md` | G, J (R-102..R-104), NFR-A03..A06 | 13 | 22 | 9 | 44 |
| `08-audio.md` | H | 0 | 0 | 17 | 17 |
| `09-save-load.md` | I, NFR-D | 0 | 0 | 24 | 24 |
| `10-tech-and-testability.md` | K, L, NFR-P/B/O/S/Q/L | 36 | 7 | 5 | 48 |
| `11-classes-trees-slots.md` (added 2026-10-14, circle 2; rounds R4/R5/R6, see below) | M, NFR-D05, D06, P06, A07 | - | - | - | 70 |
| **Total** | | **104** | **165** | **72** | **411** (341 in S1-S3 plus 70 in rounds R4-R6) |

## Rounds R4-R6 (added 2026-10-14)

`11-classes-trees-slots.md` covers area M (R-200..R-234), NFR-D05, D06, P06, A07 from the customer's third briefing and circle 2 (PROXY answers; final class names escalated). Its ACs carry round tags instead of slice tags: R4 core (class registry, trees, spending, respec, class-tagged affixes, per-character stash, five slots, migration into slot 1): 43; R5 UI and render (selection screen, tree panel, slot list with confirmations): 21; R6 balance parity per class and polish: 6. Must ACs per round: 38, 19, 3 (L-03). Feel and look criteria are marked `verify: playtest/visual review`. It supersedes, for the multi-slot case, AC-R-090-5, AC-R-091-5 and AC-R-092-4 in `09-save-load.md` and the one-class/flat-list ACs R-010-* and R-014-* in `06-character-and-progression.md`; those files are not edited here, the architect and the next spec pass should reconcile them. Nine new questions: QF-11-1..9 in that file.

## Coverage of the requirements

- All 48 MVP `must` requirements have at least one AC. Of the 17 `must` NFRs, 16 have ACs; NFR-L02 (mechanics are free to follow the genre) is a position statement and is not testable.
- Some `should` and `could` items also have ACs where the circle-1 answers made them necessary or they are cheap to pin (for example R-024, R-025, R-033, R-044, R-046, R-054, R-059, R-061, R-075, R-077, R-080, R-081, R-092, R-111, R-122, R-123). `should`/`could` items without ACs are named in each file's "Not covered" list.
- LATER items (R-007, R-017, R-018, R-026, R-035, R-047, R-048, R-058 except the MVP behaviour, R-060, R-083, R-093) have no ACs.
- Assets: graphics are generated in code and audio is synthesised (addendum, agreed by the real customer); the specs test existence, bounds, determinism and absence of third-party files. Whether graphics and sound are "nice" is a visual and listening review, not an automated AC (QF-07-1, QF-08-4).

## Questions for the facilitator (consolidated, highest impact first)

Each file lists its own questions in full. Those that block or change ACs:

1. **QF-01-4** Key collision: R-005 puts skills on 1-4, R-056 puts potions on 1-4.
2. **QF-04-5** Is the boss on floor 8 (the last floor) or a ninth arena? R-043 and R-045 read differently.
3. **QF-01-1** Does the town stairs lead to floor 1 or to the deepest reached floor? (R-004.)
4. **QF-10-2** The two denylists (original's terms, real brands) must be supplied by someone else. Until then the legal-guardrail ACs (AC-NFR-L01-1, L03-1, L05-1) pass vacuously.
5. **QF-10-1** Performance targets are ASSUMED and tied to a laptop that CI cannot reproduce. A reference runner and thresholds are proposed.
6. **QF-06-5** Skill costs and cooldowns are left open by R-014. Proposal: mana cost only.
7. **QF-09-2** Where does a loaded game resume (town or floor entry)?
8. **QF-04-4, QF-04-7, QF-05-1** Zone and room-kind mapping, "good loot" minimum rarity for the boss, and what "containers" are.
9. **QF-02-1, QF-06-8, QF-05-7** Formulas and constants not in the requirements (hit chance, derived stats, drop and price tables) are delegated to `config`; someone must own the balance table (architect with the customer proxy).
10. **QF-07-3** Approval of the game title (Q1 default A keeps "Office Crawler" internal).

Gaps noticed in the requirements, listed instead of invented: natural regeneration; leashing or losing interest for monsters; a safe radius around the entry stair; boss reset after death; death with an item on the cursor; keyboard operation of menus; tab-focus loss behaviour (circle 1 listed it as uncovered). Counts of questions: 01: 6, 02: 5, 03: 6, 04: 11, 05: 8, 06: 8, 07: 5, 08: 5, 09: 6, 10: 5.

## Assumptions made (flagged, to be confirmed)

- The test mode flag `?test=1` and the `window.__app` member names (NFR-S01 asks only for "a documented flag").
- Attribute names Grit, Agility, Stamina, Focus and monster names are the working names from the requirements, used as state keys and registry roles only.
- The full ten-slot equipment list, no durability, no identify, level cap 30, 8 floors in 2 zones and a 2-phase end boss follow the PROXY answer to Q3.
- Death returns to town with no gold loss and (assumed) full health and mana (Q7, QF-02-2); in S1, which has no town, restart places the player at the floor entry.

Next role: architect.
