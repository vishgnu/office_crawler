# ADR-0003 Test hook (`window.__app`) and the scripted bot player

Date: 2026-10-13. Status: proposed. Depends on ADR-0002. Implements R-120..R-123, NFR-S01, AC-NFR-Q01. The member names are those of `../30-spec/10-tech-and-testability.md` ("Test contract"); the short aliases requested by the harness (`clickTile`, `clickScreen`, `setSeed`, `pause`) are added as thin wrappers so nothing in the spec has to be renamed.

## Context

Agents (the Playwright suite and the customer-proxy "bot player") must be able to read the whole game state, send the same inputs a human can, and advance time deterministically. The hook must be absent in normal play (AC-R-123-1, AC-NFR-S01-1), must not change simulation results, and must work from `file://`.

## Decision

### Activation
- `?test=1` enables the hook. Parsed once at boot in `src/testhook/index.js` from `location.search`. Without it `window.__app` is never assigned (`undefined`).
- Optional parameters (only read when `test=1`): `seed=<int>` (initial seed shown on title; `newGame` still needed to start, AC-R-120-1), `style=<id>` (art review), `realtime=1` (see below), `mute=1`.
- **Manual clock by default in test mode.** With `?test=1` the requestAnimationFrame loop still renders but does **not** advance the simulation; ticks happen only through `step(n)`. This makes `step(n)` exact (AC-R-121-3), makes runs independent of frame rate (AC-R-113-3) and removes flakiness. `?test=1&realtime=1` runs the normal accumulator loop as well (for a human or bot watching, and for the frame-time perf check `perf()`); in that mode `step(n)` adds n ticks on top and tests that need exactness must not use it.
- After each `__app` call that changes state, the hook requests one render so screenshots are current.

### API (all synchronous, return JSON-serialisable values)

| Member | Behaviour |
|---|---|
| `describe()` | Array of `{name, kind:'fn'\|'obj', doc}` for every member below; test asserts each listed function exists (AC-R-121-1). |
| `getState()` | `snapshot(state)`: a `structuredClone` of core state with derived fields filled (`player.pos`, `tile`, `floor` minus nothing). JSON round-trip safe (AC-R-121-2). `getState().hash` is `hashState`. |
| `newGame({seed, class})` | Create a run (title -> `floor` in S1, `town` from S2). Returns the snapshot. |
| `setSeed(n)` | Alias for `newGame({seed:n, class: current class})`; also stores `n` as the seed shown at the title. |
| `step(n)` | Run exactly n ticks via core `step` (stops early only if `scene` becomes `error`), dispatch events to the bus after every tick, render once, return the snapshot. While `paused`, ticks do not advance (AC-NFR-A02-1). |
| `click({tile:{x,y}} \| {screen:{x,y}}, {button=0, hold=false})` | Builds the same input command a DOM event would (`screen` goes through `screenToTile` with the current camera and UI hit-regions, exactly like a real mouse event), then `applyInput` immediately (no tick). So `player.target`/`path` are updated before the next `step` (AC-R-005-2). `hold:true` leaves the button down until the next `click`/`key` release call or `mouseUp()`. |
| `clickTile(x, y, opts?)` | `click({tile:{x,y}}, opts)`. |
| `clickScreen(x, y, opts?)` | `click({screen:{x,y}}, opts)`. Coordinates are CSS pixels of the canvas. |
| `mouseMove(screen\|tile)`, `mouseUp()` | Move the held cursor (AC-R-005-6) / release the button. |
| `key(code, phase='press')` | Same as a keyboard event with `KeyboardEvent.code` semantics (`'KeyI'`, `'Digit1'`, `'Escape'`, `'Tab'`), passed through the key map so rebinding works. |
| `pause()` | Toggles pause exactly like `key('Escape')` and returns `paused`. |
| `cmd.moveTo(tile)`, `cmd.attack(monsterId)`, `cmd.use(itemId)` | Agent commands (R-121). Validate arguments, then issue the same input a click would. Return `{ok:true}` or `{ok:false, error:'<non-empty text>'}` and never throw or change state on failure (AC-R-121-7). More commands may be added (`cmd.pickup(id)`, `cmd.descend()`, `cmd.skill(id, tile)`); they must be listed in `describe()`. |
| `cheat.spawnItem(spec)`, `spawnMonster(type,tile)`, `setLevel(n)`, `setHp(n)`, `giveGold(n)`, `teleportFloor(depth)`, `throwInTick()` | Debug cheats (R-123). They write through core functions in `src/core/cheats.js` (so they are Node-testable) and go through the same validation: no hostile spawn in town (QF-04-1), occupied tile rejected. |
| `save.write()`, `save.read()`, `save.export()`, `save.import(text)` | Bridge to `src/save/` (S3). |
| `audio.getState()` | `{ctxState, master, sfx, ambient, muted, effectiveGain, cueLog[]}` read from the real `GainNode`s (S3). |
| `perf()` | `{frameMs[], simMsPerTick, samples}` from the render loop and `step` timing. |

