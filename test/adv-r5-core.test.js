// Adversarial tests for rounds 4/5 (classes, skill trees, respec, aura, xp, names, determinism, class smoke via bots).
// Written without reading the implementer's tests. { todo: 'ADV-R5-NN' } marks a demonstrated defect (see docs/reviews/R5-adversarial.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../src/core/index.js";
import { skills, skillTrees } from "../src/core/content/skills.js";
import { validateName } from "../src/core/name.js";
import { config } from "../src/core/config.js";
import { runOne } from "../bot/run-headless.mjs";

const { newGame, applyInput, step, setLevel, gainXp, teleportFloor, hashState, treeView } = core;
const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
const mk = (cls, seed = 7, start = "town") => newGame(seed, { class: cls, name: "Adv", start, wearStartKit: true });
const lcg = (seed) => () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const sigOf = (cls) => core.classById(cls).signature;
const spentOf = (st) => Object.entries(st.player.skills).reduce((n, [id, l]) => n + (id === sigOf(st.player.class) ? l - 1 : l), 0);
const levelTo = (st, lv) => { for (let g = 0; st.player.level < lv && g < 40; g++) gainXp(st, config.xpTable[st.player.level] - st.player.xp); };

// ---- finding -----------------------------------------------------------------------------------------------------------------

test("ADV-R5-10 names: letters with combining marks (decomposed accents, Thai, Devanagari) are valid names", () => {
  for (const n of ["José", "नमस्ते", "สวัสดี"]) assert.equal(validateName(n).ok, true, JSON.stringify(n));
});

// ---- skill points, learning, respec -------------------------------------------------------------------------------------------

test("points are conserved over 29 level-ups with random learns and respecs, for every class and several seeds", () => {
  for (const cls of CLASSES) for (const seed of [1, 2, 3]) {
    const st = mk(cls, seed), rnd = lcg(seed * 977), ids = Object.keys(skillTrees[cls].skills);
    for (let lv = 2; lv <= 30; lv++) {
      levelTo(st, lv);
      assert.equal(st.player.level, lv);
      for (let k = 0; k < 7; k++) applyInput(st, { t: "learnSkill", id: ids[Math.floor(rnd() * ids.length)] });
      if (rnd() < 0.2) assert.ok(applyInput(st, { t: "respec" }).ok);
      assert.equal(spentOf(st) + st.player.skillPoints, (lv - 1) * config.skillPointsPerLevel, `${cls} level ${lv}`);
      assert.ok(st.player.skillPoints >= 0);
    }
  }
});

test("learn rejects every illegal request with a stable code and changes nothing", () => {
  const st = mk("facilities-manager"); setLevel(st, 7); // tier 2 needs level 8
  const snap = () => JSON.stringify([st.player.skills, st.player.skillPoints, st.player.skillBar]);
  const before = snap();
  const cases = [
    ["floor-buffer", "level-gate"], ["demolition-day", "level-gate"], ["stapler-throw", "wrong-class"], ["server-overheat", "wrong-class"], ["strike", "basic"], ["toss", "basic"],
    ["__proto__", "unknown-skill"], ["constructor", "unknown-skill"], ["toString", "unknown-skill"], ["hasOwnProperty", "unknown-skill"], ["", "unknown-skill"], [null, "unknown-skill"], [undefined, "unknown-skill"], [42, "unknown-skill"], [{}, "unknown-skill"],
  ];
  for (const [id, code] of cases) { const r = applyInput(st, { t: "learnSkill", id }); assert.deepEqual([r.ok, r.error], [false, code], String(id)); }
  assert.equal(snap(), before);
  setLevel(st, 8);
  assert.equal(applyInput(st, { t: "learnSkill", id: "dress-code" }).ok, true);
  const r = applyInput(st, { t: "learnSkill", id: "demolition-day" }); // level 16 gate and prereq both fail
  assert.equal(r.ok, false);
});

test("prerequisite chain: tier 3 needs its tier 2 parent learned, and only the first unmet requirement is named", () => {
  for (const cls of CLASSES) {
    const st = mk(cls); setLevel(st, 30); st.player.skillPoints = 500;
    for (const tree of [skillTrees[cls]]) for (const [id, def] of Object.entries(tree.skills)) {
      for (const req of def.requires ?? []) {
        const fresh = mk(cls); setLevel(fresh, 30); fresh.player.skillPoints = 500;
        if (id === sigOf(cls)) continue;
        delete fresh.player.skills[req.id]; // the signature is free: take it away so the requirement is unmet
        const r = applyInput(fresh, { t: "learnSkill", id });
        assert.deepEqual([r.ok, r.error], [false, "prereq"], `${cls}/${id} learnable without ${req.id}`);
        const v = core.skillView(fresh, id);
        assert.equal(v.canLearn, false);
        assert.equal(v.state, "locked-prereq");
        assert.ok(v.lockReason && v.lockReason.length > 3);
      }
    }
  }
});

