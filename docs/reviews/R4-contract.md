# R4/R5 data contract: classes, skill trees, slots (2026-10-14)

Learning L-13: parallel packages get a short data contract fixed **before** they start. Author: architect. Binding for R4 (core), R5-WORLD (render), R5-UI (screens and panels), R6. Design reasons are in `decisions/ADR-0005-classes-and-skill-trees.md` and `decisions/ADR-0006-save-slots.md`; this file is only shapes and names. If a package needs a change, it writes a note to `docs/reviews/R4-<package>-notes.md` and the orchestrator amends this file; nobody renames a field on their own.

## 1. Ids (closed lists; tests assert them)

```
classes   : facilities-manager | sales-rep | it-wizard         (retired: clerk -> facilities-manager)
branches  : maintenance safety logistics | pitch networking closing | infrastructure security helpdesk
basic     : strike (melee) | toss (ranged) | zap (ranged)
damage    : physical fire cold shock acid
status    : stun mute freeze slow weaken burn
```
Skill ids (30), grouped by class, in tree order:
- facilities-manager: `pallet-slam` `floor-buffer` `demolition-day` `dress-code` `coffee-break` `fire-drill` `lockout` `dolly-charge` `wet-floor` `traffic-cone`
- sales-rep: `stapler-throw` `hustle` `pen-volley` `card-fan` `intern` `reply-all` `department-meeting` `upsell` `hard-close` `commission`
- it-wizard: `server-overheat` `power-surge` `overclock` `blue-screen` `cold-boot` `firewall` `quarantine` `mute` `restore-backup` `turn-it-off`

## 2. Core API (`src/core/index.js`, pure; R4 owns)

### Content exports
```js
classes                       // array of class defs (ADR-0005 section 1)
classById(id)                 // def or undefined
skillTrees                    // { [classId]: { branches: [{ id, nameKey, iconKey, skills: [skillId...] }], skills: { [id]: SkillDef } } }
skills                        // flat { [id]: SkillDef } including basics (strike, toss, zap) - existing import keeps working
at(curve, level)              // number: min(cap, base + per * (level - 1))
manaCost(def, level)          // integer, uses def.cost.mana
skillView(state, id)          // see section 3: everything the UI needs for one node, computed (no UI logic needed)
treeView(state)               // see section 3: whole panel for the player's class
```

### Input commands (`applyInput(state, input)`; every command returns `{ok:true}` or `{ok:false, error:<code>}` and never throws)
Existing and kept: `learnSkill {id}` (this is the "spend a skill point" command; no alias is added), `assignSkill {slot, id}`, `selectSkill {index}`, `cast {skill?, tile}`, `allocate {attr}`.
New core commands:

| Command | Fields | Rules | Errors |
|---|---|---|---|
| `respec` | none | Lobby only, hero alive; mode from `config.respec`; refunds all points, keeps the signature, clears hotkeys of removed actives, clears buffs/aura/allies/zones | `not-in-town`, `dead`, `respec-off`, `respec-used`, `no-gold` |
| `toggleAura` | `{id}` | Aura skill learned and mana available to reserve; one aura at a time | `not-aura`, `not-learned`, `no-mana` |
| `setName` | `{name}` | Valid name (section 6); renames the running character; emits `renamed` | `bad-name` |

`learnSkill` error codes: `unknown-skill`, `wrong-class`, `level-gate`, `prereq`, `no-points`, `max-level`, `basic`.

### Session commands (shell level, not core; routed by `game.input` in `src/game.js`, same object shape `{t:..., ...}`; R4 owns, R5-UI calls them)
These touch storage, so they live in the shell and never in `core`. They return `{ok, error?, ...}` and update `game.slots` (below).

| Command | Fields | Effect |
|---|---|---|
| `createCharacter` | `{slot, class, name, seed?}` | Validates, builds `newGame(seed, {class, name, start:"town", wearStartKit:true})`, writes the slot, sets it active, starts play. Over an occupied slot only with `confirm:true` (UI confirms first) |
| `selectSlot` | `{slot}` | Sets the *highlighted* slot for the slot manager; no I/O |
| `loadSlot` | `{slot}` | Loads and starts the character; saves the running game first when one is active; sets active and last |
| `continue` | none | `loadSlot` of `slots.last` or the most recent `ok` slot |
| `deleteSlot` | `{slot, confirm:true}` | Removes the slot (keeps one undo copy) |
| `renameSlot` | `{slot, name}` | Rename of a stored character |
| `copySlot` | `{from, to, confirm?}` | Could (R-221) |
| `exportSlot` | `{slot, which?: "current"\|"bad"}` | Returns `{ok, text, filename}`; the UI saves the file |
| `importSlot` | `{slot, text, confirm?}` | Validates (with v1 to v2 migration), stores, updates the index |
| `openSlots` / `closeSlots` | none | Shows or hides the slot manager menu (`game.menu() === "slots"`), from Options on the title and in game |
| `openCreate` / `closeCreate` | `{slot}` | Shows or hides the class selection screen (`game.menu() === "create"`) |

