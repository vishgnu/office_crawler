# ADR-0002 Architecture

Date: 2026-10-13. Status: proposed. Depends on ADR-0001. Test surface names follow `../30-spec/10-tech-and-testability.md` ("Test contract"); where this ADR renames or fixes an open point, it says so in section 11.

## Context

Requirements that drive the structure: fixed-timestep simulation separate from rendering (R-113), same seed + same inputs = same state, identical across Chromium, Firefox, WebKit and Node (R-120, AC-NFR-Q01-2), a Node-only unit surface with no `window`/`document`/`AudioContext` (AC-R-113-2), 50 active monsters at 60 fps (NFR-P01), floor generation under 500 ms (NFR-P03), and a rendering style that is **not yet chosen** (art variants A painterly, B pixel, C vector). The game is large, so the module boundaries must let several implementer runs work in parallel without touching each other's files.

## Decision overview

Three layers with a one-way dependency rule:

```
 shell (browser only)         render/ input/ audio/ ui/ save/ testhook/ main.js
        |  reads state, sends input commands, subscribes to events
        v
 core (pure, deterministic)   src/core/**   no DOM, no Date, no Math.random, no Web APIs
        ^
 content (data only)          src/core/content/**   registries + config + strings
```

- `core` imports only `core` and `content`. A unit test (`test/layering.test.js`) greps import specifiers and forbidden globals in `src/core/**` and fails the build on violation (AC-R-113-2 in spirit).
- `render`, `input`, `audio`, `ui`, `save` may import `core`; `core` never imports them.
- Rendering style lives only under `src/render/styles/<id>/` and is reached through one interface (section 7).

## 1. Game state, step and the loop

- **State** is one plain JSON-serialisable object (no functions, classes, Maps, Sets, typed arrays, cycles, `undefined`, `NaN`): AC-R-121-2. Shape = the spec snapshot (`tick, seed, scene, paused, depth, player, monsters, projectiles, groundItems, containers, floor, inventory, equipment, belt, stash, vendors, events, floaters, ui, options, config` ...). `getState()` is `structuredClone` of it (plus conversions listed below); it is the same object the renderer reads, so there is no second model.
- **Derived caches** (walkability grid as `Uint8Array`, spatial hash, path scratch buffers) live in a non-serialised context object `ctx` kept in a `WeakMap<state, ctx>` inside `core/ctx.js`. They are rebuilt from state on demand (`ensureCtx(state)`), so `structuredClone`d or loaded states work.
- `floor.tiles` is a plain `number[]` of length `w*h` (row-major) so it round-trips JSON.
- **API (all in `src/core/index.js`):**
  - `newGame(seed, opts) -> state` (`opts.class`, default the one MVP class).
  - `applyInput(state, input) -> void`: applies one input command immediately (sets intent: target, path, panel toggle, ...). Does not advance time. Appends to `state.events` (for example `noPath`).
  - `step(state, inputs = []) -> state`: clears `state.events`, applies `inputs` in order, then runs exactly one simulation tick, `tick += 1`. **It mutates `state` in place and returns the same reference** (a deep copy per tick for 50 monsters plus a 3,600-cell floor would waste the 4 ms per tick budget, AC-NFR-P01-2). Tests that need the pre-step state call `cloneState(state)` first. The spec text "returning a new state" is amended accordingly (section 11).
  - `snapshot(state) -> object`, `hashState(state) -> string`, `cloneState(state)`.
  - `generateFloor(seed, depth)`, `findPath(grid, from, to, opts)`, `rollItem(rng, ctx)`, `createRng(seed)`, registries `content.*`, `config`.
