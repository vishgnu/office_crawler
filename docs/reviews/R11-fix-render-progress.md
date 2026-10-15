# R11 fix round, render part (implementer)

- done: R11-10 `bodyOver(g, p, tier)` drops the unused anchor argument (4 callers); pixel output unchanged (the art-sheet check and the pre-R8 golden stay green).
- done: M-2 two-handed weapons: `heroes.js` slants a two-hand weapon forward-up across the body at rest and walking (second hand on the shaft); pole gets a long butt below the lower hand, the extinguisher club a wooden haft (`gearparts-weapons.js`). 1x sheets looked at (fm/sr/it, idle, walk, attack, cast).
- done: M-3 hero: with a weapon worn the SR and IT attack frames are wind-up / cocked / strike / recover and the cast has a forward thrust on the release frame, the weapon direction follows. Bare class sprites are untouched (AC-R-260-3 pre-R8 golden, `test/fixtures/render-hero-pre-r8.json`, not mine to re-record). Monsters: `hitNudge` in `world.js`, a 3.5 px knock-back away from the hero that decays over the 8 flash ticks (state backed, no new event), off under reduced motion and for bosses.
- done: M-4 no cooldowns exist (config.js "no cooldowns"); every skill already has a cast effect, so the gap was a cast that does not go off: `noMana` / `castRefused` now add one short dim ring at the hero's feet (blue for mana), 250 ms throttle (`draw/effects.js`). No core event needed (both exist).
- done: M-5 floaters spawn beside the head, rise 14 px, alternate sides per stacked row, lane search slides and lifts at most one row (`fx.js` drawFloaters).
- done: M-6 `actorDepth`: the hero gets +0.25 on the depth key (hero was pushed first, so a stable sort drew monsters over him on ties). Seen in the realtime sheet: a middle manager standing behind his head is drawn under him.
- done: G-R1 checked at 1x (art-sheet set mode, fm/sr/it): a full RARE set keeps its class colours (thin yellow edge and two studs); only the UNIQUE set reads gold by design (rim). No change.
- done: `test/render-r11-fix.test.js` (7 tests), `e2e/r11fix-render.mjs` (realtime page without noanim, contact sheet).
- done: `node --test` run 1: 1358 pass 0 fail. art-sheet check ok, e2e/render.mjs 39/39, r8gear.mjs 21/21, r11fix-render 3/3.
- done: node --test run 2: 1358 pass 0 fail.
