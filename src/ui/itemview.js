// Pure view models for items and the character sheet: tooltip content, comparison deltas, verdict, requirement
// lines, unmet-gear list, attribute-point preview and drop checks. No DOM; unit-tested (test/ui-itemview.test.js).
import { content, config, deriveStats, checkReqs } from "../core/index.js";
import { T } from "./text.js";

const S = content.strings;
const RARITY_TEXT = { normal: T.rarityNormal, magic: T.rarityMagic, rare: T.rarityRare, unique: T.rarityUnique };
export const rarityName = (r) => RARITY_TEXT[r] ?? RARITY_TEXT.normal;

const STAT_LABEL = {
  damage: T.damageAvg, defense: T.defense, hpMax: T.hpMax, mpMax: T.mpMax, attackRating: T.attackRating,
  grit: T.statAttr.grit, agility: T.statAttr.agility, stamina: T.statAttr.stamina, focus: T.statAttr.focus,
  "resist.fire": T.resistFire, "resist.cold": T.resistCold, "resist.shock": T.resistShock, "resist.acid": T.resistAcid,
};
export const statLabel = (key) => STAT_LABEL[key] ?? key;
const reqLabel = (k) => (k === "level" ? T.level : T.statAttr[k] ?? k);

/** One affix as text: "+4 Grit". Damage affixes read "+3 Damage". */
export const affixText = (a) => `+${a.value} ${a.stat === "damage" ? T.damage : statLabel(a.stat)}`;

/** Requirement lines with have/need against the hero's own level and attributes (checkReqs semantics). */
export function reqLines(player, item) {
  return Object.entries(item.reqs ?? {}).filter(([, need]) => need > 0).map(([k, need]) => {
    const have = k === "level" ? player.level : player.attrs[k] ?? 0, ok = have >= need;
    const text = `${reqLabel(k)} ${need}`;
    return { key: k, label: reqLabel(k), need, have, ok, text, detail: ok ? text : `${text} (${T.youHave} ${have}, ${T.needMore} ${need - have} ${T.more})` };
  });
}

/** "Needs Level 8" / "Needs Grit 12 (you have 10)": the first unmet requirement, for drop feedback. */
export function unmetReason(player, item) {
  const bad = reqLines(player, item).find((r) => !r.ok);
  return bad ? `${T.needsReq} ${bad.text} (${T.youHave} ${bad.have})` : null;
}

/** Everything the tooltip shows for one item. */
export function describeItem(item, player) {
  const reqs = reqLines(player, item);
  const main = [];
  if (item.damage) main.push({ kind: "damage", text: `${T.damage} ${item.damage.min}–${item.damage.max}` });
  if (item.defense) main.push({ kind: "defense", text: `${T.defense} ${item.defense}` });
  if (item.kind === "potion") main.push({ kind: "restores", text: `${T.restores} ${item.restore} ${item.restores === "hp" ? T.health : T.mana}` });
  return {
    id: item.id, name: item.name, rarity: item.rarity, rarityName: rarityName(item.rarity), mark: content.rarities[item.rarity]?.mark ?? "-",
    base: item.baseName ?? item.name, size: `${item.w}×${item.h}`, kind: item.kind, slot: item.slot, twoHanded: !!item.twoHanded,
    main, affixes: (item.affixes ?? []).map((a) => ({ stat: a.stat, value: a.value, text: affixText(a) })),
    reqs, unmet: reqs.some((r) => !r.ok), flavour: item.flavour ? S[item.flavour] ?? null : null,
  };
}

const damageAvg = (d) => (d.min + d.max) / 2;
/** The stats a swap can change, as comparable numbers. */
export function statVector(s) {
  const v = { damage: damageAvg(s.damage), defense: s.defense, hpMax: s.hpMax, mpMax: s.mpMax, attackRating: s.attackRating };
  for (const k of T.attrOrder) v[k] = s.attrs[k];
  for (const [k, n] of Object.entries(s.resist ?? {})) v[`resist.${k}`] = n;
  return v;
}
const ORDER = ["damage", "defense", "hpMax", "mpMax", "attackRating", "grit", "agility", "stamina", "focus", "resist.fire", "resist.cold", "resist.shock", "resist.acid"];

/** Differences between two stat vectors (after - before), in display order, zero deltas dropped. */
export function diffVectors(before, after) {
  return ORDER.map((key) => ({ key, label: statLabel(key), delta: Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * 10) / 10 })).filter((d) => d.delta !== 0);
}

