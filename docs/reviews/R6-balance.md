# R6-1 Per-class balance (BAL-R6), 2026-10-14

Scope: `docs/product/50-plan.md` R6-1, requirements R-230, R-234, R-006 per class, circle-02 Q7 option A. Numbers come from `node bot/parity.mjs <seeds> 150000` (new in this round): the careful bot plays each class from the Lobby through floors 1 to 8 to the boss, respawning after a death (at most 12), seeds 1..N, headless on the pure core, 60 ticks = 1 s of game time. Clear time = tick of the end of the run after the boss falls. Raw run data: scratchpad `base.json` and `final.json` (not committed; reproduce with the command above, runs are deterministic).

## 1. Baseline (before any change; 12 seeds per class, only the report instrumentation existed)

| class | wins | median clear (min-max) | median deaths (mean) | median level | basic attack share of damage | top tree skill (share of tree-skill damage) |
|---|---|---|---|---|---|---|
| Facilities Manager | 12/12 | 28.9 min (24.8-35.8) | 3.5 (3.3) | 14 | 68 % | pallet-slam 67 % |
| Sales Rep | 8/12 | 33.0 min (29.8-41.2) | 6 (6.0) | 14 | 67 % | stapler-throw 56 % |
| IT Wizard | 12/12 | 28.9 min (26.5-36.4) | 3 (3.3) | 14 | 54 % | burn 29 % |

Three-class median: 28.9 min, 3.5 deaths. Verdict at baseline: Sales Rep out of the band (deaths +71 %, 4 of 12 runs did not finish: all four ran out the 150 000 tick budget of 41.7 min, with 7 to 10 deaths each), dominant-skill check failed for the Facilities Manager and the Sales Rep. The R5 smoke on three seeds (FM 26.3 / SR 34.1 / IT 32.0 min) hid the spread: with 12 seeds the IT Wizard is 28.9, not 32.0.

Findings behind the numbers:
- The IT Wizard's damage did not come from its caster attribute. Grit 6 is below `gritFree` 8, so its "weapon damage" was the staff only; the bot's generic point weights then pushed points into Grit. Focus fed mana only (the design flaw named in the brief). Sales Rep (grit 8, agility 16) was the same.
- Two bot hangs inflated times and deaths and are fixed in `bot/policy.js`: (a) a hero that dithered between a far chaser that never arrives and a sleeper to hunt gained no xp for the rest of the budget (IT seed 11 sat at level 3 for 41 minutes; no stuck event because the tile kept changing); (b) damage events of instant skills were lost by the report (applyInput runs before the tick clears the event list), which made every area skill look unused ("Facilities Manager 100 % basic attack"). Both are bot-side; the core was not wrong.
- A level-14 hero never reaches tier 3 (level gate 16): the three capstones per class were dead content in a 20-40 minute run.

## 2. Changes (file: old to new, why)

Formula (one change in `src/core`, see ADR-0005 amendment 2026-10-14):

| file | old | new | why |
|---|---|---|---|
| `src/core/items/derive.js` | damage bonus = `max(0, attrs.grit - gritFree) * damagePerGrit` for every class | same, but the attribute is `derived.powerAttr` of the class (default `"grit"`) | casters (and the ranged class) scale from their own attribute; skills already add `floor(mean(damage) * weaponShare)` so they follow |
| `src/core/config.js` `derived.powerAttr` | (none) | `"grit"` | default for plain player objects, nothing else changes |

Data:

