# S1 code review (S1-1..S1-5)

Reviewer: `reviewer` agent. Scope: `src`, `test`, `e2e`, `build.mjs`, `package.json` (diff 476a4f2..HEAD c4bbdd0).
Read-only checks run: `npm test` 96/96 pass, 0 skipped; `npm run e2e` all scripts pass (Chromium; Firefox and WebKit not installed here, SKIP is printed, not failed).

**Verdict: changes needed** (1 blocking, 6 should, 6 nit)

## Passed checks
- Determinism: no `Math.random`, `Date.now` or clocks in `src/core` or `src/rng.js` (enforced by `test/layering.test.js`, which also bans transcendental maths and out-of-core imports). The only `Date.now()` is the title seed in `src/main.js:15`. Render-side fx uses its own seeded rng (`src/render/fx.js:11`), no feedback into the core.
- Layering: core has no DOM; replay hash is equal in Node and Chromium (e2e/replay).
- `?test=1` gating: `window.__app` is only installed under the flag (`src/main.js:65`). `spawnMonster` is reachable only via the hook's `cheat`. e2e/smoke asserts `__app` is undefined without the flag.
- CSP meta is valid for a single-file build, with no console errors under it. `default-src 'none'` blocks network, and e2e checks that every request is `file:` or `data:`. Opens from `file://` (all e2e use it).
- IP: denylist tests cover strings, registry names and file names; they pass.
- Input during death and pause: the `menu()` guard blocks canvas pointer events, the overlay covers the canvas, and Escape is ignored when dead (covered in e2e/combat). Restart resets the input state (`restartInPlace`).
- Sprite cache growth is bounded: the atlas is fixed, `flash()` is keyed by the atlas, floaters are capped at 24 and particles at 160. `frameMs` is capped at 600.

## Blocking

### B1. Releasing the mouse while paused leaves the button "held" in the core; the hero then follows the cursor with no button down
- `src/game.js:97` (`game.pointer` returns early when `menu()`), `src/core/systems/intent.js:83` (`applyInput` returns `paused` before handling `mouse up`), `src/core/systems/intent.js:86-91`.
- Reproduced in Chromium with `?test=1&realtime=1`: hold the left button on the floor, press Esc, release the button, press Esc to resume, then move the mouse. `state.input.mouse.down` stays `true`, and the hero walks to wherever the cursor goes (tile 46,17 -> 46,22 with the button up). The same happens if the player dies while holding: that case is reset by restart, but the pause case is not.
- Why: the `pointerup` is swallowed by the menu guard and by the paused guard, so the "button up" never reaches the core. This breaks AC-R-005 (hold-to-walk follows only while the button is down) and the pause expectation of AC-R-076-7/AC-NFR-A02-1. No existing test covers "release during pause".
- Fix: let `up` and `cancel` always through. In `game.pointer`, handle `kind === "up"` before the menu guard (`if (game.core) game.input({t:"mouse",phase:"up"})`). In `applyInput`, accept `mouse up` (and `key`/`pause`) before the `paused` check, or clear `mouse.down` whenever `paused` becomes true. Add a core test (hold, pause, up, unpause, move: no new path) and an e2e check using the real mouse.

## Should

### S1. Tab is blocked everywhere, so keyboard users cannot move focus between menu buttons
- `src/main.js:48`. `preventDefault()` on every Tab (in anticipation of the S2 skill selector) makes the Resume/Quit/Restart buttons unreachable by keyboard except for the one auto-focused button. Fix: only prevent Tab when `game.menu() === null` (while playing); leave it alone while a screen is shown.

### S2. Escape is handled globally but the focused button can also swallow state
- `src/main.js:49-51` plus `src/ui/screens.js:51`. A pause-screen button gets focus; a key press repeated or Space/Enter on "Quit to title" works, but there is no test that Escape on a focused button resumes only once. Low risk; add one e2e check or note as accepted. (Merge into S1 if you prefer a single fix.)

### S3. Wall-clock thresholds remain in unit tests, against learning L-06 that the implementer already applied once
- `test/gen.test.js:47` (500 ms per floor), `test/headless.test.js:18` (10 s for 10,000 ticks), `test/path.test.js:54` (1000 ms; the deterministic node-limit assertion above it is the real check, the timing line is redundant). `e2e/render.mjs:50` also asserts `atlasMs < 5000`. The specs state these as ACs (AC-R-042-4, AC-R-122-2), so keep the numbers, but they flake under parallel load on slow CI runners. Fix: make them generous sanity bounds with a comment (as in path.test.js), or move them to a separate non-gating perf script; drop the redundant timing in `path.test.js`.

