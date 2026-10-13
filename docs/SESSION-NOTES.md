# Session notes: read this first after any context loss

Running log for the orchestrator (main Claude session). Update after every step. Newest entries at the bottom of each section.

## Standing instructions from the user (verbatim where possible)
- 2026-10-13: Build a browser tribute to the classic isometric hack-and-slash, set in an office. Stay close to the original (in **mechanics**; names, art and text must be original). Use an agent to play the user's role while they are away. Separate folder. Use it to test and improve the harness.
- 2026-10-13: "generate all you need, we want to have nice sound and graphics as well" (agreed, real customer).
- 2026-10-13: "Run some agents to verify the graphics design is good and looks really nice."
- 2026-10-13: "While the tokens last do 3 iterations on the build process and the game design. Don't forget to take notes so we don't get context compressed."
- Harness project (`harness/`): gates need the **real** user. Circle 2 (7 questions) and the portal-overview variant pick are waiting for them. The proxy is NOT delegated there.
- User preferences: claims table + status + confidence; Haiku/Sonnet for most work, Opus only with an approved plan. So far everything delegated runs on **Sonnet**.

## Key paths
- Harness agents: `harness/.claude/agents/*.md`. They don't auto-load here (session root is the repo root), so run them as `general-purpose` with `model: sonnet` and "read and follow your definition at …".
- Game product docs: `office-crawler/docs/product/` (00-brief, 20-requirements (79 reqs), 40-nfr, circles/, variants/, STATE.md, proxy-log.md)
- Learnings: `office-crawler/docs/harness-learnings.md` (L-xx)
- Stack pack for the game: `harness/stack-packs/static-web/` (single-file build with esbuild, seeded RNG, `window.__app` hook)
- Screenshot script for visual reviews: `$SCRATCH/pw/artshots.mjs <variants-dir> <out-dir>`. Playwright 1.56.1 lives in `$SCRATCH/pw/node_modules` and matches the preinstalled Chromium 1194.
  `$SCRATCH=/tmp/claude-0/-home-user-helloworld2/c8e0107a-ab3e-5dd1-bb46-0c0db0deb601/scratchpad` (lost if the container resets; recreate with `npm i playwright@1.56.1`)
- Bicep CLI at /tmp/claude-0/bicep; actionlint via pip.
- Branch: `harness-concept`. Commit and push after every step (a stop hook enforces it). Commit trailer lines are required.
- **Gotcha:** never `pkill -f` a pattern that also matches your own bash command (it killed the shell twice).

## Plan: 3 iterations (each = game slice + harness improvement)
| Iter | Game design / build | Harness focus | Exit |
|---|---|---|---|
| 1 | Proxy answers circle 1. Art-direction variants get 2 visual reviews and a pick. Spec + plan for the MVP. **Slice 1: playable core** (isometric office floor, click-to-move, 1–2 monster types, melee combat, HP/mana globes, death/restart) | Make the visual-review loop a standard step; record agent cost and time per step | Slice 1 playable from `dist/index.html`; unit + Playwright tests pass; visual verdict ≥ iterate; proxy acceptance |
| 2 | Circle 2. **Slice 2: loot & progression** (rarities/affixes, inventory/equipment, XP/levels/stats, multiple floors + stairs, town lobby + vendor) | Fix what iteration 1 showed (learnings) | Same, plus a portal build for the game |
| 3 | Circle 3. **Slice 3: sound & finale** (procedural SFX + music, boss, save/load, polish pass, balance) | Fix what iteration 2 showed; end-of-run summary | Same; overnight summary for the user |

## Log
- [iter 0] Intake, customer-proxy and visual-reviewer agents, static-web pack done. Facilitator circle 1 done (readiness 9/20; Q1 = IP closeness, ESCALATED to the real user, safe default A in force).
- [iter 1] Proxy answering circle 1 Q2–Q7 (running). Prototyper making art-direction variants A (gritty), B (pixel), C (vector) (running). Next: screenshots, then 2 visual reviewers in parallel, then a prototyper fix round, then a proxy pick.
- [iter 1] Proxy answered circle 1: Q2 isometric 2:1, dark comedy, no gore; art style comes from the variant pick. Q3 default MVP scope (1 class, 8 floors in 2 zones, 2-phase boss, level cap 30). Q4 autosave in local storage. Q5 procedural SFX **plus generative ambient** (changed from the default because of the "nice sound" addendum). Q6 private. Q7 20–40 min. Q1 escalated.
- [iter 1] Spec-writer running: 30-spec/ with ACs tagged S1/S2/S3. Next: architect (Sonnet, a deviation from the opus default per the user's cost preference) for ADRs + 50-plan.md, then implementer slice 1.
- [iter 1] Game scaffolded from static-web (office-crawler/{package.json,build.mjs,src,test,e2e}). Core done by the orchestrator: src/core/iso.js (2:1 projection), src/core/pathfind.js (A*, 8-way, no corner cutting), 5 tests pass. Architect running (ADRs + 50-plan).
