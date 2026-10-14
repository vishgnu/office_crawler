Status: open
Readiness: 11/20

# Circle 3: quest journal, main quest and side quests (round R7-0)

Date: 2026-10-14. Facilitator: requirements-facilitator.
Trigger: sixth briefing of the real customer (`../00-brief.md`, verbatim, 2026-10-14, status agreed): "hey i missing a place to look at the quest and the next step to solve for them can you put that into the next round after all is done?" Scheduled as R7-0 in `../50-plan.md`.
Answerer: the real customer or, under the delegation record, `customer-proxy`. Quest names and story text are brand/IP questions and are not delegated (see Escalations).

## Starting point (OBSERVED in the repo)
- The only goal is implicit: three story beats in `src/core/content/story.js` (start memo, boss, victory; R-104). No journal, no quest state.
- Town NPCs in `src/core/content/npcs.js`: vendor, healer, potion seller, stash keeper. They trade, heal or store; none gives a task.
- 8 floors (`config.maxDepth`), then the boss arena; save version is 3 (`config.saveVersion`); five save slots (R-220); panel keys I, C, S/K, M (`src/input/keymap.js`, J is free).
- The customer's words fix only: a place to look at quests, and the next step for each. Everything else below is the orchestrator's reading of "stay close to the original" (NPC quests, a quest log, quest areas) and is a draft.

## Readiness (area N, R-240..R-256)

Threshold 16/20, no item at 0 (`harness/02-lifecycle.md`). Scored for area N only.

| # | Item | Score | Reasoning |
|---|---|---|---|
| 1 | Users and roles | 1 | One role (player); four NPC givers exist, which NPC gives which quest is only proposed (Q1). |
| 2 | Core flows end to end | 1 | Accept, advance, hand in, read the journal are drafted (R-243, R-245, R-247); the main step list and side quest list rest on unconfirmed defaults (Q1, Q2). |
| 3 | Edge and error cases | 1 | Death, leaving a floor, inventory full on reward, quest item loss, old saves are drafted (R-247, R-251, R-253). Missing: quest item vs full inventory at pickup, two quests asking for the same kill. |
| 4 | Data entities, retention | 1 | Quest definition, state per slot, migration rule drafted; stored schema is the architect's (ADR needed). |
| 5 | Integrations | 2 | None: local storage only, no accounts or network (NFR-O02, NFR-D01). |
| 6 | NFR: security, performance | 1 | Floor generation budget and quest-item placement (R-250) and save size (NFR-D05) noted; numbers ASSUMED. |
| 7 | NFR: accessibility, i18n, browsers | 1 | Keyboard, phone width, reduced motion and not-colour-only markers drafted (R-244, R-249, R-254); not agreed. |
| 8 | Compliance and data residency | 1 | No personal data. Originality rule and scan drafted (R-255); final quest titles are escalated. |
| 9 | Acceptance criteria for every must | 1 | Every must has a "Testable as" line; formal ACs come in Spec. Not 2 until then. |
| 10 | Out-of-scope list agreed | 1 | Proposed below; nothing agreed. |
| | **Total** | **11** | No item at 0. Below 16, so not ready. |

Blocking question open: none for readiness. Q2 (final titles and story text) is a brand escalation that does not block work on working titles.

## Questions (ordered by impact)

### Q1 How many side quests, of what kind, from whom, for what reward?
- **Why it matters:** biggest content driver (text, balance, tests, bot paths) and the part of "stay close to the original" that is a guess. The original's first act had about 6 NPC quests.
- **Options:**
  - A. 3 side quests: smallest, one per NPC kind; fast, feels thin next to a journal.
  - B. 6 side quests: vendor 2, healer 2, potion seller 1, stash keeper 1, spread over the 8 floors (about one per floor pair). Kinds: kill N of a kind (for example interns, printers, auditors) or in a zone; find a quest item on a floor; reach a floor; defeat a named elite; one "use the stash" tutorial-style task. Rewards: gold and experience scaled to the floor, plus for three of them one item of fixed rarity from the normal generator, or potions; no skill or attribute points; no uniques.
  - C. 9 side quests: adds a second tier of tasks per zone and a chain (two linked steps); about 50% more text and tests.
