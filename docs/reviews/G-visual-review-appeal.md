# Round G visual review, appeal lens (reviewer 1 of 2)

Date 2026-10-14. Own shots (Playwright, `dist/index.html?test=1&seed=11`, `__app.newGame({start:'floor'})`, setLevel 6, teleportFloor 2/5/9, six monsters spawned around the hero, 2 frames each) in `/tmp/claude-0/vr-g1/`, 1920x1080 and 1280x720. Also viewed docs/shots g-office, g-basement, g-pair-lobby. UI panels ignored. Kept: `docs/shots/g-review-office.jpg` (floor 1), `g-review-basement.jpg` (floor 5).
Motion was judged from two frames 350 ms apart plus the mug and coffee-machine steam; not a full playthrough.

## Scores (1 to 5)

| # | Criterion | S1 | S2 | Final | C3 mock | G | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | First impression | | | | 4 | 4 | f5-1920: stacked cabinets, crates, red and teal pools, coloured demon glow. Reads as a finished room in 3 s. |
| 2 | Readability | | | | 4 | 4 | Hero ring and yellow pad separate from the green zombies and the dark manager. Vending machine against red cabinet-like props (f1) is the weakest case. |
| 3 | Cohesion | | | | 4 | 4 | Outline weight and palette hold on all floors. Actors now pick up a cool or warm cast from the pool (demon red edge, zombie green rim), but the hero is still a flat, evenly lit sticker on busy floors. |
| 4 | Colour and contrast | | | | 3 | 4 | AMBIENT_LIFT works: floor weave and wall panels read outside the pool on floor 1 and 5 (f5-1920 left and right walls). Corners stay dark, pools stay brighter. Floor 1 outer third is still near black. |
| 5 | Composition and hierarchy | | | | 4 | 4 | Eye goes hero, enemies, loot. Props are larger silhouettes and sit around the fight rather than behind it. |
| 6 | Motion and feedback | | | | 3 | 3 | Steam on the mug and coffee machine reads. Tie sway and breathing are not visible in two stills. No credit beyond C3. |
| 7 | Theme and tone | | | | 5 | 5 | Water cooler, copier, coffee machine, filing cabinets, boardroom lecterns and wood panels; floor 9 is clearly a different place. |
| 8 | Polish | | | | 4 | 4 | HUD and bevels are tidy. Defects below (overlaps, spawn clipping). |
| | **Total /40** | **30** | **29** | **31** | **31** | **32** | |

Earlier in-game history (C2 look): S1 30, S2 29, final 31. Round G in game: **32**. Rubric verdict: ship (32, nothing below 3), but the round's own target was 34 and the decision's gate says under 33 means one more fix pass. So: **one more fix pass, no new variants**.

## Does the added detail read at 1x for a casual player?

**Partly, leaning yes for the world, no for the characters.**
- Reads: lifted floor and wall materials (floor 5 wood-plank floor and grey panelled walls, floor 9 wood-grain wainscot, windows, wall plaques, lecterns), big props (cabinets, crates, water cooler, coffee machine with steam, plants), coloured light pools and the red demon halo, bevelled floor seams, HUD mug and jug. Compare g-pair-lobby: the right half is visibly richer at a glance (reflections, copier, brighter pool, tinted exit pad).
- Does not read: hero and zombie faces (still about 25 px; zombie fangs and the torn sleeve are only a white speck), manager pinstripes, floor decals, most texture at the pool edge. Hero versus the earlier C3 mock-up: same flat blocks, more outline but little extra shading.
- Net: a casual player says "much more going on in the rooms", not "the characters look better". That matches the customer's wording ("more details") for environments, less so for the cast.

## Polish and overlap check (L-018)
- f1-1920: the vending machine's red HP bar sits on the zombie's shin and the machine overlaps the zombie's feet (monster pile-up from my spawns, but it is the busy-scene case). Temp Worker HP bar abuts the "Zombie Intern" nameplate region; the nameplate itself does not cover any damage number.
- f1 and f9: a zombie standing against a wall is half hidden behind the wall top (f1-1920 bottom-left zombie, f9 left zombie). Probably spawn-in-wall from the cheat, still check wall occlusion for actors beside walls.
- f9-1920: vending machine drawn partly through the wall/corner at the bottom right.
- No label covers the hero. Rarity-by-colour rules not testable here (no loot spawned).

## Top 5 remaining fixes
1. **Give the hero and zombies real 2-tone shading and bigger faces** (f1-1920 hero, Zombie Intern). The cast is the thing the player stares at; at 1x it is still flat blocks. Light side and shadow side per sprite, face features 1.5x, one clear second-colour block (zombie sleeve, trousers). Biggest single gap to 34+.
2. **Tint actors with the pool colour and add a coloured ground shadow** (f5-1920 demon halo is good; the hero standing in a cool cyan pool is still neutral). 15 to 25 % multiply at the feet.
3. **Lift floor 1 and the lobby outer third a little more, or add a second wall-base glow** (f1-1920 top-right and bottom, near black). Keep vignette; raise only the wall-top and floor mid-tones there so the new wall panels show beyond the pool.
4. **Fix actor-versus-wall depth and HP-bar stacking in crowds** (f1-1920, f9-1920): bars of enemies behind another actor should draw above the front actor's body, or fade when overlapped; check actors beside wall tiles are not clipped by the wall top.
5. **Make secondary motion large enough to see**: tie sway, breathing bob, light flicker, rack and monitor LEDs; verify in a 3-frame strip at 1x. Also tone down the red cabinet-like props (vending machine and bookshelf-like red box share a silhouette with the enemy machine in f1).

## Keep
- AMBIENT_LIFT at about 12 % with pools still clearly brighter.
- Per-floor identity (teal office, wood-plank basement, burgundy executive suite) and the larger prop silhouettes.
- HUD chrome (mug, jug, rivets) and the demon's red halo and LCD, the best-reading detail in the game.

```json
{"score":32,"verdict":"iterate","reads_at_1x":"partly"}
```
