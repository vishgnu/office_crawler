# Decision: art direction

Status: decided (PROXY)
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
