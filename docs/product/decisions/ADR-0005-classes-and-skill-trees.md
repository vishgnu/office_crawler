# ADR-0005 Classes and skill trees: one data model, a handful of effect archetypes

Date: 2026-10-14. Status: proposed (plan gate for rounds R4-R6). Owner: architect.
Implements R-200..R-209, R-231, R-232, R-233, R-234 (area M). Customer answers are binding: `circles/circle-02.md` (PROXY, 2026-10-14) Q1 (three classes, Clerk retired, refund), Q2 (3 branches, about 10 skills, 3 tiers at levels 1/8/16, 1 point per level, 29 points at cap 30, max skill level 5, capstones single level, one earlier skill plus a level gate, synergies optional), Q3 (free respec in town), Q4 (items shared, class-tagged affixes only). This ADR decides technical shape only; names, numbers and wording that the customer owns are listed under "Questions for the customer" and the design works with either answer.
Interacts with: ADR-0002 (pure core, data-driven content, events), ADR-0003 (test hook), ADR-0004 (assets in code), ADR-0006 (slots, save version 2).

## Context

Today (read from the code, 2026-10-14):
- `content/classes.js` holds one class `{id, name, kind, attrs}`; `newGame` builds the player from it; `save/format.js` validates `class` against that list.
- `content/skills.js` is flat: 1 basic, 4 actives (`effect`: projectile, burst, heal, crowd-control) and 2 passives (`stat`, `perLevel`). Values are functions (`lin(base, per)`), so they cannot be serialised, listed in a tooltip generically or checked by a data test. `systems/skills.js` has one `if` branch per effect; `derive.js` reads passives through `passiveSkills`; the skill panel is a flat list (`ui/panels.js` `renderSkills`).
- `learnSkill` checks only points and max level. There is no tree, no prerequisite, no level gate, no respec, no timed buff, no summon, no trap, no dash, no damage type on skills (the config already has `damageTypes: fire, cold, shock, acid` for item resist, but monsters have no resist table).
- `muteT` is the one monster status; the boss is exempt.

Thirty skills written as thirty `if` branches would be thirty code paths to test, balance and render. The goal is thirty rows of data over about nine code paths.

## Decision

### 1. Class definition (`src/core/content/classes.js`)

```js
{
  id: "facilities-manager",            // stable key; saves and slot index store this
  name: "Facilities Manager",          // working name (brand escalation, R-233); display only
  role: "melee",                        // melee | ranged | caster  (tag on the selection card, bot policy default)
  blurbKey: "classFacilitiesBlurb",     // strings table key (UI owns the words)
  figureKey: "hero.facilities-manager", // renderer sprite-set key; also used for the card portrait
  attrs: { grit: 16, agility: 8, stamina: 14, focus: 6 },       // starting attributes (sum 44 for all three; tuning in R6)
  derived: { hpPerLevel: 14, mpPerLevel: 3, hpPerStamina: 3, mpPerFocus: 2, unarmed: { min: 2, max: 4 } }, // optional overrides of config.derived, merged key by key
  basic: "strike",                      // id of the free basic attack: "strike" (melee), "toss" (ranged, paper), "zap" (ranged, mana-free, short)
  startKit: { weapon: "pipe-wrench", healthPotions: 2, manaPotions: 0, extra: [] }, // base ids from content/items.js
  signature: "pallet-slam",             // tier-1 active, granted free at level 1, never refunded
  branches: ["maintenance", "safety", "logistics"],  // ordered tab order; the tree lives in content/skilltrees/<class>.js
  affixTag: "facilities",               // class tag for class-tagged affixes (section 7)
  bot: { stance: "melee", kite: 0, potionHp: 0.4, manaReserve: 0.15,
         priority: ["demolition-day", "floor-buffer", "pallet-slam", "coffee-break"], buildOrder: ["pallet-slam", "dress-code", "floor-buffer", "fire-drill"] }, // policy hints for bot/policy.js
}
```
Rules: ids are kebab-case and unique; the three `attrs` sums are equal (parity check in the data test); `derived` keys are a subset of `config.derived`; `startKit` bases exist; `signature` is in the class's own tree at tier 1; `figureKey` must exist in the atlas (R-232 atlas test). Exports: `classes`, `classById`, `defaultClass` (first class, used by fixtures and old tests; fixtures keep working with `class: "facilities-manager"`), `retiredClasses = { clerk: { migrateTo: "facilities-manager" } }`.

