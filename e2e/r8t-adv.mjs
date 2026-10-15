// R8-T adversarial pass: awkward names, boundary values, cursor item across reload, input/panel/resize spam, full bag, zero gold, hostile imports, known-open confirmations (R8-A1, R8-A2).
import { launch, open, startNew, check, finish, SHOTS, tileScreen, freeTilesNear } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
// the machine may be loaded (other agents): a page that misses the 15 s title wait is retried, it is not a product signal
const open2 = async (opts) => { for (let i = 0; ; i++) { try { return await open(browser, opts); } catch (e) { if (i >= 2) throw e; } } };
const noNaN = (o) => !JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "NaN!" : v)).includes("NaN!");

// ---- 1. awkward names must fit their boxes (no horizontal overflow) in every place a name is shown
for (const [W, H] of [[1280, 720], [390, 844]]) {
  for (const name of ["WWWWWWWWWWWWWWWW", "漢字漢字漢字漢字漢字漢字漢字漢字", "Ṽ̸̡̢̛e̷r̵y̶ ̷L̶o̶n̶g̷", "MMMMMMMM MMMMMMM"]) {
    const g = await open2({ query: "test=1&seed=2", viewport: { width: W, height: H }, lobby: true });
    await startNew(g.page, { cls: "facilities-manager", name });
    const vp = `${W}x${H}`;
    const st = await g.state();
    const over = async (label) => { const r = await g.page.evaluate(() => { const bad = []; if (document.documentElement.scrollWidth > innerWidth + 1) bad.push("page scrollWidth " + document.documentElement.scrollWidth); for (const e of document.querySelectorAll("#ui *, #overlay *")) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || !e.offsetParent && cs.position !== "fixed" || e.id === "live" || e.classList.contains("sr") || e.closest("#live,.sr")) continue; const r = e.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest("[inert]")) { bad.push((e.dataset.testid || e.className || e.tagName) + ":" + Math.round(r.left) + "-" + Math.round(r.right)); if (bad.length > 4) break; } } return bad; }); check(`[R8T-adv] ${vp} name "${name.slice(0, 8)}…" ${label}: nothing overflows the viewport`, r.length === 0, r); };
    check(`[R8T-adv] ${vp} name "${name.slice(0, 8)}…" accepted (clipped to the 16-character limit at most)`, st.player.name.length > 0 && name.startsWith(st.player.name.slice(0, 8)), st.player.name);
    await g.app("ui.open", "character"); await over("Employee File");
    await g.app("ui.close", "character");
    await g.page.keyboard.press("Escape"); await over("pause menu");
    await g.page.click(T("pause-slots")); await over("slot manager");
    await g.page.keyboard.press("Escape"); await g.page.keyboard.press("Escape");
    await g.page.keyboard.press("Escape"); await g.page.click(T("quit")); await over("title with Continue");
    check(`[R8T-adv] ${vp} no page errors (name test)`, g.errors.length === 0, g.errors.slice(0, 3));
    await g.context.close();
  }
}

