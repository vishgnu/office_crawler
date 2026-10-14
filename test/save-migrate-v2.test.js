// R4-1/R4-5: save format version 2 and the Clerk migration (ADR-0005 section 9, ADR-0006 section 5; R-225, NFR-D06).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, config, content, setLevel, hashState } from "../src/core/index.js";
import { serialize, deserialize, check, migrate, MIGRATIONS, schemaProblem, checksumOf } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";

const v1text = readFileSync("test/fixtures/save-v1.json", "utf8");
const v1 = () => JSON.parse(v1text);

test("the fixture is a real version 1 Clerk save (class clerk, level 12, three learned skills, items, stash, gold, depth 4)", () => {
  const j = v1();
  assert.deepEqual([j.version, j.class, j.player.level, j.deepestDepth, j.bossDefeated, j.player.gold], [1, "clerk", 12, 4, false, 777]);
  assert.deepEqual(j.player.skills, { "dress-code": 1, mute: 1, "stapler-throw": 2 });
  assert.equal(j.player.skillPoints, 7); assert.equal(j.stash.items.length, 1); assert.equal(j.inventory.items.length, 2); // the stapler mace and the starting rapier assert.ok(j.equipment.body); assert.ok(j.belt[0]);
  assert.equal(j.checksum, checksumOf(j));
  assert.ok(config.saveVersion >= 2); assert.ok(config.saveVersion > j.version);
});

test("AC-R-225-1 v1 to v2: class becomes facilities-manager, every spent point is refunded, the signature is free, the bar resets, everything else is kept", () => {
  const old = v1(), r = deserialize(v1text);
  assert.equal(r.ok, true, r.message);
  const s = r.state, p = s.player;
  assert.equal(p.class, "facilities-manager"); assert.equal(p.name, "Employee");
  assert.equal(p.skillPoints, 7 + 1 + 2 + 1, "unspent plus every level spent");
  assert.deepEqual(p.skills, { "pallet-slam": 1 });
  assert.deepEqual(p.skillBar, { primary: "strike", secondary: "pallet-slam", hotkeys: ["pallet-slam", null, null, null], selected: 0 });
  assert.deepEqual(p.attrs, old.player.attrs); assert.equal(p.attrPoints, old.player.attrPoints);
  assert.deepEqual([p.level, p.xp, p.gold], [old.player.level, old.player.xp, old.player.gold]);
  assert.deepEqual(s.inventory, old.inventory); assert.deepEqual(s.stash, old.stash); assert.deepEqual(s.belt, old.belt); assert.deepEqual(s.equipment.body, old.equipment.body);
  assert.deepEqual([s.deepestDepth, s.bossDefeated, s.bossUnlocked, s.townVisit, s.seed], [old.deepestDepth, old.bossDefeated, old.bossUnlocked, old.townVisit, old.seed]);
  assert.deepEqual(s.rng, old.rng); assert.equal(s.nextItemId, old.nextItemId); assert.deepEqual(s.uniquesFound, old.uniquesFound);
  assert.equal(s.stats.playTicks, 0); assert.equal(s.stats.kills, old.stats.kills);
  assert.equal(r.notes[0].refundedPoints, 4); assert.equal(r.notes[0].from, 1);
  // the migrated game is a normal v2 game from here: it saves, loads and spends its refund under the new rules
  const again = deserialize(serialize(s));
  assert.equal(again.ok, true); assert.equal(hashState(again.state), hashState(s));
});

test("the refund is exact for every combination: sum(old levels) + old unspent, signature never refunded (property over 25 synthetic saves)", () => {
  const base = v1();
  for (let i = 0; i < 25; i++) {
    const j = JSON.parse(JSON.stringify(base)), ids = ["stapler-throw", "reply-all", "coffee-break", "mute", "dress-code", "hustle"];
    j.player.skills = {}; let spent = 0;
    ids.forEach((id, k) => { const l = (i + k * 3) % 6; if (l) { j.player.skills[id] = l; spent += l; } });
    j.player.skillPoints = i % 9;
    j.checksum = checksumOf(j);
    const m = migrate(j, 2);
    assert.equal(m.ok, true);
    assert.equal(m.data.player.skillPoints, (i % 9) + spent);
    assert.equal(m.notes[0].refundedPoints, spent);
    assert.deepEqual(m.data.player.skills, { "pallet-slam": 1 });
  }
});

test("AC-R-225-2 the migration is idempotent: a version 2 save passes through MIGRATIONS[1] unchanged, and migrating the output again is a no-op", () => {
  const m = migrate(v1(), 2);
  assert.equal(m.data.version, 2);
  assert.deepEqual(MIGRATIONS[1](structuredClone(m.data)), m.data);
  const once = migrate(m.data, 2);
  assert.deepEqual(once.data, m.data); assert.deepEqual(once.notes, []);
  const out = canonical({ ...m.data, checksum: checksumOf(m.data) });
  assert.equal(deserialize(out).ok, true);
  assert.equal(schemaProblem(m.data), null);
});

