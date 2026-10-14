# S3 code review and release-readiness pass

Date: 2026-10-14. Reviewer: `reviewer` agent. Scope: `git diff 58f9f26 HEAD` over `office-crawler/{src,test,e2e,bot}` (boss arena, save/load, audio wiring, options/keymap, victory, WORLD-S3 visuals), plus a release pass over the whole game. Read-only: no code was changed.

## Checks run

| Check | Result |
|---|---|
| `npm test` | 415/415 pass (about 15 s) |
| `npm run e2e` | all scripts pass; `s3ui` 89/89; no page errors; requests are `file:`/`data:`/`blob:` only |
| `npm run bench` (two runs) | **FAIL** NFR-P01: full fx 31.7 and 36.9 fps (target >= 40), lowFx 37.1 and 39.1 fps. Render cost 2.9 ms avg, 6-7 ms p95. Atlas 4.5-4.6 s of the 5 s budget (2220 sprites). Floor generation 70 ms, 10,000 ticks 132 ms, pathing 26 ms: pass. The box had load average 5.6 on 4 cores, so the numbers are pessimistic, but earlier iterations recorded 49.3-54.5 fps on this runner. |
| `npm audit` (prod and dev) | 0 vulnerabilities |
| Denylists over `dist/index.html` (word match, both lists, 55 terms) | 0 hits. `dist/index.html` equals `play/index.html` byte for byte. |
| Bundle scan | no `fetch`, `XMLHttpRequest`, `eval`, `new Function`, external URLs. CSP `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:` still in place; Blob download via `<a download>` is not blocked by it and the e2e export check passes from `file://`. |
| Secret scan (grep) | no secrets (hits are the word "token" in UI code) |
| TODO / FIXME in src, bot, e2e, test | none |
| Own probes (scratchpad, not committed) | hostile-JSON and store probes, fake-AudioContext probe: results quoted in the findings |

## Blocking

**B1. Quit to title does not save; Continue then loads an older state.** `src/main.js:168` (`quit: () => game.toTitle()`), flush only at `main.js:158-160`. Autosave happens at town, floor change, victory, and page exit. Pick up loot or gain levels on floor 3, press Esc, "Quit to title", press Continue: you get the state of the last floor entry. The XP, items and gold since then are silently gone. AC-R-091-3 only names page exit, but this is the normal way to leave a session and it loses progress without a word. Fix: call `store.save(game.core, {force:true})` (and `refreshSave()`) before `game.toTitle()` in `quit` and in the dead-screen quit; add an e2e step "gain gold, Quit, Continue, gold kept".

**B2. R-104 story frame is not implemented (AC-R-104-1, AC-R-104-2).** The plan lists "story text R-104" under S3-1 (`docs/product/50-plan.md`, S3-1 ACs) and the spec tags both ACs `S3`. There is no `content.story`, no start text on new game, no boss text on entering depth 9; only `victoryText` is shown. `docs/reviews/S3-ui-notes.md:31` records it as "not in this package's brief", so it fell between work packages. R-104 is "should", so the human may descope it, but then it must be recorded as a deliberate cut. Fix: add `content.story = {start, boss, victory}` with 3-5 lines each (denylist-scanned), a dismissible story overlay on first scene and on first entry to depth 9, plus the two tests; or descope in `STATE.md` with the human's go.

**B3. Performance gate is red.** `npm run bench` fails NFR-P01 in both runs (see table). The hard floor of 30 fps is met (31.7 / 36.9), the 40 fps bench target is not, and prior iterations reported about 49 fps, so S3 appears to have cost 20-35 percent. Render time per frame is low (2.9 ms), so the cost is probably elsewhere (DOM overlay and CSS on top of the canvas, the extra boss/telegraph/confetti passes, or only machine load). Fix: rerun on a quiet runner; if still red, profile frames with the options screen closed and the boss bar on, and either fix or re-baseline the target with the human. Also see S11 (atlas time).

## Should

**S1. Audio stays suspended on the title screen after "Quit to title" from pause.** `src/audio/index.js:67-70`: the pause/resume logic runs only `if (ctx && s)`; after quit the state is `null`, so `paused` stays true and the context stays suspended. Verified with a fake AudioContext: pause gives `suspended`, state `null` gives still `suspended`. Result: no title bed and no UI click sounds (play() requires `ctx.state === "running"`) until a new game or Continue starts. Fix: treat a null state as not paused (`const p = !!s?.paused`), run the check outside the `if (s)`, and add a unit test (pause, quit, expect `running`).

**S2. Audio keeps playing in a hidden tab.** No `visibilitychange` handling in `src/audio` or `main.js:159-160` (that handler only saves). The rAF loop stops, the ambient bed and its 250 ms pump keep running. Fix: suspend on `hidden`, resume on `visible` (unless paused).