- **When paused** (`state.paused`), `step` does nothing but process UI-only inputs (open panels, move items, unpause); `tick` and all entity state stay untouched (AC-NFR-A02-1, AC-NFR-A02-3, AC-R-020-3).
- **Fixed timestep:** `config.tickHz = 60`. The loop accumulator is a pure function in `src/core/clock.js`:
  `advance(acc, dtMs, tickHz) -> { acc, ticks }` using integer-friendly arithmetic: `acc += dtMs * tickHz; ticks = floor(acc / 1000); acc -= ticks * 1000`. Any chunking of the same total elapsed time yields the same tick count (AC-R-113-1). The browser loop caps catch-up at `config.maxCatchupTicks` (5) per frame and drops the rest (tab was in background), which lives in `src/main.js`, not in the pure function.
- **Interpolated rendering:** each moving entity stores `prev` (value at the start of the tick) and current position. The renderer draws at `alpha = acc / (1000 / tickHz)`. Render never writes to state.
- **Order of systems in one tick** (fixed, listed in `core/step.js`; entities within a system iterate in array order which is creation order, i.e. id order, AC-R-020-2):
  1. `clearEvents`, apply inputs
  2. `playerIntent` (resolve click target to move/attack/pickup/interact; hold repeat)
  3. `monsterAI` (notice, chase, attack, flee; pack wake)
  4. `movement` (player, then monsters; tile-to-tile)
  5. `combat` (swing timers, hit resolution)
  6. `projectiles`
  7. `status` (stagger, regen, cooldowns, buffs)
  8. `loot` (drops, pickups, gold)
  9. `cleanup` (remove dead after `config.deathTicks`, floater timers)
  10. `scene` (death, victory, floor change, autosave request flag)
- **Errors:** the browser loop wraps `step` in try/catch. On a throw it sets `scene = 'error'`, keeps the last good serialised save, and shows the error screen with an "export save" action (AC-NFR-Q02-1). `cheat.throwInTick()` sets a flag that makes the next tick throw.

## 2. Determinism rules (hard rules, enforced by tests)

1. All randomness comes from `createRng`. State holds named streams, each a `{s}` integer (mulberry32 state): `rng.world`, `rng.combat`, `rng.loot`, `rng.ai`. Separate streams keep floor generation, loot and combat from perturbing each other. Per-floor generation uses a derived seed `floorSeed = hash32(seed, depth)`, so a floor regenerates identically on re-entry (R-044). `createRng` gains `getState()`/`setState()` (the skeleton closure has none); the 5-value golden test (AC-R-120-4) fixes the mulberry32 sequence.
2. No `Date`, `performance`, `Math.random`, `setTimeout` or `requestAnimationFrame` inside `core`.
3. **No transcendental math in core**: no `Math.sin/cos/atan2/pow/exp/log/hypot` (results may differ in the last bit between engines). Only `+ - * /`, `Math.sqrt`, `floor/ceil/round/min/max/abs`. Directions use an 8-way integer table; projectile direction is normalised with `sqrt`. `test/layering.test.js` greps for the forbidden calls.
4. Movement and timing are **integer ticks** wherever possible. Actors are tile-based: an actor stands on an integer `tile` and moves to a neighbour over `config.moveTicksPerTile` ticks (diagonals `round(moveTicksPerTile * 1.4142)`), with `moveT` as an integer counter. `pos` (float) is derived for rendering/spec (`pos = tile + (next - tile) * moveT / total`). Projectiles are the only continuous bodies.
5. State hash: `hashState(state)` = FNV-1a 32-bit (two lanes for 64 bits) over a canonical JSON string with sorted keys, excluding `ui.tooltip`, `ui.hud` layout caches and `perf`. Golden hash in `test/fixtures/run-a.hash`.
6. Iteration order is always array order or sorted by id; never `Object.keys` order of dynamically-keyed maps without sorting.

## 3. Entity model

Plain objects in typed arrays-of-objects on state (`monsters`, `projectiles`, `groundItems`, `containers`, `npcs`, `props`), ids from `state.nextId` (`"m12"`). No ECS framework, no classes. "Systems" are functions `(state, ctx) => void` in `src/core/systems/*.js`. A monster is data (`type, tile, hp, ai, target, cooldowns, packId, mods[]`); its behaviour is looked up from `content.monsters[type]` (stats, behaviour id, attack kind). Adding a monster type is a data change plus (optionally) a behaviour in `systems/ai/behaviours.js`.

