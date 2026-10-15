# R8 acceptance (customer-proxy, PROXY, 2026-10-15)

Role: customer-proxy (delegation recorded in STATE.md). Everything below is provisional until the real customer reviews it. Judged against the seventh briefing verbatim in `00-brief.md` ("make sure the characters change their visuals based on the inventory"), the customer decisions (incl. 2026-10-15 "Defaults are fine"), the "flawless gameplay" goal (R8 is the second flawless-gameplay round), plan items R8-0 and R8-1 in `50-plan.md`, and my own R7 follow-ups (`R7-acceptance.md`).

## Verdict: ACCEPT WITH FOLLOW-UPS

The customer's request is met and it reads well: every piece of worn gear I equipped through the real inventory changed the figure, for all three classes, and the first-minute and lift problems I raised in R7 are gone in my runs. Nothing is rejected. Open items go to R8-T; none needs the customer.

## What I did (and did not)

- Played the dist build that the orchestrator had just built (`dist/index.html`, 09:05, no `src` file newer; I ran it from a copy, `file://`, so the orchestrator's e2e runs were not disturbed; I did not rebuild). Playwright 1.56.1, preinstalled Chromium, 1280x720. Real mouse clicks (page.mouse) for moving, attacking, looting, NPCs, quest buttons, the inventory and the respawn button; keyboard for I / C / belt. Hook (`?test=1`) used for setup only: clock stepping, `setLevel`, `teleportFloor`, `giveItem`, `setStep` (quest ready), attribute spending, and reads. Where a hook did more than setup it is said below.
- Orchestrator numbers taken as given, not re-run by me: npm test 1295 x3, e2e 18/19, fps50 53.3 plain / 52.9 geared hero / 47.1 BENCH_GEAR scene.
- Limits: scripted players, seeds 7, 3 and 5, one machine; my clicker is eager and never kites; floors 5-9, the boss and the verdict were not played; the Emergency Exit purchase (40 gold) and the vendor/stash windows were not exercised by me.
- Shots: `docs/shots/accept-r8-*.jpg` (72 files; I looked at the sheets, the dialogs, the death screen, the spam start, the journey end and the selection screen).

## Per item

### R8-0 Hero visuals follow equipped gear (seventh briefing): ACCEPT
Evidence (`accept-r8-gear-<class>-sheet-all.jpg`, ten 1x crops per class in equip order, plus `-0-` .. `-9-` singles):
- Each of the nine equips I made through the Desk Drawer (right-click a cell) changed the figure and the signature (`perf().gearSig` went `-|-|-|-|n0|-` -> `h1|-|-|-|n0|-` -> `h1|j1|...` and so on): hard hat, blazer, boots, gloves, rare sword, suit, shield, two-handed extinguisher. Equip order was weapon, head, body, feet, hands, weapon, body, off-hand, two-hander.
- Facilities Manager, Sales Rep and IT Wizard all read: the class hat, headset and spiky hair give way to the hard hat, the vest/suit/hoodie to the blazer and suit, the gloves and boots are bright and obvious, the two-hander is held across the body and the shield disappears with it. The laptop-backpack of the IT Wizard stays (class identity kept).
- "Weapon replaces the class prop" (customer decision): confirmed. Start weapon is the class weapon (FM wrench, SR sword, IT staff); equipping the wrench or a found blade swaps what is in the hand.
- "Belt, rings and amulet not shown" (customer decision): confirmed; the signature has six slots and only those. A belt/ring does not change the figure.
- Rarity: rare pieces carry a yellow trim, magic blue; at 1x the trim is what tells a rare boot from a common one. Unique tier I did not see (my `giveItem` "unique" came out as a rare, no unique id was given); this is a hole in my evidence, not a defect.
- Does it feel rewarding? Yes. The step from the bare start to hat + jacket + boots is visible at once, and by the fifth item the hero looks like a different character. I would like to see the first piece of gear read even more (a common hat is only a colour swap on the FM, whose start look already has a hard hat); minor.
- Employee File bust follows the gear (`accept-r8-gear-sales-rep-sheet.jpg`: hat, gloves and sword in the portrait); character selection shows the three classes with their start weapons (`accept-r8-select-it.jpg`). Slot cards I did not look at myself; the orchestrator's `r8ui-*` shots cover them.
- Carried but unworn items do not change the look (my `giveItem` calls left the hero unchanged until the right-click).
- No page error in any run.
Follow-ups: none blocking. See follow-up 7 (a wish).

### R8-1 / R7 follow-ups
- **R8-Q1 bag full blocks a hand-in: ACCEPT.** Played through the real UI with Sales Rep: accepted The Missing Badge from the First Aider, made it ready, filled all 40 cells, clicked the hand-in button. The quest completed at once (90 gold, 140 experience), no alert; the toast says "...Vicious Rubber Gloves of the Fume Hood). 1 item waits until your bag has room." The dialog shows the same line, the Inventory dock button carries a "1" badge (`accept-r8-owed-sales-rep-3-after-handin.jpg`). Dropping four cells (the 2x2 glove piece) with the drawer's "Drop on floor" delivered the gear by itself, owed back to 0 (`...-5-after-free.jpg`). The R7 "refused, never got the gear" case is gone.
- **R8-B1 first pack / first 90 seconds: ACCEPT.** Six real-click runs of two minutes on floor 1 (3 classes x seeds 7 and 3): 0 deaths, 0 potions needed, lowest hp 56 % to 90 % of max, 8 to 14 kills, level 2 reached by four of six runs, gold 67 to 105. Floor 1 reads as a tutorial now. (Side effect, see feel notes: the very gentle floor 1 hands the level-2 hero to floor 2.)
- **R8-B2 death spiral at the lift: ACCEPT.** Level-8 ungeared heroes thrown onto floor 4 (setup) and played for 200 s each: Facilities Manager and Sales Rep did not die at all (22 and 18 kills, 4 potions used); IT Wizard died once after 26 s (11 kills, 3 potions drunk) and, back via the real Respawn button and the elevator tile, arrived on floor 4 again and survived the next 200 s (31 kills, no death). The R7 pattern of four deaths in 12 to 35 s is not reproduced. One seed, so I rate it medium confidence.
- **R8-B3 first potions: ACCEPT.** Start kits come with 4/4/3 potions on the belt (belt shows 4 full on arrival in every run), a potion costs 36 against 50 start gold; my heroes never ran dry in the first two minutes.
- **R8-AI1 re-click in a crowd: ACCEPT WITH FOLLOW-UP.** Staged: six awake zombie interns (three adjacent, three behind), the hero clicks the farthest one over and over for 6 s. Click every 3 ticks (about 20 Hz) and every 18 ticks: the first adjacent monster is hit after 1.0 s / 1.2 s (Facilities Manager), 0.2-0.3 s (Sales Rep, IT Wizard). The R7 worry is answered: a clicking hero fights back. The follow-up: at one click per second, Facilities Manager did not hit an adjacent attacker until 3.0 s and two of the three adjacent monsters were untouched after 6 s (the hero ended at 143/164 hp). My script picks the farthest monster each time, so the target changes whenever monsters move; a person re-clicking one stuck target may do better. Suggest R8-T: deterministic test with click period 1 s on a changing back target, hero must hit an adjacent attacker within 1.5 s.
- **R8-Q2 close inventory with the NPC window: NOT CHECKED** (low). **R8-Q3 second hand-in toast wording: NOT CHECKED** (low).
- **R8-T1 toast queue / CR7L items:** the one hand-in I played showed a single clean toast, no stale nameplates in the title; not stress-tested by me (the adversarial pass did that).

### Customer decisions
- "Defaults are fine" (2026-10-15): belt/rings/amulet not shown (confirmed), weapon replaces the class prop (confirmed), quests intended (the Lobby markers and the tracker still push the main quest; I did not change anything), Emergency Exit at 40 gold (not exercised by me; config shows the Emergency Exit door but I did not buy it), no 5th Lobby character (none present). No conflict with any earlier customer answer found.
- AMBIENT_LIFT +12 %, file:// note, names: nothing changed that I could see in the shots.

### The "flawless gameplay" goal (second round)
Gameplay is clearly smoother than at the end of R7: no standoff seen, no stutter noticed in the runs (I do not measure frames; the orchestrator's 52.9 fps with a geared hero is the number), no repeated deaths, the owed flow is calm. Three things I would not call flawless yet; all are small and all are in the follow-ups below: (1) the XP-bar hover box swallows clicks, (2) the Desk Drawer is cut off at 1280x720 and 1366x768, (3) floor 2 is a spike for a level-2 hero.

## Feel notes

- **Floors 1-4.** Floor 1: safe and quick (80 to 90 s for my clicker to see most of it; 8 to 14 kills; level 2). Floor 2 (journey run: Facilities Manager, Sales Rep, IT Wizard at level 2, seed 7, a full 10 sim minutes on the floor): Facilities Manager died twice (4 potions used), Sales Rep dropped to 27 % and IT Wizard to 29 % health, and all three were only level 4 after ten minutes; equipment on that run was a found magic sword and gloves. This matches the balance report (floor 2 the largest cell for FM, 2 deaths) and my R7 note: floor 2 is where an eager level-2 hero meets the first real pack. Floor 4 at level 8 (setup) is fair: wins and one death in three runs, tense but not a wall. I did not reach floors 3 and 4 by honest progression (my clicker did not clear floor 2 in 10 minutes), so the spread over floors 1-4 rests on the balance report (deaths FM 6, SR 6, IT 3 over 24 seeds x 3 classes) plus these samples; medium confidence.
- **Is floor 1 now too easy?** It is a tutorial; the customer asked for the curve spread evenly and first-minute deaths removed. 2.5x XP on floor 1 gives level 2 in about two minutes; fine.
- **The first minute per class.** FM: confident, hits hard, lowest hp 56-74 %; SR: smooth; IT: lowest hp 58-84 %, still never in danger.
- **Dying.** Death screen is clear ("You have been let go." with kills, time, depth, a big "Respawn in the Lobby" button and the line "Nothing is lost"). The Lobby gives full health and the elevator tile puts you back on the same floor; my script restocked nothing. A "belt empty, restock first?" hint in the Lobby would still be a nice touch (R7 idea, optional).
- **Gear reward.** It feels like a reward: you equip, the figure changes at once, the toast says "Equipped X". The yellow trim on rares and the two-hander pose are what read best.
- **Bag.** 12 items filled "Inventory full" in one run (tall 2x3 body pieces); junk fills the bag quickly. The owed flow softens this a lot.
- **HUD at 1280x720.** The Desk Drawer reaches down to y=588; the fourth bag row ends at y=606 and the gold/owed/held-item footer sits at y=653, so they are cut off (overflow hidden) at 1280x720 and the footer is cut at 1366x768 (fine from 1440x900). The owed line inside the drawer is therefore invisible there; the toast and the dock badge still carry the message (`accept-r8-owed-sales-rep-4-drawer.jpg`, `accept-r8-drawer-1366x768.jpg`).

## Follow-ups for R8-T

1. **Desk Drawer clipped at <= 1366x768** (medium): last bag row, gold, owed line and the "Put back / Drop on floor" buttons unreachable by mouse at 1280x720 (the put-back/drop controls matter when an item is held). Let the drawer scroll, shrink the cells, or lift the belt bar. Add an e2e at 1280x720 that clicks the drop button with the real mouse.
2. **XP-bar hover box swallows clicks** (low-medium): the transparent `.xptip` (about 204x29 px, bottom centre, 425-629 x 604-633) sits above the canvas with pointer-events on; a click there does nothing. Found because my clicker sent clicks there. Make it pointer-events none except on hover target, or smaller.
3. **Floor 2 spike for a level-2 hero** (medium): re-check with the clicker that walks floor 1 completely, and consider a floor-1 reward such as one potion or a gear drop; the plan's quests (Intern Overflow, 3 potions) are meant to cover this and my run did not take them. A scripted floors 1-4 run with quests accepted is the right R8-T evidence.
4. **R8-AI1 at 1 Hz** (medium-low): see above; make the 1.5 s answer hold for a click period of 1 s on a changing target.
5. **Close the open evidence** : the adv-r7 owed-after-drops e2e check (suspected fixture) must be red-or-green before R8-T ends; my own real-UI run of the same flow (4 cells dropped -> gear delivered) passed, which points to the fixture. BENCH_GEAR=1 47.1 vs target 48 (profile as planned; the 52.9 geared-hero number is what a player sees).
6. **Evidence holes of mine to close in R8-T** (human-like e2e, as proposed in R7): unique-tier look on the figure; Emergency Exit purchase at 40 gold; floors 5-9, the boss and the verdict by real play; R8-Q2/Q3 (drawer closes with the NPC window, second hand-in toast); slot cards after reload.
7. Wish: a belt-empty hint in the Lobby after a death; common-tier pieces could carry a slightly stronger silhouette change (FM hard hat vs the start hat).

## Recommendations for the real customer (not decided by me)

- Nothing needs a decision. To check yourself: put on the first three pieces with one class and see whether the figure change is enough of a reward; the first two minutes of each class; the drawer on your own screen size.
