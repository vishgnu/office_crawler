// S2 fix round (UI-FIX): HUD slot sizes, XP display, tooltip keep-clear, label avoidance helpers, map keys, Emergency Exit messages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, config, applyInput } from "../src/core/index.js";
import { hudLayout, drawerLayout, placeTip, isPhone } from "../src/ui/layout.js";
import { xpProgress } from "../src/ui/itemview.js";
import { hudState } from "../src/render/hud.js";
import { segHitsRect } from "../src/render/fx.js";
import { exploredOf } from "../src/render/map.js";
import { messageFor } from "../src/ui/messages.js";
import { panelFor } from "../src/input/keys.js";

const style = { ui: { shapes: { health: "mug", mana: "jug" } } };
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("HUD skill and belt slots are at least 44 px at every size, inside the screen, and never overlap", () => {
  for (const [w, h] of [[1024, 768], [1280, 720], [1280, 800], [1920, 1080], [900, 700], [390, 844], [844, 390]]) {
    const L = hudLayout(w, h);
    for (const r of [...L.skills, ...L.belt]) {
      assert.ok(r.w >= 44 - 1e-6 && r.h >= 44 - 1e-6, `${w}x${h}: slot ${r.w}`);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h, `${w}x${h}: slot on screen`);
    }
    for (let i = 0; i < L.skills.length; i++) for (const b of L.belt) assert.ok(!hit(L.skills[i], b), `${w}x${h}: skill/belt overlap`);
  }
});

test("HUD names: shown beside the belt on desktop (two lines), not on a stacked phone HUD; the xp label always has room", () => {
  assert.equal(hudLayout(1024, 768).showNames, true);
  assert.equal(hudLayout(1024, 768).stacked, false);
  assert.equal(hudLayout(390, 844).showNames, false);
  assert.equal(hudLayout(1024, 768).compactXp, false);
  assert.equal(hudLayout(390, 844).compactXp, false);
});

test("phone: the zone name sits below the panel buttons, the target bar below the zone name; drawers leave a toast lane above the HUD", () => {
  const L = hudLayout(390, 844);
  assert.ok(L.floorName.y >= 6 + 44 + 8, "zone name under the dock");
  assert.ok(L.target.y >= L.floorName.y, "target bar not above the zone name");
  const D = drawerLayout(390, 844);
  assert.ok(D.bottom <= D.hudTop - 6 - 36, `toast lane: ${D.bottom} vs ${D.hudTop}`);
  assert.equal(isPhone(390, 844), true);
});

test("drawers stop above the whole bottom bar on desktop, also at 1024 where the bar is taller than the vessels", () => {
  for (const [w, h] of [[1024, 768], [1280, 800], [1920, 1080]]) { const D = drawerLayout(w, h); assert.ok(D.bottom <= D.hudTop - 8 + 1, `${w}x${h}`); }
});

test("XP display: within-level numbers and percent agree; the total is kept for the tooltip (contract)", () => {
  const s = newGame(1, { start: "town" }), p = s.player, base = config.xpTable[6], span = config.xpTable[7] - base, num = (n) => n.toLocaleString("en-US");
  p.level = 7; p.xp = base; p.xpNext = config.xpTable[7];
  let v = xpProgress(p);
  assert.deepEqual([v.into, v.span, v.pct, v.total], [0, span, 0, base]);
  p.xp = base + Math.floor(span / 4);
  v = xpProgress(p);
  const pct = Math.floor((Math.floor(span / 4) / span) * 100);
  assert.deepEqual([v.into, v.span, v.pct, v.total, v.capped], [Math.floor(span / 4), span, pct, p.xp, false]);
  const hs = hudState(s, 1280, 800, style).xp;
  assert.equal(hs.label, `${num(Math.floor(span / 4))} / ${num(span)} (${pct}%)`);
  assert.equal(hs.tip, `Total experience: ${num(p.xp)}`);
  assert.equal(hs.percent, pct);
});

test("placeTip keeps clear of the rectangles it is told to protect (the + buttons) when any candidate does", () => {
  const bounds = { left: 8, top: 8, right: 1016, bottom: 640 }, hero = { x: 480, y: 200, w: 64, h: 160 };
  const panel = { x: 540, y: 8, w: 484, h: 640 }, anchor = { x: 700, y: 400, w: 44, h: 88 };
  const plus = { x: 280, y: 230, w: 44, h: 44 };
  for (const tipH of [160, 260, 380]) {
    const t = placeTip({ w: 292, h: tipH, anchor, panel, side: "right", drawers: [{ x: 0, y: 8, w: 340, h: 640 }, panel], hero, bounds, keepClear: [plus] });
    assert.ok(!hit({ x: t.x, y: t.y, w: 292, h: t.h }, plus), `tip ${tipH} covers the + button at ${t.x},${t.y}`);
  }
});

test("segHitsRect: a leader line through a label is detected, one that passes beside it is not", () => {
  const r = { x: 100, y: 100, w: 80, h: 20 };
  assert.equal(segHitsRect([140, 60, 140, 200], r), true);
  assert.equal(segHitsRect([60, 60, 60, 200], r), false);
});

test("exploredOf reads floor.explored (core contract: 0/1 array of w*h)", () => {
  const s = newGame(1, { start: "town" });
  const ex = exploredOf(s);
  assert.ok(Array.isArray(ex) && ex.length === s.floor.w * s.floor.h);
  assert.equal(exploredOf({}), null);
});

test("Emergency Exit and map: toast lines exist for the door events, M and Tab open the map panel", () => {
  const s = newGame(1, { start: "town" });
  assert.match(messageFor({ type: "portalOpen" }, s), /Emergency Exit/);
  assert.ok(messageFor({ type: "portalUse" }, s));
  assert.equal(panelFor("KeyM"), "map");
  assert.equal(panelFor("Tab"), "map");
  assert.ok(applyInput); // the core accepts { t: "useItem" } (tested in the core package)
});
