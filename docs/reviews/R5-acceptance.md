# R5 acceptance (customer-proxy, 2026-10-14)

**PROXY** acts for the customer under the delegation in `product/STATE.md` / `00-brief.md`. Everything here is provisional until the real customer reviews it. Not decided here (still open for the real customer): sound kit by ear, respec rule, AMBIENT_LIFT +12 %, portal-overview pick. IP closeness and names are already decided by the customer and not reopened.

## Verdict

**ACCEPT WITH FOLLOW-UPS** for rounds 4, 5 and G. The classes, trees, selection screen and five save slots do what the briefing asked, I played them, and they held up. Nothing I found loses a player's character in normal use. The follow-ups are polish and balance, and go to R6.

## Evidence base

- Reviews read: R5-adversarial (11 findings round 1, all fixed in round 2; 2 new minors ADV-R5-12/14 fixed per SAVE-FIX log), R4-R5-G-code-review (2 blocking + 13 should; fix logs show CR-01 owner expiry, CR-02 escapes, focus traps, load confirm done), G2 and G3 visual reviews, SAVE-FIX / UI-FIX / WORLD-FIX progress. Orchestrator at HEAD: npm test 668/0 x3, e2e 13 scripts green, fps50 43.9 (target 40), atlas 4.78 s (budget 5 s).
- My own play (Playwright 1.56.1, preinstalled Chromium, `file://dist/index.html`, `?test=1` only for setup: level and floor jumps, step clock; creation, skill learning, panels, slots, save and Continue went through the real UI). Shots in `docs/shots/accept-r5-*.jpg` (all under 300 KB, all looked at): title, select, tree (3 classes), fights (3 classes), slots, pause-slots, F4 bar, loaded.
- No uncaught page error in any of my runs.

## Per briefing item

### 1. "3 player classes with skill trees" - ACCEPT WITH FOLLOW-UPS
- All three classes (Facilities Manager, Sales Rep, IT Wizard) created from the select screen, entered the lobby, took real xp on floors 1-2 (level 2 reached by kills, +1 skill point shown on the Skills dock), and levelled to 9-14 with `setLevel`. Each has 3 branches x about 4 skills, 3 tiers, with prerequisite and level gates.
- Tree panel: Learn / Upgrade buttons, "Needs Hard Close 1 / Needs character level 16" shown in red in the tooltip, locked / available / learned states, F1-F4 assign chips on learned skills, points counter. Learning also fills the F1-F4 bar automatically. Learned 7 skills per class at level 14 with 0 points left, and the rest stay locked (cannot max everything, AC-R-205-3 behaviour).
- F1-F4 in combat: F1 cast verified for all three classes (mana fell on 11 / 18 / 7 casts). IT Wizard F1-F4 all selected the right skill on the bar (Server Overheat, Power Surge, Cold Boot, Packet Filter); Overheat and Cold Boot cost mana as expected. Two I could not confirm as mana spends (Power Surge: mana unchanged after the cast; Packet Filter: aura toggle, +1 mana). Probably a buff / aura with no target in my frame, but I did not prove it, so it is listed as a follow-up (F5).
- Each class feels different at a glance: hard hat and wrench, headset and pink suit, hood and glowing laptop; different hp/mana (66/14, 51/20, 43/52 at level 1). Skill effects (slam flash, paper bursts, sparks) are visible at 1x per G3.
- Gaps: classes are not balanced yet (below); no tier connector lines in the tree.

### 2. "a visually appealing character selection screen" - ACCEPT
- `accept-r5-select.jpg`: lobby with skyline, elevator, spotlight cone and ringed hero, three animated characters, accent colour per class, stat bars, three branch cards with their skills, name field with Suggest, Start with hint "Type a name to start", Load and Back, slot note "New character saves to slot 1. 0 / 5 slots used". It looks finished and on theme, better than a menu list. G3 scores it appeal 34 / craft 33; 390 px phone layout fits without scroll.
- Small open points: the unchosen two figures are small (about 70 % height), no wrench flourish, disabled Start is brownish on the Facilities Manager. None blocks acceptance.

### 3. "a save with 5 slots in the options menu" - ACCEPT WITH FOLLOW-UPS
- Five-slot manager reachable from the title (Load game), the pause menu (`pause-slots`) and Options. It lists class portraits, name, class, level, deepest floor, time played, last-played date and time, a MOST RECENT badge, Load / Rename / Export / Import / New character here / Delete, and storage used. Empty slots offer New and Import. I created three characters in slots 1-3 (one per class), saved, saw all three listed correctly, started a new character in slot 2 from the pause menu, reloaded the page and Continue brought back slot 1's character with the same gold (371), 7 learned skills and the same F1-F4 bar.
- The adversarial pass attacked the store hard (100 autosaves leave neighbours byte-identical, 27 hostile imports, corrupt / newer / oversized slots, quota full, two tabs, blocked storage, migration from the old single save); all findings are fixed and re-tested.
- Open: (a) N5, the Close button is clipped at the bottom with five characters at 720 px height (the close X at the top works); (b) N6, the take-over confirm pushes the "Paused" title off the top at 720 (worst case with three banners at once); (c) tab-owner heartbeat means a tab left in the background for over 15 s can lose the lock to a newer tab (adversarial observation, needs a real-phone check); (d) Respec is free and unlimited with one click and no confirmation, which is the open respec rule, not mine to decide.

