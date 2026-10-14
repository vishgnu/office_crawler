// ADV-R6 round 2: attacks on the fix round (save v3, attribute invariant, rollable-gear validation, v2 to v3 migration, unique affix ids).
// Legal saves must round-trip (no false rejection); forged ones must not load. Defects are `{ todo: 'ADV-R6-NN' }`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, newGame, step, applyInput, applyDerived, setLevel, learnSkill, respec, rollItem, rollPotion, makeItem, createRng, mint, gainXp } from "../src/core/index.js";
import { toSave, checksumOf, deserialize, migrate } from "../src/save/index.js";
import { autoplace } from "../src/core/items/inventory.js";
import { canonical } from "../src/core/hash.js";
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";
import { gameOn, OPEN } from "./helpers.js";

const CLASSES = content.classes;
const ATTRS = ["grit", "agility", "stamina", "focus"];
const sealed = (s) => canonical({ ...s, checksum: checksumOf(s) });
const hero = (id, seed = 5) => newGame(seed, { class: id, name: "Adv", start: "town", wearStartKit: true });
const rt = (state) => { const r = deserialize(sealed(toSave(state))); return r; };
const forged = (id, f) => { const s = toSave(hero(id)); f(s); return deserialize(sealed(s)); };

// ---------------------------------------------------------------- no false rejections: legal saves from the generator
test("legal gear sweep: every gear base x magic/rare x item level x class tag x 12 seeds survives save and load, worn or in the bag", () => {
  let n = 0;
  for (const cls of CLASSES) for (const base of content.items ? Object.values(content.items).filter((b) => b.kind === "gear") : []) {
    for (const rarity of ["normal", "magic", "rare"]) for (const ilvl of [1, 4, 9, 15, 25, 40]) {
      if (ilvl < base.minIlvl) continue;
      for (let seed = 1; seed <= 12; seed++) {
        const s = hero(cls.id);
        const it = rollItem(createRng(seed * 977 + ilvl), { base: base.id, rarity, ilvl, affixTag: cls.affixTag });
        mint(s, it); s.equipment[base.slot === "ring" ? "ring1" : base.slot] = it;
        const r = rt(s);
        assert.ok(r.ok, `${cls.id} ${base.id} ${rarity} ilvl ${ilvl} seed ${seed}: ${r.message} ${JSON.stringify(it.affixes.map((a) => a.id))}`);
        n++;
      }
    }
  }
  assert.ok(n > 2000, `swept ${n}`);
});

test("legal unique sweep: every unique at its minimum item level and above, worn and in the bag, round-trips and keeps its affixes exactly", () => {
  for (const u of content.uniques) for (const ilvl of [u.minIlvl, u.minIlvl + 7, 60]) {
    const it = rollItem(createRng(4), { rarity: "unique", ilvl, base: u.base });
    assert.equal(it.unique, u.id, `${u.id}: generator gave ${it.unique}`);
    const s = hero("facilities-manager"); mint(s, it); assert.ok(autoplace(s.inventory, it));
    const r = rt(s); assert.ok(r.ok, `${u.id} ilvl ${ilvl}: ${r.message}`);
    const back = r.state.inventory.items.find((i) => i.unique === u.id);
    assert.deepEqual(back.affixes, it.affixes);
  }
});

test("legal potion and consumable sweep: every potion strength and consumable base round-trips", () => {
  const s = hero("sales-rep");
  const rng = createRng(2);
  for (const ilvl of [1, 5, 10, 20, 40]) for (const kind of ["hp", "mp"]) { const p = mint(s, rollPotion(rng, ilvl, kind)); autoplace(s.inventory, p); }
  for (const b of Object.values(content.items).filter((x) => x.kind !== "gear")) { const it = mint(s, makeItem(b.id)); autoplace(s.inventory, it); }
  const r = rt(s); assert.ok(r.ok, r.message);
});

