# R6 acceptance (customer-proxy, 2026-10-14)

**PROXY** acts for the customer under the delegation in `product/STATE.md` / `00-brief.md`. Everything here is provisional until the real customer reviews it. Not decided here (still open for the real customer): sound kit by ear, respec rule, AMBIENT_LIFT +12 %, the G gate overrule, the file:// note, the portal-overview pick.

## Verdict

**ACCEPT WITH FOLLOW-UPS** for round 6. Three classes are inside the parity band on clear time, the skill trees, selection screen and five slots work in my own play, R5's follow-up list is closed, and the R5-save refund notice is clear. What stays open goes to R7: a hero standoff I saw in real play, the floor-5 difficulty step, one-death spread for the IT Wizard, one skill at 55 % for the Facilities Manager, and three gate items I could not verify (see plan table). The visual review runs in parallel and is not part of this verdict.

## Evidence

- Read: R6-balance, R6-perf, R6-adversarial (0 blocker, 4 minor + 1 trivial, all closed per fix logs), R6-code-review (0 blocker, 8 should, fix logs read), fixcore and fixui progress. Orchestrator at HEAD: npm test 770/0 x3, e2e 14 scripts green, bench fps50 median 52.9 (target 40), atlas 0.4-0.55 s.
- My own play: `npm run build` (dist/index.html 613 KB), Playwright 1.56.1 with the preinstalled Chromium, `file://`, `?test=1` only for floor jumps and `setLevel`; creation, attributes in the Employee File, learning, F1-F4, respec, saving, slot switch and load all went through the real UI. No page error in any run. Shots `docs/shots/accept-r6-*.jpg` (16 files, 54-145 KB), all looked at.
- Feel runs (8 game minutes each, a scripted player that clicks like a person, no gear shopping, floors skipped by jump only after the floor was cleared): see "Feel".

## Per R5 follow-up (my list from last time)

| # | item | result |
|---|---|---|
| 1 | Class balance, Sales Rep weakest | Closed. Parity table 24 seeds: FM 27.0 min / SR 27.4 / IT 26.1, deaths mean 3.3 / 2.9 / 2.6. See plan item 1. |
| 2 | N5 slot manager Close clipped at 720 | Closed: `accept-r6-slots-three.jpg` shows three characters and two empty slots with Close fully visible at 1280x720. |
| 3 | N6 Paused title pushed off by banner | Closed: `accept-r6-fixture-notice.jpg` (a banner on the pause menu) shows "Paused" and all four buttons. |
| 4 | N1 pale figures, N3 beams, N4 tags | Not judged by me in detail; visual review owns it. Heroes on lit floors read clearly in my shots. |
| 5 | F5 Power Surge / Packet Filter mana | Closed with evidence: the R5 observation was a cast without an aim tile (refused, no spend) and an absorb buff. The new test covers every active skill; in my run F1-F4 selected the expected skill for all three classes (FM Pallet Slam / Floor Buffer Sweep / Demolition Day / Coffee Break; SR Stapler Throw / Pen Volley / Business Card Fan / Summer Intern; IT Server Overheat / Power Surge / Blue Screen / Cold Boot). |
| 6 | Tree connectors, tier-2 Learn cut off | Connectors are there (shots `tree-*-learned`), with met/unmet colour; Learn buttons whole. Adversarial says elbows stop 2.5-8 px short (trivial, fixed per fixui). |
| 7 | Select screen: unchosen figures, wrench, FM tint | Select shots now show all three at readable size with a wrench flourish and spotlight on the chosen one (`select-sales-rep`). Accept. |
| 8 | Respec confirmation; "Deepest: Lobby" label | Respec now asks first and names the refund ("Reset all skills? You get 16 skill points back"), shot `respec-confirm`. Label: slot card for a level-17 hero says "Deepest floor 2", correct. |
| 9 | No-cheat full run per class | Partly: 8 min per class by a script, not a full run (see Feel). Left for R7-8. |

## Per briefing item