**S3. Accessibility claims not met or not tested.** AC-NFR-A04-1 (every HUD and panel text >= 14 px at 1080p): `src/style.css:72` (13px), `:162`, `:168` (13px), `:222` (13px), `:228`, `:230`, `:232` (12.5px) and canvas text at `hud.js` (`fontPx(s, 12, 13)` for the phase label) are below 14 px, and no test checks it. AC-NFR-A05-2 (no effect flashes more than 3 times per second) has no test either; the low-HP pulse is 0.9-1.4 Hz, so the behaviour is probably fine, but it is unproven. The README/options text promises text size and reduced motion; do not claim NFR-A04/A05 as met until these two ACs have tests. Fix: raise the small sizes (or scale them by `--ts`), add a computed-style e2e scan and a unit test of effect timelines.

**S4. Reduced motion does not cover everything.** `src/game.js:332` and `:367` gate shake and the hurt vignette, but `fx.drawConfetti` (`src/render/fx.js:428-433`: full-screen golden flash plus about 8 s of confetti) and the low-HP vignette pulse (`fx.js:639-650`) ignore `options.reducedMotion`. `ui.fx.flash === 0` is reported (`game.js:273`) while the victory flash still draws, so AC-NFR-A05-1 passes on a flag rather than on the screen. Fix: skip the flash and use a static or slower confetti when `reducedMotion`; make the low-HP vignette static.

**S5. A newer-version save is overwritten by the next autosave.** `src/save/storage.js:96` leaves a too-new save untouched ("New game remains available"), but the first autosave of the new game replaces it. The confirm dialog is generic. Players who open an older build lose the newer character. Fix: on `newer`, copy the text to the backup key before the first overwrite (or refuse to autosave until the player confirms), and say so in the notice.

**S6. Quarantine of a damaged save is not atomic and keeps only one backup.** `src/save/storage.js:99-100`: `put(backup, text)` result is ignored, then the slot is cleared. On a quota error the damaged save is deleted and no backup exists (I reproduced: slot becomes `null`). A second damaged save overwrites the first backup (reproduced: backup holds `{bad2`). `main.js:128` runs this at every boot. Fix: only clear the slot if the backup write succeeded; keep the damaged text in place otherwise and show the notice. One backup is as proposed in QF-09-6; say in the notice that an older backup is replaced.

**S7. Import replaces the existing character without confirmation.** `src/ui/screens.js:100-103` -> `main.js:154` -> `storage.js:114-121`. A valid import silently overwrites the slot and the old save is not kept anywhere. AC-R-092-4 requires confirmation for "New game"; import has the same effect. Fix: reuse `confirmBox` when `hasSave`, or move the old text to the backup key first.

**S8. Save schema trusts item and skill contents (hostile JSON).** No prototype pollution was found: `__proto__` at the top level or in a v0 migration is rejected by the unknown-key check, and `{}.polluted` stayed undefined. Remaining gaps, each reproduced with a recomputed checksum (the checksum only detects damage, which is fine):
- `src/save/format.js:117,120`: `!skillDefs[id]` is true for inherited names, so `skills: {constructor: 3}` and `skillBar.primary: "constructor"` pass. Use `Object.hasOwn`.
- `format.js:79-92` (`itemOk`): `base` is any string (`"nope"` accepted, though `ui/icons.js:68` and `items/price.js:7` look it up), `name` has no length limit (900 KB accepted, within the 2 MB read cap), `affixes[].stat` is any string, numbers are only `isFinite` (`defense: 1e300`, `damage.min: -1e300` accepted), extra keys are kept, `slot` is not checked against the equipment key.
- `explored.size` is not checked against the floor's size.
Rendering uses `esc()` for text, `w`/`h` are integers and `rarity` is an allow-list, so I found no XSS, but unknown bases and huge values can produce odd UI or NaN. Fix: validate `base` against `bases`, `stat` against the known stat list, cap string lengths (name 64), clamp numbers to sane ranges, whitelist item keys, check explored size against the generated floor, and add tests for each.

**S9. No tests for hostile saves or for a save taken in the boss arena.** `test/save.test.js` has random mutation (NFR-D03-4) and a schema test, but nothing with `__proto__`/`constructor` keys, unknown bases or oversize strings, and nothing that saves with `depth === 9` (resume at the arena entry, boss at full health, `bossAttempts` count) or during the victory countdown. Fix: add them next to the S8 fixes. (From reading the code: a mid-boss save resumes at the arena entry with a fresh boss, and `bossAttempts` is incremented again on the next engage; both are acceptable but should be pinned.)