Error codes: `bad-slot`, `bad-name`, `bad-class`, `empty-slot`, `occupied` (needs confirm), `confirm-required`, `corrupt`, `newer`, `too-large`, `quota`, `no-storage`.

### State fields (additions; `getState()` shows them; all JSON-able)
```
state.player.class        string classId                          (existing, now validated against classById)
state.player.name         string, valid name                      (NEW, saved)
state.player.skills       { [skillId]: level }                    (existing; includes the signature at level 1)
state.player.skillPoints  integer unspent                          (existing)
state.player.respecsUsed  integer                                  (NEW, saved; only meaningful in mode "once")
state.player.skillBar     { primary: <basicId>, secondary, hotkeys[4], selected }   (existing; primary is the class basic)
state.player.buffs        [{ skill, stat, value, t }]              (NEW, not saved)
state.player.absorb       null | { amount, t, reflect }            (NEW, not saved)
state.player.aura         null | skillId                           (NEW, not saved)
state.player.dash         null | { path, t }                       (NEW, not saved)
state.allies              [{ id, unit, owner:"player", tile, hp, hpMax, damage, ttl, taunt }]   (NEW, not saved)
state.zones               [{ id, kind:"trap"|"field", skill, level, tile, radius, armT, ttl }]   (NEW, not saved)
state.stats.playTicks     integer                                  (NEW, saved)
monster: burnT burnDmg slowT slowMag weakenT weakenMag statusKind   (NEW, not saved; muteT stays "disabled")
```
Shell (not core): `game.slots` = `{ index, active, last, highlighted, usage, lastError }` where `index` is exactly the section 4 shape; `game.menu()` additionally returns `"slots"` and `"create"`.

### Events (all carry `type`; ticks are core ticks)
Existing kept: `cast`, `levelup`, `skillLearned`, `skillSelected`, `heal`, `burst`, `muted`, `resisted`, `projectile`, `projectileEnd`, `noMana`, `autosave`.
New: 
```
{type:"cast", skill, level, cost, tile, archetype, fx}            // cast gains archetype + fx keys
{type:"respec", refunded}
{type:"buffStart", skill, stat, ticks}   {type:"buffEnd", skill}
{type:"aura", skill, on:true|false}
{type:"absorb", skill, amount, remaining}
{type:"summon", skill, unit, id, tile}   {type:"allyDied", id}
{type:"zoneStart", id, skill, kind, tile, radius}   {type:"zoneTrigger", id}   {type:"zoneEnd", id}
{type:"dash", skill, from:{x,y}, to:{x,y}}
{type:"status", target, kind, ticks}      // kind in status list; replaces most uses of "muted"
{type:"dotTick", target, kind, value}
{type:"crit", target}
{type:"renamed", name}
{type:"autosave", reason}                 // unchanged; the shell decides which slot
```
Shell notices (string keys in the strings table, no new event): `slotSaved`, `slotDeleted`, `slotImported`, `slotMigrated` (with `refunded`), `slotCorrupt`, `saveTooNew`, `saveFailed`, `storageFull`, `anotherTab`.

## 3. Skill tree data shape the UI renders

`treeView(state)` returns (the UI renders this and never reads `SkillDef` for rules):
```js
{
  classId: "sales-rep", points: 7, level: 12, respec: { available: true, mode: "free", cost: 0, reason: null },
  branches: [{
    id: "pitch", nameKey: "branchPitch", iconKey: "branch:pitch", spent: 6,
    nodes: [{
      id: "stapler-throw", nameKey|name: "Stapler Throw", textKey: "skillStaplerText", iconKey: "stapler-throw",
      tier: 1, col: 0, kind: "active", archetype: "projectile", tags: ["physical","projectile"],
      level: 3, bonus: 1, maxLevel: 5, reqLevel: 1, signature: true,
      requires: [{ id: "...", level: 1, met: true }],
      state: "learned" | "available" | "locked-level" | "locked-prereq" | "maxed" | "no-points",
      lockReason: "Needs character level 8" | "Needs Hustle 1" | null,          // already worded from strings, never colour-only (NFR-A07)
      cost: { mana: 6, cooldown: 0, reserve: 0 },                                 // at current level (level 1 values when unlearned)
      now: [{ labelKey: "statDamage", value: "12-20", type: "physical" }, ...],    // the numbers at current level, pre-formatted
      next: [{ labelKey: "statDamage", value: "14-24", type: "physical" }, ...],   // same list at level+1 (empty when maxed)
      assigned: 0 | 1 | 2 | 3 | null,                                              // hotkey slot index the skill sits in
    }],
    edges: [{ from: "stapler-throw", to: "pen-volley" }],
  }],
}
```
The `now/next` rows are produced by one generic function from `effects` (damage range, duration, radius, heal, absorb, count), so tooltips for all 30 skills need no per-skill text code; only `textKey` (one sentence) is hand-written. `skillView(state, id)` returns one node. `state` meanings are mutually exclusive and ordered as listed; `no-points` means learnable otherwise. The UI always shows `state` as text or icon plus text.