### 1. "3 player classes with skill trees" - ACCEPT WITH FOLLOW-UPS
- Create via UI, three classes, level 17 (setup) with 80 attribute points and 16 skill points each: all spent through the real Employee File and Skills panel, 0 points left, F1-F4 auto-filled with the learned skills and each key selects its skill.
- The Employee File now describes the class truthfully: IT Wizard "Focus raises damage and mana", "Grit needed by some gear; no damage for your class" (code review CR6-01 fixed, shot `employee-file-it`). Level 17 damage with my allocation: FM 27-30 (Grit 56), SR 39-42 (Agility 56), IT 32-34 (Focus 60); health 444 / 313 / 307, mana 62 / 100 / 244. The three play as three different characters.
- Respec in the Lobby: confirmation names the refund, takes back 16 points, keeps the signature skill; the bar did not break.
- Parity (24 seeds each, bot): clear time FM 27.0 (22.5-38.6), SR 27.4, IT 26.1 min, all inside 25 % of 27.0 and in the 20-40 min target; wins 23/24, 24/24, 24/24. Open and honest in R6-balance: (a) IT median deaths 2 against 3 is one death out of band on the median rule (means 2.6 vs 2.9, in band); (b) Pallet Slam is 55 % of Facilities Manager tree damage (threshold 50 %); (c) one FM run lost to the boss in budget. I accept (a) as a metric artefact and (b), (c) as small; follow-ups R7-F1.
- Deaths cluster at the boss and floors 6-9: bot deaths by depth FM d9 28 of 79.

### 2. "visually appealing character selection screen" - ACCEPT
`select-*` shots: lobby with skyline and lift, spotlight cone, three figures with class colour rings, stat bars, three branch cards with skill names, name field with Suggest, Start with a hint, Load and Back, slot note. Switching class changes the info panel and the spotlight. Finished and on theme. (R5 said the same; polish items are in.)

### 3. "5 save slots in the options menu" - ACCEPT
Three characters created in slots 1-3 (pause menu "New character here"), the list shows portrait, name, class, level, deepest floor, time, last played, "PLAYING NOW", Load / Rename / Export / Import / New character here / Delete, empty slots offer New and Import, storage used shown. Loading slot 1 from the pause menu (with its confirmation) brought back the Facilities Manager with the same attributes (grit 56 / stamina 54), the 6 learned skills at the same levels and the same F1-F4 bar. R5-save fixture `save-v2-r5-it.json`: Continue loads the level-14 IT Wizard with 65 attribute points returned, the Employee dock shows a 65 badge and the Skills dock 13, and the pause menu says "Your attribute points were refunded because your class now scales from Focus. Spend them again in the Employee File." with a Dismiss button. Clear, one time, not scary. Save format v3, reload with no second refund (adversarial).

### 4. "more graphics detail" / "nice graphics" - ACCEPT (pending the visual review)
In game at 1280x720 the floors are as detailed as at G3 (lit pools, panels, windows, vending machine, chairs, plants, ring and shadow under the hero); faces on the three heroes are readable in every shot I took. Performance is the new news: fps50 median 52.9 on the orchestrator's quiet run (R5: 43.9), mask fast path and per-floor warm-up. Not mine to judge: the parallel visual review score and AMBIENT_LIFT.

### 5. "nice sound" - NOT PART OF THIS ACCEPTANCE
No sound change judged. The kit pick stays with the real customer.

### 6. "close to the original in mechanics" - ACCEPT
Unchanged from R5. R6 made the casters scale from their own attribute, as in the genre (a spell class that scales from the mana attribute); tier-3 skills are reachable inside a run (level 16 at the median).

## Per R6 plan item ("three classes each within the parity band, full acceptance run, size/legal/offline gates green, visual review closed")