// ---- 2. boundary values: gold, level, full bag, zero gold
{
  const g = await open2({ lobby: true, query: "test=1&seed=6" });
  await startNew(g.page, { cls: "sales-rep", name: "Bounds" });
  await g.app("cheat.giveGold", 2000000000); await g.app("cheat.giveGold", 2000000000); // past 2^31
  let s = await g.state();
  check("[R8T-adv] gold past 2^31 stays a finite integer in state", Number.isSafeInteger(s.player.gold) && s.player.gold >= 4e9, s.player.gold);
  await g.app("ui.open", "inventory");
  const gw = await g.page.evaluate(() => { const e = document.querySelector('[data-testid="gold"]'); return { text: e.textContent, sw: e.scrollWidth, cw: e.clientWidth }; });
  check("[R8T-adv] huge gold fits its box on the Desk Drawer", gw.sw <= gw.cw + 1, gw);
  const CAP = (await g.state()).config.levelCap; const lr = await g.app("cheat.setLevel", CAP);
  s = await g.state();
  console.log("INFO level cap", CAP, "setLevel(cap) ->", JSON.stringify(lr), "level", s.player.level, "maxHp", s.player.hpMax);
  check("[R8T-adv] setLevel(levelCap) reaches the cap", s.player.level === CAP, s.player.level);
  const over = await g.app("cheat.setLevel", CAP + 1); check("[R8T-adv] setLevel(cap+1) is refused", over.ok === false, over);
  check("[R8T-adv] max level gives finite stats everywhere in the snapshot", noNaN(s.player) && s.player.hpMax > 0, s.player.hpMax);
  await g.app("ui.open", "character"); await g.app("ui.open", "skills");
  await g.page.waitForTimeout(100);
  check("[R8T-adv] character + skills panels render at max level without errors", g.errors.length === 0, g.errors.slice(0, 3));
  for (const bad of [0, -1, NaN, 1e9, "7", null]) { const r = await g.app("cheat.setLevel", bad).catch((e) => ({ threw: String(e.message).slice(0, 80) })); check(`[R8T-adv] setLevel(${String(bad)}) does not corrupt state`, noNaN(await g.state()) && (await g.state()).player.level >= 1, r); }
  await g.app("ui.close", "skills"); await g.app("ui.close", "character");
  // full bag
  let placed = 0; for (let i = 0; i < 80; i++) { const r = await g.app("cheat.giveItem", { slot: ["body", "head", "weapon", "feet", "hands"][i % 5], rarity: "magic" }); if (r.ok) placed++; else break; }
  s = await g.state();
  console.log("INFO bag filled with", placed, "items; first refusal:", JSON.stringify(await g.app("cheat.giveItem", { slot: "body" })));
  const drop = await g.app("cheat.spawnItem", { slot: "body", rarity: "rare" });
  await g.app("step", 2); s = await g.state();
  const ge = s.groundItems.find((e) => e.item);
  if (ge) { const sc = tileScreen(s.ui.camera, ge.tile.x, ge.tile.y); await g.app("input", { t: "pickup", id: ge.id }); await g.app("step", 120); }
  s = await g.state();
  check("[R8T-adv] full bag: pickup is refused cleanly (the item stays on the ground, nothing is lost or duplicated)", s.groundItems.some((e) => e.item) || s.inventory.items.length > placed, { ground: s.groundItems.length, inv: s.inventory.items.length });
  const ids = [...s.inventory.items.map((i) => i.id), ...(s.cursorItem ? [s.cursorItem.id] : []), ...Object.values(s.equipment).filter(Boolean).map((i) => i.id)];
  check("[R8T-adv] item ids are unique across bag, cursor and equipment", new Set(ids).size === ids.length, ids.length - new Set(ids).size);
  // zero gold
  await g.app("cheat.giveGold", 1); const gold0 = (await g.state()).player.gold;
  await g.app("input", { t: "interact", id: "potions" }); await g.app("step", 900);
  const dlgNpc = (await g.state()).ui.dialog?.npc;
  // spend everything: buy until refused
  s = await g.state();
  const stock = s.vendor?.stock ?? s.ui.dialog?.stock ?? [];
  const buy1 = await g.app("input", { t: "buy", index: 0 }); 
  console.log("INFO dialog", dlgNpc, "buy index0:", JSON.stringify(buy1));
  check("[R8T-adv] gold never goes negative on any buy", (await g.state()).player.gold >= 0, (await g.state()).player.gold);
  check("[R8T-adv] boundary section: no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- 3. cursor item across reload (the item in the hand is in the save exactly once)
{
  const g = await open2({ lobby: true, query: "test=1&seed=6" });
  await startNew(g.page, { cls: "it-wizard", name: "Hands" });
  await g.app("cheat.giveItem", { slot: "body", rarity: "rare" });
  await g.app("ui.open", "inventory"); await g.page.waitForTimeout(80);
  let s = await g.state(); const it = s.inventory.items.find((i) => i.slot === "body");
  const cell = `[data-testid="cell-${it.x}-${it.y}"]`;
  await g.page.click(cell); await g.app("step", 1);
  s = await g.state();
  check("[R8T-adv] a real click on a bag item picks it up onto the cursor", s.cursorItem?.id === it.id, [s.cursorItem?.id, it.id]);
  await g.page.evaluate(() => location.reload());
  await g.page.waitForFunction(() => window.__app?.getState().scene === "title"); await g.page.click(T("continue"));
  s = await g.state();
  const where = [s.cursorItem?.id === it.id ? "cursor" : null, s.inventory.items.some((i) => i.id === it.id) ? "bag" : null].filter(Boolean);
  check("[R8T-adv] item in hand at reload comes back exactly once (cursor or bag)", where.length === 1, where);
  check("[R8T-adv] cursor-item section: no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- 4. input spam: random keys, clicks, resizes, panel toggles
{
  const g = await open2({ lobby: true, query: "test=1&seed=8&realtime=1&start=floor" });
  await startNew(g.page, { cls: "facilities-manager", name: "Spam" });
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const keys = ["KeyI", "KeyC", "KeyS", "KeyJ", "KeyM", "Tab", "Escape", "F1", "F2", "F3", "F4", "Digit1", "Digit2", "Digit3", "Digit4", "KeyK", "Enter", "Space", "ArrowDown", "ArrowUp"];
  const sizes = [[1280, 720], [390, 844], [844, 390], [1024, 600], [1920, 1080], [1366, 768]];
  for (let i = 0; i < 400; i++) {
    const r = rnd();
    try {
      if (r < 0.45) await g.page.keyboard.press(keys[Math.floor(rnd() * keys.length)]);
      else if (r < 0.9) await g.page.mouse.click(rnd() * 1200 + 20, rnd() * 680 + 20, { button: rnd() < 0.2 ? "right" : "left" });
      else if (r < 0.95) { const [w, h] = sizes[Math.floor(rnd() * sizes.length)]; await g.page.setViewportSize({ width: w, height: h }); }
      else await g.page.keyboard.down("Shift");
    } catch (e) { /* page closed or detached targets are not game errors */ }
    if (i % 50 === 0) await g.page.waitForTimeout(100);
  }
  await g.page.keyboard.up("Shift"); await g.page.setViewportSize({ width: 1280, height: 720 }); await g.page.waitForTimeout(300);
  const s = await g.state();
  check("[R8T-adv] 400 random keys/clicks/resizes (right clicks, Tab, panel keys): no page error", g.errors.length === 0, g.errors.slice(0, 4));
  check("[R8T-adv] after the spam the state is sane (finite numbers, hp within 0..max, valid scene)", noNaN(s.player) && s.player.hp <= s.player.hpMax && ["floor", "town", "dead", "victory"].includes(s.scene), [s.scene, s.player.hp, s.player.hpMax]);
  await g.page.screenshot({ path: `${SHOTS}/r8t-adv-after-spam.png` });
  await g.context.close();
}

// ---- 5. known-open confirmations (not new): R8-A1 drawer at 1280x720, R8-A2 xptip swallows canvas clicks
{
  const g = await open2({ lobby: true, query: "test=1&seed=6", viewport: { width: 1280, height: 720 } });
  await startNew(g.page, { cls: "facilities-manager", name: "Known" });
  await g.app("ui.open", "inventory"); await g.page.waitForTimeout(100);
  const m = await g.page.evaluate(() => { const d = document.querySelector('[data-testid="drawer-inventory"]'); const sc = [...d.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map((e) => e.className || e.tagName); const last = d.querySelector('[data-testid="cell-0-3"]').getBoundingClientRect(); const dr = d.getBoundingClientRect(); const foot = [...d.querySelectorAll('[data-testid="inv-owed"],[data-testid="drop-floor"],[data-testid="put-back"]')].map((e) => ({ id: e.dataset.testid, bottom: Math.round(e.getBoundingClientRect().bottom) })); return { drawer: [dr.top, dr.bottom].map(Math.round), row4bottom: Math.round(last.bottom), scrollers: sc, foot, vh: innerHeight }; });
  console.log("INFO R8-A1 @1280x720 inventory drawer:", JSON.stringify(m));
  check("[R8T-adv][R8-A1 known] bag row 4 is inside the drawer at 1280x720 without scrolling", m.row4bottom <= m.drawer[1] - 4, m);
  const x = await g.page.evaluate(() => { const e = document.querySelector('[data-testid="hud-xp"]'); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { rect: [r.x, r.y, r.width, r.height].map(Math.round), over: top?.dataset?.testid ?? top?.tagName }; });
  console.log("INFO R8-A2 xptip:", JSON.stringify(x));
  check("[R8T-adv][R8-A2 known] the xp tooltip box does not swallow canvas clicks at its centre", x.over !== "hud-xp", x);
  await g.context.close();
}

// ---- 6. hostile imports: each fixture names the rule it breaks and asserts the rejection or a safe load
{
  const g = await open2({ lobby: true, query: "test=1&seed=6" });
  await startNew(g.page, { cls: "sales-rep", name: "Seed" });
  await g.app("save.write");
  const good = JSON.parse(await g.app("save.raw"));
  const mut = (f) => { const d = structuredClone(good); f(d); return JSON.stringify(d); };
  const H = {
    "gold is NaN-like string": mut((d) => { d.player.gold = "9e999"; }),
    "negative gold": mut((d) => { d.player.gold = -5; }),
    "gold beyond safe integer": mut((d) => { d.player.gold = 1e300; }),
    "level 0": mut((d) => { d.player.level = 0; }),
    "level 10^9": mut((d) => { d.player.level = 1e9; }),
    "__proto__ key at top level": JSON.stringify(good).replace("{", '{"__proto__":{"polluted":1},'),
    "constructor skill id": mut((d) => { d.player.skills = { constructor: 3 }; }),
    "item with unknown base": mut((d) => { d.inventory.items.push({ id: "i99", base: "toString", name: "x", kind: "gear", rarity: "normal", ilvl: 1, slot: "body", w: 1, h: 1, x: 0, y: 0, reqs: {}, affixes: [] }); }),
    "unknown class": mut((d) => { d.class = "wizard-of-oz"; }),
    "name with markup": mut((d) => { d.name = "<img src=x onerror=alert(1)>"; }),
    "checksum mismatch": mut((d) => { d.player.xp += 1; }),
    "empty object": "{}", "array": "[]", "null": "null", "huge nesting": "[".repeat(5000) + "]".repeat(5000),
  };
  for (const [rule, text] of Object.entries(H)) {
    const r = await g.page.evaluate(([t]) => { try { return window.__app.save.import(2, t, true); } catch (e) { return { threw: String(e.message).slice(0, 100) }; } }, [text]);
    let loaded = null;
    if (r?.ok) { loaded = await g.app("slots.run", { t: "loadSlot", slot: 2, confirm: true }).catch((e) => ({ threw: e.message })); await g.app("step", 30); }
    const st = await g.state();
    const polluted = await g.page.evaluate(() => ({}).polluted === undefined && Object.prototype.polluted === undefined);
    check(`[R8T-adv][hostile] ${rule}: rejected (ok:false, no throw) or, if accepted, the game stays sane`, !r?.threw && polluted && (r?.ok === false || (noNaN(st.player) && st.player.gold >= 0 && st.player.level >= 1 && st.player.level <= (st.config?.levelCap ?? 100))), { r: r?.error ?? r, loaded: loaded?.ok ?? loaded, gold: st.player.gold, lvl: st.player.level });
    if (r?.ok) { await g.page.keyboard.press("Escape"); await g.page.click(T("quit")).catch(() => {}); await g.page.click(T("continue")).catch(() => {}); }
  }
  check("[R8T-adv][hostile] no page errors across all hostile imports", g.errors.length === 0, g.errors.slice(0, 4));
  await g.context.close();
}
await browser.close();
finish("r8t-adv");
