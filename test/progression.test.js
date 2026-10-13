import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, applyInput, step, deriveStats, monsterStats, gainXp, setLevel, learnSkill } from "../src/core/index.js";
import { gameOn, run, OPEN } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const ev = (s, type) => s.events.filter((e) => e.type === type);

test("AC-R-013-2 xpTable has levelCap strictly increasing thresholds, level 1 at 0", () => {
  const t = config.xpTable;
  assert.equal(t.length, config.levelCap);
  assert.equal(config.levelCap, 30);
  assert.equal(t[0], 0);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);
});

test("AC-R-013-1 a kill gives exactly the monster's xp, once", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4]]);
  const m = s.monsters[0]; m.hp = 1;
  const want = monsterStats("zombie-intern", s.depth).xp;
  assert.equal(m.xp, want);
  cmd(s, { t: "attack", id: m.id });
  let kills = 0;
  for (let i = 0; i < 400 && m.ai !== "dead"; i++) { step(s); kills += ev(s, "kill").length; }
  assert.equal(m.ai, "dead");
  assert.equal(kills, 1);
  assert.equal(s.player.xp, want);
});

test("AC-R-013-3 crossing a threshold: level+1, +5 attribute points, +1 skill point, hp/mp refilled, one levelup event", () => {
  const s = gameOn(OPEN);
  const p = s.player, before = { hpMax: p.hpMax, mpMax: p.mpMax, attrs: { ...p.attrs } };
  p.hp = 3; p.mp = 0;
  gainXp(s, config.xpTable[1]);
  assert.equal(p.level, 2);
  assert.equal(p.attrPoints, 5);
  assert.equal(p.skillPoints, 1);
  assert.ok(p.hpMax > before.hpMax && p.mpMax > before.mpMax);
  assert.equal(p.hp, p.hpMax); assert.equal(p.mp, p.mpMax);
  assert.deepEqual(p.attrs, before.attrs);
  assert.equal(ev(s, "levelup").length, 1);
  assert.equal(p.xpNext, config.xpTable[2]);
});

test("AC-R-013-4 one kill across two thresholds: +2 levels, +10 attribute points, +2 skill points", () => {
  const s = gameOn(OPEN);
  gainXp(s, config.xpTable[2]);
  assert.equal(s.player.level, 3);
  assert.equal(s.player.attrPoints, 10);
  assert.equal(s.player.skillPoints, 2);
  const e = ev(s, "levelup");
  assert.equal(e.reduce((a, x) => a + (x.levels ?? 1), 0), 2);
});

test("AC-R-013-5 at the level cap xp keeps counting for display, level and points stay", () => {
  const s = gameOn(OPEN);
  gainXp(s, config.xpTable[config.levelCap - 1]);
  const p = s.player;
  assert.equal(p.level, config.levelCap);
  const pts = [p.attrPoints, p.skillPoints], xp = p.xp;
  gainXp(s, 500);
  assert.equal(p.level, config.levelCap);
  assert.deepEqual([p.attrPoints, p.skillPoints], pts);
  assert.equal(p.xp, xp + 500);
  gainXp(s, 10 * config.xpPastCap);
  assert.equal(p.xp, config.xpPastCap);
});

test("AC-R-013-6 / AC-R-123-4 setLevel(5): points for levels 2..5, xpNext, derived stats", () => {
  const s = gameOn(OPEN);
  assert.equal(setLevel(s, 5).ok, true);
  const p = s.player;
  assert.equal(p.level, 5);
  assert.equal(p.attrPoints, 20); assert.equal(p.skillPoints, 4);
  assert.equal(p.xp, config.xpTable[4]); assert.equal(p.xpNext, config.xpTable[5]);
  const d = deriveStats(p, s.equipment);
  assert.equal(p.hpMax, d.hpMax); assert.equal(p.mpMax, d.mpMax);
  assert.equal(setLevel(s, 31).ok, false);
  assert.equal(setLevel(s, 0).ok, false);
});

