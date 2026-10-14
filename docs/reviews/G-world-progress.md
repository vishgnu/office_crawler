# WORLD-G progress (graphics detail round, Fifth briefing)

Progress lines (L-15): one line per finished item, "done: X; next: Y". Checklist = docs/product/variants/art-direction/decision.md "Round G (C3)".

- done: read the briefing, decision.md Round G, both R3 reviews, C3.html source; baseline measured (atlas 3.2-3.7 s at 1280 under load 4-6, fps50 59.5, npm test 559 pass); before-shots in /tmp scratch; harness scenes + e2e/world-g-shots.mjs added; item 1 (outline clamp: shapes.js ink factor K from atlas rim) done; next: items 2, 3, 7 (textures, bevels, AO).
- done: items 2, 3, 7, 8 (base): shapes ink factor; render/draw/textures.js (11 overlays); floor variants 12 (bevel, tone drift, mirror) + palette.scenes table; wall AO strips + wall-base glow + wall textures baked into wall sprites; office window wall + light shafts; AMBIENT_LIFT (light.js) with corner-fading lift; static pools (2nd fixture, exit, shaft) + core band; actor multiply tint + coloured offset shadow (item 9); next: HUD chrome (4), characters (10), props (11), motion (12)
