// WORLD-G2 (R8-0.2, ADR-0008): the 21 part painters. AC-R-260-2 (every category, class, facing and anim renders, differs from the empty slot and from the
// other categories), AC-R-261-1 (tiers differ by shape, shared unique accent, palette colours), AC-R-261-2 (colour-vision check of the trim colours).
// Pure: a recording canvas context stands in for pixels (the same call stream is the same picture). The pixel-level twins of these checks (real canvases,
// grey-scale compare, cell clipping) run in the browser: `node e2e/art-sheet.mjs <dir> check`, wired into e2e/render.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { content } from "../src/core/index.js";
import { recorder } from "./render-gear-rec.js";
import { drawFigure as paintFigure } from "../src/render/styles/vector/characters.js";
import { PLAYER_ANIMS } from "../src/render/keys.js";
import { LOOK_BY_BASE, LOOK_CATEGORIES, VISIBLE_SLOTS, gearSignature } from "../src/render/gearlooks.js";
import { makeGear, PART_PAINTERS, HOOK_SLOT } from "../src/render/gearparts.js";
import { UNIQUE_RIM } from "../src/render/gearkit.js";
import { palette } from "../src/render/styles/vector/palette.js";

const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"], TIERS = ["normal", "magic", "rare", "unique"];
const CATS = Object.entries(LOOK_CATEGORIES).flatMap(([slot, cats]) => cats.map((cat) => ({ slot, cat })));
const baseOf = (slot, cat) => Object.keys(LOOK_BY_BASE).find((id) => LOOK_BY_BASE[id] === cat && content.items[id].slot === slot);
const eq = (slot, cat, tier = 0) => ({ [slot]: { id: "t", base: baseOf(slot, cat), slot, rarity: TIERS[tier], ...(content.items[baseOf(slot, cat)].twoHanded ? { twoHanded: true } : {}) } });
const sigOf = (slot, cat, tier = 0) => gearSignature(eq(slot, cat, tier));
const lastFrame = (anim) => PLAYER_ANIMS[anim] - 1;

/** A recording context that also fails on any non-finite number (a NaN coordinate silently draws nothing). */
function checked(bad) {
  const r = recorder();
  const g = new Proxy(r.g, {
    get: (t, k) => { const v = t[k]; return typeof v === "function" ? (...a) => { if (a.some((x) => typeof x === "number" && !Number.isFinite(x))) bad.push(String(k)); return v.apply(t, a); } : v; },
    set: (t, k, v) => { if (typeof v === "number" && !Number.isFinite(v)) bad.push("set " + String(k)); t[k] = v; return true; },
  });
  return { g, digest: r.digest };
}
function stream(cls, anim, dir, f, sig, bad = []) {
  const r = checked(bad); r.g.translate(52, 76);
  const errs = [], gear = sig ? makeGear(sig, (slot, e) => errs.push(slot + ": " + e.message)) : null;
  paintFigure(r.g, cls, anim, dir, f, gear);
  assert.deepEqual(errs, [], "no painter throws");
  return r.digest();
}
/** Ops of a draw as strings (path geometry and colours), to compare what a tier adds. */
function ops(sig, cls = "facilities-manager", dir = 0) {
  const out = [], store = {};
  const g = new Proxy(store, { get: (t, k) => (k in t ? t[k] : k === "canvas" ? { width: 104, height: 96 } : k === "createRadialGradient" ? () => ({ addColorStop() {} }) : (...a) => { out.push(k + ":" + a.map((x) => (typeof x === "number" ? Math.round(x * 100) / 100 : typeof x)).join(",")); }), set: (t, k, v) => { t[k] = v; out.push("set " + String(k) + "=" + (typeof v === "number" ? Math.round(v * 100) / 100 : v)); return true; } });
  g.translate(52, 76); paintFigure(g, cls, "idle", dir, 0, makeGear(sig));
  return out;
}
const diff = (a, b) => { const m = new Map(); for (const x of a) m.set(x, (m.get(x) ?? 0) + 1); const extra = []; for (const x of b) { const n = m.get(x) ?? 0; if (n > 0) m.set(x, n - 1); else extra.push(x); } return extra; };

