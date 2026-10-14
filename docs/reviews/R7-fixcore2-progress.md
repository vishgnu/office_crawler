# FIX-R7-CORE-2 progress
- done: ADV-R7-07 questDef (own-property lookup) in questPin/questAccept/questHandIn/handInQuest and cheats setQuestStep/completeQuest; todo flag removed
- done: ADV-R7-08/09 schema (format.js): kill quest progress > 0 needs deepestDepth >= first kill floor; sum of kill quest progress <= stats.kills; cheat setQuestStep keeps the sum legal; todo flags removed
- done: ADV-R7-10 topUpKills in placeQuestObjects (last kill floor, questRng purpose 6, only while the kill quest is active); tests in quests-sq45 (1000 seeds); sq1 needs none (min 13 interns on 3000 seeds)
- done: chase orbit reproduced headless (ring, equal speed, ranged and melee heroes; 37 of 2897 random maps), fixed in intent.js (hold for a chaser with no line to it, config.holdFarTicks 480), test/chase-orbit.test.js
- next: npm test, goldens, build, e2e, parity
- done: intent.js hold-far limited to chasers that arrive within holdFarTicks (a very slow chaser is not waited for: r7-ai CR7-03 test stays unchanged); save sum rule limited to finished kill quests (active p fixtures stay legal)
- done: npm test x3 green (1142 tests, 1 todo = generator-level ADV-R7-10 test kept), goldens unchanged (no re-pin needed), build ok, e2e all green (1523 PASS), parity 72/72 wins, quests 72/72, 0 give-ups, medians 25.2/26.1/24.9