export const verdictOf = (deltas) => {
  const up = deltas.some((d) => d.delta > 0), down = deltas.some((d) => d.delta < 0);
  return up && !down ? "up" : down && !up ? "down" : up && down ? "mixed" : "same";
};
const VERDICT_TEXT = { up: T.verdictUp, down: T.verdictDown, mixed: T.verdictMixed, same: T.sameStats };

/** The slot an item would go to when equipped without an explicit slot (mirrors the core). */
export function targetSlot(state, item) {
  if (item.kind !== "gear") return null;
  if (item.slot === "ring") return !state.equipment.ring1 ? "ring1" : !state.equipment.ring2 ? "ring2" : "ring1";
  return item.slot;
}

/**
 * Compare `item` with what is worn in its slot, using the real derived stats (so a two-handed weapon that displaces
 * the off-hand, or an attribute that raises damage, is counted). Null for potions and for the worn item itself.
 */
export function compareToEquipped(state, item) {
  const slot = targetSlot(state, item);
  if (!slot) return null;
  const worn = state.equipment[slot] ?? null;
  if (worn === item || (worn && worn.id === item.id)) return null;
  const next = { ...state.equipment, [slot]: item };
  if (item.twoHanded) next.offhand = null;
  const before = statVector(deriveStats(state.player, state.equipment)), after = statVector(deriveStats(state.player, next));
  const deltas = diffVectors(before, after), verdict = verdictOf(deltas);
  return {
    slot, equipped: worn ? { id: worn.id, name: worn.name, rarity: worn.rarity } : null,
    deltas, verdict, verdictText: VERDICT_TEXT[verdict],
  };
}

/** Inventory items the hero cannot use yet, with what is missing. */
export function unmetGear(state) {
  return state.inventory.items.filter((i) => i.kind === "gear" && !checkReqs(state.player, i).ok)
    .map((item) => ({ item, missing: reqLines(state.player, item).filter((r) => !r.ok) }));
}

/** What one more point in `attr` does: derived-stat deltas, and the inventory items it makes usable. */
export function allocPreview(state, attr) {
  const p = state.player, now = statVector(deriveStats(p, state.equipment));
  const next = { ...p, attrs: { ...p.attrs, [attr]: p.attrs[attr] + 1 } };
  const after = statVector(deriveStats(next, state.equipment));
  const deltas = diffVectors(now, after).filter((d) => d.key !== attr);
  const unlocks = state.inventory.items.filter((i) => i.kind === "gear" && !checkReqs(p, i).ok && checkReqs(next, i).ok).map((i) => i.name);
  return { attr, deltas, unlocks };
}

/** Would dropping `held` on this target work? target: {t:'grid',x,y} | {t:'slot',k} | {t:'belt',i}. Returns { ok, reason }. */
export function dropCheck(state, held, target) {
  const ok = { ok: true, reason: T.dropHere };
  if (!held || !target) return { ok: false, reason: "" };
  if (target.t === "grid") {
    const g = state.inventory, x = target.x, y = target.y;
    if (x < 0 || y < 0 || x + held.w > g.w || y + held.h > g.h) return { ok: false, reason: T.outOfBounds };
    const covered = g.items.filter((o) => o !== held && x < o.x + o.w && o.x < x + held.w && y < o.y + o.h && o.y < y + held.h);
    return covered.length > 1 ? { ok: false, reason: T.blocked } : ok;
  }
  if (target.t === "belt") return held.kind === "potion" ? ok : { ok: false, reason: T.beltOnlyPotions };
  if (target.t === "slot") {
    const accepts = target.k === "ring1" || target.k === "ring2" ? "ring" : target.k;
    if (held.kind !== "gear" || held.slot !== accepts) return { ok: false, reason: T.wrongSlot };
    const why = unmetReason(state.player, held);
    if (why) return { ok: false, reason: why };
    if (target.k === "offhand" && state.equipment.weapon?.twoHanded) return { ok: false, reason: T.offhandBlocked };
    return ok;
  }
  return { ok: false, reason: "" };
}

/** XP progress inside the current level, 0..1 (AC-R-077-2); 1 at the level cap. */
export function xpRatio(p) {
  const prev = config.xpTable[p.level - 1] ?? 0, span = p.xpNext - prev;
  return span > 0 ? Math.min(1, Math.max(0, (p.xp - prev) / span)) : 1;
}
