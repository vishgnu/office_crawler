# S2 WORLD notes for the UI package (from the WORLD implementer, 2026-10-13)

WORLD changed only `src/render/{styles/**,world.js,fx.js,labels.js,light.js,atlas.js,keys.js}`, `src/render/draw/**`, tests and e2e shots.
No UI-owned file was touched. The renderer entry points keep their signatures, so `src/game.js` works unchanged:
`drawWorld(g, cam, atlas, core, prev, alpha, fx, now, rs, env)`, `fx.handle/draw/drawHurt/drawLowHp`, `lighting.ensure/select/draw`, `labels.place/draw`.

## Things the UI can (optionally) hook up
- `fx.hc = game.hc` (loot plates use the solid high-contrast palette when set), `fx.showAllLoot = true` while Alt is held (all loot plates),
  `fx.hoverLootId = <groundItems id>` for the hovered ground entry (plate forced). All three default to off, nothing breaks without them.
- `fx.floaters` no longer exists: floaters are drawn from `state.floaters` (one source). Do not read `fx.floaters` / `fx.flash` (kept as an empty Map).
- Hit flash now comes from `flashTicks` in the state, not from an event timer.
- NPC nameplates: `drawWorld` appends NPC entries to `out.actors` (`{id: "npc:<id>", npc: true, name, type: "npc-<id>"}`), `labels.place` shows them
  without a health bar. Hover/pick of NPCs (and the click -> `interact`) is the UI's job: `input/pick.js` must treat an NPC tile as a target.
- The elevator is a tall doorframe prop drawn at `floor.exit` in the Lobby (atlas key `fx:elevator`); the tile under it is `stairs-down`.
- Hero cast pose uses `player.action === "cast"` / `castT`; the Reply-All / Coffee Break / level-up / heal FX are driven by the core events
  `cast`, `burst`, `heal`, `healed`, `levelup`, `projectile`, `projectileEnd` through `fx.handle` (the bus already forwards every event).

## Bench and test hook (not WORLD files)
- `bench/bench.mjs` spawns its 50 monsters with `cheat.spawnMonster` after `newGame`. Once the game starts in the Lobby the spawn is refused
  (`no running floor`), the bench then reports 0 monsters (fps 56.7 with nothing on screen). It needs `cheat.teleportFloor(1)` (test hook) first.
  WORLD measured the same crowd with its own harness instead (see below).
- The test hook does not expose `cheat.teleportFloor / spawnItem / setLevel / giveGold` yet; WORLD's shots use `e2e/world-harness.js`,
  which drives the real renderer modules against staged core states and does not depend on the hook or the shell.

## Atlas cost
- 1719 sprites (was ~430): 9 monster types x 144 figure frames, 4 NPCs, hero cast frames, 3 themes x 10 room kinds. Build time at the bench viewport
  (1280x720, scale 2) is about 3.9 s in software GL (budget 5 s), at 1080p zoom 1.8 (scale 2.5) about 5.5 s. The build yields between steps, so the page
  stays responsive, but a loading bar is worth keeping. The rim bake uses 12 stamps instead of 32 to pay for the extra figures.
