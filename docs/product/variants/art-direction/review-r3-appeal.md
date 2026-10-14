# Round 3 review, appeal lens: C2 vs C3 (reviewer 1 of 2)

Date 2026-10-14. Own screenshots (Playwright, 1280x800, frame 92) in `/tmp/claude-0/vr-c3a/`: `def`, `base`, `board`, `cmp30`, `cmp70`, `cmpb30`, `zh`, `zm`, `zd`.
Compared with the current game: `docs/shots/final-lobby.jpg`, `polish-basement.jpg`, `s3-boss-phase2.jpg`. Only still frames were judged; motion is scored from stills plus notes.md, not observed.

## Scores (1 to 5)

| # | Criterion | C2 | C3 | Evidence |
|---|---|---|---|---|
| 1 | First impression | 3 | 4 | cmp30: left (C2) is a dark void with a few red blobs; right (C3) shows desks, monitors, pools, windows at once. |
| 2 | Readability | 4 | 4 | Rim rings keep all four actors clear (def). C3 adds clutter behind the manager and printer (cmpb30: pipes, racks) but nothing is lost. |
| 3 | Cohesion | 4 | 4 | Same outline weight and palette. Actors still look pasted onto richer floors (def, zombie and hero feet have no pool colour). |
| 4 | Colour and contrast | 3 | 3 | Mid-tones are still crushed; floor weave and wall materials show only inside pools (def, left third and bottom-right are near black). |
| 5 | Composition and hierarchy | 4 | 4 | Hero, loot beams and nameplates dominate as before. |
| 6 | Motion and feedback | 3 | 3 | Not observable in stills; tie sway, dust and LEDs are tiny (verify live). Verified static only, so no credit. |
| 7 | Theme and tone | 4 | 5 | Posters ("HANG IN THERE", "NO FISH IN THE MICROWAVE" in zm), cork board, sticky notes, boardroom carpet add the office-satire layer C2 lacked. |
| 8 | Polish | 3 | 4 | zh/zm/zd: stitched HUD, rivets, printer LCD, buttons, hero face are well built. At 1x much of this is sub-pixel. |
| | **Total /40** | **28 (iterate)** | **31 (iterate, one point short of ship; item 4 is 3)** | |

## Is the added detail visible at game scale to a casual player?

Suspect: "improvement is real but modest; dark grade hides most new materials; characters look nearly unchanged at game scale". Verdict: **partly confirmed**.

Refuted in part (environment is a visible gain):
- The wipe at split=30 / 70 (cmp30, cmp70) shows a clear difference in the world. C2 side: empty dark slabs. C3 side: glass partitions, monitors with cyan spill, door, plant, filing cabinets with labels, clock, notice board, hanging cage bulbs. A casual player sees "this room has stuff in it" without zooming.
- The two extra scenes are the strongest evidence of "more detail". The boardroom (board) has a readable burgundy lattice carpet, gold rug emblem, glass table with laptops, chandeliers, trophy credenza. The basement (base) has rack LEDs, yellow lane stripe, puddles, boxes. Against `polish-basement.jpg` (flat grey tiles, same cabinets repeated) this is a different level of richness.
- The HUD is visibly better: mug and jug with glaze, stitching, rivets; slot names and key badges (def, bottom row) versus the flat purple panels in final-lobby.

Confirmed (it is modest where it matters):
- Characters at game scale (def): hero and zombie change little from C2 (cmp30/cmp70, compare the hero on both sides: same silhouette, same flat colours). New face, lens glint, badge photo, stitches, belt buckle and pinstripes appear only at zoom 3 (zh, zm). At 1x the hero face is about 25 px wide; blush, eyebrow and smile are below what the eye resolves. The manager is the exception: pinstripes, buttons and red tie slashes read, but the slashes read as "scratches", not detail.
- The printer demon gains the most (LCD, buttons, CMY stripes, vents visible in def and zd), which is a real gain.
- The dark grade hides material work: carpet twill/basket weave, wood grain and brushed metal are visible only at zoom (zd shows the floor weave and door panels; def shows them as flat dark). The floor outside pools is almost uniform; wall panels on the far left and top-right are unreadable.
- The Rare/Unique/Common loot rings and labels are the loudest elements and sit on top of the new detail, so the eye never rests on the props.
- Much new content is micro text (posters, signs, cork notes) that is unreadable at 1x. It adds texture only if the player gets close.

