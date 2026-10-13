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
- [iter 1] Spec done: 341 ACs (S1 104), 12 questions. Proxy answering them in circles/spec-questions-01.md. Learnings L-03 (AC volume) and L-04 (post-circle questions) logged.
- [iter 1] Architect done: ADR-0001..0004 + 50-plan (S1-1..S1-6, S2-1..6, S3-1..6). The architect decided provisionally: QWER skills, potions on 1-4, bossDepth 8, town stairs go to the deepest floor, ?test=1 hook. Vector style is the default until the art pick. Next: implementer WP S1-1..S1-3 (core), then S1-4..S1-6 (render/playable).
- [iter 1] Proxy answered 65 spec questions (circles/spec-questions-01.md). **Binding over the architect's ADR-0002 §11 where they differ** (L-05): potions on belt 1–4; skills on right mouse + F1–F4 selector; boss in its own arena after floor 8; town stairs → deepest floor via elevator; ground items persist within a session. Escalated to the real user: Q1 IP closeness, final title, final monster/class names.
- [iter 1] Implementer S1-1..3 done: pure core under src/core, 86 tests pass. Deviations: diagonal step = straight step; regen default 1hp/120t. Prototyper art variants done (A gritty 23fps, B pixel 61fps, C vector 29fps under headless software GL). Screenshots in variants/art-direction/shots/r1. Next: 2 visual reviewers in parallel + implementer S1-4..6.
- [iter 1] Flaky test fixed (L-06 applied). Running now: visual reviewer 1 (appeal) → review-r1-appeal.md, visual reviewer 2 (craft) → review-r1-craft.md, implementer S1-4+S1-5 (renderer behind Style interface, vector default, main loop, test hook, screens, e2e with playwright 1.56.1). After the reviews: proxy picks a style, the prototyper does a fix round on the pick, then a style port WP.
- [iter 1] Visual review 1 (appeal): C 34 ship, A 31 iterate, B 27 iterate. Pick C, grade it darker with A's lighting; separate yellow/orange rarity. Waiting for review 2 (craft).
- [iter 1] Visual review 2 (craft): C 30, A 29, B 26, all 'iterate'. Both reviewers pick C. Running: the proxy records the pick; the prototyper builds C2.html (C + A's lighting, rarity palette, globe numbers/glyphs, label clamping, phone fixes, ≥45fps). Next: re-review C2 (both reviewers), then the style port into src/render/styles.
- [iter 1] Proxy picked C (graded darker, A's lighting, B's perf discipline); 12 must-fix items in variants/art-direction/decision.md. Waiting for C2 from the prototyper, then re-review.
- [iter 1] Implementer S1-4+S1-5 done: playable (vector style), 96 unit tests, e2e 89/89 (Chromium). Orchestrator re-ran both: green. Screenshot docs/shots/s1-first-playable.png (actors small at 1080p). Next: C2 re-review → style port + S1-6 (HUD, feel, bot, hardening) → reviewer + visual review of the real build → proxy acceptance of S1.
- [iter 1] C2 done (≈54 fps, mug/jug globes, Okabe-Ito rarity, label collision pass). Screenshots in shots/r2. Running: round-2 reviews (appeal + craft with a port checklist), code reviewer on S1.
- [iter 1] Review r2 appeal: C2 33/40 SHIP; must-fix 8 fixed / 4 partly. Port fixes: hero legibility/spacing, actors tinted by light pools + contact shadows, hit punch (bigger number, flash, hit-stop), Manager neck, perf (sprite cache, 50-monster test) + a11y (16px markers, high-contrast option).
- [iter 1] Code review S1: changes needed. 1 blocking (mouse-up dropped while paused, reproduced), 6 should, 6 nit. Implementer fixing the non-render items now (no src/render). The render items (per-frame alloc, atlas DPR) go to the style-port WP. Waiting for review r2 craft (port checklist).
- [iter 1] Review r2 craft: C2 32 ship. STYLE FROZEN = C2. Port checklist in review-r2-craft.md (13 items; game hero ≈75px vs mock 200px, so verify at camera scale). Next: when the review-fix implementer is done → style-port implementer (src/render, + render perf items B-S4/S5) → visual review of the real game → S1-6.
- [iter 1] Review fixes done: B1 fixed (verified to fail without the fix), Tab/Escape, wall-clock moved to npm run bench, CSP tightened. 99 unit tests; e2e 7 scripts. Deferred to the render port: S4 per-frame alloc (incl. hurt-flash gradient in game.js), S5 atlas DPR, N3 rs.facing, N5 pick.js import. Next: style-port implementer.
- [iter 1] Style port + S1-6 done: 118 unit tests (+2 lint = 120), e2e all pass (orchestrator verified), bench 50 monsters 48 fps (lowFx 54.5), bot 30 seeds careful: 30 cleared / 0 stuck; reckless 26/3 died/1 timeout. Zoom 1.8. Screenshots docs/shots/s1-ported-*.jpg. Bot found and fixed an orbit bug (holdRadius). Next: visual review of the REAL game (2 reviewers) → proxy acceptance of S1 → iteration 1 wrap-up (learnings, portal) → iteration 2 (S2 loot & progression).
