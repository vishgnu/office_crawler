# R7 acceptance (customer-proxy, PROXY, 2026-10-14)

Role: customer-proxy (delegation recorded in STATE.md). Everything below is provisional until the real customer reviews it. Judged against the briefings verbatim in `00-brief.md` (sixth briefing, the customer decisions of 2026-10-14, the "flawless gameplay" rounds) and the R7 plan items in `50-plan.md`.

## Verdict: ACCEPT WITH FOLLOW-UPS

Nothing is rejected. The quest journal does what the customer asked, the AI standoff fix and the floor-entry smoothness hold up in play, and the 3 main + 5 side quest model works end to end through the real UI. The difficulty curve is no longer one cliff at floor 5, but my scripted heroes still died a lot on floors 1 to 5, and a full bag can block the quest rewards the game leans on. Both go to R8.

## What I did

- `npm run build`, then `dist/index.html` opened from file:// in Playwright 1.56.1 / preinstalled Chromium (the run itself proved the file:// path works; `play/README.md` carries the note the customer asked for).
- Orchestrator's numbers taken as given (npm test 1141 x3 with 1 todo, e2e 17/17, bench fps50 median 55.8, floor-2 entry 61-62 lazy draws as a soft WARN). I did not re-run them.
- Played Facilities Manager, Sales Rep and IT Wizard through the real UI (create character, Lobby, real mouse clicks on NPCs, tiles and monsters, key presses for J / I / C / S / belt, dialog buttons, hand-in buttons, the respawn button). A script played the clicks like an eager player: attack anything within 7 tiles that it can reach, awake monsters within 12, drink at 40 % health, spend attribute and skill points through the panels, buy potions and equip gear in the Lobby, follow map markers, climb back to hand in. Seeds 7, 3 and 11, about 110 game minutes in total, floors 1 to 5 (no class got past floor 5; see feel notes). `window.__app` was used for setup only: a time-stepped clock, state reads, the floor-entry timing, and `quests.setStep` to put the later quests into the ready state for the hand-in screens (sq4 and sq5 sit on floors 5 and 6, which my heroes did not live to clear).
- Limits of this evidence: one scripted player is not a person. It never uses F2-F4 skills except a right-click, never kites, picks up everything, and (first runs) did not sell junk. Where that matters I say so.
- Shots: `docs/shots/accept-r7-*.jpg` (75 files; I looked at the ones named below).

## Per item