| file | key | old | new | why |
|---|---|---|---|---|
| `content/classes.js` FM | `derived.powerAttr` / `hpPerLevel` | grit (implicit) / 14 | grit / 16 | melee deaths were above the others after the xp and monster changes below |
| SR | `powerAttr` / `damagePerGrit` / `hpPerLevel` | grit (implicit) / 1.0 (config default) / 11 | agility / 0.8 / 9 | ranged class had no damage scaling (agility only fed accuracy); lower hp keeps its deaths near the median now that it hits harder |
| IT | `powerAttr` / `damagePerGrit` / `hpPerLevel` | grit (implicit) / 1.0 (config default) / 9 | focus / 0.6 / 9 | the caster flaw; 0.6 per Focus point above 8 (start Focus 20 = +7 damage) |
| IT `bot.attrWeights` | stamina 3, grit 3, agility 2, focus 1 | stamina 3, focus 3, agility 1 | the bot puts points where the class's skills scale |
| `config.js` `xpCurve.quad` | 36 | 26 | level 16 (tier 3) reached by the median run (median level 14 to 16): capstones are played; `player.xpNext` follows (146 to 136) |
| `config.js` `scaling.hpPct` / `damagePct` | 80 / 14 | 88 / 19 | the extra levels made the run too easy (2/1/2 deaths, 25 min); monsters hit a little harder and last a little longer |
| `skilltrees/facilities.js` pallet-slam | dmg min [6,2] max [10,3] | min [5,2] max [9,3] | cheapest area skill had two thirds of the tree damage |
| floor-buffer | mana [10,2], dmg min [8,2] max [14,3] | mana [8,2], min [10,3] max [16,4] | second damage skill was under-used (mana economy) |
| `skilltrees/sales.js` stapler-throw | min [4,2] max [8,3] | min [3,2] max [7,3] | dominant skill |
| pen-volley | min [2,1] max [4,1] | min [3,2] max [6,2] | tier-2 skills must be worth their mana |
| hard-close | min [6,2] max [10,3] | min [7,3] max [11,3] | same |
| `skilltrees/it.js` firewall (Packet Filter) | absorb [30,12] | absorb [40,14] | 59 of the casters' boss deaths in one trial; the shield is the caster's only defence |

Tried and reverted (recorded so nobody repeats them): IT `hpPerLevel` 8 (boss deaths doubled, 4 of 24 runs lost); a Facilities Manager build order that takes floor-buffer to 3 first and Demolition Day earlier (pallet-slam share went up, 55 to 61 %); IT `hpPerLevel` 8 with the weaker shield (median deaths 3.5, 1 of 12 runs lost). Tuning passes: pass 1 = formula plus Sales/IT numbers (all three classes won 12/12 at 28.9 / 27.5 / 27.1 min); pass 2 = xp curve, monster scaling, skill spread (several 12- and 24-seed trials, the last one is the final table).

Bot and tooling (`bot/**`): `bot/parity.mjs` (parallel parity report with band verdicts, damage share per skill, deaths by depth; `node bot/parity.mjs 24 150000 out.json`, `--read out.json`), `bot/report.js` (damage and casts per skill from events, deaths by depth), `bot/run-headless.mjs` (events are read after the input too), `bot/policy.js` (no-xp watchdog: `BOT.noProgressTicks` 3600, never on the boss floor).

Tests: `test/balance-gate.test.js` (new), `test/skill-cast.test.js` (new, acceptance follow-up F5), `test/character.test.js` (the class formula reads the power attribute), `test/skilltrees.test.js` and `test/affixes-class.test.js` (Stapler Throw numbers are read from the data, not hard-coded).

## 3. Final parity table (24 seeds per class, seeds 1..24)

| class | wins | median clear (min-max) | dev from 27.0 | median deaths (mean) | dev from 3 | median level | basic attack share | top tree skill (share of tree damage) | verdict |
|---|---|---|---|---|---|---|---|---|---|
| Facilities Manager | 23/24 | 27.0 min (22.5-38.6) | 0 % | 3 (3.3) | 0 % | 16 | 68 % | pallet-slam 55 % | time and deaths in band; dominant-skill check missed by 5 points |
| Sales Rep | 24/24 | 27.4 min (23.1-33.8) | +1 % | 3 (2.9) | 0 % | 16 | 67 % | stapler-throw 46 % | in band |
| IT Wizard | 24/24 | 26.1 min (22.1-39.4) | -3 % | 2 (2.6) | -33 % | 16 | 51 % | power-surge 31 % | time in band; deaths: median 2 vs 3 is out by one death (means 2.6 vs 2.9: -10 %) |

