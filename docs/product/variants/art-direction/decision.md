# Decision: art direction

Status: decided (PROXY), style frozen after round-2 review (appeal 33 ship, craft 32 ship)
Date: 2026-10-13
Picked: C (stylised vector), graded darker with A's lighting model ("C-dark")
Confidence: medium (high that C is the right base; medium on how dark the grade goes)

**PROXY** decision, provisional until the real customer reviews it. Overrule any part in `proxy-log.md`.

## Reasons
1. Customer words: "we want nice sound and graphics" and "stay close to the original" (00-brief.md: close in mechanics and feel;
   original art is not to be copied). "Nice graphics" is met by C most clearly: both reviewers scored it highest (appeal 34/40, craft 30/40,
   A 31/29, B 27/26) and both ranked C > A > B. Viewed C-desk-f92 myself: the hit moment (outlined "63", paper burst, recoil) and the silhouettes read at a glance.
2. "Feel of the original" is a hack-and-slash that must be played for hours. That depends on readability in crowds (up to 50 monsters, NFR-P01),
   where C is best and A is worst (dark-on-dark actors, 23 fps software GL). A is the mood reference, not a base.
3. Moodiness is the one thing C lacks (theme 3/5 in both reviews), but it is a grade, not a redraw: both reviewers say it can be bought back with
   value, vignette and light. A's mood is expensive to get right at scale (effort L); C's is cheap to fix (effort M).
4. B: cheapest and most consistent, but the 35 px actors cannot carry ten monsters and a boss, and the phone view is unusable. Lowest appeal.
5. Risk on record: if the real customer values "moody" over "friendly and readable", A (with its readability and performance budget) is the alternative.
   This is a taste call within delegated scope (Q2 look and tone); nothing legal or irreversible. Not an IP question: all three are original drawn art.

## Art-direction rules (what to borrow)
Primary style: C. Bold dark outlines at constant screen width, flat fills with one shade step per surface, rim light on up-left edges, banded light.

From A (tone and light):
- Grade the floor and wall values about 25% darker than r1 C, with a strong vignette and real darkness outside the hero's light radius; keep outlines and flat colours.
- Light model: warm amber monitor pools, a cold green-white flickering fluorescent pool with a clear edge, a red emergency tint on the demon side. Implement as a
  pre-baked low-resolution light mask plus sprite-level glow, max 4 dynamic lights.
- A few grime / stain / blood decals on floor and cubicle walls (baked into the static layer).
- Replace C's purple globe rim with a riveted iron-and-glass frame.
- Serif or slab type for Unique item names only; sans stays for all other UI.
- Keep the floor-to-wall value separation at least 3:1 inside the hero's radius so the layout still reads after darkening.

From B (discipline and performance):
- One palette, one outline weight, pixel-snapped HUD. Cache all sprites and static geometry in offscreen canvases; light layers at half resolution or lower.
- A quality switch ("low fx": dithered or flat darkening instead of blended light) targeting 40+ fps in software GL; this doubles as the high-contrast/low-fx option.
- Keep the shared scene engine separate from a swappable renderer (notes.md cross-cutting finding).

Shared rules for all later art: rarity is never colour alone (marker shape, border style, beam shape, which C already does); rim light on every actor so
none sinks into the dark; label text sizes are demoted relative to characters.

