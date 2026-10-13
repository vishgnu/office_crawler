# S2 code review (S2-1..S2-5)

Reviewer: `reviewer` agent. Scope: `office-crawler/src`, `test`, `e2e`, `bot` (diff 9ada7b1..HEAD). Read-only checks: `npm test` 312/312 pass; `npm run e2e` all scripts pass (ui 103/103). Core determinism greps clean (`layering.test.js` bans clocks, Math.random and trig in core; only `main.js` seeds from `Date.now()`, which is allowed). State round-trips through JSON unchanged after floor changes and 20 drops.

Verdict: **changes needed** (3 blocking, 6 should, 6 nit).

## The "Experience 1,080 / 1,400 (0%)" report: cause

Not an XP maths bug. Reproduced with a script: `gainXp(1200)` gives level 7, ratio 0.375, and the bar fills. The reported state is what `cheat.setLevel(7)` produces: `src/core/cheats.js:17` sets `p.xp = config.xpTable[n - 1]`, which is exactly the first xp of level 7 (1080). The bar is level-relative (`xpRatio`, `src/ui/itemview.js:138`: `(xp - 1080) / (1400 - 1080) = 0`), so 0% and an empty bar are correct for that state, and the HUD "0% to level 8" is too. Next level is correctly xpTable[7] = 1400.

The real defect is presentation. `src/ui/panels.js:101` prints the absolute pair "1,080 / 1,400" next to a level-relative percentage, so the line reads as 77% and contradicts itself. The same mismatch exists wherever the HUD pairs `xp.value/next` with `percent`. The spec text (AC-R-072-1) asks for `xp / xpNext`, so keep that, but label the percentage.

## Blocking

1. **S2 ACs with no implementation: map (R-075) and quick-return item (R-046).** AC-R-075-1/-2 (`floor.explored`, `ui.panels.map`, KeyM/Tab) and AC-R-046-1..-3 ("Emergency Exit", `portal`, `cmd.use`) are tagged S2 and listed in the plan (50-plan.md:143, :151; demo line 112 names the M panel and the quick-return item). `grep` finds no `explored`, `KeyM`, `portal`, `exploreRadius` or "Emergency Exit" in `src`, `test` or `e2e`; `game.panels()` hard-codes `map: false` (`src/game.js`), and `main.js` Tab is only `preventDefault`ed. No deferral is recorded in `docs/reviews/S2-*.md`. Fix: implement, or record a deferral decision with the user's go and move the ACs to S3 in the spec.
2. **AC-R-043-2 not met: floor 8 has a stairs-down tile.** `src/core/gen/floor.js` still assigns `exit` on every floor (`bossStairs: depth >= maxDepth` only flags it) and `world.js:99` only emits `stairsLocked`. The AC says "no stairs-down tile" on the last floor in the snapshot (and the proxy answer QF-04-5 makes the arena depth 9, reached by a stair, so the AC wording needs amending). Either amend the AC to "locked stairs until S3", or test it. No test asserts either way. Fix: add a test pinning the intended behaviour and update the spec line.
3. **Stash works anywhere, without the locker NPC.** `src/core/systems/intent.js` `case "stash"` has no check on `state.ui.dialog?.kind === "stash"` or the Lobby. Verified: on floor 2, `applyInput(s,{t:"stash",id,to:"stash"})` returns `{ok:true}`. Any future shortcut or the raw `__app.input` (test hook) moves items to safe storage mid-dungeon, which defeats the point of a town-only locker. Fix: require `state.depth === 0 && state.ui.dialog?.kind === "stash"` (and a reach check like `vendorInReach`); add a unit test. Also on a failed move `autoplaceInto(from, item)` puts the item at the first free spot, not its old cell; use `snapshotGrid`/`restoreGrid`.

## Should

