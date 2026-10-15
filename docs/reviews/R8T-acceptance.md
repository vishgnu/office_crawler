# R8-T acceptance (customer-proxy, PROXY, 2026-10-15)

Role: customer-proxy (delegation recorded in STATE.md). Everything below is provisional until the real customer reviews it. Judged against the seventh briefing ("do a round of e2e testing and polishing afterwards"), the "flawless gameplay" goal, my own R8 follow-ups R8-A1..A6 (`50-plan.md`) and the R8-T fixes. The test engineer's no-cheat full runs (`R8T-adversarial.md`) and the orchestrator's quiet verify (`SESSION-NOTES.md`) are taken as given and were not re-run.

## Verdict: ACCEPT WITH FOLLOW-UPS (confidence medium)

Every R8 follow-up I raised is fixed or answered, and nothing is rejected. The drawer, the click-eating box, the unique tier, the Emergency Exit, the slot cards, the death screen, the phone dock and the short landscape phones all pass by real play. Floor 2 is much better but is still the one place where a fast, careless level-2 hero can die in the first minute (see A3). That is a tuning follow-up, not a blocker, and needs no decision from the real customer.

## How I tested

- Built `dist/index.html` run from a copy (`file://`), Chromium via Playwright 1.56.1, 1280x720 unless stated. No rebuild, no git. Scripts and logs live in my scratchpad only; 12 key shots copied to `docs/shots/accept-r8t-*.jpg`.
- Input is the real mouse and keyboard: walking, attacking, looting, NPCs, vendor buying, quest accept and hand-in, drawer clicks and right-click equips, File "+" buttons, belt keys, Respawn, tap on the phone.
- Hook (`?test=1`) used for setup and reads only: the manual clock `step`, `getState`/`perf().gearSig` reads, `cheat.setLevel` / `teleportFloor` / `giveItem` (incl. `ilvl: 30` for uniques) / `setHp(0)` (to die) / `spawnMonster` (staged crowds), `quests.setStep` (make a side quest ready). The floor-2 journeys use no cheat at all: Lobby, lift by clicking the lift tile, floor 1 by clicking, floor 2 by clicking. The clicker is a scripted player (about 3 decisions a second, never retreats, drinks a potion below 45 % health, equips empty slots by right-clicking the drawer, spends attribute points in the File panel, does not learn skills, does not restock after a death).

## Per item

### R8-A1 Desk Drawer at 1280x720 and 1366x768: ACCEPT
- 1366x768: the drawer fits (8..627), the whole bag, the gold line and the held-item footer are visible (`accept-r8t-drawer-1366x768.jpg`).
- 1280x720: the bag area scrolls (mouse wheel brings cell 9-3 to y 477..521 and it is hit by `elementFromPoint`); with an item held, the footer "In hand: ..." with **Put back** and **Drop on floor** is pinned at the bottom (y 544..574) and `elementFromPoint` returns the button (`accept-r8t-drawer-1280x720-held.jpg`).
- Drop on floor with the real mouse at both sizes: held Blazer cleared from the cursor, ground items grew. Both sizes: no page error.
- One thing I noticed: at 1280x720 the "In hand" line overlaps the bottom bag row a little while an item is held; harmless.

### R8-A2 XP box no longer eats clicks: ACCEPT
`elementFromPoint` at five points over the old box (425..629 x 604..633) all return the canvas; a real click at (527,615) moved the hero (12,19 -> 12,21). Hovering the bar shows no tooltip; "Total experience: N" is text in the File (see below).

### R8-A3 Floor 2 for a level-2 hero, the 10-minute journey per class: ACCEPT WITH FOLLOW-UP (medium)
Setup: new character from the Lobby, lift, floor 1 cleared by clicking (about 1 minute of game time, 14 kills, level 2, 86 to 105 gold), then floor 2 until cleared (46 monsters; the clicker needs 2.0 to 3.1 game minutes, so there is no 10-minute wall now, the floor is done at level 4 with 63 to 66 kills). Seeds 7 and 3, three classes, twelve runs of the same clicker (two seeds, three classes, with and without spending points):

