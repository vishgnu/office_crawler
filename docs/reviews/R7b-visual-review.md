# Round R7b visual re-review (after the visual fix round)

Date 2026-10-15. Reviewer: visual-reviewer, same 8-criterion rubric as `R7-visual-review.md`; narrow: only items that changed were re-scored. Build: `npm run build` (dist/index.html 672 KB), Playwright 1.56.1, 1x JPEG shots under 300 KB (largest 167 KB), `docs/shots/review-r7b-w-r-*.jpg` (world) and `review-r7b-ui-*.jpg` (UI). Viewports 1280x720, 390x844, 360x740 (plus 320x640 for the dock). Staged through `window.__app` (`character.create`, `quests.setStep/accept/pin`, `cheat.teleportFloor/setLevel/spawnItem`, NPC tile clicks) using the repo's shot scripts re-pointed at my prefix. Inputs: M opens the map, skills F1-F4, potions Digit1-4 (no negative finding rests on a key). The wrench flourish (N14) was checked on a normal page with a paused fake clock, because `?test=1` sets `noanim`. Every cited shot was opened and looked at.

## Verdict

**PASS.** Craft is back to 34 in both areas (target 34), appeal holds at 35. All three Medium findings (G1, U1, U2, U3) are fixed; one new Low (phone map title under the dock) and the known G4 and N12 remainders stay open and can ride into R8.

| Area | Appeal | Craft | R7 (appeal/craft) |
|---|---|---|---|
| G: in game | **35** | **34** | 35 / 33 |
| UI | **35** | **34** | 35 / 32 |

## Re-scored items (only where something changed)

| Area | Criterion | Appeal | Craft | Evidence |
|---|---|---|---|---|
| G | 2 Readability | 5 | 5 (was 4) | `review-r7b-w-r-elite-d-crop`: pink plate "The Toner Tyrant" sits beside the head with a gold crown mark; loot icons and rarity tags are drawn faint over the elite and tags sit below its feet. `elite-m-crop` same. |
| G | 5 Composition | 4 | 4 (was 3) | Plate is attached to the body (no 120 px stem); phone NPC marker sits above the plate (`npc-m-crop`: "!" over the NPC head, plate to the side). |
| G | 8 Polish | 5 | 5 (was 4) | Map title is a solid band, legend inside the card, card ends above the hotbar (`map-lobby-d`); hero is clean of the rarity star and actors in front of him are tinted, not bright ghosts (`crowd-d`, `crowd-d-crop`). Residual: phone map title (N16). |
| G | Total | 35 | 34 | other rows unchanged |
| UI | 5 Composition | 5 | 4 (was 3) | Tracker hidden behind the Skills panel; F1-F4 assign buttons visible (`ui-tree-d`). Phone toast sits above the belt (`ui-bagfull-m`, `ui-handin-s`). |
| UI | 2 Readability | 5 | 5 (was 4) | NPC quote stays sticky at the top of the window (`ui-npc-open-d`, `ui-bagfull-d`: "Need a better stapler?" visible with the cards below it). |
| UI | 8 Polish | 4 | 4 (was 3) | Dock fits at 390, 360 (buttons 17 to 354) and 320 (wraps to two rows), badges read "99+" (`ui-dock-m/-s/-t/-d`). Desktop toast is centred in the free gap and no longer covers the bag grid (`ui-handin-d`). Bag-full text shows once (alert only; toast suppressed). |
| UI | 6 Motion | 4 | 4 | N14 wrench flourish now visible (`ui-cs-1` to `cs-3`: wind-up, whip down with sparkles and ring, fade). |
| UI | Total | 35 | 34 | other rows unchanged |

## Finding status

| # | Finding | Status | Evidence |
|---|---|---|---|
| G1 | Elite readability (tags on face, detached plate, crate over plate) | **Fixed** (minor residue: still the size of a manager, a few faint loot glyphs over its body) | `elite-d-crop`, `elite-m-crop` |
| G2 | Phone NPC marker on the plate | **Fixed** | `npc-m-crop` |
| G3 | Map legend behind belt, world marker through title | **Fixed on desktop**; phone title see N16 | `map-lobby-d`, `map-elite-d` |
| G4 | No map pin for elite or badge | **Open (known, needs core, R8-M1)** | `map-elite-d`: no pin, only the tracker line |
| U1 | Phone dock overflow | **Fixed** (390, 360, 320) | `ui-dock-m/-s/-t` |
| U2 | Tracker covers Skills panel | **Fixed** | `ui-tree-d` |
| U3 | Phone toasts on the belt | **Fixed** (two lines, truncated, above the HUD) | `ui-bagfull-m`, `ui-handin-s`, `ui-accepted-m` |
| U4 | Desktop toast over bag rows | **Fixed** | `ui-handin-d` |
| U5 | Duplicate toast and pill / alert | **Fixed** for the alert (bag-full shows once, `ui-bagfull-d`); pill case not reproduced because toast text differs on the accept path (`ui-accepted-m`) | |
| U6 | NPC window scrolls past the quote | **Fixed** (sticky quote) | `ui-npc-open-d/-m` |
| N9 | Star on the hero's hat | **Fixed** | `crowd-d` |
| N10 | Pale ghosts in front of the hero | **Fixed** (the Consultant is a translucent orange-tinted body, readable as a monster) | `crowd-d-crop` |
| N11 | Floor entry cost | Not re-measured | |
| N12 | Tree wastes width | **Partly**: two wider columns, tier 1 still left with the right half used by tier 2, empty gutter under tier 1 (`ui-tree-d`); phone unchanged and fine (`ui-tree-m`) | |
| N14 | Wrench flourish | **Fixed** | `ui-cs-1..3` |
| N15 | Toast over the belt on phone | **Fixed** | as U3 |
| Known | Vendor and bag side by side at 1280 | Open (AC-R-073-3, accepted) | `ui-bagfull-d`: both panels fit, play area about 36% |

## New findings

N16. **Low.** Phone map title sits under the dock buttons: `review-r7b-w-r-map-lobby-m.jpg` (10-260, 10-40): "Floor map: Lobby" is cut by Inventory, File, Skills, Journal. The world package noted this as a UI clash. Fix: on phone start the map title below the dock row (y about 60) or hide it, since the dock does not hide.
N17. **Low (cosmetic).** The elite is still only distinguished by crown, rim and plate, not by size (`elite-d-crop`). Optional: sprite scale 1.1.

## Keep

- Crown mark above the champion, side-placed plate with the pink rim.
- Phone dock with "99+" chips and compact padding; toast lane above the HUD with truncation.
- Sticky NPC quote with offer and ready cards and the single red bag-full alert.
- Wrench select-screen flourish.

```json
{"status":"ok","g_score":{"appeal":35,"craft":34},"ui_score":{"appeal":35,"craft":34},"verdict":"pass","open":["G4 (needs core, R8-M1)","N12 partial","AC-R-073-3 vendor+bag at 1280","N11 not re-measured"],"new":["N16 phone map title under dock (Low)","N17 elite size (cosmetic)"]}
```
