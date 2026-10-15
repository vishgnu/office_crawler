// R11 fix round, UI part (browser checks; screenshots go to the temp dir, L-042):
//  R11-01 short-landscape skill tree: computed grid columns (cards in 3 columns, not pinned to column 1), chain branches in one row, tier 1 centred over its children
//  M-1 360x640 dock: no overlap, every button hit, the quest pill sits below the dock
//  U-1 victory screen: both buttons in view and hit at 667x375, 740x360, 844x390, 360x640 (and 1280x720)
//  U-2 short landscape: File shows all four attributes, the canvas HUD is not drawn under the panel edge
//  U-3 Options: room under the last line; U-4 create screen at 360x640: the stat bars are not cut by the name field
//  R11-07 short-phone toast strip at every text size: a two-line toast stays inside the strip
//  R11-09 title on the ellipsised File lines, touch hint in the Desk Drawer footer (phone only)
//  R11-06 / R11-04 death with a held item in the real UI; R11-05 the nudge once per run (story on)
//  L-052 at 1280x720 and 1366x768 every dock button is inside the viewport and hit
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const R = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, vh: innerHeight, vw: innerWidth }; }, sel);
const hitOk = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); if (r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5 || r.top < -0.5) return false; const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!h && (h === e || e.contains(h) || h.contains(e)); }, sel);
async function fresh(W, H, { cls = "facilities-manager", seed = 7, query = "" } = {}) {
  const g = await open(browser, { lobby: true, query: `test=1&seed=${seed}${query}`, viewport: { width: W, height: H } });
  await startNew(g.page, { cls, name: "Shot" }); await g.page.waitForSelector(T("hud-ui"));
  return g;
}
const SHORT = [[667, 375], [740, 360], [844, 390]];

// ---- R11-01: skill tree on a short landscape phone
for (const [W, H] of SHORT) {
  const L = `[R11-01] ${W}x${H}`;
  for (const [cls, chainBranch, treeBranch, parent, kids] of [["facilities-manager", "maintenance", "safety", "dress-code", ["coffee-break", "fire-drill"]], ["it-wizard", "security", "infrastructure", "server-overheat", ["power-surge", "overclock"]]]) {
    const g = await fresh(W, H, { cls });
    await g.app("cheat.setLevel", 20);
    await g.app("ui.open", "skills"); await g.app("step", 2); await g.page.waitForTimeout(200);
    const info = await g.page.evaluate(() => {
      const nodes = [...document.querySelectorAll("#pleft .tnode")], col = (n) => getComputedStyle(n).gridColumnStart;
      const tn = document.querySelector("#pleft .tnodes").getBoundingClientRect();
      return { cols: [...new Set(nodes.map(col))], widths: nodes.map((n) => Math.round(n.getBoundingClientRect().width)), tnodes: Math.round(tn.width) };
    });
    check(`${L} ${cls}: the cards use all three grid columns (computed grid-column-start ${info.cols.join(",")}), not only column 1`, ["1", "2", "3"].every((c) => info.cols.includes(c)), info);
    check(`${L} ${cls}: a card is about a third of the tree width, not a third of a third (widths ${[...new Set(info.widths)].join(",")})`, Math.min(...info.widths) >= 0.28 * info.tnodes, info);
    // the chain branch (one card per tier): tiers 1, 2, 3 side by side in one row
    const chain = await g.page.evaluate((b) => { const sec = document.querySelector(`[data-testid="branch-${b}"]`); const ns = [...sec.querySelectorAll(".tnode")].map((n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), tier: n.dataset.tier }; }); return { ns, chain: sec.querySelector(".tnodes").classList.contains("chain") }; }, chainBranch);
    check(`${L} ${cls}: the chain branch "${chainBranch}" is one row of three cards, tier 1 to 3 left to right`, chain.chain && chain.ns.length === 3 && new Set(chain.ns.map((n) => n.y)).size === 1 && chain.ns[0].x < chain.ns[1].x && chain.ns[1].x < chain.ns[2].x, chain);
    // L-5 on the short phone: tier 1 centred over its two children
    await g.page.evaluate((b) => document.querySelector(`[data-testid="branch-${b}"]`).scrollIntoView({ block: "start" }), treeBranch);
    await g.page.mouse.move(2, 2); await g.page.waitForTimeout(150);
    const cx = async (id) => { const r = await R(g.page, T(`skill-${id}`)); return r.x + r.w / 2; };
    const p = await cx(parent), k1 = await cx(kids[0]), k2 = await cx(kids[1]);
    check(`${L} ${cls}: tier 1 "${parent}" is centred over its children (off by ${Math.abs(p - (k1 + k2) / 2).toFixed(1)} px)`, Math.abs(p - (k1 + k2) / 2) <= 4, { p, k1, k2 });
    if (cls === "facilities-manager") await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-skills.png` });
    check(`${L} ${cls}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
    await g.context.close();
  }
}