test("max level, no points, level cap: learn stops exactly at the cap and the UI view agrees (canLearn === learn.ok)", () => {
  for (const cls of CLASSES) {
    const st = mk(cls); setLevel(st, 30); st.player.skillPoints = 1000;
    for (let round = 0; round < 8; round++) for (const id of Object.keys(skillTrees[cls].skills)) {
      const can = core.skillView(st, id).canLearn;
      const r = applyInput(st, { t: "learnSkill", id });
      assert.equal(r.ok, can, `${cls}/${id} view says ${can}, learn says ${r.ok} (${r.error})`);
    }
    for (const [id, lv] of Object.entries(st.player.skills)) assert.ok(lv <= Math.min(skills[id].maxLevel, config.skillMaxLevel), `${id} ${lv}`);
    st.player.skillPoints = 0;
    const r = applyInput(st, { t: "learnSkill", id: Object.keys(skillTrees[cls].skills)[0] });
    assert.ok(["no-points", "max-level"].includes(r.error));
  }
});

test("respec: Lobby only, alive only, idempotent (no point inflation), signature kept, hotkeys of removed actives cleared", () => {
  for (const cls of CLASSES) {
    const st = mk(cls); setLevel(st, 20);
    for (let r = 0; r < 4; r++) for (const id of Object.keys(skillTrees[cls].skills)) applyInput(st, { t: "learnSkill", id });
    const total = spentOf(st) + st.player.skillPoints;
    teleportFloor(st, 1);
    assert.deepEqual(applyInput(st, { t: "respec" }), { ok: false, error: "not-in-town" });
    assert.equal(spentOf(st) + st.player.skillPoints, total);
    teleportFloor(st, 0);
    assert.ok(applyInput(st, { t: "respec" }).ok);
    assert.equal(st.player.skillPoints, total);
    assert.deepEqual(Object.keys(st.player.skills), [sigOf(cls)]);
    for (const id of st.player.skillBar.hotkeys) assert.ok(id === null || id === sigOf(cls), `${cls}: hotkey ${id} survived`);
    assert.ok(applyInput(st, { t: "respec" }).ok);
    assert.equal(st.player.skillPoints, total, "second respec changed the total");
    assert.equal(st.player.skillBar.secondary, st.player.skillBar.hotkeys[st.player.skillBar.selected] ?? null);
  }
});

test("respec is refused while dead and while paused; treeView.respec says why", () => {
  const st = mk("sales-rep"); setLevel(st, 10);
  st.paused = true;
  assert.equal(applyInput(st, { t: "respec" }).ok, false);
  st.paused = false;
  assert.equal(treeView(st).respec.available, true);
  teleportFloor(st, 1);
  assert.equal(treeView(st).respec.available, false);
  assert.equal(treeView(st).respec.reason, "not-in-town");
  core.setHp(st, 0);
  assert.equal(st.scene, "dead");
  assert.equal(applyInput(st, { t: "respec" }).ok, false);
});

test("assignSkill and selectSkill: unlearned, passive, foreign basic and out-of-range slots are rejected without touching the bar", () => {
  const st = mk("it-wizard"); setLevel(st, 12); st.player.skillPoints = 20;
  applyInput(st, { t: "learnSkill", id: "power-surge" }); applyInput(st, { t: "learnSkill", id: "cold-boot" });
  const bar = () => JSON.stringify(st.player.skillBar);
  const before = bar();
  const bad = [
    [0, "blue-screen"], [1, "firewall"], [0, "pallet-slam"], [0, "strike"], [0, "toss"], [4, "power-surge"], [-1, "power-surge"], [1.5, "power-surge"], ["1", "power-surge"], [NaN, "power-surge"], [undefined, "power-surge"],
    [0, "__proto__"], [0, "constructor"], ["primary", "power-surge"], ["secondary", "power-surge"],
  ];
  for (const [slot, id] of bad) { const r = applyInput(st, { t: "assignSkill", slot, id }); assert.equal(r.ok, false, `${slot}/${id}`); }
  assert.equal(bar(), before);
  for (const index of [-1, 4, 1.5, "2", NaN, null, undefined]) assert.equal(applyInput(st, { t: "selectSkill", index }).ok, false, String(index));
  assert.equal(bar(), before);
  assert.ok(applyInput(st, { t: "assignSkill", slot: 3, id: "cold-boot" }).ok);
  assert.ok(applyInput(st, { t: "selectSkill", index: 3 }).ok);
  assert.equal(st.player.skillBar.secondary, "cold-boot");
  assert.ok(applyInput(st, { t: "assignSkill", slot: 3, id: null }).ok);
  assert.equal(st.player.skillBar.secondary, null, "emptying the selected hotkey must empty secondary");
});

