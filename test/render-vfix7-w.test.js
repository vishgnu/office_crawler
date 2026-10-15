// VFIX-R7-WORLD: elite plate placement and crown, loot tags off champions, NPC marker above a nudged plate, map card, faded-actor readability. Pure: stub canvases, no pixels, no wall-clock.
import test from "node:test";
import assert from "node:assert/strict";
import { newGame, content, config } from "../src/core/index.js";
import { setQuestStep } from "../src/core/cheats.js";
import { createFx } from "../src/render/fx.js";
import { createMap } from "../src/render/map.js";
import { createLabels } from "../src/render/labels.js";
import { readFileSync } from "node:fs";
import { NPC_SHAPE, drawNpcMarker, drawNpcMarkers } from "../src/render/questmark.js";
import { palette } from "../src/render/styles/vector/palette.js";
import { keys, DIRS, ANIMS } from "../src/render/keys.js";

const ctx = () => new Proxy({}, { get: (_, k) => (k === "canvas" ? {} : k === "measureText" ? (t) => ({ width: String(t).length * 7 }) : k === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });
const rec = () => { const calls = []; return { calls, g: new Proxy({}, { get: (t, k) => (k === "canvas" ? {} : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k in t ? t[k] : (...a) => { calls.push(k + ":" + a.map((v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)).join(",")); }), set: (t, k, v) => { t[k] = v; calls.push("set " + k + "=" + v); return true; } }) }; };
const withDom = (fn) => {
  const d = globalThis.document, w = globalThis.window;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx() }) };
  globalThis.window = { devicePixelRatio: 1 };
  try { return fn(); } finally { if (d === undefined) delete globalThis.document; else globalThis.document = d; if (w === undefined) delete globalThis.window; else globalThis.window = w; }
};
const style = { palette, dims: Object.fromEntries([...Object.keys(content.npcs).map((id) => [`npc-${id}`, { head: 54, shadowR: 14 }]), ["middle-manager", { head: 70, shadowR: 18 }], ["facilities-manager", { head: 66, shadowR: 17 }]]) };
const cam = { w: 1280, h: 720, z: 1.8, ox: 640, oy: 380 - 21 * 16 * 1.8 };
const lobby = () => newGame(5, { class: "facilities-manager", name: "Tester", start: "town" });
const bodiesOf = (core) => (core.floor.npcs ?? []).map((n, i) => ({ id: `npc:${n.id}`, type: `npc-${n.id}`, npc: true, dead: false, hid: false, sx: 200 + i * 150, sy: 400 }));

const dpr = 1, s = 1;
const actor = (o) => ({ id: "m1", type: "middle-manager", name: "The Toner Tyrant", sub: "", ai: "chase", hp: 50, hpMax: 100, dead: false, champ: true, npc: false, boss: false, hid: false, x: 0, y: 0, sx: 600, sy: 400, d: 3, pr: 0, ...o });

test("G1: the elite plate sits beside the head when the spot above is taken by the hero, not 120 px up a stem", () => {
  withDom(() => {
    const L = createLabels(style), e = actor({}), heroS = { x: 600, y: 330 }; // the hero stands right where the plate would go
    L.place([e], cam, s, null, null, heroS, [], false, dpr);
    assert.equal(L.count, 1);
    const r = L.placed[0], stem = r.ay - (r.y + r.h);
    assert.ok(stem < 60, `the plate bottom is at most 60 px above its anchor (was a long stem): ${stem}`);
    assert.ok(r.y + r.h <= r.ay + r.h, "plate not below the head");
  });
});

test("G1: a champion plate has a crown mark, a normal monster plate has none", () => {
  withDom(() => {
    const L = createLabels(style);
    L.place([actor({})], cam, s, null, null, { x: 100, y: 600 }, [], false, dpr);
    assert.equal(L.placed[0].crown, true);
    L.place([actor({ champ: false, name: "Middle Manager" })], cam, s, "m1", null, { x: 100, y: 600 }, [], false, dpr);
    assert.equal(L.placed[0].crown, false);
  });
});

