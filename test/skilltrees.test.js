// R4-1: skill tree data (ADR-0005 section 2, R-202..R-204, R-233) and the generic tooltip rows / tree view the UI renders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, content, config, at, manaCost, skillView, treeView, effectRows, setLevel, applyInput, applyDerived } from "../src/core/index.js";

const trees = content.skillTrees, ids = Object.keys(trees);
const OPS = new Set(["damage", "dot", "heal", "hot", "status", "knockback", "absorb", "statMod", "execute", "trigger", "summon", "mana", "gold"]);
const ARCH = new Set(["projectile", "area", "self", "buff", "aura", "summon", "dash", "trap", "passive", "melee"]);
const terms = ["docs/product/ip-denylist.txt", "docs/product/ip-denylist-brands.txt"].flatMap((f) => readFileSync(f, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
const hits = (text) => terms.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text.toLowerCase()));
const GRAPH = (tree) => Object.values(tree.skills);

test("the contract's ids: three classes, nine branches, 30 skills in tree order", () => {
  assert.deepEqual(ids, ["facilities-manager", "sales-rep", "it-wizard"]);
  assert.deepEqual(ids.flatMap((c) => trees[c].branches.map((b) => b.id)), ["maintenance", "safety", "logistics", "pitch", "networking", "closing", "infrastructure", "security", "helpdesk"]);
  assert.deepEqual(ids.flatMap((c) => trees[c].branches.flatMap((b) => b.skills)), [
    "pallet-slam", "floor-buffer", "demolition-day", "dress-code", "coffee-break", "fire-drill", "lockout", "dolly-charge", "wet-floor", "traffic-cone",
    "stapler-throw", "hustle", "pen-volley", "card-fan", "intern", "reply-all", "department-meeting", "upsell", "hard-close", "commission",
    "server-overheat", "power-surge", "overclock", "blue-screen", "cold-boot", "firewall", "quarantine", "mute", "restore-backup", "turn-it-off",
  ]);
});

test("AC-R-202-1 / AC-R-203-1 three branches and ten skills per class (config.tree), unique ids across classes, names and texts present, a plain-data table", () => {
  const seen = new Set();
  for (const c of ids) {
    const t = trees[c];
    assert.equal(t.branches.length, 3);
    assert.ok(GRAPH(t).length >= config.tree.minSkills && GRAPH(t).length <= config.tree.maxSkills);
    for (const s of GRAPH(t)) {
      assert.ok(!seen.has(s.id), `${s.id} appears twice`); seen.add(s.id);
      assert.equal(s.class, c);
      assert.ok(s.name.length > 0 && content.strings[s.textKey]?.length > 0, s.id);
      assert.ok(s.maxLevel >= 1 && s.maxLevel <= config.skillMaxLevel, s.id);
      assert.ok(ARCH.has(s.archetype), s.id);
      assert.deepEqual(JSON.parse(JSON.stringify(s)), s, `${s.id} is JSON-able data (no functions)`);
      assert.equal(s.cost.cooldown, 0, "no cooldowns (QF-06-5)");
      assert.ok(s.fx.icon === s.id, "the icon key is the skill id (R4 contract section 5)");
      for (const e of s.effects) assert.ok(OPS.has(e.op), `${s.id}: op ${e.op}`);
    }
    for (const b of t.branches) assert.ok(b.skills.some((id) => t.skills[id].kind === "active"), `${b.id} has an active skill`);
  }
  assert.equal(seen.size, 30);
});