### R7-0 Quest journal, next step, 3 main + 5 side quests (sixth briefing + decision 8): ACCEPT WITH FOLLOW-UPS
Evidence (all through the UI):
- Briefing: "a place to look at the quest and the next step to solve for them". The journal opens with J, the HUD "Journal J" button and the pause entry; it lists the pinned main quest first with blurb, "Step 1/3", "Next step" and the reward, then the five side quests with giver, progress, next step and reward, then the two locked main quests ("Locked. Finish X first."), a quest-items section and a Completed section (`accept-r7-journal0.jpg`, `accept-r7-fm-journal-accepted.jpg`, `accept-r7-q-journal-after-all.jpg`).
- The next step is concrete and changes with the game: "Take the lift down." -> "Follow the power cables down to floor 3." -> after the arc, "The Paper Trail: Reach floor 4. Visit the Lobby first: the staff may pay in gear." Ready quests read "Return to First Aider in the Lobby with the badge." (`accept-r7-sr-journal-ready-d3.jpg`).
- Tracker under the minimap always shows one line (pinned quest); toast and "!" badge on the Journal button appear when a step changes. Marker on the elevator in the Lobby; the Lobby givers carry "!" marks until accepted, then "?" when ready (`accept-r7-lobby.jpg`, `accept-r7-q-vendor-two-ready.jpg`).
- Lobby: accepted all five side quests by clicking the NPCs and the Accept buttons (vendor offers two quests, Intern Overflow and Slide Deck Surplus, each with its own Accept/Decline, stock still below; stash keeper offers The Misfiled Ledger).
- Played hand-ins in real play: Intern Overflow (all three classes, ready after about 1.5 to 2 minutes on floor 1, walked back up, handed in, +60 gold +90 xp + 3 potions); The Missing Badge (badge picked up on floor 3 in real play, ready state in journal, hand-in dialog reached); Toner Tyrant ready on floor 4 in real play. Hand-in screens for all five via setup: gold, xp and gear lines in the toast, state "completed", journal moves them to Completed, tracker back on the main quest (`accept-r7-q-after-*.jpg`).
- Main quest arcs: arc 1 pays on reaching floor 3 ("Why the Lights Went Out: completed (50 gold, 65 experience)"), the tracker then moves to "The Paper Trail" and the next arc unlocks; verdict button not reached (needs the boss; covered by the orchestrator's tests, not played by me).
Follow-ups:
- **R8-Q1 bag full blocks a hand-in that the game needs.** Both Sales Rep and IT Wizard (bag 13 to 16 items of mostly picked-up junk) got "Your bag has no room for the reward. Free some space and try again." on The Missing Badge and Toner Tyrant repeatedly and never got the armour/weapon reward; both then died 4 to 5 times each on floors 4 and 5 (`accept-r7-sr-handin-after-sq2.jpg`). The message is clear and the alert is in the dialog, but the player has to sell or stash first, and the plan counts on those rewards before floor 5. Suggest: reward goes to the quest pouch / ground at the NPC when the bag is full, or the dialog offers "Sell junk" in place. (The orchestrator's R7-4.1 notes show the same bag-full case exists in the bot's code path.)
- R8-Q2 the vendor dialog, the inventory drawer and the journal can all be open at once: after any NPC dialog the "Desk Drawer" stays open and on a 1280x720 window the hero is squeezed into a third of the screen (`accept-r7-fm-journal-accepted.jpg`). Close the inventory with the NPC window, or do not open it for quest-only dialogs.
- R8-Q3 minor: handing in two quests in one dialog (vendor) shows the first quest's toast text again for the second hand-in (gold is right: +60 then +120). The toast queue holds the second behind the first; fine, but the first line looks like a repeat.
- R8-Q4 minor: after "step 3/3" the journal still shows the active main quest with step text until floor 3 is reached; reads fine.

### R7-1 AI: hero ignores clicks / standoff (R6 follow-up F1, new retarget rule): ACCEPT WITH FOLLOW-UP
- No standoff reproduced in about 110 game minutes of scripted play on three classes and three seeds (the R6 case was Facilities Manager, seed 5, floor 1). The hero did not freeze on a held target in any trace I took.
- Do clicks get ignored? Over 249 to 400 clicks per class, 3 to 6 % ended with a different target than the one I clicked after 8 ticks. These are in crowds where sprites overlap (the click resolves to the neighbour), not the 1 s retarget rule, which cannot trigger in 8 ticks. I could not prove either way from the outside, so this is a feel note, not a defect.
- Unproven worry (one state dump, no tick trace): Facilities Manager, seed 7, floor 2, hero idle at one tile for about 30 decisions with two monsters adjacent and attacking, my script re-clicking a monster one ring behind them every 0.7 s. Each new click resets the stand timer, so a player who keeps clicking an out-of-reach monster in a crowd may see the hero not hit the adjacent attackers. I could not reproduce it on the next run. **R8-AI1**: add a deterministic test (two adjacent attackers, re-click an unreachable monster every 30 ticks for 4 s; the hero must hit an adjacent attacker within 1.5 s regardless of the re-clicks).
- Hero with no target and attackers adjacent stands idle: that is the click-to-attack design and I leave it.

### R7-2 Floor-entry stutter: ACCEPT
Real-time loop (rAF gaps) in Chromium with the game's own loop, entering floors 1, 2, 3, 5, 6 (Sales Rep, 5 to 8 s between entries, one skip 3->5 as the worst case): p50 16.7 ms, p99 16.8-33.4 ms (one vsync step), worst frame 33 to 66 ms, one 100 ms frame on the very first Lobby->floor 1 entry, no run of long frames. That matches the orchestrator's bench (soft WARN 61-62 lazy draws on floor 2). To a player the descent no longer stalls; nothing I would complain about. Follow-up (soft, R8-T): the lazy-draw WARN can become a hard check once a run on a calm machine confirms it (note in R7-stutter.md already).

### R7-3 Follow-ups from the R6 acceptance
- F1 hero standoff: see R7-1 (accept with R8-AI1).
- F2 floor 4-6 step / "spread the difficulty" (decision 6): ACCEPT WITH FOLLOW-UPS, see feel notes. The single cliff at floor 5 is gone for a hero that follows the quests; the death pressure now begins on floor 1 and rises. The balance report's own numbers (deaths 0,4,2,5,2,6,2,8,7 per floor over 72 bot runs, parity 25.9/26.2/24.8 min) agree with the shape I saw. My heroes were rougher than the bot (14 deaths in 31 min for Sales Rep without gear rewards).
- Gate lines (size ceiling, ASSET-LICENCES, offline/engines): not re-checked by me; dist is 667 KB, shots 120 KB each.
- Decisions kept: AMBIENT_LIFT +12 % is in `light.js` and the look in every shot is the same moody-but-readable one; sound kit and respec untouched; quest names/texts kept; file:// note in `play/README.md`. No conflicts with the customer's earlier answers.

### R7-4 Three main + five side quests: ACCEPT
- Journal shows all eight (three main in order, locks, five side), the vendor gives two quests in one dialog, the stash keeper gives the ledger, each quest has its own Accept / Decline / Hand in and its own reward line (the ring/amulet/belt reward for Slide Deck Surplus is shown as such). The slot card and the save were not exercised by me beyond the Continue/respawn path.
- Optional 5th Lobby character: no change; my recommendation below.

## Feel notes (floors 1 to 6)

All numbers are my scripted players; a person who explores more slowly and avoids packs will do better. "Hero level" is at the time.

| class | floor 1 | floor 2 | floor 3 | floor 4 | floor 5 |
|---|---|---|---|---|---|
| Facilities Manager (seed 7) | 3-4 min, lowest hp 44-74 %, one level-1 death at 1:18 in an earlier run | 4 deaths (level 3) even after buying potions; with junk sold only 1 death | reached at 8 min in the best run | not reached | not reached |
| Sales Rep (seed 7) | 3.6 min, 76 % | 3.8 min, 29 % | 5 deaths, 8.1 min, low 8 % | 5 deaths, 9.4 min, low 5 % | 4 deaths at level 8, no gear reward (bag full) |
| IT Wizard (seeds 7, 3) | 3.6 min, 35 %; seed 3 one death at level 1, 1:28 | 3.0 min, 33 % | 5 deaths, 7.4 min, low 15 % | 8.4 min, low 21 % | 4 deaths at level 8-9 |

- **Is the curve smooth?** Compared with R6 (nothing hurts until floor 4, then a wall at 5) yes: damage and deaths now rise gradually, floor 5 is just the hardest of three hard floors rather than a step. It is no longer "painless to floor 4". Quests-on matches the balance report; quests-off is still the wall at floor 5 (32 deaths, from the report), which is the open customer item.
- **Is there still a wall?** For a hero that cannot collect the floor 3 to 4 quest gear: yes, floors 4 to 5 (my two ranged/skirmish classes died 4 to 5 times on each). That was largely a full bag blocking the hand-in (R8-Q1), so it is a UX wall more than a number wall.
- **First minute:** the 1:18 and 1:28 level-1 deaths (Facilities Manager seed 7, IT Wizard seed 3: a pack of 6 to 8 interns and imps woken at once, both starting potions gone, 3 kills) are the roughest moment for a new player. Both were my script walking up to a pack, but a first-time player does the same. Floor 1 should read as a tutorial. **R8-B1**: shrink or split the first pack on floor 1 (or wake packs one monster at a time) and check the first 90 seconds per class with a naive clicker.
- **Death spiral at the lift:** respawn -> Lobby -> elevator brings you straight back to the same entry. Sales Rep died four times within 12 to 35 seconds of arriving on floor 4 (after 18.0 to 19.1 min) because the entry has two awake monsters within 8 tiles; a level 8 hero standing still lost 112 -> 34 hp in 10 s there (probe on seed 7). Also IT Wizard five deaths on floor 3 in 4 minutes. **R8-B2**: a short grace after floor entry or put awake packs out of the entry radius; consider offering "restock first" (a prompt in the Lobby when the belt is empty).
- **Potions:** 48 gold each at the start with 50 gold in the pocket, and bought potions land in the bag, not on the belt (needs a right-click). A new player will notice the first part. R8-B3: price the first two potions lower or give a free refill after a death; auto-belt bought potions.
- **Pacing in time:** level 2 after about 1.5 minutes, level 4 by minute 5, level 8 around minute 25 for a hero that picks fights. A floor takes 3 to 8 minutes for my player; with all quests plus three deaths per floor the 20-40 minute run target is exceeded by this scripted player (about 31 min to floor 5), but that is the dying, not the design.
- **Visuals/readability** were fine in every shot: floor entry, panels and the journal are readable; the toasts and tracker did not overlap the hero.

## Follow-ups

For R8 (gear visuals + flawless gameplay):
1. R8-Q1 bag-full hand-in (reward to pouch/ground or sell junk from the dialog). High.
2. R8-B1 floor 1 first pack and the first-90-seconds check. High.
3. R8-B2 floor-entry safety after the lift (awake monsters near entry; death spiral). Medium.
4. R8-B3 first potions price and auto-belt for bought potions. Medium.
5. R8-AI1 deterministic re-click-in-crowd test and, if red, the retarget fix. Medium.
6. R8-Q2 close the inventory with the NPC window; R8-Q3 toast queue wording on double hand-in. Low.

For R8-T (end-to-end and polish):
1. Add a human-like e2e that runs one class to floor 4 by real clicks (shop, hand in, equip) and asserts: no standoff, bag-full path, first-90-second survival, no repeated deaths within 30 s of re-entry.
2. Floor-entry lazy-draw WARN to a hard limit once measured on a calm machine.
3. Play floors 6 to 9, the boss, the verdict button, sq4 and sq5 by real play (my heroes did not survive floor 5, so these were only checked through setup).
4. The gate-line leftovers from R6 (size number, ASSET-LICENCES.md, engines/offline): confirm closed.

## Recommendations for the real customer (not decided by me)

- **Quests optional or intended?** Recommend intended, and say so in the game: the Lobby already points at the quests and the next step is always on screen. A no-quest player still hits the floor 5 wall (32 deaths in the report); softening that would cut into the quest rewards the plan relies on. Fix the UX that stops rewards (bag full) first.
- **Optional 5th Lobby character:** recommend no. The vendor's two quests read naturally (the offer text makes sense from the office-supplies giver), and a new character costs about 250 lines plus art and one more golden re-pin for little player value.
- **Portal-overview variant pick:** harness item, I have nothing from this round to add; the earlier recommendation stands.
- To check in the game yourself: the first minute of the Facilities Manager and IT Wizard (can a new player survive the first pack?), the lift trip after dying, and whether 48 gold per potion with 50 gold at the start feels right.
