import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyInput, content, config } from "../src/core/index.js";
import { hudState } from "../src/render/hud.js";
import { hudLayout } from "../src/ui/layout.js";

const style = { ui: { shapes: { health: "mug", mana: "jug" } } };
const inside = (r, w, h) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;

test("AC-R-071-1 hudState.skillBar lists primary, secondary and the four hotkey slots as in player.skillBar", () => {
  const s = newGame(1, { start: "town" });
  s.player.level = 3; s.player.skillPoints = 2;
  applyInput(s, { t: "learnSkill", id: "stapler-throw" });
  applyInput(s, { t: "learnSkill", id: "coffee-break" });
  applyInput(s, { t: "key", code: "F2" });
  const h = hudState(s, 1280, 800, style);
  assert.equal(h.skillBar.primary, "strike");
  assert.equal(h.skillBar.secondary, s.player.skillBar.secondary);
  assert.deepEqual(h.skillBar.hotkeys, s.player.skillBar.hotkeys);
  assert.deepEqual(h.skillBar.slots.map((x) => x.skill), ["stapler-throw", "coffee-break", null, null]);
  assert.deepEqual(h.skillBar.slots.map((x) => x.key), ["F1", "F2", "F3", "F4"]);
  assert.deepEqual(h.skillBar.slots.map((x) => x.selected), [false, true, false, false]);
  assert.equal(h.skillBar.slots[1].cost, 8);
  assert.equal(h.skillBar.slots[2].empty, true);
});

test("AC-R-071-3 a skill without enough mana is disabled in the bar", () => {
  const s = newGame(1, { start: "town" });
  s.player.level = 3; s.player.skillPoints = 1;
  applyInput(s, { t: "learnSkill", id: "stapler-throw" });
  assert.equal(hudState(s, 1280, 800, style).skillBar.slots[0].disabled, false);
  s.player.mp = 2;
  assert.equal(hudState(s, 1280, 800, style).skillBar.slots[0].disabled, true);
});

test("AC-R-071-2 belt mirrors state.belt with key labels 1-4", () => {
  const s = newGame(1, { start: "town" });
  const h = hudState(s, 1280, 800, style);
  assert.equal(h.belt.length, 4);
  h.belt.forEach((b, i) => { assert.equal(b.key, String(i + 1)); assert.equal(b.empty, !s.belt[i]); assert.equal(b.item?.id ?? null, s.belt[i]?.id ?? null); });
  assert.equal(h.belt.filter((b) => !b.empty).length, config.startKit.healthPotions);
});

test("AC-R-077-2 the xp bar is progress inside the level; point indicators and the target come from the state", () => {
  const s = newGame(1, { start: "floor" });
  assert.equal(hudState(s, 1280, 800, style).xpBar.ratio, 0);
  s.player.level = 3; s.player.xp = config.xpTable[2] + 0.25 * (config.xpTable[3] - config.xpTable[2]); s.player.xpNext = config.xpTable[3];
  s.player.attrPoints = 5; s.player.skillPoints = 1;
  const h = hudState(s, 1280, 800, style);
  assert.ok(Math.abs(h.xpBar.ratio - 0.25) < 0.01);
  assert.equal(h.xpBar.percent, 25);
  assert.deepEqual(h.points, { attr: 5, skill: 1 });
  assert.equal(h.target, null);
  const m = s.monsters[0];
  const t = hudState(s, 1280, 800, style, m.id).target;
  assert.deepEqual([t.id, t.hp, t.hpMax], [m.id, m.hp, m.hpMax]);
  assert.equal(t.name, content.monsters[m.type].name);
});

test("hud slot rects stay inside the viewport at every supported size", () => {
  const s = newGame(1, { start: "town" });
  for (const [w, h] of [[1024, 768], [1280, 800], [1920, 1080], [390, 844]]) {
    const hs = hudState(s, w, h, style), L = hudLayout(w, h);
    for (const r of [...hs.skillBar.slots.map((x) => x.rect), ...hs.belt.map((b) => b.rect)]) assert.ok(inside(r, w, h), `${w}x${h}`);
    assert.equal(hs.floor.depth, 0);
    assert.equal(hs.floor.label, content.strings.lobbyName);
    assert.equal(L.skills.length, 4);
  }
});
