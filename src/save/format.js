// The save format (S3-3, R-090..R-092, NFR-D03). A save is canonical JSON text: sorted keys, one `checksum` field over the rest
// (corruption and truncation detection, not anti-cheat). Persisted: the character, items, stash, gold, how deep the hero has been,
// the boss flags, explored maps, the random streams and the options. Not persisted: anything mid-floor (monsters, ground items,
// projectiles, the hero's tile, open dialogs); a loaded game resumes in the Lobby or at the entry of the saved floor (QF-09-2).
//
// serialize(state) -> text.   deserialize(text) -> { ok: true, state, save } | { ok: false, reason, message }.   Neither throws.
// reasons: parse | format | newer | no-migration | checksum | schema | size
import { config } from "../core/config.js";
import { canonical, hashString } from "../core/hash.js";
import { newGame } from "../core/state.js";
import { applyDerived } from "../core/items/derive.js";
import { enterFloor } from "../core/systems/world.js";
import { xpNextFor, syncBar } from "../core/systems/progression.js";
import { canPlace } from "../core/items/inventory.js";
import { classById } from "../core/content/classes.js";
import { validateName } from "../core/name.js";
import { slotKeys, slotAccepts, rarityOrder, bases } from "../core/content/items.js";
import { affixes as affixDefs, affixById } from "../core/content/affixes.js";
import { uniques as uniqueDefs, uniqueById } from "../core/content/uniques.js";
import { skills as skillDefs } from "../core/content/skills.js";
import { quests as questDefs, sideIds, newQuestState } from "../core/content/quests.js";
import { goalOf } from "../core/systems/questview.js";
import { itemFloorOf } from "../core/systems/quests.js";
import { migrate } from "./migrate.js";

export const SAVE_FORMAT = "office-crawler-save";
/** The documented schema: exactly these top-level keys (plus `checksum`) and no others (AC-R-090-2). */
export const SAVE_KEYS = ["format", "version", "savedAtTick", "seed", "class", "name", "resume", "deepestDepth", "bossDefeated", "bossUnlocked", "townVisit",
  "player", "inventory", "equipment", "belt", "stash", "cursorItem", "uniquesFound", "nextItemId", "rng", "stats", "explored", "quests", "options"];
export const PLAYER_KEYS = ["level", "xp", "attrs", "attrPoints", "skillPoints", "skills", "skillBar", "gold", "respecsUsed"];
const STATS_KEYS = ["kills", "deaths", "bossAttempts", "playTicks"];
const ATTRS = ["grit", "agility", "stamina", "focus"];
const SIDE_STATES = ["available", "active", "ready", "completed"];
const MAIN_FLAGS = ["memo", "unlocked", "defeated", "verdict"];
/** The pouch entry id of an item quest (ADR-0007 section 8): `qi-<quest id>`. */
export const pouchIdOf = (questId) => `qi-${questId}`;

const fail = (reason, message) => ({ ok: false, reason, message });
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---- serialize -------------------------------------------------------------------------------------------------------------

/** Run-length encode a 0/1 array as alternating run lengths, starting with a run of zeros (maybe empty). */
export function rleEncode(arr) {
  const runs = []; let cur = 0, n = 0;
  for (const v of arr) { const b = v ? 1 : 0; if (b === cur) n++; else { runs.push(n); cur = b; n = 1; } }
  runs.push(n);
  return runs;
}
export function rleDecode(runs, size) {
  const out = new Array(size).fill(0);
  let i = 0, cur = 0;
  for (const r of runs) { if (cur) out.fill(1, i, i + r); i += r; cur ^= 1; }
  return out;
}

