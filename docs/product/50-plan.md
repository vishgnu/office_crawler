# 50 Plan

Date: 2026-10-13. Owner: architect. Status: proposed, awaiting plan gate.
Inputs: `00-brief.md`, `20-requirements.md`, `40-nfr.md`, `circles/circle-01.md` (PROXY answers), `proxy-log.md`, `30-spec/` (files 01-05 and 10 existed when this was written; files for character/skills (R-010..R-016), HUD (R-070..R-077), audio (R-080..R-083), save (R-090..R-092), and the Office theme tone were not yet written, so their work packages cite **R-ids** and must be re-mapped to AC ids when those files land).
Decisions: `decisions/ADR-0001-stack.md`, `ADR-0002-architecture.md`, `ADR-0003-test-hook.md`, `ADR-0004-assets.md`.
Stack pack: `static-web` (reasons in ADR-0001).

## How to read this plan

- Slices follow the spec: **S1 playable core**, **S2 loot and progression**, **S3 sound and finale**. Each slice ends in a build that can be opened on a preview and demonstrated.
- A **work package (WP)** is one implementer run: at most about 600 lines of code (tests excluded from that count but mandatory), one branch/PR, merged in the listed order. `Depends` names earlier WPs. Packages marked **parallel-ok** touch disjoint directories.
- ACs are listed by id from `30-spec/`. "Tests" names the files to write; every AC gets a unit test (`test/*.test.js`) or an E2E check (`e2e/*.mjs`) as tagged in the spec.
- Estimates: S = under half a day of agent work, M = about a day, L = more than a day or high uncertainty. Infra changes: only WP S1-1 touches build/CI/preview; migrations: none (no database). Save-format changes in S3 are versioned.
- Art style is undecided. All WPs that draw things use the Style interface (ADR-0002 section 7). Until the pick, the **vector** style is the working default (cheapest to produce procedurally); WPs say where a pixel/painterly style becomes a follow-up.

## Source tree (proposed)

```
office-crawler/
  package.json  build.mjs  README.md  ASSET-LICENCES.md
  src/
    index.html  style.css  main.js            # boot, loop, wiring (browser only)
    bus.js                                    # tiny pub/sub for events -> audio/fx/ui
    rng.js                                    # (from pack; extended with getState/setState) - re-exported by core
    core/                                     # PURE: no DOM, Date, Math.random, trig
      index.js                                # public API: newGame, step, applyInput, snapshot, hashState, cloneState
      config.js                               # every balance constant
      types.js                                # JSDoc typedefs for state/item/monster
      clock.js  hash.js  ctx.js  tiles.js  step.js  state.js  cheats.js
      grid.js                                 # in-bounds, neighbours, index helpers
      path.js  los.js  spatial.js
      gen/        floor.js  rooms.js  corridors.js  props.js  population.js  validate.js
      town.js                                 # hand-authored Lobby layout (S2)
      systems/    intent.js  ai.js  movement.js  combat.js  projectiles.js  status.js  loot.js  cleanup.js  scene.js
                  boss.js (S3)  progression.js (S2)  vendors.js (S2)  stairs.js (S2)
      items/      roll.js  affixes.js  inventory.js  equipment.js  belt.js  derive.js (derived stats)
      content/    monsters.js  themes.js  props.js  items.js  affixes.js  uniques.js  skills.js  npcs.js  strings.js
    render/                                   # browser, read-only on state
      iso.js        # tileToScreen / screenToTile (pure, Node-testable)
      view.js       # canvas sizing, scale, camera
      keys.js       # semantic sprite-key builders (pure)
      style.js      # Style / Atlas JSDoc contract + loader
      world.js      # floor layer chunks, sorted draw list, interpolation
      hud.js  panels.js  fx.js  minimap.js
      draw/         noise.js  shapes.js  rig.js
      styles/       vector/  pixel/  painterly/        # one folder per art variant
    input/          mouse.js  keyboard.js  keymap.js  pick.js
    audio/          synth.js (pure)  sfx.js  ambient.js  engine.js  cues.js          # S3
    ui/             layout.js (pure)  regions.js  screens.js (DOM overlays)  tooltip.js  dragdrop.js  options.js
    save/           format.js (pure)  storage.js  migrate.js                          # S3
    testhook/       index.js  api.js
  test/             *.test.js  fixtures/ (rng-42.json, run-a.json, run-a.hash, grids/)
  e2e/              helpers.mjs  smoke.mjs  hook.mjs  render.mjs  combat.mjs  replay.mjs  engines.mjs
                    loop.mjs (S2)  perf.mjs (S2)  atlas.mjs  art-sheet.mjs  finale.mjs (S3)  offline.mjs (S3)  options.mjs (S3)
  bot/              policy.js  run-headless.mjs  run-browser.mjs  out/ (git-ignored)
  docs/             product/ ...
```

## Slice S1: Playable core

**Demo at the end of S1 (preview):** open the build, click "New game", an isometric office floor appears (open-plan theme), the player walks by clicking, monsters notice and chase, the player fights by clicking them, health and mana gauges update, dying shows a restart control, Esc pauses. `?test=1` exposes the hook and a bot can play it in Node and in the browser.

### S1-1 Foundations: skeleton on preview, build hardening, deterministic basics
- **Goal:** the pack skeleton is deployed to a preview with a health check; the core's non-negotiable infrastructure exists before any game code (rng with state, clock accumulator, state hash, layering guard, CSP, licence block).
- **Depends:** none. **Estimate:** M. **Infra change:** yes (preview workflow, `build.mjs`, CI test step).
- **ACs:** AC-R-113-1, AC-R-120-4, AC-NFR-S01-2, AC-NFR-L04-1, AC-NFR-L01-1 (scan harness with the denylist file; list may be empty, QF-10-2), AC-NFR-L01-2, AC-NFR-L05-1 (harness), AC-R-110-3 (title page skeleton has no plug-in elements); health check = page loads with `?test=1` and `scene === 'title'` (feeds AC-R-110-1).
- **Files:** `build.mjs` (CSP meta, licence block, `--style=` flag), `src/main.js`, `src/index.html`, `src/core/clock.js`, `src/core/hash.js`, `src/rng.js` (add `getState/setState`, keep the mulberry32 sequence), `src/core/config.js` (tickHz and first constants), `src/core/content/strings.js`, `src/core/index.js` (stub `newGame` returning `{scene:'title'}`), `.github/workflows/preview.yml` from the pack, `ASSET-LICENCES.md`.
- **Tests:** `test/rng.test.js` + `test/fixtures/rng-42.json` (golden values recorded once), `test/clock.test.js` (chunkings), `test/hash.test.js` (key order independent), `test/layering.test.js` (no DOM/Date/Math.random/trig in `src/core`, imports only inward), `test/legal.test.js` (denylist scans, licence field check, no non-code files in dist), `test/build.test.js` (CSP tag present, one HTML file), `e2e/smoke.mjs` updated (title scene, no console error).
- **Risk:** low; the preview workflow depends on the pack's `[verify]` hosting claim. Fallback: serve `dist/` statically in CI.

### S1-2 Floor model: tiles, generator, path, line of sight, spatial hash, iso math
- **Goal:** pure, tested geometry: generate reachable office floors, find paths, project tiles to screen.
- **Depends:** S1-1. **Parallel-ok with** S1-4 start (render shell) after the interfaces in `types.js` exist. **Estimate:** L (generator tuning).
- **ACs:** AC-R-042-1..-4, AC-R-042-6 (and AC-R-042-5 E2E later), AC-R-003-1 (theme registry `open-plan`), AC-R-101-1, AC-R-005-8, AC-R-005-9, AC-R-120-3, part of AC-R-112-3 (round trip of `tileToScreen`/`screenToTile`), performance AC-R-042-4 (generation time).
- **Files:** `src/core/tiles.js`, `grid.js`, `gen/{floor,rooms,corridors,props,validate}.js`, `path.js`, `los.js`, `spatial.js`, `content/themes.js` (open-plan), `content/props.js` (office props with `blocks`), `src/render/iso.js`.
- **Tests:** `test/gen.test.js` (reachability by flood fill over 200 seeds, entry/exit distance, determinism, different seeds differ, time budget), `test/path.test.js` (wall-with-gap fixture vs reference BFS, enclosed goal null in under 50 ms on 100x100, corner-cutting rule), `test/los.test.js`, `test/spatial.test.js`, `test/iso.test.js`.
- **Risk:** medium: generator quality ("looks like an office") and the retry/fallback guarantee. Mitigation: validation step plus fixed fallback layout; visual quality is reviewed in S1-4.