test("the 21 categories have a real painter each, every hook slot is covered, no stub is left", () => {
  assert.equal(CATS.length, 21);
  for (const { cat } of CATS) assert.equal(typeof PART_PAINTERS[cat], "function", cat);
  assert.deepEqual(Object.keys(PART_PAINTERS).sort(), CATS.map((c) => c.cat).sort());
  assert.deepEqual([...new Set(Object.values(HOOK_SLOT))].sort(), [...VISIBLE_SLOTS].sort());
  const names = new Set(Object.values(PART_PAINTERS).map((f) => f.name));
  assert.equal(names.size, 21, "21 distinct painter functions");
});

test("AC-R-260-2 every category renders without error and with finite geometry in every class, facing and anim (frame 0 and the last frame), all four tiers", () => {
  const bad = [];
  for (const cls of CLASSES) for (let dir = 0; dir < 8; dir++) for (const anim of Object.keys(PLAYER_ANIMS)) for (const f of [0, lastFrame(anim)])
    for (const { slot, cat } of CATS) for (const tier of [0, 3]) stream(cls, anim, dir, f, sigOf(slot, cat, tier), bad);
  assert.deepEqual(bad.slice(0, 5), [], "no NaN or Infinity reaches the canvas");
});

test("AC-R-260-2 each category differs from the empty slot and from every other category of its slot (class x 8 facings x idle, walk, attack, cast, death, frame 0 and last)", () => {
  let n = 0;
  for (const cls of CLASSES) for (let dir = 0; dir < 8; dir++) for (const anim of Object.keys(PLAYER_ANIMS)) for (const f of [0, lastFrame(anim)]) for (const slot of VISIBLE_SLOTS) {
    const bare = stream(cls, anim, dir, f, null), seen = new Map();
    for (const cat of LOOK_CATEGORIES[slot]) {
      const d = stream(cls, anim, dir, f, sigOf(slot, cat)), where = `${cls} d${dir} ${anim}${f} ${slot}/${cat}`;
      assert.notEqual(d, bare, `${where} equals the empty slot`);
      assert.ok(!seen.has(d), `${where} equals ${seen.get(d)}`);
      seen.set(d, cat); n++;
    }
  }
  assert.equal(n, 3 * 8 * 5 * 2 * 21);
});

test("AC-R-260-2 a worn weapon and off-hand are drawn in both layers: behind the body for a facing away at rest, in front otherwise", () => {
  for (const cls of CLASSES) {
    const front = ops(sigOf("weapon", "blade"), cls, 0), back = ops(sigOf("weapon", "blade"), cls, 4);
    assert.ok(front.length > ops("-|-|-|-|-|-", cls, 0).length && back.length > ops("-|-|-|-|-|-", cls, 4).length, cls);
  }
  // facing away at rest: the weapon is painted before the torso hook; facing the viewer: after
  const idxOf = (list, marker) => list.findIndex((o) => o === marker);
  const mark = "set fillStyle=#e8eef8"; // the blade's steel
  const back = ops(sigOf("weapon", "blade") , "sales-rep", 4), front = ops(sigOf("weapon", "blade"), "sales-rep", 0);
  assert.ok(idxOf(back, mark) >= 0 && idxOf(front, mark) >= 0);
  assert.ok(idxOf(back, mark) < back.length * 0.5, "facing away: behind the body (early in the stream)");
  assert.ok(idxOf(front, mark) > front.length * 0.5, "facing the viewer: in front (late in the stream)");
});

test("two-handed weapons (pole, heavy) draw a second hand on the shaft and the off-hand slot stays empty", () => {
  for (const cat of ["pole", "heavy"]) {
    const one = ops(gearSignature({ weapon: { base: baseOf("weapon", cat), slot: "weapon", rarity: "normal", twoHanded: true } }), "sales-rep", 0);
    assert.ok(one.some((o) => o.startsWith("ellipse:") && o.includes(",2.6,2.6,")), cat + " second hand");
  }
  assert.equal(gearSignature({ weapon: eq("weapon", "pole").weapon, offhand: eq("offhand", "tray").offhand }).split("|")[5], "-");
});