test("AC-R-204-3 prerequisites exist in the same branch with a lower tier (so there is no cycle); tier 1 has none; gates default to the tier table and rise with the tier", () => {
  for (const c of ids) for (const b of trees[c].branches) {
    const inBranch = b.skills.map((id) => trees[c].skills[id]);
    assert.ok(inBranch.every((s) => s.branch === b.id));
    for (const s of inBranch) {
      assert.ok(s.reqLevel >= config.skillTiers[s.tier - 1], `${s.id} gate below its tier`);
      assert.equal(s.reqLevel, config.skillTiers[s.tier - 1], `${s.id} uses the tier gate`);
      if (s.tier === 1) assert.deepEqual(s.requires, [], s.id);
      for (const r of s.requires) { const q = trees[c].skills[r.id]; assert.ok(q && q.branch === b.id && q.tier < s.tier && r.level >= 1 && r.level <= q.maxLevel, `${s.id} requires ${r.id}`); }
      if (s.tier === 3) { assert.equal(s.maxLevel, 1, `${s.id} capstone is single level`); assert.ok(s.requires.length >= 1); }
    }
    assert.deepEqual([...new Set(inBranch.map((s) => s.tier))].sort(), [1, 2, 3], `${b.id} has three tiers`);
    const gates = [1, 2, 3].map((t) => config.skillTiers[t - 1]);
    assert.ok(gates[0] < gates[1] && gates[1] < gates[2]);
  }
  assert.deepEqual(config.skillTiers, [1, 8, 16]);
});

test("point sanity (ADR-0005): the sum of maxLevel is at least 1.3 times the 29 usable points, so no one maxes everything", () => {
  for (const c of ids) assert.ok(GRAPH(trees[c]).reduce((n, s) => n + s.maxLevel, 0) >= 1.3 * 29, c);
});

test("per-level values are non-decreasing with the skill level (R-203): damage, heal, duration, radius, mana", () => {
  for (const s of Object.values(content.skills)) {
    for (let l = 1; l < s.maxLevel; l++) {
      assert.ok(manaCost(s, l + 1) >= manaCost(s, l), `${s.id} mana`);
      for (const e of s.effects) for (const k of ["min", "max", "amount", "ticks", "perTick", "hp", "mag", "value"]) if (e[k] !== undefined && e.op !== "execute") assert.ok(at(e[k], l + 1) >= at(e[k], l), `${s.id} ${e.op}.${k}`);
      if (s.delivery?.radius) assert.ok(at(s.delivery.radius, l + 1) >= at(s.delivery.radius, l), `${s.id} radius`);
    }
  }
});

test("at(): base at level 1, linear growth, an optional cap, constants pass through; manaCost rounds to an integer", () => {
  assert.equal(at([5, 2], 1), 5); assert.equal(at([5, 2], 4), 11); assert.equal(at([5, 2, 9], 10), 9); assert.equal(at(7, 3), 7); assert.equal(at([3, 1], 0), 3);
  for (const s of Object.values(content.skills)) for (let l = 1; l <= s.maxLevel; l++) assert.ok(Number.isInteger(manaCost(s, l)) && manaCost(s, l) >= 0);
  assert.equal(content.skills["stapler-throw"].mana(1), 3);
});

test("AC-R-233-1 every skill name, text and branch name passes both denylists; Evacuation Drill and Packet Filter are the safe-default names", () => {
  const text = [];
  for (const s of Object.values(content.skills)) text.push(s.name, content.strings[s.textKey]);
  assert.deepEqual(text.flatMap(hits), []);
  assert.equal(content.skills["fire-drill"].name, "Evacuation Drill"); assert.equal(content.skills.firewall.name, "Packet Filter");
  const shown = [...Object.values(content.skills).map((k) => k.name), ...Object.values(content.strings)].join("|");
  assert.ok(!/fire\s?wall/i.test(shown), "no near-genre skill name in any shown text (the ids are internal and stay)");
});

test("saves and states only ever hold ids from the merged table (basics included)", () => {
  assert.deepEqual(["strike", "toss", "zap"].map((b) => content.skills[b].kind), ["basic", "basic", "basic"]);
  assert.equal(Object.keys(content.skills).length, 33);
});

// ---- the generic tooltip rows and the tree view ------------------------------------------------------------------------------