1. **Percent label in the Employee File and HUD** (see above). `src/ui/panels.js:101`, `src/render/hud.js:40-41`. Show "(0% of level)" or switch the numbers to "xp - prev / span". Also make `setLevel` leave xp at the threshold (needed by AC-R-013-6) but have the E2E assert the bar with a mid-level xp so the next reviewer is not misled.
2. **Fists add to weapon damage.** `src/core/items/derive.js:48-49`: `min = unarmed.min + gritBonus + weapon.min`. A Letter Opener on top of 1-4 unarmed damage keeps the fist range as a free bonus. AC-R-012-2 says unarmed damage applies "when any equipment is empty". Fix: use `config.unarmed` only when `g.damageMax === 0` for the weapon item (not for flat affix damage), or document it as intended in `config.js`.
3. **Resistances are unbounded.** `gearTotals` sums `resist.*` with no cap, and affixes go to 35 per piece over ten slots (`affixes.js`). Elemental combat is LATER so there is no effect today, but the stat is shown in the panel and a cap (e.g. `config.resistCap`) is cheaper now than after balance work. Same for `attackRating` and `defense` having no caps (defense is bounded only by `hitChanceMin`).
4. **Affix tier choice is uniform, not level-weighted.** `src/core/items/roll.js:49` `rng.pick(open)` treats every unlocked tier of every group as equally likely, so at ilvl 21+ a rare is as likely to carry a tier-1 affix as tier-4, and groups with more unlocked tiers are picked more often. Fix: pick the group first, then weight tiers towards the highest unlocked.
5. **Vendor stock reroll is free and unlimited.** `openVendor` (`src/core/systems/vendors.js:41`) increments `vendorVisits` on every open, and `world.js` `openDialog` opens it each time the hero walks up. Walking away and back gives a fresh seeded stock of 8 magic items. Prices make buy-then-sell a loss (`buyPrice >= 4 * sellValue`, floor at sell + 1; checked for potions, magic, rare), so there is no gold loop, but it is a free fishing mechanic. Fix: re-roll per town visit (`floorEnter` into depth 0) rather than per window open, or note it as intended in `config.js`.
6. **Dropped items are silently destroyed at the ground cap.** `src/core/systems/loot.js:addGround` shifts the oldest entry past `groundItemCap` (60). That entry may be the held item released on death (`releaseCursor`, QF-02-3 "never destroyed") or a unique already added to `uniquesFound`, which then cannot drop again. Fix: evict gold first, then oldest normal-rarity items, and never evict the item just placed or a magic-or-better item while a normal one exists.

## Nit

1. `src/ui/panels.js` arrow-key clamp uses literals `9` and `3`; use `config.inventory.w/h`.
2. `game.heldOrigin` is not cleared when `closePanel` or the core's `releaseCursor` drops the cursor (`src/game.js` closePanel); a stale origin only affects the panel signature, but reset it.
3. `src/core/systems/skills.js`: casting has no `castT` guard, so several casts can be input in one tick (mana is the only limit, by design QF-06-5). Consider rejecting a cast while `p.castT > 0` to avoid double-spend when the player double-clicks.
4. `parkFloor` marks a spawn as killed if `spawnMonster` returned null on entry (blocked tile), so that monster vanishes forever. Rare (spawns are outside `safeRadius`) but cheap to track with an explicit `killed` flag.
5. `sell` (`vendors.js:75`) sells any inventory item with one click and no confirm, including uniques; a confirm or "sell value shown in a toast with undo" is cheap insurance. Also does not check `vendorInReach` (the dialog closes on walk-away, so only reachable through raw input).
6. `src/core/items/derive.js` comment "a two-handed weapon is listed once" is stale: the item is only ever in `equipment.weapon`; the `seen` set is dead code unless the same object can occupy two slots.

## Checked and found correct

- Item rolling: unique ids per game, taken unique falls back to a rare of the same base (QF-05-2), one affix per group, prefix/suffix caps, integer ranges with both ends reachable, rarity weights consume exactly one draw. All randomness from the seeded `loot` stream; vendors derive their rng from `hash32(seed, vendor, visit)`.
- `deriveStats`: pure, gear attributes feed hp/mp/damage/defense, passives add per level, `applyDerived` clamps hp/mp and only refills on level-up. Unequip returns stats exactly (tested).
- Equipment: two-handed weapon displaces the off-hand to the inventory or the whole change is rolled back (inventory, equipment and cursor restored); off-hand blocked while a two-hander is worn; requirements use base attributes (so gear cannot bootstrap its own requirements).
- Inventory: swap with exactly one covered item, reject with two, bounds checked, `place`/`remove` keep x,y consistent.
- XP/levels: single award per kill (killMonster guarded by `ai === "dead"`), multi-level jumps grant 5/1 points per level, cap holds, `xpPastCap` counting.
- Projectiles: speed 0.35 and 0.26 are below the hit radius 0.6, so no tunnelling; walls end a shot; owner-only targeting; first target on the line; ttl bounded.
- Champions: stats from `monsterStats` plus mods, hp strictly above normal, names from registry, budget accounting includes tier factor.
- Floor persistence: layout regenerates from seed, killed spawns stay dead, ground items persist per floor, projectiles and floaters cleared on entry. Respawn returns to the Lobby with full hp/mp and nothing lost; death releases the cursor item.
- Test hook cheats are installed only when `?test=1` (`main.js:98`), `?start=floor` only in test mode. IP and brand denylist tests (`legal`, `loot`, `champions`, `build`) pass and cover generated rare and champion names.
- Input: right mouse never opens the browser menu, F1-F4 are default-prevented, digits drink belt potions only in a running game, a right-button release does not clear a held left button, Escape order (held item, drawers, dialog, pause) is implemented and e2e-tested.
- Performance: spatial hash only built when player projectiles exist; floaters capped at 40; `freeGroundTile` scans at most 49 tiles per drop. No hazards found at 50 monsters.

```json
{"verdict":"changes needed","blocking":3,"should":6,"nit":6}
```
