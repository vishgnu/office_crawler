// R8-0.3 e2e (AC-R-260-4 UI side, AC-R-260-6, CR7L-03): the Employee File bust, the slot cards and the class cards follow the worn gear.
// Equip / swap / unequip through the real inventory commands; busts are compared by pixels (canvas data URLs). Screenshots go to E2E_SHOTS only.
import { launch, open, check, finish, startNew } from "./helpers.mjs";

const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const g = await open(browser, { query: "test=1&seed=3", viewport: { width: 1280, height: 720 }, lobby: true });
await startNew(g.page, { cls: "facilities-manager", name: "Gear Tester" });
await g.app("cheat.setLevel", 20); // gear requirements
await g.app("input", { t: "unequip", slot: "weapon" }); // a created character wears the start kit weapon: take it off for the bare baseline
await g.app("step", 2);

const bust = () => g.page.evaluate(() => { const c = document.querySelector("canvas[data-bust]"); return c ? { url: c.toDataURL(), look: c.dataset.look } : null; });
const settle = async () => { await g.app("step", 2); await g.page.waitForTimeout(120); };
const wear = async (base, rarity) => { const r = await g.app("cheat.giveItem", { base, rarity }); const e = await g.app("input", { t: "equip", id: r.id }); await settle(); return { r, e }; };

// ---- Employee File bust
await g.app("ui.open", "character"); await settle();
const bare = await bust();
check("Employee File: the bust canvas exists, painted, bare look empty", !!bare && bare.url.length > 2000 && bare.look === "", bare && { look: bare.look, len: bare.url.length });
const a = await wear("hard-hat", "rare");
const b1 = await bust();
check("AC-R-260-4 / 260-6 equipping a head item repaints the bust (pixels and look change)", a.r.ok && b1.url !== bare.url && b1.look.split("|")[0] === "h2", { look: b1?.look });
const c2 = await wear("visor-cap", "magic");
const b2 = await bust();
check("AC-R-260-4 swapping to another category changes the bust again", c2.r.ok && b2.url !== b1.url && b2.url !== bare.url && b2.look.split("|")[0] === "c1", { look: b2?.look });
const held = await g.app("cheat.giveItem", { base: "steel-toe-boots", rarity: "rare" }); await settle();
const b3 = await bust();
check("AC-R-260-4 carrying an unworn item does not change the bust", held.ok && b3.url === b2.url && b3.look === b2.look);
await wear("pipe-wrench", "normal"); await wear("blazer", "magic");
const b4 = await bust();
check("more worn slots show in the bust look (head, body, weapon)", b4.look.split("|").filter((x) => x !== "-").length === 3 && b4.url !== b2.url, b4.look);
await g.app("input", { t: "unequip", slot: "head" }); await g.app("input", { t: "unequip", slot: "body" }); await g.app("input", { t: "unequip", slot: "weapon" }); await settle();
const b5 = await bust();
check("AC-R-260-4 unequipping everything returns exactly the bare bust", b5.url === bare.url && b5.look === "", { look: b5.look });

