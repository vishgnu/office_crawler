# 10 Tech and testability

Areas: K Tech (R-110..R-113), L Testability (R-120..R-123), NFR performance/browsers/offline/legal/security/reliability.
Date: 2026-10-13. Status: draft for architect. Inputs: `20-requirements.md`, `40-nfr.md`, circle-01 answers (PROXY, provisional).

## Test contract used by every spec file

All ACs are written against two test surfaces. Names below are the **proposed contract**; the architect may rename
them in the ADR, but each name must keep its meaning, and the specs are then updated mechanically.

**Unit surface (Node, no DOM, no rendering).** Pure functions, state in, state out:
`createRng(seed)`, `newGame(seed, opts)`, `step(state, inputs)` returning a new state (one fixed tick),
`generateFloor(seed, depth)`, `findPath(grid, from, to)`, `rollItem(rng, ctx)`, `renderSfx(id, sampleRate)`,
`renderAmbient(zone, seed, seconds, sampleRate)`, plus data registries (`content.monsters`, `content.skills`,
`content.items`, `content.strings`) and a `config` object holding every balance constant.
ACs that need a number the requirements do not fix refer to a `config.*` constant. The AC then asserts the relation
(for example "gains exactly `config.xp.perKill[type]`"), so balance can change without editing the spec.

**E2E surface (Playwright, real browser).** A page opened with `?test=1` (and optionally `?seed=<int>`) exposes
`window.__app`:

| Member | Meaning |
|---|---|
| `getState()` | JSON-serialisable snapshot (shape below) |
| `newGame({seed, class})` | start a run from the title screen state |
| `step(n)` | advance exactly n fixed ticks (rendering may be skipped) and return the snapshot |
| `click({tile:{x,y}} or {screen:{x,y}}, {button:0 or 2, hold:false})` | simulate a mouse click at tile or screen coordinates |
| `key(code, 'press' or 'down' or 'up')` | simulate a key |
| `cmd.moveTo(tile)`, `cmd.attack(monsterId)`, `cmd.use(itemId)` | agent commands (R-121); each returns `{ok, error?}` |
| `cheat.*` | `spawnItem(spec)`, `spawnMonster(type,tile)`, `setLevel(n)`, `setHp(n)`, `giveGold(n)`, `teleportFloor(depth)`, `throwInTick()` (R-123) |
| `save.write()`, `save.read()`, `save.export()`, `save.import(text)` | save helpers |
| `audio.getState()` | `{ctxState, master, sfx, ambient, muted, effectiveGain, cueLog[]}` read from the real gain nodes |
| `perf()` | frame-time samples and sim step cost |
| `describe()` | list of the members above (the documented API) |

