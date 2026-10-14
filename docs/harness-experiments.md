# Harness experiments for Office Crawler (kickoff, set retroactively at round 4)

Harness version at kickoff: 0.3.0 (rounds 1–3); 0.4.0 from round 4. Hypotheses are judged by `harness-reviewer` at the post-mortem.

| # | Hypothesis | Change under test | Metric | Expected | How measured |
|---|---|---|---|---|---|
| E1 | An adversarial test-engineer pass before the reviewer finds defects the implementer's own tests miss | L-08 Verify step (from round 4) | defects found by the adversarial pass per round; reviewer blocking findings per round | ≥ 1 defect per round from the adversarial pass; reviewer blocking ≤ 1 | `docs/metrics/round-NN.json` defects |
| E2 | Writing a data contract before parallel packages cuts cross-package fix work | L-13 contracts (R4-contract.md) | fix rounds and notes-file requests between packages | fewer fix rounds than R2 (2) and R3 (1 + restart) | metrics rework.fixRounds |
| E3 | The variant loop (prototyper → 2 reviewers → pick) gives "ship"-range in-game visuals in at most 2 rounds | variants + visual-reviewer | in-game visual score per round | ≥ 32 by round G | visual reviews |