## Must-fix items for the next round (both reviews)
Readability and feedback
1. Damage number spawns above the target's nameplate and head and rises over about 400 ms; the nameplate fades during the hit. It must never cover the Zombie Intern plate or the hero's face (C-desk-f92).
2. Hero must separate from the Zombie Intern: hero about 10% larger, bright lanyard/tie highlight, distinct face value (not the Manager's skin value); zombie darker green with a ragged silhouette.
3. Reduce label clutter: loot plates smaller (about 60%), full text on hover/Alt or when the hero is near, nameplates directly above each head; no label may overlap another or the fluorescent fixture.
4. Manager's oversized head must read as attached to the body (shoulders/neck or a size change).
Tone
5. Darker grade, stronger vignette, dark falloff outside the hero's light, cold green fluorescent pool with a clear edge, red emergency tint near the demon, grime decals (see rules above). Re-test readability after grading.
Accessibility (NFR-A03/A04)
6. Health and mana distinguishable without hue: numeric value in or under each globe, a glyph per globe (heart/flame or similar), and different liquid-surface patterns. Test with deuteranopia and protanopia filters.
7. Rare vs Unique: separate further than yellow vs orange: Rare toward lighter lime-gold, Unique deep orange-red with a notched border and white inner stroke; markers at least 16 px; keep the shape and beam differences. Test with a colour-blind filter.
8. High-contrast option noted for later (body text 4.5:1 on all label plates).
Layout and polish
9. Clamp all labels to a safe area (8 px from the edge) and shorten nameplates on narrow screens; show all 6 skill slots (or scroll). Phone is secondary (NFR-B02: MVP minimum 1024 px), so this is lightly weighted but the clamp is cheap.
10. Skill bar: slot number must not overlap icon corners; simplify busy icons 2 and 5 at 70 px.
Performance
11. Cache sprites to offscreen canvases and bake outlines; light layers at reduced resolution; re-measure and report at least 40 fps in software GL (r1: 29), with a test scene of 50 monsters before committing to the renderer design.
Risk to watch
12. C looking generic: keep the distinctive palette (indigo base, teal walls, warm accents) and the office-comedy proportions; the reviewers should check distinctiveness in round 2.

## Next
One round-2 pass of C-dark on the same tile (fixes 1 to 12), reviewed by both visual reviewers, then freeze the style. No new variants.


## Round G (C3): graphics detail round
Date: 2026-10-14
Status: decided (PROXY)
Confidence: high on direction (port, no mock-up); medium on the exact lift (12 %)

**PROXY** decision, provisional until the real customer reviews it. Overrule any part in `proxy-log.md`.
Input: fifth briefing (verbatim, 00-brief.md): "the style idea is good but more details and polishing" (real customer, agreed). Reviews: appeal C2 28 / C3 31, craft C2 29 / C3 31, both "iterate". Viewed C3-default-f92 and C3-boardroom-f92 myself.

### Decision on the orchestrator's proposal: APPROVED, with two adjustments
- No C4 mock-up round. The customer said the style idea is good; the style is frozen and the reviews give a concrete port list. Port straight into the game, then review in-game at real scale (hero about 100 to 135 px), not at the 200 px of the mock-up. A further mock-up would only re-argue a settled style.
- Adjustment 1: the in-game review is the gate. Both reviewers re-score in the game with the same 8 criteria; target 34+ (appeal reviewer's estimate with items 1 to 5). If under 33, one more fix pass, still no new variants.
- Adjustment 2: every item below is checked at game scale; anything under about 2 px that does not read at 1x is dropped, not ported "for later".

### Mood question: LIFT, +12 % ambient mid-tone outside the light pools
Reasons:
1. The customer asked for "more details"; both reviewers independently found the dark grade hides the new materials (floor weave, wall panels, bevels) everywhere except inside pools. Detail the player cannot see does not answer the brief.
2. "Stay close to the original" is about mechanics and feel (brief); the moody read comes from pools, vignette, coloured light and contrast between lit and unlit, not from near-black corners. A modest lift keeps all of that.
3. Round-1 decision (C-dark) already made the grade darker with medium confidence; this is a refinement within the same Q2 call, not a reversal. The boardroom shot already shows that materials plus dark mood work together.
Limits (keep the mood):
- Lift only the ambient floor/wall mid-tones, about +12 % luminance (allowed range 10 to 15 %). Do NOT lift the vignette corners or the pool-to-ambient ratio: pools must stay clearly brighter and more saturated. The darkest 15 % of the frame stays dark.
- Prefer hue shift per tile (warm/cool alternate) and texture alpha 1.5x inside pools over pure brightness, so the lift can stay small.
- Make it one named constant (AMBIENT_LIFT) so the real customer can turn it back to 0 in one edit. Record the before/after screenshots.
- Floor-to-wall separation stays at least 3:1 inside the hero's radius (round-1 rule).
This is an identity call; flagged for the real customer in `proxy-log.md` to confirm or revert.

### Merged port checklist (WORLD implementer; order matters)
Port as is (baked, 0 per frame)
1. Outline clamp `clamp(2.0*zoom, 1.6, 4.2)`.
2. Contact shadows under props and wall-base AO strips in the static bake.
3. Bevelled tile seams plus per-tile tone drift and mirrored orientation (breaks the repeated diamond).
4. HUD chrome bake: panel sheen, inner shadow, stitched border, rivets, mug and jug glaze, snapped icons.
5. Extra baked light pools, second fixture, window light shaft, exit-sign pool, brighter inner band; max 4 dynamic lights still holds.
6. Basement and boardroom scene tables (palette, textures, fixtures, lights) on the shared engine; boardroom lattice carpet as is.
7. Baked material textures (11 procedural 64x64 overlays, patterns re-created only on zoom change).
Amplify so it reads at 1x
8. AMBIENT_LIFT +12 % (above), hue-shifted tiles, texture alpha 1.5x inside pools (light mask above about 40 %).
9. Actors receive pool colour: multiply tint 15 to 25 % from the light colour at the feet plus a soft coloured ground shadow (both reviewers' top gap).
10. Characters: 2-tone shading (light/shadow side) and 2 to 3 large colour blocks per type (hero white shirt panel, cyan lanyard, contrasting shoes; zombie torn sleeve in a second green, grey-purple trousers; manager lighter lapel); faces 1.5x larger and darker; detail strokes at least 1.5 px at zoom 1.8. Keep hero headset, tie stripes, badge; zombie crown tuft, torn hem, one big mouth with two fangs; demon CMY stripes and LCD; manager pinstripes, buttons, brow and mouth bar.
11. Props: 3 to 4 distinctive large silhouettes per room kind at about 40 to 70 px (office: coffee machine, water cooler, plant, copier; basement: barrel, valve wheel, pallet; boardroom: podium, trophy case); top face or outline one value step lighter; rim-light 1 px edges on wall tops, desk and table edges facing light; per-area wall-base glow (teal / rust / burgundy). Props and floor paint never overlap loot spawn zones.
12. Secondary motion that reads at 1x: tie sway 2 to 3x, 2 px idle breathing bob on hero and manager, visible mug steam; live-draw only the swaying parts over a per-type cached sprite.
13. Cache first: per-monster-type sprite cache of static detail before any live detail; budget atlas bake at most 5 s, fps50 p50 at least 40 with 50 monsters.
Drop (do not port)
14. Posters, cork-board notices, framed-chart text, signs and the wall-space transform (unless needed for window/board panels).
15. Manager stubble, sweat drip, comb-over strands, nose; zombie tears, eye bags, mottling, drool; hero laces, trouser creases, cuffs.
16. Dust motes (keep only if fps50 has slack after item 12), second flicker pattern, LCD flicker.
17. White fixture glint slashes (drop or tone to about 40 %, they out-shout loot labels).
18. Fine pixel decals: door mat, coffee rings, footprints, cable tape, scuffs, sockets, vents, keyboard keys, drawer labels. Keep 3 to 4 larger decal types.
19. Yellow safe-lane colour: ochre, outside the loot band, never near the yellow rarity colour.
20. Legacy switch, compare view, zoom aid, inlined three-scene generator file.
Acceptance: every must-fix of round 1 still holds (no label covers the damage number, hero separates from zombie, rarity not by colour alone), then in-game review by both visual reviewers.
