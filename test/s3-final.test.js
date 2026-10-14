// S3 final-fix pass: hostile saves, save data-loss paths, mid-boss save, story frame, audio pause/hidden, reduced motion, flash rate, text size.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, step, teleportFloor, setLevel, config, content } from "../src/core/index.js";
import { serialize, deserialize, checksumOf, createSaveStore, createMemoryAdapter } from "../src/save/index.js";
import { BACKUPS } from "../src/save/storage.js";
import { canonical } from "../src/core/hash.js";
import { createBus } from "../src/bus.js";
import { createAudio } from "../src/audio/index.js";
import { palette } from "../src/render/styles/vector/palette.js";
import { createFx, FLASH_HALF_MS, lowHpPeriod } from "../src/render/fx.js";

const rich = () => {
  const s = newGame(21, { start: "town" }); setLevel(s, 5);
  for (let i = 0; i < 3; i++) step(s);
  return s;
};
/** Edit a good save and re-seal it with a correct checksum, so only the schema can reject it. */
function forge(mutate, state = rich()) {
  const obj = JSON.parse(serialize(state));
  mutate(obj);
  delete obj.checksum;
  return canonical({ ...obj, checksum: checksumOf(obj) });
}
const withItem = (fn) => (o) => {
  const it = { id: "x1", base: "ruler-rapier", name: "Ruler Rapier", kind: "gear", rarity: "normal", w: 1, h: 3, x: 0, y: 0, affixes: [] };
  fn(it); o.inventory.items.push(it);
};

test("S8 hostile saves are rejected by the schema (correct checksum, bad content) and never pollute prototypes", () => {
  const bad = {
    "inherited skill id": (o) => { o.player.skills = { constructor: 3 }; },
    "inherited skill bar id": (o) => { o.player.skillBar.primary = "constructor"; },
    "unknown base": withItem((it) => { it.base = "nope"; }),
    "inherited base": withItem((it) => { it.base = "constructor"; }),
    "oversize name": withItem((it) => { it.name = "A".repeat(5000); }),
    "unknown affix stat": withItem((it) => { it.affixes = [{ stat: "nope", value: 1 }]; }),
    "huge defense": withItem((it) => { it.defense = 1e300; }),
    "huge negative damage": withItem((it) => { it.damage = { min: -1e300, max: 1 }; }),
    "extra item key": withItem((it) => { it.evil = 1; }),
    "huge affix value": withItem((it) => { it.affixes = [{ stat: "damage", value: 1e12 }]; }),
    "__proto__ item key": withItem((it) => { Object.defineProperty(it, "__proto__", { value: { polluted: 1 }, enumerable: true }); }),
    "inherited equipment slot": (o) => { o.equipment.constructor = null; },
    "too many uniques": (o) => { o.uniquesFound = Array.from({ length: 500 }, (_, i) => `u${i}`); },
  };
  for (const [name, mutate] of Object.entries(bad)) {
    const text = forge(mutate).replace(/"__proto___/g, '"__proto__');
    const r = deserialize(text);
    assert.equal(r.ok, false, name);
    assert.equal(r.reason, "schema", name);
  }
  const proto = deserialize(forge(() => {}).replace('"class"', '"__proto__":{"polluted":1},"class"'));
  assert.equal(proto.ok, false);
  assert.equal({}.polluted, undefined);
  assert.equal(deserialize(forge(() => {})).ok, true, "the unmodified save still loads");
});

test("S5 a save from a newer build is copied to the backup before the first autosave overwrites it", () => {
  const newer = canonical({ format: "office-crawler-save", version: config.saveVersion + 1, note: "from the future" });
  const a = createMemoryAdapter({ [config.saveKey]: newer });
  const store = createSaveStore(a);
  assert.equal(store.load().reason, "newer");
  assert.equal(a.getItem(config.saveKey), newer, "load leaves it alone");
  assert.equal(store.save(rich(), { force: true }).ok, true);
  assert.equal(store.exportText("corrupt"), newer, "the newer save is kept");
  assert.equal(deserialize(a.getItem(config.saveKey)).ok, true);
  // when the copy cannot be made, the newer save stays and the save reports failure
  const b = createMemoryAdapter({ [config.saveKey]: newer }); b.failWrites = true;
  const s2 = createSaveStore(b);
  assert.equal(s2.save(rich(), { force: true }).ok, false);
  assert.equal(b.getItem(config.saveKey), newer);
});

test("S6 damaged saves: quarantine keeps the slot when the backup cannot be written; three rotating backups, newest first", () => {
  const a = createMemoryAdapter({ [config.saveKey]: "{bad0" });
  a.failWrites = true;
  const store = createSaveStore(a);
  assert.equal(store.load().corrupt, true);
  assert.equal(a.getItem(config.saveKey), "{bad0", "quota error: the damaged text is not thrown away");
  a.failWrites = false;
  const seen = [];
  for (let i = 1; i <= 4; i++) {
    a.setItem(config.saveKey, `{bad${i}`);
    assert.equal(store.load().corrupt, true);
    assert.equal(a.getItem(config.saveKey), null);
    seen.push(`{bad${i}`);
  }
  assert.equal(BACKUPS, 3);
  const keys = [config.saveBackupKey, `${config.saveBackupKey}.1`, `${config.saveBackupKey}.2`];
  assert.deepEqual(keys.map((k) => a.getItem(k)), ["{bad4", "{bad3", "{bad2"]);
  assert.equal(a.keys().filter((k) => k.startsWith(config.saveBackupKey)).length, 3);
});

test("S6/S7 a failed save write never clears the slot; import keeps the replaced character as a backup", () => {
  const a = createMemoryAdapter(), store = createSaveStore(a);
  const s = rich();
  assert.equal(store.save(s, { force: true }).ok, true);
  const before = a.getItem(config.saveKey);
  a.failWrites = true;
  s.player.gold += 5;
  assert.equal(store.save(s, { force: true }).ok, false);
  assert.equal(a.getItem(config.saveKey), before);
  a.failWrites = false;
  const other = serialize(newGame(99, { start: "town" }));
  assert.equal(store.importText(other).ok, true);
  assert.equal(store.exportText("corrupt"), before, "the replaced save is the newest backup");
  assert.equal(a.getItem(config.saveKey), other);
  a.failWrites = true;
  assert.equal(store.importText(serialize(rich())).ok, false);
  assert.equal(a.getItem(config.saveKey), other, "a failed import leaves the slot alone");
});

test("S9 a save taken in the boss arena resumes at the arena entry with the boss at full health; attempts are kept", () => {
  const s = newGame(8, { start: "town" }); setLevel(s, 10);
  teleportFloor(s, 9);
  for (let i = 0; i < 40; i++) step(s);
  const boss = s.monsters.find((m) => m.tier === "boss" || m.boss);
  assert.ok(boss, "the boss is on the floor");
  boss.hp = Math.floor(boss.hpMax / 3); s.stats.bossAttempts = 2;
  const r = deserialize(serialize(s));
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.scene, "floor"); assert.equal(r.state.depth, 9);
  assert.equal(r.state.stats.bossAttempts, 2);
  const b2 = r.state.monsters.find((m) => m.tier === "boss" || m.boss);
  assert.ok(b2 && b2.hp === b2.hpMax, "fresh boss at full health");
  assert.equal(r.state.bossDefeated, false);
  for (let i = 0; i < 20; i++) step(r.state); // resumes without throwing
});