| clicker | seed | FM deaths / lowest hp | SR deaths / lowest hp | IT deaths / lowest hp |
|---|---|---|---|---|
| attribute points NOT spent (File badge ignored) | 7 | 2 / 2 % | 0 / 8 % | 0 / 38 % |
| attribute points NOT spent | 3 | 3 / 3 % | 0 / 27 % | 3 / 2 % |
| points spent through the File panel (as a player does) | 7 | 0 / 25 % (4 potions) | 0 / 34 % (2) | 0 / 43 % (1) |
| points spent | 3 | 1 / 3 % (4) | 0 / 37 % (4) | 2 / 15 % (3) |

- Better than R8 (R8: FM two deaths, SR 27 % and IT 29 % health after 10 minutes without clearing, level 4): all three classes now clear floor 2 in about 2 to 3 minutes and reach level 4 in every run. With points spent: 3 deaths in 2 of 6 runs (one FM and one IT run, both seed 3), 4 of 6 runs clean.
- Still a spike for the fast clicker: the IT Wizard on seed 3 died 18 seconds after arriving at level 2, the FM on seed 3 died once at level 3 after the belt was empty. A level-2 hero who ignores the File badge died in 3 of 6 runs (8 deaths, FM and IT on both seeds). The orchestrator's bot (smarter) shows 0 deaths; mine rushes into the next pack and never goes back to restock, so the second and third deaths in my table are partly my bot's doing. Reading it as a player: floor 2 is now fair for a careful player and still punishing for a rusher, which is acceptable for a floor 2 as long as the File badge nudge is noticed (it was not by my clicker).
- Per class feel: SR is the safest (never below 27 %), FM and IT swing hardest at level 2 (low health pool, first pack of the floor within 20 to 40 seconds of arrival).
- Evidence: `accept-r8t-floor2-fm-end.jpg` (floor 2 end, level 4, "Final Merger" marker).

### R8-A4 Re-click in a crowd: ACCEPT WITH FOLLOW-UP (low)
Staged six zombie interns (three adjacent) around a level-2 hero, real clicks every 6, 18 and 60 ticks (10, 3.3 and 1 Hz).
- Same far target re-clicked (a stuck target): first hit on an adjacent monster after 0.8 s (FM), 0.2 s (SR), 0.15 s (IT) at every rate. The 1.5 s promise holds.
- Farthest monster each time (target changes as monsters move) at 1 Hz: FM 0.8 s, SR and IT 0.2 s and 0.15 s; at 3.3 Hz FM 1.3 s. At 10 Hz the FM did not land a single hit in 6 s: it kept walking between targets while two or three attackers stood adjacent (seen once, seed 7, `zombie-intern`). Spam on a target that keeps changing is rare player behaviour; noted for the polish list, not a blocker.
- The staged six-pack kills a level-2 hero in about six seconds in some runs; that is the stage, not floor play.

### R8-A5 adv-r7 owed check and BENCH_GEAR: taken from the orchestrator (261/261, geared median 51.1). Not re-run.

### R8-A6 My evidence holes
- **Unique-tier look: ACCEPT.** `giveItem` with `ilvl: 30` now gives a real unique (Glass Ceiling, Golden Parachute, Casual Friday, Paper Cut, Open Door Policy; without ilvl it fails loudly with "no unique for this base/slot at this item level", as intended). On the figure, rare is a pale-yellow trim and unique is an orange glow with flame motifs; hat, jacket, boots, rapier and shield each read at 1x and rare versus unique is distinguishable at a glance (`accept-r8t-unique-vs-rare-fm.jpg`, `-it.jpg`). Head and body uniques did not equip for SR/IT (class requirements), as designed.
- **Emergency Exit at 40 gold: ACCEPT.** The vendor row says 40 (`accept-r8t-emergency-exit-40.jpg`); bought with 50 gold, gold 10, toast "Bought Emergency Exit (40 gold).", buy button disabled at 10 gold; from floor 1 a right-click in the drawer opened the door, the hero was back in the Lobby, a click on the door tile returned to floor 1. One small oddity: right after use the toast shows the quest line, the "a door opens" line follows later (low).
- **Slot cards after reload: ACCEPT.** Equipped gear, saved, reloaded: the Load dialog card shows the portrait, class, level, deepest floor, quest line; its bust differs between a bare and a geared hero (canvas length 18.9 k bare-ish vs 20.2 to 22.7 k geared); Continue returns to the same level and gear signature (`accept-r8t-slot-cards-reload.jpg`).
- **R8-Q2: ACCEPT.** Opening the vendor opens the drawer with it; Escape closed both. **R8-Q3: ACCEPT.** Two hand-ins in a row show their own lines in order: "Intern Overflow: completed (60 gold, 90 experience, ...)" then "Slide Deck Surplus: completed (120 gold, 120 experience, ...)" (`accept-r8t-second-handin-toast.jpg`). No stale "return for your reward" line.
- Floors 5-9, boss and verdict by real play: not played by me; the test engineer's three no-cheat full runs (all won) cover it. I do not repeat them.