All state changes go through `applyInput`/`step`, never by assigning to state fields from the hook, except the cheats (documented, test mode only).

### How Playwright tests use it

```js
// e2e/helpers.mjs
export async function open(browser, {seed = 1, style} = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href + `?test=1&seed=${seed}`);
  await page.waitForFunction(() => window.__app?.getState().scene === 'title');
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split('.').reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  return { page, app, errors };
}
// test
const { app } = await open(browser, { seed: 7 });
await app('newGame', { seed: 7 });
const s0 = await app('step', 120);
assert.equal(s0.tick, 120);
await app('clickTile', 12, 9);
const s1 = await app('step', 200);
```

Rules for tests: assert on `getState()` fields, not on pixels, except the checks that name pixels (AC-R-112-2 colour count, art review screenshots by the independent reviewer); never use `waitForTimeout` for game time (use `step`); compare runs with `getState().hash`; run each engine with the same file.

### Scripted bot player ("customer proxy plays")

Two executors share one pure policy:

- `bot/policy.js`: `decide(snapshot, memory) -> command | null`, where a command is `{type:'moveTo'|'attack'|'pickup'|'use'|'descend'|'equip'|'spendPoints'|'wait', ...}`. Pure, no I/O, written against the documented snapshot only (so it is a faithful test of what the contract exposes). Heuristics: heal below a HP fraction using belt potions, attack the nearest living monster in sight, pick up items/gold, equip upgrades by a simple score, spend attribute/skill points by a fixed build, head for the exit when the floor is cleared or explored, return to town to sell when the inventory is full, stop at victory or death.
- `bot/run-headless.mjs` (Node): imports `src/core` directly, loops `decide -> applyInput -> step(state)` for up to N ticks, no browser. Thousands of ticks per second; used for balance (R-006 run length via `tick / tickHz`, QF-01-5), regressions, soak tests and for generating the golden `run-a` fixture. Writes a JSON report (`bot/out/*.json`: seed, ticks, deepest depth, deaths, items found, time in each state, uncaught errors).
- `bot/run-browser.mjs` (Playwright): drives `window.__app` through the same `decide`, takes a screenshot every K ticks to `bot/out/shots/` for the visual reviewer and records page errors. It proves that what the headless bot can do is also possible through the real page.

The bot only uses `cmd.*`, `click*`, `key`, `step`, `getState` (and optionally `cheat.*` to jump to a scenario, flagged in the report). Findings go to the harness learnings log; the bot is a harness test subject (project brief) and is never shipped (`bot/` is outside `src/`).

### Determinism cross-check
`test/fixtures/run-a.json` is a list of `{tick, inputs[]}` entries recorded once from the bot. `test/replay.test.js` (Node) replays it and compares `hashState` to `run-a.hash`; `e2e/replay.mjs` does the same through `__app` in each engine (AC-R-120-2, AC-R-122-1, AC-NFR-Q01-1/2).

## Consequences

- The hook is a thin adapter over core functions; there is no logic in it to get wrong. Two exceptions: coordinates conversion (`clickScreen`) and event dispatch, both covered by E2E.
- Cheats ship in the bundle behind the flag. If this is judged unacceptable at release, a build flag can strip `src/testhook/cheats` for a "release" build while the spec's "production build" tests run on the normal build (`npm run build -- --no-testhook`); not planned for MVP.
- Manual clock in test mode means a human opening `?test=1` sees a frozen game until `realtime=1` is added. Documented in the README of the hook.
- Slice order: S1 ships `describe, getState, newGame, step, click*, key, pause, cmd.moveTo/attack, cheat.spawnMonster, setSeed, perf`; `cmd.use`, other cheats arrive with S2; `save.*`, `audio.getState`, `cheat.throwInTick` with S3.
