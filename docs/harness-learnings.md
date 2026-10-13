# Harness learnings from Office Crawler

Each entry: what happened, what it says about the harness, what was changed (file + commit) or proposed.

| # | Date | Observation | Harness change |
|---|---|---|---|
| L-01 | 2026-10-13 | The first non-web-app target (static browser game) has no stack pack; `node-postgres` assumes a server and DB | Proposed: `static-web` stack pack (bundle to one HTML file; preview = static hosting) |
| L-02 | 2026-10-13 | The user wants an agent to stand in for them; the facilitator's rule "never answer on the user's behalf" had no sanctioned exception | Added `customer-proxy` agent with a delegation record, PROXY tags and an escalation list |
