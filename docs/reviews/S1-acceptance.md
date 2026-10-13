# S1 acceptance (slice "playable core")

Date: 2026-10-13. Acceptor: `customer-proxy` (delegation: `product/00-brief.md`, "Delegation record"). **PROXY decision, provisional until the real customer reviews it.**

## Decision: ACCEPT WITH FOLLOW-UPS (confidence medium)

Visual acceptance of the in-game build is **pending** `reviews/S1-visual-review.md` (not present when this was written). If that review reports blocking visual defects, this acceptance is void for the visual part and the slice returns to the implementer.

## Checks run by me (2026-10-13)

- `npm test`: 120 tests, 120 pass, 0 fail, 0 skipped.
- `npm run e2e` (Chromium; Firefox and WebKit are not installed here and print SKIP): all 7 scripts pass, 118 checks (smoke 14, hook 21, render 29, combat 26, input 15, replay 5, realtime 8).
- Review trail: `S1-code-review.md` had 1 blocking (B1, button stuck "down" after pause) plus 6 should; Resolution and Resolution 2 sections show all fixed or deferred-and-then-fixed in the style port, with tests that fail when the fix is reverted. No open finding remains except the items below.
- Bot (`S1-bot-report.md`): careful profile 30/30 floors cleared; browser via `window.__app` 5/5 cleared, 0 page errors; reckless profile dies on about 10% of floors (design baseline, not a defect). One residual orbit case is open (follow-up).
- Screenshots `shots/s1-ported-{1920x1080,1280x720,390x844}.jpg` viewed: isometric open-plan floor, mug and water-cooler gauges with numbers, skill bar F1-F4, belt 1-4, target bar, nameplates with health, damage floater and "miss", lit pool around the hero, dark fog elsewhere. Readable at 1280x720 and 1920x1080; on 390x844 the plates stack but stay legible (leader lines work).
- I did not play-test live in a browser; judgement of feel is from the screenshots, the bot's TTK numbers (mean 0.8 s per monster) and the e2e real-time checks.

## AC evidence map (104 S1-tagged ACs in `product/30-spec/`)

Covered ids are named in test titles (`test/*.test.js`) or e2e check names (`e2e/*.mjs`); 88 of 104 are cited by id there or in the reviews. Representative map:

| ACs | Evidence |
|---|---|
| AC-R-001-1/-2, AC-R-110-1/-2, AC-R-076-1 | `e2e/smoke.mjs`, `e2e/hook.mjs`, `e2e/replay.mjs` |
| AC-R-002-1, AC-R-005-1/-2/-6/-7, AC-R-020/021/023/032/034 families | `test/{movement,combat,ai,scene}.test.js`, `e2e/combat.mjs`, `e2e/input.mjs` |
| AC-R-005-8/-9, AC-R-042-1..-4, -6, AC-R-120-3, AC-R-101-1 | `test/{path,gen,los,spatial,iso}.test.js` |
| AC-R-112-x, AC-NFR-B02-1 (by reference to R-112-3), AC-NFR-B01-1 (by reference to R-110-1/-2) | `e2e/render.mjs` (three viewport sizes, atlas, click round trip), `e2e/smoke.mjs` |
| AC-R-113-x, AC-NFR-A02-1 | `test/clock.test.js`, `e2e/realtime.mjs` (pause stops ticks) |
| AC-NFR-Q01-1/-2, AC-R-121-x, AC-R-123-x | `e2e/replay.mjs` (frozen golden hash equal in Node and Chromium), `e2e/hook.mjs` |
| AC-NFR-O02-1 | `e2e/realtime.mjs` (only file:/data: requests) |
| AC-NFR-L01-1/-2, L04-1, AC-R-030-3 (registry names vs denylist) | `test/legal.test.js`, `test/ip-denylist.test.js` |
| AC-R-102-2, AC-NFR-A06-1 | `test/strings-used.test.js` |
| Pause, held mouse, resize, Tab focus (review B1, S1, S2, S6) | `test/movement.test.js`, `e2e/input.mjs` |
| Perf budgets (AC-R-042-4, AC-R-122-2) | `npm run bench` (moved out of unit tests on purpose) |