Three-class median: 27.0 min, 3 deaths. All classes: median clear time 20-40 min (range 22.1 to 39.4 min; the slowest runs of FM and IT are 38.6 and 39.4 min, close to the edge). Deaths by depth (all 24 runs; 9 = boss arena): FM d5 8, d6 18, d7 14, d8 11, d9 28; SR d5 2, d6 12, d7 16, d8 12, d9 27; IT d5 2, d6 7, d7 17, d8 10, d9 27. The one unfinished run: Facilities Manager seed 20 died 8 times in the boss arena and ran out of the 150 000 tick budget at 41.7 min.

How to read the deaths column: with medians of 2 to 3 deaths a single death is a 33 to 50 % step, so the 25 % band can only hold if the three medians are equal or differ by half a death. Two trials ended with all three clear times within 5 % and the deaths medians 3/3/2 or 2/2/3; the means are the better guide. The release gate (below) should use the clear-time band and the mean-deaths band, not the median of small integers (proposal, owner: orchestrator).

## 4. Damage share per skill (24 runs per class, damage dealt to monsters)

- Facilities Manager: basic attack (Strike) 68 %, Pallet Slam 17 %, Floor Buffer Sweep 14 %. Baseline: 68 / 22 / 11.
- Sales Rep: Toss 67 %, Stapler Throw 15 %, Hard Close 9 %, Pen Volley 5 %, Reply-All 2 %, summoned allies 2 %. Baseline: 67 / 18 / 5 (Hard Close) / 5 / 2 / 3.
- IT Wizard: Zap 51 %, Power Surge 15 %, Server Overheat burn 12 % (dot ticks, not attributed per skill by the core) plus Server Overheat hits 11 %, Cold Boot 11 %. Baseline: Zap 54, burn 13, Cold Boot 12, Power Surge 11, Overheat 10.

The free basic attack carries about two thirds of the damage of the two physical classes (mana-limited skills). That is a design property of "mana cost only, no cooldowns", not a skill dominating: among the tree skills the largest share is 55 % (Pallet Slam), 46 % (Stapler Throw) and 31 % (Power Surge, a share of the tree damage). The bot casts only what its priority list allows: skills it never uses (passives, Dolly Charge, traps, Mute outside a mob, Restore Backup outside low health) do no damage and are not counted. Only the Facilities Manager misses the "no tree skill above 50 %" threshold I used (the spec gives no number); the cause is the cheap tier-1 area skill versus a mana pool of about 50 at level 14, and Demolition Day (level 16) arrives only for the last floors.

## 5. Acceptance follow-up F5: Power Surge and Packet Filter

Checked in the data and by `test/skill-cast.test.js`:
- Power Surge (`power-surge`) is an active projectile (chain bolt), 8 mana at level 1 (+2 per level), no aura. `castSkill` runs `precheck` before it takes mana: a cast with the hero's own tile or no tile is refused with "no direction" / "needs a target tile" and spends nothing. That is the R5 observation "mana unchanged": the F-key cast went out without an aim tile in that frame. With a target tile it spends exactly `castCost` and the bolt hits and chains (test).
- Packet Filter (`firewall`) is an active buff (`archetype: buff`, absorb pool 40 +14 per level for 600 ticks, reflect), not an aura: it costs 10 mana (+2 per level) and sets `player.absorb`. The "+1 mana" in the R5 note is most likely natural regeneration (the cast itself costs 10); the aura toggle (`toggleAura`) belongs to Evacuation Drill only. Spec-conform.
- The new test covers every active skill of all three classes at levels 1 and 5: mana falls by exactly the cost, a `cast` event with that cost, and the archetype's effect is visible (projectile fired, burst event, heal or buff, absorb, ally, dash, trap zone); too little mana gives a `noMana` event and no spend.

## 6. Gate and release script