**S10. No CI workflow in the repository.** DoD item 1 says the "must" ACs pass in CI. `npm test` and `npm run e2e` pass locally, but there is no `.github/` (or other CI) in the repo, so nothing enforces them. Fix: add a workflow running `npm ci`, `npm test`, `npm run e2e`; keep `npm run bench` advisory.

**S11. Atlas build time has little headroom and high-contrast rebuilds it at runtime.** 4.5 s of a 5 s budget (was 3.8 s with 1719 sprites). `main.js:92-94` rebuilds the atlas when "High contrast" is toggled, so the player pays that cost again at runtime. Confirm it does not freeze input (the build reports progress, so it appears chunked) and consider building lazily by style group or lowering the default atlas scale.

## Nits

- N1. `src/ui/screens.js:100`: `if (ok) go(null); else go(null);` both branches are the same.
- N2. `src/audio/index.js:132` `void oldKit;` and the unused `invert` in the destructuring at `src/ui/options.js:115` are leftovers.
- N3. `test/audio.test.js:30`: `PENDING_AUDIO_S3` is now an empty set with a loop over it; delete it.
- N4. `src/core/config.js:87`: `bossDrops` "kept for older tests"; migrate the test and remove.
- N5. `storage.js:111` accepts text up to 2 x `saveMaxBytes` but `write` refuses more than 1x; a 1-2 MB valid file is reported as a write failure, not "too large". Use one limit.
- N6. `save.options` (`format.js:70`, `loadSave`) is validated and stored but `game.js` immediately replaces it with the options key (`emitChange`), so there are two sources of truth and the saved copy is dead data. AC-R-090-1 expects options in the save; keep it, but state which wins.
- N7. Two tabs share one slot and last writer wins; no `storage` event handling. Document it.
- N8. Autosave coalescing (`autosaveMinTicks` 30) skips a floor-change save when two changes are within 30 ticks; the exit flush covers it, but a crash between them loses one floor change.
- N9. `main.js:128` builds a full game state at every boot just to check the save; `check()` would be enough.
- N10. Dropped loot lying on the floor and monster state are not saved (documented, QF-09-2). Say so in the options "saved" hint or the README so players do not leave items on the floor before closing the tab.

## Focus areas, answered

- **Save robustness.** Corrupt, truncated, wrong-type and foreign-format saves return typed errors without throwing (probes + NFR-D03-4 test). Newer saves are refused and left untouched (but see S5). Quota errors keep the old save (`importText` and `save` both verified) and raise `saveFailed`. Migration path v0 -> v1 exists with a fixture; `MIGRATIONS` checks that each step bumps the version. Checksum is damage detection only, as documented. Hostile JSON: no pollution, size capped at 2 MB read / 1 MB write, but content validation is shallow (S8). Mid-boss: the save resumes at the arena entry with a fresh boss (reset rules match QF-04-9). Key names are namespaced `office-crawler.*`; no collisions with the probe key, which is removed at once.
- **Boss.** Pattern has no randomness; slam is telegraphed with public `windup` state; the player can leave via the stairs, which rebuilds the floor (boss at full health, summons gone because the floor monsters are rebuilt). On death `onBossKilled` clears hostile projectiles and kills summons; `finishVictory` also runs if the hero leaves during the countdown. Keep playing returns to the Lobby; `bossDefeated` suppresses the spawn on re-entry (`world.js:66`), so depth 9 is an empty arena afterwards and not a softlock. No softlock found. The bot report in the core notes (20/20 wins, 14/20 first try) supports fairness; I did not rerun it.
- **Audio.** One context only, created on first gesture; listeners removed after a successful unlock. Kit swap stops the ambient runner (interval cleared, sources stopped), fades the old output and disconnects it after 1.5 s: no node or interval leak found. Limiter: a voice cap (12, 2 reserved) in `limiter.js` plus a compressor and soft ceiling in `kits/common.js:19-22`. Gaps: S1 and S2.
- **Options/keymap.** `bindKey` rejects reserved, invalid and conflicting keys; stored data with any clash resets to defaults; the old default key of a moved action is dead and the aliases (K, Tab, numpad) still work unless another action takes that code. All 12 actions stay reachable; Escape cannot be bound. Capture mode is cleaned up on screen destroy. Persistence under its own key, verified by e2e reload. Mouse-only movement remains (documented as fixed).
- **Determinism.** Core boss code uses no RNG; `getState().hash` excludes options; replay e2e and `run-a.hash` pass. The hash fixture was regenerated twice in this range, for the new state fields (documented in the core notes).
- **IP/brand.** Clean (see table).

## Release readiness against the Definition of Done

