// WORLD-R7Q (R7-0.7): NPC marker shapes, quest ground entry (no item, no gold), map pin, named elite and warm-up. Pure: recording / stub canvases, no pixels, no wall-clock.
import test from "node:test";
import assert from "node:assert/strict";
import { newGame, content, config } from "../src/core/index.js";
import { setQuestStep } from "../src/core/cheats.js";
import { createFx } from "../src/render/fx.js";
import { createMap } from "../src/render/map.js";
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

test("NPC marker shapes: two distinct non-colour shapes, exposed as the model [{id, shape}]", () => {
  assert.deepEqual(Object.keys(NPC_SHAPE).sort(), ["available", "handin"]);
  assert.notEqual(NPC_SHAPE.available, NPC_SHAPE.handin);
  const core = lobby(), list = [], fx = createFx(style);
  drawNpcMarkers(ctx(), cam, core, bodiesOf(core), list, style, false, 0);
  assert.deepEqual(list.map((r) => `${r.id}:${r.shape}`).sort(), ["healer:exclamation", "potions:exclamation", "vendor:exclamation"], "the stash keeper has no marker");
  assert.equal(setQuestStep(core, "sq2", 2).ok, true);
  drawNpcMarkers(ctx(), cam, core, bodiesOf(core), list, style, false, 0);
  assert.equal(list.find((r) => r.id === "healer").shape, "question");
  assert.equal(list.find((r) => r.id === "vendor").shape, "exclamation");
  assert.ok(fx.npcMarkers === undefined || Array.isArray(fx.npcMarkers));
});

test("NPC marker: the draw paths of the two shapes differ, and the bob stops under reduced motion", () => {
  const draw = (shape, reduced, now) => { const r = rec(); drawNpcMarker(r.g, shape, 100, 100, 10, "#000", reduced, now); return r.calls.join("|"); };
  assert.notEqual(draw("exclamation", false, 0), draw("question", false, 0));
  assert.equal(draw("exclamation", true, 0), draw("exclamation", true, 777), "static under reduced motion");
  assert.equal(draw("question", true, 0), draw("question", true, 1234));
  assert.notEqual(draw("exclamation", false, 0), draw("exclamation", false, 800), "a gentle bob otherwise");
});

test("NPC markers: nothing on a floor below the Lobby, and the model list is cleared", () => {
  const core = lobby(), list = [{ id: "x", shape: "y" }];
  core.depth = 2;
  drawNpcMarkers(ctx(), cam, core, bodiesOf(core), list, style, false, 0);
  assert.equal(list.length, 0);
});

test("no new atlas keys: markers are procedural (keys.js has no quest or marker sprite)", async () => {
  const { readFileSync } = await import("node:fs");
  assert.ok(!/quest|npcmark|overhead/i.test(readFileSync(new URL("../src/render/keys.js", import.meta.url), "utf8")));
  assert.ok(!/atlas\.add|atlas\.get/.test(readFileSync(new URL("../src/render/questmark.js", import.meta.url), "utf8")));
});

test("quest ground entry without item and gold: ring, beam, sign and plate draw without throwing, plate text is the label, reduced motion is steady", () => withDom(() => {
  const entry = { id: "qi-sq2", quest: "sq2", label: "Lost Staff Badge", rarity: "normal", mark: "!", border: "none", color: "#f0e442", keep: true, tile: { x: 10, y: 10 } };
  const core = { player: { tile: { x: 10, y: 8 } }, groundItems: [entry] };
  for (const reduced of [false, true]) {
    const fx = createFx(style); fx.heroType = "facilities-manager"; fx.reducedMotion = reduced; fx.heroS = { x: 640, y: 380 }; fx.bodies = [];
    const ring = (now) => { const r = rec(); fx.lootRing(r.g, entry, 400, 300, 2, now); return r.calls.join("|"); };
    assert.ok(ring(0).length > 0, "a ring is drawn for the quest entry");
    if (reduced) assert.equal(ring(0), ring(500), "steady ring under reduced motion"); else assert.notEqual(ring(0), ring(500));
    fx.drawLoot(ctx(), cam, core, 1000); fx.drawLootPlates(ctx(), cam, core, 1000);
    assert.ok(fx.lt.pool[0].colour === "#f0e442", "the quest colour, not the grey of a normal item");
    assert.equal(fx.platesPlaced.length, 2, "hero keep-out plus the quest plate (always shown in sight)");
  }
}));

test("fx.handle ignores quest.* events", () => withDom(() => {
  const fx = createFx(style), core = lobby();
  for (const type of ["quest.accepted", "quest.step", "quest.item", "quest.completed", "quest.progress", "quest.unknown"]) assert.doesNotThrow(() => fx.handle({ type, id: "sq2" }, core, 0));
}));

test("map pin: a known quest target gets a yellow pin and a text label on the full map, none when mapMarkers is empty", () => withDom(() => {
  const core = lobby(), map = createMap(style);
  const run = (draw) => { const r = rec(); draw(r.g); return r.calls.join("|"); };
  const full = () => run((g) => map.drawFull(g, core, 1280, 720, 0, false));
  core.quests.pinned = "main";
  const without = full();
  core.quests.pinned = "sq2"; // available: the giver (the healer) in the Lobby
  const withPin = full();
  assert.ok(withPin.includes("First Aider"), "the label text is drawn");
  assert.ok(!without.includes("First Aider"));
  assert.ok(withPin.includes("#f0e442"), "yellow pin");
  assert.notEqual(withPin, without);
  const mini = run((g) => map.drawMini(g, core, { x: 12, y: 40, w: 176, h: 124 }, 0, false));
  assert.ok(mini.includes("#f0e442"), "the minimap has the pin too (no label)");
  assert.ok(!mini.includes("First Aider"));
}));

test("warm: the quest elite's type is warmed while sq3 is active, once, and not before", async () => {
  const { warmFrames } = await import("../src/render/world.js");
  const type = config.quests.elite.type, counts = new Map();
  const all = new Set(); for (const a of ["idle", "walk", "attack"]) for (let d = 0; d < DIRS; d++) for (let f = 0; f < ANIMS[a]; f++) all.add(keys.mon(type, a, d, f));
  const atlas = { isDrawn: (k) => (all.has(k) ? counts.has(k) : undefined), get: (k) => { counts.set(k, (counts.get(k) ?? 0) + 1); return {}; } };
  const core = { depth: 0, monsters: [], player: { class: "it-wizard" }, quests: { sq3: { s: "available", p: 0 } } };
  for (let i = 0; i < 50; i++) warmFrames(atlas, core, 0);
  assert.ok(![...counts.keys()].some((k) => k.startsWith(`mon:${type}:`)), "not warmed while the quest is not active");
  core.quests.sq3.s = "active";
  let calls = 0;
  while (counts.size < all.size && calls++ < 2000) warmFrames(atlas, core, 0);
  for (const k of all) assert.equal(counts.get(k), 1, `${k} drawn once`);
});
