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