/** The persisted data of a game as a plain object (no checksum). */
export function toSave(state) {
  const p = state.player, resumeDepth = state.scene === "floor" ? state.depth : 0; // dead, victory and town all resume in the Lobby
  const explored = {};
  const floors = { ...state.floors, [state.depth]: { ...(state.floors[state.depth] ?? {}), explored: state.floor.explored } };
  for (const [d, f] of Object.entries(floors)) {
    const depth = Number(d);
    if (depth < 1 || !Array.isArray(f.explored) || !f.explored.some((v) => v)) continue;
    explored[depth] = { size: f.explored.length, runs: rleEncode(f.explored) };
  }
  return {
    format: SAVE_FORMAT, version: config.saveVersion, savedAtTick: state.tick, seed: state.seed, class: p.class, name: p.name,
    resume: { depth: resumeDepth }, deepestDepth: state.deepestDepth, bossDefeated: !!state.bossDefeated, bossUnlocked: !!state.bossUnlocked, townVisit: state.townVisit ?? 0,
    player: { level: p.level, xp: p.xp, attrs: { ...p.attrs }, attrPoints: p.attrPoints, skillPoints: p.skillPoints, skills: { ...p.skills }, skillBar: clone(p.skillBar), gold: p.gold, respecsUsed: p.respecsUsed ?? 0 },
    inventory: clone(state.inventory), equipment: clone(state.equipment), belt: clone(state.belt), stash: clone(state.stash), cursorItem: clone(state.cursorItem ?? null),
    uniquesFound: [...state.uniquesFound], nextItemId: state.nextItemId, rng: clone(state.rng), stats: { ...state.stats }, explored,
    quests: { ...clone(state.quests ?? newQuestState()), pouch: clone(p.pouch ?? []) }, // the pouch travels inside the quest block (ADR-0006 amendment, R7)
    options: {}, // options are global and not part of a slot (ADR-0006 section 3, CR-04)
  };
}

export const checksumOf = (save) => { const { checksum, ...rest } = save; return hashString(canonical(rest)); };

/** Save text. Stable: the same state gives the same text. Throws only if the state is not serialisable (a bug, not user input). */
export function serialize(state) {
  const save = toSave(state);
  return canonical({ ...save, checksum: checksumOf(save) });
}

// ---- validate --------------------------------------------------------------------------------------------------------------

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isInt = (v, lo = -Infinity, hi = Infinity) => Number.isInteger(v) && v >= lo && v <= hi;
const hasOnly = (o, keys) => isObj(o) && Object.keys(o).every((k) => keys.includes(k));

const own = (o, k) => Object.hasOwn(o, k); // never trust inherited names such as `constructor`
const STAT_IDS = new Set([...affixDefs.map((a) => a.stat), ...uniqueDefs.flatMap((u) => u.affixes.map((a) => a.stat))]);
export const ITEM_KEYS = ["id", "base", "baseName", "name", "kind", "rarity", "ilvl", "slot", "w", "h", "x", "y", "reqs", "affixes", "damage", "defense", "twoHanded",
  "restores", "restore", "effect", "unique", "flavour"];
const AFFIX_KEYS = ["id", "group", "kind", "stat", "name", "tier", "value", "range", "class"];
const MAX_TEXT = 64, MAX_NUM = 1e6;
/** Ids that can reach markup or storage keys (item ids, affix ids, unique ids ...): letters, digits, underscore, hyphen (CR-02). */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,32}$/;
const AFFIX_ID = /^[A-Za-z0-9_.-]{1,40}$/; // SAFE_ID plus the dot of stat keys (resist.fire); found by the generator sweep in test/save-v3.test.js: four uniques could not be saved before
const safeId = (v) => typeof v === "string" && SAFE_ID.test(v);
const str = (v, max = MAX_TEXT) => typeof v === "string" && v.length <= max;
const num = (v, lo = -MAX_NUM, hi = MAX_NUM) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function affixOk(a) {
  if (!hasOnly(a, AFFIX_KEYS) || !str(a.stat) || !STAT_IDS.has(a.stat) || !num(a.value)) return false;
  for (const k of ["id", "group"]) if (a[k] !== undefined && !(typeof a[k] === "string" && AFFIX_ID.test(a[k]))) return false; // a unique's affix id and group carry the stat key ("unique-resist.fire")
  for (const k of ["kind", "class"]) if (a[k] !== undefined && !safeId(a[k])) return false;
  if (a.name !== undefined && !str(a.name)) return false;
  if (a.tier !== undefined && !isInt(a.tier, 0, 99)) return false;
  // The generator always rolls a range, and the value lies inside it: a missing range or a value outside it is a forged affix (ADV-R5-12, -14).
  if (!(Array.isArray(a.range) && a.range.length === 2 && a.range.every((n) => num(n)) && a.range[0] <= a.range[1])) return false;
  if (a.value < a.range[0] || a.value > a.range[1]) return false;
  return true;
}