`test/balance-gate.test.js` (about 11 s, bounded by ticks): per class on seeds 1, 2, 3 the careful bot clears floor 4, reaches level 6 within 45 000 ticks (12.5 min), at most 3 deaths, no stuck event, and the three class medians stay within 25 % of their common median. Today's values: floor 4 cleared at about 28 000-34 000 ticks and level 7 for every class and seed, no deaths. The release script prints the parity table with `npm run bot` style: `node bot/parity.mjs 24 150000` (about 2.5 minutes on 4 cores). Circle-02 Q7 option A is used; the fallback B (soft report) is not needed: the caster bot is reliable (24/24 wins).

## 7. Golden replay hash (contract rule, done once at the end)

Reason: balance changes alter the simulation (class formula, hp growth, monster scaling, xp table, skill numbers). `test/fixtures/run-a.hash`: `519989b11a15ab03` to `a4a3cd6a1dac3cb2`. Per class, `test/fixtures/run-class.json` (same reason): Facilities Manager `519989b11a15ab03` to `a4a3cd6a1dac3cb2` (equals the main hash, tested), Sales Rep `d7adfc1c8e1c882d` to `2871d3e9724a7936`, IT Wizard `6f5e3dfab8242a80` to `06d21319cc8b229a`. The run replays twice to the same hash and `e2e/replay.mjs` (Chromium, 5/5) agrees.

## 8. Verdict per class against the band

- Facilities Manager: clear time 27.0 min (0 %), deaths median 3 (0 %), 20-40 min yes. Not met: one tree skill (Pallet Slam) has 55 % of tree-skill damage (threshold 50 %), and one of 24 runs did not beat the boss in budget. Verdict: in the parity band for time and deaths; dominant-skill item open (small).
- Sales Rep: all items met. Was the weakest (8/12, +71 % deaths); now 24/24 at 27.4 min and 3 deaths.
- IT Wizard: time met (-3 %), no dominant skill, wins 24/24, scales from Focus. Deaths median 2 against the 3-class median 3 is one death outside the 25 % band (mean deaths inside). Verdict: in the band on time, one death short on the median-of-integers rule; this is partly the metric (see section 3) and partly real: the caster dies mostly at the boss (27 of 63 deaths) because its pool of shield and mana is the thinnest.

Remaining work if the owner wants a strict pass: lower the FM's Pallet Slam share (cost 6 to 7 mana or the bot casting Floor Buffer first), and add half a death to the IT Wizard (hp 9 to 8.5 per level was not tried; hp 8 made it worse at the boss). A third pass was outside the time box.

## 9. What bots cannot tell you (feel)

- The careful bot kites, drinks at fixed thresholds, never misclicks and never explores for fun; a human will die more on floors 4 to 7 and less at the boss telegraphs (the bot dodges them by reading state). Absolute clear times for a human are likely above the bot's: treat 20-40 min as the bot's floor, and playtest the upper end.
- Hit feel and pacing of the Sales Rep (kiting) and the IT Wizard (waiting for mana) are not measured; both finish at the same clock time as the melee class, which says nothing about whether waiting for mana is fun. The free basic attack doing about two thirds of the damage may feel flat for the two physical classes.
- The bot does not use passives' synergies, traps, Dolly Charge, Restore Backup outside emergencies, Mute or auras except Evacuation Drill: build variety and capstone fun (level 16 is now reached in a run) are untested. A human may find a build the bot cannot, and a dominant one.
- Loot luck, shop timing and potion use are seeded by the bot's own path; a human with different gear changes the class curves (the power attribute makes Focus, Agility and Grit gear affixes matter more than before; affix pools were not rebalanced).
- The monster numbers (+10 % hp and +36 % damage growth per depth over the old curve, xp needed for level 16 23 % lower) change the feel of every floor for all classes together; that needs a human pass before release.

## Verification

`npm test` 3 times: 686 / 686 pass each. `npm run build` ok. e2e (run-all, one run): audio, smoke, hook, render, combat, input, replay (5/5), realtime (8/8), ui, s3ui, r5ui, polish pass. `adv-r5` 148/150: the two failures (Respec in the Lobby returns every point; bar after respec) come from the new respec confirmation (UI-R6, commit "respec confirm"), the script clicks Respec once; not caused by BAL-R6 numbers. No e2e depends on a number I changed.
