# R6 contract: balance + polish (orchestrator, 2026-10-14)

Scope: `docs/product/50-plan.md` "Round R6" (R6-1, R6-2) plus the round 6 must-fix list from `docs/reviews/R5-acceptance.md` and
`docs/reviews/G3-visual-review.md`. Rules from the R5 retro apply (playbook 12: input map L-025, contract feasibility L-026,
e2e over http(s) L-027, quiet-machine bench by the orchestrator L-020).

## Packages and ownership

| Package | Owns (may edit) | Must not edit |
|---|---|---|
| BAL-R6 (R6-1) | `src/core/**`, `bot/**`, `test/` except `test/ui-*` and `test/render-*`, `test/fixtures/**` (golden re-record allowed, see below), `docs/reviews/R6-balance*.md`, ADR-0005 amendment | `src/ui`, `src/render`, `src/save`, `e2e/**` |
| UI-R6 (R6-2 UI) | `src/ui/**`, `src/style.css`, `test/ui-*`, `e2e/**` except `e2e/adv-r5.mjs` and `e2e/run-all.mjs` | core, render, save |
| WORLD-R6 (R6-2 render) | `src/render/**`, `test/render-*`, `docs/shots/r6w-*` | core, ui, save, e2e |

## Feasibility (L-026): no new shared fields this round
- UI-R6 draws tree connectors from existing tree data (`prereq`/tier fields already read by `ui/tree.js`). If a field is
  missing, UI-R6 writes it under `needs` instead of guessing.
- BAL-R6 changes numbers and at most the caster damage formula (see below). It must not rename skill, class or state fields.
  Any renamed or removed state field → stop and report.

## Golden replay hash
Balance changes alter the simulation, so `test/fixtures/run-a.hash` will change. BAL-R6 re-records it ONCE at the end,
with the reason in `docs/reviews/R6-balance.md` and the old and new hash. Nobody else may change it.

## Perf budget (retro proposal, applied for this round)
Orchestrator's quiet run before R6: fps50 43.9 (target ≥ 40), lowFx 52.9, atlas 4776 ms (budget 5000 ms).
- WORLD-R6 must not lower fps50 and must bring atlas build to ≤ 4300 ms (headroom), measured as the agent can; the orchestrator
  re-runs on a quiet machine.
- UI-R6 and BAL-R6: no per-frame work added.

## e2e (L-022)
BAL-R6 number changes may move e2e expectations (damage, xp, prices). BAL-R6 lists those in `e2e_red` with the cause. UI-R6
owns those scripts and fixes them after BAL-R6 hands back (the orchestrator will forward the list).
