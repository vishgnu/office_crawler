// R4-1/R4-3: learning rules and the point invariant (R-204, R-205), respec (R-209, ADR-0005 section 8), auras, names on the running character.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyInput, config, content, setLevel, gainXp, createRng, respec, respecCheck, step } from "../src/core/index.js";
import { gameOn, OPEN, run } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const learnable = (s) => Object.values(content.skills).filter((d) => d.class === s.player.class && d.kind !== "basic");
const sumLevels = (p) => Object.values(p.skills).reduce((a, b) => a + b, 0);

test("learnSkill error codes are stable and a rejected learn spends nothing", () => {
  const s = newGame(1, { class: "facilities-manager", start: "town" }), p = s.player;
  const snap = () => JSON.stringify([p.skills, p.skillPoints, p.skillBar]);
  const want = (id, error) => { const before = snap(); assert.deepEqual(cmd(s, { t: "learnSkill", id }), { ok: false, error }, `${id}: ${error}`); assert.equal(snap(), before); };
  want("nope", "unknown-skill"); want("toString", "unknown-skill"); want("strike", "basic"); want("toss", "basic");
  want("stapler-throw", "wrong-class"); want("mute", "wrong-class");
  want("floor-buffer", "level-gate");
  setLevel(s, 8); p.skillPoints = 0;
  want("dress-code", "no-points");
  p.skillPoints = 3;
  want("coffee-break", "prereq"); want("fire-drill", "prereq");            // both need Dress Code
  assert.equal(cmd(s, { t: "learnSkill", id: "floor-buffer" }).ok, true);   // the free signature at level 1 already satisfies its prerequisite
  p.skills["pallet-slam"] = 5; p.skillPoints = 2;
  want("pallet-slam", "max-level");
});

test("level gates and prerequisites: a skill opens exactly at its gate level with the prerequisite met (AC-R-204-1/-2)", () => {
  const s = newGame(1, { class: "sales-rep", start: "town" }), p = s.player;
  p.skillPoints = 10; p.level = 7;
  assert.equal(cmd(s, { t: "learnSkill", id: "pen-volley" }).error, "level-gate");
  p.level = 8;
  p.skills["stapler-throw"] = 0; delete p.skills["stapler-throw"];
  assert.equal(cmd(s, { t: "learnSkill", id: "pen-volley" }).error, "prereq");
  p.skills["stapler-throw"] = 1;
  assert.equal(cmd(s, { t: "learnSkill", id: "pen-volley" }).ok, true);
  assert.equal(cmd(s, { t: "learnSkill", id: "card-fan" }).error, "level-gate");
  p.level = 16;
  assert.equal(cmd(s, { t: "learnSkill", id: "card-fan" }).ok, true);
  assert.equal(cmd(s, { t: "learnSkill", id: "card-fan" }).error, "max-level", "capstones have one level");
});

test("AC-R-205-1 point accounting: at every level from 1 to 30, random valid learns keep sum(levels) - 1 + skillPoints === levels gained, never negative", () => {
  for (const c of content.classes) {
    const s = newGame(7, { class: c.id, start: "town" }), p = s.player, rng = createRng(99);
    for (let level = 1; level <= config.levelCap; level++) {
      if (level > 1) gainXp(s, config.xpTable[level - 1] - p.xp);
      assert.equal(p.level, level);
      for (let tries = 0; tries < 40 && p.skillPoints > 0 && rng.next() < 0.9; tries++) {
        const pick = rng.pick(learnable(s));
        const before = JSON.stringify(p.skills), r = cmd(s, { t: "learnSkill", id: pick.id });
        if (!r.ok) assert.equal(JSON.stringify(p.skills), before);
      }
      assert.ok(p.skillPoints >= 0);
      assert.equal(sumLevels(p) - 1 + p.skillPoints, (level - 1) * config.skillPointsPerLevel, `${c.id} level ${level}`);
    }
    assert.equal((p.level - 1) * config.skillPointsPerLevel, 29);
  }
});

test("AC-R-205-2 / -3 unspent points survive a level-up; a character at level 30 cannot max everything", () => {
  for (const c of content.classes) {
    const s = newGame(7, { class: c.id, start: "town" }), p = s.player;
    gainXp(s, config.xpTable[3]); assert.equal(p.skillPoints, 3);
    gainXp(s, config.xpTable[4] - p.xp); assert.equal(p.skillPoints, 4);
    setLevel(s, 30);
    let progress = true;
    while (progress) { progress = false; for (const d of learnable(s)) if (cmd(s, { t: "learnSkill", id: d.id }).ok) progress = true; } // a greedy bot
    assert.ok(learnable(s).some((d) => (p.skills[d.id] ?? 0) < d.maxLevel), `${c.id} cannot max everything`);
    assert.equal(p.skillPoints, 0);
  }
});