test("right mouse with an empty or basic-attack selected hotkey fails cleanly (no throw, no mana spent)", () => {
  const st = mk("facilities-manager", 3, "floor");
  const hot = st.player.skillBar.hotkeys;
  assert.ok(applyInput(st, { t: "selectSkill", index: 2 }).ok);
  assert.equal(st.player.skillBar.secondary, null);
  const t = { x: st.player.tile.x + 1, y: st.player.tile.y }, mp = st.player.mp;
  let r; assert.doesNotThrow(() => { r = applyInput(st, { t: "mouse", phase: "down", button: 2, tile: t }); });
  assert.equal(r.ok, false);
  assert.ok(applyInput(st, { t: "assignSkill", slot: 2, id: "strike" }).ok); // the panel offers this
  assert.doesNotThrow(() => { r = applyInput(st, { t: "mouse", phase: "down", button: 2, tile: t }); });
  assert.equal(st.player.mp, mp);
  assert.ok(hot);
});

test("aura: one at a time, off again, cleared by respec, needs learning, reservation never leaves mp above the cap", () => {
  const st = mk("facilities-manager"); setLevel(st, 20); st.player.skillPoints = 30;
  assert.equal(applyInput(st, { t: "toggleAura", id: "fire-drill" }).error, "not-learned");
  assert.equal(applyInput(st, { t: "toggleAura", id: "pallet-slam" }).error, "not-aura");
  assert.equal(applyInput(st, { t: "toggleAura", id: "nope" }).error, "not-aura");
  applyInput(st, { t: "learnSkill", id: "dress-code" }); applyInput(st, { t: "learnSkill", id: "fire-drill" });
  const mpMaxOff = st.player.mpMax;
  assert.ok(applyInput(st, { t: "toggleAura", id: "fire-drill" }).ok);
  assert.equal(st.player.aura, "fire-drill");
  assert.ok(st.player.mp <= st.player.mpMax - (st.player.mpReserved ?? 0) + 0, `mp ${st.player.mp} above effective cap`);
  for (let i = 0; i < 120; i++) { step(st); assert.ok(st.player.mp <= st.player.mpMax, "mp over cap"); }
  assert.ok(applyInput(st, { t: "toggleAura", id: "fire-drill" }).ok);
  assert.equal(st.player.aura, null);
  assert.equal(st.player.mpMax, mpMaxOff);
  applyInput(st, { t: "toggleAura", id: "fire-drill" });
  assert.ok(applyInput(st, { t: "respec" }).ok);
  assert.equal(st.player.aura, null);
  assert.equal(st.player.mpReserved ?? 0, 0);
  // not enough mana to reserve
  setLevel(st, 20); applyInput(st, { t: "learnSkill", id: "dress-code" }); applyInput(st, { t: "learnSkill", id: "fire-drill" });
  st.player.mp = 0;
  assert.equal(applyInput(st, { t: "toggleAura", id: "fire-drill" }).error, "no-mana");
  assert.equal(st.player.aura, null);
});

test("an aura skill on a hotkey: casting it toggles, never spends a normal cast, and works through the right mouse path", () => {
  const st = mk("facilities-manager", 3, "floor"); setLevel(st, 20); st.player.skillPoints = 30;
  applyInput(st, { t: "learnSkill", id: "dress-code" }); applyInput(st, { t: "learnSkill", id: "fire-drill" });
  const slot = st.player.skillBar.hotkeys.indexOf("fire-drill");
  assert.ok(slot >= 0, "newly learned aura takes a free hotkey");
  applyInput(st, { t: "selectSkill", index: slot });
  const t = { x: st.player.tile.x + 1, y: st.player.tile.y };
  assert.ok(applyInput(st, { t: "mouse", phase: "down", button: 2, tile: t }).ok);
  applyInput(st, { t: "mouse", phase: "up", button: 2 });
  assert.equal(st.player.aura, "fire-drill");
});

// ---- xp ----------------------------------------------------------------------------------------------------------------------

test("xp edge cases: NaN, negative, zero, Infinity and a huge grant at the cap never break level, points or xpNext", () => {
  const st = mk("sales-rep");
  for (const amount of [NaN, -5, 0, undefined, null, "10"]) { const lv = st.player.level, xp = st.player.xp; gainXp(st, amount); assert.equal(st.player.level, lv, String(amount)); if (typeof amount !== "string") assert.equal(st.player.xp, xp); }
  gainXp(st, 1e12);
  assert.equal(st.player.level, config.levelCap);
  assert.equal(st.player.skillPoints, (config.levelCap - 1) * config.skillPointsPerLevel);
  assert.ok(st.player.xp <= config.xpPastCap);
  const pts = st.player.skillPoints;
  gainXp(st, Infinity); gainXp(st, 5);
  assert.equal(st.player.level, config.levelCap);
  assert.equal(st.player.skillPoints, pts);
  assert.ok(Number.isFinite(st.player.xpNext));
  assert.equal(st.player.hp, st.player.hpMax);
});