- **Proposed default: B** (6; no new NPCs; see R-245..R-247). Working titles and text are written by the agents and checked against the denylists.
- **Answerer:** customer-proxy for count, kinds, givers and rewards; the final quest titles and dialogue text escalate (Q2 note below).
- Affects: R-245, R-246, R-247, R-249, R-255, balance (R-230).

### Q2 How does the memo become explicit main quest steps?
- **Why it matters:** the customer's first need: today the player has no stated goal after the intro. Also fixes the story beats the journal repeats, which are text the customer may want to see.
- **Options:**
  - A. One main quest "Why the lights went out" (working title) with 6 steps, each with a next-step line: 1 Read the memo and go to the lift (Lobby); 2 Reach floor 1 and find the first dark floor's cause (reach depth); 3 Reach floor 4 (zone change, mid-run milestone); 4 Reach floor 8 and find the way to the Executive Suite (boss unlock); 5 Defeat the Regional Director; 6 Return and read the verdict (victory screen). Steps follow existing events (depth reached, boss unlocked, boss defeated), so no new world content is needed.
  - B. As A but 4 steps (start, floor 4, floor 8, boss).
  - C. A plus story clues (found memos on floors) as collectible steps: more story, needs new item and placement work (later).
- **Proposed default: A.** Step titles and next-step lines are original text. C is "could" for a later round.
- **Answerer:** customer-proxy for the step structure; the quest title, step wording and any new story text ESCALATE to the real customer (brand/IP, as R-233); working text proceeds meanwhile.
- Affects: R-241, R-242, R-104, R-255.

### Q3 Quest-specific areas or levels, or reuse of generated floors?
- **Why it matters:** a new level costs generator work, art, balance and test time and risks the floor-generation budget (and the R7-2 stutter work in the same round). The original had quest-specific areas.
- **Options:**
  - A. Reuse: quests use the Lobby and the 8 floors; a quest item or a named elite is placed in a generated room through the existing generator hooks; layouts stay valid for every seed.
  - B. A: plus one small hand-made special room (a fixed "records room" or "server closet") that appears on one floor for one quest.
  - C. Separate quest levels (full maps, entered from a floor).
- **Proposed default: A.** B is a later round (could); C is out of scope.
- **Answerer:** customer-proxy.
- Affects: R-250, R-042, floor generation budget (R7-2).

### Q4 What does "next step" mean: text, map marker, arrow?
- **Why it matters:** this is the customer's literal ask; the form decides the HUD and the map work.
- **Options:**
  - A. Text only in the journal.
  - B. Text in the journal, plus a one-line tracker on the HUD for one pinned quest (default: the main quest), plus a marker on the full map (M) for targets the player already knows (stairs, NPC). No in-world arrow.
  - C. B plus a screen-edge arrow towards the target (needs known target positions; spoils exploration on generated floors).
- **Proposed default: B.** Next-step text states where and what ("Take the lift to floor 3"); on unexplored floors the marker only shows what is known, so the game does not reveal the map. C is could.
- **Answerer:** customer-proxy.
- Affects: R-242, R-248, HUD layout (phone width).

### Q5 Where does the journal live, on desktop and on phone?
- **Why it matters:** the customer asked for "a place to look"; discoverability decides whether the feature is felt.
- **Options:**
  - A. Key only (default J, remappable, listed in Options with the other panel keys).
  - B. Key J, a HUD button (with a badge when something new happened) and a pause-menu entry. Desktop: side panel like the character sheet; phone width: full-screen panel opened by the HUD button.
  - C. B plus a title-screen view of quests per slot (read-only). Not needed: the slot card summary (Q6) covers it.