test("learning an active skill puts it on the first free hotkey; passives and auras follow the rules (auras can be assigned)", () => {
  const s = newGame(1, { class: "facilities-manager", start: "town" }), p = s.player;
  setLevel(s, 10);
  cmd(s, { t: "learnSkill", id: "dress-code" });                    // passive: not on the bar
  assert.deepEqual(p.skillBar.hotkeys, ["pallet-slam", null, null, null]);
  cmd(s, { t: "learnSkill", id: "fire-drill" });
  assert.deepEqual(p.skillBar.hotkeys, ["pallet-slam", "fire-drill", null, null]);
  assert.equal(cmd(s, { t: "assignSkill", slot: 3, id: "dress-code" }).ok, false);
});

// ---- respec --------------------------------------------------------------------------------------------------------------------

const withTree = (cls = "facilities-manager") => {
  const s = newGame(2, { class: cls, start: "town" }), p = s.player;
  setLevel(s, 12);
  for (const id of ["dress-code", "dress-code", "coffee-break", "fire-drill"]) cmd(s, { t: "learnSkill", id });
  cmd(s, { t: "learnSkill", id: "pallet-slam" });
  return s;
};

test("AC-R-209-1 respec in town: every spent point returns, the signature stays at level 1, removed actives leave the bar, attributes are unchanged", () => {
  const s = withTree(), p = s.player, attrs = JSON.stringify(p.attrs), points = p.attrPoints;
  const spent = Object.entries(p.skills).reduce((n, [id, l]) => n + (id === "pallet-slam" ? l - 1 : l), 0);
  const total = p.skillPoints + spent;
  cmd(s, { t: "assignSkill", slot: 2, id: "coffee-break" });
  p.mp -= 3; p.buffs.push({ skill: "x", stat: "defense", value: 3, t: 99 }); p.absorb = { skill: "x", amount: 5, t: 9, reflect: 0 }; s.allies.push({ id: "a1" }); s.zones.push({ id: "z1" });
  assert.deepEqual(cmd(s, { t: "respec" }), { ok: true });
  assert.deepEqual(p.skills, { "pallet-slam": 1 });
  assert.equal(p.skillPoints, total);
  assert.equal(sumLevels(p) - 1 + p.skillPoints, 11);
  assert.deepEqual(p.skillBar.hotkeys, ["pallet-slam", null, null, null]);
  assert.equal(p.skillBar.secondary, "pallet-slam");
  assert.equal(JSON.stringify(p.attrs), attrs); assert.equal(p.attrPoints, points);
  assert.deepEqual([p.buffs, p.absorb, p.aura, s.allies, s.zones], [[], null, null, [], []]);
  assert.equal(s.events.find((e) => e.type === "respec").refunded, spent);
  assert.equal(p.defense, newGame(2, { class: "facilities-manager" }).player.defense, "the passive's defense bonus is gone");
});

test("respec clears a switched-on aura, its reserved mana, and the hero is whole again", () => {
  const s = withTree(), p = s.player;
  assert.equal(cmd(s, { t: "toggleAura", id: "fire-drill" }).ok, true);
  assert.ok(p.mpReserved > 0);
  cmd(s, { t: "respec" });
  assert.equal(p.aura, null); assert.equal(p.mpReserved, 0); assert.equal(p.resist.fire, 0);
});

test("AC-R-209-2 respec is Lobby only and needs a living hero: on a floor it answers not-in-town and nothing changes", () => {
  const s = withTree(), p = s.player;
  s.scene = "floor"; s.depth = 1;
  const before = JSON.stringify([p.skills, p.skillPoints, p.skillBar]);
  assert.deepEqual(cmd(s, { t: "respec" }), { ok: false, error: "not-in-town" });
  assert.equal(JSON.stringify([p.skills, p.skillPoints, p.skillBar]), before);
  s.scene = "town"; p.hp = 0;
  assert.equal(cmd(s, { t: "respec" }).error, "dead");
});