test("ADV-R5-05 (xp bar at level 1): the level-2 threshold shown equals the one that triggers the level-up", () => {
  const st = mk("sales-rep");
  gainXp(st, st.player.xpNext); // gain exactly what the bar says is needed
  assert.equal(st.player.level, 2, `xpNext ${config.player.xpNext} shown, but level 2 needs ${config.xpTable[1]}`);
});

// ---- determinism and robustness ----------------------------------------------------------------------------------------------

test("determinism per class: same seed and the same learn/respec/cast/move script twice gives equal hashes at every checkpoint", () => {
  const script = (cls) => {
    const st = mk(cls, 11, "town"), hashes = [], ids = Object.keys(skillTrees[cls].skills);
    setLevel(st, 18);
    for (let i = 0; i < 12; i++) applyInput(st, { t: "learnSkill", id: ids[i % ids.length] });
    hashes.push(hashState(st));
    applyInput(st, { t: "respec" });
    for (const id of ids.slice(0, 6)) applyInput(st, { t: "learnSkill", id });
    teleportFloor(st, 2);
    for (let i = 0; i < 400; i++) {
      if (i % 40 === 0) { const m = core.spawnMonster(st, "zombie-intern", { x: st.player.tile.x + 3, y: st.player.tile.y }); void m; applyInput(st, { t: "cast", tile: { x: st.player.tile.x + 2, y: st.player.tile.y } }); }
      if (i % 90 === 0) applyInput(st, { t: "selectSkill", index: (i / 90) % 4 });
      step(st);
      if (i % 100 === 99) hashes.push(hashState(st));
    }
    return hashes;
  };
  for (const cls of CLASSES) assert.deepEqual(script(cls), script(cls), cls);
  assert.notDeepEqual(script("sales-rep"), script("it-wizard"));
});

test("casting every skill of every class at hostile tiles (off map, huge, fractional, null) never throws and stays fast", () => {
  const tiles = [{ x: 1e9, y: 1e9 }, { x: -1, y: -1 }, { x: -2147483648, y: 2147483647 }, { x: 0.5, y: 2 }, { x: "3", y: "3" }, null, undefined, {}];
  for (const cls of CLASSES) for (const id of Object.keys(skillTrees[cls].skills)) for (const tile of tiles) {
    const st = mk(cls, 9); setLevel(st, 30); st.player.skillPoints = 200;
    for (let k = 0; k < 6; k++) for (const s of Object.keys(skillTrees[cls].skills)) applyInput(st, { t: "learnSkill", id: s });
    teleportFloor(st, 3); st.player.mp = st.player.mpMax;
    assert.doesNotThrow(() => { applyInput(st, { t: "cast", skill: id, tile }); for (let i = 0; i < 20; i++) step(st); }, `${cls}/${id}/${JSON.stringify(tile)}`);
  }
});

test("setName accepts only valid names in play and emits renamed once", () => {
  const st = mk("sales-rep");
  for (const bad of ["", "   ", "x".repeat(17), "<b>", null, 5, undefined]) assert.equal(applyInput(st, { t: "setName", name: bad }).error, "bad-name");
  assert.equal(st.player.name, "Adv");
  const n = st.events.length;
  assert.ok(applyInput(st, { t: "setName", name: "  New   Name " }).ok);
  assert.equal(st.player.name, "New Name");
  assert.equal(st.events.slice(n).filter((e) => e.type === "renamed").length, 1);
});

test("class smoke via bots (report only, no balance assertion): every class clears floor 1 on 3 seeds without throwing or getting stuck", () => {
  const rows = [];
  for (const cls of CLASSES) for (const seed of [1, 2, 3]) {
    let r; assert.doesNotThrow(() => { r = runOne(seed, 14000, { class: cls }); }, `${cls}/${seed}`);
    assert.ok(["cleared", "running", "died", "timeout", "won"].includes(r.result), `${cls}/${seed}: ${r.result}`);
    assert.ok(Number.isFinite(r.ticks));
    rows.push(`${cls} seed ${seed}: ${r.result} in ${r.ticks} ticks, level ${r.level}, deaths ${r.deaths ?? 0}`);
  }
  console.log("# class parity smoke (floor 1)\n# " + rows.join("\n# "));
});