### S4. Per-frame allocation in the render loop
- `src/render/world.js:90` (`items` array and one object per tile/prop/actor each frame), `:98` (a corner array and `screenToWorld` objects), `:114-120` (closures plus `place()` returning a new object per actor), `:144` (`c.props.some(...)` runs up to three times per frame over all props), `:146` (`items.find`), `src/render/fx.js:51-53` (three `filter` calls produce new arrays each frame), `src/game.js:157` (a radial gradient created each frame while the hurt flash is active), `src/render/world.js:167` (a glow gradient created every frame). Not blocking at the measured sizes, but it adds GC pressure on low-end laptops and the plan's NFR-P01 re-run in S3 will see it. Fix: pre-compute a blocked-tile set per floor in `prepare()`; reuse an `items` array (`length = 0`); filter in place; cache the glow gradient/canvas like the vignette.

### S5. Atlas scale is fixed at boot (`src/main.js:24`), so moving the window to a higher-DPI display or zooming gives blurry sprites and a mismatched vignette
- `src/game.js:138-140` updates the canvas size on resize but not the atlas scale. `resize` is also not tied to `devicePixelRatio` changes (a `matchMedia` listener would be needed). Acceptable for S1 if documented; at minimum add a line in the plan's known-limits. No test covers a resize or DPR change after boot (e2e only opens fresh pages at three viewport sizes).

### S6. Held-mouse and resize edge cases have no test
- Missing e2e or unit checks: resize while playing (the camera, the vignette cache and the hud rects stay consistent), pointer cancel, and the B1 case. Add one resize e2e that calls `page.setViewportSize` and asserts `ui.camera.w/h` and that clickScreen still maps to the same tile.

## Nit
- N1. `src/testhook/index.js:85` `void content;` and the unused `content` import: remove.
- N2. `src/index.html:6` CSP lacks `base-uri 'none'` and `form-action 'none'`; `img-src blob:` is unused (sprites are canvases). Tighten to `img-src data:` if nothing needs blob. (`frame-ancestors` is ignored in meta; no action.)
- N3. `src/render/world.js:71` `rs.facing` is never pruned when monsters are removed by cleanup (bounded by the spawn count in S1, but will grow with S2 spawns): delete the entry when a monster id disappears, or key by live ids only.
- N4. `src/main.js:12-15` `?seed=` is honoured outside test mode. Harmless, but confirm that this is intended (it also lets players share seeds); if not, restrict to `testMode`.
- N5. `src/input/pick.js:2` imports from `render/view.js`: input depends on render. Fine today; consider moving the camera maths to `ui/` or `core/iso.js` so layering reads input -> ui -> core.
- N6. `.screen.dead` uses `animation-delay: .5s` with `animation-fill-mode: both` and `pointer-events:auto`. During the 0.5 s delay the overlay is transparent but already swallows clicks and shows nothing; fine, but note the first-run player sees a stalled canvas for half a second.

## Per-AC note
S1-1..S1-5 ACs listed in the plan are covered by unit or e2e tests that assert on state (hash, tick, hp, scene) rather than implementation. No test was deleted, skipped or weakened: the only modified existing code is `pathfind.js` (added `diagCost` param, default unchanged), `rng.js` (refactor with `rngOn`; the old `Date.now()` default was removed, which is an improvement) and `e2e/smoke.mjs` (expanded). Nothing outside S1 scope was found; the HUD and fx are early S1-6 work, which the plan allows to overlap.

## Resolution (implementer, after review)

Verification: `npm test` 99/99 three times in a row, `npm run e2e` all 7 scripts pass (Chromium; Firefox and WebKit SKIP as before), `npm run bench` passes. The new e2e B1 checks were confirmed to fail with the fix reverted.

