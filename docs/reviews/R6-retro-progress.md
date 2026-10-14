# R6 retro progress
- started: read ledger (R6 rows 38-54, harness row 40), human-log, round-05.json, R6 reviews, learnings L-001..L-031.
- verified candidates against files: 10/10 checked (see learnings L-032..L-039); candidate 10 (cues.js) confirmed as one line in src/audio/cues.js (git show 4d70456), candidate 9 held with one name correction (`t` vs `type`) caught by the feasibility line.
- done: round-06.json, harness-experiments.md E1-E3.
- done: learnings L-032..L-039, status checks on 12 older learnings, INDEX.
- done: agent definitions (implementer, test-engineer, visual-reviewer, reviewer, customer-proxy, harness-retro), playbook rows, COVERAGE.md probe rule, CHANGELOG Unreleased.

## Proposed for the post-mortem (lifecycle, gates, roles; not applied)
1. AC-to-package matrix plus a plan lint: every gate item in 50-plan.md names a file and an owner (L-019 reopened by the size test, licence file, offline/engines scripts found only at acceptance).
2. Perf budget per package and a bench gate with 5 runs as a release gate, owned by a named role (L-020, L-034); decide whether the orchestrator's quiet-machine run is a role or a CI job.
3. Resolve the two modes in implementer.md (branch + PR in a real repo versus orchestrator commits in the experiment) into a stated mode (L-033).
4. Add a message id/`brief` key to human-log rows so a test can reconcile the log with 00-brief (L-037); make portal coverage fail for a shown source with no probe (L-036).
5. Consider whether the adversarial pass is worth its cost on low-risk balance/polish rounds (R6: 7 minor findings for 373 k tokens and 128 min; E1) versus a lighter targeted attack on changed code only; decision for harness-reviewer with R7 data.
6. Contract template with columns: value domain, feasibility confirmed by, consumer tables, tests affected and owner (L-026, L-039, L-022).
