# Spec questions 01: answers to "Questions for the facilitator"

Date: 2026-10-13. Answerer: `customer-proxy`, under the delegation record in `00-brief.md`. Source: the "Questions for the facilitator" sections of `30-spec/01` to `30-spec/10`.
All answers are PROXY and provisional until the real customer reviews them (`proxy-log.md`). Tie-breaker used where the customer's words are silent: "stay close to the original" for mechanics (brief, verbatim), read as the genre classic's conventions, never its names or assets. Answers do not change any earlier customer or proxy answer (circle-01 Q2-Q7); where one touches an earlier answer it says so.

Answer format: **PROXY** (confidence) / basis. "ESCALATE" = needs the real customer.

## 01 Core loop and controls

### QF-01-1 Town stairs: floor 1 or deepest reached floor?
**PROXY** (high): The town stairs lead down to the deepest reached floor, via an elevator in the Lobby. This is the genre's waypoint idea, re-expressed in office terms. A first-time player has "deepest reached = 1". `config.townStairsTarget = 'deepest'`. Basis: R-004 ("come back to the deepest reached floor"); genre convention (waypoint / return to depth); circle-01 Q7 (short sessions).

### QF-01-2 Click on an unreachable tile (wall)?
**PROXY** (medium): The player walks to the nearest reachable tile to the click, as the genre classic did. `noPath` is raised only when no tile closer than the current one is reachable. Basis: genre convention (brief: stay close to the original; customer's words silent).

### QF-01-3 Skill panel key: S, K or both?
**PROXY** (medium): Both bound by default (S and K open the skill panel). Basis: spec proposal; costs nothing; customer silent.

### QF-01-4 Collision of skill hotkeys 1-4 and belt potions 1-4
**PROXY** (high): Resolved as the genre classic did. Belt potions on keys 1-4. Skills on the mouse: left button = move/attack, right button = the currently selected skill. A skill selector assigns four skills to hotkeys F1-F4 (default; rebindable); pressing F1-F4 selects the skill that the right mouse button then uses. The game calls `preventDefault` for F1-F4 so the browser's own function keys do not fire. R-005's "hotkeys for skills (1-4)" is read as "four skill hotkeys", not the number row. Basis: brief "stay close to the original" (mechanics); R-005 "skills on mouse buttons"; R-056 (belt 1-4); no conflict with circle-01 answers. Consequence: AC-R-015-3 uses F1-F4.

### QF-01-5 R-006 "meaningful in 20-40 minutes"
**PROXY** (medium): Accept as a release-gate measurement, not an AC: the playtest bot reaches the boss in 20-40 minutes of simulated time (`tick / tickHz`) on seed 1, after a balance pass. Basis: circle-01 Q7 (answer A, 20-40 min run); the measurement is the proxy's way to make Q7 testable.

### QF-01-6 Rebinding collision
**PROXY** (medium): Reject with a notice (`ui.notice`), `options.keys` unchanged; the player must free the key first. Basis: spec proposal; safest for accessibility (NFR-A01); the genre classic is not clear on this and the customer is silent.

## 02 Combat

### QF-02-1 Hit chance formula and clamp
**PROXY** (medium): Owned by the architect (ADR). Genre-style guidance: chance depends on attacker rating against defender defence and level, clamped to a floor and ceiling (recommended 5% to 95%, as in the genre). Values live in `config`. The spec asserts monotonicity and bounds only. Basis: genre convention; customer silent.

### QF-02-2 Respawn with full health and mana?
**PROXY** (high): Yes, the player respawns in town with full health and mana, no gold loss. Basis: circle-01 Q7 answer A ("moderately forgiving, death returns to town with no gold loss").

### QF-02-3 Dying with an item on the cursor
**PROXY** (medium): The item returns to the inventory; if the inventory is full it drops at the death tile on the floor (retrievable per QF-04-6). It is never destroyed. Basis: spec proposal; Q7 forgiving.

### QF-02-4 Natural regeneration
**PROXY** (low): Genre feel: no natural health regeneration on floors; slow natural mana regeneration, rate in `config` and tunable by playtest. Full restore of health on the healer (QF-04-2). Both resources are refilled on respawn. Basis: genre convention (customer silent); to be reviewed after playtest.

### QF-02-5 "Feel" criteria (animation, readability)
**PROXY** (high): Accept screenshot review by the independent visual reviewer as the gate. Basis: circle-01 Q2 (art quality via independent visual review).

## 03 Monsters and AI

### QF-03-1 Final monster names
**PROXY** (medium) for working names; **ESCALATE** for final names. ACs test working names. All names must be original and pass the IP denylist (QF-10-2). Final names, as part of the product's naming and brand, are for the real customer. Basis: R-030 "open to the user"; IP/branding is not delegated.

### QF-03-2 Which archetypes flee, at what health?
**PROXY** (medium): The small/weak melee archetypes of the swarm kind flee below 25% health, regroup, and return after a delay (a genre convention). Ranged and caster types and bosses never flee. Exact threshold and archetype mapping in `config`, set by the spec-writer within this rule. Basis: genre convention.

### QF-03-3 Leash and losing interest
**PROXY** (medium): Monsters lose interest when the player is farther than twice their aggro radius for a set time (`config`), then walk back to their origin and idle. Basis: genre convention; R-032 needs no break in behaviour.

### QF-03-4 "Better drops" for champions
**PROXY** (medium): Accept the proposal: a champion's drops are at least magic rarity (guaranteed); the mean-rarity AC stays. Basis: spec proposal.

### QF-03-5 Safe radius around the entry stair
**PROXY** (high): Add as a requirement: no monster spawns within a safe radius of the entry stair (radius in `config`, suggested 8 tiles). Basis: genre convention and fairness (Q7 "forgiving").

### QF-03-6 Archetype to behaviour mapping, availability by zone
**PROXY** (low): Delegated to the spec-writer and architect within these limits: 6 to 8 archetypes; each of the 3 behaviours used by at least two archetypes; zone 1 (floors 1-4) has about half of them, zone 2 (floors 5-8) adds the rest and keeps some of zone 1 at higher level. Not a customer-facing decision. Basis: R-031; customer silent.

## 04 World and floors

### QF-04-1 Spawning hostiles in town via cheat
**PROXY** (high): Cheats reject it, keeping "no hostiles in town" an invariant (AC-R-040-5). Basis: spec proposal; R-040.

### QF-04-2 Healer cost and mana
**PROXY** (medium): Free, restores health only; mana comes from potions and regeneration. Basis: R-041 text ("restores health"); genre convention (free healer).

### QF-04-3 Potion seller stock by player level
**PROXY** (medium): Unlimited stock; potion strength tiers unlock by player level (for example minor, normal, greater, with the thresholds in `config`). Values owned as in QF-05-7. Basis: genre convention.

### QF-04-4 Zone boundary and room-kind mapping
**PROXY** (medium): Accept the spec's proposal as in AC-R-101-2. Floors 1-4 are zone 1, floors 5-8 zone 2; the boss arena has its own tileset. Basis: R-043, R-101; circle-01 Q3.

### QF-04-5 Boss on floor 8 or a ninth arena
**PROXY** (high): The boss gets its own final area, as in the genre classic: a boss arena reached from floor 8 by a stair. The 8 floors and 2 zones of circle-01 Q3 are unchanged; the arena is the ninth location and is not counted among the 8. `config.bossDepth = 9` (arena). R-045's wording "boss on the last floor" is to be amended to "in the final area after floor 8". Basis: circle-01 Q3 (8 floors, 1 end boss with 2 phases), genre convention; no conflict with the earlier answer.

### QF-04-6 Ground items on a re-entered floor
**PROXY** (medium): Within a running session, layout, cleared monsters and ground items persist while the player moves between town and floors (as in the genre classic; forgiving per Q7). Across save and reload nothing mid-floor is restored (circle-01 Q4, option A). AC-R-044-2 changes from "lost" to "still there (same session)". Basis: genre convention; circle-01 Q4 and Q7.

### QF-04-7 "Guaranteed good loot" minimum
**PROXY** (medium): The boss drops at least 3 items, each rare or better. Values `config.boss.guaranteedDrops = 3`, `config.boss.minRarity = rare`. Basis: genre convention; R-045.

### QF-04-8 Where the player stands after "keep playing"
**PROXY** (medium): In town. The boss stays dead; the elevator target remains the deepest reached floor. Basis: genre convention (return to hub); R-004.

### QF-04-9 Boss reset on death
**PROXY** (medium): If the player dies or leaves the arena before the boss is dead, the boss resets to full health and phase 1. Basis: genre convention; fairness.

### QF-04-10 Lobby sub-areas
**PROXY** (high): Accept `reception` and `breakroom` as working sub-area names (generic words, not IP). Basis: spec proposal.

### QF-04-11 Visual identity of town and tilesets
**PROXY** (high): Decided by the art-direction variant pick; accepted by independent visual review. Basis: circle-01 Q2.

## 05 Items and loot

### QF-05-1 Container kinds
**PROXY** (medium): Two kinds per floor: breakable "supply crates" (gold, potions) and openable "filing cabinets" (items, better chance). Count per floor in `config` (suggested 4 to 10, by room size). Basis: R-050; genre convention (barrels and chests, re-expressed).

### QF-05-2 Unique item dropping twice
**PROXY** (low): A unique drops at most once per game; a roll that would repeat a taken unique falls back to a rare of the same base. Basis: genre convention; flag for review since the spec proposed "may drop again".

### QF-05-3 "Same stat group" for affix exclusion
**PROXY** (medium): The group is the affix's primary stat family (for example all tiers of +strength are one group, all +fire resist another). The architect lists the groups in `config`; an item never has two affixes of the same group. Basis: R-051; genre convention.

### QF-05-4 Two-handed weapons
**PROXY** (medium): Yes, a few. A two-handed weapon occupies the weapon and off-hand slots; equipping one returns the off-hand item to the inventory, and is refused (with a notice) when the inventory has no room. Basis: genre convention.

### QF-05-5 Potion at full health
**PROXY** (low): As the genre classic did, the potion is consumed (and wasted). Behind `config.consumePotionAtFull` so it is a one-line change if playtest shows accidental waste. Basis: genre convention; flagged because Q7 asks for "forgiving", so the real customer may prefer "refused".

### QF-05-6 Selling equipped items
**PROXY** (high): Only inventory items can be sold; unequip first. Basis: spec proposal; genre convention.

### QF-05-7 Balance table owner (drop chances, rarity weights, prices, potion values)
**PROXY** (high): The architect and implementer own it. All balance values live in a single config module, tuned by the playtest bots (QF-01-5). The customer sets only the feel targets already given (20-40 minutes, forgiving). Basis: customer's earlier answers delegate mechanics to "stay close to the original"; Q7.

### QF-05-8 Item label and icon readability
**PROXY** (high): Visual review item, not an AC. Basis: circle-01 Q2.

## 06 Character and progression

### QF-06-1 Class selection screen with one class
**PROXY** (medium): No selection step; the character-creation screen shows the single class and asks for a character name only. Final class name: working name now, final naming is **ESCALATE** with the other names (QF-03-1). Basis: circle-01 Q3 (1 class).

### QF-06-2 XP at level cap
**PROXY** (medium): XP keeps counting for display up to `config.xpPastCap`; level, attribute points and skill points no longer change. Basis: genre convention.

### QF-06-3 XP for non-player kills
**PROXY** (medium): None in the MVP (the player has no pets or traps). No AC. Basis: scope (circle-01 Q3).

### QF-06-4 Level-difference XP scaling
**PROXY** (medium): None in the MVP; the table value applies. Basis: simplicity; customer silent.

### QF-06-5 Skill mana cost and cooldown
**PROXY** (high): Mana cost only, no cooldowns, for the four actives, as in the genre classic. Basis: spec proposal; genre convention.

### QF-06-6 "Requirements preview" in R-016
**PROXY** (medium): Both: items show met/unmet requirements against current attributes, and the attribute panel previews the derived stat change before the point is confirmed. Basis: R-016; genre convention.

### QF-06-7 Skill tree or list
**PROXY** (medium): List, no prerequisites, for the four actives in the MVP. A tree is for later with more classes. Basis: circle-01 Q3 (1 class).

### QF-06-8 Starting attributes, gold, gear, base values, per-level gains
**PROXY** (medium): `config` values owned as in QF-05-7. Guidance: one starting weapon, two health potions, small starting gold. Basis: genre convention.

## 07 HUD and UI

### QF-07-1 Gauge look
**PROXY** (high): Accept the visual reviewer as the gate; the ACs check values, shapes and layout only. Basis: circle-01 Q2.

### QF-07-2 Keyboard operation of menus
**PROXY** (medium): Add as "should": Esc closes panels and opens the game menu; main menu and dialogs work with arrows, Enter and Esc. In-game panels stay mouse-driven, as in the genre. Basis: NFR-A01; customer silent.

### QF-07-3 Game title "Office Crawler"
**PROXY** (high) that it stays the **working title**, internal only. The final public title is **ESCALATE: needs the real customer** (publication/brand). Basis: circle-01 Q1 safe default A (title internal only); publication not delegated.

### QF-07-4 "No real-world offensive content": list or reviewer?
**PROXY** (medium): The independent reviewer checks content against a short written checklist that the orchestrator keeps (offensive stereotypes, slurs, real people, real brands). Real brand and company names are also covered by the denylist in QF-10-2. Basis: R-103; customer silent. This is a content-quality rule, not an IP decision.

### QF-07-5 Colour-blind delta E threshold
**PROXY** (medium): Accept the spec's proposal. Basis: NFR-A03; technical value, reviewable later.

## 08 Audio

### QF-08-1 Sounds for miss, monster attack, stairs
**PROXY** (medium): Yes, add all three as "should" cues. Basis: circle-01 Q5 answer A ("nice sound").

### QF-08-2 Title screen audio
**PROXY** (medium): A soft generative title ambient, started after the first user gesture (browser rule), with the same mute and volume controls. Basis: Q5 answer A.

### QF-08-3 Default volumes
**PROXY** (low): Master 0.6, effects 0.8, ambient 0.5, not muted; values in `config` and adjusted after the reviewer's loudness check. Basis: customer silent; safe defaults.

### QF-08-4 How "nice sound" is assessed
**PROXY** (medium): Accept the proposal (offline rendered WAV of every cue, reviewed by the independent reviewer), plus automatic checks (no clipping, loudness within a band, no silence). This is a gate outside the automated suite. The real customer's own ear is the final judge on return. Basis: addendum "nice sound" (agreed customer statement).

### QF-08-5 Priority of R-081 (generative ambient)
**PROXY** (high): Confirmed: R-081 is raised from "could" to MVP "should", to match circle-01 Q5 answer A. Basis: circle-01 Q5.

## 09 Save and load

### QF-09-1 Maximum save size
**PROXY** (medium): Soft cap 1 MB, well under the typical 5 MB quota; a failed write shows a visible error and never loses the previous save. Basis: NFR-D; Q4 option A.

### QF-09-2 `config.resumeAt`
**PROXY** (medium): `floorEntry` when saved on a floor (the entry stair of the saved floor), `town` when saved in town. Basis: circle-01 Q4 ("resume in town or at floor entry"); genre convention.

### QF-09-3 Save made while dead
**PROXY** (high): Resumes in town with full health. Basis: circle-01 Q7.

### QF-09-4 "Delete character" and options
**PROXY** (high): Options (volume, keys) are kept; only the character is deleted. Basis: spec proposal; options are separate from the character.

### QF-09-5 Migration tests with a synthetic fixture
**PROXY** (high): Accepted until a second save version exists. Basis: only practical option.

### QF-09-6 Corrupt-save backups kept
**PROXY** (high): One backup (the latest bad file), overwritten by the next. Basis: spec proposal.

## 10 Tech and testability

### QF-10-1 Performance targets
**PROXY** (medium): Accept a CI reference measurement (headless Chromium, software rendering) as a relative regression check: the 95th-percentile frame time of 33.3 ms and the 4 ms sim-step budget are limits for that runner, compared with the stored baseline, not absolute guarantees. The goal "60 fps on a mid-range laptop" is stated as the target, checked by manual release checks. NFR-P03 to P05 stay "should", unspecified. Basis: NFR-P01-P05 (assumed); circle-01 readiness item 6; customer silent.

### QF-10-2 Who supplies the denylists
**PROXY** (medium) that the mechanism is within the delegation; **IP closeness itself remains ESCALATED** (circle-01 Q1). A denylist of the original's trademarks is only the enforcement of the already-applied safe default A (strict originality). Proposal: the orchestrator maintains one file `docs/product/ip-denylist.txt`, a list of terms that must not appear in the product, code, assets or docs, with two sections (original's names and trademarks; real brands, companies and people). This replaces the two files named in the spec (`denylist-original-terms.txt`, `denylist-real-brands.txt`); the spec-writer updates the references. The spec-writer and the proxy do not author the trademark list; the orchestrator does. Marked: implementation of safe default A. Until the file exists the denylist ACs are not meaningful. Basis: circle-01 Q1 (safe default A in force); proxy definition "Never decide: legal/IP".