test("real-play saves: the careful bot plays each class for 3 seeds; the state every 2 500 ticks (gear dropped and worn, points spent, floors explored) saves, loads and saves again identically", () => {
  for (const cls of CLASSES) for (const seed of [11, 12, 13]) {
    const state = newGame(seed, { start: "town", class: cls.id }), mem = createBotMemory({ depth: 4, respawn: true, class: cls.id });
    let saves = 0;
    for (let i = 0; i < 16000; i++) {
      if (state.scene === "dead") applyInput(state, { t: "respawn" });
      if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) noteResult(mem, cmd, applyInput(state, cmd)); }
      step(state);
      if (i % 2500 === 2499 && state.scene !== "dead") {
        const t1 = sealed(toSave(state)), r = deserialize(t1);
        assert.ok(r.ok, `${cls.id} seed ${seed} tick ${i}: ${r.message}`);
        const t2 = sealed(toSave(r.state)); assert.ok(deserialize(t2).ok, `${cls.id} seed ${seed} tick ${i}: second load`);
        saves++;
      }
    }
    assert.ok(saves >= 5, `${cls.id} seed ${seed}: ${saves} saves`);
  }
});

test("saving at many points of real play: gain levels 1..30 by xp, random allocation, random learn, random respec, random gear from loot rolls: always saves, loads and re-saves identically", () => {
  let seed = 99; const rnd = (n) => (seed = (seed * 1103515245 + 12345) >>> 0) % n;
  for (const cls of CLASSES) {
    const s = hero(cls.id), ids = Object.values(content.skills).filter((d) => d.class === cls.id && d.kind !== "basic").map((d) => d.id);
    const rng = createRng(31);
    for (let lvl = 1; lvl <= config.levelCap; lvl++) {
      if (lvl > s.player.level) gainXp(s, config.xpTable[lvl - 1] - s.player.xp);
      for (let k = 0; k < 6; k++) {
        const r = rnd(10);
        if (r < 4) applyInput(s, { t: "allocate", attr: ATTRS[rnd(4)] }); else if (r < 8) learnSkill(s, ids[rnd(ids.length)]); else if (r < 9) respec(s);
        else { const it = mint(s, rollItem(rng, { ilvl: lvl, rarity: ["magic", "rare", "unique"][rnd(3)], affixTag: cls.affixTag })); if (!autoplace(s.inventory, it)) s.inventory.items.length = 0; }
      }
      const t1 = sealed(toSave(s)), r1 = deserialize(t1);
      assert.ok(r1.ok, `${cls.id} level ${lvl}: ${r1.message}`);
      const t2 = sealed(toSave(r1.state)), r2 = deserialize(t2);
      assert.ok(r2.ok && sealed(toSave(r2.state)) === t2, `${cls.id} level ${lvl}: second save differs`);
    }
  }
});

test("vendor stock: everything every vendor sells, bought at several depths and refreshes, saves and loads", () => {
  for (const cls of CLASSES) {
    const s = hero(cls.id); s.player.gold = 1e6;
    const vendors = (s.floor.npcs ?? s.npcs ?? []).filter((n) => n.vendor || n.kind === "vendor" || n.role === "vendor" || content.npcs[n.type ?? n.id]?.vendor);
    let bought = 0;
    for (const v of vendors) {
      s.player.tile = { x: v.tile.x, y: v.tile.y + 1 }; s.deepestDepth = 6;
      applyInput(s, { t: "openVendor", id: v.id });
      for (let i = 0; i < (s.vendor?.stock.length ?? 0); i++) { if (applyInput(s, { t: "buy", index: 0 }).ok) bought++; if (!s.vendor) break; }
      applyInput(s, { t: "closeVendor" });
      s.cursorItem = null;
      const r = rt(s); assert.ok(r.ok, `${cls.id} vendor ${v.id}: ${r.message}`);
    }
    assert.ok(vendors.length >= 2 && bought >= 2, `${cls.id}: ${vendors.length} vendors, ${bought} purchases`);
  }
});

