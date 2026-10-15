// R8-T save/load across features: gear looks, quests, slots, belt, stash; write-then-immediate-reload; pagehide flush; multi-slot switch; file:// and http origins.
import { launch, open, startNew, check, finish, SHOTS, DIST } from "./helpers.mjs";
import http from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
const SLOTS = ["head", "body", "hands", "feet", "weapon", "offhand"];
const pick = (s) => ({
  cls: s.player.class, name: s.player.name, level: s.player.level, xp: s.player.xp, gold: s.player.gold, attrs: s.player.attrs, depth: s.depth, deepest: s.deepestDepth,
  eq: Object.fromEntries(Object.entries(s.equipment).map(([k, v]) => [k, v && { id: v.id, base: v.base, rarity: v.rarity, unique: v.unique, a: v.affixes }])),
  inv: s.inventory.items.map((i) => `${i.id}:${i.base}:${i.rarity}:${i.x ?? ""},${i.y ?? ""}`).sort(), belt: s.belt.map((b) => b && b.base),
  stash: s.stash.items.map((i) => `${i.id}:${i.base}`).sort(), quests: JSON.stringify(Object.fromEntries(Object.entries(s.quests).filter(([k]) => k !== "pinned").map(([k, q]) => [k, q.state ?? q.s]))), pinned: s.quests.pinned,
});
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const J = (v) => JSON.stringify(canon(v));
const same = (a, b) => J(a) === J(b);
const diff = (a, b) => Object.keys(a).filter((k) => J(a[k]) !== J(b[k])).map((k) => `${k}: ${J(a[k]).slice(0, 160)} != ${J(b[k]).slice(0, 160)}`);

/** Build a geared, quest-bearing hero through the real UI + cheats for the fixture (the save writer is the game's own). */
async function build(g, cls, name) {
  await startNew(g.page, { cls, name });
  await g.app("cheat.setLevel", 25); await g.app("cheat.giveGold", 900);
  for (const slot of SLOTS) {
    for (let t = 0; t < 6; t++) {
      await g.app("cheat.giveItem", { slot, rarity: "rare", ilvl: 8 });
      const inv = (await g.state()).inventory.items.filter((i) => i.slot === slot && i.kind === "gear");
      let ok = false; for (const it of inv) { const e = await g.app("input", { t: "equip", id: it.id, slot }); if (e.ok) { ok = true; break; } }
      if (ok) break;
    }
  }
  let u = null;
  for (let t = 0; t < 6 && !u; t++) {
    await g.app("cheat.giveItem", { slot: ["body", "weapon", "head", "feet", "hands"][t % 5], rarity: "unique", ilvl: 30 });
    for (const ub of (await g.state()).inventory.items.filter((i) => i.unique)) { const e = await g.app("input", { t: "equip", id: ub.id, slot: ub.slot }); if (e.ok) { u = ub.unique; break; } }
  }
  await g.app("cheat.giveItem", { slot: "feet", rarity: "magic", ilvl: 5 }); // left in the bag
  await g.app("quests.accept", "sq1"); await g.app("quests.setStep", "main", 2);
  await g.app("cheat.completeQuest", "sq2");
  await g.app("quests.pin", "sq1");
  return u;
}

function serve() {
  const html = readFileSync(resolve("dist/index.html"));
  const srv = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end(html); });
  return new Promise((res) => srv.listen(0, "127.0.0.1", () => res(srv)));
}

async function cont(g) {
  await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  await g.page.click('[data-testid="continue"]');
  await g.page.waitForFunction(() => window.__app.getState().scene !== "title", null, { timeout: 5000 });
  return pick(await g.state());
}