**Snapshot shape (fields the ACs read).**
`tick`, `seed`, `scene` (`title|town|floor|dead|victory|error`), `paused`, `depth` (0 = town), `deepestDepth`,
`bossDefeated`, `config{tickHz, ...}`,
`player{tile, pos, hp, hpMax, mp, mpMax, level, xp, xpNext, attrs{grit,agility,stamina,focus}, attrPoints, skillPoints,
gold, damage{min,max}, defense, resist{}, action(idle|move|attack|hit|dead), target, path[], skills{id:level},
skillBar{primary,secondary,hotkeys[]}, class}`,
`monsters[{id,type,behaviour,tier(normal|champion|boss),tile,hp,hpMax,level,ai(idle|notice|chase|attack|flee|dead),packId,phase}]`,
`projectiles[]`, `groundItems[{id,tile,item|gold,label}]`, `containers[]`, `floors` (per-floor seed and cleared flags),
`floor{depth,seed,theme,w,h,tiles,entry,exit,rooms[{kind}],explored}`,
`inventory{w:10,h:4,items[{id,x,y,w,h,item}]}`, `cursorItem`, `equipment{head,body,hands,feet,belt,weapon,offhand,ring1,ring2,amulet}`,
`belt[4]`, `stash`, `vendors`, `events[]` (this tick's events: `hit`, `miss`, `kill`, `levelup`, `pickup`, `noMana`, `noPath`, `inventoryFull`, ...),
`floaters[]`, `ui{panels{character,inventory,skills,map}, hud{...}, menu, tooltip, notice, dialog}`, `options{keys, volume...}`.

Item shape: `{id, base, type, slot, rarity(normal|magic|rare|unique), name, ilvl, affixes[{id,kind(prefix|suffix),stat,value,range[lo,hi],minIlvl,types[]}], reqs{level,grit,agility,stamina,focus}, size{w,h}, value}`.

Slices: S1 playable core, S2 loot and progression, S3 sound and finale. A criterion tagged S2 may modify what an S1 criterion
asserted; the later tag then supersedes it (stated in the text where it happens).

---

### R-110 Runs in current desktop browsers without install (must · MVP)

- **AC-R-110-1** `S1` `E2E` — Given the production build served statically, When the page is opened in Playwright Chromium, Firefox and WebKit (stand-ins for Chrome/Edge, Firefox, Safari; NFR-B01), Then within 5 s `getState().scene === 'title'`, there is no uncaught page error and no `console.error`.
- **AC-R-110-2** `S1` `E2E` — Given any of the three engines, When `newGame({seed:1})` then `step(60)`, Then `tick === 60` and `scene === 'floor'` (S1) in all three.
- **AC-R-110-3** `S1` `E2E` — Given the page is loaded, When the document is inspected, Then it contains no `<object>`, `<embed>`, `<applet>` and no script or request with a plug-in media type (no plug-ins).

### R-111 Static, single self-contained build (should · MVP)

- **AC-R-111-1** `S3` `E2E` — Given the build output opened via `file://` (no server), When the page loads, Then `scene === 'title'` and `newGame({seed:1}); step(30)` gives `tick === 30`.
- **AC-R-111-2** `S3` `Unit` — Given the build output directory, When it is listed, Then it contains one entry HTML file and its total size is at most 10 MB (NFR-P02 ceiling).

### R-112 Render with HTML5 canvas 2D, no plug-ins (must · MVP)

- **AC-R-112-1** `S1` `E2E` — Given a running game, When the main `<canvas>` is queried, Then `canvas.getContext('2d')` is non-null and the canvas is the element that receives the game's mouse events.
- **AC-R-112-2** `S1` `E2E` — Given `newGame({seed:1})` and `step(30)`, When a screenshot of the canvas is taken, Then it contains at least 16 distinct colours and is not a single flat colour (the game really draws).
- **AC-R-112-3** `S1` `E2E` — Given viewport sizes 1280x720, 1920x1080 and 3840x2160 (NFR-B02), When the page loads, Then the canvas fills the viewport (width within 1 px of `innerWidth`) and for each of 5 sample tiles, clicking the screen centre of that tile (from `tileToScreen`) sets `player.target`/path to that tile (screen/tile mapping round-trips).

### R-113 Fixed-timestep simulation separate from rendering (must · MVP)

- **AC-R-113-1** `S1` `Unit` — Given the loop accumulator function and a total elapsed time T ms, When frame deltas are fed as `[16,17,33,100,5,...]` in two different chunkings with the same sum, Then both yield `floor(T / (1000/config.tickHz))` ticks and the final states are deep-equal.
- **AC-R-113-2** `S1` `Unit` — Given the simulation module loaded in Node with `window`, `document` and `AudioContext` undefined, When `newGame(1)` and `step` is called 100 times, Then no exception is thrown and `tick === 100`.
- **AC-R-113-3** `S1` `E2E` — Given the game is running at a throttled render rate (CDP CPU throttling x4), When `step(300)` is called, Then `tick` advances by exactly 300 and the state hash equals the unthrottled run (simulation independent of frame rate).

### R-120 Deterministic seed mode (must · MVP)

- **AC-R-120-1** `S1` `E2E` — Given `?test=1&seed=12345`, When the game starts, Then `getState().seed === 12345`, and a second page load with the same URL gives a deep-equal `floor.tiles` and `monsters` list.
- **AC-R-120-2** `S1` `Unit` — Given seed S and a scripted input list of at least 500 ticks with moves, attacks and clicks (fixture `fixtures/run-a.json`), When it is run twice, Then the final state hashes are identical.
- **AC-R-120-3** `S1` `Unit` — Given two different seeds, When `generateFloor(seed, 1)` is hashed, Then the layout hashes differ.
- **AC-R-120-4** `S1` `Unit` — Given `createRng(42)`, When 5 values are drawn, Then they equal the golden values stored in `fixtures/rng-42.json` (recorded once from the first implementation, then frozen).
- **AC-R-120-5** `S2` `Unit` — Given the same seed and inputs, When loot is rolled for 200 kills, Then the list of dropped items (base, rarity, affix ids and values) is identical across two runs.

### R-121 Automation hook for agents (must · MVP)

- **AC-R-121-1** `S1` `E2E` — Given `?test=1`, When `window.__app.describe()` is called, Then it lists exactly the documented members, and every listed function exists.
- **AC-R-121-2** `S1` `E2E` — Given a running game, When `getState()` is called, Then `JSON.parse(JSON.stringify(s))` deep-equals `s` (serialisable, no functions or cycles).
- **AC-R-121-3** `S1` `E2E` — Given `tick === t`, When `step(n)` is called for n in {1, 10, 250}, Then `tick === t + n` after each call.
- **AC-R-121-4** `S1` `E2E` — Given a reachable tile T, When `cmd.moveTo(T)` is used in one run and `click({tile:T})` in another run with the same seed, Then after `step(100)` both state hashes are equal.
- **AC-R-121-5** `S1` `E2E` — Given a living monster M in sight, When `cmd.attack(M.id)` then `step(200)`, Then `M.hp` is lower than before or M is dead.
- **AC-R-121-6** `S2` `E2E` — Given a potion in the belt, When `cmd.use(item.id)` is called, Then the potion effect applies as in AC-R-056-1.
- **AC-R-121-7** `S1` `E2E` — Given invalid arguments (`cmd.moveTo({x:-5,y:-5})`, `cmd.attack('nope')`), When called, Then each returns `{ok:false, error:<non-empty string>}`, throws nothing, and the state hash is unchanged.

### R-122 Headless simulation mode (should · MVP)

- **AC-R-122-1** `S1` `Unit` — Given seed 1 and the fixture `run-a.json`, When it is run in Node (no browser), Then the final state hash equals the hash from the browser run of the same fixture (also AC-NFR-Q01-2).
- **AC-R-122-2** `S1` `Unit` — Given `newGame(1)`, When 10,000 ticks are stepped in Node with idle input, Then it completes in under 10 s on the CI runner (see QF-10-3).

### R-123 Debug cheats only in test mode (should · MVP)

- **AC-R-123-1** `S1` `E2E` — Given the page opened without `?test=1`, When `window.__app` is read, Then it is `undefined` (also AC-NFR-S01-1).
- **AC-R-123-2** `S1` `E2E` — Given `?test=1`, When `cheat.spawnMonster('<registry type>', tile)` is called on a free floor tile, Then `monsters` contains one more entry with that type at that tile.
- **AC-R-123-3** `S2` `E2E` — Given `?test=1`, When `cheat.spawnItem({base, rarity:'rare', ilvl:10})` is called, Then the inventory (or ground if full) contains an item with that base and rarity.
- **AC-R-123-4** `S2` `E2E` — Given `?test=1`, When `cheat.setLevel(10)` is called, Then `player.level === 10`, `player.hpMax` and `player.mpMax` equal the derived-stat formula output for level 10 with unchanged attributes (AC-R-012-1), and `xp` equals the XP threshold of level 10.
- **AC-R-123-5** `S2` `E2E` — Given `?test=1`, When `cheat.teleportFloor(5)` is called, Then `depth === 5`, `player.tile` equals `floor.entry`, `floor.theme` is the basement theme.

---

## Non-functional criteria that live here

### NFR-P01 Frame rate (must)

- **AC-NFR-P01-1** `S2` `E2E` — Given a floor with 50 active monsters in view (`cheat.spawnMonster` x50, seed fixed) on the CI reference runner, When `perf()` samples 600 frames, Then the 95th-percentile frame time is at most 33.3 ms (never below 30 fps) and the mean is at most 16.7 ms (see QF-10-1 for the reference hardware).
- **AC-NFR-P01-2** `S2` `Unit` — Given 50 active monsters chasing the player, When 1,000 ticks are stepped, Then the mean sim time per tick is at most 4 ms (a quarter of the 16.7 ms budget; value is the spec-writer's proposal, QF-10-1).

### NFR-B01 / NFR-B02 / NFR-B03 Browsers, screen size, no account (must)

- **AC-NFR-B01-1** `S1` `E2E` — Covered by AC-R-110-1 and AC-R-110-2 (three engines).
- **AC-NFR-B02-1** `S1` `E2E` — Covered by AC-R-112-3 (1280x720 to 4K).
- **AC-NFR-B03-1** `S1` `E2E` — Given a cold load and 60 s of play, When the page DOM is scanned, Then there is no input of type `password`/`email`, no element or text containing "log in"/"sign in"/"account", and the game reaches `scene === 'floor'` with no network request other than the page's own files (see AC-NFR-O02-1).

### NFR-O01 Works offline (should) and NFR-O02 No telemetry (must)

- **AC-NFR-O01-1** `S3` `E2E` — Given the page is fully loaded, When the browser context is set offline and `newGame`, `step(300)` and a save are performed, Then all succeed and `tick === 300`.
- **AC-NFR-O02-1** `S1` `E2E` — Given request interception on the context, When the game is loaded and played for 60 s (clicks, fighting), Then every request URL is same-origin (or `file://`) and no `sendBeacon`, `WebSocket` or `fetch` to another origin occurs; from S3 on, also during save/load.

### NFR-S01 Static content only; test hooks off in normal play (should)

- **AC-NFR-S01-1** `S1` `E2E` — Given the page without `?test=1`, When `window.__app` is read, Then it is `undefined`; with `?test=1` it is defined.
- **AC-NFR-S01-2** `S1` `Unit` — Given the build output, When searched, Then it contains no server-side source (no `*.php`, `*.py`, server entry file) and the HTML sets a Content-Security-Policy meta tag (where hosting does not set a header).

### NFR-Q01 Determinism (must) and NFR-Q02 No crash on invalid state (should)

- **AC-NFR-Q01-1** `S1` `E2E` — Given the fixture `run-a.json` and seed 1, When run twice in the same browser engine, Then the final state hashes are equal.
- **AC-NFR-Q01-2** `S1` `E2E` — Given the same fixture and seed, When run in Chromium, Firefox, WebKit and in Node (Unit), Then all four hashes are equal to the golden hash in `fixtures/run-a.hash` (rendering excluded).
- **AC-NFR-Q02-1** `S3` `E2E` — Given `?test=1`, When `cheat.throwInTick()` makes the next tick throw, Then `scene === 'error'`, an error screen is visible with a visible "export save" action, the page does not white-screen, and `save.export()` still returns the last save text.

### NFR-L01..L05 Legal and IP guardrails (must)

Denylists are supplied as data files and are not written in this spec (QF-10-2): `docs/product/denylist-original-terms.txt` (names and trademarks of the original) and `docs/product/denylist-real-brands.txt` (real brands, companies, people).

- **AC-NFR-L01-1** `S1` `Unit` — Given the repository, When all string literals in `content.strings`, all registry names and all source file names are scanned case-insensitively, Then none contains a term from the original-terms denylist.
- **AC-NFR-L01-2** `S1` `Unit` — Given the build output, When every non-code file (images, audio, fonts) is listed, Then each is either absent (MVP default: nothing but code) or listed in `ASSET-LICENCES.md` with source and licence CC0 or equivalent.
- **AC-NFR-L01-3** `S3` `E2E` — Given 60 s of play including audio, When network requests are recorded, Then there is no request for an audio, image or font file (all assets are generated in code).
- **AC-NFR-L03-1** `S1` `E2E` — Given the title screen, When `document.title` and all visible title-screen text are read, Then none contains an original-terms denylist term (default A of Q1: strict originality, provisional), and no text claims endorsement or an "inspired by" reference to a named game.
- **AC-NFR-L04-1** `S1` `Unit` — Given the dependency manifest and lockfile, When every runtime and build dependency's licence field is read, Then each is MIT, BSD-2/3-Clause, Apache-2.0 or ISC, and the shipped licence list (`THIRD-PARTY-LICENSES`) names each runtime dependency.
- **AC-NFR-L05-1** `S1` `Unit` — Given all strings and registry names, When scanned against the real-brands denylist, Then there is no match.

---

## Not covered by an AC here

- R-110 beyond the three-engine smoke: Safari "latest two versions" and Windows/macOS/Linux matrix cannot be proven by Playwright on one CI image (QF-10-4).
- NFR-L02 (mechanics are free to follow the genre) is a position statement, not testable.
- NFR-P02 (load time 5 s / 10 MB) partly: only the size ceiling (AC-R-111-2); cold-cache timing is environment-bound (QF-10-1). NFR-P03, P04, P05 are "should" and not specified here (QF-10-1); AC-R-042-4 covers generation time.
- NFR-D (save data) are in `09-save-load.md`; NFR-A (accessibility) are in `07-hud-and-ui.md` and `01-core-loop-and-controls.md`.
- R-007, R-018 and other LATER items.

## Questions for the facilitator

- **QF-10-1** Performance numbers (NFR-P01..P05) are ASSUMED and bound to a "mid-range laptop". CI cannot reproduce it. May the ACs use a named CI runner as reference, with the 95th-percentile 33.3 ms bound, and the 4 ms sim-step budget proposed here? Until answered, AC-NFR-P01-1/2 are provisional.
- **QF-10-2** Who supplies the two denylists (original-terms, real-brands)? The spec writer must not author the original's trademarks into the repo. Proposal: the customer-proxy or legal supplies them; until then AC-NFR-L01-1/L03-1/L05-1 run against an empty list and are not meaningful.
- **QF-10-3** R-122 says "fast" without a number. The 10,000 ticks in 10 s bound is a proposal.
- **QF-10-4** Is "latest two stable versions on Windows, macOS, Linux" to be verified by CI (Playwright engines only) or by manual release checks?
- **QF-10-5** The test-mode flag `?test=1` is a proposal; NFR-S01 asks for "a documented flag". Architect to confirm in the ADR.

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-110 Runs in current desktop browsers without install (must · MVP) | R-110-1, R-110-2, R-110-3 | S1 | E2E |
| R-111 Static, single self-contained build (should · MVP) | R-111-1, R-111-2 | S3 | E2E, Unit |
| R-112 Render with HTML5 canvas 2D, no plug-ins (must · MVP) | R-112-1, R-112-2, R-112-3 | S1 | E2E |
| R-113 Fixed-timestep simulation separate from rendering (must · MVP) | R-113-1, R-113-2, R-113-3 | S1 | E2E, Unit |
| R-120 Deterministic seed mode (must · MVP) | R-120-1, R-120-2, R-120-3, R-120-4, R-120-5 | S1, S2 | E2E, Unit |
| R-121 Automation hook for agents (must · MVP) | R-121-1, R-121-2, R-121-3, R-121-4, R-121-5, R-121-6, R-121-7 | S1, S2 | E2E |
| R-122 Headless simulation mode (should · MVP) | R-122-1, R-122-2 | S1 | Unit |
| R-123 Debug cheats only in test mode (should · MVP) | R-123-1, R-123-2, R-123-3, R-123-4, R-123-5 | S1, S2 | E2E |
| NFR-P01 Frame rate (must) | NFR-P01-1, NFR-P01-2 | S2 | E2E, Unit |
| NFR-B01 / NFR-B02 / NFR-B03 Browsers, screen size, no account (must) | NFR-B01-1 | S1 | E2E |
| NFR-O01 Works offline (should) | NFR-O01-1 | S3 | E2E |
| NFR-S01 Static content only; test hooks off in normal play (should) | NFR-S01-1, NFR-S01-2 | S1 | E2E, Unit |
| NFR-Q01 Determinism (must) | NFR-Q01-1, NFR-Q01-2 | S1 | E2E |
| NFR-L01 ..L05 Legal and IP guardrails (must) | NFR-L01-1, NFR-L01-2, NFR-L01-3 | S1, S3 | E2E, Unit |
| NFR-B02   | NFR-B02-1 | S1 | E2E |
| NFR-B03   | NFR-B03-1 | S1 | E2E |
| NFR-O02   | NFR-O02-1 | S1 | E2E |
| NFR-Q02   | NFR-Q02-1 | S3 | E2E |
| NFR-L03   | NFR-L03-1 | S1 | E2E |
| NFR-L04   | NFR-L04-1 | S1 | Unit |
| NFR-L05   | NFR-L05-1 | S1 | Unit |

Total ACs in this file: 48 (S1 36, S2 7, S3 5).
