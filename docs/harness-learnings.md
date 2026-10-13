# Harness learnings from Office Crawler

Each entry: what happened, what it says about the harness, what was changed (file + commit) or proposed.

| # | Date | Observation | Harness change |
|---|---|---|---|
| L-01 | 2026-10-13 | The first non-web-app target (static browser game) has no stack pack; `node-postgres` assumes a server and DB | Added `harness/stack-packs/static-web/` (single-file build, seeded RNG, test hook, Playwright smoke, SWA preview workflow) |
| L-02 | 2026-10-13 | The user wants an agent to stand in for them; the facilitator's rule "never answer on the user's behalf" had no sanctioned exception | Added `customer-proxy` agent with a delegation record, PROXY tags and an escalation list |
| L-03 | 2026-10-13 | The spec-writer produced 341 acceptance criteria for a game MVP (S1 104 / S2 165 / S3 72). Every AC is automatable, but the volume slows review and implementation, and many ACs assert UI details nobody asked about | **Applied** to `harness/.claude/agents/spec-writer.md` |
| L-04 | 2026-10-13 | The facilitator's spec questions arrive after circles end; with a proxy they can be answered at once, but there is no file convention for post-circle questions | **Applied** to `harness/07-requirements-circles.md` |
| L-05 | 2026-10-13 | The architect and the customer-proxy ran in parallel and both decided the same open spec questions (e.g. skill keys: QWER vs F1–F4 + right mouse; boss on floor 8 vs a separate arena) | Rule: open questions have ONE owner. Customer-facing/UX/scope questions go to the customer (or proxy). The architect only lists them and may decide technical ones. When they conflict, the customer answer wins. **Applied** to `harness/04-agents.md` and `architect.md` |
| L-06 | 2026-10-13 | A unit test with a 50 ms wall-clock threshold failed 1 run in ~12 under parallel load. The orchestrator caught it only by re-running | Rule added to `test-engineer.md` and `implementer.md`: no tight wall-clock assertions in unit tests; bound work (node/iteration counts) instead; performance goes to a separate benchmark. Run the suite ≥3× before handing back |
