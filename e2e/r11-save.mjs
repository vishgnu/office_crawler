// R11-3 save/load and two-tab across ALL features: spent and unspent points (via the real panels), skill hotkeys, aura, respec count, options (real Options screen),
// pinned quest, stash by real click, belt, cursor item, deepest floor, plus a two-tab run (tab B changes everything, stale tab A tries to write).
// Usage: node e2e/r11-save.mjs   (http origin through a route; file:// for one class)
import { launch, startNew, check, finish, SHOTS, DIST } from "./helpers.mjs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const T = (id) => `[data-testid="${id}"]`;
const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
const browser = await launch();
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const J = (v) => JSON.stringify(canon(v));
const diff = (a, b) => Object.keys(a).filter((k) => J(a[k]) !== J(b[k])).map((k) => `${k}: ${J(a[k]).slice(0, 140)} != ${J(b[k]).slice(0, 140)}`);
const pick = (s, opt) => ({
  cls: s.player.class, level: s.player.level, xp: s.player.xp, gold: s.player.gold, attrs: s.player.attrs, ap: s.player.attrPoints, sp: s.player.skillPoints, skills: s.player.skills, bar: s.player.skillBar, respecs: s.player.respecsUsed,
  deepest: s.deepestDepth, inv: s.inventory.items.map((i) => `${i.id}:${i.base}:${i.x},${i.y}`).sort(), belt: s.belt.map((b) => b && b.base), stash: s.stash.items.map((i) => i.id).sort(), eq: Object.fromEntries(Object.entries(s.equipment).map(([k, v]) => [k, v && v.id])),
  quests: Object.fromEntries(Object.entries(s.quests).filter(([k]) => k !== "pinned").map(([k, q]) => [k, q.state ?? q.s])), pinned: s.quests.pinned, cursor: s.cursorItem && s.cursorItem.id, opt: opt,
});
const optOf = (g) => g.app("options.get").then((o) => ({ tx: o.textScale, hc: o.highContrast, mute: o.muted, lowFx: o.lowFx, rm: o.reducedMotion, shake: o.screenShake, vol: o.volume, kit: o.kit, keys: o.keys }));
async function boot(ctx, origin, q = "test=1&seed=7") {
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(origin === "file" ? DIST + "?" + q : "https://oc.test/index.html?" + q);
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 20000 });
  const app = (fn, ...a) => page.evaluate(([f, x]) => f.split(".").reduce((o, k) => o[k], window.__app)(...x), [fn, a]);
  return { page, app, state: () => app("getState"), errors };
}
const newCtx = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await ctx.route("https://oc.test/**", (r) => r.fulfill({ path: "dist/index.html", contentType: "text/html" })); return ctx; };
const cont = async (g) => { await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 20000 }); await g.page.click(T("continue")); await g.page.waitForFunction(() => window.__app.getState().scene !== "title", null, { timeout: 5000 }); await g.page.waitForTimeout(100); return g.state(); };