## 4. Isometric projection

2:1 diamond tiles, tile footprint `64 x 32` logical px (`config.render.tileW = 64`, `tileH = 32`). In `src/render/iso.js` (pure, no DOM, Node-testable, used by `input`, `render`, tests):

```
tileToScreen(tx, ty, cam) = { x: (tx - ty) * tileW/2 - cam.x, y: (tx + ty) * tileH/2 - cam.y }   // tile centre; ty,tx may be fractional
screenToTile(sx, sy, cam) : u = (sx + cam.x) / (tileW/2), v = (sy + cam.y) / (tileH/2);
                            tx = (u + v) / 2, ty = (v - u) / 2     // fractional; floor() for the tile
```

Camera `cam` follows the interpolated player position and clamps at floor bounds. `render/view.js` owns the logical-to-device scale: the canvas fills the viewport (`canvas.width = innerWidth * dpr`), logical height targets 720 with an integer-or-half-step scale chosen from viewport size (1280x720 to 3840x2160, AC-R-112-3). `screenToTile(tileToScreen(t)) == t` is a unit test (AC-R-112-3 round trip). Picking priority (monster sprite bounds, then ground item label, then NPC/prop, then tile) is in `input/pick.js`, using sprite bounds from the active style's atlas so a click on a tall sprite works.

**Depth sorting:** painter's order by `(tx + ty)` of the entity's foot tile, ties by `ty`, then id. Floor tiles are drawn first from a cached chunk layer (16x16-tile offscreen chunks, built lazily, invalidated on floor change); walls, props, entities and projectiles go into one sorted draw list per frame, culled to the viewport. Occlusion fade: walls within 2 tiles in front of the player are drawn at reduced alpha (render-only).

## 5. Pathfinding, collisions, line of sight

- **A\*** on the tile grid in `core/path.js`: 8-neighbour, no corner cutting (both orthogonal neighbours must be walkable), integer costs 10/14, octile heuristic, binary min-heap, deterministic tie-break `(f, h, index)`. Signature `findPath(grid, from, to, {maxNodes, blocked}) -> tile[] | null`. Unreachable goals return `null` after exhausting the open set (under 50 ms on 100x100, AC-R-005-9); monsters pass `maxNodes: config.ai.maxPathNodes` and re-path at most every `config.ai.repathTicks` ticks.
- **Occupancy:** one tile holds at most one actor; a `Int16Array` occupancy map in `ctx` is updated on tile entry/exit. Props and walls are static blockers in the same grid.
- **Spatial hash:** uniform grid, bucket = 8x8 tiles, rebuilt at the start of each tick in id order (cheap at a few hundred entities). Used for notice radius, AoE, projectile hit tests, click picking and "nearest monster". `core/spatial.js`.
- **Line of sight:** integer Bresenham between tile centres (`core/los.js`) used by AI notice and ranged attacks; the same function marks tiles `explored` (bit array stored as a string of `0/1` per row to stay JSON-friendly) within `config.sightRadius`.
- **Click on an unreachable tile (QF-01-2, decision):** walk to the nearest reachable tile within radius `config.clickSnapRadius` (3); if none, stay and emit `noPath`. Switchable by config.

## 6. Procedural floor generation (`core/gen/`)

`generateFloor(seed, depth) -> floor` (pure, no render knowledge):