// ---- slot cards: bare, worn, malformed and missing look
const cardUrl = () => g.page.evaluate(() => document.querySelector('[data-testid="slot-1"] .sl-badge canvas')?.toDataURL() ?? null);
const idxLook = async () => (await g.app("slots.list")).slots[0].look;
await g.app("save.write"); await g.app("slots.open"); await g.page.waitForSelector(T("slot-1"));
const cardBare = await cardUrl();
check("slot card: a bare hero stores no look and shows a painted bust", (await idxLook()) === undefined && !!cardBare && cardBare.length > 1500, await idxLook());
await g.app("slots.close");
await wear("pipe-wrench", "rare"); await wear("hard-hat", "magic");
const sig = (await g.app("perf")).gearSig;
await g.app("save.write"); await g.app("slots.open"); await g.page.waitForSelector(T("slot-1"));
const cardWorn = await cardUrl();
check("AC-R-260-6 the slot index stores the gear signature at save and the card bust differs from the bare one", (await idxLook()) === sig && sig !== "-|-|-|-|-|-" && cardWorn !== cardBare, { sig, look: await idxLook() });
await g.app("slots.close");
// the Load dialog on the title screen reads the same stored look; a malformed look and a missing look draw the bare bust
const setLook = (v) => g.page.evaluate((look) => { const k = "office-crawler.slots", i = JSON.parse(localStorage.getItem(k)); if (look === undefined) delete i.slots[0].look; else i.slots[0].look = look; localStorage.setItem(k, JSON.stringify(i)); }, v);
const titleCard = async () => { await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title"); await g.page.click(T("load-game")); await g.page.waitForSelector(T("slot-1")); return cardUrl(); };
const t1 = await titleCard();
check("the Load dialog card shows the stored look (same pixels as the in-game slot manager)", t1 === cardWorn);
for (const [label, v] of [["a malformed look", "<img src=x onerror=1>"], ["a too long look", "b1|".repeat(30)], ["a missing look", undefined], ["a number", 5]]) {
  await g.page.keyboard.press("Escape").catch(() => {});
  await setLook(v);
  const t = await titleCard();
  check(`${label} in the index is ignored: bare bust, no page error`, t === cardBare && g.errors.length === 0, g.errors);
}

// ---- class cards on the new-character screen: the starting kit is worn
await g.page.keyboard.press("Escape").catch(() => {});
await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title");
await g.page.click(T("new-game")); await g.page.waitForSelector(".cs-fig");
const looks = await g.page.evaluate(() => [...document.querySelectorAll(".cs-fig")].map((c) => c.dataset.look));
check("AC-R-260-6 every class card carries the look of its starting weapon", looks.length === 3 && looks.every((l) => /^[-a-z0-9]{1,4}(\|[-a-z0-9]{1,4}){5}$/.test(l) && l !== "-|-|-|-|-|-"), looks);
const px = () => g.page.evaluate(() => [...document.querySelectorAll(".cs-fig")].map((c) => c.toDataURL()));
await g.page.setViewportSize({ width: 1281, height: 720 }); await g.page.waitForTimeout(400);
const kitPx = await px();
await g.page.evaluate(() => document.querySelectorAll(".cs-fig").forEach((c) => { c.dataset.look = ""; }));
await g.page.setViewportSize({ width: 1280, height: 720 }); await g.page.waitForTimeout(400);
const barePx = await px();
const diff = kitPx.map((u, i) => u !== barePx[i]);
check("AC-R-260-6 the class cards differ from the bare figures (the kit is drawn)", diff.filter(Boolean).length >= 2, diff);
check("no page errors in the cards flow", g.errors.length === 0, g.errors);

// ---- CR7L-03: leaving a run clears the plate drawer, the title backdrop shows no replayed nameplates
await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title");
await g.page.click(T("continue")).catch(() => {});
await g.page.waitForFunction(() => window.__app?.getState().scene !== "title", null, { timeout: 8000 }).catch(() => {});
await g.app("step", 3); await g.page.waitForTimeout(150);
const during = (await g.app("perf")).platesDrawn;
await g.page.keyboard.press("Escape"); await g.page.waitForSelector(T("quit")); await g.page.click(T("quit"));
await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 8000 });
await g.page.waitForTimeout(300);
check("CR7L-03 plates are drawn while playing and the plate drawer is cleared on the title backdrop", during === true && (await g.app("perf")).platesDrawn === false, { during });
check("no page errors", g.errors.length === 0, g.errors);

// ---- N16: the phone map keeps one dock button, the title row is free; a tap on it closes the map
{
  const m = await open(browser, { query: "test=1&seed=3", viewport: { width: 390, height: 844 }, lobby: true });
  await startNew(m.page, { cls: "facilities-manager" }); await m.app("step", 3); await m.app("ui.open", "map"); await m.page.waitForTimeout(300);
  const vis = await m.page.evaluate(() => [...document.querySelectorAll(".dock .hbtn")].filter((e) => e.offsetParent).map((e) => e.dataset.testid));
  check("N16 phone: with the full map open only the Map dock button shows (the title band is free)", vis.length === 1 && vis[0] === "dock-map", vis);
  await m.page.click(T("dock-map")); await m.app("step", 2);
  const after = await m.page.evaluate(() => [...document.querySelectorAll(".dock .hbtn")].filter((e) => e.offsetParent).length);
  check("N16 phone: the Map button closes the map and the dock is whole again", (await m.state()).ui.panels.map === false && after === 4, after);
  check("N16 no page errors", m.errors.length === 0, m.errors);
  await m.context.close();
}
await browser.close();
const { failed } = finish("r8gear");
process.exit(failed ? 1 : 0);