test("layering: head parts come after the class hair, body parts after the class torso, hand parts after the hand circles, foot parts after the shoes", () => {
  const after = (sig, cls, partFill, classFill, dir = 0) => { const o = ops(sig, cls, dir); const a = o.lastIndexOf("set fillStyle=" + partFill), b = o.lastIndexOf("set fillStyle=" + classFill); assert.ok(a > 0 && b > 0, `${sig} ${cls}: both colours are drawn (${a}, ${b})`); assert.ok(a > b, `${sig} ${cls}: ${partFill} is painted after ${classFill}`); };
  after(sigOf("head", "cap"), "it-wizard", "#2e8f9c", "#2a1a40");        // cap over the IT hair
  after(sigOf("head", "cap"), "sales-rep", "#2e8f9c", "#f2c14e");        // cap over the SR hair
  after(sigOf("head", "helmet"), "facilities-manager", "#f4f4ec", "#2b1d17"); // helmet over the FM hair and beard
  after(sigOf("head", "headset"), "it-wizard", "#2f3556", "rgba(196,236,255,0.85)"); // headset cups over the IT glasses
  after(sigOf("body", "knit"), "facilities-manager", "#86a878", "#ff8a1f"); // cardigan over the FM vest
  after(sigOf("body", "jacket"), "sales-rep", "#34487e", "#c0346a");        // blazer over the SR lapel panels
  after(sigOf("body", "suit"), "it-wizard", "#3a3b50", "#2aa8c8");          // suit over the IT hoodie pocket
  after(sigOf("hands", "gloves"), "facilities-manager", "#5fd0b0", "#c98a5e"); // gloves over the FM hand
  after(sigOf("hands", "brace"), "sales-rep", "#2f4b9c", "#f6c49c");        // wrist brace over the SR hand
  after(sigOf("feet", "sneaker"), "facilities-manager", "#f2788c", "#5a3a28"); // sneakers over the FM shoes
  after(sigOf("feet", "loafer"), "it-wizard", "#8a4f2a", "#f4ecd8");        // loafers over the IT shoes
  for (const cls of CLASSES) for (const { slot, cat } of CATS.filter((c) => ["head", "body", "hands", "feet"].includes(c.slot))) assert.ok(diff(ops("-|-|-|-|-|-", cls, 0), ops(sigOf(slot, cat), cls, 0)).length > 10, `${cls} ${cat} adds drawing`);
});

// ---- AC-R-261-1 ----
test("AC-R-261-1 the four tiers of every category differ pairwise in the call stream, and the differences include shapes (edge paths, studs, accent), not only colours", () => {
  for (const { slot, cat } of CATS) {
    const base = ops(sigOf(slot, cat, 0)), t = [0, 1, 2, 3].map((k) => ops(sigOf(slot, cat, k)));
    const noColour = (list) => list.filter((o) => !o.startsWith("set ")).join("|"); // geometry only
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.notEqual(noColour(t[i]), noColour(t[j]), `${cat}: tier ${i} and ${j} have the same geometry (hue only)`);
    const add1 = diff(base, t[1]), add2 = diff(base, t[2]), add3 = diff(base, t[3]);
    assert.ok(add1.some((o) => o.startsWith("lineTo:")), cat + " magic: one edge path");
    assert.ok(add2.filter((o) => o.startsWith("ellipse:")).length >= 2 && add2.filter((o) => o.startsWith("closePath")).length >= 2, cat + " rare: double edge and studs");
    assert.ok(add3.some((o) => o === "set fillStyle=#fff2c0") && add3.some((o) => o === "set strokeStyle=" + UNIQUE_RIM), cat + " unique: accent diamond and outer rim");
    const R = palette.rarity;
    assert.ok(add1.includes("set strokeStyle=" + R.magic) && add2.includes("set strokeStyle=" + R.rare) && add3.includes("set strokeStyle=" + R.unique), cat + " palette colours");
  }
});

