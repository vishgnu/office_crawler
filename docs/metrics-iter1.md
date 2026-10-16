# Metrics: iteration 1 (slice S1, playable core)

Collected by the orchestrator from the subagent completion reports (tokens = subagent tokens; time = agent wall time).
Raw input for the agent-vs-traditional scorecard (`../agent_harness/11-operating-model.md`). All agents ran on Sonnet;
the orchestrator ran on Opus.

| Step | Agent | Tokens (k) | Minutes | Output |
|---|---|---|---|---|
| Circle 1 | requirements-facilitator | 76 | 2.6 | 79 requirements, 7 questions, readiness 9/20 |
| Circle 1 answers | customer-proxy | 59 | 0.4 | 6 answers, 1 escalation |
| Spec | spec-writer | 140 | 8.2 | 341 ACs (S1 104), see L-03 |
| Architecture + plan | architect | 131 | 5.8 | 4 ADRs, 18 work packages |
| Spec questions | customer-proxy | 83 | 2.1 | 65 answers |
| Art variants A/B/C | prototyper | 258 | 23.3 | 3 animated style tiles |
| Visual review r1 (×2) | visual-reviewer | 156 | 2.4 | 2 reviews, both pick C |
| Art pick | customer-proxy | 75 | 0.6 | decision + 12 must-fix items |
| Art round 2 (C2) | prototyper | 199 | 14.2 | C2, 29 → 54 fps |
| Visual review r2 (×2) | visual-reviewer | 175 | 3.2 | ship 33 and 32/40, port checklist |
| Core S1-1..3 | implementer | 205 | 11.6 | pure core, 86 tests |
| Render/loop/hook S1-4..5 | implementer | 226 | 14.2 | first playable, e2e 89 checks |
| Code review S1 | reviewer | 108 | 2.4 | 1 blocking (real bug), 6 should, 6 nit |
| Review fixes | implementer | 97 | 3.3 | B1 fixed, 99 tests |
| Style port + S1-6 | implementer | 428 | 44.2 | ported look, bot, bench, 118 tests |
| **Total (agents)** | | **≈ 2,416** | **≈ 139** | plus orchestrator time |

Notes
- Calendar time from intake commit to the S1 build: see `git log` (intake 26a676d at 19:46 → style port 9ada7b1 at 21:26 UTC), **1 h 40 min elapsed**
  with many steps running in parallel.
- Human time spent: 0 minutes on S1 decisions (all decisions by the proxy, logged in `product/proxy-log.md`), plus
  the user's short instructions.
- The biggest single costs were art (prototyper rounds: 457k tokens, 37 min) and the style port (428k, 44 min).
  Visual quality was the expensive part, as the customer asked for.
- Quality signals: an independent code review found 1 real blocking bug that the tests missed (L-08); the bot found
  1 AI/pathing bug (orbiting) that was fixed.