test("effectRows: every skill formats at level 1 and max level into non-empty rows with string-table labels (no per-skill tooltip code)", () => {
  for (const s of Object.values(content.skills).filter((x) => x.kind !== "basic")) {
    for (const l of [1, s.maxLevel]) {
      const rows = effectRows(s, l);
      assert.ok(rows.length >= 1, `${s.id} has rows at ${l}`);
      for (const r of rows) { assert.ok(content.strings[r.labelKey], `${s.id}: label ${r.labelKey}`); assert.ok(typeof r.value === "string" && r.value.length > 0 && !/NaN|undefined/.test(r.value), `${s.id}: ${r.value}`); }
    }
  }
  assert.deepEqual(effectRows(content.skills["stapler-throw"], 1)[0], { labelKey: "statDamage", value: "4-8", type: "physical" });
  assert.equal(effectRows(content.skills["stapler-throw"], 3)[0].value, "8-14");
});

test("skillView: state, lock reasons worded from strings, prerequisites, cost, now / next rows, hotkey, signature (R4 contract section 3)", () => {
  const s = newGame(1, { class: "sales-rep" });
  const sig = skillView(s, "stapler-throw");
  assert.deepEqual([sig.state, sig.level, sig.signature, sig.assigned, sig.maxLevel, sig.tier, sig.kind, sig.archetype], ["learned", 1, true, 0, 5, 1, "active", "projectile"]);
  assert.deepEqual(sig.cost, { mana: 3, cooldown: 0, reserve: 0 });
  assert.equal(sig.now[0].value, "4-8"); assert.equal(sig.next[0].value, "6-11");
  const pen = skillView(s, "pen-volley");
  assert.equal(pen.state, "locked-level"); assert.equal(pen.lockReason, "Needs character level 8"); assert.equal(pen.canLearn, false);
  assert.deepEqual(pen.now, []); assert.ok(pen.next.length > 0);
  setLevel(s, 8);
  assert.equal(skillView(s, "pen-volley").state, "available");
  s.player.skills["stapler-throw"] = 0; delete s.player.skills["stapler-throw"];
  const locked = skillView(s, "pen-volley");
  assert.equal(locked.state, "locked-prereq"); assert.equal(locked.lockReason, "Needs Stapler Throw 1"); assert.deepEqual(locked.requires, [{ id: "stapler-throw", level: 1, name: "Stapler Throw", met: false }]);
  s.player.skills["stapler-throw"] = 5;
  assert.equal(skillView(s, "stapler-throw").state, "maxed"); assert.deepEqual(skillView(s, "stapler-throw").next, []);
  s.player.skillPoints = 0;
  assert.equal(skillView(s, "pen-volley").state, "no-points");
  assert.equal(skillView(s, "nope"), null);
  assert.equal(skillView(s, "strike").level, 1);
});

test("treeView: the whole panel for the player's class: points, level, respec status, branches with nodes and edges, spent points per branch", () => {
  const s = newGame(1, { class: "it-wizard", start: "town" });
  setLevel(s, 9);
  applyInput(s, { t: "learnSkill", id: "cold-boot" }); applyInput(s, { t: "learnSkill", id: "cold-boot" }); applyInput(s, { t: "learnSkill", id: "mute" });
  const v = treeView(s);
  assert.deepEqual([v.classId, v.points, v.level], ["it-wizard", 8 - 3, 9]);
  assert.deepEqual(v.respec, { available: true, mode: "free", cost: 0, reason: null });
  assert.deepEqual(v.branches.map((b) => [b.id, b.nameKey, b.iconKey, b.spent, b.nodes.length]), [["infrastructure", "branchInfrastructure", "branch:infrastructure", 0, 4], ["security", "branchSecurity", "branch:security", 2, 3], ["helpdesk", "branchHelpdesk", "branch:helpdesk", 1, 3]]);
  assert.deepEqual(v.branches[1].edges, [{ from: "cold-boot", to: "firewall" }, { from: "firewall", to: "quarantine" }]);
  assert.equal(v.branches[0].nodes[0].id, "server-overheat");
  assert.equal(v.branches.flatMap((b) => b.nodes).length, 10);
  s.scene = "floor";
  assert.equal(treeView(s).respec.available, false); assert.equal(treeView(s).respec.reason, "not-in-town");
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v, "plain data");
});