/**
 * What the generator can roll (ADR-0006 amendment, ADV-R6-01): affixes come from the affix tables (id, stat, kind, tier and range as in the table, the value
 * inside it, the tier unlocked at the item level, the group allowed on the base's slot, one per group, prefix and suffix limits) and the number fits the rarity;
 * a unique carries exactly its fixed affixes; weapon damage and defence, when present, are the base's.
 */
function rollableOk(it) {
  const base = bases[it.base], affs = it.affixes ?? [];
  if (it.unique !== undefined || it.rarity === "unique") {
    const def = it.unique !== undefined ? uniqueById[it.unique] : null;
    if (!def || it.rarity !== "unique" || def.base !== it.base || affs.length !== def.affixes.length) return false;
    if (!def.affixes.every((d, i) => affs[i].id === d.id && affs[i].stat === d.stat && affs[i].value === d.value)) return false;
  } else {
    const max = it.rarity === "magic" ? config.magicAffixes[1] : it.rarity === "rare" ? config.rareAffixes[1] : 0;
    if (affs.length > max) return false;
    const groups = new Set(), kinds = { prefix: 0, suffix: 0 };
    for (const a of affs) {
      const def = typeof a.id === "string" && own(affixById, a.id) ? affixById[a.id] : null;
      if (!def || a.stat !== def.stat || (a.kind ?? def.kind) !== def.kind || (a.group ?? def.group) !== def.group || (a.tier ?? def.tier) !== def.tier) return false;
      if (!Number.isInteger(a.value) || a.value < def.range[0] || a.value > def.range[1] || a.range[0] !== def.range[0] || a.range[1] !== def.range[1]) return false;
      if (def.minIlvl > (it.ilvl ?? 0) || !def.types.includes(base.slot) || groups.has(def.group) || ++kinds[def.kind] > (def.kind === "prefix" ? config.maxPrefixes : config.maxSuffixes)) return false;
      groups.add(def.group);
    }
  }
  if (it.damage !== undefined && !(base.damage && it.damage.min === base.damage.min && it.damage.max === base.damage.max)) return false; // a missing field only means less
  if (it.defense !== undefined && it.defense !== base.defense) return false;
  return true;
}

const sameJson = (a, b) => canonical(a) === canonical(b);
/** Everything about an item that comes from its base must match the base (ADV-R6-07): kind, potion and consumable values, gear size, requirements, hands. */
function baseOk(it, base) {
  if (it.kind !== base.kind) return false;
  if (it.kind === "potion") return it.restores === base.restores && it.restore === base.restore;
  if (it.kind === "consumable") return it.effect === base.effect;
  if (it.slot !== undefined && it.slot !== base.slot) return false;
  if (it.w !== base.w || it.h !== base.h) return false;
  if (it.reqs !== undefined && !sameJson(it.reqs, base.reqs)) return false;
  if (it.twoHanded !== undefined && it.twoHanded !== (base.twoHanded ?? false)) return false;
  return true;
}