| item | verdict | evidence |
|---|---|---|
| Three classes each within the parity band | ACCEPT WITH FOLLOW-UPS | table above; IT deaths median and FM dominant skill noted; release gate uses the clear-time and mean-deaths band as proposed (R6-balance section 3, orchestrator's call) |
| Full acceptance run | ACCEPT | npm test 770/0 x3, e2e 14/14 (orchestrator), my own run of the whole UI path with 0 page errors; fixes of the adversarial and review findings logged |
| Size gate | ACCEPT WITH FOLLOW-UP | dist/index.html 613 KB, screenshots all under 300 KB; I found no automated size ceiling test (the plan names `test/size.test.js`); ask for one number and a test |
| Legal gate | ACCEPT | `test/legal.test.js` and `test/ip-denylist.test.js` are in the 770 green. `ASSET-LICENCES.md` named in the plan does not exist in the project (all assets are generated in code, per the customer addendum); a one-line file would close the plan item |
| Offline gate | ACCEPT WITH FOLLOW-UP | `e2e/smoke.mjs` checks that only file:/data:/blob: requests are made (AC-NFR-O02-1) and it is green; `e2e/offline.mjs` and `engines.mjs` named in the plan are not there and R6 did not run three engines. Say so in R7 or drop the line from the plan |
| Visual review closed | NOT JUDGED | runs in parallel; this verdict does not wait for it |
| Synergies (a "could") | NOT DONE, ACCEPTED | plan lists them as first to drop; tooltip data hook exists in `skillfx.js`; nothing visible to the player |

## Feel (monster scaling and XP curve changed for every class)

A scripted player (nearest-monster click, potion below 40 % health, an F1 skill when mana allows, points spent through the UI each level, no gear change, no shopping, floors cleared before moving on), seed 5, 8 game minutes each. Real numbers:

| class | level 2 | level 5 | level 7 | floors cleared in 8 min | deaths | near-deaths (< 25 % hp) |
|---|---|---|---|---|---|---|
| Facilities Manager | 0.5 min | 3.2 min | 6.0 min | 3 (died 5x on floor 5) | 5 | 7 |
| Sales Rep | 0.8 min | 3.3 min | 5.6 min | 4 | 4 | 4 |
| IT Wizard | 0.4 min | 2.8 min | 4.4 min | 4 | 1 | 2 |

- **Too fast early?** Level 2 after about 25 to 50 seconds of fighting (26 kills; 136 xp) and a floor per 1 to 1.5 minutes feels very quick against the original's slow start, but it fits the customer's own shape (a 20-40 minute run, parity band) and floors 1-4 never hurt: zero deaths and zero near-deaths for any class until floor 5 in my runs. I would not call it too fast; I would call floors 1-3 a gentle tutorial. A real person who explores, loots and shops will be slower than my script.
- **Too punishing?** Floor 5 is a step: all three classes died there at level 7-8 in about a minute of fighting, FM 5 times, SR 4, IT 1. My script never changed gear or restocked potions (2 potions used all run), so a human with loot and town trips will do better, and the bot parity says 2-3 deaths per whole run. Still, the jump from "nothing can hurt you" (floors 1-4) to "dead in 40 seconds" (floor 5) is something a real customer would feel. Follow-up R7-F2: a human check of floors 4-6 and a smoother step.
- **Class feel:** the IT Wizard (ranged zap, big mana) levelled fastest and died least; the Facilities Manager was slowest to kill on floor 1 (it has to walk to everything) and has the most health (84 at level 2 against 52 / 58), which matches the briefing of a tank. The Sales Rep took the most deaths at floor 5. Differences are visible, not wrong, but one scripted player on one seed is a hint, not a measurement.
- **A real stall (new finding F1):** Facilities Manager, seed 5, floor 1, one minute in: the hero stood on one tile for over 30 game seconds, action "idle", target set to one temp worker that stayed in "chase" one tile away diagonally and never arrived, while a second temp worker on the next tile attacked the hero with no answer. Health went down and potions saved the run; kills stopped (34 monsters left, unchanged). Re-targeting the attacker (my script's first fix) cleared it at once. This is the same family as the planned R7-1 (monsters that never reach the hero), seen here at level 1 on floor 1 with the first class. A person would click the other monster, but a hero that does not answer an adjacent attacker while holding a dead target looks like a bug. Please include it in R7-1: the hero should fall back to the adjacent attacker when its target has not come into reach for about a second.

## Follow-ups for R7

1. **F1 hero standoff (above)** into R7-1 (seed 5, FM, floor 1, around minute 1; the 24-seed IT seed 24 floor 8 case is the same family).
2. **R7-2 stays** (floor-entry stutter); no further perf work asked.
3. **F2 floor 4-6 step**: playtest by a person with gear; smooth the jump in monster damage or give the first potion restock earlier. Not a parity issue.
4. **IT deaths median / FM Pallet Slam 55 %**: small; either lower Pallet Slam's share (R6-balance proposes 6-7 mana) or accept. Add the 24-seed parity to the release script output as a table, as planned.
5. **Gate lines**: add a size ceiling test with one number, a one-line `ASSET-LICENCES.md` (all generated), and either run `engines` / `offline` or remove them from the plan.
6. **No-cheat full run per class by a person-like script with shopping and gear** (R7-8), now more valuable because power attributes make gear affixes matter more (R6-balance section 9: affix pools were not rebalanced).
7. **Human check of the first 5 minutes** for the Sales Rep (most deaths) before release.
8. Test hygiene: the in-game "Take back every point" text on the Skills panel is only visible in the Lobby; outside it the Respec button is simply absent in my first run (reason "not-in-town"). Worth a muted line "Respec in the Lobby" if it is not already shown. (Minor, check.)

## For the real customer

- Still yours: sound kit (listen to A/B/C), respec rule (free and unlimited today, now with a confirmation), AMBIENT_LIFT +12 %, overrule or confirm my G gate call, whether a file:// note belongs in the README, the portal-overview pick.
- New for you to know: the early game is quick (level 2 in under a minute, a floor a minute) and floors 1-4 are painless, then floor 5 is a wall for an ungeared hero. Tell us if you want the early floors slower or the wall softer.
- Players with an R5 save of the IT Wizard or Sales Rep get their attribute points back with a notice; it works, no action.