| DoD item | Status | Evidence |
|---|---|---|
| All "must" ACs pass as automated tests in CI | **fail** (partial) | 415 unit + all e2e pass locally; no CI configured (S10); AC-R-104-1/2 missing (B2); AC-NFR-A04-1 and A05-2 untested (S3); bench NFR-P01 red (B3) |
| Security checks clean: dependency audit, secret scan, SAST | **pass** (with notes) | `npm audit` 0 vulnerabilities; secret grep clean; no network APIs, `eval`, or external URLs in the bundle; CSP intact; no SAST tool, but hostile-save review done (S8) |
| Preview ran the RC with migrations from empty and from previous release | **pass** (adapted) | static single file opened from `file://` in e2e; empty storage and the v0 -> v1 fixture are tested; there is no database or server |
| Observability: health endpoint, structured logs, dashboards | **n.a.** | offline client-only game; the error screen and `getState` test hook replace it; no telemetry by design (AC-NFR-D01-2) |
| Runbook: deploy, roll back, rotate secrets, restore DB | **pass** (adapted) | `play/README.md` (open the file, rebuild with `npm run build`); rollback = previous `index.html`; no secrets, no DB. Add a line on save compatibility and the backup key. |
| A human signs off in the console | **pending** | not yet recorded |
| Slice S3 ACs (spec 09 and S3 items of 04, 07, 08, 10) | **fail** (mostly pass) | save/load, export/import, options, audio, boss, victory pass in `s3ui` 89/89 and unit tests; open: B1, B2, S3, S4 |
| Brand / IP denylists on final bundle | **pass** | 0 hits over `dist/index.html` |
| `play/index.html` is the current build | **pass** | byte-identical to `dist/index.html` (rebuild after fixes) |

## Verdict

**Changes needed.** The slice is well built and well tested: the boss is fair and deterministic, the save format is versioned with a working migration, audio and options behave, and offline/CSP/IP constraints hold. Three things block release: progress is lost on "Quit to title" (B1), the story frame R-104 is missing (B2), and the performance gate is red (B3). The should-items S1 (silent title screen after quit), S5-S7 (save data-loss paths) and S8 (shallow import validation) are cheap and best fixed in the same pass.

```json
{"verdict":"changes needed","blocking":3,"should":11,"nit":10,"dod":{"must_acs_in_ci":"fail","security_checks":"pass","preview_migrations":"pass","observability":"n.a.","runbook":"pass","human_signoff":"pending","slice_s3_acs":"fail","ip_denylists":"pass","perf_bench":"fail"},"top":["B1 Quit to title does not save: Continue loads the last floor-entry state (src/main.js:168)","B2 R-104 story frame (AC-R-104-1/2) not implemented","B3 bench NFR-P01 red: 31.7/36.9 fps vs 40 target, was ~49","S1 audio context stays suspended on the title after pause->quit (src/audio/index.js:67)","S5-S7 save data-loss paths: newer save, damaged-save quarantine and import overwrite","S8 save schema accepts unknown item bases, inherited skill ids, huge numbers","S3/S4 accessibility: text below 14px, reduced motion ignored by victory flash/confetti"]}
```

## Resolution (FINAL-FIX, 2026-10-14)

Fixed: B1 (quit saves first, e2e quit then Continue), B2 (`content.story` start/boss/victory, skippable overlay, denylist-tested), B3 (re-measured on a quiet box: 57-60 fps full fx, lowFx 57-60, atlas 3.8-4.0 s; one cold-start run took 5.17 s, so the atlas budget is noise-sensitive but no S3 regression was found; no code change needed), S1, S2 (audio null state; hidden tab suspends), S3 (text >= 14 px tests, AC-NFR-A05-2 test), S4 (reduced motion: no victory flash/confetti, steady low-HP edge, boss slam flash steady), S5 to S9 (newer-version save backed up before overwrite, atomic quarantine with 3 rotating backups, quota error never clears the slot, import confirmation, deeper validation with `Object.hasOwn`, known bases, length and range caps; hostile-save and mid-boss tests), S10 (CI template `.github-workflows/ci.yml`, README says to copy it to the repo root `.github/workflows/`). Also: crash in `drawImpact` (negative radius under stepped ticks, clamped; regression test) and first run (rapier worn, Strike on F1, one-time points prompt; the golden hash is unchanged because the core default stays unarmed and only the shell asks for `wearStartKit`).
Deferred (polish agent): high-contrast and text-size UI bugs, basement visibility, loot-label pile, title-screen art. S11 (lazy atlas) and nits N1 to N10 not addressed.
Results: npm test 427/427 three times, e2e all scripts OK (s3ui 105/105), bench OK.
