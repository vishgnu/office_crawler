# Round 3 craft review: C3 vs C2 (reviewer 2 of 2, lens: craft, readability, port feasibility)

Date 2026-10-14. Own screenshots in `/tmp/claude-0/vr-c3b/` (1280x800 office/basement/boardroom for C2 and C3, `?zoom=3&focus=hero|zom|dem|mgr`,
390x844, `?compare=1` at split 30 and 70). Compared against `docs/shots/s3-boss-phase1.jpg` (current renderer, boardroom boss) and notes.md C3 section.
Note: the C3 shots show the actors at about 200 px tall (hero) because the file renders at its own zoom; in game the hero is about 100 to 135 px at zoom 1.8,
so everything below about 2 px of detail on a character will be lost.

## Scores (1 to 5)

| Criterion | C2 | C3 | Evidence |
|---|---|---|---|
| First impression | 3 | 4 | `C3-office` vs `C2-office`: C3 has plants, window light shafts, glass partitions, wall posters and a coloured exit-sign pool; C2 reads as dark teal slabs. |
| Readability | 4 | 4 | Actors still pop by outline and sit on top of the grade. C3 adds clutter behind the printer demon (cabinet, door, mat) and manager (cork board, filing cabinets) but none of it competes with the thick outlines. Loot beams and rings are untouched. |
| Cohesion | 4 | 4 | Same line language. In C3 actors are "pasted on" (not lit by pools), more noticeable next to the richer floor (`C3-boardroom`). |
| Colour and contrast | 3 | 3 | Dark grade unchanged; the lower-left and right thirds of the office are near black in both. Rarity colours unchanged. |
| Composition and hierarchy | 4 | 4 | Unchanged HUD. Two fluorescent fixtures with white slash glints (top left, top right) are now bright diagonal marks that pull the eye to the screen corners. |
| Motion and feedback | 3 | 3 | Static frames only; tie sway, dust and LED blink not judgeable. Damage number "63" is now partly hidden behind the manager and the 2nd fixture in the C3 frame. |
| Theme and tone | 4 | 5 | Humour posters, "wet floor" sign, cork board, safe-lane paint (basement), lattice rug and trophies (boardroom) land the office-satire brief. |
| Polish | 4 | 4 | Rivets, stitched HUD, sheen on mug and jug are real gains (`C3-office` bottom corners). Small blemishes below. |
| **Total /40** | **29** | **31** | Verdict C2 iterate, C3 iterate (upper end). |

## Verifying the orchestrator suspect: PARTLY CONFIRMED

"Improvement is modest": half true. The environment gain is clear in the compare view (`cmp30`, `cmp30b`): C2 left of the divider is an empty teal grid, C3 has
props, light and material cues. The basement (yellow safe lane, racks with LEDs, boxes, puddle) and boardroom (burgundy lattice, gold inlay, desk, chandeliers)
are the strongest frames and are a big step over the current game's repeated diamond floor (`s3-boss-phase1.jpg`). The office scene is the weakest of the three
because of the grade.

"Dark grade hides materials": confirmed for the office floor. Carpet twill/weave, tile bevels and scuffs are visible only inside pools (centre, around the
loot rings); the left and right floor reads as flat dark blue in `C3-office`. Basement concrete cracks survive the grade because they are linework, not texture.
Rule: line and colour-shift detail survives the dark; tone-only texture does not.

"Characters barely changed at game scale": confirmed at zoom 1, refuted at zoom 3. At 1x (`C3-office`) the hero is C2 with a smile and badge glints; the
zombie gains a visible green crown tuft and torn shirt; the manager's face is busier (brow, stubble, sweat) but reads as "angry bald man" as before; the demon
gains the CMY toner stripes and an LCD, which do read. At zoom 3 (`C3-z-*`) the work is good: hero lens glint, headset, lanyard badge, tie stripes; zombie
fangs and drool; demon panel; manager pinstripes and buttons. About 70 percent of this will not survive at a 100 to 135 px hero.

## Readability risks introduced by detail

1. **Manager head (C3-z-mgr, C3-office top right):** brow, eyes, mouth bar, stubble, comb-over strands, sweat drop and headset boom stack on a 60 px head; at 1x it becomes a dark smudge instead of a clear scowl. C2 face was cleaner.
2. **Zombie face (C3-z-zom):** tears, bags, fangs, drool and mottling are noise at about 40 px head size; the green silhouette and crown tuft carry the read.
3. **Fixture glint slashes** (white diagonal bars at top left and right in `C3-office`) are the highest-contrast marks in the frame, brighter than loot labels; they distract. In C2 only one exists, over the manager.
4. **Floor decals vs loot:** hazard chevrons, footprints and coffee rings are low contrast and sit outside the pools, so no real collision with loot in these shots. The yellow safe lane in the basement (`C3-basement`) runs through the same area as the yellow "Ergonomic Chair" legendary-style ring and beam; the ring still wins, but yellow-on-yellow lowers the loot's pop. Move the lane colour toward desaturated ochre or keep it out of the loot spawn band.
5. **Basement pipe/rack wall** is busy behind the manager (as the notes admit); the manager's orange outline still separates, but a lighter-coloured enemy there would not.
6. **Plant near the loot ring** (right of manager, `C3-office`, `C3-boardroom`) overlaps a loot beam base; props must not overlap loot spawn zones.
7. **Tiny text** (posters, labels, safe-lane signs) is illegible at game scale, so it is texture only. Do not localise it.
8. **Mobile 390x844 (`C3-m`):** actors are about 70 px; C3 detail is invisible and the scene reduces to C2 plus coloured pools. Fine, no regression, but the extra density is wasted work there.

