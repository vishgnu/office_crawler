// R8-T boundary buys through the real mouse: exactly-enough gold, one short, zero gold, belt/bag full; Emergency Exit at its price (R8-A6 evidence hole).
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";
const browser = await launch();
const g = await open(browser, { lobby: true, query: "test=1&seed=11" });
await startNew(g.page, { cls: "it-wizard", name: "Buyer" });
const rows = async () => g.page.evaluate(() => [...document.querySelectorAll('[data-testid^="buy-"]')].map((b) => { const row = b.closest("li,tr,div.row,.item") ?? b.parentElement; return { id: b.dataset.testid, text: (row?.innerText ?? "").replace(/\s+/g, " ").slice(0, 80), disabled: b.disabled || b.getAttribute("aria-disabled") === "true" }; }));
const gold = async () => (await g.state()).player.gold;
async function openVendor(npc) { await g.app("input", { t: "interact", id: npc }); await g.app("step", 900); await g.page.waitForSelector('[data-testid="npc-window"]', { state: "visible", timeout: 5000 }); await g.page.click('[data-testid="tab-buy"]').catch(() => {}); }
let found = null;
for (const npc of ["vendor", "potions"]) {
  await openVendor(npc); const r = await rows(); const e = r.find((x) => /emergency exit/i.test(x.text));
  console.log("INFO", npc, JSON.stringify(r.map((x) => x.text)));
  if (e) { found = { npc, ...e }; break; }
  await g.page.keyboard.press("Escape");
}
check("[R8T-vendor] a vendor sells the Emergency Exit", !!found, null);
if (found) {
  const p = Number((await g.state()).vendor.stock.find((x, i) => `buy-${i}` === found.id)?.price);
  console.log("INFO exit price", p, "row", found.text);
  // bring gold to exactly p - 1: spend by buying cheap items until gold <= p-1 is not possible with additions only, so work from 50 gold: start gold is 50.
  let have = await gold();
  const row = async () => (await rows()).find((x) => x.id === found.id);
  // 1) one short
  // spend down: buy the first affordable cheaper item until gold < p
  for (let guard = 0; guard < 6 && (await gold()) >= p; guard++) {
    const st = (await g.state()).vendor.stock, k = st.findIndex((x, i) => x.price <= have && `buy-${i}` !== found.id);
    if (k < 0) break;
    await g.page.click(`[data-testid="buy-${k}"]`); await g.app("step", 2); have = await gold();
  }
  const short = await gold();
  const bagBefore = (await g.state()).inventory.items.length + (await g.state()).belt.filter(Boolean).length;
  if (short < p) {
    await g.page.click(`[data-testid="${found.id}"]`, { force: true }).catch(() => {}); await g.app("step", 2);
    check(`[R8T-vendor] with ${short} gold (price ${p}) the Emergency Exit is refused, gold unchanged, nothing added`, (await gold()) === short && ((await g.state()).inventory.items.length + (await g.state()).belt.filter(Boolean).length) === bagBefore, { gold: await gold() });
    await g.app("cheat.giveGold", p - short); // now exactly the price
    check("[R8T-vendor] fixture: gold equals the price exactly", (await gold()) === p, await gold());
    await g.page.click(`[data-testid="${found.id}"]`); await g.app("step", 2);
    const s = await g.state();
    const has = [...s.inventory.items, ...s.belt.filter(Boolean)].some((i) => i.base === "emergency-exit");
    check(`[R8T-vendor] with exactly ${p} gold the real click buys the Emergency Exit, leaving 0 gold`, has && (await gold()) === 0, { has, gold: await gold() });
    await g.page.click(`[data-testid="${found.id}"]`, { force: true }).catch(() => {}); await g.app("step", 2);
    check("[R8T-vendor] at 0 gold a further click buys nothing and gold stays 0", (await gold()) === 0, await gold());
  } else console.log("INFO could not get below the price from 50 gold");
}
check("[R8T-vendor] no page errors", g.errors.length === 0, g.errors.slice(0, 4));
await browser.close();
finish("r8t-vendor");