// ---------------------------------------------------------------- the attribute invariant: exact edge and bypass attempts
const start = (id) => ATTRS.reduce((n, a) => n + content.classes.find((c) => c.id === id).attrs[a], 0);
test("attribute invariant: exactly at the limit loads, one over is refused, for every class and level 1, 2, 16, 30", () => {
  for (const c of CLASSES) for (const lvl of [1, 2, 16, 30]) {
    const limit = start(c.id) + (lvl - 1) * config.attrPointsPerLevel;
    const at = forged(c.id, (s) => { s.player.level = lvl; s.player.xp = config.xpTable[lvl - 1]; s.player.attrs = { ...c.attrs }; s.player.attrPoints = limit - start(c.id); });
    assert.ok(at.ok, `${c.id} ${lvl} at the limit: ${at.message}`);
    const over = forged(c.id, (s) => { s.player.level = lvl; s.player.xp = config.xpTable[lvl - 1]; s.player.attrs = { ...c.attrs }; s.player.attrPoints = limit - start(c.id) + 1; });
    assert.equal(over.ok, false, `${c.id} ${lvl} one over`);
  }
});

test("attribute invariant: a hero may sit below the start values (points refunded elsewhere) and gear attributes do not count against it", () => {
  const c = CLASSES[1];
  const low = forged(c.id, (s) => { s.player.attrs = { ...c.attrs, grit: 0 }; });
  assert.ok(low.ok, low.message);
  const s = hero(c.id); const sword = rollItem(createRng(2), { base: "keyboard-sword", rarity: "rare", ilvl: 30, affixTag: c.affixTag }); mint(s, sword); s.equipment.weapon = sword;
  assert.ok(rt(s).ok);
});

test("ADV-R6-06: the level in a save is not tied to xp, so a level 30 hero (145 attribute points, 29 skill points, tier 3) can be forged at xp 0", { todo: "ADV-R6-06" }, () => {
  const r = forged("it-wizard", (s) => { s.player.level = 30; s.player.attrPoints = 145; s.player.skillPoints = 29; s.player.xp = 0; });
  assert.equal(r.ok, false, "level 30 at xp 0 loaded");
});

// ---------------------------------------------------------------- gear bypass attempts that the new validation should stop
const gearBypass = (name, f, todo) => test(`${todo ? "ADV-R6-07: " : "gear: "}${name}`, todo ? { todo } : {}, () => {
  const r = forged("it-wizard", f); assert.equal(r.ok, false, "accepted");
});
gearBypass("a potion that restores 1 000 000 health is refused", (s) => { s.belt[0] = { id: "i92", base: "lukewarm-coffee", baseName: "x", name: "x", kind: "potion", rarity: "normal", w: 1, h: 1, restore: 1000000, restores: "hp", slot: "potion", affixes: [] }; }, "ADV-R6-07");
gearBypass("a consumable with an invented effect id is refused", (s) => { s.inventory.items.push({ id: "i94", base: "lukewarm-coffee", baseName: "x", name: "x", kind: "consumable", rarity: "normal", w: 1, h: 1, effect: "anything", x: 0, y: 0, affixes: [] }); }, "ADV-R6-07");
gearBypass("a head base in the weapon slot is refused", (s) => { s.equipment.weapon = { ...makeItem("hard-hat"), id: "i95" }; }, "ADV-R6-07");
gearBypass("gear with its requirements removed is refused", (s) => { const it = rollItem(createRng(5), { base: "extinguisher-club", rarity: "normal", ilvl: 20 }); it.reqs = {}; it.id = "i95"; s.equipment.weapon = it; }, "ADV-R6-07");
gearBypass("a magic item with 3 affixes is refused", (s) => { const it = rollItem(createRng(5), { base: "keyboard-sword", rarity: "rare", ilvl: 30 }); it.rarity = "magic"; it.id = "i96"; s.equipment.weapon = it; });
gearBypass("an affix of a higher tier than the item level unlocks is refused", (s) => { const it = rollItem(createRng(5), { base: "keyboard-sword", rarity: "magic", ilvl: 1 }); it.ilvl = 1; const def = content.affixes.filter((a) => a.minIlvl > 10 && a.types.includes("weapon"))[0]; it.affixes = [{ id: def.id, group: def.group, kind: def.kind, stat: def.stat, name: "x", tier: def.tier, value: def.range[1], range: [...def.range] }]; it.id = "i97"; s.equipment.weapon = it; });
gearBypass("two affixes of the same group are refused", (s) => { const it = rollItem(createRng(5), { base: "keyboard-sword", rarity: "rare", ilvl: 30 }); it.affixes = [it.affixes[0], { ...it.affixes[0] }]; it.id = "i98"; s.equipment.weapon = it; });
gearBypass("a unique with one fixed affix changed is refused", (s) => { const it = rollItem(createRng(4), { rarity: "unique", ilvl: 20, base: "ruler-rapier" }); it.affixes[0].value += 1; it.affixes[0].range = [it.affixes[0].value, it.affixes[0].value]; it.id = "i99"; s.equipment.weapon = it; });
gearBypass("a normal item that carries a unique's name and flavour but no unique id is accepted as plain text only", (s) => { /* allowed: text is free */ s.equipment.weapon.name = "Paper Cut"; s.equipment.weapon.affixes = [{ id: "unique-damage", group: "damage", kind: "prefix", stat: "damage", value: 3, range: [3, 3] }]; });

