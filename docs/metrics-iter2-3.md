# Metrics: iterations 2 and 3 (S2 loot & progression, S3 sound & finale)

From subagent completion reports. Tokens are subagent tokens, minutes are agent wall time. Everything runs on Sonnet.
Many steps ran in parallel, so elapsed time is much shorter than the sum.

| Step | Agent | Tokens (k) | Min | Output |
|---|---|---|---|---|
| S1 acceptance | customer-proxy | 94 | 7.3 | accept with follow-ups (7 AC gaps) |
| In-game visual review S1 | visual-reviewer | 129 | 14.2 | 30/40 iterate |
| S1 visual polish | implementer | 172 | 9.6 | hero ring, floaters, plates, screens |
| S2-1/2 core (items, inventory, stats) | implementer | 214 | 10.8 | 38 bases, 52 affixes, 10 uniques |
| Inventory-panel variants A/B/C | prototyper | 239 | 18.4 | 3 clickable panels |
| Inventory variants review | visual-reviewer | 88 | 1.7 | pick C (side drawer) |
| Inventory pick | customer-proxy | 70 | 0.6 | C + borrowed rules |
| S2-3/4 core (XP, skills, monsters, town, floors) | implementer | 294 | 18.5 | bot to floor 8 |
| S2 WORLD render | implementer | 369 | 29.7 | 6 monsters, projectiles, themes, loot |
| S2 UI | implementer | 419 | 49.1 | drawers, vendor, skills, HUD |
| S2 code review | reviewer | 167 | 7.5 | 3 blocking |
| S2 visual review | visual-reviewer | 138 | 5.9 | 29/40 iterate |
| S2 CORE-FIX + balance | implementer | 340 | 26.7 | blocking fixed, runs 8.6 → 23 min |
| S2 UI-FIX + map | implementer | 328 | 35.7 | map, portal UI, 44 px HUD |
| Sound variants A/B/C + measurements | prototyper | 156 | 10.5 | 3 synthesised kits, all within targets |
| Sound default | customer-proxy | 66 | 0.5 | foley (provisional; customer by ear) |
| S3-2 audio engine | implementer | 135 | 6.3 | 41 cues, limiter, spatial |
| S3 core (boss, save) | implementer | 272 | 20.0 | boss 20/20 bot wins, save v1 |
| **Subtotal** | | **≈ 3,690** | **≈ 293** | |

Quality signals
- Independent reviews keep finding real issues that the implementers' own tests miss (S2: map/portal ACs unimplemented, stash
  ungated). That justifies the reviewer step (L-08).
- The bot found balance and pathing problems that no human was there to notice: runs were too short (8.6 min) and fixed to
  23 min; orbiting monsters; corridor-ring pursuit.
- The orchestrator's own visual spot-checks found 2 defects; one was a misdiagnosis that the reviewer corrected (L-12).