// ---- L-5 (R8-T) on the desktop: still visible in the current build
for (const [W, H, cls, parent, kids, branch] of [[1280, 720, "facilities-manager", "dress-code", ["coffee-break", "fire-drill"], "safety"], [1366, 768, "it-wizard", "server-overheat", ["power-surge", "overclock"], "infrastructure"]]) {
  const g = await fresh(W, H, { cls });
  await g.app("ui.open", "skills"); await g.app("step", 2); await g.page.waitForTimeout(150);
  await g.page.evaluate((b) => document.querySelector(`[data-testid="branch-${b}"]`).scrollIntoView({ block: "center" }), branch);
  await g.page.mouse.move(700, 300); await g.page.waitForTimeout(150);
  const cx = async (id) => { const r = await R(g.page, T(`skill-${id}`)); return r.x + r.w / 2; };
  const p = await cx(parent), k1 = await cx(kids[0]), k2 = await cx(kids[1]);
  check(`[L-5] ${W}x${H} ${cls}: tier 1 is centred over its children (off by ${Math.abs(p - (k1 + k2) / 2).toFixed(1)} px)`, Math.abs(p - (k1 + k2) / 2) <= 4, { p, k1, k2 });
  await g.context.close();
}

// ---- M-1: the dock at 360x640 (journal badge on, points badges on, a pinned quest)
for (const [W, H] of [[360, 640], [390, 844]]) {
  const L = `[M-1] ${W}x${H}`;
  const g = await fresh(W, H);
  await g.app("cheat.setLevel", 10); await g.app("cheat.teleportFloor", 3); await g.app("step", 3); await g.page.waitForTimeout(300);
  const r = await g.page.evaluate(() => {
    const bs = [...document.querySelectorAll(".dock .hbtn")].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.open, x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
    const t = document.querySelector("#tracker"), tr = t.hidden ? null : t.getBoundingClientRect();
    return { bs, tr: tr && { y: tr.y, b: tr.bottom }, vw: innerWidth };
  });
  const hit = (a, b) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
  let overlap = null; for (let i = 0; i < r.bs.length; i++) for (let j = i + 1; j < r.bs.length; j++) if (hit(r.bs[i], r.bs[j])) overlap = [r.bs[i].id, r.bs[j].id];
  check(`${L} no two dock buttons overlap`, overlap === null, overlap);
  check(`${L} all five dock buttons are inside the viewport, at least 44x44`, r.bs.length === 5 && r.bs.every((b) => b.x >= 0 && b.r <= r.vw && b.w >= 43.5 && b.h >= 43.5), r.bs);
  const lowest = Math.max(...r.bs.map((b) => b.b));
  check(`${L} the quest pill sits below the lowest dock button (pill top ${r.tr?.y} >= dock bottom ${lowest})`, !!r.tr && r.tr.y >= lowest - 0.5, { tr: r.tr, lowest });
  for (const id of ["dock-inventory", "dock-character", "dock-skills", "dock-map", "dock-journal"]) check(`${L} ${id} is hit at its centre (nothing over it)`, await hitOk(g.page, T(id)), await R(g.page, T(id)));
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-dock.png` });
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- L-052: 1280x720 and 1366x768, every dock button inside the viewport and hit
for (const [W, H] of [[1280, 720], [1366, 768]]) {
  const g = await fresh(W, H);
  await g.app("cheat.setLevel", 10); await g.app("step", 2); await g.page.waitForTimeout(150);
  for (const id of ["dock-inventory", "dock-character", "dock-skills", "dock-map", "dock-journal", "hud-skill-0", "hud-belt-0"]) check(`[L-052] ${W}x${H} ${id} inside the viewport and hit`, await hitOk(g.page, T(id)), await R(g.page, T(id)));
  await g.app("ui.open", "inventory"); await g.app("ui.open", "character"); await g.app("step", 2); await g.page.waitForTimeout(150);
  for (const id of ["close-inventory", "close-character", "gold", "slot-body", "cell-0-0", "alloc-grit"]) check(`[L-052] ${W}x${H} panels open: ${id} inside the viewport and hit`, await hitOk(g.page, T(id)), await R(g.page, T(id)));
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-panels.png` });
  check(`[L-052] ${W}x${H}: the touch hint is not shown on the desktop`, await g.page.evaluate(() => { const e = document.querySelector('[data-testid="touch-hint"]'); return !e || getComputedStyle(e).display === "none"; }), null);
  await g.context.close();
}

