# S3-2 Audio: implementation and wiring notes

Package AUDIO (S3-2). Decision: `docs/product/variants/sound-direction/decision.md` (all three kits behind one interface, provisional default C foley-synth, soft lobby bed on the title screen after the first gesture, separate cues).

## What is there

| File | Role |
|---|---|
| `src/audio/kits/{gothic,chiptune,foley}.js` | The three `createSoundKit(ctx, destination, {seed})` sections lifted from A.html / B.html / C.html. Sound unchanged (same code, same trim tables). `common.js` holds the shared bus / noise / ambient runner (identical in the three prototypes) via `bindKit(KIT_TRIM)`. The only addition is an optional third argument of `kit.play(id, when, {gain, pan})` for distance and pan; without it the graph is identical to the prototype. |
| `src/audio/cues.js` | Pure: `EVENT_MAP` (event type -> cue descriptors), `SILENT_EVENTS` (with reasons), `ambientZone(state)`, monster voices, skill cues, per-cue cooldowns and priorities. |
| `src/audio/limiter.js` | Pure voice limiter (cap, reserve for critical cues, per-cue cooldown). Time is injected. |
| `src/audio/spatial.js` | Pure distance gain + pan from the hero tile. |
| `src/audio/config.js` | `audioConfig` (what the spec calls `config.audio.*`; src/core was off limits, so it lives here). |
| `src/audio/index.js` | `createAudio({bus, getState, options})` -> `{unlock, setKit, setVolume, setMuted, dispose}` plus `getState`, `clearCueLog`, `sync`, `handleEvent`. |
| `test/audio.test.js` | 23 unit tests (mapping, every core event covered, limiter, spatial, engine against a fake AudioContext and fake kits). |
| `e2e/audio.mjs` | Bundles `src/audio` into a blank page (no game needed), renders all 27 cues x 3 kits and 3 ambients x 3 kits offline, checks the measure-JSON thresholds, then drives the engine with a fake bus on a real AudioContext. 33 checks. Run: `node e2e/audio.mjs`. |

## Wiring (for the agents owning main.js / game.js / ui / testhook; AUDIO did not touch them)

### 1. main.js (after `const bus = createBus()` and `createGame(...)`)

```js
import { createAudio } from "./audio/index.js";
// options: the persisted options object (see 4.). Until S3-4 lands, pass {}.
const audio = createAudio({ bus, getState: () => game.core ?? null, options: game.options ?? {} });
// Browsers start audio only after a gesture: unlock on the first pointerdown / keydown, then stop listening.
const unlock = () => { if (audio.unlock()) { removeEventListener("pointerdown", unlock, true); removeEventListener("keydown", unlock, true); } };
addEventListener("pointerdown", unlock, true);
addEventListener("keydown", unlock, true);
```

- `getState` must return the core state (it reads `scene`, `tick`, `depth`, `paused`, `floor.theme`, `player.tile`, `monsters[]`, `projectiles[]`) or `null`/`{scene:"title"}` on the title screen. On the title screen the engine plays the soft lobby bed (`ambient:lobby`) once unlocked; `scene === "dead"` stops it.
- The engine subscribes with `bus.on("*")`; every core event reaches it because game.js already emits `game.core.events` on the bus. No change needed in game.js for gameplay sounds.
- Pause: the engine reads `state.paused` every 250 ms (and on each event) and calls `ctx.suspend()` / `ctx.resume()` (AC-NFR-A02-2). No extra wiring.
- Optional: `audio.dispose()` on page teardown.

### 2. Events the UI / shell must emit on the bus (they are not core events)

| Event | When | Cue |
|---|---|---|
| `{type:"ui:click"}` | any UI button press (title buttons, panel buttons, options sliders on release) | uiClick |
| `{type:"ui:open"}` / `{type:"ui:close"}` | a panel opens / closes (I, C, S, map, vendor) | uiOpen (close is quieter) |
| `{type:"ui:equip"}` | optional; the core `equip` event already sounds uiEquip, so do not emit both for the same action | uiEquip |
| `{type:"ui:heartbeat", ratio, period}` | already emitted by `render/fx.js` `drawLowHp` | heartbeat |
| `{type:"ui:lowhp", low, ratio}` | already emitted; silent on purpose | none |

Without `ui:click` AC-R-080-3 ("a UI button is clicked -> uiClick") cannot pass. The first click on the title screen both unlocks the context and should emit `ui:click`; the click cue is logged but the unlock happens in the capture phase first, so it will also sound.

### 3. Test hook (src/testhook/index.js)

Expose `audio.getState()` (spec AC-R-080-3, 081-2, 082-1): `window.__app.audio = { getState: () => audio.getState(), clearCueLog: () => audio.clearCueLog(), setVolume, setMuted, setKit }`. `audio` must be created before `installTestHook`; pass it in (`installTestHook(game, { audio })`) or hang it on `game.audio`.

`getState()` returns:

```
{ kit, unlocked, ctxState, master, sfx, ambient, muted,
  effectiveGain: { master, sfx, ambient },   // master x bus; all 0 while muted (AC-R-082-1/2)
  ambientId: "ambient:lobby" | "ambient:open-plan" | "ambient:basement" | null,
  voices, limiter: { played, cooldown, full },
  cueLog: [ { tick, cue, name, gain, pan } ] }   // last 256
```