test("respec modes (config.respec.mode): free, gold (cost from level), once, off", () => {
  const saved = { ...config.respec };
  try {
    const s = withTree(), p = s.player;
    config.respec.mode = "off";
    assert.equal(cmd(s, { t: "respec" }).error, "respec-off"); assert.equal(respecCheck(s), "respec-off");
    config.respec.mode = "gold"; config.respec.goldBase = 20; config.respec.goldPerLevel = 10;
    p.gold = 100;
    assert.equal(cmd(s, { t: "respec" }).error, "no-gold");        // 20 + 10 * 12 = 140
    p.gold = 140;
    assert.equal(cmd(s, { t: "respec" }).ok, true); assert.equal(p.gold, 0);
    config.respec.mode = "once"; config.respec.goldBase = 0; config.respec.goldPerLevel = 0;
    for (const id of ["dress-code"]) cmd(s, { t: "learnSkill", id });
    p.respecsUsed = 0;
    assert.equal(cmd(s, { t: "respec" }).ok, true);
    cmd(s, { t: "learnSkill", id: "dress-code" });
    assert.equal(cmd(s, { t: "respec" }).error, "respec-used");
    config.respec.mode = "free";
    assert.equal(cmd(s, { t: "respec" }).ok, true);
    assert.equal(cmd(s, { t: "respec" }).ok, true, "free and unlimited");
  } finally { Object.assign(config.respec, saved); }
});

test("respec exports are pure core functions too (respec, respecCheck) and a respec of a fresh character refunds nothing", () => {
  const s = newGame(1, { start: "town" });
  assert.equal(respecCheck(s), null);
  assert.equal(respec(s).ok, true);
  assert.equal(s.events.find((e) => e.type === "respec").refunded, 0);
  assert.equal(s.player.skillPoints, 0);
});

// ---- aura ---------------------------------------------------------------------------------------------------------------------

test("toggleAura: reserves a share of mana and adds its statMods while on; one aura at a time; errors are stable codes", () => {
  const s = gameOn(OPEN, [], 1, { class: "facilities-manager" }), p = s.player;
  setLevel(s, 10);
  assert.equal(cmd(s, { t: "toggleAura", id: "fire-drill" }).error, "not-learned");
  assert.equal(cmd(s, { t: "toggleAura", id: "pallet-slam" }).error, "not-aura");
  assert.equal(cmd(s, { t: "toggleAura", id: "nope" }).error, "not-aura");
  cmd(s, { t: "learnSkill", id: "dress-code" }); cmd(s, { t: "learnSkill", id: "fire-drill" });
  const def = content.skills["fire-drill"], d0 = p.defense, r0 = p.resist.fire, max = p.mpMax;
  assert.equal(cmd(s, { t: "toggleAura", id: "fire-drill" }).ok, true);
  assert.equal(p.aura, "fire-drill");
  assert.equal(p.mpReserved, Math.floor((max * def.cost.reservePct) / 100));
  assert.ok(p.mp <= p.mpMax - p.mpReserved);
  assert.equal(p.defense, d0 + 6); assert.equal(p.resist.fire, r0 + 8);
  assert.deepEqual(s.events.filter((e) => e.type === "aura").map((e) => [e.skill, e.on]), [["fire-drill", true]]);
  p.mp = p.mpMax; run(s, 60);
  assert.ok(p.mp <= p.mpMax - p.mpReserved, "reserved mana is never usable");
  assert.equal(cmd(s, { t: "cast", skill: "fire-drill" }).ok, true, "casting an aura skill switches it off");
  assert.equal(p.aura, null); assert.equal(p.mpReserved, 0); assert.equal(p.defense, d0);
  p.mp = 0;
  assert.equal(cmd(s, { t: "toggleAura", id: "fire-drill" }).error, "no-mana");
});

test("setName renames the running character with the validator; events.renamed; invalid names change nothing", () => {
  const s = newGame(1, { start: "town" });
  assert.deepEqual(cmd(s, { t: "setName", name: "  Sir   Stapleton " }), { ok: true });
  assert.equal(s.player.name, "Sir Stapleton");
  assert.deepEqual(s.events.find((e) => e.type === "renamed"), { type: "renamed", name: "Sir Stapleton" });
  for (const bad of ["", "   ", "x".repeat(17), "<script>", 5, null]) { assert.deepEqual(cmd(s, { t: "setName", name: bad }), { ok: false, error: "bad-name" }); assert.equal(s.player.name, "Sir Stapleton"); }
});