// ---- U-1: the victory screen
for (const [W, H] of [...SHORT, [360, 640], [1280, 720]]) {
  const L = `[U-1] ${W}x${H}`;
  const g = await fresh(W, H, { cls: "sales-rep" });
  await g.app("cheat.setLevel", 30); await g.app("cheat.teleportFloor", 9); await g.app("step", 30);
  const boss = (await g.state()).monsters.find((m) => m.boss);
  for (let i = 0; i < 40 && (await g.state()).scene === "floor"; i++) { await g.app("cheat.damageMonster", boss.id, 99999); await g.app("step", 60); }
  await g.page.waitForTimeout(300);
  check(`${L} the victory scene is up`, (await g.state()).scene === "victory", (await g.state()).scene);
  for (const id of ["keep-playing", "quit"]) check(`${L} "${id}" is inside the viewport (no scrolling) and hit`, await hitOk(g.page, T(id)), await R(g.page, T(id)));
  const sum = await g.page.evaluate(() => { const s = document.querySelector(".screen.victory .summary"); if (!s) return null; const r = s.getBoundingClientRect(), b = document.querySelector('[data-testid="keep-playing"]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, btnTop: b.top, vh: innerHeight }; });
  if (W < 1000) check(`${L} the run summary starts in view (above the buttons)`, !!sum && sum.top >= 0 && sum.top < sum.btnTop - 20, sum);
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-victory.png` });
  await g.page.click(T("keep-playing")); await g.app("step", 5);
  check(`${L} Keep playing works`, (await g.state()).scene !== "victory", (await g.state()).scene);
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- U-2: short landscape File: all four attributes in view, the canvas HUD is not drawn under the panel edge
for (const [W, H] of SHORT) {
  const L = `[U-2] ${W}x${H}`;
  const g = await fresh(W, H);
  await g.app("cheat.setLevel", 12);
  await g.app("ui.open", "character"); await g.app("step", 2); await g.page.waitForTimeout(250); await g.page.mouse.move(2, 2);
  const pb = await R(g.page, "#pleft .pb");
  const rows = await g.page.evaluate(() => ["grit", "agility", "stamina", "focus"].map((k) => { const e = document.querySelector(`[data-testid="alloc-${k}"]`); const r = e?.getBoundingClientRect(); return r && { k, y: r.y, b: r.bottom }; }));
  check(`${L} Employee File: all four attribute buttons are inside the body without scrolling`, rows.every((r) => r && r.y >= pb.y && r.b <= pb.b + 1), { pb: [pb.y, pb.b], rows });
  // the strip under the panel holds no HUD pixels: the canvas does not draw the vessels and the hotbar while a short-phone panel is open
  const strip = await g.page.evaluate(() => { const c = document.querySelector("canvas"), d = document.querySelector("#pleft").getBoundingClientRect(); const dpr = c.width / innerWidth, y = Math.round((d.bottom + 4) * dpr), h = Math.max(1, c.height - y); const tmp = document.createElement("canvas"); tmp.width = c.width; tmp.height = c.height; const t = tmp.getContext("2d"); t.drawImage(c, 0, 0); const img = t.getImageData(0, y, Math.min(c.width, Math.round(200 * dpr)), h).data; let bright = 0; for (let i = 0; i < img.length; i += 4) if (img[i] > 170 && img[i + 1] > 170 && img[i + 2] > 170) bright++; return { y, h, bright }; });
  check(`${L} the strip under the panel has no HUD vessel or hotbar pixels (near-white pixels in its left 200 px: ${strip.bright})`, strip.bright < 12, strip);
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-file.png` });
  await g.app("ui.close", "character"); await g.app("step", 2);
  check(`${L} after closing the panel the HUD buttons are back`, await g.page.evaluate(() => getComputedStyle(document.querySelector("#hudui")).visibility !== "hidden"), null);
  await g.context.close();
}

// ---- R11-07: the toast strip at every text size (two lines)
for (const [W, H] of [[667, 375], [844, 390]]) for (const ts of [1, 1.25, 1.5]) {
  const L = `[R11-07] ${W}x${H} text ${ts}`;
  const g = await fresh(W, H);
  await g.app("options.setTextScale", ts); await g.app("cheat.setLevel", 22); await g.app("step", 2);
  await g.app("ui.open", "inventory"); await g.app("step", 2);
  await g.page.waitForFunction(() => { const t = document.querySelector("#toast"); return t && !t.hidden && t.textContent; }, null, { timeout: 4000 }).catch(() => {});
  // a long quest line (two lines): the real toast element and its layout, with a longer text
  await g.page.evaluate(() => { const t = document.querySelector("#toast"); t.hidden = false; t.textContent = "Why the Lights Went Out: completed. Return to the Lobby and report to the facilities desk for your reward, then take the stairs down."; });
  await g.page.waitForTimeout(100);
  const d = await R(g.page, "#pright"), to = await R(g.page, "#toast");
  check(`${L} the (two-line) toast is inside the strip under the panel: no overlap with the panel, inside the viewport (panel bottom ${d.b.toFixed(0)}, toast ${to.y.toFixed(0)}..${to.b.toFixed(0)})`, to.y >= d.b - 1 && to.b <= to.vh + 0.5 && to.r <= to.vw + 0.5 && to.x >= -0.5, { toast: to, panelBottom: d.b });
  check(`${L} the panel keeps a body of at least 190 px`, (await R(g.page, "#pright .pb")).h >= 190, (await R(g.page, "#pright .pb")).h);
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-toast-ts${ts}.png` });
  await g.context.close();
}

// ---- U-3 Options, U-4 create screen
for (const [W, H] of [[360, 640], [390, 844], [667, 375]]) {
  const g = await open(browser, { lobby: true, query: "test=1&seed=7", viewport: { width: W, height: H } });
  await g.page.click(T("options")); await g.page.waitForTimeout(250);
  const o = await g.page.evaluate(() => { const sc = document.querySelector(".screen.options"); sc.scrollTop = sc.scrollHeight; const p = document.querySelector(".opt-panel").getBoundingClientRect(); return { panelBottom: p.bottom, vh: innerHeight }; });
  check(`[U-3] ${W}x${H} Options scrolled to the end: the panel border ends at least 16 px above the viewport edge (${(o.vh - o.panelBottom).toFixed(0)} px)`, o.vh - o.panelBottom >= 16, o);
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-options.png` });
  await g.context.close();
}
for (const [W, H] of [[360, 640], [390, 844]]) {
  const g = await open(browser, { lobby: true, query: "test=1&seed=7", viewport: { width: W, height: H } });
  await g.page.click(T("new-game")); await g.page.click(T("class-facilities-manager")); await g.page.waitForTimeout(250);
  const c = await g.page.evaluate(() => { const st = document.querySelector(".cs-stats").getBoundingClientRect(), info = document.querySelector(".cs-info").getBoundingClientRect(), nm = document.querySelector('[data-testid="create-name"]').getBoundingClientRect(); return { statsBottom: st.bottom, infoBottom: info.bottom, nameTop: nm.top }; });
  check(`[U-4] ${W}x${H} create: the stat bars end above the info block's edge and the name field (${c.statsBottom.toFixed(0)} <= ${c.infoBottom.toFixed(0)} <= ${c.nameTop.toFixed(0)})`, c.statsBottom <= c.infoBottom + 0.5 && c.infoBottom <= c.nameTop + 0.5, c);
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-create.png` });
  await g.context.close();
}

// ---- R11-09: titles and the touch hint
{
  const g = await fresh(390, 844);
  await g.app("ui.open", "character"); await g.app("step", 2); await g.page.waitForTimeout(150);
  const t = await g.page.evaluate(() => ({ n: document.querySelector('[data-testid="file-name"]').title, c: document.querySelector('[data-testid="file-class"]').title }));
  check("[R11-09] the File name and class lines carry a title (the clipped text is readable by hover or long press)", t.n === "Shot" && /Facilities Manager/.test(t.c), t);
  await g.app("ui.close", "character"); await g.app("ui.open", "inventory"); await g.app("step", 2); await g.page.waitForTimeout(150);
  check("[R11-09] 390x844 (the long drag hint shows there): the one-line touch hint is not shown twice", await g.page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="touch-hint"]')).display === "none" && getComputedStyle(document.querySelector(".keyhint")).display !== "none"), null);
  await g.context.close();
}
for (const [W, H] of [[360, 640], [667, 375]]) {
  const g = await fresh(W, H);
  await g.app("ui.open", "inventory"); await g.app("step", 2); await g.page.waitForTimeout(150);
  const h = await R(g.page, T("touch-hint")), foot = await R(g.page, "#pright .footrow");
  const cut = await g.page.evaluate(() => { const e = document.querySelector('[data-testid="touch-hint"]'); return e.scrollWidth > e.clientWidth; });
  check(`[R11-09] ${W}x${H} Desk Drawer (the long drag hint is hidden): the one-line touch hint is visible in the footer, inside it, not cut`, !!h && h.w > 60 && h.h > 0 && h.y >= foot.y - 1 && h.b <= foot.b + 1 && h.h <= 24 && !cut, { h, foot, cut });
  await g.page.screenshot({ path: `${SHOTS}/r11fix-${W}x${H}-touchhint.png` });
  await g.context.close();
}

// ---- R11-06 / R11-04: death with a held item in the real UI (bag room, then bag full)
for (const full of [false, true]) {
  const L = `[R11-06] ${full ? "bag full" : "bag has room"}`;
  const g = await fresh(1280, 720);
  const a = await g.app("cheat.giveItem", { slot: "body", rarity: "normal" });
  await g.app("ui.open", "inventory"); await g.app("ui.open", "character"); await g.app("step", 2);
  const it = (await g.state()).inventory.items.find((i) => i.id === a.id);
  await g.page.click(T(`cell-${it.x}-${it.y}`)); await g.app("step", 1);
  check(`${L} the item is in hand`, (await g.state()).cursorItem?.id === a.id, (await g.state()).cursorItem);
  if (full) for (let i = 0; i < 80; i++) { const r = await g.app("cheat.giveItem", { potion: true }); if (!r.ok) break; }
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(500);
  const s = await g.state();
  const where = [...s.inventory.items.filter((i) => i.id === a.id), ...s.groundItems.filter((e) => e.item?.id === a.id), ...(s.cursorItem?.id === a.id ? [1] : [])].length;
  check(`${L} after death the item exists exactly once (bag or floor), not in hand`, s.scene === "dead" && where === 1 && !s.cursorItem, { scene: s.scene, where, cursor: s.cursorItem?.id });
  check(`${L} the panels are closed on the death screen`, !s.ui.panels.inventory && !s.ui.panels.character, s.ui.panels);
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- R11-05: the points nudge, once per run, with the story on
{
  const g = await fresh(1280, 720, { query: "&story=1" });
  await g.page.evaluate(() => { window.__toastLog = []; const t = document.querySelector("#toast"); new MutationObserver(() => { if (!t.hidden && t.textContent) window.__toastLog.push(t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] }); });
  await g.app("cheat.setLevel", 4); await g.app("step", 2);
  for (const d of [2, 1, 2, 1, 2]) { await g.app("cheat.teleportFloor", d); await g.app("step", 2); await g.page.waitForTimeout(250); }
  await g.page.waitForTimeout(9000);
  const n = await g.page.evaluate(() => window.__toastLog.filter((x) => /points to spend/.test(x)).length);
  check("[R11-05] story on: the points line is shown exactly once across a level-up and three arrivals on floor 2", n === 1, n);
  await g.context.close();
}
await browser.close();
const r = finish("r11fix-ui");
process.exit(r.failed ? 1 : 0);
