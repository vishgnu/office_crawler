# Brief

## Verbatim (user, 2026-10-13)

> For later: When you are done we want a browser clone of diablo the famous hack and slay as a tribute but in an
> office environment. For building it stay close to the original and as input use an agent to play my role while i am
> not here - put it into a separate folder and use it to test and improve the coding harness we are building

(Typos corrected only where the meaning was unambiguous: "Dor builind" → "For building", "inti a seperate filder" →
"into a separate folder", "harbess we arw buildf" → "harness we are building".)

## Restatement

Build a playable browser game that pays tribute to the original isometric action-RPG classic: real-time
click-to-move combat, a safe town hub, randomly generated dungeon levels going deeper, monsters, loot with
randomised properties, character stats and skills, health/mana potions, an inventory. The setting is an office.
Stay close to the original's **mechanics and feel**. Use original names, art, text and story (see claims).
The project lives in its own folder and is built through the harness, with an agent playing the user's role,
so the harness gets tested and improved on a real project.

## Claims

| # | Claim | Status | Note |
|---|---|---|---|
| G1 | A browser clone of the original, as a tribute | **supported** as a genre tribute | Mechanics, structure and feel can be reproduced. Calling it a clone of the named game, or using its name, would not be |
| G2 | Stay close to the original | **partly contradicted** | Close in mechanics: yes. The original's names, characters, artwork, music, text, logo and trade dress belong to their owner. Harness rule 06 forbids copying them. All of these are original here |
| G3 | An agent plays the user's role while they are away | **supported** | `customer-proxy` agent; every answer is tagged PROXY and logged in `proxy-log.md` for review; legal/IP/public/irreversible items are escalated |
| G4 | Separate folder | **supported** | `office-crawler/` at the repo root |
| G5 | Use it to test and improve the harness | **supported** | Learnings in `docs/harness-learnings.md`; fixes go into `harness/` |

## Delegation record

- **Who/when:** the user, 2026-10-13, in the session that built the harness.
- **Scope:** for `office-crawler` only, `customer-proxy` may answer circle questions, pick variants, and accept
  slices (phase gates included) while the user is away.
- **Not delegated:** anything listed under "Never decide" in `harness/.claude/agents/customer-proxy.md`.
  Also not delegated: gates of the harness project itself.

## Addendum (user, 2026-10-13, verbatim)

> Great have fun and dont play to much 😬, gebrate all you keed wee want to have kuce soubd anf grafics as well generate what you need

Read as: "generate all you need, we want to have nice sound and graphics as well, generate what you need."
**Status: agreed (real customer, not proxy).** Graphics and sound must be good quality, and the team
generates all assets itself (procedural or code-drawn art, synthesised audio). Nothing comes from third parties.

## Third briefing (user, 2026-10-14, verbatim)

> Ok we are going a good direction, add 3 more rounds of work. I want to have 3 player classes with skill trees. Also,
> make a visually appealing character selection screen . Add a save with 5 slots to the options menu, keep improving
> the ganes and the tool as before

**Status: agreed (real customer).** Overrides the proxy's earlier answer to circle 1 Q4 ("one save slot"): the game now has
**5 save slots**, reachable from the options menu (and, for usability, from the title/character screen). New scope:
3 player classes, each with a skill tree; a visually appealing character-selection screen; 3 more rounds of work on both the game and the harness.

## Fourth briefing (user, 2026-10-14, verbatim)

> Whem done add 2 rounds that focus on flawless gameplay, when done add 2 rounds on light effects for gameplay and then
> 2 rounds one overall test and polish

**Status: agreed (real customer).** After rounds 4–6: rounds 7–8 flawless gameplay; rounds 9–10 lighting effects for
gameplay; rounds 11–12 overall test and polish.

## Fifth briefing (user, 2026-10-14, verbatim)

> Do a round on improving grafics design stile idea is good but more details and polishing

**Status: agreed (real customer).** The style idea (C2) stays; add a round for more detail and polish across the game's graphics.

## Customer decisions (2026-10-14, verbatim)

> Ip closeness we are good, naes good

**Recorded as real-customer answers (no longer escalated):**
- Circle 1 Q1 (IP closeness): **keep the current approach**: the original's mechanics and feel, with all names, art, text and story
  our own (safe default A). The denylists stay in force.