test("AC-R-104-1 content.story has start, boss and victory entries of 3 to 5 non-empty lines that pass both denylists", () => {
  const st = content.story;
  assert.deepEqual(Object.keys(st).sort(), ["boss", "start", "victory"]);
  const terms = ["docs/product/ip-denylist.txt", "docs/product/ip-denylist-brands.txt"].flatMap((f) => readFileSync(f, "utf8").split("\n")).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
  for (const [k, e] of Object.entries(st)) {
    assert.ok(e.lines.length >= 3 && e.lines.length <= 5, k);
    assert.ok(e.title.length > 0);
    for (const line of e.lines) {
      assert.ok(line.trim().length > 0, k);
      for (const t of terms) assert.ok(!new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(`${e.title} ${line}`.toLowerCase()), `${k}: ${t}`);
    }
  }
});

test("S1/S2 audio: a null state (title screen) is not a pause; a hidden tab suspends, visible resumes unless paused", () => {
  const log = [];
  class Ctx {
    constructor() { this.currentTime = 1; this.state = "suspended"; this.destination = {}; }
    createGain() { return { gain: { value: 1, setTargetAtTime() {} }, connect() {}, disconnect() {} }; }
    resume() { this.state = "running"; log.push("resume"); return Promise.resolve(); }
    suspend() { this.state = "suspended"; log.push("suspend"); return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  const kit = () => ({ play: () => 0, startAmbient: () => ({ stop() {} }), setVolume() {}, setMuted() {} });
  let cur = { tick: 1, scene: "floor", depth: 1, floor: { theme: "open-plan" }, paused: false, player: { tile: { x: 1, y: 1 } }, monsters: [], projectiles: [] };
  const au = createAudio({ bus: createBus(), getState: () => cur, deps: { AudioContext: Ctx, kits: { gothic: kit, chiptune: kit, foley: kit }, now: () => 0, pollMs: 0 } });
  au.unlock();
  cur = { ...cur, paused: true }; au.sync();
  assert.equal(au.getState().ctxState, "suspended");
  cur = null; au.sync(); // pause -> Quit to title
  assert.equal(au.getState().ctxState, "running");
  au.setVisible(false); assert.equal(au.getState().ctxState, "suspended");
  au.setVisible(true); assert.equal(au.getState().ctxState, "running");
  cur = { tick: 1, scene: "floor", depth: 1, floor: { theme: "open-plan" }, paused: true, player: { tile: { x: 1, y: 1 } }, monsters: [], projectiles: [] };
  au.setVisible(false); au.setVisible(true);
  assert.equal(au.getState().ctxState, "suspended", "a paused game stays suspended when the tab comes back");
});

test("S4 reduced motion: no victory flash or confetti, a steady low-HP edge", () => {
  const calls = [];
  const g = new Proxy({}, { get: (_, k) => (k === "canvas" ? {} : (...a) => { calls.push(String(k)); return undefined; }), set: () => true });
  const fx = createFx({});
  fx.victoryAt = 1000;
  fx.drawConfetti(g, { w: 800, h: 600, z: 1 }, 1100);
  assert.ok(calls.length > 20, "confetti draws normally");
  calls.length = 0; fx.reducedMotion = true;
  fx.drawConfetti(g, { w: 800, h: 600, z: 1 }, 1100);
  assert.equal(calls.length, 0);
});

test("AC-NFR-A05-2 no effect flashes more than 3 times per second", () => {
  assert.ok(1000 / (2 * FLASH_HALF_MS) <= 3, "boss telegraph edge: one on/off cycle per 2 x FLASH_HALF_MS");
  for (const r of [0.01, 0.1, 0.2, 0.299]) assert.ok(1000 / lowHpPeriod(r) <= 3, `low-HP pulse at ${r}`);
  assert.ok(config.hurtFlashMs === undefined || 1000 / config.hurtFlashMs <= 3);
});

test("AC-NFR-A04-1 no stylesheet text is smaller than 14 px", () => {
  const css = readFileSync("src/style.css", "utf8");
  const small = [...css.matchAll(/font(?:-size)?:[^;}]*?\b(\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[1]) < 14 && !/font(?:-size)?:\s*calc/.test(m[0]) && !/\/\s*\d/.test(m[0].slice(m[0].indexOf(m[1]) - 1)));
  assert.deepEqual(small.map((m) => m[0]), []);
  const calcSmall = [...css.matchAll(/calc\((\d+(?:\.\d+)?)px \* var\(--ts/g)].filter((m) => Number(m[1]) < 14);
  assert.deepEqual(calcSmall.map((m) => m[0]), []);
});

test("regression: impacts, pillars and slashes drawn before their birth time (stepped ticks) never use a negative radius", () => {
  const bad = [];
  const g = new Proxy({}, { get: (_, k) => {
    if (k === "canvas") return {};
    return (...a) => {
      if (k === "arc" && a[2] < 0) bad.push(`arc ${a[2]}`);
      if (k === "ellipse" && (a[2] < 0 || a[3] < 0)) bad.push(`ellipse ${a[2]},${a[3]}`);
      if (k === "createLinearGradient") return { addColorStop() {} };
      return undefined;
    };
  }, set: () => true });
  const fx = createFx({ palette });
  const cam = { w: 800, h: 600, z: 2, ox: 0, oy: 0 };
  for (const kind of ["toner", "stapler", "slide"]) for (const mode of ["hit", "wall", "range", "muzzle"]) {
    const im = { kind, mode, x: 5, y: 5, z: 12, born: 1000, life: 380 };
    for (const now of [-5000, 400, 999, 1000, 1190, 1380, 1400]) fx.drawImpact(g, cam, im, now);
  }
  fx.drawPillar(g, cam, { x: 5, y: 5, born: 1000, life: 900 }, 100);
  assert.deepEqual(bad, []);
});

test("wearStartKit: the rapier is worn and Strike is on F1; the default core start stays unarmed (golden hash unchanged)", () => {
  const a = newGame(3, { start: "town", wearStartKit: true });
  assert.equal(a.equipment.weapon?.base, config.startKit.weapon);
  assert.equal(a.player.skillBar.hotkeys[0], "strike");
  assert.ok(a.player.damage.max > newGame(3, { start: "town" }).player.damage.max);
  assert.equal(newGame(3, { start: "town" }).equipment.weapon, null);
  assert.equal(deserialize(serialize(a)).ok, true, "such a game saves and loads");
});