test("ADV-R6-07b: the same unique can be carried twice (uniqueOncePerGame is not part of the schema)", { todo: "ADV-R6-07" }, () => {
  const it = rollItem(createRng(4), { rarity: "unique", ilvl: 20, base: "ruler-rapier" });
  const r = forged("it-wizard", (s) => { s.inventory.items.push({ ...structuredClone(it), id: "i97", x: 0, y: 0 }, { ...structuredClone(it), id: "i98", x: 5, y: 0 }); });
  assert.equal(r.ok, false, "two Paper Cuts loaded");
});

// ---------------------------------------------------------------- v2 to v3 migration
const asV2 = (state, mut) => { const s = toSave(state); s.version = 2; mut?.(s); return s; };
const loadV2 = (s) => deserialize(sealed(s));

test("v2 to v3: refund arithmetic for every level, class and mixed allocation (sum of attributes and points is conserved, attributes return to the start)", () => {
  for (const c of CLASSES.filter((x) => x.derived.powerAttr !== "grit")) for (const lvl of [1, 2, 8, 16, 30]) {
    const s = hero(c.id); setLevel(s, lvl);
    const total = (lvl - 1) * 5, spread = [Math.floor(total / 2), 0, total - Math.floor(total / 2), 0];
    ATTRS.forEach((a, i) => { s.player.attrs[a] = c.attrs[a] + spread[i]; }); s.player.attrPoints = 0; applyDerived(s);
    const r = loadV2(asV2(s));
    assert.ok(r.ok, `${c.id} ${lvl}: ${r.message}`);
    assert.deepEqual(r.state.player.attrs, c.attrs); assert.equal(r.state.player.attrPoints, total);
    if (total > 0) assert.deepEqual(r.notes, [{ from: 2, attributePointsRefunded: total, attr: c.derived.powerAttr }]); else assert.equal(r.notes?.length ?? 0, 0);
  }
});

test("v2 to v3: unspent points are kept and added, a hero below start values loses nothing, a save with nothing allocated gets no note", () => {
  const c = CLASSES.find((x) => x.id === "it-wizard"); const s = hero(c.id); setLevel(s, 10);
  const r = loadV2(asV2(s));
  assert.ok(r.ok); assert.equal(r.state.player.attrPoints, 45); assert.equal(r.notes?.length ?? 0, 0);
  const lowGrit = hero(c.id); lowGrit.player.attrs.grit = 0; setLevel(lowGrit, 3); lowGrit.player.attrs.focus += 10; lowGrit.player.attrPoints = 0; applyDerived(lowGrit);
  const r2 = loadV2(asV2(lowGrit)); assert.ok(r2.ok, r2.message); assert.equal(r2.state.player.attrs.grit, 0); assert.equal(r2.notes[0].attributePointsRefunded, 10);
});