- Names: **approved**: class names Facilities Manager / Sales Rep / IT Wizard, the title "Office Crawler", and the skill
  renames "Packet Filter" / "Evacuation Drill". Interpretation by the orchestrator; the customer may correct it.

## Sixth briefing (user, 2026-10-14, verbatim)

> hey i missing a place to look at the quest and the next step to solve for them can you put that into the next round after
> all is done?

**Status: agreed (real customer), scheduled for round 7** (the next round after round 6, which is in progress; round 7 is
the first "flawless gameplay" round). Interpretation by the orchestrator: a quest journal the player can open at any time
that lists the active quests and, for each, the concrete next step. Today the game has only one implicit goal (the
"find out why the floors went dark" memo, ending at the boss) and no journal, so this also means turning that goal into
explicit quest steps, and, close to the original's mechanics, adding a few NPC side quests. How many side quests is open
(round 7 circle; the proxy answers unless the customer does).

## Seventh briefing (user, 2026-10-14, verbatim)

> and for the round after that please make sure the characters change their visuals based on the invetrory - do a round of
> e2e testing and polishing afterwards

**Status: agreed (real customer).** Scheduled as **R8-0** (first item of round 8, the round after the quest-journal round 7)
and a new round **R8-T** (end-to-end testing and polish) right after round 8, before the lighting rounds 9–10. Interpretation
by the orchestrator: the hero's look changes with the **equipped** gear (head, body, hands, feet, weapon, off-hand are
visible slots; rings, amulet and belt are not), as in the original. Today the hero sprite ignores equipment (checked in
`src/render`). Inventory items that are carried but not worn don't change the look.

## Customer decisions (user, 2026-10-14, verbatim)

> 1 done, 2 done 3 no need, 4 keep as is , 5 ok, 6 spread it pout better accross the floors 7 keep 8  do 3 quests and 5
> sidequests,  ; gitve me details for 9 now

**Recorded as real-customer answers** (numbers refer to the "waiting for you" list given in chat the same day):
1. Sound kit: done (listened). The current default kit stays unless the customer names another.
2. Respec rule: done. The current rule stays (free respec in the Lobby, with confirmation).
3. AMBIENT_LIFT +12 %: keep. Clarified the same day, verbatim: "don change it is good".
4. Graphics gate (proxy pass at 34/33): keep as is.
5. Note in play/README for file:// play: ok, add it.
6. Pace: spread the difficulty more evenly across the floors (no wall at floor 5). Round 7 balance work (R7-3).
7. Quest names and texts: keep the working names.
8. Quests: 3 main quests and 5 side quests (was 1 main quest with 6 steps and 3 side quests). New plan item R7-4.
9. Harness circle 2: details given in chat.

## Scope change (user, 2026-10-14, verbatim)

> Drop r9-r10 , drop r12

**Status: agreed (real customer).** The lighting rounds R9–R10 and the second overall test-and-polish round R12 are
dropped. Remaining: rest of R7, R8 (gear visuals + flawless gameplay), R8-T (end-to-end test + polish), R11 (overall test
and polish), then the end-of-project task (post-mortem, new harness version, all files and pages updated).

## Late-recorded decisions (user, 2026-10-14, verbatim from human-log.jsonl; added in retro R7, learning L-037)

These five entries were in the human-log but had no briefing here; they were acted on and recorded in SESSION-NOTES, STATE and the CHANGELOG at the time.

- 2026-10-14T14:54:14Z (decision): > yes (add noindex to the game build)
- 2026-10-14T15:30:45Z (decision): > YES (release harness 0.5.0)
- 2026-10-14T15:52:37Z (instruction): > go ahead i will go afk for a while
- 2026-10-14T16:03:53Z (decision): > Circle 2 answers Q1-Q7, drop circle 2, wrap up a new harness version at the very end with all files and htmls updated
- 2026-10-14T18:48:21Z (decision): > No we proceed this is good (keep the full round plan, no merging)

## Customer decision (user, 2026-10-15, verbatim)

> Defaults are fine

**Recorded as real-customer answers** for the open list given the same morning: quests are the intended route (no extra
balance for skipping them); Emergency Exit stays at 40 gold; belt, rings and amulet do not show on the figure; an equipped
weapon replaces the class prop; no 5th Lobby character; the portal-overview pick is folded into the final harness version.