1. Grid `config.floorSize` (default 56x56). Theme from depth (`open-plan` floors 1-4, `basement` 5-8; `lobby` is the hand-authored town, `core/town.js`).
2. **Rooms + corridors:** place N non-overlapping rectangular rooms by rejection sampling (attempt cap), assign a room `kind` from the theme's kind table (cubicle-maze, meeting-room, copy-room, storage, server-room, break-room), join rooms in order of a minimum spanning tree over centre distances plus a few extra edges for loops, carve L-shaped corridors (width 1-2), add doors where corridors cross walls.
3. **Validation:** flood fill from entry; every room, stair and prop that must be reachable is checked; on failure retry with the next sub-seed up to `config.maxGenAttempts`, then fall back to a known-good fixed layout (never throws).
4. **Stairs:** entry in the room farthest from exit by path length (BFS), exit likewise; the safe radius `config.safeRadius` around entry has no monsters.
5. **Props (office-themed decoration):** per room kind from `content.props` (desks, cubicle walls, copiers, plants, filing cabinets, vending machines, server racks, boxes). Each prop has `blocks: bool`; blocking props never disconnect the floor (validated again after placement).
6. **Population:** a difficulty budget by depth fills monster packs and singles from `content.monsters` filtered by theme and depth, champions per `config.championChance`, containers (S2), all via `rng.world`.
7. Output is plain data: `{depth, seed, theme, w, h, tiles[], rooms[{kind,x,y,w,h}], entry, exit, props[], spawns[], explored[]}`. Tile codes (`0 void, 1 floor, 2 wall, 3 door, 4 stairs-up, 5 stairs-down`) are constants in `core/tiles.js`. The renderer derives wall orientation from neighbours; the generator never decides pixels.

## 7. Style isolation (art direction not yet chosen)

Everything that decides how the game *looks* is behind one interface, so swapping variant A/B/C is a build/config change plus one folder:

```js
// src/render/style.js  (JSDoc contract)
// Style = {
//   id: 'painterly' | 'pixel' | 'vector',
//   logicalTile: {w:64, h:32},          // must stay 64x32 (geometry is not style)
//   palette: {...},                      // incl. colour-blind-safe rarity encodings (NFR-A03)
//   build(progress): Promise<Atlas>      // draws every sprite into offscreen canvases, yielding between batches
// }
// Atlas.get(key) -> { img, sx, sy, sw, sh, ox, oy }   // ox,oy = anchor offset to the foot point
// Atlas.frames(key) -> number
```

Sprite keys are **semantic**, never file names or style details: `tile:<theme>:<kind>:<variant>`, `wall:<theme>:<mask>`, `prop:<id>`, `mon:<type>:<anim>:<dir>:<frame>`, `plr:<class>:<anim>:<dir>:<frame>` (anims: `idle, walk, attack, hit, death`; 8 directions, 5 stored + mirrored), `proj:<id>:<frame>`, `item:<base>` (inventory icon), `fx:<id>:<frame>`, `ui:<id>`, `npc:<id>`. The renderer (`render/world.js`, `render/hud.js`, `render/fx.js`) knows keys and geometry only. Shared, style-neutral helpers live in `render/draw/` (seeded noise, polygon/outline helpers, `rig.js` = skeleton poses per animation frame so body animation is written once and each style only decides how to paint limbs and torso). Styles live in `render/styles/{painterly,pixel,vector}/`. Selection: `config.render.style`, overridable with `?style=` in test mode (art review harness), and `build.mjs --style=` to embed only one.

Nothing in `core` knows the style. The only coupling is content ids (monster types, item bases, prop ids): a style must provide a sprite for every id in the registries. Canvas is not available in Node (no dependency is added for it), so completeness is checked in E2E (`e2e/atlas.mjs`): every registry id resolves to an atlas entry in the chosen style. A Node test checks that the registry ids and the sprite-key builders (`render/keys.js`, pure) agree.

## 8. Input

`src/input/` converts DOM events to **input commands** (plain objects) and never touches state directly:
`{t:'mouse', tile, screen, button, down}`, `{t:'key', code, phase:'down'|'up'|'press'}`, `{t:'uiClick', region, button}`, `{t:'uiDrag', ...}`, `{t:'pause'}`. HUD hit-regions come from `ui/layout.js` (pure function `layout(state, viewport) -> regions[]`), so UI picking is unit-testable. Key bindings: `options.keys` (action -> `KeyboardEvent.code`), defaults in `config.defaultKeys`; `input/keymap.js` maps code -> action; core receives **actions**, not raw codes, for game keys (rebinding is invisible to core, AC-NFR-A01). Mouse buttons are fixed (NFR-A01).

