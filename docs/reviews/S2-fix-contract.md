# S2 fix round: contract between CORE-FIX and UI-FIX (2026-10-13)

Shared data contract, fixed by the orchestrator before both agents start:

- **Map (R-075):** `state.floors[depth].explored` is a plain JSON array of 0/1 values with length `floor.w * floor.h`,
  indexed `y * w + x`. Core marks tiles within the hero's light radius (config.exploreRadius, default 6) each step,
  and in the Lobby everything counts as explored. The UI draws a minimap (corner) and a full automap overlay
  (Tab or M toggles `ui.panels.map`). Core exposes `exploredAt(state, x, y)`.
- **Emergency Exit (R-046):** item base `emergency-exit` (consumable, belt-able, stack 1) and input command
  `{t:'useItem', id}`. Core: on a floor, it opens a return door at the hero's tile (`state.portal = {depth, tile}`) and
  moves the hero to the Lobby; in the Lobby, the door tile `state.portal.lobbyTile` leads back to `{depth, tile}` and
  closes. Events: `portalOpen`, `portalUse`. Vendors sell it. UI: usable by right-click in the inventory or from the
  belt; WORLD-style sprite drawn by the UI-FIX agent in src/render/styles (sprite key `fx:portal`).
- **Floor 8 (AC-R-043-2):** the proxy answer QF-04-5 wins (the boss arena is depth 9 in S3). Floor 8 keeps a
  **locked** down-stairs tile; the spec AC is amended to match, and a test pins it.
- **XP display:** the UI shows within-level numbers: "xp into level / xp needed for level (n%)", plus the total XP in the tooltip.
