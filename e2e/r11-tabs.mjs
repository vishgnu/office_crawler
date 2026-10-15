// R11-3 copy of r8t-tabs.mjs that records WHY tab B has no Lobby (scene, loadSlot result, owner status) instead of crashing. Original header: R8-T flake study for adv-r7 [R7-tabs] (tab B hands in sq1; stale tab A write). Repeats the two-tab scenario N times per condition.
// Usage: node e2e/r8t-tabs.mjs [N=10] [conditions=https,file,https-par]; fixture = the first Lobby visit of a real bot run with >=2 of sq1..sq3 ready (the game's own save writer).
import { launch } from "./helpers.mjs";
import { newGame, step, applyInput } from "../src/core/index.js";
import { serialize, deserialize } from "../src/save/index.js";
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const N = Number(process.argv[2] ?? 10), CONDS = (process.argv[3] ?? "https,file,https-par").split(",");
const cls = process.argv[4] ?? "sales-rep", seed = Number(process.argv[5] ?? 101);
const first3 = ["sq1", "sq2", "sq3"], T = (id) => `[data-testid="${id}"]`;
function fixture() {
  const state = newGame(seed, { start: "town", class: cls, name: "Real", wearStartKit: true }), mem = createBotMemory({ depth: 9, respawn: true, maxDeaths: 12, class: cls });
  for (let i = 0; i < 200000; i++) {
    if (state.scene === "dead") applyInput(state, { t: "respawn" });
    if (state.depth === 0 && state.scene === "town" && first3.filter((k) => state.quests[k].s === "ready").length >= 2) return serialize(state);
    if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) noteResult(mem, cmd, applyInput(state, cmd)); }
    step(state);
  }
  throw new Error("no fixture");
}
const text = fixture();
let totalRuns = 0, totalBad = 0;
const browser = await launch();
async function boot(ctx, origin) {
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(origin === "file" ? pathToFileURL(resolve("dist/index.html")).href + "?test=1&seed=3" : "https://oc.test/index.html?test=1&seed=3");
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  return { page, app, state: () => app("getState"), errors };
}
async function talk(g, npc) {
  const s = await g.state(); if (!s.npcs) throw new Error('tab B not in a running game: ' + JSON.stringify({ scene: s.scene, status: await g.app('slots.view').then((v) => v.status).catch(() => null) }));
  const n = s.npcs.find((o) => o.id === npc);
  await g.app("clickTile", n.tile.x, n.tile.y);
  for (let i = 0; i < 12; i++) { await g.app("step", 60); if ((await g.state()).ui.dialog?.npc === npc) break; }
  await g.page.waitForTimeout(60);
  return (await g.state()).ui.dialog?.npc === npc;
}
async function once(origin, variant) { try { return await once0(origin, variant); } catch (e) { return { ok1: false, ok2: false, errs: 0, thrown: String(e.message).slice(0, 300) }; } }
async function once0(origin, variant) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route("https://oc.test/**", (r) => r.fulfill({ path: "dist/index.html", contentType: "text/html" }));
  const A = await boot(ctx, origin);
  await A.app("slots.run", { t: "importSlot", slot: 1, text, confirm: true }); await A.app("slots.run", { t: "loadSlot", slot: 1, confirm: true });
  const B = await boot(ctx, origin);
  await B.app("slots.run", { t: "takeOverSaves" });
  const bl = await B.app("slots.run", { t: "loadSlot", slot: 1, confirm: true }); await B.app("step", 2);
  if (!bl.ok) { await ctx.close(); return { ok1: false, ok2: false, bl: bl.ok, loadErr: JSON.stringify(bl).slice(0, 200), errs: 0, a: JSON.stringify(await A.app('slots.view').then((v) => v.status)) }; }
  const dlg = await talk(B, "vendor");
  const before = (await B.state()).quests.sq1.state;
  let clicked = "ok", btnState = null;
  btnState = await B.page.evaluate(() => { const b = document.querySelector('[data-testid="quest-handin-sq1"]'); return b ? { disabled: b.disabled, aria: b.getAttribute("aria-disabled"), vis: !!b.offsetParent } : null; });
  if (variant === "swallow") await B.page.click(T("quest-handin-sq1")).catch((e) => { clicked = "click failed: " + String(e.message).split("\n")[0]; });
  else await B.page.click(T("quest-handin-sq1"), { timeout: 4000 }).catch((e) => { clicked = "click failed: " + String(e.message).split("\n")[0]; });
  await B.app("step", 2);
  let st = await B.state(), cause = null;
  if (st.quests.sq1.state !== "completed") { // the original test's retry path
    cause = { phase: "first", sq1: st.quests.sq1.state, dialog: st.ui.dialog?.npc ?? null, toast: st.ui.toast?.text ?? null, bag: st.inventory.items.length, gold: st.player.gold };
    for (const it of st.inventory.items.slice(0, 10)) await B.app("input", { t: "sell", id: it.id });
    await B.page.click(T("quest-handin-sq1")).catch(() => {}); await B.app("step", 2); st = await B.state();
  }
  const stB = await B.app('slots.view').then((v) => v.status).catch(() => null), idxB = await B.app('slots.list').then((l) => l.owner ?? null).catch(() => null);
  const w = await B.app("save.write");
  const wRaw = JSON.stringify(w), stB2 = await B.app('slots.view').then((v) => v.status).catch(() => null), idxB2 = await B.app('slots.list').then((l) => l.owner ?? null).catch(() => null), nowMs = Date.now();
  const rawB = await B.app("slots.raw", 1); const dB = deserialize(rawB), sqB = dB.ok && dB.state.quests.sq1.s;
  const pb = deserialize(await A.app("slots.raw", 1)); const sqA1 = pb.ok && pb.state.quests.sq1.s; await new Promise((r) => setTimeout(r, 400)); const sqA2 = await A.app("slots.raw", 1).then((t) => { const d = deserialize(t); return d.ok && d.state.quests.sq1.s; }); const memB = (await B.state()).quests.sq1.state; const savedTickB = dB.ok && dB.state.tick, memTickB = (await B.state()).tick;
  const ok1 = pb.ok && st.quests.sq1.state === "completed" && (pb.state.quests.sq1.s === "completed" || w?.ok === false);
  const aw = await A.app("save.write"); const fin = deserialize(await A.app("slots.raw", 1));
  const ok2 = fin.ok && (fin.state.quests.sq1.s === "completed" || aw?.ok === false);
  await ctx.close();
  return { ok1, ok2, sqB, sqA1, sqA2, memB, savedTickB, memTickB, wRaw, stBbefore: stB && stB.owner, stBafter: stB2 && stB2.owner, ownerBefore: idxB && { id: String(idxB.id).slice(0, 6), ageMs: nowMs - idxB.beat }, ownerAfter: idxB2 && { id: String(idxB2.id).slice(0, 6), ageMs: nowMs - idxB2.beat }, bl: bl.ok, dlg, before, clicked, btnState, cause, w: w?.ok ?? w, pbs: pb.ok && pb.state.quests.sq1.s, errs: A.errors.length + B.errors.length };
}
for (const cond of CONDS) {
  const origin = cond.startsWith("file") ? "file" : "https", par = cond.endsWith("-par");
  const variants = ["await", "swallow"];
  for (const v of variants) {
    const res = [];
    if (par) { for (let i = 0; i < N; i += 3) res.push(...await Promise.all([0, 1, 2].map(() => once(origin, v)))); }
    else for (let i = 0; i < N; i++) res.push(await once(origin, v));
    const bad = res.filter((r) => !(r.ok1 && r.ok2 && r.errs === 0));
    console.log(`${cond} click=${v}: ${res.length - bad.length}/${res.length} ok`, bad.length ? JSON.stringify(bad.slice(0, 3)) : "");
    totalRuns += res.length; totalBad += bad.length;
  }
}
await browser.close();
console.log(`r8t-tabs: ${totalRuns - totalBad}/${totalRuns} two-tab runs passed`); // run-all summary line; a failing run makes the script exit non-zero
if (totalBad) process.exitCode = 1;