### S1-3 Simulation: player, monsters, melee combat, death
- **Goal:** the complete S1 game rules in `core`, playable headlessly: click-to-move, attack, monsters notice/chase/attack, hit resolution, death/restart, regen, pause.
- **Depends:** S1-2. **Estimate:** L.
- **ACs:** AC-R-001-1 (core part), AC-R-002-1, AC-R-005-1, -2, -6, -7, AC-R-020-1..-3, AC-R-021-1..-8, AC-R-023-1, -3 (core), -7, AC-R-030-1, -3 (S1 monster subset: 2 melee types plus 1 ranged **flagged** so projectile code arrives in S2; if the spec's S1 set is smaller, follow the spec), AC-R-032-1..-5, -7, -9, -10, AC-R-034-1, -2, -4, -5, AC-NFR-A02-1 (core), AC-NFR-A02-4, AC-R-113-2, AC-R-120-2, AC-R-122-2 (speed).
- **Files:** `src/core/state.js` (newGame), `step.js`, `ctx.js`, `systems/{intent,ai,movement,combat,status,cleanup,scene}.js`, `content/monsters.js`, `gen/population.js`, `config.js` (combat numbers, `hitChance` in `systems/combat.js`), events (`hit`, `miss`, `kill`, `noPath`), `src/core/index.js` API (`applyInput`, `snapshot`, `cloneState`).
- **Tests:** `test/combat.test.js` (hit rate within 2 pp over 10,000 swings, monotonic hit chance, damage bounds, kill exactly once, dead cannot be targeted), `test/ai.test.js` (notice, chase, pack wake, flee if in S1 set), `test/movement.test.js`, `test/scene.test.js` (death, restart), `test/determinism.test.js` (run-a twice), `test/headless.test.js` (100 steps with no DOM globals; 10,000 idle ticks under 10 s), fixtures `test/fixtures/run-a.json` (recorded by the first bot run), `run-a.hash` (frozen after review).
- **Risk:** medium-high: breadth. Mitigation: keep monster behaviours data-driven; defer extras (champions, knock-back) to S2.

### S1-4 Renderer, input and main loop: **first visibly playable build**
- **Goal:** draw the floor and entities isometrically with the vector style, interpolate at 60 fps, convert mouse and keys to input commands, run the fixed-step loop in the browser.
- **Depends:** S1-3 (S1-2 for iso math). **Estimate:** L.
- **ACs:** AC-R-112-1, -2, -3, AC-R-001-2 (New game control, with S1-5 screens), AC-R-113-3 (frame-rate independence), AC-R-005-1/-2/-6 via real mouse path, AC-R-101-3 (open-plan tileset readable: distinct floor/wall/prop sprites by key), AC-NFR-B02-1.
- **Files:** `src/render/{view,style,keys,world}.js`, `render/draw/{noise,shapes,rig}.js`, `render/styles/vector/{index,tiles,characters,props}.js`, `src/input/{mouse,keyboard,keymap,pick}.js`, `src/main.js` (loop with `clock.advance`, catch-up cap, resize handling, try/catch to `scene: 'error'`), `src/bus.js`.
- **Tests:** `e2e/render.mjs` (canvas 2D context, at least 16 colours, canvas width equals innerWidth at 1280x720, 1920x1080, 3840x2160; five-tile click round trip), `test/keys.test.js` (sprite keys cover registry ids), `test/pick.test.js` (screen-to-target priority, pure), `e2e/atlas.mjs` (every registry id has a sprite in the chosen style), throttled-CPU run for AC-R-113-3 (CDP in Chromium only; other engines skip with a note).
- **Risk:** medium: depth-sorting artefacts, atlas load time, 4K fill rate. Mitigation: chunked ground layer, culling; measure early.
- **Visible result:** playable on the preview. Art style review can start here with variants B and C drawn as extra `styles/*` folders in a **separate, optional** follow-up WP if the reviewers need them (not blocking S1).

### S1-5 Test hook, screens, replay and cross-engine suite
- **Goal:** `window.__app` per ADR-0003 (S1 subset), title / dead / pause screens as DOM overlays, replay determinism across engines.
- **Depends:** S1-4. **Parallel-ok with** S1-6 (disjoint files). **Estimate:** M.
- **ACs:** AC-R-001-1, AC-R-001-2, AC-R-023-2, AC-R-023-3, AC-R-110-1, -2, AC-R-120-1, AC-R-121-1..-5, -7, AC-R-123-1, -2, AC-NFR-S01-1, AC-NFR-A02-1 (E2E), AC-R-020-3 (E2E), AC-NFR-Q01-1, -2, AC-R-122-1, AC-NFR-L03-1 (title text), AC-NFR-B03-1, AC-NFR-O02-1 (request interception, 60 s play), AC-R-042-5 (E2E).
- **Files:** `src/testhook/{index,api}.js`, `src/core/cheats.js` (`spawnMonster`), `src/ui/screens.js`, `src/ui/options.js` (stub), `e2e/{helpers,hook,combat,replay,engines}.mjs`, `bot/policy.js` + `bot/run-headless.mjs` (used to record `run-a.json`).
- **Tests:** as listed; engines loop over Chromium, Firefox and WebKit where installed.
- **Risk:** medium: Playwright browser availability in the environment (spec QF-10-4); WebKit hash differences would indicate a determinism-rule violation (use `test/layering.test.js` as the first diagnosis).

### S1-6 Minimal HUD, feel pass, bot run, S1 hardening
- **Goal:** the S1 game is understandable and not ugly: health and mana gauges (shape-distinct, NFR-A03), target health bar, floaters for damage (renderer-side in S1), death/hit flash, simple camera ease; run the browser bot for a soak; fix what it finds.
- **Depends:** S1-4 (parallel-ok with S1-5). **Estimate:** M.
- **ACs:** R-070 and R-077 (HUD parts that exist in S1; spec file pending), AC-R-025-* deferred to S2 (state-backed floaters), NFR-A03 for gauges; all S1 ACs re-run green.
- **Files:** `src/render/{hud,fx}.js`, `src/render/styles/vector/ui.js`, `src/ui/layout.js` (HUD regions), `bot/run-browser.mjs`.
- **Tests:** `test/layout.test.js` (HUD regions fit 1280x720 to 4K, no overlap), E2E screenshot checks for the visual reviewer (not asserted), bot report with zero page errors over 20 runs.
- **Risk:** low.

## Slice S2: Loot and progression

**Demo at the end of S2:** a full run loop: start in the Lobby (town), buy or stash, take the stairs to floors 1-8 (open-plan then basement), kill monsters (packs, champions), pick up randomised loot, equip it, level up, spend attribute and skill points, use potions from the belt, use the quick-return item, die and respawn in town; panels toggled by C, I, S, M.

### S2-1 Items and loot generation (core)
- **Goal:** item model, affixes, rarity, seeded drops, ground items, gold, containers.
- **Depends:** S1. **Parallel-ok with** S2-3 (disjoint modules). **Estimate:** L.
- **ACs:** AC-R-050-1..-7, AC-R-051-1, -2, -4, -5, AC-R-052-1..-7, AC-R-120-5, AC-R-123-3 (cheat), AC-R-053-6, -7.
- **Files:** `src/core/items/{roll,affixes}.js`, `content/{items,affixes,uniques}.js`, `systems/loot.js`, `gen/population.js` (containers, QF-05-1 default: breakable office crates/cabinets), `core/cheats.js` (`spawnItem`).
- **Tests:** `test/loot.test.js` (distribution by rarity within tolerance, affix filtering by type and item level, no duplicate stat group, ranges respected, 200-kill determinism), `test/affixes.test.js`.
- **Risk:** medium: balance numbers belong to `config` (QF-05-7); keep tests relational.

### S2-2 Inventory, equipment, belt, derived stats, vendors (core logic)
- **Goal:** all item movement rules and the stat formulas, with no UI yet.
- **Depends:** S2-1. **Estimate:** L.
- **ACs:** AC-R-055-1, -3..-6, AC-R-053-1..-5 (rules), AC-R-054-1, -2, AC-R-056-1..-6, AC-R-012-1 (derived stats formula, from the character spec), AC-R-057-1..-8 (buy/sell logic), AC-R-059-1, AC-R-121-6 (`cmd.use`), AC-R-023-5, AC-R-023-6 (cursor item on death).
- **Files:** `src/core/items/{inventory,equipment,belt,derive}.js`, `systems/vendors.js`, input commands `invMove`, `equip`, `useBelt`, `buy`, `sell` in `systems/intent.js`, `content/npcs.js` (stock tables), `testhook` additions (`cmd.use`).
- **Tests:** `test/inventory.test.js` (placement, overlap, swap with cursor, full inventory event), `test/equip.test.js` (slot rules, requirements, stat sums), `test/belt.test.js`, `test/vendor.test.js` (buy price greater than sell, insufficient gold, inventory full).
- **Risk:** medium (many rules, QF-05-4 two-handed, QF-05-5, QF-05-6 open; defaults chosen by implementer and recorded in the spec questions).

### S2-3 Progression, skills, projectiles, scaling, champions
- **Goal:** XP and levels, attribute and skill points, one class's skills, projectile system shared by player and monsters, depth scaling, champion modifiers, hit recovery.
- **Depends:** S1 (parallel-ok with S2-1). **Estimate:** L.
- **ACs:** R-010..R-016 (ids from the character spec, pending), AC-R-022-1..-5, AC-R-024-1, -2, AC-R-025-1, -2 (state-backed floaters, flash, death ticks), AC-R-031-1..-4, AC-R-033-1, -2, AC-R-030-2, -4 (full archetype set), AC-R-032-6, -8, AC-R-034-3, AC-R-005-5 (secondary skill), AC-R-123-4.
- **Files:** `src/core/systems/{progression,projectiles}.js`, `content/skills.js`, `content/monsters.js` (full set, champions mods), `systems/ai.js` (ranged, flee), `systems/combat.js` (skills, knock-back, stagger), `core/cheats.js` (`setLevel`, `setHp`, `giveGold`).
- **Tests:** `test/progression.test.js`, `test/projectiles.test.js`, `test/skills.test.js`, `test/scaling.test.js`, `test/champions.test.js`.
- **Risk:** medium-high: skill design is undecided in the spec; keep skills data-driven (effect kinds: melee-mod, projectile, buff, passive).

### S2-4 Town, NPCs, floors 1-8, persistence in run, quick-return, respawn
- **Goal:** the Lobby, NPC interaction (dialog state), stairs both ways, the basement theme, floor regeneration by seed, cleared flags, "Emergency Exit" portal consumable, respawn in town.
- **Depends:** S2-2 (vendors), S2-3 (monsters). **Estimate:** L.
- **ACs:** AC-R-040-1..-5, AC-R-041-1..-6, AC-R-043-1..-4, AC-R-044-1, -2, AC-R-046-1..-3, AC-R-004-3, -4, AC-R-023-4, AC-R-042-7, -8, AC-R-100-1, -2, AC-R-101-2, AC-R-003-2, AC-R-123-5 (`teleportFloor`), AC-R-005-4.
- **Files:** `src/core/town.js`, `systems/{stairs,scene}.js`, `content/{themes,npcs,props}.js` (lobby, basement, server-room props), `gen/*` (theme tables, basement rooms), `state.floors`.
- **Tests:** `test/town.test.js` (no hostiles, NPC tiles reachable, stairs), `test/stairs.test.js` (entry tile, depth, deepest), `test/floors.test.js` (re-entry same layout, cleared stay cleared), `test/respawn.test.js`.
- **Risk:** medium.

### S2-5 In-game UI: panels, drag and drop, tooltips, map, hotkeys
- **Goal:** character, inventory/equipment, skills, map panels and vendor/stash/dialog windows drawn on the canvas from `ui/layout.js` regions; drag and drop of grid items; compare tooltip.
- **Depends:** S2-2, S2-3 (S2-4 for vendor windows). **Estimate:** L. If it overruns, split: panels (character/skills/inventory) first, vendor and map second.
- **ACs:** AC-R-005-10, -11, AC-R-055-2, AC-R-053-1..-5 (E2E through UI), AC-R-056-5, AC-R-061-1, -2, AC-R-051-3, AC-NFR-A02-3, R-072..R-075 (HUD spec pending), R-016 (attribute allocation UI), R-071 (skill bar and belt on HUD).
- **Files:** `src/ui/{layout,regions,tooltip,dragdrop}.js`, `src/render/{panels,minimap,hud}.js`, `src/input/mouse.js` (UI regions first), `render/styles/vector/ui.js`.
- **Tests:** `test/layout.test.js` (pure region math, drag target resolution), `e2e/panels.mjs` (hotkeys toggle, moving an item by `clickScreen` drags, tooltip text contains item stats, pause with panel open).
- **Risk:** medium-high: UI-on-canvas effort; readable text at 14 px minimum at 1080p (NFR-A04).

### S2-6 S2 content art, performance pass, loop test
- **Goal:** all sprites the S2 content needs (monster set, item icons for every base, town tileset, basement tileset, NPCs, projectile and hit FX), a performance pass to hold 50 monsters, and the full-loop E2E.
- **Depends:** S2-3..S2-5 (art part can start after S2-1/S2-3 registries are fixed; **parallel-ok** with S2-5 except `ui.js`). **Estimate:** L.
- **ACs:** AC-R-004-1, -2, AC-R-002-2, AC-NFR-P01-1, -2, AC-R-101-3 (basement tiles), rarity encodings AC-R-051-3 / NFR-A03, AC-R-025-1 (visual floaters).
- **Files:** `src/render/styles/<chosen>/{monsters,items,town,basement,fx}.js`, `render/world.js` (culling, batching, chunk cache), `render/fx.js` (particles pool), `e2e/{loop,perf,atlas}.mjs`, `bot/run-browser.mjs` updates.
- **Tests:** E2E loop script from AC-R-004-1, perf sampling with 50 monsters (advisory off the reference runner), `test/palette.test.js` (colour-blind separation of rarity colours), atlas completeness.
- **Risk:** high: art quality and 50-monster frame time. Mitigation: profile before polishing; dirty-rect or chunk caching; lower-detail animation frames for distant monsters.
- **S2 gate:** independent visual review of screenshots (spec QF-02-5, QF-05-8); art style must be decided by here.

## Slice S3: Sound and finale

**Demo at the end of S3:** the full game from title to boss and victory with synthesised sound and ambient, volume and key remapping, autosave and export/import, runs from `file://` and offline, and a graceful error screen.

### S3-1 Boss floor, finale, keep playing
- **Goal:** floor 8 boss arena, boss with two phases, guaranteed drops, victory scene, "keep playing".
- **Depends:** S2. **Parallel-ok with** S3-2. **Estimate:** M.
- **ACs:** AC-R-045-1..-7, AC-R-056-7 (as tagged S3), story text R-104.
- **Files:** `src/core/systems/boss.js`, `content/monsters.js` (boss), `gen/floor.js` (arena room), `content/strings.js` (story lines), `ui/screens.js` (victory), boss sprites in the chosen style.
- **Tests:** `test/boss.test.js` (phase thresholds, patterns deterministic, drop guarantee), `e2e/finale.mjs` (teleport to boss, kill, victory, keep playing).
- **Risk:** medium (balance, boss readability).

### S3-2 Audio synthesis and engine
- **Goal:** pure sample synthesis for all SFX and per-zone ambient, WebAudio engine with buses, cue mapping from events, rate limiting.
- **Depends:** S2 (events exist). **Parallel-ok with** S3-1. **Estimate:** L.
- **ACs:** R-080, R-081, R-082 (audio spec pending), AC-R-056 audio cue where specified, AC-NFR-L01-3 (no asset requests), AC-NFR-A02-2 (pause suspends audio, with S3-4 options).
- **Files:** `src/audio/{synth,sfx,ambient,engine,cues}.js`, `src/testhook/api.js` (`audio.getState`), `src/ui/options.js` (volume sliders, mute).
- **Tests:** `test/synth.test.js` (`renderSfx` for every SFX id: finite, non-silent, peak at most 1, deterministic; `renderAmbient` length and loop seam continuity), `test/cues.test.js` (event to cue mapping, rate limiter), `e2e/audio.mjs` (gain nodes via `audio.getState`, mute, cue log after kill).
- **Risk:** medium-high: perceived quality ("nice sound", Q5) is subjective; plan a listening-free review proxy (spectral checks) and flag to the user for a real listen.

### S3-3 Save, load, export/import
- **Goal:** versioned save of character, inventory, equipment, stash, belt, deepest floor, boss flag and options; autosave at town, floor change and exit; single slot; file export/import.
- **Depends:** S2. **Parallel-ok with** S3-1/-2. **Estimate:** M.
- **ACs:** R-090, R-091, R-092 (save spec pending), AC-R-059-2, AC-NFR-O02-1 (S3 extension: no network during save/load), AC-NFR-Q02-1 (last save kept for export).
- **Files:** `src/save/{format,storage,migrate}.js`, `src/core/index.js` (`serialiseSave(state)`, `loadSave(obj)`), `src/testhook/api.js` (`save.*`), `src/ui/screens.js` (continue, export, import).
- **Tests:** `test/save.test.js` (round trip deep-equal, version migration stub, corrupt input rejected without throwing, storage unavailable falls back to in-memory), `e2e/save.mjs` (reload keeps stash and items; export then import in a fresh context).
- **Risk:** medium: storage may be blocked (private windows); every access in try/catch.

### S3-4 Options, key remapping, accessibility
- **Goal:** options screen with rebinding, restore defaults, text size, reduced motion/flash, volume (from S3-2), mouse bindings shown fixed.
- **Depends:** S2-5, S3-3 (persist), S3-2 (volume). **Estimate:** M.
- **ACs:** AC-NFR-A01-1..-5, AC-R-025-3, NFR-A04, NFR-A05, NFR-A06 (strings table complete), AC-NFR-A02-2.
- **Files:** `src/ui/options.js`, `src/input/keymap.js`, `src/core/config.js` (`defaultKeys`), `src/render/fx.js` (reduced motion), `core` option state (`options.reducedMotion`, `options.keys`).
- **Tests:** `test/keymap.test.js` (collision rejected, defaults restored), `e2e/options.mjs` (rebind and reload, text size).
- **Risk:** low-medium.

### S3-5 Robustness, offline, size and legal gates
- **Goal:** error scene and recovery, `file://` and offline operation, size ceiling, final legal/IP scans, run-length balance check with the bot.
- **Depends:** S3-1..-4. **Estimate:** M.
- **ACs:** AC-NFR-Q02-1, AC-R-111-1, -2, AC-NFR-O01-1, AC-NFR-L01-3, AC-R-110-3 (final), AC-NFR-L01-1, -2, AC-NFR-L03-1, AC-NFR-L04-1, AC-NFR-L05-1 (re-run on full content), R-006 / QF-01-5 measurement via `bot/run-headless.mjs` (report, not an AC).
- **Files:** `src/main.js` (error scene, export action), `core/cheats.js` (`throwInTick`), `e2e/{offline,engines}.mjs`, `test/size.test.js`, `bot/run-headless.mjs` (balance report), `README.md`, `ASSET-LICENCES.md`.
- **Tests:** as listed.
- **Risk:** medium: balance is open-ended; report numbers, adjust `config` in a follow-up if outside 20-40 minutes.

### S3-6 Final art/audio polish and release checks
- **Goal:** fix issues from the independent visual review, finish animations and effects, tune audio levels, performance re-check, final acceptance run.
- **Depends:** S3-1..-5. **Estimate:** M-L (open-ended; time-box to one run per review cycle).
- **ACs:** all S1-S3 ACs green; AC-NFR-P01-1/-2 re-run; visual-review items QF-02-5, QF-04-11, QF-05-8.
- **Files:** `src/render/styles/<chosen>/*`, `src/audio/*` (levels), `render/fx.js`.
- **Tests:** full `npm test` and `npm run e2e` on all three engines, artifact upload of the screenshot set for the reviewer.
- **Risk:** medium: subjective review cycles.

## Dependency summary

```
S1-1 -> S1-2 -> S1-3 -> S1-4 -> S1-5
                         \-> S1-6        (S1-5 and S1-6 in parallel)
S1 -> S2-1 -> S2-2 -> S2-4 -> S2-5 -> S2-6
S1 -> S2-3 ---^-----/
S2 -> S3-1, S3-2, S3-3 (parallel) -> S3-4 -> S3-5 -> S3-6
```

## Open points and assumptions for the plan gate

1. **Slice tags** for character/skills, HUD, audio and save requirements come from files not yet written; the S2/S3 placement above (save and audio in S3, HUD panels and skills in S2) follows the slice names and the S3-tagged ACs seen so far (AC-NFR-O01-1, AC-NFR-Q02-1, AC-NFR-A01-*). Re-map when `06`-`09` spec files land.
2. **Art style pick** must happen before S2-6 at the latest; S1-4 builds the vector style only. A B or C variant needs one WP of its own (about the size of S1-4's style part) if chosen.
3. **Denylists** (QF-10-2): the legal scans are meaningless until `docs/product/denylist-*.txt` exist; WP S1-1 builds the scan harness and fails loudly if a list file is missing.
4. **Playwright** is not yet in `package.json`; WP S1-1 adds it as an exact-version dev dependency (Apache-2.0, allowed by NFR-L04).
5. **Reference runner for performance** (QF-10-1): E2E perf assertions are advisory elsewhere.
6. **Spec amendments needed (mechanical):** `step` mutates and returns the same state; alias names added to the hook; decisions table in ADR-0002 section 11 (hit chance, click on wall, skill keys, boss depth, town stairs target, re-entry rules).
7. **Line budget:** S1-2, S1-3, S1-4, S2-1..S2-6 and S3-2 are the packages most likely to exceed 600 lines; the implementer should stop at a coherent half and report instead of cramming (split rule: one new WP inserted, same slice).

---

# Rounds R4-R6: classes, skill trees, character selection, five save slots (added 2026-10-14)

Owner: architect. Status: proposed, awaiting plan gate for area M. Inputs: `00-brief.md` (Third briefing: "add 3 more rounds of work", 3 classes with skill trees, a visually appealing character-selection screen, 5 save slots in the options menu, keep improving game and tool), `20-requirements.md` area M (R-200..R-234), `circles/circle-02.md` (PROXY answers, binding), `decisions/ADR-0005-classes-and-skill-trees.md`, `decisions/ADR-0006-save-slots.md`, `../reviews/R4-contract.md` (data contract for the parallel packages, learning L-13).

The customer wrote "3 more rounds of work": one round = one orchestrated cycle (core, then render/UI, then balance and polish), as S1-S3 were. Slices are demoable on a preview: **R4** ends with the three classes playable by bot and hook with their trees and five slots working without any new screen; **R5** ends with the real screens; **R6** ends with parity and polish. Rules from the first plan hold: one WP is one implementer run of at most about 600 lines of code (tests excluded, mandatory), one branch/PR, listed order; if a WP runs over, the implementer stops at a coherent half and reports (split rule: one new WP inserted, same round). Core-first (L-11): bots play all three classes before any sprite exists.

Line counts below are estimates of production code. Estimates S/M/L as above. Infra changes: none. Migrations: save format 1 to 2 (R4-1, R4-5).

## Round R4: core, content data and save slots (no new screens)

**Demo at the end of R4:** headless bots clear floors with each class; `window.__app` can create a character per class in any of five slots, learn skills, respec, switch slots, export and import, and migrate an old v1 save; the old UI still works with a minimal class picker fallback (a `?class=` URL param and the hook).

### R4-1 Class and tree data model, validation, save version 2
- **Goal:** class defs, curve helper, 30 skills as data (no behaviour yet), merged `skills` table, `learnSkill` with class, level gate and prerequisites, point accounting with the free signature, `validateName`, save format v2 (`name`, `stats.playTicks`, class and skill validation) and the v1 to v2 Clerk migration with refund.
- **Depends:** S3 complete. **Parallel-ok with:** nothing (everything builds on it). **Estimate:** M (about 550 lines, mostly data).
- **ACs/Reqs:** R-200..R-205, R-211, R-225 (core half), R-233 (data half), AC for point accounting levels 1-30.
- **Files:** `src/core/content/classes.js`, `content/skilltrees/{facilities,sales,it}.js`, `content/skills.js` (merge, `at`, `manaCost`), `content/strings.js` (class blurbs, branch and skill names and one-line texts, error codes), `core/systems/progression.js` (`learnSkill`, `gainXp`), `core/state.js` (class-aware `newPlayer`, `name`, signature, start kit per class), `core/config.js` (`skillTiers`, `respec`, `slotCount`, `slotMaxBytes`, per-class constants), `core/items/derive.js` (class `derived` overrides, passive fold placeholder), `core/items/content` (3 weapon bases: `pipe-wrench`, `letter-opener`, `usb-staff`), `save/{format,migrate}.js` (v2 + `MIGRATIONS[1]`), `core/index.js` (exports `classById`, `treeView`, `skillView`, `classCards`, `validateName`, `suggestName`).
- **Tests:** `test/classes.test.js` (3 classes, equal attribute sums, kit bases exist, differ in start values), `test/skilltrees.test.js` (10 per class, 3 branches, unique ids, no cycles, prerequisites in branch, gates default to tiers, texts exist, `maxLevel` sum at least 1.3 x 29, legal denylist scan over names and texts), `test/progression.test.js` (learn rejects with codes and spends nothing; accounting invariant over levels 1-30), `test/save-migrate-v2.test.js` (synthetic v1 Clerk fixture: class mapped, refund exact, bar reset, attrs kept, idempotent, corrupt v1 rejected), `test/name.test.js` (empty, long, markup, unicode, trimming).
- **Risk:** medium: touches `newGame` used by every fixture; keep `facilities-manager` the default so old tests pass; golden hashes re-pinned once at the end of R4-3, not here.

### R4-2 Skill runner: damage types, statuses, projectile and area archetypes, crits
- **Goal:** `systems/skillfx.js` with the effect ops (`damage`, `dot`, `heal`, `hot`, `status`, `knockback`, `execute`, `statMod`), archetypes `projectile`, `area`, `self`, `melee`; monster `resist` table; statuses (`stun/mute/freeze` on `muteT`, `slow`, `weaken`, `burn`); class basic attacks `toss` and `zap` through click-to-attack; crit rolls; `castSkill` becomes a thin dispatcher with an unchanged result shape; passives and `statMod` folded in `deriveStats`.
- **Depends:** R4-1. **Parallel-ok with:** R4-5. **Estimate:** L (about 600 lines; if over, split ops into `skillfx-ops.js` as a new WP R4-2b).
- **ACs/Reqs:** R-201 (basic attack differs), R-203 (per-level values), R-207, R-231 (affix part prepared), AC for AC-R-014-5/-6/-7 kept.
- **Files:** `core/systems/{skills,skillfx,statuses,damage,combat,ai,movement}.js` (named hooks only), `core/content/monsters.js` (optional `resist`), `core/items/derive.js`, `core/state.js` (monster status fields), `content/skilltrees/*` (fill `delivery` and `effects` for projectile, area, self and passive skills: 20 of 30).
- **Tests:** `test/skillfx.test.js` (every op on a fixture: damage type and resist, dot ticks, statuses expire, bosses resist stun not slow, crit uses the combat stream, heal clamps, execute multiplier), `test/skills-data.test.js` (every skill's ops are known; every `now`/`next` row formats), `test/basic-attacks.test.js` (toss and zap range and line of sight), `e2e/hook.mjs` extended (cast each archetype via hook).
- **Risk:** medium-high: changes hit rolls; replay hashes shift; keep old Strike path byte-compatible until hashes are re-pinned in R4-3.

### R4-3 Buffs, auras, allies, zones, dash; remaining ten skills; respec
- **Goal:** archetypes `buff`, `aura`, `summon`, `dash`, `trap` plus lingering fields via `state.zones`; ally AI (follow, attack nearest, expire, decoy), monsters may target allies; `respec` and `toggleAura` commands; the last ten skills' data; golden hashes and replay re-pinned.
- **Depends:** R4-2. **Parallel-ok with:** R4-5. **Estimate:** L (about 600 lines).
- **ACs/Reqs:** R-203, R-207, R-209, R-232 (behaviour half), R-234.
- **Files:** `core/systems/{allies,zones,skillfx,intent}.js`, `core/content/allies.js` (intern, cone), `core/state.js`, `core/systems/{ai,combat,damage,world}.js` (clear allies and zones on floor change), `content/skilltrees/*`.
- **Tests:** `test/allies.test.js` (cap, expiry, follow, decoy draws attack, cleared on floor change), `test/zones.test.js` (trap arm, trigger once, linger ticks, `max` traps), `test/dash.test.js` (walls, LOS, crossed monsters), `test/buffs.test.js` (absorb drains first, reflect, aura reserve and one-aura rule), `test/respec.test.js` (town only, refund exact, signature stays, hotkeys cleared, modes free/gold/once/off), `test/determinism.test.js` and `e2e/replay.mjs` (per class replay hash, R-234).
- **Risk:** medium: determinism of ally and zone order (iterate by id, fixed phase order in `step`).

### R4-4 Class-tagged affixes, loot, bot support
- **Goal:** class-tagged affixes (`skillLevel.all`, `skillLevel.branch.*`, `skillDamagePct.*`) rolled only for the matching class; `effLevel` bonus; tooltip data; bot policy per class (build order, priority list, kiting for ranged and casters) so headless runs exist for all three classes; `bot/run-headless.mjs` takes `--class`.
- **Depends:** R4-3. **Parallel-ok with:** R4-5. **Estimate:** M (about 450 lines).
- **ACs/Reqs:** R-231, R-230 (tooling half), R-234.
- **Files:** `core/content/affixes.js`, `core/items/{roll,derive}.js`, `core/content/strings.js`, `bot/policy.js`, `bot/run-headless.mjs`, `bot/report.js`.
- **Tests:** `test/affixes-class.test.js` (never rolls for other classes over 2000 rolls per class; same seed and class deterministic; requirement check class-independent), `test/bot-class.test.js` (each class reaches floor 3 within a tick budget on fixed seeds), `test/skill-bonus.test.js`.
- **Risk:** medium: bot kiting for casters may be unreliable (circle-02 Q7 fallback B: soft report instead of gate).

### R4-5 Slot store, migration, shell session commands, hook (parallel with R4-2..R4-4)
- **Goal:** `save/slots.js` per ADR-0006: five slot keys, index with metadata and repair, undo copy, quotas and recovery order, per-slot export/import, `migrateLegacy`; shell: active slot, `createCharacter`, `loadSlot`, `continue`, `deleteSlot`, `renameSlot`, `selectSlot`, autosave to the active slot only; hook `slots.*`, `character.*`; the old single-slot title behaviour is kept working through `continue`.
- **Depends:** R4-1 (save v2 and names). **Parallel-ok with:** R4-2, R4-3, R4-4 (disjoint files per `R4-contract.md` section 7). **Estimate:** L (about 600 lines; split `migrateLegacy` into R4-5b if over).
- **ACs/Reqs:** R-220, R-221 (logic), R-222 (projection), R-224, R-225, R-226, R-227, NFR-D05, NFR-D06, AC-NFR-Q02-1 kept.
- **Files:** `src/save/{slots,storage,index}.js`, `src/game.js`, `src/main.js`, `src/testhook/index.js`, `src/core/config.js` (only the slot constants, coordinate with R4-1 through the note file), `test/save-slots.test.js`, `e2e/save.mjs`.
- **Tests:** `test/save-slots.test.js` (index shape, list reads one key, 100 autosaves in slot 2 leave 1/3/4/5 byte-identical, bad slot isolated and `.bad` kept, newer slot untouched, quota ladder in order with `failWrites`, over-400-KB refused with old save intact, crash between slot and index writes repaired, index missing rebuilt, migration idempotent and legacy keys kept, import into another slot equals export), `e2e/save.mjs` (create in slot 3, reload, continue; export slot 2, import into 4; corrupt slot 3 only).
- **Risk:** medium: two-key writes; covered by ordering and repair; legacy Playwright tests that use `office-crawler.save` are updated here.

## Round R5: screens, art and effects (split WORLD and UI, parallel)

**Demo at the end of R5:** title -> slots -> class selection -> game for all three classes; skill tree panel; Options "Save slots" section; class figures, ally sprites and all effects rendered; independent visual review.

### R5-W1 Class figures, portraits, allies (WORLD)
- **Goal:** three hero figures from the shared rig with per-class palettes and accessories, all animation keys (`idle walk attack cast hurt die portrait card-idle`), `drawFigure(canvas, figureKey, opts)`, ally sprites `intern` and `cone`; atlas test for completeness; reduced motion static pose.
- **Depends:** R4 (figure keys in `R4-contract.md`; can start after R4-1). **Parallel-ok with:** R5-U1, R5-U2. **Estimate:** L (about 600 lines; art cost is high, time-box one review cycle).
- **ACs/Reqs:** R-232, R-212 (figure half), R-213, NFR-P06.
- **Files:** `src/render/styles/vector/{heroes,allies}.js`, `render/{atlas,world,draw/*}.js`, `render/figure.js`, `e2e/render.mjs`, `e2e/world-shots.mjs`.
- **Tests:** `test/atlas-classes.test.js` (every `figureKey` has every animation key; frames differ between two ticks for `card-idle`), `e2e/world-shots.mjs` (screenshots of each class idle, walk, attack, cast at 1280x720 and 390x844 for the reviewer).
- **Risk:** medium: three distinct silhouettes on a shared rig; review by eye.

### R5-W2 Effect archetypes and 24 skill icons (WORLD)
- **Goal:** all `fx:*` keys from `R4-contract.md` section 5 (about fourteen), damage-type tints, status marks over monsters, zone and aura drawings, shield dome, dash streak, floaters per damage type, 24 new skill icons plus 9 branch icons and 3 class icons.
- **Depends:** R4-3 (events exist), R5-W1 not required. **Parallel-ok with:** R5-W1, R5-U1, R5-U2. **Estimate:** L (about 600 lines; if over, icons become R5-W2b).
- **ACs/Reqs:** R-232, R-203 (icon per skill), NFR-A07 (no colour-only state), reduced motion/flash.
- **Files:** `src/render/fx.js`, `render/draw/fx-*.js`, `render/styles/vector/fx.js`, `src/ui/icons.js` (icon bodies only), `e2e/render.mjs`.
- **Tests:** `test/fx-keys.test.js` (every skill's `fx.cast`/`fx.hit` key resolves; every skill id has an icon body; `skillIcon` non-empty), `test/fx-reduced.test.js` (reduced motion produces static output), `e2e/world-shots.mjs` (one cast of every archetype).
- **Risk:** medium: performance with many zones/allies; pooled objects as in the existing renderer.

### R5-U1 Skill tree panel, Save slots section and slot manager (UI)
- **Goal:** replace the flat skills list with the tree panel (tabs per branch, nodes on a grid from `tier/col`, edges, tooltips from `now/next`, learn on click and keyboard, point counter, respec button with confirm, text states); Options section "Save slots" and the same list on title, pause and in game (cards from the index, create, load, overwrite, delete, rename, export, import with confirmations that name the character, bad and newer states); phone layout (one branch at a time).
- **Depends:** R4-3, R4-5. **Parallel-ok with:** R5-W1, R5-W2, R5-U2. **Estimate:** L (about 600 lines; if over, slot manager becomes R5-U1b).
- **ACs/Reqs:** R-206, R-207, R-209, R-220, R-221, R-222, R-223, R-226, R-227, NFR-A07.
- **Files:** `src/ui/{panels,options,slots,layout,text,messages}.js`, `src/style.css`, `src/index.html` (only if a container is needed), `src/ui/screens.js` (menu routing for `slots`).
- **Tests:** `e2e/ui.mjs` (3 tabs, click learns, counter decreases, locked reason text, tooltip non-empty, respec in the Lobby), `e2e/slots.mjs` (every operation incl. cancel; other slots unchanged), `test/layout.test.js` (tree on 390 px width without horizontal scroll), a11y checks (focus order, state in text).
- **Risk:** medium: many destructive dialogs; confirmations must name the character.

### R5-U2 Character selection screen and title flow (UI)
- **Goal:** the visually appealing class screen per circle-02 Q5 option A: carousel of three cards in the lobby scene, large animated figure (idle, attack demo on hover or click), role tag, blurb, stat bars, three branch names with icons, name field with validation and suggest button, Begin and Back; title flow New game -> slot picker -> class -> game, Continue, keyboard path, reduced motion static; **2-3 layout variants** delivered for the independent visual review (as for art direction and the inventory panel), the pick is the customer's or the proxy's.
- **Depends:** R4-5, R5-W1 (figures; stub with portraits if late). **Parallel-ok with:** R5-U1. **Estimate:** L (about 600 lines including variants; variants as CSS/markup switches, not copies).
- **ACs/Reqs:** R-210, R-211, R-212, R-213, R-214, R-215, NFR-P06, NFR-A07.
- **Files:** `src/ui/{create,screens,title}.js`, `src/style.css`, `docs/product/variants/` (variant notes and screenshots), `e2e/create.mjs`.
- **Tests:** `e2e/create.mjs` (create per class with name -> `getState().player.class`; invalid name disables Begin; keyboard-only path title to game; reduced motion leaves canvas identical between frames; canvas differs between two frames otherwise), frame-time check in the perf script, visual review file in `docs/reviews/R5-visual-review.md`.
- **Risk:** medium-high: judged by eye; the real customer may overrule on screen (record in `proxy-log.md`).

## Round R6: balance, polish and release checks

**Demo at the end of R6:** three classes each within the parity band, full acceptance run, size/legal/offline gates green, visual review closed.

### R6-1 Per-class balance and bot gates
- **Goal:** tune curves, attribute starts, mana and class growth in data; bot policies finish each class in 20-40 minutes of game time; parity report (median clear time and deaths within 25 percent of the three-class median, no dominant skill, damage share per skill); fixed-seed gate in the release checks (circle-02 Q7 option A, fallback B if casters are unreliable).
- **Depends:** R4-4, R5 for browser runs (headless is enough for numbers). **Parallel-ok with:** R6-2. **Estimate:** L (open-ended; time-box to two tuning passes).
- **ACs/Reqs:** R-230, R-006 per class, R-234.
- **Files:** `src/core/content/{classes,skilltrees/*,monsters}.js` (numbers), `core/config.js`, `bot/{policy,report,run-headless}.mjs`, `docs/reviews/R6-balance.md`, `test/balance-gate.test.js` (fast fixed-seed smoke, the long runs stay in `bot/`).
- **Tests:** `test/balance-gate.test.js` (short horizon: each class reaches a depth and level by tick N on three seeds), release script prints the parity table.
- **Risk:** high: open-ended; report numbers, adjust data only.

### R6-2 Synergies (could), polish, accessibility, legal, size
- **Goal:** implement R-208 synergies if room (tooltip and damage numbers), fix independent visual and acceptance review findings from R5, performance re-check (many allies/zones), size ceiling, `file://` and offline re-run, legal scans over all new strings, README and ASSET-LICENCES update, `harness` learnings entries for the round.
- **Depends:** R5, R6-1. **Parallel-ok with:** R6-1 (disjoint after R5). **Estimate:** M-L.
- **ACs/Reqs:** R-208 (could), R-233, NFR-A07, NFR-P06, AC-NFR-L01-*, AC-NFR-O01-1, previous visual-review items.
- **Files:** `core/systems/skillfx.js` (synergy lookup), `ui/panels.js`, `render/*` (review fixes), `test/{size,legal,ip-denylist}.test.js`, `e2e/{offline,engines}.mjs`, `README.md`, `ASSET-LICENCES.md`.
- **Tests:** full `npm test` and `npm run e2e` on three engines; synergy tests only if implemented.
- **Risk:** medium: subjective review cycles; time-box one fix cycle.

## Dependency summary for R4-R6

```
S3 -> R4-1 -> R4-2 -> R4-3 -> R4-4
          \-> R4-5 (parallel with R4-2..R4-4)
R4-1 -> R5-W1 ; R4-3 -> R5-W2 ; R4-3 + R4-5 -> R5-U1 ; R4-5 + (R5-W1) -> R5-U2    (R5-W1, W2, U1, U2 run in parallel)
R4-4 -> R6-1 ; R5 -> R6-2
```

## Open points for the plan gate (R4-R6)

1. **Brand:** final class names and the game title are escalated to the real customer (R-233); working names are used everywhere as strings, ids stay stable.
2. **Respec rule** (PROXY, low confidence): one config switch; no code change if the customer picks gold, once or off.
3. **Free signature skill** keeps the "29 points at level 30" answer; the alternative (one open point at level 1) is a config change.
4. **Round budget:** R4 holds five packages with two large ones (R4-2, R4-3) at the 600-line limit; R5 has four parallel packages; if a package overruns, the split rule inserts a WP in the same round rather than moving work to the next round. Synergies and skill demo reel are explicitly the first items to drop.
5. **Replay hashes** change in R4-2/-3 (crit draws, new state); they are re-pinned once in R4-3 and each class gets its own replay hash.

## Round R7 (first "flawless gameplay" round): added item from the sixth briefing (2026-10-14)

### R7-4 Quest count from the customer (2026-10-14): 3 main quests and 5 side quests
- **Customer:** "do 3 quests and 5 sidequests" (decision 8), keep the working names (7), spread the difficulty over the floors (6). Today: 1 main quest (6 steps) and 3 side quests.
- **Design:** `decisions/ADR-0007-quests.md` amendment "R7-4"; spec `30-spec/12-quests-journal.md` addendum "R7-4" (15 ACs, AC-R-257-1..259-5). In short: three main quests derived from the one milestone block (`main` floors 1 to 3, `main2` "The Paper Trail" floors 4 to 6, `main3` "Final Notice" floors 7 to 9, boss and verdict; the next unlocks when the previous completes; arcs 1 and 2 pay gold and experience on completion); two new side quests (`sq4` "The Misfiled Ledger", item on floor 5 or 6, stash keeper; `sq5` "Slide Deck Surplus", kill 6 Consultants on floors 5 and 6, vendor); the objective kinds are generalised per quest, no new kind; save version 5 with `MIGRATIONS[4]`; one more golden re-pin with the unchanged proof; bot trip T2 from floor 6.
- **Order:** FIX-R7-CORE and FIX-R7-UI hand back -> **R7-4.1** (CORE) -> **R7-4.2** (UI and WORLD) -> bot and parity runs (inside R7-4.1) -> adversarial + review of the quest changes -> **R7-3** pace (BAL) on the finished content. R7-4.2 starts after R7-4.1 step 3 (the derived views and the snapshot shape exist).
- **Overlaps with the running fix round (R7-4 starts after both):** FIX-R7-CORE edits `systems/quests.js` (CR7-01 kill satisfiability, CR7-06 seed-pure gear candidates), `config.js`, `save/format.js` (ADV-R7-01 schema), `bot/quests.js` and `bot/policy.js` (ADV-R7-03), `test/fixtures/**` (CR7-02 second golden) and adds `rewardSummary`; FIX-R7-UI edits `ui/journal.js`, `ui/questdialog.js`, `game.js` (toast queue), `e2e/r7quest.mjs`, `e2e/r7journal.mjs`. R7-4.1 and R7-4.2 rebase on the results, reuse `rewardSummary` and the CR7-01 rule, and do not re-open either fix.
- **Open for the customer (questions, design fits either answer):** a sixth Lobby character for `sq5` (optional package R7-4.3, about 250 lines plus art, changes the Lobby layout and the golden once more) or two quests from the vendor (default); the arc boundaries and titles; whether the last arc pays at the verdict.

#### R7-4.1 CORE-R74: content, state, migration v4 to v5, bot (about 590 lines with tests)
- **Goal:** (1) `content/quests.js`: arcs `main`, `main2`, `main3` with `when` predicates, `mainIds`, `mainSteps`, `sq4`, `sq5`, text of the addendum (about 110 lines, 80 of them text); `config.quests` (`sideCount 5`, `arc`, `sq4`, `sq5`, `newXpShare`, `balanceLevel`, `saveVersion 5`). (2) `questview.js`: generic `mainDone`/`mainStep` (suffix-OR over ten steps), arc states incl. `unavailable`, `questView` and `nextStep` for arcs, `mapMarkers` for the active arc. (3) `systems/quests.js`: `changeMain` with arcs (one `quest.completed` per finished arc, one `quest.step` with `unlocked`), arc reward in the tap, pin helper and `questPin "main"` alias, `objCfg(id)` in `reduceSide`, `goalOf`, `itemFloorOf(seed, id)`, `placeQuestObjects` loop, `rewardOf` (per-quest `gearFloor`, `rarity`), `rewardSummary` for arcs and sq4/sq5; `cheats.js` (`setQuestStep(id, n)`, `completeQuest`, shared `changeMain`). (4) Save v5: `MIGRATIONS[4]`, `format.js` schema (keys, pinned domain, sq4/sq5 world-flag rules), `slots.js` (`qv`, `mainStep` 1..10, `upgradeIndex`). (5) Goldens: re-pin once, proof with the unchanged baselines, guard on floor 3, notes `docs/reviews/R7-4-core-notes.md`. (6) Bot: `QBOT.trips`, stash keeper stop, T2 from floor 6, `report.js` per arc, parity and time runs (24 seeds x 3 classes, quests on and off).
- **Steps (each can be a commit; the cut line is after step 4):** 1 content, config, views, golden re-pin (about 220 lines); 2 tap with arcs, rewards, pin, cheats (about 150); 3 per-quest objectives and rewards, `rewardSummary` (about 90); 4 save v5, schema, migration, index (about 110); 5 bot and report (about 80, with the parity run).
- **Depends:** FIX-R7-CORE handed back. **Parallel-ok with:** nothing in CORE (shared files); R7-4.2 may start after step 3.
- **ACs:** AC-R-257-1..4, 258-1 (Unit half), 258-2..5, 259-1..5 (Unit), 240-1, 241-2, 245-1, 256-1..3 as amended.
- **Files:** `src/core/content/quests.js`, `src/core/config.js`, `src/core/systems/quests.js`, `src/core/systems/questview.js`, `src/core/cheats.js`, `src/core/index.js`, `src/save/format.js`, `src/save/migrate.js`, `src/save/slots.js`, `bot/quests.js`, `bot/policy.js` (two call sites), `bot/report.js`, `test/quests-arcs.test.js` (new: AC-R-257-1..4), `test/quests-sq45.test.js` (new: 258-2..5), `test/save-v5.test.js` (new: 259-1, 259-2), `test/quests-hash.test.js`, `test/quests-bot.test.js`, `test/balance-gate.test.js`, `test/helpers.js` (v4 fixture builder), `test/fixtures/save-v4-{lobby,floor4,floor8-unlocked,boss-defeated,pinned-side}.json`, re-pinned `run-a.hash`, `run-class.json`, one-line version fixes in the tests that pin version 4, existing quest tests whose `sideCount 3`, `quests.main.steps` and `MAIN_STEPS 6` expectations change (`test/quests-model.test.js`, `quests-machine.test.js`, `quests-npc.test.js`, `quests-0-2-*.test.js`, `save-v4*.test.js`, `save-slots.test.js`).
- **Migrations:** yes (save 4 to 5; slot index `qv`, rebuilt once). Infra: no. **Risk:** medium: the reward paid inside the tap; bot time with trip T2 (window 20 to 40 minutes; fallbacks in the ADR); Consultant count on floors 5 and 6 (validity test); the schema must stay "exactly what play can produce"; the existing tests that count steps and quests.
- **Estimate:** M.

#### R7-4.2 UI-R74 and WORLD-R74: journal, dialogue, toast, slot card, markers (about 420 lines)
- **Goal:** (1) Journal (`ui/journal.js`): main quests in order (active first with blurb and next step, locked ones with the "Locked. Finish {previous} first." line and no next step, completed ones in the Completed list), five side quests, pin controls on active arcs and open side quests, "Read the verdict" on the last step of `main3`; reward text from `rewardSummary` (arcs and the two new quests). (2) NPC dialogue (`ui/questdialog.js`): every non-completed quest of the giver, in id order (the vendor can show two), each with its own Accept and Decline, progress line or Hand in; the stash keeper's window gains the quest section; trade, heal and stash unchanged. (3) Toast for `quest.step` with `unlocked` (text from the quest's unlock line) and for arc rewards (`quest.completed` with gold and xp), through the FIX-R7-UI toast queue; badge as before. (4) Slot card: "N/`sideCount`" with 5 and the title from `content.mainSteps`; the e2e fixture is a v4 slot. (5) WORLD: the stash keeper's NPC marker (the marker code is generic over NPC ids, verify), the ledger's ground entry look (mark, colour, plate), warm the Consultant frames while `sq5` is active, the map marker for any active arc target; no new sprite and no atlas change.
- **Depends:** R7-4.1 step 3 (and FIX-R7-UI). **Parallel-ok with:** R7-4.1 steps 4 and 5 (disjoint files). **Estimate:** M (UI about 300, WORLD about 120).
- **ACs:** AC-R-257-5, 258-1 (E2E half), 259-2 (card), 254-2 for the new toasts, 244-1 and 244-2 re-checked with ten steps and five side quests (phone layout, keyboard order, accessible names with the state as text).
- **Files:** `src/ui/journal.js`, `ui/questdialog.js`, `ui/panels.js`, `ui/slots.js`, `ui/text.js`, `game.js` (toast text), `style.css`, `src/render/questmark.js`, `render/fx.js`, `render/map.js`, `test/ui-quests.test.js`, `test/render-r7q.test.js`, `e2e/r7quest.mjs`, `e2e/r7journal.mjs` (extended, not new), `e2e/{s3ui,r5ui,ui}.mjs` only for expectations (slot card text).
- **Risk:** low-medium: the journal with up to 8 entries and a locked row on the phone; two quests of one giver in one dialogue (new). Visual review of the journal and the dialogue at 1x and on the phone viewport.
- **Cut line:** the map marker and the warm-set first; never the journal, the dialogue or the card.

#### R7-4.3 WORLD-R74N (optional, only if the customer asks for a sixth Lobby character)
- A new NPC in `npcs.js`, `strings.js`, `gen/town.js`, sprite and portrait, `sq5.giver` change, town and golden tests; about 250 lines plus art; one more golden re-pin. Not started without the customer's answer (QF-12-7).

### R7-3 Follow-ups from the R6 acceptance
- Hero falls back to an adjacent attacker when its target never arrives (FM seed 5, floor 1, ~1 min; joins R7-1).
- Customer (2026-10-14): spread the difficulty more evenly across the floors (no wall at floor 5); re-check with quest rewards in place. IT deaths median and FM Pallet Slam share: tune or accept.
- Size ceiling test, one-line ASSET-LICENCES.md, offline/engines e2e from the R6 plan (run or drop).
- Low visual items N9-N15 from docs/reviews/R6-visual-review.md.

### R7-2 Floor-entry stutter (from the R6 orchestrator bench)
- After entering a floor the frame time sits at 33-50 ms (20-30 fps) for about 3 s while 480-740 monster frames are drawn on first use (0.5-0.7 s of drawing spread by the per-floor warm-up). Hide it behind the elevator transition (warm before the floor is shown) or spread it thinner; gate: frame p99 after floor load <= 33 ms.

### R7-0 Quest journal and next steps (customer request, first item of R7)
- **Goal:** a journal (own key J, plus a button on the HUD and an entry in the pause menu) that lists active and completed quests and,
  for each active quest, the next concrete step ("Take the lift down.", "Reach floor 4. Visit the Lobby first: the staff may pay in gear.").
  The main goal (the memo, R-104) becomes six explicit main-quest steps; three NPC side quests (circle 3 answer: kill task, find an item,
  a named elite; the two gear quests are the pacing tools before floor 5). Quest state is part of the save (version 4, migration from 3).
- **Decisions:** `decisions/ADR-0007-quests.md` (data model, step machine, stateless quest stream, generator hooks, pouch, atomic hand-in,
  revisit of floors 3-4, golden re-pin with proof) and the ADR-0006 amendment "R7 quests" (save v4, slot index fields).
  Contract, names, owners, tests affected: `docs/reviews/R7-contract.md`. Spec: `30-spec/12-quests-journal.md` (39 ACs).
- **Order:** circle (done) -> spec ACs (done) -> ADR + contract (done) -> **CORE-R7Q** R7-0.1, then R7-0.2 and R7-0.3 (parallel-ok), then R7-0.4
  -> **UI-R7Q** R7-0.5, R7-0.6 and **WORLD-R7Q** R7-0.7 in parallel (start after R7-0.1..0.3) -> adversarial + review -> visual -> acceptance.
  Sequencing against the packages running now: CORE-R7Q starts after AI-R7 hands back (`intent.js`, `state.js`, `config.js`, `bot/policy.js`, the
  goldens overlap); WORLD-R7Q after STUTTER-R7 (`render/world.js`, `fx.js`, `keys.js`, bench overlap); UI-R7Q also waits for STUTTER-R7 if that
  package edits `game.js`, `main.js` or `ui/screens.js`.
- **Scope note (spec, circle 3 Q1):** if R7 is tight, drop in this order: side quest 1, the map marker, the NPC overhead markers. Never drop:
  journal, the six main steps, the two gear quests. The packages are cut so each of those is a separable piece of its package.

#### R7-0.1 CORE-Q1: quest data, state, step machine, events, hash proof
- **Goal:** `content.quests` (main quest with six steps, three side quests, working text), `config.quests`, `state.quests` and `player.pouch`, the pure reducer and the tap on `emit`, commands `questAccept/questPin/storyRead`, derived views (`nextStep`, `npcMarker`, `mapMarkers`, snapshot additions), `hashStateWithout`, the quest audio rows, and the one golden re-pin with its proof.
- **Depends:** AI-R7 handed back. **Parallel-ok with:** nothing in CORE-R7Q. **Estimate:** M (about 550 lines, about 140 of them text and data).
- **ACs:** AC-R-240-1/2 (state part), 241-1/2, 242-1, 245-1 (offer/accept/decline), 254-1, 255-1, 256-3.
- **Files:** `src/core/content/quests.js` (new), `config.js`, `state.js`, `events.js`, `systems/quests.js` (new), `systems/questview.js` (new), `systems/intent.js` (hook), `index.js`, `hash.js`, `src/audio/cues.js` (quest rows), `test/quests-model.test.js`, `quests-machine.test.js`, `quests-hash.test.js`, `test/hash.test.js`, `test/fixtures/run-a.pre-quests.hash`, `run-class.pre-quests.json`, re-pinned `run-a.hash`, `run-class.json`, `docs/reviews/R7-core-q-notes.md`.
- **Migrations:** none yet (save v4 is R7-0.3). Infra: no. **Risk:** medium: the tap in `emit` is on every event; the golden proof depends on the post-AI-R7 baseline.

#### R7-0.2 CORE-Q2: generator hooks, pouch, atomic hand-in, rewards
- **Goal:** `questRng`, `questSpot`, `placeQuestObjects` (called once from `enterFloor`), `makeMonster` options (`name`, `hpMult`, `quest`), the quest ground entry and its `takeGround` branch into the pouch, `questHandIn` with the dry-run bag check, reward gear (magic or rare, floor-4 item level, reroll for requirements) and potions, gold and xp.
- **Depends:** R7-0.1. **Parallel-ok with:** R7-0.3 (disjoint files). **Estimate:** M (about 450 lines).
- **ACs:** AC-R-245-1 (no side effects on trading, healing, stash), 246-1..5, 247-1..3, 250-1, 240-2 (placement part).
- **Files:** `src/core/systems/quests.js`, `systems/world.js` (one call), `systems/loot.js`, `state.js` (`makeMonster`), `config.js`, `test/quests-gen.test.js` (100 seeds, incl. `fallbackFloor`), `quests-rewards.test.js`, `quests-npc.test.js`.
- **Risk:** medium: ground entries without `item` meet seven readers (contract 4.4); the champion elite must be beatable (balance gate).

#### R7-0.3 CORE-Q3: save version 4, migration, slot index, cheats, fixtures
- **Goal:** `saveVersion` 4, `quests` in `SAVE_KEYS` with the schema invariants, `toSave`/`loadSave` (quests set before the resume `enterFloor`), `MIGRATIONS[3]` (main step from milestones read off the v3 save, no retroactive reward), slot index fields `mainStep/mainDone/sidesDone` and `upgradeIndex` (inside `migrateLegacy`), `cheats.js` (`setQuestStep`, `completeQuest`), the helper that builds five legal v3 fixtures.
- **Depends:** R7-0.1. **Parallel-ok with:** R7-0.2. **Estimate:** M (about 480 lines).
- **ACs:** AC-R-251-1/2, 252-1 (data), 253-1/2 (core half), 256-1 (cheat functions).
- **Files:** `src/save/format.js`, `migrate.js`, `slots.js`, `session.js`, `src/core/cheats.js`, `src/core/config.js`, `test/save-v4.test.js`, `save-v4-migrate.test.js`, `test/save-slots.test.js`, `test/helpers.js`, `test/fixtures/save-v3-{lobby,floor1,floor4,boss-unlocked,boss-defeated}.json`; one-line fixes `test/save-v3.test.js`, `test/adv-r6-fix.test.js:191`.
- **Migrations:** yes (save 3 to 4; slot index fields; index rebuilt once). **Risk:** medium: every save path; legal fixtures (L-038).

#### R7-0.4 CORE-Q4: bot quest paths
- **Goal:** `bot/quests.js` (talk to the three givers and accept before the first descent, climb from the cleared floor 4 to the Lobby, hand in, retry after selling on `bagFull`), call sites in `policy.js`, report counters, parity and balance runs with quests.
- **Depends:** R7-0.2 (and AI-R7's watchdog fix). **Parallel-ok with:** R7-0.5..0.7 (disjoint: `bot/**`). **Estimate:** S-M (about 300 lines).
- **ACs:** AC-R-256-2, AC-R-241-2 (bot shows steps 1..6 in order), 246-3 (pouch pickup path), 247-3.
- **Files:** `bot/quests.js` (new), `bot/policy.js`, `bot/report.js`, `bot/run-headless.mjs`, `test/quests-bot.test.js`, `test/bot*.test.js`, `test/balance-gate.test.js`.
- **Risk:** medium: time to boss within 20-40 minutes with the extra climb; elite fight per class.

#### R7-0.5 UI-Q1: journal, key J, dock button, pause entry, tracker, hook
- **Goal:** journal panel (desktop side drawer, phone full screen) with main quest first, active side quests, next step, progress, pouch list, pin controls, completed list, "Read the verdict" on step 6; key J (remappable, in Options), dock button with badge, pause-menu entry, one-line tracker, `__app.quests` hook, `dismissStory` sending `storyRead start`, story overlay for the victory text.
- **Depends:** R7-0.1..0.3. **Parallel-ok with:** R7-0.7. **Estimate:** M (about 550 lines).
- **ACs:** AC-R-242-1 (shown text), 243-1/2/3, 244-1/2, 248-1/2, 256-1.
- **Files:** `src/ui/journal.js` (new), `ui/panels.js`, `ui/screens.js`, `ui/text.js`, `ui/options.js`, `input/keymap.js`, `input/keys.js`, `game.js`, `main.js`, `testhook/index.js`, `style.css`, `test/ui-quests.test.js`, `test/ui-keymap.test.js`, `test/ui-options.test.js`, `e2e/hook.mjs`, `e2e/adv-r6.mjs:686` (one line).
- **Risk:** medium: phone layout and keyboard order; the drawer is shared with character and skills.

#### R7-0.6 UI-Q2: NPC dialogue, toasts, badge, slot card, accessibility
- **Goal:** quest section in the NPC dialogue (offer text, reward list, Accept/Decline, progress line, Hand in, bag-full notice, normal trade/heal/stash unchanged), toasts for `quest.*` (title and next step, `toastMs`), badge until opened, slot card line (step title and "N/3"), reduced motion, accessible names (state as text), `e2e/r7quest.mjs` and the expectation fixes of the contract.
- **Depends:** R7-0.5. **Parallel-ok with:** R7-0.7. **Estimate:** M (about 450 lines).
- **ACs:** AC-R-247-4, 249-2, 251-3, 252-1, 253-1/2, 254-2/3.
- **Files:** `src/ui/panels.js`, `ui/messages.js`, `ui/slots.js`, `ui/text.js`, `game.js`, `style.css`, `e2e/r7quest.mjs` (new), `e2e/{s3ui,r5ui,ui}.mjs`, `e2e/run-all.mjs` (one line).
- **Risk:** medium: e2e fixture (legal v3 save in slot 2) and real-time toast timing.

#### R7-0.7 WORLD-Q1: NPC markers, map marker, quest item and elite look
- **Goal:** two procedural marker shapes over the NPCs (`available`, `handin`; not colour only; static under reduced motion) and `perf().npcMarkers`, the map marker with label from `mapMarkers`, the quest ground entry (mark, colour, plate), the named elite's nameplate, the elite's type warmed while `sq3` is active.
- **Depends:** R7-0.1..0.3 and STUTTER-R7. **Parallel-ok with:** R7-0.5, R7-0.6. **Estimate:** S-M (about 350 lines).
- **ACs:** AC-R-249-1, 248-3 (drawing), 246-3 (item visible), look of the elite (`verify: playtest/visual review`).
- **Files:** `src/render/world.js`, `render/fx.js`, `render/map.js`, `test/render-r7q.test.js`, `docs/shots/r7q-*`.
- **Risk:** low-medium: no new atlas sprites (atlas budget), no per-frame allocation (STUTTER-R7 gate).
- **Cut line:** this is the package that goes first if R7 is tight (markers, then the map marker; the quest ground entry stays).

## Round R8: added item from the seventh briefing (2026-10-14)

### R8-1 Follow-ups from the R7 acceptance (docs/reviews/R7-acceptance.md)
- R8-Q1 (high) bag-full blocks quest gear rewards: reward to the pouch/ground or sell junk from the dialogue.
- R8-B1 (high) the first floor-1 pack kills level-1 heroes in ~20 s: shrink/split it, check the first 90 s per class.
- R8-B2 (medium) death spiral at the lift entry (awake monsters near the entry after respawn).
- R8-B3 (medium) first potions: price vs 50 start gold; bought potions go to the belt.
- R8-AI1 (medium) deterministic re-click test in a crowd (adjacent attacker hit within 1.5 s).
- R8-Q2/Q3 (low) close the inventory with the NPC window; second hand-in toast wording.
- R8-T1 (from late-R7 review, UI): CR7L-01 rewards gainXp before quest.completed → level-up/floor lines lost in the same dispatch, screen reader hears only the last; CR7L-02 direct toast clears the whole waiting list; CR7L-03 fx.plateDraw not cleared → stale nameplates over the title backdrop. Goes into R8-0.3 UI.
- R8-P1 (watch): BENCH_GEAR=1 scene fps50 median 47.1 on a quiet machine (42.1/51.8/47.1), just under the 48 target; plain 53.3. Profile in R8-T.
- R8-V2 (from R8 visual review, for R8-T polish): G-1 magic vs normal indistinct in greyscale (hue-free highlight line), G-2 unique blazer reads as a box/shield, G-3 IT wrist braces, G-4 SR cap back, G-5 cheat unique silently gives rare, U-1 phone map title vs Map button, U-2 toast over tooltip, U-4 bust crop hides boots, U-5 phone Map button.
- R8-V1 (low) N16 phone map title covered by the dock buttons; N17 elite same size as a manager; N12 tree left gutter.
- R8-M1 (low, from R7 visual G4) core mapMarkers lists the quest elite and the badge tile once seen; render already draws them.

### R8-0 Hero visuals follow equipped gear (customer request, first item of R8)
- **Goal:** the hero's figure shows what is equipped in the visible slots (head, body, hands, feet, weapon, off-hand), for all
  three classes, all facings and animations, in game, on the character sheet and on the character select and slot busts.
  Rarity reads through colour or trim (Okabe-Ito palette); uniques get a distinct accent.
- **Approach (architect decides in an ADR before work):** layered vector parts drawn per item *base category* (not per item),
  composited at runtime or cached per equipment combination. **Risk:** the sprite atlas build is already 4.78 s of a 5 s
  budget (ADR-0004); pre-baking every combination is not affordable, so the ADR must include an atlas/cache budget.
- **Order:** architect ADR + data contract (which item field picks the visual) → WORLD (parts, compositing, cache) with
  CORE only if a field is missing → UI (sheet/select/busts) → visual review with 1x crops per slot and class → adversarial
  (every slot × class × facing renders without errors, perf with 50 monsters) → acceptance.

#### R8-0 work packages (ADR-0008, spec `30-spec/13-gear-visuals.md`, 14 ACs R-260..R-262)
- **Order:** R8-0.1 (core of the render path, with stub part painters) -> R8-0.2 and R8-0.3 in parallel (disjoint files) -> visual review (1x crops per slot and class) -> adversarial (21 categories x 3 classes x 8 facings, 50 monsters) -> acceptance. **CORE-R8-1** (bag-full rewards, first pack, entry safety, potions) runs in parallel in `src/core/**` and `bot/**`: no overlap (gear visuals only read `state.equipment`, nothing under `src/core` changes, goldens untouched). Watch only `main.js` (one line in R8-0.3) and `testhook/index.js` (read-only `perf()` fields in R8-0.1); the owners of those files merge in order.

#### R8-0.1 WORLD-G1: render core: signature, parts API, cache, budget test
- **Goal:** `gearlooks.js` (categories, `LOOK_BY_BASE`, `gearSignature`, default-per-slot fallback), the hook points in `heroes.js` (`gearHook` calls at legs/feet/torso/head/hands/weapon/offhand; no hooks = unchanged pixels), stub part painters (a labelled block per slot) so the pipeline works end to end, the per-atlas signature cache (lazy build with `figureWithRim`, LRU by bytes with the 32 MB cap and the 120-frame rule), reference compare of the six slots once a frame, `warmGear` (0.7 ms, idle and walk first, 240-frame pause after floor changes, unbudgeted at game start), `perf().gearCache/gearSig`, `drawFigure(..., {look})` and `figureHost` `look`, bench with a geared hero, error isolation per painter.
- **Depends:** none (STUTTER-R7 and R7 quest packages are merged). **Parallel-ok with:** CORE-R8-1; R8-0.2 starts once the hook signature is merged. **Estimate:** M (about 500 lines).
- **ACs:** AC-R-260-1, 260-3, 260-5, 262-1, 262-2, 262-3, 262-4, 262-5.
- **Files (owner WORLD):** `src/render/gearlooks.js` (new), `src/render/gearparts.js` (new, stub painters + `trim` helper), `src/render/styles/vector/heroes.js` (hook calls), `src/render/styles/vector/characters.js` (pass-through of the gear argument in `drawFigure`), `src/render/figure.js`, `src/render/world.js` (reference compare, table swap, `warmGear` in `warmFrames`), `src/render/keys.js` (only if a helper key is needed), `src/ui/figureHost.js` (one field), `src/testhook/index.js` (read-only fields), `bench/bench.mjs`, `test/render-r8-gear.test.js` (new), `e2e/render.mjs` (assertions).
- **Risk:** medium: pixel equality of the empty look (hook placement must not change draw order); rim bake for a new offscreen canvas per entry; memory at scale 2.

#### R8-0.2 WORLD-G2: part art for all categories x classes
- **Goal:** the 21 real part painters (`(g, slot, category, tier, anchors)`), the `trim` rarity helper (plain, single blue edge, double yellow edge + studs, vermillion edge + accent mark), per-class anchor tuning for FM, SR, IT, correct layering for all 8 facings and death/cast poses, 1x crop contact sheet `docs/shots/r8-gear-*` (one per slot and class, four tiers) for the visual reviewer.
- **Depends:** R8-0.1. **Parallel-ok with:** R8-0.3, CORE-R8-1. **Estimate:** M-L (about 600 lines; split by slot pairs if over: weapon+offhand / head+body+hands+feet).
- **ACs:** AC-R-260-2, 261-1, 261-2, 261-3 (visual).
- **Files (owner WORLD):** `src/render/gearparts.js` (replaces the stubs; if it passes 450 lines split into `gearparts-weapons.js` and `gearparts-armour.js`), `src/render/styles/vector/palette.js` (trim tokens only), `test/render-r8-parts.test.js` (new), `e2e/art-sheet.mjs` (gear sheet), `docs/shots/r8-gear-*`.
- **Risk:** medium: 21 painters must stay distinct at 1x (~60 px hero); two-handed poses; hard-hat/headset over the class hair and glasses.

#### R8-0.3 UI-G1: Employee File, character select, slot busts
- **Goal:** `paintBust(canvas, classId, look)` with the per-look bust cache (LRU 8), Employee File bust repainted on equipment change, slot index field `look` (written at save from the saved `equipment`, validated by regex, optional so old entries show the bare bust), slot cards and the slot manager use it, class cards show the starting kit if worn at start, reduced motion unchanged (portrait is static), accessible name of the bust mentions the main worn items (text alternative).
- **Depends:** R8-0.1 (`look` option and `gearSignature`). **Parallel-ok with:** R8-0.2, CORE-R8-1. **Estimate:** S-M (about 350 lines).
- **ACs:** AC-R-260-4, 260-6.
- **Files (owner UI):** `src/ui/slots.js`, `src/ui/panels.js` (bust canvas call only), `src/ui/charselect.js`, `src/ui/figureHost.js` (wired by R8-0.1; this package only consumes), `src/main.js` (pass `look` into `provideFigures`), `src/save/slots.js` (the `look` field; index only, no save version bump, no state change; ADR-0006 gets a one-line amendment), `src/core/index.js` is NOT touched (the signature function is imported by `save/slots.js` from the render-free `src/render/gearlooks.js`, which has no DOM or canvas dependency), `test/ui-gear.test.js` (new), `e2e/r8gear.mjs` (new), `e2e/run-all.mjs` (one line), `style.css` (bust sizing only if needed).
- **Risk:** low-medium: `src/save/slots.js` is not in `src/core`, but the index code path is shared with the R7 quest fields (`qv`); layering N5 (save importing a render file is allowed only for the pure `gearlooks.js`; if the layering test objects, move `gearSignature` and the tables to `src/core/content/gearlooks.js`, which is a one-file core addition, then re-check overlap with CORE-R8-1).

## Round R8-T: end-to-end testing and polish (seventh briefing, after R8, before the lighting rounds R9–R10)
- **Goal:** a full end-to-end pass over everything built so far: no-cheat full runs per class to the boss in a real browser,
  save/load across all features (quests, gear visuals, slots), keyboard-only and phone layouts, offline/file:// smoke
  (incl. write-then-immediate-reload), size, legal and denylist scans, then one polish fix round from the findings.
- **Agents:** test-engineer (adversarial, new e2e journeys), reviewer, visual-reviewer, customer-proxy acceptance, retro.

## Scope change 2026-10-14 (customer)
R9–R10 (lighting) and R12 (second overall test and polish) are dropped. Order now: R7 (rest) → R8 → R8-T → R11 → end-of-project task.