function itemOk(it, { placed, slotKey }) {
  if (!hasOnly(it, ITEM_KEYS) || !safeId(it.id) || !str(it.name) || !str(it.base) || !own(bases, it.base)) return false;
  if (it.baseName !== undefined && !str(it.baseName)) return false;
  if (it.slot !== undefined && !safeId(it.slot)) return false;
  if (it.unique !== undefined && !safeId(it.unique)) return false;
  if (it.flavour !== undefined && !str(it.flavour, 200)) return false;
  if (it.effect !== undefined && !safeId(it.effect)) return false;
  if (it.restores !== undefined && !safeId(it.restores)) return false;
  if (it.ilvl !== undefined && !isInt(it.ilvl, 0, 999)) return false;
  if (it.twoHanded !== undefined && typeof it.twoHanded !== "boolean") return false;
  if (!["gear", "potion", "consumable"].includes(it.kind) || !rarityOrder.includes(it.rarity)) return false;
  if (!isInt(it.w, 1, 6) || !isInt(it.h, 1, 6)) return false;
  if (placed && (!isInt(it.x, 0, 99) || !isInt(it.y, 0, 99))) return false;
  if (!Array.isArray(it.affixes ?? []) || (it.affixes ?? []).length > 12 || (it.affixes ?? []).some((a) => !affixOk(a))) return false;
  if (!baseOk(it, bases[it.base])) return false;
  if (slotKey !== undefined && !(it.kind === "gear" && bases[it.base].slot === slotAccepts(slotKey))) return false; // a head base in the weapon slot
  if (it.kind === "gear" && !rollableOk(it)) return false;
  if (it.damage !== undefined && !(hasOnly(it.damage, ["min", "max"]) && num(it.damage.min, 0) && num(it.damage.max, 0))) return false;
  if (it.defense !== undefined && !num(it.defense, 0)) return false;
  if (it.restore !== undefined && !num(it.restore, 0)) return false;
  if (it.reqs !== undefined && !(isObj(it.reqs) && Object.entries(it.reqs).every(([k, v]) => safeId(k) && num(v, 0, 1000)))) return false;
  return true;
}

function gridOk(g, w, h, ids) {
  if (!isObj(g) || g.w !== w || g.h !== h || !Array.isArray(g.items)) return false;
  const placed = { w, h, items: [] };
  for (const it of g.items) {
    if (!itemOk(it, { placed: true }) || ids.has(it.id)) return false;
    ids.add(it.id);
    if (!canPlace(placed, it, it.x, it.y)) return false; // inside the grid and not overlapping an earlier item
    placed.items.push(it);
  }
  return true;
}

/**
 * The quest block (ADR-0006 amendment "R7 quests", point 3): exactly what play can produce. The milestones only grow and stay inside the world flags,
 * a side quest's progress fits its state, the pinned quest is not completed, and the pouch holds the item of a quest if and only if it is `ready`.
 */
function questsProblem(d) {
  const q = d.quests;
  if (!hasOnly(q, ["main", ...sideIds, "pinned", "pouch"]) || ["main", ...sideIds, "pinned", "pouch"].some((k) => !(k in q))) return "bad quests";
  const m = q.main?.m;
  if (!hasOnly(q.main, ["m"]) || !hasOnly(m, ["depth", ...MAIN_FLAGS]) || [...MAIN_FLAGS, "depth"].some((k) => !(k in m))) return "bad quest milestones";
  if (MAIN_FLAGS.some((k) => typeof m[k] !== "boolean") || !isInt(m.depth, 0, config.bossDepth)) return "bad quest milestones";
  if (m.depth > d.deepestDepth || (m.unlocked && !(d.bossUnlocked || d.bossDefeated)) || (m.defeated && !d.bossDefeated) || (m.verdict && !m.defeated)) return "bad quest milestones";
  for (const id of sideIds) {
    const e = q[id];
    if (!hasOnly(e, ["s", "p"]) || !("s" in e) || !("p" in e) || !SIDE_STATES.includes(e.s)) return "bad side quest";
    const goal = goalOf(id);
    if (!isInt(e.p, 0, goal) || (e.s === "available" && e.p !== 0) || (e.s === "active" && e.p >= goal) || ((e.s === "ready" || e.s === "completed") && e.p !== goal)) return "bad side quest";
    // The play a state needs (ADV-R7-01): kills counted for the kill quest, the floor that holds the item or the elite for the others.
    const type = questDefs[id].objective.type, done = e.s === "ready" || e.s === "completed";
    if (done && type === "kill" && d.stats.kills < goal) return "bad side quest progress"; // every counted kill is also a kill of the hero
    if (done && type === "item" && d.deepestDepth < itemFloorOf(d.seed)) return "bad side quest progress";
    if (done && type === "elite" && d.deepestDepth < config.quests.elite.depth) return "bad side quest progress";
  }
  if (typeof q.pinned !== "string" || !(q.pinned === "main" || (sideIds.includes(q.pinned) && q[q.pinned].s !== "completed"))) return "bad pinned quest";
  if (!Array.isArray(q.pouch) || q.pouch.length > sideIds.length) return "bad pouch";
  const held = new Set();
  for (const e of q.pouch) {
    if (!hasOnly(e, ["id", "quest"]) || !safeId(e.id) || !sideIds.includes(e.quest) || questDefs[e.quest].objective.type !== "item" || e.id !== pouchIdOf(e.quest) || held.has(e.quest)) return "bad pouch";
    held.add(e.quest);
  }
  for (const id of sideIds) if (held.has(id) !== (q[id].s === "ready" && questDefs[id].objective.type === "item")) return "bad pouch"; // the pouch holds the item exactly while its quest is ready
  return null;
}

