# Harness experiments for Office Crawler (kickoff, set retroactively at round 4)

Harness version at kickoff: 0.3.0 (rounds 1–3); 0.4.0 from round 4. Hypotheses are judged by `harness-reviewer` at the post-mortem.

| # | Hypothesis | Change under test | Metric | Expected | How measured |
|---|---|---|---|---|---|
| E1 | An adversarial test-engineer pass before the reviewer finds defects the implementer's own tests miss | L-08 Verify step (from round 4) | defects found by the adversarial pass per round; reviewer blocking findings per round | ≥ 1 defect per round from the adversarial pass; reviewer blocking ≤ 1 | `docs/metrics/round-NN.json` defects |
| E2 | Writing a data contract before parallel packages cuts cross-package fix work | L-13 contracts (R4-contract.md) | fix rounds and notes-file requests between packages | fewer fix rounds than R2 (2) and R3 (1 + restart) | metrics rework.fixRounds |
| E3 | The variant loop (prototyper → 2 reviewers → pick) gives "ship"-range in-game visuals in at most 2 rounds | variants + visual-reviewer | in-game visual score per round | ≥ 32 by round G | visual reviews |

### Interim status after retro R4 (2026-10-14; not a verdict, harness-reviewer decides at the post-mortem)

| # | Status | Evidence so far |
|---|---|---|
| E1 | **Cannot be judged.** No adversarial pass ran in R4, G or R5, so defects.adversarial is null (not 0) in `metrics/round-04.json`; code review has not run either. The step was defined but not scheduled (L-021); the playbook now requires either a run or a logged skip. | ledger.jsonl has no test-engineer row |
| E2 | **Leaning supported for data shapes, not for integration.** R4 contract: 0 renames, 0 change requests from CORE-R4, WORLD-R5 built against it with no change request back; 0 cross-package fix rounds so far (R2 had 2, R3 1 + restart). Gaps: event and floater field names (`dtype` vs `dmgType`) and existing e2e scripts (2 red after CORE-R4) were outside the contract. UI-R5 and its review are the real test. | L-013, L-022, R4-core-notes.md, R5-world-notes.md |
| E3 | **Pending.** Prototype scores only: character select A 34 (B 28, C 30), C3 tile 31 vs C2 28/29; the in-game gate for round G is >= 34 (decision.md). History says expect a drop: C2 mock 33/32 became 30, 29, 31 in game. E3 should record the prototype score and the in-game score of the same style (L-023). | review-r1.md, review-r3-*.md |
