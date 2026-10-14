# R7-ai: AI-R7 (R7-1 and the first bullet of R7-3)

Date: 2026-10-14. Package: src/core (intent, state, config, world), bot/policy.js, test/r7-ai.test.js, golden fixtures.

## Root causes

### R7-3 (F1): FM seed 5, floor 1, hero idle with a held target
Repro (headless, scripted nearest-monster clicker, drinks a potion below 40 %): the hero stands on (18,13) from about tick 470, action "idle", target m27 (temp worker) on (19,12), AI "chase" with an empty path. The target is diagonal across a wall corner ((19,13) is a wall), so `isAdjacent` (corner rule, same as `canStep`) is false. Its only attack tiles ((18,12), (17,12) ...) are taken by other monsters, so its path is blocked, it re-plans every 15 ticks and never arrives. In `playerIntent` the hero then applied the S1 hold rule ("a target that is chasing and within holdRadius is waited for") for ever, while another monster on (18,12) hit it unanswered.
Not a corner-cutting or A* bug: the rules are consistent; the missing piece was a fall-back on the player's side (and a time limit on the hold).

### R7-1: IT Wizard seed 24, depth 8, tick 80598
Trace from the same seed: the awake monsters at the give-up were only about 55 ticks old. The hero had died at tick about 78000, respawned, spent 2500 ticks in the Lobby (sell, buy, equip) and walked back into a freshly generated floor 8. The bot watchdog (`bot/policy.js`, no xp for 3600 ticks) kept its `mem.prog` from before the death: the Lobby trip is decided in `decideTown` and never reached the line that refreshes it, and the depth check (`prog.depth !== view.depth`) is equal again on floor 8. So the "give-up" was a false positive of the bot, not a chase bug: the printer imps were being staggered by the wizard's zaps and the auditor was approaching normally. No monster stall was reproducible at this tick; the earlier fight on this floor (ticks 77450-78000, a death by ranged attackers) is ordinary combat.

## Fixes
1. `src/core/systems/intent.js` (`playerIntent`): new `p.standT` counts ticks the hero stands (no step in progress) with a held target out of reach.
   - After `config.retargetTicks` (60 = 1 s) the hero retargets the monster in basic reach that attacks it (attackers first, then nearest, then weakest; none = no change). This is the original game's behaviour: the hero hits what is in reach.
   - After `config.holdMaxTicks` (120) the "wait for a chasing target" rule is dropped and the hero plans its own path to the target (or gives it up with a noPath event), so a blocked chaser cannot freeze the pair when nothing is in reach either.
   - A hero that is walking resets the counter, so a long approach is never cut short.
2. `src/core/state.js`, `systems/world.js`: new player field `standT` (init and reset on floor entry). Consumer tables: none (core-internal; no event, no UI/audio/render/bot use). Saves from before lack the field; it is read with `?? 0`.
3. `src/core/config.js`: `retargetTicks`, `holdMaxTicks`.
4. `bot/policy.js`: the per-floor memory reset (`view.depth !== mem.depth`, which also fires on entering the Lobby) now clears `mem.prog`, so a death or shopping trip is not counted as a minute without xp.

Monster side: a chaser whose attack tiles are all taken already waits and re-plans every `repathTicks`; with the hero no longer frozen the queue dissolves as the attackers die. No change to nav.js or monster AI was needed.

## Tests (test/r7-ai.test.js)
- staged map (hero in a one-tile gap, target diagonal across a corner, attacker adjacent): the hero strikes the attacker; red with the fix switched off.
- walking hero keeps its target (no early retarget).
- FM seed 5 floor 1 scripted clicker, 2600 ticks: never idles 600 ticks on a held target (2127 ticks before the fix; red with the fix switched off).
- bot watchdog memory is cleared on the Lobby trip.
Full suite 775 tests, green three times.

## Golden fixtures (re-recorded)
- `test/fixtures/run-a.hash`: a4a3cd6a1dac3cb2 -> 4a96887c22fea751.
- `test/fixtures/run-class.json`: facilities-manager a4a3cd6a1dac3cb2 -> 4a96887c22fea751; sales-rep 2871d3e9724a7936 -> f8676f7f5ab6bb2b; it-wizard 06d21319cc8b229a -> 602769930849f1d4.
- Reason: only the new `standT` player field (the state hash covers the whole player). Checked: with `retargetTicks` and `holdMaxTicks` set to 1e9 (behaviour off) the hashes are the same as with the fix on, i.e. the recorded runs themselves play identically.

## Parity (24 seeds x 3 classes, 150000 ticks, `npm run parity`)
| | before | after |
|---|---|---|
| watchdog give-ups | 1 (it-wizard seed 24, depth 8, tick 80598, hero 32,33) | 0 |
| quiet minutes (informational) | 27 | 26 |

Table, before and after (the same to the printed digit, deaths-by-depth differ by one FM boss death, d9 28 -> 29):

| class | wins | median min (min-max) | dev | median deaths | dev | median level | verdict |
|---|---|---|---|---|---|---|---|
| facilities-manager | 23/24 | 27.0 (22.5-38.6) | 0 % | 3 | 0 % | 16 | OUT: dominant skill (pallet-slam 55 %) |
| sales-rep | 24/24 | 27.4 (23.1-33.8) | 1 % | 3 | 0 % | 16 | in band |
| it-wizard | 24/24 | 26.1 (22.1-39.4) | -3 % | 2 | -33 % | 16 | OUT: deaths |

The two OUT verdicts exist before the change (known from R6-balance; not retuned here). Time deviations are all within the 25 % band.