| Finding | Status | How / to whom |
|---|---|---|
| B1 | Fixed | `game.pointer` sends `up` and `cancel` to the core before the menu guard; `applyInput` handles `mouse up`/`cancel` before the `live` and `paused` checks (also while dead). `pointercancel` now maps to its own `cancel` phase. Tests: `test/movement.test.js` (hold, pause, up, resume, move: no path; cancel while paused or dead; move after up changes nothing) and `e2e/input.mjs` (real mouse: hold, Esc, release, Esc, move; hero stays put). |
| S1 | Fixed | `src/main.js`: Tab is prevented only when `game.menu() === null`. e2e: Tab and Shift+Tab move focus between Resume and Quit. |
| S2 | Fixed (test added) | `e2e/input.mjs`: Escape on a focused Resume button resumes once and does not re-pause; Enter on the focused button resumes once. |
| S3 | Fixed | Wall-clock asserts removed from `test/gen.test.js` (now: 50 floors validate within the attempt budget, no fallback), `test/headless.test.js` (10,000 ticks complete, floor still live), `test/path.test.js` (timing line dropped; the node-limit assertion stays) and `e2e/render.mjs` (atlas must be complete; no time bound). The spec budgets (500 ms, 10 s, 1 s, 5 s) moved to `npm run bench` (`bench/bench.mjs`, not part of `npm test` or `npm run e2e`). |
| S4 | Deferred | To the art-style port of `src/render/**` (per-frame allocation, `items` reuse, blocked-tile set, glow gradient cache). The hurt-flash gradient in `src/game.js:157` goes with it, since it is draw code. |
| S5 | Deferred (partly) | Atlas scale and DPR change handling belong to the render port. Known limit stays: atlas scale is fixed at boot; the S3 NFR-P01 re-run should note it. Resize is now covered by an e2e check (camera/canvas follow the viewport; a click still maps to the same tile at three sizes). |
| S6 | Fixed | Tests for resize, pointercancel and the held mouse (unit and e2e, see above). |
| N1 | Fixed | Unused `content` import and `void content` removed from `src/testhook/index.js`. |
| N2 | Fixed | CSP is now `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'` (`blob:` dropped; e2e shows no console errors). |
| N3 | Deferred | To the render port (`src/render/world.js` `rs.facing` pruning). |
| N4 | Won't fix (documented) | `?seed=` stays honoured in every mode, so players can share runs; comment added in `src/main.js`. |
| N5 | Deferred | To the render port: `src/input/pick.js` imports `render/view.js`. Moving the camera maths to `src/ui/camera.js` requires editing `src/render/{fx,world}.js` imports, which was out of scope. Suggested: create `ui/camera.js`, make `render/view.js` re-export or drop it, point `pick.js`, `game.js` and `test/pick.test.js` at it. |
| N6 | Won't fix (documented by design) | The death overlay deliberately swallows clicks during its 0.5 s fade-in delay (final frame stays visible; no accidental Restart). Comment added in `src/style.css`. |

## Resolution 2 (implementer, style port and S1-6)

The deferred render items are closed with the art-style port of `src/render/**` (2026-10-13).

| Finding | Status | How |
|---|---|---|
| S4 | Fixed | The per-frame path no longer allocates: pooled draw items and actor records (`world.js`), allocation-free projection (`project()` in `ui/camera.js`), figure sprites looked up through a precomputed table instead of template-string keys, `blocked` tiles precomputed per floor (Uint8Array) instead of `props.some`, in-place expiry of floaters and particles (`fx.js`), reused camera-shake object, light selection without closures, HUD layout memoised per size, plates and HUD text fonts cached. The hurt-flash gradient in `game.js` is now one baked vignette canvas per size drawn at an alpha (`fx.drawHurt`). |
| S5 | Fixed | The atlas is rebuilt when the zoom x HUD scale x devicePixelRatio bucket changes (`main.js`, debounced 250 ms, the old atlas stays in use until the new one is ready, HUD layers re-bake on the new atlas id). e2e: resize 1280x720 to 1920x1080 rebuilds with a sharper atlas and the click mapping stays exact; a dpr 2 screen gets a sharper atlas than dpr 1. |
| N3 | Fixed | `pruneFacing()` (world.js) drops facing memory of monsters that no longer exist once the map exceeds the monster count by 16; `game.prev` is pruned the same way. Unit test in `test/render-pure.test.js`. |
| N5 | Fixed | Camera maths moved to `src/ui/camera.js`; `render/view.js` is gone; `input/pick.js` and `test/pick.test.js` import from `ui/`. `test/layering.test.js` now fails if anything under `src/input` or `src/ui` imports from `render/`. |

New findings from the S1-6 bot run are in `S1-bot-report.md` (mutual-pursuit orbit, fixed in `systems/intent.js` with `config.holdRadius`; residual orbit at 3+ tiles is a follow-up).