- `cue` is the kit sound id; `name` is the logical id the spec uses. Spec names -> `name`: attack (basic melee swing), hit, death, pickup, uiClick, levelUp, potion; also hurt, miss, heroHurt, cast, stairs, gold, buy, sell, equip, and so on (see `cues.js`). Tests that need the spec ids should filter on `name`.
- Cues are logged even while the context is still locked (headless tests with no user gesture), so `cueLog` does not depend on a real gesture. Actual sound needs `unlock()`.
- The cue is logged with `tick` = the event's `tick` if it has one, otherwise `state.tick` at the moment the event was handled (game.js dispatches events right after the tick, so this is the tick of the event).

### 4. Options screen / persistence (S3-4, src/ui/options.js, save)

- The engine reads `options.volume = {master, sfx, ambient}`, `options.muted`, `options.kit` ("gothic" | "chiptune" | "foley") when created, and writes the same fields back to that object on every change. Persist that object with the other options (AC-R-082-3), and create the audio engine after it is loaded.
- Sliders: `audio.setVolume("master" | "sfx" | "ambient", v)`. The names `effects` and `music` are accepted as aliases. Input is clamped to [0,1]; non-numbers are rejected (returns false).
- Mute: `audio.setMuted(bool)`; slider values are kept.
- Kit selector (spec decision `audio.kit`): `audio.setKit(id)`; the ambient restarts in the new kit, the old kit's tails fade out.
- Defaults (decision QF-08-3): master 0.6, effects 0.8, ambient 0.5, muted false, kit foley. If the spec's `config.audio.defaultBus` must be a single number, note the decision uses 0.8 / 0.5; I kept the decision's values and put them in `src/audio/config.js` (`defaultBus: {sfx, ambient}`). Please move the block to `src/core/config.js` as `config.audio` if the tests of S3-4 read it from there.

### 5. e2e runner

`e2e/run-all.mjs` is not mine; add `"audio"` to its `scripts` list (`audio.mjs` needs no dist/ build, so it can run first).

## Behaviour decisions worth knowing

- Cue per event (full table in `cues.js`): player hit = swing (`attack`) + `hitFlesh` or `hitPaper` (paper for printer imp / demon, temp worker, consultant, auditor) + a quieter hurt voice of the target (zombie / imp / manager class); skill hits skip the swing. Miss = `miss` only (never a hit cue, AC-R-080-4); a monster's miss is 70 % level. Kill = death voice of the monster class. Hero hit = `heroHurt`. Hero death = `deathManager`. `cast` maps per skill; `burst`, `heal`, `projectileEnd`, `drop`, `noPath`, `ui:lowhp` are silent (reasons in `SILENT_EVENTS`). Hostile projectiles play a quiet `castStapler` at the projectile. Refusals (noMana, cannotAfford, inventoryFull, beltFull, reqNotMet, slotBlocked, wrongSlot, placeRejected, stairsLocked) share a quiet `uiClick` named `reject`; there is no dedicated "denied" sound in the kits.
- A unit test scans `src/core` for every `emit(state, {type: ...})` and fails when a new event type has neither a cue nor an entry in `SILENT_EVENTS`. A new core event therefore needs a one-line decision in `cues.js`.
- Voice limiting: at most 12 simultaneous SFX (2 slots reserved for priority >= 8: level up, hero hurt, unique pickup, hero death); per-cue cooldown 50 ms by default (table in `cues.js`), so 20 hits in a frame play one hit cue. Voice lengths come from the measured durations. Dropped cues are not logged.
- Positional: monsters' sounds use the monster tile, `cast`/`pickup`/UI cues are not positional. Full level within 3 tiles, linear fall to 15 % at 18 tiles, culled beyond. Pan = (dx - dy) / 10 tiles (isometric screen x), clamped to +-0.8. R-083 stays LATER; this is the cheap version.
- Ambient: generative and continuous (no loop buffer). Zone change = old bed fades out over 0.8 s while the new fades in over 0.6 s. The "loop gap" AC-R-081-3 is checked in e2e as the seam of start and end of a faded render (|first|, |last| at most 0.1); there is no loop point to click.
- Title bed: `ambient:lobby` through the ambient bus at the ambient slider (decision text), no separate quieter level. If a softer title bed is wanted later, add a `bed` option to `kit.startAmbient` in `kits/common.js`.
- Not fully testable without ears: kit levels. QF-08-4 (listening review) remains a human gate; S3-6 may adjust `KIT_TRIM` tables in the kit files.

## Measured thresholds used by e2e (from measure-*.json, `summary.allPass`)

SFX peak within -6..-1 dBFS; SFX RMS spread at most 12 dB; no clipping (|x| >= 0.999) in SFX or ambient; no NaN; SFX at most 1.0 s (to -50 dBFS); at most 12 Web Audio nodes per play; ambient RMS -30..-20 dBFS (1..10 s window). All three kits pass.

## Open points

- `config.audio` is in `src/audio/config.js`, not core (see 4.).
- `e2e/run-all.mjs`, the test hook and the Options UI need the wiring above before AC-R-080-3, 081-2, 082-1..6 can run in the game page.
- Gesture: pressing keys in the title screen also unlocks; a page that never gets a gesture stays silent (cueLog still fills).