/** Check a current-version save against the schema. Returns null when fine, else a message naming the problem. */
export function schemaProblem(d) {
  if (!isObj(d)) return "not an object";
  if (!hasOnly(d, [...SAVE_KEYS, "checksum"])) return "unknown keys";
  for (const k of SAVE_KEYS) if (!(k in d)) return `missing ${k}`;
  if (d.format !== SAVE_FORMAT) return "wrong format tag";
  if (!isInt(d.savedAtTick, 0) || !isInt(d.seed, 0, 0xffffffff) || !classById(d.class)) return "bad header";
  if (!validateName(d.name).ok || validateName(d.name).name !== d.name) return "bad name";
  if (!hasOnly(d.resume, ["depth"]) || !isInt(d.resume.depth, 0, config.bossDepth)) return "bad resume";
  if (!isInt(d.deepestDepth, 1, config.bossDepth) || typeof d.bossDefeated !== "boolean" || typeof d.bossUnlocked !== "boolean" || !isInt(d.townVisit, 0)) return "bad progress";
  const p = d.player;
  if (!hasOnly(p, PLAYER_KEYS) || PLAYER_KEYS.some((k) => !(k in p))) return "bad player";
  if (isInt(p.level, 1, config.levelCap) && isInt(p.xp, 0) && p.xp < config.xpTable[p.level - 1]) return "bad xp"; // the level is earned: xp at least the level's threshold (ADV-R6-06)
  if (!isInt(p.level, 1, config.levelCap) || !isInt(p.xp, 0, config.xpPastCap) || !isInt(p.attrPoints, 0, 1000) || !isInt(p.skillPoints, 0, 1000) || !isInt(p.gold, 0, 1e9) || !isInt(p.respecsUsed, 0, 1e6)) return "bad player numbers";
  if (!hasOnly(p.attrs, ATTRS) || ATTRS.some((a) => !isInt(p.attrs[a], 0, 1000))) return "bad attributes";
  const cls = classById(d.class);
  // The attribute invariant (ADV-R6-01, as the skill one below): what the hero has in attributes and unspent points never exceeds the class's start values plus
  // the points the level has granted. Attributes feed damage, so a forged total is a forged hero.
  const baseAttrs = ATTRS.reduce((n, a) => n + (cls.attrs[a] ?? 0), 0);
  if (ATTRS.reduce((n, a) => n + p.attrs[a], 0) + p.attrPoints > baseAttrs + (p.level - 1) * config.attrPointsPerLevel) return "bad attribute points";
  if (!isObj(p.skills) || Object.entries(p.skills).some(([id, l]) => !own(skillDefs, id) || skillDefs[id].class !== d.class || skillDefs[id].kind === "basic" || !isInt(l, 0, Math.min(skillDefs[id].maxLevel, config.skillMaxLevel)))) return "bad skills";
  if (!(p.skills[cls.signature] >= 1)) return "bad skills";
  // The point invariant of AC-R-205-1 and the tree rules (ADR-0005 section 2): level gate and prerequisites hold for every learned skill, and the
  // points spent plus the points left never exceed what the level has granted (the signature's first level is free).
  let spent = 0;
  for (const [id, l] of Object.entries(p.skills)) {
    if (l < 1 || (skillDefs[id].reqLevel ?? 1) > p.level) return "bad skills";
    for (const r of skillDefs[id].requires ?? []) if (!((p.skills[r.id] ?? 0) >= r.level)) return "bad skills";
    spent += id === cls.signature ? l - 1 : l;
  }
  if (spent + p.skillPoints > (p.level - 1) * config.skillPointsPerLevel) return "bad skill points";
  const bar = p.skillBar;
  if (!hasOnly(bar, ["primary", "secondary", "hotkeys", "selected"]) || !Array.isArray(bar.hotkeys) || bar.hotkeys.length !== 4 || !isInt(bar.selected, 0, 3)) return "bad skill bar";
  if (bar.primary !== cls.basic) return "bad skill bar"; // the primary slot always holds the class's basic attack
  for (const id of [bar.secondary, ...bar.hotkeys]) { // castable (active or aura), of this class, learned
    if (id === null) continue;
    if (!(typeof id === "string" && own(skillDefs, id)) || skillDefs[id].class !== d.class || !["active", "aura"].includes(skillDefs[id].kind) || !(p.skills[id] >= 1)) return "bad skill bar";
  }
  const ids = new Set();
  if (!gridOk(d.inventory, config.inventory.w, config.inventory.h, ids)) return "bad inventory";
  if (!gridOk(d.stash, config.stash.w, config.stash.h, ids)) return "bad stash";
  if (!isObj(d.equipment) || Object.keys(d.equipment).some((k) => !slotKeys.includes(k))) return "bad equipment";
  for (const it of Object.values(d.equipment)) if (it !== null && (!itemOk(it, { placed: false, slotKey: Object.keys(d.equipment).find((k) => d.equipment[k] === it) }) || ids.has(it.id) || !ids.add(it.id))) return "bad equipment item";
  if (!Array.isArray(d.belt) || d.belt.length !== config.beltSlots) return "bad belt";
  for (const it of d.belt) if (it !== null && (!itemOk(it, { placed: false }) || ids.has(it.id) || !ids.add(it.id))) return "bad belt item";
  if (d.cursorItem !== null && (!itemOk(d.cursorItem, { placed: false }) || ids.has(d.cursorItem.id))) return "bad cursor item";
  if (config.uniqueOncePerGame) { // a unique is found once per game (QF-05-2): never two copies
    const seen = new Set();
    for (const it of [...d.inventory.items, ...d.stash.items, ...Object.values(d.equipment), ...d.belt, d.cursorItem]) if (it?.unique !== undefined && (seen.has(it.unique) || !seen.add(it.unique))) return "duplicate unique";
  }
  if (!Array.isArray(d.uniquesFound) || d.uniquesFound.length > 100 || d.uniquesFound.some((u) => !safeId(u))) return "bad uniques";
  if (!isInt(d.nextItemId, 1)) return "bad item counter";
  if (!isObj(d.rng) || ["world", "combat", "ai", "loot"].some((n) => !isObj(d.rng[n]) || !isInt(d.rng[n].s, 0, 0xffffffff)) || Object.keys(d.rng).length !== 4) return "bad random streams";
  if (!hasOnly(d.stats, STATS_KEYS) || Object.values(d.stats).length !== STATS_KEYS.length || Object.values(d.stats).some((n) => !isInt(n, 0))) return "bad stats";
  if (!isObj(d.explored)) return "bad explored";
  for (const [k, e] of Object.entries(d.explored)) {
    if (!isInt(Number(k), 1, config.bossDepth) || !hasOnly(e, ["size", "runs"]) || !isInt(e.size, 1, 10000) || !Array.isArray(e.runs) || e.runs.length > e.size + 1) return "bad explored map";
    if (e.runs.some((r) => !isInt(r, 0)) || e.runs.reduce((a, b) => a + b, 0) !== e.size) return "bad explored map";
  }
  const qp = questsProblem(d);
  if (qp) return qp;
  if (!isObj(d.options)) return "bad options";
  return null;
}