The attribute names stay Grit, Agility, Stamina, Focus (Q4). Classes differ by start values, growth (`derived`), basic attack, kit, signature and tree. Item requirements are class-independent.

### 2. Skill tree schema (`src/core/content/skilltrees/{facilities,sales,it}.js`, merged by `content/skills.js`)

The tree is plain JSON-able data: no functions. A numeric value that grows with skill level is a **curve** `[base, perLevel]` (optionally `[base, perLevel, cap]`), evaluated by one helper `at(curve, level) = min(cap, base + perLevel * (level - 1))`. This replaces `lin()`.

```js
{
  id: "floor-buffer", class: "facilities-manager", branch: "maintenance",
  tier: 2, col: 1,                       // tier 1..3 = row in the panel, col 0..2 = column; UI draws edges from `requires`
  name: "Floor Buffer Sweep", textKey: "skillFloorBufferText",
  kind: "active",                        // basic | active | passive | aura
  archetype: "area",                     // projectile | area | self | buff | aura | summon | dash | trap | passive | melee (section 3)
  maxLevel: 5,                           // 1 for capstones; never above config.skillMaxLevel
  reqLevel: 8,                           // character level gate; tiers default to config.skillTiers = [1, 8, 16]
  requires: [{ id: "pallet-slam", level: 1 }],   // all must be learned at least to this level; same branch only
  tags: ["physical", "area", "heavy"],  // free tags; used by class-tagged affixes ("+x% heavy skill damage") and the UI filter
  cost: { mana: [8, 2], cooldown: 0, reservePct: 0 },   // cooldown in ticks (0 = none, QF-06-5); reservePct only for aura
  delivery: { ... },                     // archetype specific, section 3
  effects: [ ... ],                      // ordered list of ops, section 4
  synergy: [{ from: "pallet-slam", stat: "damagePct", perLevel: 6 }],  // optional (R-208, could): bonus per level of another skill
  fx: { cast: "fx:slam", hit: "fx:dust", icon: "floor-buffer" },       // render keys, section 6
}
```
Checks that the data test enforces (R-202..R-204, R-233): 3 branches per class; 10 skills per class (the exact count is a test constant so a later tweak is deliberate); skill ids unique across all classes; every `requires` exists in the same branch with lower tier (hence no cycles); `reqLevel` is not below the tier default; every branch has at least one active; `maxLevel` in 1..5; every `textKey` exists in strings; every `fx.icon` has an icon body; legal scan over names and texts (denylist). Point sanity: sum of `maxLevel` of a class tree is at least 1.3 times the 29 usable points, so a character cannot max everything and must choose a build.

**Player state.** `player.skills = { [skillId]: level }` stays (save-compatible shape). Unspent points stay in `player.skillPoints`. Learning rules (`learnSkill`, extended in `systems/progression.js`): the skill must belong to the player's class; `reqLevel <= player.level`; every prerequisite met; points at least 1; level below `maxLevel`; the signature is already at level 1 and costs nothing. Rejected learns spend nothing and return `{ok:false, error}` with a stable code (`wrong-class`, `level-gate`, `prereq`, `no-points`, `max-level`). Points: `config.skillPointsPerLevel = 1`, so a level-30 character has earned 29; the signature is free. Accounting invariant (R-205): `sum(levels) - 1 + skillPoints === levelsGained`, where the minus one is the signature.

**Effective level.** `effLevel = learned > 0 ? learned + bonus : 0`, where `bonus` comes from gear (section 7). The bonus is not capped by `maxLevel` (curves are linear with an optional `cap`); the panel shows `3 (+2)`.

### 3. Archetypes: the delivery side

Each archetype is a function in `systems/skillfx.js` (the new runner; `systems/skills.js` keeps `castSkill` as the entry and calls the runner). The runner replaces the current `if (effect === ...)` chain.