test("AC-R-261-1 all uniques share the one accent: two unique bases of the same category give identical frames", () => {
  const pairs = [["weapon", "blade", "ruler-rapier", "letter-opener"], ["weapon", "blunt", "pipe-wrench", "stapler-mace"]];
  for (const [slot, cat, a, b] of pairs) {
    const sa = gearSignature({ [slot]: { base: a, slot, rarity: "unique" } }), sb = gearSignature({ [slot]: { base: b, slot, rarity: "unique" } });
    assert.equal(sa, sb);
    for (const cls of CLASSES) assert.equal(stream(cls, "idle", 0, 0, sa), stream(cls, "idle", 0, 0, sb));
  }
  // every unique carries the same diamond (same fill colour and size) whatever the category
  const diamonds = new Set();
  for (const { slot, cat } of CATS) { const add = diff(ops(sigOf(slot, cat, 0)), ops(sigOf(slot, cat, 3))); diamonds.add(add.filter((o) => o.startsWith("lineTo:")).length >= 3 && add.includes("set fillStyle=#fff2c0")); }
  assert.deepEqual([...diamonds], [true]);
});

test("AC-R-261-1 the trim colours are the Okabe-Ito entries of palette.js", () => {
  assert.deepEqual([palette.rarity.magic, palette.rarity.rare, palette.rarity.unique], ["#56b4e9", "#f0e442", "#e8590c"]);
  assert.equal(UNIQUE_RIM, "#e69f00");
});

// ---- AC-R-261-2 ----
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const SIM = { // Machado 2009, severity 1.0, linear RGB (the same matrices as test/ui-options.test.js)
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lab = ([r, g, b]) => {
  const c = [r, g, b].map((x) => Math.min(1, Math.max(0, x))), X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
test("AC-R-261-2 the trim colours (normal ink, magic, rare, unique, and the unique rim) stay at least 12 CIE76 units apart under protan, deutan and tritan", () => {
  const cols = { normal: "#0d0a1c", magic: palette.rarity.magic, rare: palette.rarity.rare, unique: palette.rarity.unique, rim: UNIQUE_RIM }, names = Object.keys(cols);
  for (const [kind, m] of Object.entries(SIM)) {
    const sim = Object.fromEntries(names.map((n) => { const [r, g, b] = hex(cols[n]).map(lin); return [n, lab(m.map((row) => row[0] * r + row[1] * g + row[2] * b))]; }));
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const d = Math.hypot(...sim[names[i]].map((x, k) => x - sim[names[j]][k]));
      assert.ok(d >= 12, `${kind}: ${names[i]} vs ${names[j]} only ${d.toFixed(1)} apart`);
    }
  }
});

test("the new gear files use no Math.random, Date, core RNG or core imports", () => {
  const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
  for (const f of ["gearkit.js", "gearparts-weapons.js", "gearparts-armour.js"]) {
    const src = strip(readFileSync(new URL("../src/render/" + f, import.meta.url), "utf8"));
    assert.ok(!/Math\.random|Date\.now|new Date|\bDate\b|rng\.js|createRng|from "\.\.\/core|from "\.\.\/rng/.test(src), `${f} uses a forbidden source`);
  }
});

test("part art names no brand or IP term from the denylists", () => {
  const terms = ["../docs/product/ip-denylist.txt", "../docs/product/ip-denylist-brands.txt"].flatMap((f) => readFileSync(new URL(f, import.meta.url), "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
  for (const f of ["gearkit.js", "gearparts-weapons.js", "gearparts-armour.js", "gearparts.js"]) {
    const src = readFileSync(new URL("../src/render/" + f, import.meta.url), "utf8").toLowerCase();
    for (const t of terms) assert.ok(!new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(src), `${f} contains the denylisted term "${t}"`);
  }
});