test("AC-R-016-1/-2 allocating an attribute point recomputes derived stats; without points nothing changes", () => {
  const s = gameOn(OPEN);
  assert.equal(cmd(s, { t: "allocate", attr: "stamina" }).ok, false);
  setLevel(s, 2);
  const p = s.player, hp = p.hpMax, pts = p.attrPoints;
  assert.equal(cmd(s, { t: "allocate", attr: "stamina" }).ok, true);
  assert.equal(p.attrPoints, pts - 1);
  assert.equal(p.attrs.stamina, 11);
  assert.ok(p.hpMax > hp);
  const dm = p.mpMax; cmd(s, { t: "allocate", attr: "focus" });
  assert.ok(p.mpMax > dm);
  assert.equal(cmd(s, { t: "allocate", attr: "luck" }).ok, false);
  const g = p.damage.max; cmd(s, { t: "allocate", attr: "grit" });
  assert.equal(p.damage.max, g + 1);
});

test("AC-R-012-3 hp is not refilled by an attribute point", () => {
  const s = gameOn(OPEN); setLevel(s, 2);
  s.player.hp = 5;
  cmd(s, { t: "allocate", attr: "stamina" });
  assert.equal(s.player.hp, 5);
});

test("AC-R-014-1 the skill list: one basic attack, four actives, two passives, original names", () => {
  const list = Object.values(content.skills);
  assert.equal(list.filter((k) => k.kind === "basic").length, 1);
  assert.equal(list.filter((k) => k.kind === "active").length, 4);
  assert.equal(list.filter((k) => k.kind === "passive").length, 2);
  assert.equal(new Set(list.map((k) => k.name)).size, list.length);
  for (const k of list) { assert.ok(k.name.length > 0); if (k.kind !== "basic") assert.ok(k.maxLevel >= 2 && k.maxLevel <= config.skillMaxLevel); }
});

test("AC-R-014-2/-3/-4 learning spends a skill point; rejected without points and at max level", () => {
  const s = gameOn(OPEN), p = s.player;
  assert.equal(cmd(s, { t: "learnSkill", id: "stapler-throw" }).ok, false);
  assert.equal(p.skills["stapler-throw"], undefined);
  setLevel(s, 8); // 7 skill points
  assert.equal(cmd(s, { t: "learnSkill", id: "stapler-throw" }).ok, true);
  assert.equal(p.skills["stapler-throw"], 1); assert.equal(p.skillPoints, 6);
  assert.equal(cmd(s, { t: "learnSkill", id: "stapler-throw" }).ok, true);
  assert.equal(p.skills["stapler-throw"], 2);
  const max = content.skills["stapler-throw"].maxLevel;
  while (p.skills["stapler-throw"] < max) learnSkill(s, "stapler-throw");
  const pts = p.skillPoints;
  assert.equal(cmd(s, { t: "learnSkill", id: "stapler-throw" }).ok, false);
  assert.equal(p.skillPoints, pts);
  assert.equal(cmd(s, { t: "learnSkill", id: "strike" }).ok, false);
  assert.equal(cmd(s, { t: "learnSkill", id: "nope" }).ok, false);
});

test("AC-R-014-5 an active skill's effect value is non-decreasing with level and higher at max than at 1", () => {
  for (const k of Object.values(content.skills).filter((x) => x.kind === "active")) {
    const f = k.heal ?? k.dmgMax ?? k.duration, g = k.mana;
    for (let l = 1; l < k.maxLevel; l++) { assert.ok(f(l + 1) >= f(l)); assert.ok(g(l + 1) >= g(l)); }
    assert.ok(f(k.maxLevel) > f(1));
  }
});

