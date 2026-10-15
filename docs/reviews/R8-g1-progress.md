# R8-0.1 WORLD-G1 progress

- start: read ADR-0008, spec 13, plan R8-0.1, heroes.js, world.js, vector/index.js, figure.js. Value-domain check: signature slot order head|body|hands|feet|weapon|offhand, `-` empty, `<code><tier>[2]`; can deliver all (items.js slotKeys has the six keys, equipment is `core.equipment`).
- note: `perf()` lives in `src/game.js` (not testhook); adding one spread there (`gearPerf`) - listed under needs/files.
