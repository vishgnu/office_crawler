# ADR-0004 Assets: everything generated in code

Date: 2026-10-13. Status: proposed. Implements NFR-L01, AC-NFR-L01-2/-3, R-111, R-080/R-081 and the Q2/Q5 PROXY answers. Interacts with the open art-direction pick (variants A painterly, B pixel, C vector).

## Context

The game must ship as one HTML file with no image, audio or font files and no third-party assets (NFR-L01; AC-R-111-1 opens it from `file://`; AC-NFR-L01-3 checks that no asset requests occur). Art is produced by agents as code. The visual style is still to be chosen, so the generation pipeline must not bake one style in.

## Decision

### Graphics
1. **No image files, no font files, no `<img>`.** Every sprite, tile, icon and UI element is drawn at load into offscreen canvases (`OffscreenCanvas` where available, else `document.createElement('canvas')`; both feature-detected) by the active **Style** (ADR-0002 section 7).
2. **Atlas:** the style's `build(progress)` draws sprites into pages of at most 2048x2048 px, keeps a map `key -> {page, sx, sy, sw, sh, ox, oy}` and returns the `Atlas`. The renderer only calls `atlas.get(key)`. Keys are semantic (`mon:temp-worker:walk:SE:3`), defined in `render/keys.js`.
3. **Animation economy:** characters are drawn from a shared skeleton rig (`render/draw/rig.js`) per animation frame; 5 stored directions, 3 mirrored; frame counts: idle 4, walk 8, attack 6, hit 2, death 6. Tiles have 2-4 variants chosen by a position hash (render-only). Walls are drawn per neighbour mask.
4. **Seeded generation, separate stream:** art uses its own RNG (`createRng(artSeed)`, `artSeed` constant per style), not the game RNG, and is never part of the state hash. Same style + same engine = same pixels (screenshots comparable within an engine).
5. **Load budget:** atlas build target at most 1.5 s on the CI reference runner and at most 3 s on a mid-range laptop (NFR-P02 allows 5 s total load). The build yields to the event loop between batches (`await nextFrame()`) and drives a progress bar on the title screen. A `budget` test in E2E records the atlas build time (`perf().atlasMs`) and fails above the ceiling. If the budget is exceeded, the fallback is lazy generation of far-away animations (death, hit) on first use.
6. **Memory:** pages stay alive for the session (about 4 pages x 16 MB); no per-frame canvas allocation; floors' ground layer chunks are pooled and dropped on floor change (NFR-P05).
7. **Accessibility in art:** rarity is encoded by colour **and** border pattern/label prefix (NFR-A03); health vs mana by shape and fill. The palette of each style is checked against deuteranopia/protanopia/tritanopia simulations in `test/palette.test.js` (pure colour math, no canvas).
8. **UI text** is drawn with the system font stack through canvas `fillText` and DOM text; no webfont, no network. Minimum 14 px at 1080p, size option (NFR-A04). All strings come from `core/content/strings.js` (NFR-A06).
9. **Review loop:** `?test=1&style=<id>` plus `e2e/art-sheet.mjs` renders a contact sheet (all sprites by key prefix) and a set of in-game screenshots per style for the independent visual reviewer. The art-direction variants (A/B/C) are implemented as `render/styles/<id>/` against this contract; the selected one becomes the default and the others are dropped from the build (`build.mjs --style=`).

### Audio
1. **WebAudio synthesis, no files.** `src/audio/synth.js` is **pure**: `renderSfx(id, sampleRate) -> Float32Array` and `renderAmbient(zone, seed, seconds, sampleRate) -> Float32Array` using oscillators, filtered noise and envelopes written as plain math over arrays, with their own seeded RNG. They run in Node (tests: non-silent, no NaN, peak at most 1.0, expected duration, deterministic per id/seed, spectral sanity checks by simple band energy).
2. **Engine:** `src/audio/engine.js` creates the `AudioContext` lazily on the first user gesture (autoplay policy), converts synthesised arrays to `AudioBuffer`s once at load (pre-rendered SFX bank; ambient loops rendered for 20-30 s per zone, looped, rendered in chunks to avoid long frames), and plays cues through gain buses `master -> {sfx, ambient}`. Cue variation (pitch +-5%, gain +-10%) uses the render-side RNG.
3. **Cues from events:** `audio/cues.js` maps bus events (ADR-0002 section 9) to SFX ids (attack swing, hit, miss, monster death, pickup, gold, UI click, level up, potion, stairs, boss phase); town and floor ambience by zone; priority and a per-id rate limit (e.g. at most 4 voices of the same id within 80 ms) to protect against 50 monsters.
4. **Controls:** master, effects, ambient sliders and mute in options; persisted with options (R-082). Pause suspends the context (AC-NFR-A02-2). `audio.getState()` reads real gain values (test hook).
5. **Music** beyond generative ambience stays "could" (Q5).

### Licences and records
`ASSET-LICENCES.md` states: no third-party assets; everything generated; list of generators. `THIRD-PARTY-LICENSES` lists build tools only (ADR-0001). The denylist scan (AC-NFR-L01-1, AC-NFR-L05-1) runs over `content.strings`, registry names, sprite keys and source file names.

## Options considered

| Option | Verdict |
|---|---|
| Pre-drawn PNG/SVG files embedded as data URIs | Rejected: still third-party-style assets to author and licence, no cheap style swap, inflates the bundle. |
| Runtime SVG for sprites | Rejected as primary: rasterisation cost and cross-engine differences; allowed inside a style as a drawing technique if it rasterises into the atlas once. |
| Tone.js or other audio library | Rejected: runtime dependency for something ~500 lines of plain math cover; pure synthesis is Node-testable. |
| Sample files / CC0 packs | Rejected for MVP (NFR-L01 default is code-generated only). |

## Consequences

- Style swap is local to `render/styles/<id>/`; core, input and audio are unaffected.
- First load does CPU work (atlas + audio bank). It is bounded and visible (progress bar). It is the main schedule risk for the "5 s load" goal.
- Quality of generated art/sound is the biggest uncertainty; the plan (`../50-plan.md`) reserves a work package per slice for art polish after the style pick, and a separate visual-review gate.
- Sample-accurate audio assertions are not attempted in E2E (headless audio devices differ); gain nodes and the cue log are asserted instead.