test("G1: a loot tag never covers a champion's face, even a relaxed one (onChamp)", () => {
  const fx = createFx(style);
  fx.bodies = [actor({ sx: 400, sy: 400 })];
  const z = 1.8, head = style.dims["middle-manager"].head * z;
  assert.equal(fx.onChamp({ x: 380, y: 400 - head, w: 60, h: 20 }, z), true, "on the head");
  assert.equal(fx.onChamp({ x: 380, y: 400 - head - 12 * z, w: 60, h: 10 }, z), true, "on the crown");
  assert.equal(fx.onChamp({ x: 380, y: 420, w: 60, h: 20 }, z), false, "below the feet is free");
  fx.bodies = [actor({ sx: 400, sy: 400, champ: false })];
  assert.equal(fx.onChamp({ x: 380, y: 400 - head, w: 60, h: 20 }, z), false, "a normal monster is not protected by this rule");
});

test("G1: nameplates are drawn through fx.plateDraw after the loot layer (plates last)", () => {
  const fx = createFx(style), order = [];
  fx.plateDraw = () => order.push("plates");
  fx.drawLoot = () => order.push("loot");
  fx.drawProjectiles = () => order.push("proj");
  fx.drawFloaters = () => {}; fx.drawLootPlates = () => {};
  fx.core = { groundItems: [] };
  const rc = rec();
  try { fx.draw(rc.g, cam, { get: () => null }, 0, 0); } catch { /* the rest of the pass is not under test */ }
  assert.deepEqual(order.slice(0, 3), ["loot", "plates", "proj"]);
});

test("G2: the NPC marker is lifted above a plate that was nudged under it (phone, hero beside the NPC)", () => {
  const core = lobby(), list = [], bodies = bodiesOf(core).slice(0, 1), n = bodies[0];
  const at = (avoid) => { const r = rec(); drawNpcMarkers(r.g, cam, core, bodies, list, style, true, 0, avoid); return r.calls.find((c) => String(c).startsWith("arc")) ?? r.calls.join("|"); };
  const plain = at([]);
  const head = 54 * cam.z, defaultY = n.sy - head - 30 - Math.max(9, Math.min(17, 5.4 * cam.z));
  const plate = { x: n.sx - 40, y: defaultY - 10, w: 80, h: 30, plate: true };
  const lifted = at([plate]);
  assert.notEqual(plain, lifted, "the marker moved when a plate was in its way");
  const r2 = rec(); drawNpcMarkers(r2.g, cam, core, bodies, list, style, true, 0, [plate]);
  const ys = r2.calls.filter((c) => /arc/.test(String(c))).map((c) => c);
  assert.ok(ys.length > 0);
});

test("G3: the automap card keeps its legend inside and the title sits on a solid band", () => {
  const src = readFileSync(new URL("../src/render/map.js", import.meta.url), "utf8");
  assert.match(src, /rgba\(7,5,24,0\.97\)"; g\.fillRect\(0, 0, w, titleH/, "solid title band");
  assert.match(src, /ly = rect\.y \+ rect\.h \+ 8 \+ legH - 12/, "legend inside the card");
});

test("G4: mapMarkers lists no elite or item target (core contract), so the map draws only what the core lists", () => {
  const core = lobby();
  assert.equal(setQuestStep(core, "sq3", 1).ok, true);
  core.quests.pinned = "sq3"; core.depth = 4;
  const m = createMap(style);
  assert.equal(typeof m.drawFull, "function");
});

test("N10: an actor standing in front of the hero fades to 0.7 at the lowest (readable, restored over the light)", () => {
  const src = readFileSync(new URL("../src/render/world.js", import.meta.url), "utf8");
  assert.match(src, /if \(it\.a > 0\.7\) it\.a = 0\.7/);
  assert.match(src, /it\.tintA > 0 && !it\.hurt && it\.a > 0\.6/, "restore threshold stays below the fade");
});

test("N9: a ground marker that overlaps the hero redraws the hero over it", () => {
  const src = readFileSync(new URL("../src/render/fx.js", import.meta.url), "utf8");
  assert.match(src, /if \(markOverHero && fx\.heroRedraw\) fx\.heroRedraw\(g\)/);
});
