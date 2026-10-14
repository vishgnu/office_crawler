# R5 fix round: data contract between SAVE-FIX and UI-FIX (L-13)

_Written by the orchestrator 2026-10-14 before both packages start. Both packages code against this; neither changes it
without telling the orchestrator in its result._

## 1. `game.slots` (slotsView, `src/save/session.js`) gains

```js
game.slots.status = {
  storage: "ok" | "memory" | "full",   // "memory": localStorage blocked, nothing persists (ADV-R5-06)
  owner: "self" | "other" | "stale" | "none", // "stale": owner heartbeat older than OWNER_STALE_MS (CR-01 / ADV-R5-02)
  notice: null | "no-active-slot" | "pre-switch-save-failed" | "migration-failed" // CR-07, CR-05, CR-08; a text key in ui/text.js
}
// every slot summary in game.slots.list[i] gains:
deepest: number            // deepest floor reached (CR-12), 0 = Lobby
savedAt: string            // ISO 8601 UTC of the last write (CR-12); UI formats date + time
hasPrev: boolean           // an undo copy exists (CR-15: UI must not read the adapter)
```

## 2. New commands (through `game.cmd` → `session.run`, same `{ t: ... }` style, results `{ ok, reason? }`)

| Command | Effect |
|---|---|
| `{ t: "takeOverSaves" }` | This tab becomes owner (allowed when owner is "stale" or "other" after the player confirms) |
| `{ t: "exportSlot", slot }` | Returns `{ ok, text, fileName }` (CR-15: replaces the UI's direct adapter read) |
| `{ t: "dismissSaveNotice" }` | Clears `status.notice` |

Existing reasons keep their names; new reason: `"stale-owner"` is NOT used (a stale owner is taken over automatically on
the next write only when `owner === "stale"` AND this tab started after the stale beat; otherwise "another-tab").

## 3. Ownership

| Package | Owns (may edit) |
|---|---|
| SAVE-FIX | `src/save/**`, `src/core/**`, `src/main.js`, `src/game.js`, `src/testhook/**`, `test/**` except `test/ui-*.test.js`, `docs/product/decisions/ADR-0006*` (amendment section) |
| UI-FIX | `src/ui/**`, `src/style.css`, `test/ui-*.test.js`, `e2e/**` except `e2e/adv-r5.mjs` and `e2e/run-all.mjs` |
| WORLD-FIX | `src/render/**`, `test/render-*.test.js`, `docs/shots/g3-*` |

`e2e/adv-r5.mjs` belongs to the adversarial tester: its XFAIL checks turn into XPASS by themselves. Nobody edits it.
