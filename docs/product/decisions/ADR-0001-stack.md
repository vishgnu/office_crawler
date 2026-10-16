# ADR-0001 Stack

Date: 2026-10-13. Status: proposed (architect; gate authority delegated to the customer proxy, see `../proxy-log.md`).
Inputs: `../00-brief.md`, `../20-requirements.md` (R-110..R-113), `../40-nfr.md`, `../circles/circle-01.md` (Q2, Q3, Q5 PROXY answers), `../30-spec/10-tech-and-testability.md`, stack pack `../agent_harness/stack-packs/static-web/`.

## Context

A single-player, real-time isometric action-RPG for desktop browsers. No server, no accounts, no network at play time (NFR-B03, NFR-O02). All art and sound are generated in code (NFR-L01, Q2/Q5 PROXY answers). One self-contained build that also runs from `file://` (R-111, AC-R-111-1). Simulation must be deterministic and runnable in Node (R-113, R-120, R-122). Every dependency must be MIT/BSD/Apache-2.0/ISC (NFR-L04).

## Options considered

| # | Option | For | Against |
|---|---|---|---|
| 1 | **`static-web` pack, plain JS ES modules, Canvas 2D, esbuild to one `dist/index.html`** | Pack already provides build, seeded RNG, test hook, preview workflow. Node-testable pure modules. One dev dependency. Canvas 2D is enough for an isometric 2D game at 50 monsters. | No engine conveniences; we write loop, sprites, UI ourselves (accepted, cost is planned). |
| 2 | Game engine (Phaser, PixiJS, Godot web export) | Scene graph, sprite batching, asset pipeline. | Runtime licence/size review (Godot export is large and needs wasm/files, breaks `file://` single file); engines assume loaded art assets, our art is generated; couples simulation to the engine loop, hurting Node tests and determinism. Rejected. |
| 3 | WebGL / WebGPU renderer | Faster at very large sprite counts. | Context-loss handling, shader work, headless-test pain (software GL in CI), WebKit differences. Not needed for the stated load (NFR-P01: 50 monsters). Rejected for MVP; the render module boundary (ADR-0002) keeps a later swap possible. |
| 4 | UI framework (React, Svelte) for HUD/panels | Quick declarative UI. | Adds runtime dependency and build complexity; inventory drag/drop with grid items is simpler against our own hit-region model on the canvas; pack says "no framework unless an ADR says otherwise". Rejected. |
| 5 | TypeScript | Type safety. | Needs a typecheck step the pack does not have; JSDoc `@typedef` on state shapes gives most of the value. Deferred; can be added later because esbuild strips TS. |

## Decision

1. **Stack pack: `static-web`** (`../agent_harness/stack-packs/static-web/`, commands `npm ci`, `npm test`, `npm run build`, `npm run e2e`). No adapter needed beyond the extensions below.
2. **Language:** plain modern JavaScript, ES modules, target `es2022`. Types are documented with JSDoc typedefs in `src/core/types.js` (no build step).
3. **Rendering:** one HTML5 `<canvas>` using the 2D context for the world, HUD and in-game panels. Menus, title, game over, error and options screens are DOM overlays (real `<button>`s with roles and text from the string table) so tests and screen readers can find them (AC-R-001-2, AC-R-023-2, AC-NFR-Q02-1).
4. **Build:** esbuild (already in the skeleton, `0.25.10`, MIT) bundles `src/main.js` and CSS into **one** `dist/index.html`, IIFE, minified. `build.mjs` additionally: injects a CSP meta tag (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src blob:; connect-src 'none'`, AC-NFR-S01-2), embeds the licence list (`THIRD-PARTY-LICENSES`) in the HTML as a `<script type="text/plain" id="licenses">` block, because the build must stay one file (AC-NFR-L04-1 reads it from there and from `package-lock.json`).
5. **No frameworks, no runtime dependencies.** Runtime dependency count is zero; `THIRD-PARTY-LICENSES` states that.
6. **Dev dependencies and licences (checked 2026-10-13 from the lockfile in the skeleton; re-verify at install):**
   - `esbuild` 0.25.10 - MIT (https://github.com/evanw/esbuild/blob/main/LICENSE.md, 2026-10-13).
   - `playwright` (e2e only, not in the skeleton `package.json`; the smoke test imports it) - Apache-2.0 (https://github.com/microsoft/playwright/blob/main/LICENSE, 2026-10-13). Pin an exact version when added; allowed by NFR-L04.
   - Unit tests use the built-in `node:test` and `node:assert` runner (no dependency).
7. **Test layers:** Unit in `test/*.test.js` (Node, no DOM); E2E in `e2e/*.mjs` (Playwright, Chromium + Firefox + WebKit, against `dist/index.html`, both over `http` and `file://`). Fixtures in `test/fixtures/`.
8. **Style swap:** the rendering style is selected behind a `Style` interface (ADR-0002 section 7, ADR-0004). The art-direction pick (variants A painterly, B pixel, C vector) is a configuration choice, not a stack decision. All three can be built; the build embeds only the chosen style once picked (`--style=` flag in `build.mjs`, default until the pick: the vector style, the cheapest to produce procedurally).
9. **Hosting/preview:** static hosting only (pack preview workflow). No public release is implied (Q6 PROXY answer).

## Consequences

- Zero runtime dependency risk; licence list is trivial.
- We own the game loop, input, audio, UI and sprite generation. This is the main cost and is planned as explicit work packages (`../50-plan.md`).
- The single-file constraint means no `fetch` of neighbouring files and no worker script files; any Web Worker must be created from a Blob URL (CSP then needs `worker-src blob:`; decision deferred, not planned for MVP).
- Cheats and the test hook ship in the production bundle and are gated at runtime by `?test=1` only (ADR-0003). This is acceptable for a single-player offline game with no server; it is stated here because NFR-S01 says "off in normal play" and the spec tests exactly that.
- Size budget: the bundle without art files should be well under 1 MB (ceiling 10 MB, AC-R-111-2). Generated art adds load-time CPU, not bytes (ADR-0004 gives the time budget).
- Playwright's browser downloads are blocked or limited in some environments; E2E stays runnable with whatever engines are installed, the CI reference runner installs all three (spec QF-10-4 stays open).
