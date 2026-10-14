# Round G in-game review: craft, readability, checklist (reviewer 2 of 2)

Date 2026-10-14. Own shots: `/tmp/claude-0/vr-g2/` (real build `dist/index.html?test=1&seed=5`, 1280x720 and 1920x1080; floors 1, 5, 9; ?hc=1; ?lowfx=1; three classes on floor 3; 50+ monsters and 7 loot drops near the hero). Also looked at `docs/shots/g-pair-*`, `g-office/boardroom/classes-1280`. UI-panel differences ignored.

## Scores (1 to 5)
| Criterion | Score | Evidence |
|---|---|---|
| First impression | 4 | `f1`, `f9`: lit pool, coloured walls, window panes, plants read as a real office at once. Basement/boardroom clearly richer than before (`g-pair-basement`). |
| Readability | 4 | Hero (white ring, hi-vis vest) separates from zombies, even in a 6-monster pile (`f1`, `f5`). Loot beams and tags read above floor decals. Docked for label stacking (below) and monsters that merge into one cluster. |
| Cohesion | 4 | One line weight and palette across floor, props, actors; actors now take pool colour (`f9` warm, `f5` cool). Lobby/boardroom props still slightly "flat" at the edges. |
| Colour and contrast | 4 | Pools clearly brighter than ambient; hc mode solid. Floor/wall 3:1 inside the pool holds. Outside the pool (right half of `f1`, `f5` left) still very dark but now shows boxes and cabinets. |
| Composition and hierarchy | 4 | Eye goes to hero and loot. Fixture glints gone. HUD unchanged and out of the way. |
| Motion and feedback | 3 | Static frames only; tie sway, breathing and steam cannot be judged in stills. Mug steam is visible in the HUD (`f1-1920`). No penalty for what I cannot see, but no credit either. |
| Theme and tone | 5 | Window city-night panes, trophy case, podiums, copier, water cooler, plants: office-satire delivered without text. |
| Polish | 3 | Label overlaps in every busy shot (L-018, see below), `?lowfx=1` looks identical to default, `f1` bottom-right plant/box clutter near the screen edge. |
| **Total /40** | **31** | |

Verdict: **iterate**. Misses the 34 target by 3: the gap is label overlap and the stills-only motion evidence, not the art.

## Checklist (20 items) at real scale
Done 16, partly 4, missing 0.

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Outline clamp | done | Hero and zombies hold a clean 2 to 3 px ink at 1280 and 1920 (`f1-1920`). |
| 2 | Contact shadows, wall-base AO | done | Cabinets, boxes, desks sit on the floor (`f1`, `f5`). |
| 3 | Bevelled seams, tone drift, mirrored tiles | done | Diamond repetition broken in boardroom (`g-boardroom-1280`) and lobby pair. |
| 4 | HUD chrome | done | Stitched border, rivets, mug glaze, snapped slots visible (`f1`). HC mode correctly drops them. |
| 5 | Extra pools, fixture, shaft, exit pool, brighter band | done | Teal exit pool in lobby, shaft in office (`g-office-1280`). |
| 6 | Basement and boardroom scene tables | done | Clearly different identity per zone (`f5`, `f9`). |
| 7 | Baked material textures | done | Concrete grain, carpet lattice visible inside pools. |
| 8 | AMBIENT_LIFT, hue tiles, texture alpha in pools | partly | Lift is noticeable but modest; see mood section. |
| 9 | Actors take pool colour plus coloured shadow | done | Warm hero in `f9`, cool in `f5`; visible, not garish. |
| 10 | Character shading and colour blocks | done | Hero shirt panel and shoes, zombie second green, manager lapel, demon stripes read at ~110 px. Faces are the weakest read in a pile. |
| 11 | Props 3 to 4 silhouettes; props not on loot | partly | Silhouettes are good (copier, cooler, vending, plants, podiums, trophy case). A plant sits under "Mandatory Reorg" in `f9`/`f1` and a rack under "Brilliant Headset" in `f5`: loot spawn near props still overlaps. |
| 12 | Secondary motion | partly | Cannot confirm sway/bob from stills; steam on HUD mug visible. |
| 13 | Cache and budget | done per progress note (atlas 3.6-3.9 s, fps50 about 58); my 50-monster shots rendered without errors (frame times in a headless run are not a benchmark). |
| 14 | Drop posters, signs | done | Only coloured panes and shields; no legible text (`f9` wall). |
| 15 | Drop face details | done | Faces clean. |
| 16 | Dust motes, second flicker | done (dropped) | None visible. |
| 17 | Fixture glints | done | None. |
| 18 | Fine decals dropped, 3 to 4 big decals kept | done | Blood splats and paper scraps only; at most low-contrast. |
| 19 | Ochre safe lane | partly | Lane not on screen in my shots; the ground-diamond "stairs" marker in `g-classes` is yellow and sits beside yellow-rarity beams; could not verify lane colour in game. |
| 20 | Legacy removal | done | No compare/zoom aid UI; build clean, no page errors in 10 runs. |
Counts: done 16, partly 4 (8, 11, 12, 19), missing 0.