| Archetype | Delivery fields | What the runner does | Today's skills it covers |
|---|---|---|---|
| `projectile` | `kind` (FX key), `speed`, `range`, `count` (1), `spreadDeg`, `pierce` (0), `chain` (0 jumps, falloff) | Fires `count` shots through `fireProjectile`; each carries the skill's `effects` as an on-hit list (`pr.hit = {skill, level}`) | Stapler Throw |
| `area` | `shape: burst/cone/ring`, `radius` curve, `at: self/target`, `los: true`, `linger: {ticks, every}` | Applies on-hit effects to every monster in range and line of sight; a `linger` leaves a ground zone (section 5) | Reply-All, Mute |
| `self` | none | Applies effects to the caster (heal, instant restore) | Coffee Break |
| `buff` | `ticks` curve | Adds a timed `player.buffs[]` entry (stat mods, absorb) | new |
| `aura` | `radius` | Toggle (`toggleAura`): reserves `reservePct` of `mpMax`; while on, its stat mods apply to the hero and allies in radius; one aura at a time | new |
| `summon` | `unit` (id in `content/allies.js`), `count`, `max`, `ticks` | Spawns allies into `state.allies` (cap `config.maxAllies = 4`); allies follow, attack, expire | new |
| `dash` | `distance` curve, `ticks` | Moves the hero along the line (walkable, in LOS) over a few ticks; applies effects to monsters crossed and at the end | new |
| `trap` | `armTicks`, `ttl`, `radius`, `max` | Places a ground zone that triggers on the first monster inside | new |
| `passive` | none | No cast; effects are stat mods or triggers, folded in by `deriveStats` | Dress Code, Hustle |
| `melee` | `range`, `cone` | Only for basic attacks of other classes if needed; resolves through the existing swing path | Strike |

Basic attacks stay `kind: "basic"`, free, outside the 10: `strike` (melee, existing), `toss` (projectile, low damage, range about 7) and `zap` (projectile, short range). The click-to-attack path asks the class's basic archetype: melee walks adjacent; projectile stops in range and in line of sight and fires. The skill bar `primary` is the class basic.

### 4. Effects: the "what happens" side

An effect is `{ op, ...fields }`, processed by one `applyEffect(state, ctx, effect, level, target)` switch. All numbers are curves. Ops:

| op | Fields | Notes |
|---|---|---|
| `damage` | `type` (physical, fire, cold, shock, acid), `min`, `max`, `weaponShare` | Typed damage. Monster `resist: {fire: 0.25}` (optional table in `content/monsters.js`, default 0, cap 0.75; bosses at most 0.5) reduces it. Physical keeps the current hit chance and defense path; non-physical skips the hit roll (spells always land) |
| `dot` | `type`, `perTick`, `ticks`, `every` | Burn and poison: `m.burnT`, `m.burnDmg` (one stack per monster, the stronger refreshes) |
| `heal` / `hot` | `amount`, `ticks`, `every` | `hot` ticks through `player.buffs` |
| `status` | `kind: stun / mute / slow / freeze / weaken`, `ticks`, `mag` | `stun`, `mute` and `freeze` all set the existing `muteT` ("disabled"; `m.statusKind` tells the renderer which effect to show). `slow` sets `slowT/slowMag` (movement and attack pace). `weaken` sets `weakenT/weakenMag` (damage taken up, defense down). Bosses resist stun, mute and freeze (event `resisted`, as today) and take half duration of slow and weaken |
| `knockback` | `tiles` | Reuses `knockBack` |
| `absorb` | `amount`, `ticks`, `reflectPct` | `player.absorb = {amount, t, reflect}`; hostile damage drains it first |
| `statMod` | `stat`, `value`, `ticks` (timed buff) or none (passive) | Stats: `defense`, `attackRating`, `hpMax`, `mpMax`, `damagePct`, `critChance`, `critDamage`, `moveSpeedPct`, `resist.<type>`, `regenHp`, `regenMp` |
| `execute` | `below`, `mult` | Damage multiplier against targets below a health fraction (finishers) |
| `trigger` | `on: kill / hit / hurt`, `then: [effects]` | Passive triggers (mana or gold on kill) |
| `summon` | `unit`, `count`, `hp`, `damage`, `ticks` | Through the `summon` archetype |

New rolls: `critChance` / `critDamage` join `deriveStats`; `rollSwing` multiplies on a crit (the `combat` stream is used for the crit roll, one extra draw per hit, so replay hashes change once in R4 and are re-pinned there). `deriveStats` replaces the `passiveSkills` loop with a fold over learned passives (and active auras and buffs) of `statMod` effects; it stays a pure function of `(player, equipment)` plus `player.skills`, `player.buffs`, `player.aura`.

Event additions (R4 contract): `cast` (existing, now carries `archetype`, `fx`), `skillLearned`, `respec`, `buffStart`/`buffEnd`, `aura`, `summon`, `allyDied`, `zoneStart`/`zoneTrigger`/`zoneEnd`, `dash`, `status` (target, kind, ticks), `crit`, `absorb`, `dotTick`.

