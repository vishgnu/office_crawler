# R5 WORLD notes (cross-package needs; WORLD-R5)

## What exists
- Hero sprites by class id: `plr:<classId>:<anim>:<dir>:<frame>` (idle 4, walk 6, attack 4, death 4, cast 4; 8 directions), drawn lazily (each frame the first time it is shown). `heroType(classId)` falls back to the old Clerk sprite for unknown ids. Allies: `ally:<intern|cone>:...` (cone: idle only, one frame), drawn from `state.allies`.
- `src/render/figure.js`: `drawFigure(canvas, "hero.<id>"|"ally.<id>", {anim: "portrait"|"card-idle"|"idle"|"walk"|"attack"|"cast"|"death", t, dir})` for DOM cards (no atlas needed). `portrait` is a static pose; reduced motion screens pass `portrait`. Not done: a separate looping 8-frame `card-idle` (it loops the 4 idle frames) and `hurt` (the world shows a red rim on the hero instead).
- `warmHero(atlas, classId, budgetMs)` (render/world.js): optional pre-draw of the class frames (about 0.4 s in total) so the first fight frame never stalls; returns false until done when a budget is given.
- Effects: `src/render/draw/effects.js` (see header). State-backed: `state.zones`, `player.aura`, `player.absorb`, monster `muteT/statusKind/slowT/weakenT/burnT`, `state.allies`. Event-backed: `cast burst hit projectileChain projectileEnd crit status dotTick absorb buffStart aura summon allyDied zoneStart zoneTrigger zoneEnd dash`.
- Light hook: `fx.lights` (also `drawWorld(...).lights`), refreshed every frame by `fx.drawGround`: `[{x, y, r, colour, intensity}]`, x and y are tile centres, r in tiles, intensity 0..1.

## Needs from other packages
- UI/game shell: `fx.reducedMotion` already also stops white flashes and shakes; there is no separate `reducedFlash` option (`fx.reducedFlash` exists and is honoured if the shell ever sets it). Call `warmHero(atlas, player.class)` when a class is chosen or a slot continues (optional).
- CORE (optional, nothing breaks without it): floaters may carry `dmgType` (physical/fire/cold/shock/acid) to get the type tint; today they use the classic yellow. `crit` floaters get a `!` suffix and a larger size.
- Audio: unchanged; the `projectile` kinds `pen card paper sealed shard bolt zap` are new in `PROJECTILES` (sprite keys `proj:<kind>`).