## R8-T fixes

- **Death screen clean: ACCEPT.** With the Desk Drawer, the File and an item on the cursor open, dying leaves nothing visible but the "You have been let go." box and its three buttons (drawers 0, dock 0, ghost 0, tooltip 0 by visibility check); after Respawn the item is in the bag, nothing on the floor, cursor empty (`accept-r8t-death-screen.jpg`).
- **Belt-empty respawn hint: ACCEPT.** With the belt drunk empty, dying and Respawn, the toast reads "Back in the Lobby. Your belt is empty: restock potions at the Break Room Barista." With a full belt it reads "Lobby". It waits behind the quest line and the floor line (the passive-line rule), so it shows a few seconds after arrival; in my scripted case it queued behind four older potion toasts. Not a defect, but it can feel late (low).
- **Phone dock: ACCEPT.** 390x844 with touch: Inventory 81x44, File 44x44, Skills 51x44, Map 44x44 (back and opens the map on tap), Journal 85x44. All 44 px high; none under 44 wide. Name of 16 W characters is ellipsised in the File header (no overflow). (`accept-r8t-phone-dock.jpg`)
- **Short landscape phones: ACCEPT.** 667x375, 740x360 and 844x390: title buttons, the create screen (name, Start, Back) and the death screen (Respawn, Restart, Quit) are all inside the viewport and hit by `elementFromPoint`; the in-game dock and belt are on screen. (`accept-r8t-landscape-740x360-death.jpg`)
- **Total experience text: ACCEPT.** File shows "Total experience: 856" (and 0 at start) as ordinary text under the XP bar; the hover box is gone (`accept-r8t-phone-file-total-xp.jpg`).
- No page error in any run (all scripts logged errors: none).

## Feel notes ("flawless gameplay")

- Floor 1 is a one-minute tutorial now: 14 kills, level 2, full health, 86 to 105 gold. It never threatened any class in all twelve runs.
- Floor 2 is where the game starts to bite: 46 monsters in packs, first contact within 20 to 40 seconds. A careful player with points spent clears it in 2 to 3 minutes at level 4; a rusher dies once or twice. The File badge ("15" unspent points at level 4) is the quiet reason: my clicker ignored it and died far more. A one-line toast the first time the hero holds unspent points on floor 2 would help (follow-up 2).
- Dying: clean screen, nothing lost, back in the Lobby with a sensible hint. Respawn then lift is smooth.
- Gear: unique pieces are a real reward on the figure; the orange glow stands apart from the rare yellow, which was my open question after R8.
- Drawer, vendor and quest windows behave. The right-hand dock column overlaps the playfield at 1280x720 and my clicker had to avoid it; fine for a human.
- Phone: the top-row dock and the bottom belt/skill bar are tidy at 390x844; the first "Floor 1" line sits under the tracker for a moment (cosmetic).

## Follow-ups (none blocks acceptance)

1. **Floor 2 first-minute death risk for FM and IT at level 2 (medium-low).** Consider one more notch on floor-2 pack density or the first pack's distance from arrival for FM/IT, or a floor-1 gear/potion nudge; re-measure with a clicker that spends points. Not for the real customer.
2. **Unspent points nudge (low).** A single toast when the hero stands on floor 2 with unspent attribute or skill points; my clicker never spent skill points either (Skills badge 3).
3. **Click spam on a changing far target at 10 Hz (low).** FM got no hit in 6 s with attackers adjacent. Optional: attack an adjacent aggressor when a click's target path is blocked.
4. **Emergency Exit use toast order (low)** and **respawn hint latency behind older toasts (low).**
5. **1280x720 drawer "In hand" line slightly overlaps the last visible bag row while an item is held (cosmetic).**

## Recommendations for the real customer (not decided by me)

Nothing needs a decision. To check yourself: dress one class in a unique piece and compare with a rare (the orange glow), run floor 2 once without spending points and once with, and open the game on a phone held sideways.