Net: **visible_gain = medium**. The customer asked for "more details and polishing" and will notice the room and HUD, probably not the characters. A customer who compares C3 against the current game (final-lobby: bare purple floor, plants, two chairs) will say yes, clearly more. A customer who compares C3 against C2 on the fight screen may say "similar, a bit busier", because the fight happens inside a bright pool where C2 already looked fine.

## What matters most vs what is invisible at 1x

Matters (visible): second light fixture and pools; monitors with cyan spill; glass partitions and window; basement racks with LEDs; boardroom rug and chandeliers; yellow safe-lane and tape paint; floor debris and contact shadows near the action; HUD mug/jug/slots; printer demon panel; manager pinstripes.
Invisible at 1x: hero facial details, lens glint, cowlick, shoe laces, trouser creases, cuffs; zombie fangs/drool/mottling (the zombie reads as a green blob with a crown of spikes); sticky notes, socket, vents, mug rings; tiny poster text; outside-pool floor weave; bevelled seams in the dark.
Probably invisible in motion too: tie sway (a few px), dust motes (40 dots, barely seen in def).

## Top 8 changes that make detail visible without losing the mood

1. **Raise the mid-tone floor value outside the pools** (the "one-number change" admitted in notes.md): target about +12 to 15 % luminance for the ambient layer, keep vignette and pool contrast. Then the weave, seams and wall panels show everywhere, and the pools still read as light because their colour stays more saturated.
2. **Stronger material contrast inside pools**: lift the texture overlay alpha about 1.5x only where the light mask is above ~40 %, so carpet weave, wood grain and metal show at 1x in the area where the player looks. Cheap: the overlay is already a static layer.
3. **Make characters carry detail at 1x, not at 3x**: add a 2-tone shading step (light side / shadow side) and 2 to 3 large colour blocks per type (hero: visible white shirt panel, lanyard in cyan, shoes in a contrast colour; zombie: torn sleeve in a different green and a visible grey-purple trouser; manager: lapel in a lighter blue). Delete the sub-6 px details (laces, creases) from the budget; move that effort here.
4. **Bigger, clearer faces**: scale eyes, brows and mouth about 1.5x and darken them (hero smile and blush now vanish at 100 px height). Zombie: one big mouth with two visible fangs and bigger eye bags. That is what a player reads as "character".
5. **Let actors receive the pool colour**: tint actors with a 15 to 25 % multiply of the local light colour and add a soft coloured ground shadow. This removes the "pasted on" look (the notes' own risk b) and makes the new floors and the characters read as one scene.
6. **More prop variety per room kind, placed in pools, with larger silhouettes**: 3 to 4 distinctive props per room (office: coffee machine, water cooler, plant, copier; basement: barrel, valve wheel, forklift pallet; boardroom: podium, trophy case) at about 40 to 70 px, instead of many 8 px items. Vary the tile material per room so each floor is recognisable in thumbnail.
7. **Secondary motion that reads at 1x**: tie sway 2 to 3x amplitude, a visible idle breathing bob (2 px) on hero and manager, printer paper feed flap that moves, steam from the mug, rack LEDs and monitor scan brighter. Dust motes bigger (2 to 3 px) and slower in the pool; add a soft light-cone shaft from the fixtures.
8. **Thicker rim of environment accents**: add rim-light edges (1 px bright line) on wall tops, desk edges and table edges facing the light, and a saturated colour per area (teal office, rust basement, burgundy boardroom) on the wall-base glow. Reads as "polish" at a glance, costs only a static layer, and also separates walls from floor in the dark outer third of the screen.

## Keep
- The C2 identity: bold outlines, rim rings, Okabe-Ito loot colours, dark moody grade.
- The compare/legacy switch (it made this review possible).
- Boardroom and basement scenes, HUD chrome, printer demon panel, humour posters as texture.

## Verdict
C2 28 (iterate), C3 31 (iterate, close to ship). The gain is real in the environment and HUD and weak in characters; items 1 to 5 above should move C3 to 34+.

```json
{"scores":{"C2":28,"C3":31},"suspect":"partly","visible_gain":"medium"}
```
