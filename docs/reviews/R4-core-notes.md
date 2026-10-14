# R4 core notes (CORE-R4, 2026-10-14)

Note file under the R4 contract rule: "if a package needs a change it writes a note". Nothing in `R4-contract.md` was renamed. Additions and open wiring for the orchestrator are below.

## What exists now

- Core: `classes` (3), `classById`, `skillTrees`, `skills` (33 incl. basics), `at`, `manaCost`, `skillView`, `treeView`, `classCards`, `effectRows`, `validateName`, `suggestName`, `respec`, `respecCheck`, `toggleAura`, `effLevel`, `castCost`, `allyUnits`. Commands: `respec`, `toggleAura {id}`, `setName {name}`; `learnSkill` error codes as in the contract.
- Save: format version 2 (`name`, `player.respecsUsed`, `stats.playTicks`, class-validated skills), `MIGRATIONS[1]` (Clerk to Facilities Manager with refund), `src/save/slots.js` (five-slot store), `src/save/session.js` (session commands as pure functions), `src/save/hook.js` (thin hook objects).
- Bot: one class-driven policy (`bot/policy.js`), `node bot/run-headless.mjs [runs] [maxTicks] [reckless|-] [depth] [class|all]`.

## Wiring left for the shell owners (files outside the R4-CORE edit list)

1. `src/game.js`: create `store = createSlotStore(adapter, { now: () => Date.now(), tabId, onNotice })` and `session = createSession(store, { seedSource })`; call `store.migrateLegacy()` once at boot (before the title); route the session commands of the contract (`createCharacter`, `selectSlot`, `loadSlot`, `continue`, `deleteSlot`, `renameSlot`, `copySlot`, `exportSlot`, `importSlot`) with `session.run(cmd, runningState)`; expose `game.slots = slotsView(store, session.highlighted)` after every command; replace `main.js` autosave with `store.autosave(core, ev)` (writes the active slot only). `renameSlot` on the active character also needs `{t:"setName"}` to the running core.
2. `src/testhook/index.js`: mount `slots = slotsHook(store)`, `character = characterHook(session, { start })`, `tree = treeHook(() => game core state)`; `newGame({class})` already takes `class` in the core.
3. e2e that write `office-crawler.save` (`e2e/*.mjs`) must use slot keys; the legacy key is only read by `migrateLegacy`.

## Additions beyond the contract (all JSON-able, none saved)

- Events: `projectileChain {id, from, to}`, `allyHurt {id, value}`, `trigger {skill, kind, value}`; `allyDied` carries `reason` (`expired | slain | replaced`); `burst` carries `shape`; `hit` carries `damageType` and `crit` when set; floaters carry `dtype` for non-physical hits and kind `crit`.
- State: `player.mods` (derived: `damagePct, critChance, critDamage, moveSpeedPct, regenHp, regenMp, manaCostPct, skillDamagePct{}, skillLevelAll, skillLevelBranch{}`), `player.mpReserved`, `player.absorb.{skill,type}`, `player.dash.{skill,level,step,hit}`, `player.buffs[].every` (heal over time), `allies[].{skill,path,goal,next,moveT,moveTotal,attackT,flashTicks}`, `zones[].every` (fields).
- `skillView` also returns `canLearn`, `fx`, `name`, `requires[].name`; `treeView` branches carry `name` next to `nameKey`.
- Store API beyond the contract: `restorePrev(n)` (undo of overwrite / delete), `clearActive()`, `lastUsed()`, `usage()`, `keys()`, `raw(n)`; `remove(n, {confirm, forever})`.
- Config: `config.respec`, `crit`, `maxAllies`, `dotEvery`, `resistCap`, `tree`, `skillTiers`, `slotCount`, `slotMaxBytes`, `storageSoftCeiling`, `storageMaxBytes`, `slotKeyPrefix`, `slotIndexKey`; `saveVersion` is 2.
- Monsters: optional `resist` table (printer-imp fire 0.25, vending-machine cold and shock 0.25, boss fire and cold 0.25; boss cap 0.5).

## render_needs (for R5-WORLD, R5-UI, audio)

- Figure keys `hero.facilities-manager`, `hero.sales-rep`, `hero.it-wizard`; ally figures `ally.intern`, `ally.cone`; the old `PLAYER_CLASS = "clerk"` in `render/keys.js` must become the player's class figure.
- Projectile kinds now fired: `paper`, `zap`, `pen`, `card`, `sealed`, `bolt`, `shard` (and `stapler`). Chains emit `projectileChain`.
- Draw the new events: `status` (kinds stun, mute, freeze, slow, weaken, burn), `dotTick`, `crit`, `absorb`, `buffStart/End`, `aura`, `summon`, `allyDied`, `allyHurt`, `zoneStart/Trigger/End`, `dash`, `trigger`. State to draw each frame: `allies[]`, `zones[]` (`kind` trap or field, `armT`), `player.absorb`, `player.aura`, `player.dash`, monster `statusKind`, `burnT`, `slowT`, `weakenT`.
- Floaters: `kind: "crit"` and `dtype` (fire, cold, shock, acid) for tinting.
- Audio: cues for the 24 new skills (`SKILL_CUE`) and for the 18 new event types. `test/audio.test.js` lists them as pending (`PENDING_AUDIO_S3`) and carries one `todo` test that fails until `SKILL_CUE` is complete.
- Skill icons for the 24 new ids and 9 branch ids as in the contract; the old skill panel (`ui/panels.js`) still lists all 33 skills of all classes until R5-UI replaces it with `treeView`.

## Deviations and decisions

- Tests changed because the ADRs supersede them (all kept in spirit, none deleted or skipped): `character` (one melee class becomes three), `progression` (flat Clerk list becomes trees; error codes), `skills`, `projectiles`, `combat` (crit ceiling), `inventory` (class unarmed range), `s2-fix`, `s3-final` (class kit), `ui-hudstate`, `ui-itemview` (class attributes), `bot` (class policy), `audio` (pending lists), `determinism` (golden hash). The skill tests grant the skill directly; learning rules have their own tests.
- Golden hash regenerated on purpose: `run-a.hash` 155311ee9f20032d to 519989b11a15ab03 (default class Facilities Manager, new state fields, crit draws). `test/fixtures/run-class.json` pins one hash per class.
- Proxy defaults held: Clerk refunded as points; respec free (config switch); signature free at level 1; no skill cooldowns; `lastPlayed` only in the slot index; synergies: schema and runner path exist, no data (proxy ADR5-4: not before round 6).
- Evacuation Drill / Packet Filter are display names only; ids `fire-drill` / `firewall` unchanged.
- "Restore Backup clears burning" is dropped: monsters never burn the hero, so there is nothing to clear.
- Auras do not affect allies (hero only).
- Casters get skill power from the weapon share, which the Grit attribute raises; there is no spell-power attribute. A balance question for R6 (the bot gave the IT Wizard Grit and Stamina to win).
- `src/game.js`, `src/main.js`, `src/testhook/**` were off limits to this package: the session commands exist as `src/save/session.js` and wait for the wiring above.