Class selection data: `classCards()` (core, pure) returns for each class `{ id, name, role, blurbKey, figureKey, attrs, derivedPreview: { hp, mp, damage }, branches: [{ id, nameKey, iconKey, skills: [{id, iconKey, nameKey}] }], signature, basic }`. The selection screen needs nothing else.

## 4. Slot metadata shape (the index; the same in `game.slots.index` and in the test hook)

```js
{ v: 2, active: 2|null, last: 2|null, owner: "<tab id>"|null,
  slots: [ // always exactly 5 entries, n = 1..5
    { n:1, state:"empty" }
    | { n:2, state:"ok", name, class, level, depth, deepest, playSec, lastPlayed, bytes, sum, boss }
    | { n:3, state:"bad", reason:"parse"|"checksum"|"schema"|"size", lastPlayed?, bytes? }
    | { n:4, state:"newer" }
  ] }
```
`lastPlayed` is epoch ms, formatted by the UI in the browser locale; it exists only in the index. `playSec = stats.playTicks / config.tickHz`. The slot card shows: number, name, class name and icon, "Level N", depth ("Floor N" or "Lobby"), play time (`h:mm`), last played (relative or date), plus a state badge for bad/newer with text.

Test hook (`window.__app`, ADR-0003 extended; thin, no logic): `slots.list()` returns the index; `slots.raw(n)` returns the slot text; `slots.keys()` returns the `office-crawler.*` keys; `slots.fail(on)` makes the adapter reject writes; `character.create({slot, class, name})`; `character.cards()`; `tree.get()` returns `treeView`; `tree.learn(id)`; `tree.respec()`. Existing `newGame({class?})` accepts `class`, default `facilities-manager`.

## 5. `render_needs` (what R5-WORLD must supply; R5-UI uses the same keys)