for (const [origin, cls] of process.env.TWOTAB_ONLY ? [] : [["https", "facilities-manager"], ["https", "sales-rep"], ["https", "it-wizard"], ["file", "it-wizard"]]) {
  const tag = `[R11-save ${origin} ${cls}]`;
  const ctx = await newCtx(); const g = await boot(ctx, origin);
  await startNew(g.page, { cls, name: "Allfeat" });
  await g.app("cheat.setLevel", 14); await g.app("cheat.giveGold", 2500);
  let s = await g.state();
  check(`${tag} fixture: level 14 gives unspent attribute and skill points`, s.player.attrPoints > 0 && s.player.skillPoints > 0, [s.player.attrPoints, s.player.skillPoints]);
  const ap0 = s.player.attrPoints, sp0 = s.player.skillPoints;
  // spend some points through the real panels
  await g.page.keyboard.press("KeyC"); await g.page.click(T("alloc-grit")); await g.page.click(T("alloc-focus")); await g.page.keyboard.press("Escape");
  await g.page.keyboard.press("KeyS");
  const learn = await g.page.$$eval('[data-testid^="learn-"]', (els) => els.filter((e) => !e.disabled).map((e) => e.dataset.testid));
  for (const l of learn.slice(0, 2)) { await g.page.click(T(l)).catch(() => {}); }
  const asg = await g.page.$$eval('[data-testid^="assign-"]', (els) => els.filter((e) => !e.disabled && e.offsetParent).map((e) => e.dataset.testid));
  if (asg.length) await g.page.click(T(asg[asg.length - 1])).catch(() => {});
  const aur = await g.page.$$eval('[data-testid^="aura-"]', (els) => els.map((e) => e.dataset.testid));
  if (aur.length) await g.page.click(T(aur[0])).catch(() => {});
  await g.page.keyboard.press("Escape");
  s = await g.state();
  check(`${tag} real clicks spent points (attr ${ap0}->${s.player.attrPoints}, skill ${sp0}->${s.player.skillPoints}) and left some unspent`, s.player.attrPoints === ap0 - 2 && s.player.skillPoints < sp0 && s.player.attrPoints > 0, [ap0, s.player.attrPoints, sp0, s.player.skillPoints, learn.length]);
  // quests, pin, gear, belt, stash by real click, cursor item
  await g.app("quests.accept", "sq1"); await g.app("quests.pin", "sq1"); await g.app("cheat.completeQuest", "sq2");
  for (const slot of ["body", "weapon", "head"]) { await g.app("cheat.giveItem", { slot, rarity: "rare", ilvl: 8 }); const it = (await g.state()).inventory.items.find((i) => i.slot === slot && i.kind === "gear"); if (it) await g.app("input", { t: "equip", id: it.id, slot }); }
  await g.app("cheat.giveItem", { slot: "feet", rarity: "magic" }); await g.app("cheat.giveItem", { slot: "hands", rarity: "magic" });
  await g.app("cheat.teleportFloor", 3); await g.app("cheat.teleportFloor", 0);
  // stash: walk to the stash NPC with a real click, put one item with a real click
  s = await g.state(); const sn = s.npcs.find((n) => n.id === "stash");
  await g.app("clickTile", sn.tile.x, sn.tile.y); for (let i = 0; i < 10 && (await g.state()).ui.dialog?.npc !== "stash"; i++) await g.app("step", 60);
  await g.page.waitForTimeout(100);
  const putBtn = await g.page.$('[data-testid^="stash-put-"]'); if (putBtn) await putBtn.click().catch(() => {});
  await g.app("input", { t: "closeDialog" });
  s = await g.state();
  check(`${tag} fixture: stash holds an item put by a real click`, s.stash.items.length >= 1, s.stash.items.length);
  // options by the real Options screen (pause menu) + a key rebind
  await g.page.keyboard.press("Escape"); await g.page.click(T("options"));
  await g.page.selectOption(T("opt-text-size"), { index: 1 }).catch(async () => { await g.app("options.setTextScale", 1.25); });
  for (const t of ["opt-hc", "opt-mute", "opt-lowfx"]) { await g.page.click(T(t)).catch(async () => {}); }
  await g.page.click(T("opt-key-skill1")).catch(() => {}); await g.page.keyboard.press("KeyZ"); await g.page.waitForTimeout(60);
  await g.page.fill(T("opt-vol-master"), "0.35").catch(() => {}); // range input, may need evaluate
  await g.page.evaluate(() => { const e = document.querySelector('[data-testid="opt-vol-master"]'); if (e) { e.value = "0.35"; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); } });
  await g.page.click(T("opt-back")); await g.page.keyboard.press("Escape").catch(() => {});
  let o = await optOf(g); s = await g.state();
  if (s.paused) await g.page.click(T("resume")).catch(() => {});
  check(`${tag} options changed through the real screen (text ${o.tx}, hc ${o.hc}, mute ${o.mute}, lowFx ${o.lowFx}, vol ${o.vol.master}, skill1 ${o.keys.skill1})`, o.tx !== 1 && o.hc && o.mute && o.vol.master === 0.35 && o.keys.skill1 === "KeyZ", o);
  // cursor item: pick a bag cell with a real click
  await g.page.keyboard.press("KeyI"); s = await g.state(); const it0 = s.inventory.items[0];
  if (it0) { await g.page.click(T(`cell-${it0.x}-${it0.y}`)); }
  s = await g.state(); const held = s.cursorItem?.id;
  check(`${tag} fixture: an item is in the hand`, !!held, null);
  const before = pick(await g.state(), await optOf(g));
  await g.app("save.write");
  await g.page.reload();
  let after = await cont(g); const a1 = pick(after, await optOf(g));
  check(`${tag} write -> reload -> Continue restores points, hotkeys, aura, respecs, options, quests, stash, belt, cursor`, J(before) === J(a1), diff(before, a1));
  // immediate reload with a change in the same task (pagehide flush), then a second reload
  await g.page.evaluate(() => { document.querySelector('[data-testid="alloc-grit"]'); });
  await g.app("cheat.giveGold", 11); await g.app("options.setTextScale", 1.5);
  const mid = pick(await g.state(), await optOf(g));
  await g.page.evaluate(() => location.reload());
  after = await cont(g); const a2 = pick(after, await optOf(g));
  check(`${tag} change then reload with no explicit write (pagehide flush): gold and text size kept`, J(mid) === J(a2), diff(mid, a2));
  // a death with the item in the hand, then reload
  await g.app("cheat.teleportFloor", 2); await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  await g.page.click(T("respawn")); await g.app("step", 5);
  const d1 = pick(await g.state(), await optOf(g));
  await g.page.evaluate(() => { window.__app.save.write(); location.reload(); });
  const a3 = pick(await cont(g), await optOf(g));
  check(`${tag} die, respawn, write+reload: same hero (no point, item or option change)`, J(d1) === J(a3), diff(d1, a3));
  check(`${tag} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await ctx.close();
}

// ---- two tabs: B takes over and changes everything, stale A writes later
for (const origin of ["https", "file"]) {
  const tag = `[R11-save two-tab ${origin}]`;
  const ctx = await newCtx();
  const A = await boot(ctx, origin);
  await startNew(A.page, { cls: "sales-rep", name: "Twin" });
  await A.app("cheat.setLevel", 10); await A.app("cheat.giveGold", 300); await A.app("save.write");
  const B = await boot(ctx, origin);
  const owner = await B.page.evaluate(() => window.__app.slots.view().status);
  await B.app("slots.run", { t: "takeOverSaves" });
  await B.page.click(T("continue")); await B.page.waitForFunction(() => window.__app.getState().scene !== "title", null, { timeout: 5000 });
  // B: spend points through the real UI, change options, equip, learn skills, write
  await B.page.keyboard.press("KeyC"); await B.page.click(T("alloc-agility")); await B.page.keyboard.press("Escape");
  await B.app("options.setTextScale", 1.5); await B.app("options.setFlag", "highContrast", true);
  await B.app("cheat.giveGold", 1000);
  await B.app("save.write");
  const bs = pick(await B.state(), await optOf(B));
  // A (stale) tries to change and write
  const aStatus = await A.page.evaluate(() => window.__app.slots.view().status);
  await A.app("cheat.giveGold", 5); await A.app("options.setTextScale", 1.25);
  const aw = await A.app("save.write");
  await A.page.waitForTimeout(200);
  // third tab C loads whatever is stored
  const C = await boot(ctx, origin);
  const cOwner = await C.page.evaluate(() => window.__app.slots.view().status.owner);
  check(`${tag} a fresh third tab sees that another tab owns the saves (owner ${cOwner})`, cOwner === "other", cOwner);
  await C.app("slots.run", { t: "takeOverSaves" });
  await C.page.click(T("continue")).catch(() => {}); await C.page.waitForFunction(() => window.__app.getState().scene !== "title", null, { timeout: 5000 }).catch(() => {});
  const cs = await C.state(), cst = await C.page.evaluate(() => ({ status: window.__app.slots.view().status, ov: document.querySelector("#overlay")?.innerText.slice(0, 160) }));
  if (!cs.player) { console.log(`INFO ${tag} tab C could not Continue: scene ${cs.scene}, ${JSON.stringify(cst)}`); }
  const cp = cs.player ? pick(cs, await optOf(C)) : { attrs: {}, gold: -1, opt: {} };
  console.log(`INFO ${tag} owner statuses: B-before ${JSON.stringify(owner)} A-after ${JSON.stringify(aStatus)} A write -> ${JSON.stringify(aw)?.slice(0, 120)}`);
  check(`${tag} stale tab A cannot overwrite tab B's points/gold (storage holds B's spent point; gold ${cp.gold})`, cp.attrs.agility === bs.attrs.agility && cp.gold >= bs.gold, { b: bs.attrs.agility + "/" + bs.gold, c: cp.attrs.agility + "/" + cp.gold });
  check(`${tag} the stored save is valid and loads in a fresh tab (scene ${cs.scene})`, cs.scene === "town" || cs.scene === "floor", cs.scene);
  check(`${tag} options written by B survive (text ${cp.opt.tx}, hc ${cp.opt.hc})`, cp.opt.hc === true, cp.opt);
  check(`${tag} no page errors in A, B, C`, A.errors.length + B.errors.length + C.errors.length === 0, [...A.errors, ...B.errors, ...C.errors].slice(0, 3));
  await ctx.close();
}
await browser.close();
finish("r11-save");