- **Proposed default: B.** Panel opens and closes without extra pause beyond other panels; Escape closes it; keyboard-operable.
- **Answerer:** customer-proxy.
- Affects: R-243, R-244, R-254, key table (`src/input/keymap.js`), Options key list.

### Q6 Quest state in saves, slot cards, old saves, several characters
- **Why it matters:** touches every save path and the 5 slots; a wrong migration silently resets progress.
- **Options:**
  - A. Save version 4 stores quest state per character slot. v3 saves migrate: main step derived from deepest depth, boss unlocked and boss defeated; side quests start available (none active or completed, no retroactive rewards). Slot card adds the current main step title and "N/6" side quests done. A new character in another slot starts at the first main step; slots never share quest state.
  - B. As A, but a v3 save is migrated by giving all side quests whose targets were already passed as completed with rewards (more generous, risk of reward exploits and hard to test).
  - C. Quest state is global (shared by all slots). Conflicts with R-220 and per-character stash (circle 2 Q4/Q6).
- **Proposed default: A.** Needs an ADR stub (schema, migration fixtures) from the architect; a v4 save in old code is rejected as "newer" (existing rule).
- **Answerer:** customer-proxy.
- Affects: R-251, R-252, R-253, R-220..R-227, NFR-D05, NFR-D06.

### Q7 Failing or abandoning quests; sound and visual cues
- **Why it matters:** fail states multiply edge cases; the cues decide whether players notice the journal at all.
- **Options (fail/abandon):**
  - A. No quest can fail; death, leaving a floor or quitting changes nothing; side quests cannot be abandoned but can be left unpinned. Quest items are bound to the quest and never lost.
  - B. Side quests can be abandoned and re-accepted later (progress reset).
  - C. Timed or failable quests. Not recommended (original has few; costs testing).
- **Options (cues):**
  - D. Toast with quest title and new next step on accept, step done and complete; a short procedural chime from the global audio kit (honours mute and volume); badge on the journal button until opened; "available" and "hand-in ready" markers over NPCs with different shapes (not colour only); reduced motion: no animation, toast still shown.
  - E. Toast and badge only, no sound or NPC markers.
- **Proposed default: A and D.** B is could.
- **Answerer:** customer-proxy.
- Affects: R-249, R-253, R-254, NFR-A03, NFR-A05.

## Escalations to the real customer
- **Quest titles, step wording, NPC dialogue and any new story text** (brand/IP, R-255): working titles and text proceed; the customer confirms or renames, as for class names (R-233). Names and text stay original; both denylists (`../ip-denylist.txt`, `../ip-denylist-brands.txt`) apply and a scan test runs over all quest strings. No quest may echo the original's quests, places or plot.
- **Q1 and Q2 count and structure** are answered by the proxy but are the customer's call if they care: the briefing was silent on them.
- Everything else (Q3..Q7) may be answered by `customer-proxy`; each is cheap to change because quests are data (R-240).

## Proposed out of scope for this round (draft)
Quest-specific levels or full maps (Q3 C), timed, failable or escort quests, quest chains beyond two steps, dialogue trees with choices, branching outcomes, new NPCs or a notice board, daily or repeatable quests, rewards that grant skill or attribute points, unique quest-only items, voice, an in-world quest arrow (could), story collectibles (Q2 C, could), achievements, sharing quests across slots, localisation.

## Next
After answers: set area N statuses, ADR stub for the v4 quest schema and migration (architect), spec ACs for R-240..R-256 (spec-writer), then the R7-0 order in `../50-plan.md` (CORE quest state machine, events, save; then UI and WORLD). Expected readiness once defaults are accepted: about 14-15/20 (items 1, 2, 4, 10 rise to 2; items 3, 6, 7, 9 reach 2 only with ACs in Spec). The quest text stays a brand escalation.