### 4. "graphics: style idea is good but more details and polishing" - ACCEPT WITH FOLLOW-UPS
- In game at 1280x720 the floors read as a finished office: lit teal pools, wall panels and windows, vending machine, plants, coloured actor shadows, loot tags clear of the hero, hero ring, class colour blocks, damage numbers, minimap. The style idea (stylised vector, moody pools) is unchanged and clearly more detailed than before. G3: appeal 34, craft 33 (G2 was 33 / 32).
- Still short on: N1 pale figures on lit floors (a Consultant and a bald figure look washed and faceless), loot beams through the hero, a tag edge touching a head, the tree is a card list without connectors. AMBIENT_LIFT +12 % is the proxy's call and stays flagged for the real customer.

### 5. "nice sound" - NOT PART OF THIS ACCEPTANCE
Agents cannot judge sound by ear. No sound change was assessed here; the kit pick stays with the real customer.

### 6. "close to the original in mechanics, office setting" - ACCEPT
Real-time click-to-move, hotkey skills F1-F4, belt potions 1-4, town hub (Lobby), skill points per level, class stats, loot tags, floors going deeper: all as in the genre, and every name, skill and line is office-themed (Pallet Slam, Stapler Throw, Server Overheat, Evacuation Drill).

## Gate call on G (asked by the orchestrator)

**(a) Pass G now.** N1, N5, N6 and the remaining G3 items become R6 must-fix; no separate G fix round.
Reasons in the customer's terms: you asked for "more details and polishing" and the style idea is "good". The reviewer's score went from 33/32 to 34/33 with one point short only on craft, and the items left are small (a pale enemy, a clipped button, a banner stacking case that needs three notices at once), not look-and-feel problems. A further round just for them would delay the class balance work that R6 already has, and R6 is polish by name. Condition: N5 (Close clipped) and N6 (pause title off screen) are cheap CSS fixes and go first in R6, then N1.

## Known risk: file:// reload after save (phrased for the real customer)

In automated tests, Chromium opened from a local file (`file://`) lost saved data about 4 times out of 23 when the page was reloaded immediately after saving. On a web address (http or https) it never happened (0 of 48). In my own run, with save then reload straight away, 0 of 12 lost data on `file://`. Judgement: not a game defect and not a blocker, because it needs a local file open in Chromium plus an instant reload, and the player will use the game from a web address. If you play it by double-clicking `index.html`, close the page rather than reloading it right after saving, or let the game sit a few seconds (it saves automatically as you play). For release, the game should be served over http/https; this is already the plan. Your call whether a visible note in the README is worth it.

## Follow-ups for R6

1. Class balance: Sales Rep weakest (planned). Bot smoke: Facilities Manager 3/3 wins, median 26.3 min, 2 deaths; Sales Rep 2/3, 34.1 min, 6 deaths; IT Wizard 3/3, 32.0 min, 3 deaths (only 3 seeds). In my floor-2 play from level 1, Sales Rep and IT Wizard each died once, the Facilities Manager did not. Needs a larger bot run against the 25 % parity band.
2. N5: slot manager Close clipped at 720 px. First fix.
3. N6: pause screen with take-over confirm pushes the title off screen at 720 and 390 px. First fix.
4. N1: pale figures washed or faceless on lit floors; N3 beams through hero; N4 tag brushing a head; N2 confirm slam effect lifetime on a running clock.
5. F5: confirm Power Surge and Packet Filter spend mana / show effect (my check was inconclusive); add a test per active skill.
6. Skill tree: tier connectors, a fixed column grid, tier-2 Learn button cut at the panel bottom (N8); desktop vs phone tab difference (G2 15) noted in UI notes.
7. Select screen: larger unchosen figures, wrench flourish, FM disabled Start tint.
8. Reminders: respec has no confirmation (free, unlimited) pending the real customer's rule; first-time "Deepest: Lobby" label shows for a level 14 character (cheat state only, check with real play).
9. Playtest note: my cheat-based levelling skips real pacing; R7-8 "flawless gameplay" should include a no-cheat full-run per class.

## For the real customer

- Confirm or revert AMBIENT_LIFT +12 %.
- Respec rule (free and unlimited, one click, no confirmation, vs none).
- Listen and pick the sound kit.
- Portal-overview pick.
- Accept or overrule my G gate call (pass now, polish items first in R6).
- Note the file:// reload risk above; serving over http/https avoids it.