## Overlaps (L-018), real game, 6+ monsters and loot
Counting label-on-label or label-on-actor collisions in the six busy shots:
1. `f1`: "Padded Cardigan..." and "Mandatory Reorg" tags touch/stack at the hero's right.
2. `f1`: "Printer Imp" plate and its leader line run over the plant and zombie.
3. `f1`: "Overdue Standup" tag abuts the "Paper Cut" arrow and covers a monster's head.
4. `f5`: "Overdue Standup" sits on a monster's body, touching "Pink Slip".
5. `f5`: "Mandatory Reorg" and "Pink Slip" tags overlap a health bar.
6. `f5`: "Brilliant Headset" tag covers a server rack/monster legs.
7. `f9`: "Mandatory Reorg" over the plant, next to the "Middle Manager" plate.
8. `cls-sales-rep`: "Overdue Standup" covers the manager's torso, "Mandatory Reorg" sits on the demon.
9. `cls-sales-rep`: "Lucid Headset" and "Padded Blazer" stacked and touching.
Total 9, all medium (readable, none hides the damage number or the hero). The damage number "4"/"5" stays clear in every shot (acceptance rule holds).

## Readability risks
- Actors vs busier floors: fine. The rim + white ring hold in the busiest floor (`f5`). Zombie vs dark-suit auditor on dark concrete is the lowest contrast pair (`f5`, left), saved by the green rim only.
- Loot vs decals: no collision; blood splats are darker and lower in saturation than beams.
- Labels: the real problem (above). Not a world-art issue, but it lowers polish.
- `?lowfx=1` is visually identical to the default in `f1-lowfx` (no cheaper lighting seen): either the flag is a no-op in test mode or the savings are invisible. Low risk.
- `?hc=1`: clean, solid plates, readable (`f1-hc`).

## AMBIENT_LIFT 0.12 and mood
Keeps the mood. Corners and the outer third stay near black (`f1` left/bottom, `f9` top-right), pools stay clearly brighter and more saturated, and the floor weave and wall panels now show a ring wider than the pool. The new detail reads at the edge of the pool, which was the point. I would not go higher; 0.15 is the ceiling. The far half of `f1` (right, wall and box room) is the weakest area: lifted detail is visible there but the room is still dark and cool, a touch flat.

## Top 5 fixes
1. Label de-collision: run a simple vertical push (stack with 2 px gap, nudge left/right) over ground-loot tags, monster plates and the leader line; cap visible loot tags to the nearest 4 when more than 6 are within the hero radius. Fixes overlaps 1 to 9.
2. Loot spawn vs props: reject drop tiles adjacent to props (plant, rack, cabinet) so tags don't sit on silhouettes (`f9` plant, `f5` rack).
3. Raise the zombie-vs-dark-suit separation on dark concrete: lift the 1 px inner rim of auditor/manager types 10 % or add a thin light ink on the shoulder side (`f5` left).
4. Brighten the far half of lit rooms by hue shift only (warm tint on far-side tiles), not more lift, so the room beyond the pool does not read flat (`f1` right).
5. Make `?lowfx=1` visibly cheaper (flat lighting as documented) or remove it from the docs; confirm with a before/after shot. Also add a 3-frame sequence of tie sway/breathing to prove item 12 next round.

## What works (keep)
- Pools plus coloured actor tint (`f5`, `f9`).
- Scene identity per zone (basement concrete, boardroom wood and lattice).
- Silhouette-led props at 40 to 70 px; wall windows without text.