## What works

- Material variation per scene (lattice carpet, concrete with lane paint) changes the identity of each room without touching actors.
- HUD chrome upgrade (stitching, rivets, sheen) is the cheapest visible polish and fully legible.
- Contact shadows, wall-base AO and glass partitions give the props weight so they stop floating.

## Port plan for the WORLD implementer (ordered)

Budget guard: atlas bake 5 s total, fps50 (p50) >= 40. C3's measured +1.8 to 2.1 ms per frame over C2 is mostly the live actor detail; the static layers are free per frame.

Port as is (baked, zero per-frame cost):
1. **Outline clamp** (`clamp(2.0*zoom, 1.6, 4.2)`): 1 line, do first.
2. **Contact shadows and wall-base AO strips** into the existing static bake. Largest "no longer floating" gain per ms.
3. **Bevelled tile seams plus per-tile tone drift** (mirrored orientation). Cheap, breaks the repeated-diamond look flagged in the notes.
4. **HUD chrome bake** (panel sheen, inner shadow, rivets, mug/jug glaze). Port as is.
5. **Light pools: extra baked pools and wall light shafts** into the existing light mask bake; add as bake entries.
6. **Basement and boardroom scene tables** (palette, texture, fixtures, light list), engine reuse from step 3 to 5. Boardroom lattice carpet as is.

Amplify so it reads at hero 100 to 135 px (zoom 1.8):
7. **Floor materials:** raise ambient floor value a few points, or push twill/weave texture alpha about 1.5 to 2x and add a hue shift per tile (e.g. warm/cool alternate) instead of tone-only; otherwise the texture is lost in the dark grade outside pools. A global grade lift is the user's decision (identity); flag it, do not do it silently.
8. **Props at 1x:** keep silhouettes (plant, box stack, A-frame sign, extinguisher) and make their outline or top face one value step lighter; drop fine surface details (drawer labels, sockets, keyboard keys).
9. **Actor detail, per type, baked into the sprite cache** (this was already the plan for 50 monsters): keep and thicken hero headset, tie stripes, badge; zombie crown tuft, torn hem, tooth line only (2 px+); demon CMY stripes and LCD (they read); manager pinstripes and buttons. Increase detail stroke to at least 1.5 px at 1.8 zoom or remove.
10. **Secondary motion:** keep tie sway and cowlick bob (live-drawn parts only), drop sweat drip and LCD flicker unless a sprite frame is free. Per-frame cost goes to the cache, so 50 monsters stay under budget.
11. **Light spill on actors:** the pasted-on look is the most visible gap in `C3-boardroom`. Cheapest fix: a tinted multiply on the actor from the pool colour sampled at its feet (one fillStyle, no extra pass).

Drop (do not port):
- Humour posters, cork-board notices, framed chart text, signs (illegible), including their wall-space transform unless needed for window and board panels.
- Manager facial micro-detail: stubble, sweat drop, comb-over strands, nose. Keep brow and mouth bar.
- Zombie tears, eye bags, mottling, drool.
- Dust motes (about 40 additive dots per frame): invisible at game scale and the only continuous per-frame cost besides actors. Keep only if fps50 has slack after step 10.
- Second flicker pattern and white fixture glint slashes (or tone them to about 40 percent).
- Door mat, coffee rings, footprints, cable tape, scuffs at pixel level: keep as three or four larger decal types max.
- `?legacy`, compare view, zoom review aid, three-scene inlined texture generators from the 124 KB file.
- Yellow safe-lane colour in the loot band; keep it off the yellow rarity colour.

Perf notes: build textures once into offscreen canvases (11 x 64x64 = trivial), re-create patterns only on zoom change; time the bake against the 5 s atlas budget by measuring the three scene bakes separately (C3 reports 14 to 15 ms layout, so risk is in the prop kit of about 40 sprites, not the textures). The 50-monster case needs the per-type sprite cache from step 9 before any live detail is added; C2 drew each actor twice (ring + body) and C3 adds detail on top, so cache first.

## Top 5 fixes (in the C3 file itself, before port)

1. Simplify the manager and zombie faces at 1x (keep 3 features each).
2. Tone down the white glint slashes on fixtures to stop competing with loot labels.
3. Keep props and the yellow lane out of the loot spawn band.
4. Lift the office floor outside pools slightly or use hue-shifted tiles so materials read.
5. Tint actors with the pool colour at their feet.