### 5. New state (all JSON-able, in `newGame`)

`player.buffs: []`, `player.absorb: null`, `player.aura: null`, `player.dash: null`, `state.allies: []`, `state.zones: []` (traps and lingering fields share one structure `{id, kind, skill, level, tile, radius, armT, ttl, effects}`), monster fields `burnT, burnDmg, slowT, slowMag, weakenT, weakenMag, statusKind`. None of these is saved (mid-floor, as the save format says); on load they are empty. Allies and zones clear on floor change and on respec. Monster melee may pick a living ally in reach instead of the hero; a `decoy` summon (`taunt: true`) wins that choice.

### 6. Rendering contract in one paragraph

Render and UI get the skill tree as data (`content.skillTrees[classId]`) and never import effect code. Icons are looked up by skill id (`skillIcon(id)`; the six existing ids keep their bodies, 24 new ones are drawn in code). Effects are drawn by **FX archetype** keys, not by skill: `fx.cast` and `fx.hit` come from a small closed set (the full list is in `docs/reviews/R4-contract.md`, `render_needs`), so thirty skills need about fourteen effect drawings, tinted by damage type. Class figures are selected by `figureKey` from the same rig as today's hero, with per-class palettes and one accessory per class.

### 7. Class-tagged affixes and shared items (Q4 option A)

Affix definitions get two optional fields: `class: "<affixTag>"` and a stat key from a closed set: `skillLevel.all` (+n to all skills of the class), `skillLevel.branch.<branchId>`, `skillDamagePct.<tag>`, `manaCostPct`. The item roller takes the **current character's class** when rolling loot, vendor stock and gifts: a class-tagged affix can only be rolled for a character whose `affixTag` matches, which is deterministic (same seed and class, same loot). Because the stash is per character (ADR-0006) and there is no trade, a tagged item never reaches another class; an imported slot keeps its own class. Tagged affixes use group names that do not collide with the generic groups (an item still carries at most one affix per group) and the item name reads in the same office humour ("of the Corner Office"). Item requirements (level, attributes) are class-independent (R-231). Planned set for R4: per class 2 affixes on weapon, ring and amulet (`skillLevel.all`, `skillLevel.branch.<one of its branches>`), plus `skillDamagePct.projectile`, `.area`, `.summon` where fitting; tooltip shows the class tag in the accent colour of that class.

### 8. Respec (Q3 default A, flip-able)

`config.respec = { mode: "free", townOnly: true, goldBase: 0, goldPerLevel: 0 }`; modes `free`, `gold` (cost = `goldBase + goldPerLevel * level`), `once` (one free respec per character, then off), `off`. The core command `respec` is valid only in the Lobby (`state.scene === "town"`) and with the hero alive. Effect: every skill except the signature goes to 0 (signature stays at 1); `skillPoints` becomes `levelsGained - 0` (all earned points back); hotkeys holding removed actives become empty (the signature keeps its slot if it had one); buffs, aura, allies and zones clear; attribute points are not touched (attributes are never respecced, LATER). Event `respec {refunded}`. Under `once`, `player.respecsUsed` counts. Changing the customer's answer costs one config edit and one test constant.

### 9. Migration of the retired Clerk (save version 1 to 2; the slot side is in ADR-0006)

Registered as `MIGRATIONS[1]` in `save/migrate.js`, pure and idempotent on a v2 input (it is only called for `version === 1`):
1. `class: "clerk"` becomes `"facilities-manager"` (via `retiredClasses`). Any other unknown class id is a `schema` failure, not a silent mapping.
2. Refund: `skillPoints = skillPoints + sum(levels of every old skill)`. `skills` becomes `{ "pallet-slam": 1 }` (the signature, free), and the refund does not count the signature (the player never paid for it). The skill bar becomes `primary: "strike"`, `hotkeys: ["pallet-slam", null, null, null]`, `selected: 0`.
3. Attributes are kept exactly as the player left them (a Clerk started with 10 each plus spent points); derived stats now use the class overrides. No attribute refund (attributes are not respecced).
4. Items, stash, belt, gold, level, xp, depth, boss flags, explored maps and random streams are kept untouched. New fields: `name` (default `"Employee"`), `version: 2`, `stats.playTicks: 0`.
5. The old Clerk skill ids that survive (`stapler-throw`, `reply-all`, `coffee-break`, `mute`, `dress-code`, `hustle`) live on in the new trees under new owners (see the lists below), so the icon bodies and strings carry over; but because the class changes owner for most of them, a refund (not a remap) is the rule the customer agreed.
6. The migration returns a note `{ migrated: { from: 1, refundedPoints: n } }` the shell shows once ("Your Clerk became a Facilities Manager; N skill points are ready to spend").