test("AC-R-014-6 a passive skill changes the matching derived stat by perLevel * level", () => {
  const s = gameOn(OPEN); setLevel(s, 4);
  const d0 = s.player.defense, a0 = s.player.attackRating;
  learnSkill(s, "dress-code"); learnSkill(s, "dress-code");
  assert.equal(s.player.defense, d0 + 2 * content.skills["dress-code"].perLevel);
  learnSkill(s, "hustle");
  assert.equal(s.player.attackRating, a0 + content.skills.hustle.perLevel);
});

test("AC-R-014-7 an unlearned skill does nothing and costs nothing; passives cannot be cast", () => {
  const s = gameOn(OPEN), mp = s.player.mp;
  const r = cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 14, y: 4 } });
  assert.equal(r.ok, false);
  assert.equal(s.player.mp, mp); assert.equal(s.projectiles.length, 0); assert.equal(ev(s, "cast").length, 0);
  setLevel(s, 3); learnSkill(s, "dress-code");
  assert.equal(cmd(s, { t: "cast", skill: "dress-code" }).ok, false);
});

test("AC-R-014-8 / AC-R-023-5 a cast costs content.skills[X].mana(level) and mp never goes below 0; no cooldown", () => {
  const s = gameOn(OPEN); setLevel(s, 3); learnSkill(s, "coffee-break");
  const p = s.player, cost = content.skills["coffee-break"].mana(1);
  p.hp = 1; p.mp = p.mpMax;
  assert.equal(cmd(s, { t: "cast", skill: "coffee-break" }).ok, true);
  assert.equal(p.mp, p.mpMax - cost);
  run(s, config.castTicks + 1);
  assert.equal(cmd(s, { t: "cast", skill: "coffee-break" }).ok, true); // no cooldown: again at once
  run(s, config.castTicks + 1);
  p.mp = cost - 1;
  assert.equal(cmd(s, { t: "cast", skill: "coffee-break" }).ok, false);
  assert.equal(p.mp, cost - 1);
  assert.ok(ev(s, "noMana").length >= 1);
});

test("AC-R-015-4 assignment: unlearned skills rejected, the basic attack is the default primary and always assignable", () => {
  const s = gameOn(OPEN), bar = s.player.skillBar;
  assert.equal(bar.primary, "strike");
  assert.equal(cmd(s, { t: "assignSkill", slot: 0, id: "mute" }).ok, false);
  assert.equal(cmd(s, { t: "assignSkill", slot: 1, id: "strike" }).ok, true);
  assert.equal(bar.hotkeys[1], "strike");
  assert.equal(cmd(s, { t: "assignSkill", slot: "primary", id: "strike" }).ok, true);
  assert.equal(cmd(s, { t: "assignSkill", slot: 9, id: "strike" }).ok, false);
});

test("AC-R-015-2/-3 F1-F4 select the skill that the right mouse button uses (AC-R-005-5)", () => {
  const s = gameOn(OPEN, [["zombie-intern", 15, 4]]); setLevel(s, 4);
  learnSkill(s, "stapler-throw"); learnSkill(s, "coffee-break");
  const bar = s.player.skillBar;
  assert.deepEqual(bar.hotkeys.slice(0, 2), ["stapler-throw", "coffee-break"]); // learned skills take free hotkeys
  assert.equal(bar.secondary, "stapler-throw");
  assert.equal(cmd(s, { t: "key", code: "F2" }).ok, true);
  assert.equal(bar.selected, 1); assert.equal(bar.secondary, "coffee-break");
  cmd(s, { t: "key", code: "F1" });
  const mp = s.player.mp, cost = content.skills["stapler-throw"].mana(1);
  assert.equal(cmd(s, { t: "click", tile: { x: 14, y: 4 }, button: 2 }).ok, true);
  assert.equal(s.player.mp, mp - cost);
  assert.equal(s.projectiles.length, 1);
  assert.ok(ev(s, "cast").length === 1);
  assert.equal(s.player.target, null); // the primary skill (move/attack) was not used
});
