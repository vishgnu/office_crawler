# S2 fix round: CORE-FIX notes for UI-FIX (2026-10-13)

What core now provides (see also `S2-fix-contract.md`). The UI owner decides how to draw and wire it.

## Map (R-075)
- `state.floor.explored`: plain JSON array of 0/1, length `w * h`, index `y * w + x`. The same array is mirrored in
  `state.floors[depth].explored` (kept when a floor is left and re-entered). Core marks a circle of radius
  `config.exploreRadius` (6) around the hero each tick; the Lobby (depth 0) is all 1.
- `exploredAt(state, x, y)` is exported from `src/core/index.js`.
- Core does not handle `KeyM`/`Tab`; `ui.panels.map` is UI state (game.js).

## Emergency Exit (R-046)
- Item base `emergency-exit`: `kind: "consumable"`, `slot: "consumable"`, `effect: "portal"`, 1x1, `restores` absent.
  Belt-able: core `toBelt`/`clickBelt` accept `kind` potion or consumable. **UI**: `itemview.js` `canDropOn` for the belt
  (`held.kind === "potion"`) and the panel's right-click (`panels.js` ~l.429, only potions go to the belt) must also accept
  `consumable`; right-click on a consumable in the inventory should send `{t:"useItem", id}`; clicking a belt slot
  with a consumable in it still goes through `{t:"useBelt", index}` / key 1-4 (both work for consumables).
- Input: `{t:"useItem", id}` (inventory or belt; potions work too). Unknown id: `{ok:false}`, no state change.
  In the Lobby the Emergency Exit is rejected (`{ok:false, error:"not on a floor"}`) and is not consumed.
- State: `state.portal = { depth, tile, lobbyTile }` or `null`. Using it on a floor moves the hero to the Lobby at once
  (events `portalOpen {depth, tile, lobbyTile}` then `floorEnter`). The Lobby door stands on `state.portal.lobbyTile`
  (config `portal.lobbyTile`, default 10,9). Draw sprite `fx:portal` there while `state.portal` is set and `depth === 0`.
  Clicking the door tile (`{t:"click", tile}`) or `{t:"usePortal"}` walks there and steps through; walking over it
  does nothing by itself. Event `portalUse {depth, tile}`; the door closes (`state.portal = null`). Exported: `portalAt(state, tile)`.
- Vendors (both) sell it as an unlimited stock entry (`e.item.base === "emergency-exit"`, no `restores`). Tooltip needs
  a line for `item.effect === "portal"` (no string exists yet; add to the UI string table).

## Stash (R-059)
- `{t:"stash", id, to:"stash"|"inventory"}` now fails unless: Lobby, `ui.dialog.kind === "stash"`, hero within `interactRange`
  of the stash NPC. Errors: `"stash not in reach"`, `"no such item"`, `"no room"` (with an `inventoryFull` event; the
  item stays in its original cell). The UI should only show the stash grid while the dialog is open (it already does).

## Other state/behaviour the UI may notice
- Vendor stock is now rolled once per Lobby visit (`state.vendorStocks`); reopening the window shows the same stock with
  purchases removed. `state.vendor.visit` only increases after a trip to a floor and back.
- `sell` now needs the vendor within reach (`vendorInReach`).
- `cast` is rejected with `{ok:false, error:"busy casting"}` while `player.castT > 0` (no mana spent).
- Fists: a worn weapon replaces `config.unarmed` (now 1-2) instead of adding to it; the character panel's damage line is
  simply `player.damage` as before. Resistances are capped at `config.caps.resist` (75), defense at 400, attack rating at 600.
- New state fields: `blockedSpawns`, `vendorStocks`, `townVisit`, `portal`; player: `toPortal`. Ground entries released from
  the cursor carry `keep: true`.
- XP display contract (UI side): `player.xp`, `player.xpNext` (total xp for the next level), previous threshold
  `config.xpTable[level - 1]`; within-level numbers are `xp - xpTable[level-1]` over `xpNext - xpTable[level-1]`.

## Balance pass (config only; numbers in `src/core/config.js`)
- XP: `xpCurve {quad 36, lin 110}` (was 20/60): level 5 at 1,016 xp, level 10 at 3,906, level 14 at 7,514. **e2e/ui.mjs** line ~142
  expects "0 / 200 to level 5" after `setLevel(4)`; the span is now `xpTable[4] - xpTable[3]` = 36*7+110 = 362 xp
  (use `config.xpTable` in the assertion instead of a literal).
- Monsters: `scaling.hpPct` 28 -> 80 per depth, damage unchanged (14), floor budget 22+5/depth -> 120+32/depth with
  `population {packsWanted [12,16], maxPacks 50, tries 400}` (a floor has about 40 monsters on floor 1 and about 100+ on floor 8).
- Economy: potion price x2 (`consumableValueMult`), potion drop 0.12 -> 0.08, gold piles (3 + 2/depth), natural regen 1 hp / 40 ticks, 1 mp / 30.
- Fists 1-2 (a worn weapon replaces them).
- Bot (`bot/policy.js`): sells spare gear and buys vendor upgrades with spare gold, kills a monster that blocks the next path
  tile, counts casting as progress (all three removed hangs or death spirals that came from the denser floors, not from the game rules).

## Not owned by core (left as is)
- None open at the end of the round: the `layout`, `dropCheck` and XP display tests that failed mid-round were UI-FIX work in
  progress and pass in the final `npm test` runs.