### QF-10-3 "Fast" simulation: 10,000 ticks in 10 s
**PROXY** (medium): Accept as a relative regression bound on the CI runner. Basis: spec proposal; QF-10-1.

### QF-10-4 Browser and OS matrix
**PROXY** (medium): CI verifies the three Playwright engines (Chromium, Firefox, WebKit). The OS matrix and real Safari are manual release checks, listed in the release checklist for the user; not blocking for slice acceptance. Basis: R-110 (browser); customer silent.

### QF-10-5 `?test=1` flag
**PROXY** (medium): Accept as a proposal; the architect confirms in the ADR. Condition: cheats and the test API exist only with the flag. Basis: NFR-S01.

## Escalations
- Final game title (QF-07-3): ESCALATE: needs the real customer (publication/brand). "Office Crawler" is a working title.
- Final monster and class names (QF-03-1, QF-06-1): ESCALATE for final approval (brand); working names proceed.
- IP closeness (circle-01 Q1): still ESCALATED. QF-10-2 only implements safe default A.

## Items to review first (low confidence)
QF-02-4 (regeneration), QF-03-6 (archetype mapping), QF-05-2 (unique drops), QF-05-5 (potion at full health), QF-08-3 (default volumes).

## Not answered
None; every question in the spec files has an answer or an escalation above.