Test (R-225): a synthetic v1 fixture with 3 skill levels spent migrates to a v2 save whose `skillPoints` equals the old unspent plus 3 plus the old extras, the class is `facilities-manager`, `validate` passes, migrating the output again is a no-op, and a corrupt v1 returns `schema` without throwing.

### 10. Proposed skills (3 classes x 10; names original and office-themed, all working names under R-233)

Archetype shorthand: PRJ projectile, ARE area, SLF self, BUF buff, AUR aura, SUM summon, DSH dash, TRP trap, PAS passive. Tier gates are levels 1 / 8 / 16 (config). Max level 5, capstones (tier 3 "cap") 1. `*` = id and icon body inherited from the retired Clerk.

**Facilities Manager** (melee, tough; basic `strike`; signature Pallet Slam; kit: pipe wrench, 2 health potions)

| Branch | Tier | Skill (id) | Arch. | One-line effect |
|---|---|---|---|---|
| Maintenance (heavy hits) | 1 | Pallet Slam (`pallet-slam`) | ARE | Smashes a pallet down in front of you: physical burst, short radius, staggers |
| Maintenance | 2 | Floor Buffer Sweep (`floor-buffer`) | ARE | Spinning buffer: wide physical ring, knocks everything back |
| Maintenance | 3 cap | Demolition Day (`demolition-day`) | ARE | Wrecking ball swing: very large physical burst, doubles against staggered targets |
| Safety (defence, auras) | 1 | Dress Code* (`dress-code`) | PAS | Steel-capped shoes and a hi-vis vest: defense per level |
| Safety | 2 | Coffee Break* (`coffee-break`) | SLF | Sit down and drink: heal, mana-cheap |
| Safety | 2 | Fire Drill (`fire-drill`) | AUR | Everyone out in an orderly line: aura, resist to all four elements and defense, reserves mana |
| Safety | 3 cap | Lockout/Tagout (`lockout`) | BUF | Padlock on the power: absorb shield for a few seconds, reflects part of melee damage |
| Logistics (mobility, traps) | 1 | Dolly Charge (`dolly-charge`) | DSH | Shove a hand truck: dash that damages and pushes what it crosses |
| Logistics | 2 | Wet Floor (`wet-floor`) | TRP | Drops a yellow sign: trap that slows and weakens whoever steps in |
| Logistics | 3 cap | Traffic Cone Wall (`traffic-cone`) | SUM | Sets out a row of cones: up to 3 decoys that draw monster attacks |

**Sales Rep** (ranged, agile; basic `toss`; signature Stapler Throw; kit: letter opener, 2 health potions)

| Branch | Tier | Skill (id) | Arch. | One-line effect |
|---|---|---|---|---|
| Pitch (ranged) | 1 | Stapler Throw* (`stapler-throw`) | PRJ | Single heavy staple shot: physical, weapon-scaled |
| Pitch | 1 | Hustle* (`hustle`) | PAS | Always be closing in: attack rating per level |
| Pitch | 2 | Pen Volley (`pen-volley`) | PRJ | Three to five pens in a fan: physical, light each |
| Pitch | 3 cap | Business Card Fan (`card-fan`) | PRJ | Throws a ring of cards, pierces through the first target |
| Networking (summons, allies) | 1 | Summer Intern (`intern`) | SUM | Hires an intern who runs at monsters and fights until the shift ends |
| Networking | 2 | Reply-All* (`reply-all`) | ARE | Mass mailing: physical burst that knocks back |
| Networking | 3 cap | Department Meeting (`department-meeting`) | SUM | Calls three interns at once, with a long shift |
| Closing (crit, finishers) | 1 | Upsell (`upsell`) | PAS | Reads the room: critical chance per level |
| Closing | 2 | Hard Close (`hard-close`) | PRJ | Sealing shot: damage rises sharply against targets under 35 percent health (`execute`) |
| Closing | 3 cap | Commission (`commission`) | PAS | Kills pay out: restores mana and adds gold on kill (`trigger`) |

