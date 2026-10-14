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