const browser = await launch();
const srv = await serve(); const HTTP = `http://127.0.0.1:${srv.address().port}/`;
for (const origin of ["file", "http"]) {
  for (const cls of CLASSES) {
    const tag = `[R8T-save ${origin} ${cls}]`;
    const g = await open(browser, { query: "test=1&seed=5", lobby: true, wait: false });
    if (origin === "http") { await g.page.goto(HTTP + "?test=1&seed=5"); }
    await g.page.waitForFunction(() => window.__app?.getState().scene === "title");
    const u = await build(g, cls, "Saver");
    const before = pick(await g.state());
    check(`${tag} fixture: >=4 visible slots worn incl. a unique`, SLOTS.filter((s) => before.eq[s]).length >= 4 && Object.values(before.eq).some((e) => e && e.unique), { worn: Object.entries(before.eq).filter(([, v]) => v).map(([k, v]) => k + ":" + v.rarity), u });
    await g.app("save.write");
    const idx = (await g.app("slots.list")).slots[0];
    check(`${tag} slot index has a look and quest fields`, /^[-\w|.]+$/.test(idx.look ?? "") && idx.look !== "-|-|-|-|-|-" && idx.qv >= 5, idx);
    // A: plain reload after an explicit write
    await g.page.reload();
    const a = await cont(g);
    check(`${tag} write -> reload -> Continue restores everything`, same(before, a), diff(before, a));
    // B: write-then-immediate-reload in the same task
    await g.app("cheat.giveGold", 77); await g.app("input", { t: "toBelt", id: (await g.state()).inventory.items.find((i) => i.kind === "potion")?.id });
    const mid = pick(await g.state());
    await g.page.evaluate(() => { window.__app.save.write(); location.reload(); });
    const b = await cont(g);
    check(`${tag} write-then-immediate-reload keeps the newest state`, same(mid, b), diff(mid, b));
    // C: no explicit write at all: the pagehide flush must save an equip change made a moment before the reload
    const st = await g.state(); const cand = st.inventory.items.find((i) => i.slot === "feet" && i.kind === "gear");
    if (cand) await g.app("input", { t: "equip", id: cand.id, slot: "feet" });
    const mid2 = pick(await g.state());
    await g.page.evaluate(() => location.reload());
    const c = await cont(g);
    check(`${tag} equip change then reload with no write (pagehide flush)`, same(mid2, c), diff(mid2, c));
    // D: slot card bust carries the look after reload
    await g.page.evaluate(() => window.__app.slots.open());
    const look = await g.page.evaluate(() => [...document.querySelectorAll('[data-testid="slot-1"] canvas')].map((c) => c.dataset.look ?? null));
    const idx2 = (await g.app("slots.list")).slots[0];
    check(`${tag} slot card bust look matches the index look`, look.length > 0 && look.every((l) => l === idx2.look), { look, idx: idx2.look });
    await g.page.evaluate(() => window.__app.slots.close());
    // E: Quit to title by the real pause menu then Continue
    await g.page.keyboard.press("Escape");
    const quitBtn = await g.page.$('[data-testid="quit"]');
    if (quitBtn) { await quitBtn.click(); await g.page.waitForFunction(() => window.__app.getState().scene === "title" || window.__app.getState().scene === undefined, null, { timeout: 4000 }).catch(() => {}); }
    check(`${tag} pause menu has a Quit button`, !!quitBtn, null);
    if (quitBtn) { await g.page.click('[data-testid="continue"]'); const e = pick(await g.state()); check(`${tag} Quit to title -> Continue restores`, same(mid2, e), diff(mid2, e)); }
    check(`${tag} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
    await g.context.close();
  }
}

// Three slots, three classes, switch among them through the Load dialog
{
  const g = await open(browser, { query: "test=1&seed=9", lobby: true });
  const snaps = [];
  for (let i = 0; i < 3; i++) {
    if (i > 0) { await g.page.keyboard.press("Escape"); await g.page.click('[data-testid="quit"]'); }
    await build(g, CLASSES[i], "Slot" + (i + 1));
    await g.app("save.write"); snaps.push(pick(await g.state()));
  }
  await g.page.keyboard.press("Escape"); await g.page.click('[data-testid="quit"]');
  const list = (await g.app("slots.list")).slots;
  check("[R8T-save] three slots hold three classes", CLASSES.every((c, i) => list[i].class === c && list[i].state === "ok"), list.slice(0, 3).map((s) => [s.class, s.state, s.look]));
  for (const i of [2, 0, 1, 2]) {
    await g.page.click('[data-testid="load-game"]');
    await g.page.click(`[data-testid="slot-${i + 1}"] button:not([disabled])`);
    await g.page.waitForFunction(() => window.__app.getState().scene !== "title", null, { timeout: 4000 }).catch(() => {});
    const now = pick(await g.state());
    check(`[R8T-save] load slot ${i + 1} (${CLASSES[i]}) gives that hero back`, same(snaps[i], now), diff(snaps[i], now));
    await g.page.keyboard.press("Escape"); await g.page.click('[data-testid="quit"]');
  }
  check("[R8T-save] multi-slot: no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}
srv.close(); await browser.close();
finish("r8t-save");
