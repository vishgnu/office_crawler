// R8-0.2 gear art contact sheets (1x: one logical px = one image px; the hero is about 60 px tall).
//   node e2e/art-sheet.mjs <out-dir> [mode=cats|tiers|set|check] [scale=1] [classes=fm,sr,it] [facings for `set`=0,2,4,6]
// cats : per class, one row per category (21), columns = facings / anims (idle front, walk, idle back, idle side, attack, cast, death), tier normal.
// tiers: per class, one row per category, 4 tiers (normal, magic, rare, unique) at two facings.
// set  : per class, bare / full normal kit / full rare kit / full unique kit in 4 facings.
// check: no image; pixel checks of AC-R-260-2 / 261-1 on real canvases (prints one JSON line {ok, failures, stats}; exit code 1 when not ok).
// Paints each class directly through render/figure.js (the character-select path with a `look`), so no game state and no core change is involved.
// Writes to the given directory only (default: the OS temp dir); the committed docs/shots files are written by passing docs/shots explicitly.
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const out = process.argv[2] ?? join(tmpdir(), "r8g2-sheets"), mode = process.argv[3] ?? "cats", scale = +(process.argv[4] ?? 1), classes = (process.argv[5] ?? "fm,sr,it").split(","), dirs = (process.argv[6] ?? "0,2,4,6").split(",").map(Number);
const CLS = { fm: "facilities-manager", sr: "sales-rep", it: "it-wizard" };
mkdirSync(out, { recursive: true });
const entry = `
import { drawFigure } from "./src/render/figure.js";
import { LOOK_CATEGORIES, LOOK_BY_BASE, gearSignature } from "./src/render/gearlooks.js";
const TIERS = ["normal", "magic", "rare", "unique"];
const baseOf = (slot, cat) => Object.keys(LOOK_BY_BASE).find((id) => LOOK_BY_BASE[id] === cat && /./.test(id));
const SLOT_OF = {}; for (const s of Object.keys(LOOK_CATEGORIES)) for (const c of LOOK_CATEGORIES[s]) SLOT_OF[c] = s;
const sig = (items) => gearSignature(Object.fromEntries(Object.entries(items).map(([slot, [cat, t]]) => [slot, { base: baseOf(slot, cat), slot, rarity: TIERS[t] }])));
const W = 108, H = 100;
function cell(g, x, y, cls, look, anim, dir, t, k) {
  const c = document.createElement("canvas"); c.width = Math.round(W * k); c.height = Math.round(H * k);
  drawFigure(c, "hero." + cls, { anim, t, dir, look });
  g.fillStyle = "#2b3647"; g.fillRect(x, y, c.width, c.height); g.drawImage(c, x, y);
}

const hashPx = (c, grey) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 2166136261 >>> 0; for (let i = 0; i < d.length; i += 4) { const v = grey ? Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | (d[i + 3] << 8) : d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24); h = Math.imul(h ^ v, 16777619) >>> 0; } return h; };
const edgeHits = (c) => { const { width: w, height: h } = c, d = c.getContext("2d").getImageData(0, 0, w, h).data; let n = 0; for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (d[(y * w + x) * 4 + 3] > 0) n++; for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (d[(y * w + x) * 4 + 3] > 0) n++; return n; };
window.check = () => {
  const failures = [], stats = { draws: 0, clipped: 0 }, CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
  const draw = (cls, look, anim, dir, t, grey = false) => { const c = document.createElement("canvas"); c.width = W; c.height = H; drawFigure(c, "hero." + cls, { anim, t, dir, look }); stats.draws++; return { h: hashPx(c, grey), edge: edgeHits(c) }; };
  const ANIMS = [["idle", [0, 0.375]], ["walk", [0, 0.625]], ["attack", [0, 0.375]], ["cast", [0, 0.375]], ["death", [0, 0.375]]]; // frame 0 and the last frame (t * 8)
  for (const cls of CLASSES) for (let dir = 0; dir < 8; dir++) for (const [anim, ts] of ANIMS) for (const t of ts) for (const slot of Object.keys(LOOK_CATEGORIES)) {
    const bare = draw(cls, null, anim, dir, t).h, seen = new Map();
    for (const cat of LOOK_CATEGORIES[slot]) {
      const r = draw(cls, sig({ [slot]: [cat, 0] }), anim, dir, t), where = cls + " d" + dir + " " + anim + " t" + t + " " + slot + "/" + cat;
      if (r.h === bare) failures.push("260-2 equal to the empty slot: " + where);
      if (seen.has(r.h)) failures.push("260-2 equal to " + seen.get(r.h) + ": " + where);
      seen.set(r.h, cat);
      if (r.edge > 0 && anim !== "death") { stats.clipped++; (stats.where ??= []).push(where); }
    }
  }
  for (const cls of CLASSES) for (const dir of [0, 2, 4, 6]) for (const cat of Object.values(LOOK_CATEGORIES).flat()) {
    const slot = SLOT_OF[cat], col = [0, 1, 2, 3].map((t) => draw(cls, sig({ [slot]: [cat, t] }), "idle", dir, 0)), gry = [0, 1, 2, 3].map((t) => draw(cls, sig({ [slot]: [cat, t] }), "idle", dir, 0, true));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (col[i].h === col[j].h) failures.push("261-1 tiers " + i + "/" + j + " equal: " + cls + " d" + dir + " " + cat);
      if (gry[i].h === gry[j].h) failures.push("261-1 grey-scale tiers " + i + "/" + j + " equal: " + cls + " d" + dir + " " + cat);
    }
  }
  return { ok: failures.length === 0, failures: failures.slice(0, 20), nFailures: failures.length, stats };
};
window.sheet = (mode, cls, k, dirs) => {
  const cats = Object.values(LOOK_CATEGORIES).flat(), cv = document.getElementById("c"), g = cv.getContext("2d"), w = Math.round(W * k), h = Math.round(H * k), lab = 70;
  g.font = "11px sans-serif"; g.textBaseline = "middle";
  const grid = (cols, rows, head) => { cv.width = lab + cols.length * w; cv.height = 16 + rows.length * h; g.fillStyle = "#171c26"; g.fillRect(0, 0, cv.width, cv.height); g.font = "10px sans-serif"; g.fillStyle = "#cdd6e6"; cols.forEach((c, i) => g.fillText(c.name, lab + i * w + 4, 8)); };
  if (mode === "cats") {
    const cols = [["idle f0 d0", "idle", 0, 0], ["walk f1 d2", "walk", 2, 0.19], ["idle d4", "idle", 4, 0], ["idle d6", "idle", 6, 0.12], ["attack d6", "attack", 6, 0.25], ["cast d0", "cast", 0, 0.25], ["death d6", "death", 6, 0.4]].map(([name, anim, dir, t]) => ({ name, anim, dir, t }));
    grid(cols, cats);
    cats.forEach((cat, r) => { g.fillStyle = "#cdd6e6"; g.font = "11px sans-serif"; g.fillText(SLOT_OF[cat] + " " + cat, 2, 16 + r * h + h / 2); cols.forEach((c, i) => cell(g, lab + i * w, 16 + r * h, cls, sig({ [SLOT_OF[cat]]: [cat, 0] }), c.anim, c.dir, c.t, k)); });
  } else if (mode === "tiers") {
    const cols = [0, 1, 2, 3].map((t) => ({ name: TIERS[t] + " d0", t, dir: 0 })).concat([0, 1, 2, 3].map((t) => ({ name: TIERS[t] + " d6", t, dir: 6 })));
    grid(cols, cats);
    cats.forEach((cat, r) => { g.fillStyle = "#cdd6e6"; g.font = "11px sans-serif"; g.fillText(SLOT_OF[cat] + " " + cat, 2, 16 + r * h + h / 2); cols.forEach((c, i) => cell(g, lab + i * w, 16 + r * h, cls, sig({ [SLOT_OF[cat]]: [cat, c.t] }), "idle", c.dir, 0, k)); });
  } else {
    const kits = [["bare", null], ["normal", 0], ["rare", 2], ["unique", 3]];
    const sets = [["blade", "board", "helmet", "jacket", "gloves", "boot"], ["staff", "tray", "cap", "knit", "brace", "sneaker"], ["heavy", null, "headset", "vest", "mitts", "loafer"], ["pole", null, "cap", "suit", "gloves", "boot"]];
    const cols = dirs.map((d) => ({ name: "d" + d, dir: d }));
    const rows = []; for (const s of sets) for (const [n, t] of kits) rows.push([n, s, t]);
    grid(cols, rows);
    rows.forEach(([n, s, t], r) => { g.fillStyle = "#cdd6e6"; g.fillText(n + " " + s[0], 2, 16 + r * h + h / 2); const it = {}; if (t !== null) s.forEach((cat) => { if (cat) it[SLOT_OF[cat]] = [cat, t]; }); cols.forEach((c, i) => cell(g, lab + i * w, 16 + r * h, cls, t === null ? null : sig(it), "idle", c.dir, 0, k)); });
  }
};
`;
const js = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "js" }, bundle: true, format: "iife", write: false, target: "es2022" });
const work = join(tmpdir(), "r8g2-sheet-work"); mkdirSync(work, { recursive: true });
writeFileSync(join(work, "index.html"), `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="c"></canvas><script>${js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  if (mode === "check") {
    await page.goto(pathToFileURL(join(work, "index.html")).href);
    const r = await page.evaluate(() => window.check());
    console.log(JSON.stringify(r));
    process.exitCode = r.ok ? 0 : 1;
  } else for (const c of classes) {
    await page.goto(pathToFileURL(join(work, "index.html")).href);
    await page.evaluate(([m, cls, k, d]) => window.sheet(m, cls, k, d), [mode, CLS[c], scale, dirs]);
    const file = join(out, `r8g2-${mode === "cats" ? "sheet" : mode}-${c}.jpg`);
    await page.locator("#c").screenshot({ path: file, type: "jpeg", quality: 92 });
    console.log(file);
  }
} finally { await browser.close(); }