// ---- deserialize -----------------------------------------------------------------------------------------------------------

/** Validate and (if needed) migrate a parsed save. Returns { ok: true, save } or a failure. */
export function check(raw) {
  if (!isObj(raw) || raw.format !== SAVE_FORMAT && raw.version !== 0) return fail("format", "This is not a save from this game.");
  if (!isInt(raw.version, 0)) return fail("format", "The save has no version.");
  if (raw.version > config.saveVersion) return fail("newer", "This save is from a newer version of the game.");
  if (raw.version >= 1) {
    if (typeof raw.checksum !== "string" || raw.checksum !== checksumOf(raw)) return fail("checksum", "The save is damaged (checksum mismatch).");
  }
  let data = raw, notes = [];
  if (raw.version === config.saveVersion && isObj(raw.options) && Object.keys(raw.options).length) data = { ...raw, options: {} }; // checksum was verified on the raw text; stored options are dropped (CR-04)
  if (raw.version < config.saveVersion) {
    const m = migrate(raw, config.saveVersion);
    if (!m.ok) return fail("no-migration", `No way to upgrade a version ${m.from} save.`);
    data = m.data; notes = m.notes ?? [];
    if (isObj(data.options)) data = { ...data, options: {} };
  }
  const problem = schemaProblem(data);
  if (problem) return fail("schema", `The save is not valid: ${problem}.`);
  return { ok: true, save: data, notes };
}