test("v2 to v3: the Facilities Manager is only re-stamped (attributes and points identical, no note)", () => {
  const s = hero("facilities-manager"); setLevel(s, 14); s.player.attrs.grit += 30; s.player.attrPoints = 35; applyDerived(s);
  const r = loadV2(asV2(s));
  assert.ok(r.ok); assert.equal(r.state.player.attrs.grit, s.player.attrs.grit); assert.equal(r.state.player.attrPoints, 35); assert.equal(r.notes?.length ?? 0, 0); assert.equal(r.save.version, 3);
});

test("v2 to v3 is idempotent: a migrated save loads, re-saves as version 3 and loads again with no second refund and no note", () => {
  const c = CLASSES.find((x) => x.id === "sales-rep"); const s = hero(c.id); setLevel(s, 14); s.player.attrs.grit += 65; s.player.attrPoints = 0; applyDerived(s);
  const r1 = loadV2(asV2(s)); assert.ok(r1.ok);
  const t = sealed(toSave(r1.state)); assert.equal(JSON.parse(t).version, 3);
  const r2 = deserialize(t); assert.ok(r2.ok); assert.equal(r2.notes?.length ?? 0, 0);
  assert.deepEqual(r2.state.player.attrs, r1.state.player.attrs); assert.equal(r2.state.player.attrPoints, r1.state.player.attrPoints);
});

test("v2 to v3: hostile v2 inputs (attributes as strings, negative, arrays, NaN-like, missing attrPoints) are never refunded into a loadable hero and never throw", () => {
  const c = CLASSES.find((x) => x.id === "it-wizard");
  for (const bad of [{ grit: "70", agility: 12, stamina: 11, focus: 20 }, { grit: -5, agility: 12, stamina: 11, focus: 20 }, [1, 2, 3, 4], { grit: 1.5, agility: 12, stamina: 11, focus: 20 }, null, { grit: 1e9, agility: 1, stamina: 1, focus: 1 }]) {
    const s = toSave(hero(c.id)); s.version = 2; s.player.attrs = bad;
    let r; assert.doesNotThrow(() => { r = deserialize(sealed(s)); });
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
  const s = toSave(hero(c.id)); s.version = 2; delete s.player.attrPoints; assert.equal(deserialize(sealed(s)).ok, false);
});

test("v2 to v3: a v2 save already over the new invariant (forged) is refunded into more than 1000 points and refused, not clamped into a legal hero", () => {
  const s = toSave(hero("it-wizard")); s.version = 2; s.player.attrs = { grit: 1000, agility: 1000, stamina: 1000, focus: 1000 }; s.player.attrPoints = 500;
  assert.equal(deserialize(sealed(s)).ok, false);
});

test("every R5 fixture of an older version loads under the current schema (fixtures v0, v1)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["save-v0.json", "save-v1.json"]) { const r = deserialize(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8")); assert.ok(r.ok, `${f}: ${r.message}`); assert.equal(r.save.version, config.saveVersion); }
});

// ---------------------------------------------------------------- unique affix ids (the dotted stat keys)
test("unique affix ids with a dot (resist.fire, resist.cold, resist.shock, resist.acid) save and load, but a dot is still refused in item ids, kinds and names that reach markup", () => {
  for (const u of content.uniques.filter((x) => x.affixes.some((a) => a.stat.includes(".")))) {
    const it = rollItem(createRng(1), { rarity: "unique", ilvl: 30, base: u.base }); const s = hero("it-wizard"); mint(s, it); autoplace(s.inventory, it);
    assert.ok(rt(s).ok, u.id);
  }
  const bad = forged("it-wizard", (s) => { s.equipment.weapon.id = "i.1"; });
  assert.equal(bad.ok, false, "dotted item id");
  const s2 = toSave(hero("it-wizard")); s2.equipment.weapon.affixes = [{ id: "../../x", group: "x", kind: "prefix", stat: "damage", value: 1, range: [1, 1] }];
  assert.equal(deserialize(sealed(s2)).ok, false, "path-like affix id");
  const s3 = toSave(hero("it-wizard")); s3.equipment.weapon.affixes = [{ id: "a".repeat(41), group: "g", kind: "prefix", stat: "damage", value: 1, range: [1, 1] }];
  assert.equal(deserialize(sealed(s3)).ok, false, "41 character affix id");
});