### Class figures (`figureKey`; atlas test: every key has every animation)
`hero.facilities-manager`, `hero.sales-rep`, `hero.it-wizard`.
Animation keys per figure (8 directions as today's hero): `idle`, `walk`, `attack` (basic, melee or throw/zap by class), `cast`, `hurt`, `die`. Plus `portrait` (large static pose for the card, same rig, drawn at 256 px logical) and `card-idle` (looping 8-frame idle, a deliberate flourish per class: a clipboard tap, a stapler flick, a monitor flicker). Reduced motion uses `portrait`. Visual identity: Facilities Manager broad, hi-vis vest, keys at belt, pipe wrench; Sales Rep slim, tie and lanyard, letter opener; IT Wizard hoodie or robe-like cardigan, lanyard, USB staff with glow. Accent colours: orange `#e8782a`, teal `#2aa7a0`, violet `#8a5be0` (the UI may adjust for contrast; keys of the tokens: `--class-facilities`, `--class-sales`, `--class-it`).
Ally figures: `ally.intern`, `ally.cone` (anim `idle`, `walk`, `attack`, `die`; cone has `idle` only).

### Skill icons (by skill id, `skillIcon(id)` in `src/ui/icons.js`, 40x40 viewBox, same outline style)
All 30 ids in section 1. Already present and kept: `stapler-throw`, `reply-all`, `coffee-break`, `mute`, `dress-code`, `hustle`, `strike`. New (24): `pallet-slam` `floor-buffer` `demolition-day` `fire-drill` `lockout` `dolly-charge` `wet-floor` `traffic-cone` `pen-volley` `card-fan` `intern` `department-meeting` `upsell` `hard-close` `commission` `server-overheat` `power-surge` `overclock` `blue-screen` `cold-boot` `firewall` `quarantine` `restore-backup` `turn-it-off`. Basic attacks: `toss`, `zap` (plus existing `strike`). Branch icons: `branch:maintenance` `branch:safety` `branch:logistics` `branch:pitch` `branch:networking` `branch:closing` `branch:infrastructure` `branch:security` `branch:helpdesk`. Class icons: `class:facilities-manager` `class:sales-rep` `class:it-wizard`. State marks for nodes (also in text): `node:learned`, `node:locked`, `node:maxed`.

### Effect FX archetypes (render draws by `fx` key, tinted by `damage type`; `cast` and `hit` come from `cast`, `projectile`, `status`, `zone*`, `dash`, `summon` events)
| key | used by | note |
|---|---|---|
| `fx:slam` | pallet-slam, demolition-day | ground crack, dust, short camera shake (not under reduced motion) |
| `fx:ring` | floor-buffer, reply-all, mute | expanding ring at `radius`; `burst` event already carries the radius |
| `fx:burst` | blue-screen, turn-it-off, quarantine | big filled burst; tinted shock/cold, with static or frost pattern |
| `fx:ground` | server-overheat | lingering ground field (flames or heat shimmer), lives as long as the zone |
| `fx:bolt` | power-surge | chained arc between targets (uses the `status`/hit target list) |
| `fx:shard` | cold-boot | projectile, ice shard with trail |
| `fx:paper` | stapler-throw, pen-volley, card-fan, toss | projectile kinds `stapler` (exists), `pen`, `card`, `paper` |
| `fx:mark` | hard-close | projectile `sealed` with a visible finisher flash on `crit`/execute hit |
| `fx:glow` | coffee-break, restore-backup | green heal rising motes (exists for heal), `hot` tick pulses |
| `fx:shield` | lockout, firewall | wrapping dome around the hero while `absorb` is active; flash on `absorb` event |
| `fx:aura` | fire-drill | slow pulsing ground ring while `player.aura` is set |
| `fx:summon` | intern, department-meeting, traffic-cone | puff of paper and sparkles at the spawn tile |
| `fx:dash` | dolly-charge | motion streak along `from`..`to` plus the hand truck sprite for the dash duration |
| `fx:trap` | wet-floor | the sign on the ground; armed/triggered states (`zoneStart`, `zoneTrigger`) |
| `fx:status` | all `status` events | small icons over monsters: stun stars, mute cross, freeze crystal, slow snail dots, weaken cracks, burn flames |
| `fx:crit` | upsell and any `crit` event | larger floater, short white flash |
Hit sprites follow the existing floaters; damage numbers get a tint per damage type (physical white, fire orange, cold light blue, shock yellow, acid green) and an icon-free text label for accessibility (the floater kind in `title` text, no colour-only information). All FX respect `options.reducedMotion` (static or single-frame) and `reducedFlash`.

### Class selection screen
Render surface: the existing lobby scene may be reused as the backdrop; the card UI is DOM (R5-UI), the figure on the card is drawn by R5-WORLD through `drawFigure(canvas, figureKey, {anim:"card-idle"|"attack"|"portrait", t})` (new small export of `render/`). Frame budget (NFR-P06): one figure at a time plus a background, 60 fps desktop, at most 3 ms per frame.

## 6. Names and validation (core `validateName(name)` -> `{ok, name?, error?}`, also used by the UI)
Trim; collapse inner runs of spaces; 1-16 characters; allowed: Unicode letters, digits, space, hyphen, apostrophe; no control or markup characters; stored and rendered as text only (`textContent`); `suggestName(index)` (pure, no randomness) returns one of 24 fixed, original job-title style names such as "Sir Stapleton", "Desk Pilot 7" or "Agent Break-Room" (no real people's names); the UI cycles the index. Empty or invalid disables Begin.

## 7. Ownership of files (no overlap; cross-needs go through notes files)

| Package | May edit |
|---|---|
| R4-A core classes and trees | `src/core/content/{classes,skills,skilltrees/*,strings}.js`, `src/core/systems/{skills,skillfx,progression,allies,zones,statuses}.js`, `src/core/items/{derive,roll}.js`, `src/core/content/{affixes,monsters,items}.js`, `src/core/{state,config,index}.js`, `src/core/systems/{intent,combat,ai,movement,damage}.js` (only the named hooks), `test/*` for these |
| R4-B save slots (parallel-ok with R4-A after the migration stub) | `src/save/*`, `src/game.js` (session commands, `game.slots`), `src/main.js`, `src/testhook/*`, `test/save*.test.js`, `e2e/save.mjs` |
| R5-WORLD | `src/render/**`, `src/ui/icons.js` (icon bodies only), `e2e/render.mjs`, `e2e/world-*.mjs`, notes `docs/reviews/R5-world-notes.md` |
| R5-UI | `src/ui/{panels,screens,options,layout,text,messages}.js`, `src/style.css`, `src/index.html`, `e2e/ui.mjs`, notes `docs/reviews/R5-ui-notes.md` |
`core` stays free of DOM, `Date`, `Math.random` (layering test). The shell is the only place that reads a clock.
