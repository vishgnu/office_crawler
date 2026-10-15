// R8-T storage: worst-case characters in all five slots (NFR-D05: slot <= 400 KB, total < 2.5 MB), then quota exhaustion while playing.
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const g = await open(browser, { lobby: true, query: "test=1&seed=31" });
const classes = ["facilities-manager", "sales-rep", "it-wizard", "facilities-manager", "sales-rep"];
for (let i = 0; i < 5; i++) {
  if (i === 0) await startNew(g.page, { cls: classes[0], name: "Max1" });
  else { await g.page.keyboard.press("Escape"); await g.page.click(T("quit")); await g.page.click(T("new-game")); await g.page.click(T(`class-${classes[i]}`)); await g.page.fill(T("create-name"), "Max" + (i + 1)); await g.page.click(T("create-start")); if (await g.page.$(T("create-confirm-yes"))) await g.page.click(T("create-confirm-yes")); }
  await g.app("cheat.setLevel", 30); await g.app("cheat.giveGold", 1e6);
  for (let k = 0; k < 120; k++) { const r = await g.app("cheat.giveItem", { slot: ["body", "head", "weapon", "feet", "hands", "ring", "amulet", "offhand", "belt"][k % 9], rarity: k % 3 ? "rare" : "unique", ilvl: 30 }); }
  // fill the stash through the real input where possible
  const s0 = await g.state();
  for (const it of s0.inventory.items.slice(0, 40)) await g.app("input", { t: "stash", id: it.id });
  for (let k = 0; k < 60; k++) await g.app("cheat.giveItem", { slot: ["body", "head", "weapon"][k % 3], rarity: "rare", ilvl: 30 });
  await g.app("quests.setStep", "main", 3);
  await g.app("save.write");
}
const sizes = await g.page.evaluate(() => { const o = {}; let tot = 0; for (const k of Object.keys(localStorage)) { o[k] = localStorage.getItem(k).length; tot += localStorage.getItem(k).length + k.length; } return { o, tot }; });
console.log("INFO localStorage chars:", JSON.stringify(sizes));
const slotKeys = Object.entries(sizes.o).filter(([k]) => /slot/i.test(k) && !/index/i.test(k));
check("[R8T-storage] five worst-case characters are saved", slotKeys.length >= 5, Object.keys(sizes.o));
check("[R8T-storage] each slot is at most 400 KB (NFR-D05)", slotKeys.every(([, n]) => n <= 400 * 1024), slotKeys.map(([k, n]) => [k, Math.round(n / 1024) + "KB"]));
check("[R8T-storage] total is under 2.5 MB (NFR-D05)", sizes.tot <= 2.5 * 1024 * 1024, Math.round(sizes.tot / 1024) + "KB");
// every slot loads back
for (let n = 1; n <= 5; n++) { const r = await g.page.evaluate((n) => window.__app.slots.run({ t: "loadSlot", slot: n, confirm: true }), n); check(`[R8T-storage] worst-case slot ${n} loads`, r.ok === true, r); if (r.ok) { await g.page.keyboard.press("Escape"); await g.page.click(T("quit")); } }
// quota: fill localStorage with a junk key until the next write fails, then play on and quit
await g.page.click(T("continue"));
const filled = await g.page.evaluate(() => { let n = 0; const chunk = "x".repeat(100000); try { for (let i = 0; i < 200; i++) { localStorage.setItem("junk" + i, chunk); n = i + 1; } } catch (e) { } return n; });
console.log("INFO junk chunks stored before quota:", filled);
await g.app("cheat.giveGold", 5); const w = await g.app("save.write");
console.log("INFO write under full quota:", JSON.stringify(w).slice(0, 200));
check("[R8T-storage] a write under a full quota returns a result (no throw) and the game keeps running", w !== undefined && (await g.state()).scene !== "title", w);
await g.app("step", 60);
const msg = await g.page.evaluate(() => document.body.innerText.slice(0, 2000));
check("[R8T-storage] no page errors under quota exhaustion", g.errors.length === 0, g.errors.slice(0, 3));
await g.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("junk")) localStorage.removeItem(k); });
await g.page.keyboard.press("Escape"); await g.page.click(T("quit")).catch(() => {});
const slotsOk = await g.page.evaluate(() => window.__app.slots.list().slots.map((s) => s.state));
check("[R8T-storage] after freeing space all five slots are still ok (a failed write never damaged a slot)", slotsOk.slice(0, 5).every((s) => s === "ok"), slotsOk);
await browser.close();
finish("r8t-storage");