test("version 0 saves still upgrade through 0 to 1 to 2 (the chain), ending as a Facilities Manager", () => {
  const r = deserialize(readFileSync("test/fixtures/save-v0.json", "utf8"));
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.player.class, "facilities-manager");
});

test("corrupt, hostile and newer v1 / v2 saves fail with a reason and never throw (R-225, AC-R-225-4)", () => {
  const cases = {
    "truncated": [v1text.slice(0, 500), "parse"],
    "garbage": ["][", "parse"],
    "checksum": [JSON.stringify({ ...v1(), checksum: "0000000000000000" }), "checksum"],
    "newer": [JSON.stringify({ ...v1(), version: config.saveVersion + 1 }), "newer"],
  };
  for (const [name, [text, reason]] of Object.entries(cases)) { const r = deserialize(text); assert.equal(r.ok, false, name); assert.equal(r.reason, reason, name); }
  // content problems behind a valid checksum are schema failures
  const bad = (mut) => { const j = v1(); mut(j); j.checksum = checksumOf(j); return deserialize(JSON.stringify(j)); };
  for (const [name, mut] of Object.entries({
    wizard: (j) => { j.class = "wizard"; }, skillsNotObject: (j) => { j.player.skills = [1, 2]; }, skillsNull: (j) => { j.player = null; },
    negativeLevels: (j) => { j.player.skills = { mute: -5 }; }, stringLevels: (j) => { j.player.skills = { mute: "9" }; }, noClass: (j) => { delete j.class; },
  })) { const r = bad(mut); assert.equal(r.ok, false, name); assert.ok(["schema", "no-migration"].includes(r.reason), `${name}: ${r.reason}`); }
});

test("AC-NFR-D06-1 deserialize never throws on 20 mutated copies of a v2 save; every accepted copy is internally valid", () => {
  const s = newGame(5, { class: "it-wizard", name: "Mutant", start: "town" }); setLevel(s, 17); s.player.skills["cold-boot"] = 3; s.player.skillPoints = 2;
  const text = serialize(s), j = JSON.parse(text);
  const muts = [
    (x) => { x.version = 99; }, (x) => { x.version = -1; }, (x) => { x.name = "<b>"; }, (x) => { x.name = "x".repeat(40); }, (x) => { x.name = 5; }, (x) => { delete x.name; },
    (x) => { x.class = "sales-rep"; }, (x) => { x.player.skills["pallet-slam"] = 2; }, (x) => { x.player.skills = {}; }, (x) => { x.player.skills["cold-boot"] = 9; },
    (x) => { x.player.skills.strike = 1; }, (x) => { x.player.respecsUsed = -1; }, (x) => { delete x.player.respecsUsed; }, (x) => { x.stats.playTicks = -3; }, (x) => { delete x.stats.playTicks; },
    (x) => { x.stats = null; }, (x) => { x.player.skillBar.hotkeys = [1, 2, 3, 4]; }, (x) => { x.player.skillBar.primary = "nope"; }, (x) => { x.rng = {}; }, (x) => { x.extra = 1; },
  ];
  assert.equal(muts.length, 20);
  for (const [i, mut] of muts.entries()) {
    const c = JSON.parse(text); mut(c);
    for (const withSum of [false, true]) {
      if (withSum) c.checksum = checksumOf(c);
      let r; assert.doesNotThrow(() => { r = deserialize(JSON.stringify(c)); }, `mutation ${i}`);
      if (r.ok) assert.equal(schemaProblem(check(JSON.parse(serialize(r.state))).save), null, `mutation ${i} accepted`);
      else assert.ok(["checksum", "schema", "newer", "format", "no-migration", "parse"].includes(r.reason), `mutation ${i}: ${r.reason}`);
    }
  }
  assert.ok(j.version === config.saveVersion);
});

test("v2 save content: the name, respecsUsed and playTicks are part of the documented schema and round trip", () => {
  const s = newGame(2, { class: "sales-rep", name: "Round Trip", start: "town" });
  s.player.respecsUsed = 2; s.stats.playTicks = 1234; s.player.aura = null;
  const j = JSON.parse(serialize(s));
  assert.equal(j.version, config.saveVersion); assert.equal(j.name, "Round Trip"); assert.equal(j.player.respecsUsed, 2); assert.equal(j.stats.playTicks, 1234);
  for (const k of ["buffs", "absorb", "aura", "dash"]) assert.ok(!(k in j.player), `${k} is not saved (mid-floor state)`);
  assert.ok(!("allies" in j) && !("zones" in j));
  const r = deserialize(serialize(s));
  assert.deepEqual([r.state.player.name, r.state.player.respecsUsed, r.state.stats.playTicks, r.state.player.class], ["Round Trip", 2, 1234, "sales-rep"]);
  assert.deepEqual(r.state.allies, []); assert.deepEqual(r.state.zones, []); assert.deepEqual(r.state.player.buffs, []);
  for (const c of content.classes) assert.equal(deserialize(serialize(newGame(1, { class: c.id, start: "town" }))).ok, true);
});
