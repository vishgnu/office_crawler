# R5 world progress (WORLD-R5, implementer)

Progress lines (L-15): one line per finished item, "done: X; next: Y".

- done: read contract, ADR-0005, figures.js, renderer; hero painters `styles/vector/heroes.js` (FM, SR, IT + ally intern/cone), lazy atlas sprites per class (`plr:<classId>:...`, `ally:<id>:...`), world.js picks sprite by `player.class` (fallback old clerk), allies drawn from `state.allies`; next: effects module.
- done: `render/draw/effects.js` (slam, ring, burst by type, field zone, trap, aura, shield dome, dash+hand truck, chain arcs, stamp, summon puff, crit star, status overlays, light descriptors `fx.lights`), new projectile sprites (pen, card, paper, sealed, shard, bolt, zap) with trails, floaters tinted by damage type; next: staging harness scenes + screenshots.
- done: harness class fights + screenshots (r5-world-*), render tests test/render-r5.test.js, reduced motion/flash; next: distinguishability check at 60px, bench, tests x3, core-notes sync
