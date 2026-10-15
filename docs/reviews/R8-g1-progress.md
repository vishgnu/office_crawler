# R8-0.1 WORLD-G1 progress

- start: read ADR-0008, spec 13, plan R8-0.1, heroes.js, world.js, vector/index.js, figure.js. Value-domain check: signature slot order head|body|hands|feet|weapon|offhand, `-` empty, `<code><tier>[2]`; can deliver all (items.js slotKeys has the six keys, equipment is `core.equipment`).
- note: `perf()` lives in `src/game.js` (not testhook); adding one spread there (`gearPerf`) - listed under needs/files.
- done: gearlooks.js, gearparts.js (stubs+trim), gearcache.js, hooks in heroes.js (golden call-stream pre-R8 equal), world.js integration, atlas.bakeHero, figure.js look, figureHost.look, game.js perf, test/render-r8-gear.test.js (24 pass); next: full npm test x3, build, e2e render assertions, bench
- done: e2e/render.mjs gear checks (37/37), perf heroDigest probe, bench geared scene (BENCH_GEAR=1 for all scenes); e2e/helpers.mjs SHOTS honours E2E_SHOTS; next: npm test x3, full e2e, bench x5
- done: npm test 3x (render/gear all green; reds only from CORE-R8-1 in-flight), e2e render/polish/replay green, bench 5 runs; handed back
