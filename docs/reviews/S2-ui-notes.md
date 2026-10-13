# S2 UI notes for the WORLD package and the lead (from the UI implementer, 2026-10-13)

UI changed: `src/ui/**` (new: text.js, icons.js, itemview.js, messages.js, panels.js; layout.js, camera.js, screens.js extended), `src/input/{pick,keys}.js`,
`src/render/hud.js` (HUD state + frames only), `src/game.js`, `src/main.js`, `src/testhook/index.js`, `src/style.css`, `src/index.html`, `e2e/**`, `test/ui-*.test.js`.
No WORLD or core file was touched.

## What the UI now does with WORLD's hooks
- `fx.hc = hc` at creation; `fx.showAllLoot` follows the Alt key (keydown/keyup/blur); `fx.hoverLootId` is the ground entry under the pointer.
- NPC pick: `game.pickAt` adds the Lobby NPCs (box test like monsters). A hit returns the NPC's own tile and `npcId`; the core then runs `interact`.
  `game.hover` is `"npc:<id>"` for a hovered NPC, so the nameplate hover rule in `labels.place` works unchanged.
- On `floorEnter` the shell clears `game.prev`, the facing map and the camera focus (no glide across floors).
- The camera takes a horizontal inset (`makeCamera(..., shiftX)`, `game.inset`) so the hero stays centred in the gap between open drawers.
  `labels.place` still gets the HUD rects only; drawers are DOM and sit above the canvas (plates under a drawer are simply covered).

## Needs / questions for WORLD (none blocking)
- None required. Nice to have: a lighter vignette at the screen edges while drawers are open (the decision asks for "screen edges dimmed only", the shell does not dim at all).

## Behaviour the lead should know
- The real start is the Lobby. Test pages get `&start=floor` from `e2e/helpers.mjs open()` unless `lobby: true` is passed; `?start=floor` (with `?test=1`) is the only switch, the product never reads it.
- The skill bar starts empty (core `skillBar.hotkeys` are null); the basic attack is the left button. The first learned skill lands on F1. Right mouse with nothing selected shows a toast.
- Left drawer = Employee File | Skills | NPC window (one at a time); right drawer = Desk Drawer. Opening an NPC window opens the Desk Drawer too (selling, stash).
- The game never pauses for panels (decision). Escape order: item in hand -> back where it came from; drawers open -> close them (and the dialog); else the core (closes a dialog, then pauses).
- `__app.cheat.giveItem(opts)` (spawn + pick up in one step) was added next to the six requested cheats; `__app.ui.open/close/toggle(name)` mirrors the I/C/S keys.
