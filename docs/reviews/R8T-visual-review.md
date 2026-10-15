# Round R8-T visual review (gear tiers, quest elite, Desk Drawer 1280x720 / 1366x768, phone dock, death screen, landscape phones)

Date 2026-10-15. Reviewer: visual-reviewer (harness 0.5.1). Build: current `dist/index.html` (file://), Playwright Chromium, 1x PNG shots in a temp dir (E2E_SHOTS); 12 key shots copied to `docs/shots/r8t-visual-*.jpg`. Every cited shot was opened and looked at.

Viewports: 1920x1080, 1366x768, 1280x720, 390x844, 667x375, 740x360, 844x390 (phones with touch emulation). Gear crops: 3 classes x 8 base items (head hard-hat and visor-cap, body blazer and cardigan, hands wrist-brace, feet sneakers, weapon keyboard-sword, off-hand clipboard-shield) x 4 tiers, 96x150 CSS px crops at 1x (zoom 1.8 camera), shown 2x pixelated on sheets. Gear was worn through `cheat.giveItem` + `equip` at level 20 with attribute points allocated. Uniques exist for hard-hat, blazer, sneakers, keyboard-sword, clipboard-shield only; visor-cap, cardigan and wrist-brace correctly answer "no unique for this base" (G-5 fixed).

Inputs and drive: test pages (`?test=1`) set `noanim`; the sprite and fx animation runs on the core clock, but I captured no motion strips this round. **Motion not judged.** Only static poses (idle front, walk-away back view) were judged.

## Verdict

**PASS (iterate-light).** Game 37 / 35, UI 36 / 34 (gate 34 met in all four numbers; UI craft is exactly at the gate). All six G findings and all five U findings of R8 are fixed or clearly improved. The one real regression-class problem is not in the R8-T list: on short landscape phones (667x375, 740x360, 844x390) the Desk Drawer, Employee File and Skills panels are cramped to a 100-140 px window (L-1).

| Area | Appeal | Craft | R8 |
|---|---|---|---|
| G: in game | **37** | **35** | 36 / 34 |
| UI | **36** | **34** | 35 / 34 |

## Status of the R8 findings

| Id | Result | Evidence |
|---|---|---|
| G-1 magic vs normal | Fixed. Magic carries a bright 1 px cyan highlight line (hat dome, jacket lapel/hem, sneaker rim, blade edge, shield frame, wrist band); rare keeps its double yellow line plus corner dots; unique its diamonds and heavy rim. All three are separable without hue | `gear-*-head-body`, `gear-*-hands-feet-weapon-offhand` sheets |
| G-2 unique body = shield | Mostly fixed on the Facilities Manager: torso stays inside the class width, rim on hem and shoulders, lapels and tie show, orange diamond at the lapel. Still a rectangular slab on the FM (G-R1) and nearly invisible on IT and SR (G-R2) | `r8t-visual-gear-fm-head-body.jpg` row 3, `r8t-visual-gear-it-head-body.jpg` row 3 |
| G-3 IT wrist braces | Fixed. Two thin bands at the wrists, no filled boxes near the face; rare reads yellow, normal is very faint at 1x | `sheet-it-wizard-2` row 1 |
| G-4 SR cap back | Fixed. Back-facing cap shows crown panels, seam and strap; the yellow quiff is separate below it | `r8t-visual-sr-cap-back.jpg`, frame 4 |
| G-5 giveItem unique | Fixed: `{ok:false, error:"no unique for this base/slot at this item level"}` (seen for visor-cap, cardigan, wrist-brace) | gear script output |
| G-6 / N17 elite size | Fixed. The Toner Tyrant is clearly larger than the hero and the manager-size monsters, has a pink glow, ground shadow, crown icon and plate; legible at 390 and 1280 | `r8t-visual-elite-1280.jpg`, `elite-390-crop` |
| U-1 phone map title | Fixed: "Map: Lobby" centred, Map button at the corner, no collision at 390x844, 667x375, 740x360, 844x390, 1366x768 | `ui-*-2map` |
| U-2 toast over tooltip | Fixed. Tooltip (y 423-520) sits above the toast (y 527-588) at 1280 and 1366, no overlap | `r8t-visual-tip-above-toast-1280.jpg` |
| U-3 / N12 tree | Improved. Tier 1 card is still left-aligned, but a connector line now ties it to its two tier-2 children, tier 3 is centred under them; reads as a chain. Right half of tier 1 is still empty (L-5) | `ui-1280x720-2skills`, `ui-1366x768-2skills` |
| U-4 bust crop | Fixed. The File bust is a full figure with boots and the worn hat, belt, weapon and off-hand (64x80, small but legible) | `st-1280-file-bust-crop` |
| U-5 phone Map button | Fixed. Dock on 390x844: Inventory, File, Skills, Map, Journal in one row, all 44 px high; on landscape phones the row sits at the top right | `r8t-visual-phone-dock-390.jpg` |

## Status of the other R8-T items

| Item | Result | Evidence |
|---|---|---|
| Wider common torso | Pass. Normal blazer and cardigan fill the class torso; the hero no longer looks like the vest is the body; hi-vis vest is fully covered | gear sheets |
| Desk Drawer 1280x720 | Pass. Drawer scrolls inside, header and the "50 gold" footer stay visible, close button reachable, drawer plus File open side by side without overlap | `r8t-visual-drawer-1280x720.jpg`, `ui-1280x720-3inv+char` |
| Desk Drawer 1366x768 | Pass. Everything fits; gold footer at the bottom | `ui-1366x768-2inventory` |
| Desk Drawer 1920x1080 | Pass, with a large empty lower half of the drawer (cosmetic) | `ui-1920x1080-3inv+char` |
| XP box click-through | Pass. `.xptip` is `pointer-events:none`; `elementFromPoint` on the XP box centre returns a non-xp element | probe output |
| "Total experience" in the File | Pass: "Total experience: 4,356" under the XP bar, legible | `r8t-visual-file-1280x720.jpg` |
| Long name | Pass. 16 x "W" ellipsises in the File header at 1280, 1920, 390 and landscape phones ("WWWWWWWWWW...") | same |
| Death screen | Pass for the listed items: no drawers, no dock, no held item behind it; buttons are 44 px high and inside the viewport at all 6 sizes. See L-3 for what still shows behind it | `death-*`, `r8t-visual-death-667x375.jpg` |
| Belt-empty respawn message | Pass. "Back in the Lobby. Your belt is empty: restock potions at the Break Room Barista." shows as a toast above the belt on 390x844 and at 1280x720. See L-6 for the delay | `r8t-visual-belt-empty-msg-390.jpg` |
| Short landscape phones: title / death / create | Not the weak spot; death fits (buttons 187-335 of 375). Panels are the problem (L-1) | `death-667x375`, `land-*` |

## Findings (severity, where, fix)

L-1 **High (new, landscape phones).** At 667x375, 740x360 and 844x390 the left/right panels (Desk Drawer, Employee File, Skills, Journal) are only about 190-215 px tall in total and the title bar plus the three-tab strip take about 110 px, so the scroll body is 100-140 px: the Desk Drawer shows just the "Head" and "ID" slot tops and the gold footer (`pb` client height 134 of 756 content at 667x375, minus the 30 px footer); the Employee File shows only the header and name; Skills shows only "Skill points: 11". Meanwhile about 50 px between the panel bottom and the hotbar is unused and the hotbar/belt/orbs stay on screen. Everything is reachable by scrolling, but equipping gear on a landscape phone is not practical. Where: `land-667x375.jpg`, `r8t-visual-landscape-667x375.jpg`, `ui-740x360-*`, `ui-844x390-*`. Fix: below 430 px height merge title and tabs into one 40 px row (tabs in the header, close button at its end), let the panel fill the area from y=4 up to the hotbar top (or hide hotbar, belt and orbs while a panel is open), and put the equipment grid beside the bag in two columns (as on desktop) instead of stacked.

L-2 **Low-Medium (new, phone portrait).** Desk Drawer at 390x844: the equipment block takes most of the panel, so the bag shows only the first row (about 65 px) above the sticky "50 gold" footer (`m390a`, panel 2). Scrolling works but a new item is seen only after scrolling. Fix: collapse the paper-doll to a compact row (or put the bag first) on the phone, or make the equipment block itself collapsible.

L-3 **Low (new).** The death screen still shows the quest tracker pill (and, dimmed, the hotbar, belt and orbs) behind it, and on the short landscape phones the pill runs under the Respawn/Restart/Quit buttons and the hint line: `death-667x375.jpg` ("Why the Lights We... es down to floor 3." between the buttons) and `death-1280x720.jpg` (pill at y 555-580 under "Quit to title"). Fix: add the tracker pill and toast to the `scene-dead` hide rule (`visibility:hidden` like the dock), or dim them with the rest.

G-R1 **Low (new).** A full rare set turns the hero into a single yellow-gold blob (hat, vest, gloves, boots, weapon, shield all yellow): `st-1280-tip-toast.png` and `st-1366-file-bust.png`. Class colour (pink SR suit, purple IT hoodie) is lost, so the hero reads as "rare gear" rather than "my class". Fix: keep the rare line at 1 px and the double line only, drop the yellow fill/tint on the body and head pieces, or tint only the trim; test with a full rare set per class.

G-R2 **Low-Medium (new).** The unique body is subtle on IT and SR: IT unique blazer is a plain blue torso with a short orange hem bar and no glow (`sheet-it-wizard-1` row 3 col 4); SR is the same with two tiny orange shoulder dots. The unique hat, sneakers, weapon and shield carry diamonds and a glow, so the body is the weakest unique cue. On the FM the unique blazer is still a rectangular slab. Fix: reuse the hat/sneaker treatment (orange rim all round the torso plus a diamond at the collar) at the IT and SR body width, and round the lower corners of the FM slab.

L-4 **Low (carry-over).** Wrist brace at normal tier is very faint at 1x on all classes (`sheet-*-2` row 1 col 1: two tiny grey ticks). Fix: 3 px band with a darker outline.

L-5 **Low (U-3 residue).** Skill tree tier 1 is still at the left with an empty right half, at 1280 and 1366 (`ui-1280x720-2skills`). The connector fixes the reading order, but centring tier 1 over its children would finish N12.

L-6 **Low.** The belt-empty restock line appears only after the "Lobby" area toast: about 170 ticks after the respawn click at 390x844 (at 1280 within about 200 ticks); a player who is moving away may miss it. Fix: show the respawn line first (or merge: "Back in the Lobby. Your belt is empty ..." replaces the area toast).

L-7 **Info.** Desk Drawer at 1920x1080 leaves the lower half of the panel empty (`ui-1920x1080-3inv+char`); no action needed.

## Keep

- The three-tier rarity language by shape (single bright line, double line with dots, diamonds and heavy rim) is now readable per slot and class without colour.
- The File bust with boots, the sticky footers (gold line) and the 44 px dock on the phone.
- The elite presentation: size, glow, crown, shadow and name plate read at both 390 and 1280.
- Tooltip above toast and the belt-empty message wording.

processes: none