**IT Wizard** (caster; basic `zap`; signature Server Overheat; kit: USB staff, 2 health potions, extra mana potion)

| Branch | Tier | Skill (id) | Arch. | One-line effect |
|---|---|---|---|---|
| Infrastructure (fire, shock) | 1 | Server Overheat (`server-overheat`) | ARE | Cooling fails at the target spot: fire burst plus burning (`dot`), lingers as a hot zone |
| Infrastructure | 2 | Power Surge (`power-surge`) | PRJ | Shock bolt that chains to nearby monsters with falling damage |
| Infrastructure | 2 | Overclock (`overclock`) | PAS | Fire and shock damage up per level, mana cost slightly up |
| Infrastructure | 3 cap | Blue Screen (`blue-screen`) | ARE | Giant shock burst that freezes everything in it with a screen of static |
| Security (ice, shields) | 1 | Cold Boot (`cold-boot`) | PRJ | Ice shard: cold damage, slows |
| Security | 2 | Firewall (`firewall`) | BUF | Barrier: absorb shield and cold reflect for a while |
| Security | 3 cap | Quarantine (`quarantine`) | ARE | Seals an area in ice: cold damage and freeze |
| Helpdesk (heals, debuffs) | 1 | Mute* (`mute`) | ARE | Mutes everything in range (disabled for a time; bosses resist) |
| Helpdesk | 2 | Restore Backup (`restore-backup`) | SLF | Heals over time and clears burning |
| Helpdesk | 3 cap | Have You Tried Turning It Off (`turn-it-off`) | ARE | Everything in range is stunned, then takes extra damage for a while (`weaken`) |

Counts: 10 per class; Facilities 3 + 4 + 3, Sales 4 + 3 + 3, IT 4 + 3 + 3 (the circle asked about 3 + 3 + 4; the split is free). Active per branch: yes (every branch has at least one active). Spread: 5 PAS in total, 6 projectile, 9 area, 2 self, 3 buff or aura, 3 summon, 1 dash, 1 trap. Names to run through `ip-denylist*.txt` in the R4 legal test; "Firewall" and "Fire Drill" are ordinary words but sit near a genre skill called Fire Wall, so they carry a legal-scan note with the fallbacks "Packet Filter" and "Evacuation Drill" (id unchanged; the name is a string).

## Options considered

1. **Per-skill code** (status quo scaled to 30): fastest to write the first skill, but 30 branches to test and per-skill UI exceptions. Rejected.
2. **Full scripting language or expression strings** for effects: flexible, but needs an interpreter, a sandbox rule and error handling; overkill for a closed set. Rejected.
3. **Archetype plus op list as data (chosen):** about nine delivery archetypes and about twelve effect ops cover all 30 skills; new skills later are rows. The cost is a generic tooltip builder and a runner with a larger switch, both unit-testable once.
4. Tree as one file with all classes vs. per-class files: per-class files chosen (diff size, parallel work); `content/skills.js` merges them and exports `skills` (id lookup, as today) so existing imports keep working.

## Consequences

- Save version 2 (with ADR-0006). `save/format.js` validates `skills` against the merged table and the class against `classById`; unknown skill ids in a v2 save are a `schema` failure.
- `ui/panels.js` `renderSkills` is replaced by a tree panel (tabs per branch, node graph from `tier`/`col`/`requires`, tooltip from `effects`); `d.mana(level)` call sites change to `manaCost(def, level)`.
- `deriveStats` signature stays; `passiveSkills` export is replaced by a helper; `castSkill` keeps its public name and result shape.
- Replay hashes change once in R4 (crit draws, new state fields); fixtures pin the new hashes in the same WP.
- Balance numbers (curves, attribute starts, mana) are placeholders in data, tuned in R6 by per-class bot runs against the parity band in R-230; no code change is needed to tune.
- Dependency licences: none added.

## Questions for the customer (L-05: not decided here; the design fits either answer)

1. Final class names and the game title are brand questions (R-233, QF-06-1): working names stay Facilities Manager, Sales Rep, IT Wizard. Names are strings; ids are internal.
2. The respec rule (circle-02 Q3, PROXY with low confidence) can be switched to gold, once or off by one config value.
3. Whether the starting hero should be auto-given its signature skill (assumed yes to keep the 29-point rule and a playable first minute) or start with one open point; the data supports both.
4. Whether skill synergies (R-208, could) are wanted in this round; the schema reserves `synergy` and R6 implements it only if there is room.