/** Build a running game from a checked save. Resumes in the Lobby, or at the entry of the saved floor when config.resumeAt says so. */
export function loadSave(save) {
  const state = newGame(save.seed, { class: save.class, name: save.name, start: "town" });
  const p = state.player, s = save.player;
  Object.assign(p, { respecsUsed: s.respecsUsed, level: s.level, xp: s.xp, xpNext: xpNextFor(s.level), attrs: clone(s.attrs), attrPoints: s.attrPoints, skillPoints: s.skillPoints, skills: clone(s.skills), skillBar: clone(s.skillBar), gold: s.gold });
  state.inventory = clone(save.inventory); state.stash = clone(save.stash); state.equipment = { ...state.equipment, ...clone(save.equipment) }; state.belt = clone(save.belt);
  state.cursorItem = clone(save.cursorItem); state.uniquesFound = [...save.uniquesFound]; state.nextItemId = save.nextItemId;
  state.rng = clone(save.rng); state.stats = { ...save.stats }; state.options = {};
  syncBar(p.skillBar); // secondary follows hotkeys[selected]
  state.deepestDepth = save.deepestDepth; state.bossDefeated = save.bossDefeated; state.bossUnlocked = save.bossUnlocked; state.townVisit = save.townVisit;
  state.tick = save.savedAtTick;
  state.quests = { main: clone(save.quests.main), pinned: save.quests.pinned, ...Object.fromEntries(sideIds.map((id) => [id, clone(save.quests[id])])) }; // before the resume entry: the placement hook of a quest floor reads it
  p.pouch = clone(save.quests.pouch);
  for (const [d, e] of Object.entries(save.explored)) state.floors[d] = { killed: [], groundItems: [], explored: rleDecode(e.runs, e.size) };
  applyDerived(state, { fill: true });
  if (config.resumeAt === "floorEntry" && save.resume.depth > 0) enterFloor(state, save.resume.depth, { at: "entry", from: 0 });
  state.events.length = 0; state.eventLog.length = 0; // loading is not an autosave trigger
  return state;
}

/** Parse, verify, migrate, validate and build. Never throws. */
export function deserialize(text) {
  try {
    if (typeof text !== "string") return fail("parse", "The save is not text.");
    if (text.length > config.saveMaxBytes) return fail("size", "The save is too large.");
    let raw;
    try { raw = JSON.parse(text); } catch { return fail("parse", "The save is not valid JSON."); }
    const r = check(raw);
    if (!r.ok) return r;
    return { ok: true, state: loadSave(r.save), save: r.save, notes: r.notes };
  } catch (e) {
    return fail("schema", `The save could not be loaded: ${e?.message ?? e}`);
  }
}