Held-button repeat lives in core (`state.input.mouse = {down, button, tile}`) so it is deterministic and works under `step(n)` (AC-R-005-6).

## 9. Event bus for audio and FX hooks

Core emits **data**, not callbacks: `state.events` (this tick's list: `{type:'hit', source, target, value}`, `kill`, `miss`, `levelup`, `pickup`, `noMana`, `noPath`, `inventoryFull`, `stairs`, `bossPhase`, ...). A rolling `state.eventLog` (last 256 events, non-contract, for bots and debugging) is kept too. After every tick the shell passes `state.events` to `src/bus.js`, a ~30-line synchronous pub/sub (`on(type, fn)`, `emit`). Subscribers: audio cues (`audio/cues.js` maps event type -> SFX id and volume), render FX (particles, hit flashes, screen shake request), UI notices. Because core never calls subscribers, it stays deterministic and testable; audio/FX cannot break the simulation. In `step(n)` batches the shell dispatches events for every tick (audio may be muted in test mode).

Floaters (damage numbers), `ui.notice` and `ui.fx.shake` are **state** because the spec snapshots them (AC-R-025-1, AC-R-025-3); particles and camera easing are render-only.

## 10. Source layout

See `../50-plan.md` section "Source tree". Summary: `src/core/` (state, systems, gen, path, content), `src/render/` (iso, view, world, hud, fx, styles), `src/input/`, `src/audio/` (pure sample synthesis + WebAudio engine), `src/ui/` (layout, panels, DOM screens, string table access), `src/save/`, `src/testhook/`, `src/main.js`, `test/`, `e2e/`, `bot/`.

## 11. Decisions on open points from the spec (spec files to be updated mechanically)

| Point | Decision |
|---|---|
| `step(state, inputs)` "returns a new state" | Mutates in place, returns the same reference. `cloneState` for copies. Equality assertions (AC-R-113-1 "deep-equal") are unaffected. |
| QF-10-5 test flag | `?test=1` confirmed (ADR-0003). |
| QF-02-1 hit chance | `hitChance = clamp(2 * A/(A+D) * La/(La+Ld), config.hitChanceMin, config.hitChanceMax)`; `A` = attack rating (base + agility x `config.ar.perAgility` + gear), `D` = defence, `L` = level; defaults 0.05..0.95. Monotonic as required by AC-R-021-3. |
| QF-01-2 click on wall | nearest reachable tile within 3, else `noPath`. |
| QF-01-4 skill keys vs potion keys | Potions `1..4`; skills on `Q W E R`. (Proposal accepted for architecture; spec/UI to confirm.) |
| QF-01-6 rebind collision | Reject with `ui.notice` (spec proposal). |
| QF-04-5 boss depth | `config.bossDepth = 8`, boss arena is floor 8's exit room. |
| QF-04-6 ground items on re-entry | Floor regenerates from seed, cleared monsters stay cleared (stored in `state.floors[depth].cleared`), ground items do not persist. |
| QF-01-1 town stairs target | `config.townStairsTarget = 'deepest'`. |
| QF-10-1 perf reference | Accepted as proposed; E2E perf checks are advisory on non-reference runners. |

## Consequences

- Core runs at thousands of ticks per second in Node, so the bot can play whole runs headlessly (ADR-0003).
- The determinism rules cost some convenience (no trig in core, tile-based movement); they buy cross-engine hash equality, which is a stated acceptance criterion.
- UI drawn on canvas means we write a small hit-region system and tooltips ourselves; in return drag/drop of grid items and the pause-with-panels case are simple state transformations that are testable in Node.
- Three styles can coexist in the repo during art review without touching core.
- Risk: sprite generation time on load (ADR-0004 gives a budget and a progress screen).