## Gaps (S1-tagged ACs with no evidence I could find)

| AC | What is missing |
|---|---|
| AC-R-010-1, -2, -3 | One melee class in `content.classes`; `newGame(seed,{class})` default. Only `config.js` start values exist; no class registry, no test. |
| AC-R-011-1, -2 | Attribute keys `grit, agility, stamina, focus` exist in state (`src/core/state.js`) but there is no test, and no attribute-to-stat effect test. |
| AC-R-012-1, -2, -3 | No `deriveStats` function and no tests (the plan itself schedules R-012-1 in S2-2 and R-010..016 in S2-3, but the spec tags them S1). |
| AC-R-042-5 | No test that two `newGame()` calls without a seed give different `floor.seed`. |
| AC-NFR-S01-2 | No build test for "no server-side files in dist" plus CSP meta (planned `test/build.test.js` is absent). The code review verified the CSP by hand and e2e shows no console errors under it. |
| AC-NFR-L05-1 | No separate real-brands denylist scan; the one denylist is scanned (L01-1). Confirm that the denylist contains real brands or add a list. |
| AC-NFR-L03-1 | No e2e that scrapes visible title-screen text against the denylist (string table is scanned in unit tests, which is close but not the AC). |

None of these affects whether the slice plays; the character-sheet items are S2 work that the spec tagged too early. I accept them as follow-ups because the plan assigns them to S2-2/S2-3, and I require them to be closed (or retagged S2 by the spec-writer) before the S2 acceptance.

## Follow-ups

1. Close or retag the gaps above (spec-writer retags R-010..R-012 to S2 if the architect agrees; add 4 small tests for the rest).
2. Visual review (`S1-visual-review.md`) must be read before the real customer sees S1.
3. Residual mutual-pursuit orbit at 3+ tiles (bot report finding 2): needs its own change and a new golden replay.
4. Difficulty baseline: reckless play dies about 10% of floors with no healing in S1; balance in S2 once potions arrive.
5. Firefox and WebKit have never run here (SKIP); run them where installed before release.
6. Q1 (how close names/visuals may go to the original) is still ESCALATED to the real customer; strict originality stays in force.

## As the customer

- **Genre feel:** yes. Isometric dungeon crawl read through an office: mug as life, water-cooler jug as mana, click-to-move, click-to-attack, hold-to-walk, nameplates with health, damage numbers, hit-stop, dark fog with a lit pool around the hero, monsters that notice and chase. Printer Imp (paper wings, cables) and Zombie Intern (lanyard, mug) are funny and instantly readable; the yellow tie and keyboard sword make the hero charming. The office props (cabinets, crates, desks with monitors, red chairs, blood scuffs on teal cubicle walls) sell the setting without a word of text.
- **Fun for a first slice:** a floor takes about a minute and kills take under a second on average, so it is snappy; but with no loot, no skills beyond Strike, no healing and no stairs it is a tech demo of the combat loop, not yet a game one replays. Four empty skill slots and an empty belt are visible promises.
- **Weak spots I can see:** only two monster types (imp, intern) so floors feel the same after a few; the death/restart loop has no pull; only the first screenshot moment was judged, not long play.

## Customer wishes for S2

1. Loot that drops and can be picked up, with rarity colours (the palette is already prepared): the single biggest pull of the genre.
2. Level-ups with a visible reward, and at least two more skills to fill F2 to F4.
3. Health and mana potions on the belt so fights have decisions.
4. A town/lobby with a vendor and stairs down to more floors, with deeper floors getting harder.
5. A third and fourth monster type, including a ranged one and a stronger "boss-ish" one (the Middle Manager is already planned), plus champion variants.
6. Sound (hits, pickups, ambience), as the customer asked for nice sound and graphics.
