# R11 acceptance (customer-proxy, PROXY, 2026-10-15)

Role: customer-proxy (delegation in STATE.md). Provisional until the real customer reviews it. Final acceptance of the whole game at the end of R11, time-boxed to 45 minutes. Taken as given and not re-run: the orchestrator's quiet verify (unit 1366 x3, 39 e2e scripts, bench 58/59/58 fps) and the test engineer's no-cheat full runs (3/3 won). Known and deferred, not rejected on: F-01 (floor 2 first pack vs a fast level-2 Facilities Manager). The brief's last instruction (deadline 2026-10-16 04:00 UTC, open bugs may stay for later) applies.

## Verdict: ACCEPT WITH FOLLOW-UPS (confidence medium)

No High finding is open and I reproduced no defect by real play. The follow-ups are small.

## How I tested
- Copy of `play/index.html` (byte-identical to `dist/index.html`), `file://`, Chromium via Playwright 1.56.1, no rebuild, no git. Real mouse, touch taps (phone contexts) and keyboard. Scripts and PNGs in my scratchpad; 8 key shots in `docs/shots/accept-r11-*.jpg`.
- Hook (`?test=1`) used for setup and reads only: `cheat.setLevel`, `teleportFloor`, `giveItem` (weapons), `setHp(0)` (to die), `spawnMonster` (a staged crowd), `giveGold`, `damageMonster` (boss kill to reach victory, empty the floor), `completeQuest` (see Quest hand-in), `allocate`/`equip` inputs, and state reads. Existing e2e scripts r11-spam and r11-play were run from the repo with output outside docs/shots.

## Per item
- **Phone dock 360x640: ACCEPT.** Dock buttons 44 px high (Inventory/File/Skills/Map/Journal in the top row, hotbar 44 px, belt 44 px), no horizontal scroll (scrollWidth 360), the five panels open by tap, each has a 44x44 close button (Map closes with its own corner button), no console errors (`accept-r11-phone-dock-panels.jpg`).
- **Victory screen on phones: ACCEPT.** 360x640 and 640x360: summary first, story text scrolls, "Keep playing" and "Quit to title" stay pinned at the bottom (58 px and 44 px high, inside the viewport), tapping Keep playing returns to town. Also fine at 1280x720 (`accept-r11-victory-phone.jpg`).
- **Landscape skills/file panels (640x360, 740x360, 844x390): ACCEPT.** Tab strip with close button on one row, Skills and File readable, no page overflow, buttons at least 30 px high; the skill list scrolls with the wheel and tiers 1-2 are reachable (locked ones show their requirement tooltip) (`accept-r11-landscape-skills-file.jpg`). Not checked: a finger drag (wheel only).
- **Toast order, level-up not lost: ACCEPT.** Two quest rewards then the level-up: the reward lines showed first and "Level up! Now level 2." showed afterwards (observed in the live toast element at 5.4 s, 7.6 s, 11.6 s).
- **Keyboard focus on panels: ACCEPT.** C puts focus on the first "+" button, Tab moves along, Enter spends a point, Esc closes with no pause; S focuses Learn/Upgrade then the F-slot buttons; Esc twice shows Paused with focus on Resume.
- **Two-hand weapon and attack poses: ACCEPT.** Extinguisher Club worn by the Facilities Manager is held across the body with both hands, wound up and swung; Sales Rep (sword) and IT Wizard (staff) show a clear wind-up, strike and recover and a cast thrust (`accept-r11-fm-twohand-fight.jpg`, `...sr-attack-poses.jpg`, `...it-attack-poses.jpg`).
- **Hit stagger: ACCEPT.** Struck zombies visibly shove back and flash, then recover; seen in all three contact sheets.
- **Damage numbers: ACCEPT.** Numbers rise beside the head, stack on alternating sides, crits read as "32!" and "miss" shows; in a 4-monster crowd they stayed readable (`accept-r11-damage-numbers-crowd.jpg`).
- **Click spam in a crowd: ACCEPT.** Re-clicking a changing far target at 10 Hz (r11-spam, 3 classes x 2 seeds, plus nearest as baseline): the first hit lands on an adjacent or near attacker at distance 1 to 3 in 60 to 144 ticks (was 168 to 300), zero never hit, no deaths, 6/6 checks. Slowest case: Facilities Manager 144 ticks (2.4 s) against 48 to 60 for clicking the nearest target.

## Overall flawless-gameplay judgement
- Start (Lobby, class, name), real-time floor 1 and into floor 2 by the scripted real-mouse player (seed 6: level 3 on floor 2, 0 deaths, 32 monsters on floor): smooth, no stalls.
- Floor 3 reached; death: Respawn screen clean, one click returns to the Lobby alive with level and gold kept (`accept-r11-death.jpg`).
- Quest hand-in: accepted from the First Aider with the real mouse in the dialog; the reward and level-up toasts are right. The hand-in itself was completed with the `completeQuest` cheat (the hand-in button never appeared because the cheat finishes and delivers), so the real hand-in button was not clicked this time; it passed in R8/R8-T and r7 quest scripts.
- Save and reload: reload, Continue, back in the Lobby at level 5 with 177 gold, no errors.
- Nothing felt broken. Floor 2 stays the spiciest part (F-01, deferred).

## Follow-ups (none blocks)
1. `e2e/r11-play.mjs` crashed twice in `spendUi` (`boundingBox()` returned null after `waitForSelector` said visible, at the first level-up in real-time mode). I could not reproduce it by hand (C/S then click works, 4 of 4 times at 1280x720), so I take it for a script race, not a game defect, but someone should confirm.
2. Facilities Manager far-changing click spam still takes 2.4 s to the first hit; a nearer-attacker rule for melee classes could halve it.
3. F-01 floor 2 first pack vs a fast level-2 Facilities Manager (deferred, backlog).
4. Landscape skill lists were checked by wheel scroll only; a finger-drag check on a real device is owed.

Escalations: none. Nothing for the real customer to decide.
