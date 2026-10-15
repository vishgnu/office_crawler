// FIX-R8T-3-UI checks: L-1 short landscape phone panels (one header row, full height, equipment beside the bag, equipping by real clicks), L-2 portrait drawer shows the bag,
// L-3 death screen hides pill/toast, L-5 skill tree tier 1 centred over its children, L-6 respawn / Emergency Exit lines ahead of older toasts, floor-2 unspent-points toast once per visit,
// "In hand" footer at 1280x720 / 1366x768. Screenshots go to E2E_SHOTS (a temp dir, L-042), never docs/shots.
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const R = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, vh: innerHeight, vw: innerWidth }; }, sel);
const hitOk = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); if (r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5 || r.top < -0.5) return false; const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!h && (h === e || e.contains(h) || h.contains(e)); }, sel);
async function fresh(W, H, cls = "facilities-manager", seed = 7) {
  const g = await open(browser, { lobby: true, query: `test=1&seed=${seed}`, viewport: { width: W, height: H } });
  await startNew(g.page, { cls, name: "Shot" }); await g.page.waitForSelector(T("hud-ui"));
  return g;
}

// ---- L-1: short landscape phones
for (const [W, H] of [[667, 375], [740, 360], [844, 390]]) {
  const L = `[L-1] ${W}x${H}`;
  const g = await fresh(W, H);
  await g.app("cheat.setLevel", 20);
  for (let i = 0; i < 10; i++) await g.app("input", { t: "allocate", attr: "stamina" });
  const a = await g.app("cheat.giveItem", { slot: "feet", rarity: "normal" });
  await g.app("ui.open", "inventory"); await g.app("step", 2); await g.page.waitForTimeout(150);
  const d = await R(g.page, "#pright"), ph = await R(g.page, "#pright .ph"), pb = await R(g.page, "#pright .pb");
  check(`${L} Desk Drawer: title and tabs in one header row (header <= 58 px, tabs inside it, none in the body)`, ph.h <= 58 && (await g.page.locator("#pright .ph .tabs").count()) === 1 && (await g.page.locator("#pright .pb .tabs").count()) === 0, { ph: ph.h });
  check(`${L} Desk Drawer: the body shows at least 200 px (was 100-140)`, pb.h >= 200, pb.h);
  check(`${L} Desk Drawer runs down to the toast strip (bottom within 44 px of the viewport bottom)`, d.vh - d.b <= 44, { bottom: d.b, vh: d.vh });
  check(`${L} the hotbar and belt buttons hide while a panel is open`, await g.page.evaluate(() => getComputedStyle(document.querySelector("#hudui")).visibility === "hidden"), null);
  const dollR = await R(g.page, "#pright .doll"), bagR = await R(g.page, "#pright .gridwrap");
  check(`${L} equipment and bag side by side (bag right of the doll, rows overlap)`, bagR.x >= dollR.r - 1 && bagR.y < dollR.b && dollR.y < bagR.b, { doll: [dollR.x, dollR.r], bag: [bagR.x] });
  for (const id of ["slot-head", "slot-body", "slot-weapon", "slot-feet", "cell-0-0", "close-inventory", "tab-character", "tab-skills", "gold"]) check(`${L} ${id} inside the viewport and hit`, await hitOk(g.page, T(id)), await R(g.page, T(id)));
  const it = (await g.state()).inventory.items.find((i) => i.id === a.id);
  await g.page.click(T(`cell-${it.x}-${it.y}`)); await g.page.click(T("slot-feet")); await g.app("step", 2);
  const eq = (await g.state()).equipment.feet;
  check(`${L} equipping with two real clicks works (feet slot filled)`, !!eq && eq.id === a.id, eq?.id);
  await g.page.screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-inventory.png` });
  // the toast sits in the strip under the panel, not over the panel
  await g.app("cheat.setLevel", 22); await g.app("step", 2);
  await g.page.waitForFunction(() => { const t = document.querySelector('[data-testid="toast"]'); return t && !t.hidden && t.textContent; }, null, { timeout: 4000 }).catch(() => {});
  const to = await R(g.page, T("toast")), d2 = await R(g.page, "#pright");
  check(`${L} a toast with a panel open sits in the strip below it (no overlap, inside the viewport)`, !!to && to.y >= d2.b - 2 && to.b <= to.vh + 0.5, { toast: to && [to.y, to.b], panel: d2.b });
  await g.page.screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-toast.png` });
  // File and Skills through the header tabs
  await g.page.click(T("tab-character")); await g.app("step", 2); await g.page.waitForTimeout(100);
  const fb = await R(g.page, "#pleft .pb"), fp = await R(g.page, "#pleft .ph");
  check(`${L} Employee File: header one row, body >= 200 px, name visible and hit`, fp.h <= 58 && fb.h >= 200 && await hitOk(g.page, T("file-name")), { ph: fp.h, pb: fb.h });
  await g.page.screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-file.png` });
  await g.page.click(T("tab-skills")); await g.app("step", 2); await g.page.waitForTimeout(100);
  const sb = await R(g.page, "#pleft .pb");
  check(`${L} Skills: body >= 200 px and the skill points line is visible`, sb.h >= 200 && await hitOk(g.page, T("skill-points")), { pb: sb.h });
  const first = await g.page.evaluate(() => { const n = document.querySelector('#pleft .tnode'), pbx = document.querySelector("#pleft .pb").getBoundingClientRect(); if (!n) return null; const r = n.getBoundingClientRect(); return r.top < pbx.bottom - 20; });
  check(`${L} Skills: the first skill card starts inside the visible body`, first === true, first);
  await g.page.screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-skills.png` });
  await g.page.click(T("tab-inventory")); await g.app("step", 2);
  check(`${L} the Gear tab switches back`, (await g.state()).ui.panels.inventory === true && (await g.page.locator("#pright.open").count()) === 1, null);
  await g.app("ui.close", "inventory"); await g.app("ui.close", "skills"); await g.app("ui.close", "character"); await g.app("step", 2);
  check(`${L} after closing the panel the hotbar is back`, await g.page.evaluate(() => getComputedStyle(document.querySelector("#hudui")).visibility !== "hidden"), null);
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- L-2: portrait phone: the bag is visible under a compact equipment block
for (const [W, H, rows] of [[390, 844, 4], [360, 640, 2]]) {
  const L = `[L-2] ${W}x${H}`;
  const g = await fresh(W, H);
  await g.app("cheat.giveItem", { slot: "body", rarity: "normal" });
  await g.app("ui.open", "inventory"); await g.app("step", 2); await g.page.waitForTimeout(150);
  const foot = await R(g.page, "#pright .footrow"), pb = await R(g.page, "#pright .pb");
  const row = await R(g.page, T(`cell-0-${rows - 1}`));
  check(`${L} ${rows} bag rows are visible above the gold footer without scrolling`, row.b <= foot.y + 1 && row.y >= pb.y, { rowBottom: row.b, footTop: foot.y });
  const doll = await R(g.page, "#pright .doll"), belt = await R(g.page, "#pright .beltbox");
  check(`${L} the belt sits beside the equipment, inside the drawer`, belt.x >= doll.r - 1 && belt.r <= W, { doll: doll.r, belt: [belt.x, belt.r] });
  for (const id of ["slot-head", "slot-body", "slot-feet", "bslot-0", "bslot-3", "cell-0-0", "close-inventory"]) check(`${L} ${id} inside the viewport and hit`, await hitOk(g.page, T(id)), await R(g.page, T(id)));
  await g.page.screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-inventory.png` });
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- desktop: the "In hand" footer, every control inside the viewport (L-052)
for (const [W, H] of [[1280, 720], [1366, 768], [1920, 1080]]) {
  const L = `[hand] ${W}x${H}`;
  const g = await fresh(W, H);
  for (const sl of ["body", "head", "hands", "feet", "weapon", "offhand", "body", "head"]) await g.app("cheat.giveItem", { slot: sl, rarity: "rare" });
  await g.app("ui.open", "inventory"); await g.app("ui.open", "character"); await g.app("step", 2);
  const it = (await g.state()).inventory.items[0];
  await g.page.click(T(`cell-${it.x}-${it.y}`)); await g.app("step", 1); await g.page.waitForTimeout(150);
  const f = await R(g.page, "#pright .footrow"), hl = await R(g.page, "#pright .heldline"), pb = await R(g.page, "#pright .pb");
  check(`${L} the footer is two rows at most (<= 90 px) while an item is held`, f.h <= 90, f.h);
  const under = await g.page.evaluate(() => { const e = document.querySelector("#pright .heldline"), r = e.getBoundingClientRect(), h = document.elementFromPoint(r.x + 20, r.y + r.height / 2); return !!h && !!h.closest(".footrow"); });
  check(`${L} the "In hand" line is on top (no bag item or cell over it) and sits inside the footer`, under && hl.y >= f.y - 1 && hl.b <= f.b + 1, { hl: [hl.y, hl.b], f: [f.y, f.b] });
  const cellsBelow = await g.page.evaluate(() => { const top = document.querySelector("#pright .heldline").getBoundingClientRect().top; return [...document.querySelectorAll("#pright .cell")].filter((c) => { const r = c.getBoundingClientRect(); return r.top < top && r.bottom > top && r.top > 0; }).length; });
  check(`${L} (info) bag cells cut by the footer edge: ${cellsBelow}`, true, null);
  for (const id of ["put-back", "drop-floor", "close-inventory", "close-character", "gold"]) check(`${L} ${id} inside the viewport and hit`, await hitOk(g.page, T(id)), await R(g.page, T(id)));
  await g.page.screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-held.png` });
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- L-3: death screen hides the pill and the toast
for (const [W, H] of [[667, 375], [1280, 720], [390, 844]]) {
  const L = `[L-3] ${W}x${H}`;
  const g = await fresh(W, H);
  await g.app("cheat.setLevel", 3); await g.app("step", 2); await g.page.waitForTimeout(150);
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  const v = await g.page.evaluate(() => ({ tracker: getComputedStyle(document.querySelector(".tracker")).visibility, hiddenAttr: document.querySelector(".tracker").hidden, toast: getComputedStyle(document.querySelector("#toast")).visibility, tip: getComputedStyle(document.querySelector("#tip")).visibility }));
  check(`${L} death: tracker pill, toast and tooltip are not visible`, (v.tracker === "hidden" || v.hiddenAttr) && v.toast === "hidden" && v.tip === "hidden", v);
  await g.page.screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-dead.png` });
  await g.context.close();
}

// ---- L-5: tier 1 centred over its two children (Facilities Manager safety, IT Wizard infrastructure)
for (const [W, H, cls, parent, kids, branch] of [[1280, 720, "facilities-manager", "dress-code", ["coffee-break", "fire-drill"], "safety"], [1366, 768, "facilities-manager", "dress-code", ["coffee-break", "fire-drill"], "safety"], [1280, 720, "it-wizard", "server-overheat", ["power-surge", "overclock"], "infrastructure"]]) {
  const L = `[L-5] ${W}x${H} ${cls}`;
  const g = await fresh(W, H, cls);
  await g.app("ui.open", "skills"); await g.app("step", 2); await g.page.waitForTimeout(150);
  await g.page.evaluate((b) => document.querySelector(`[data-testid="branch-${b}"]`).scrollIntoView({ block: "center" }), branch);
  await g.page.waitForTimeout(100);
  const cx = async (id) => { const r = await R(g.page, T(`skill-${id}`)); return r.x + r.w / 2; };
  const p = await cx(parent), k1 = await cx(kids[0]), k2 = await cx(kids[1]);
  check(`${L} tier 1 "${parent}" is centred over its children (off by ${Math.abs(p - (k1 + k2) / 2).toFixed(1)} px)`, Math.abs(p - (k1 + k2) / 2) <= 4, { p, k1, k2 });
  const pr = await R(g.page, T(`skill-${parent}`)), kr = await R(g.page, T(`skill-${kids[0]}`));
  check(`${L} the tier 1 card has the width of one column (like its children)`, Math.abs(pr.w - kr.w) <= 3, { p: pr.w, k: kr.w });
  await g.page.locator(T(`branch-${branch}`)).screenshot({ path: `${SHOTS}/r8t3-${W}x${H}-${cls}-${branch}.png` });
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- L-6: the respawn line and the Emergency Exit line are not queued behind older toasts
{
  const g = await fresh(1280, 720);
  await g.page.evaluate(() => { window.__toastLog = []; const t = document.querySelector("#toast"); new MutationObserver(() => { if (!t.hidden && t.textContent) window.__toastLog.push(t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] }); });
  await g.app("cheat.setLevel", 6); await g.app("step", 2);          // older passive lines: level-ups wait in the queue
  await g.app("cheat.teleportFloor", 1); await g.app("step", 2);
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  await g.page.evaluate(() => { window.__toastLog.length = 0; document.querySelector('[data-testid="respawn"]').click(); }); // log cleared and clicked in one task: a stale line that was already due cannot slip in between
  await g.app("step", 5); await g.page.waitForTimeout(400);
  const log = await g.page.evaluate(() => window.__toastLog.slice());
  check("[L-6] after Respawn the first line on screen is the respawn line, not an older queued one", /Back in the Lobby/.test(log[0] ?? ""), log.slice(0, 4));
  // belt empty: drink all, die, respawn
  await g.app("cheat.teleportFloor", 1); await g.app("step", 2);
  for (let i = 0; i < 4; i++) { await g.app("cheat.setHp", 5); await g.app("step", 1); await g.app("input", { t: "useBelt", index: i }); await g.app("step", 1); }
  const empty = (await g.state()).belt.every((b) => !b);
  await g.app("cheat.setLevel", 9); await g.app("step", 2);
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  await g.page.evaluate(() => { window.__toastLog.length = 0; document.querySelector('[data-testid="respawn"]').click(); }); // log cleared and clicked in one task: a stale line that was already due cannot slip in between
  await g.app("step", 5); await g.page.waitForTimeout(400);
  const log2 = await g.page.evaluate(() => window.__toastLog.slice());
  check("[L-6] belt empty: the first line after Respawn names the restock hint", empty && /restock potions/.test(log2[0] ?? ""), { empty, log2: log2.slice(0, 4) });
  // Emergency Exit: the door line is first, even with a level-up waiting
  await g.app("cheat.teleportFloor", 2); await g.app("step", 2);
  const ex = await g.app("cheat.giveItem", { base: "emergency-exit" });
  await g.app("cheat.setLevel", 12); await g.app("step", 2);
  await g.page.evaluate(() => { window.__toastLog.length = 0; });
  await g.app("input", { t: "useItem", id: ex.id }); await g.app("step", 5); await g.page.waitForTimeout(400);
  const log3 = await g.page.evaluate(() => window.__toastLog.slice());
  const s3 = await g.state();
  check("[L-6] Emergency Exit: the door line shows first", s3.depth === 0 && /Emergency Exit/.test(log3[0] ?? ""), { depth: s3.depth, log3: log3.slice(0, 4) });
  check("[L-6] no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// ---- unspent points: one low line on arrival on floor 2, once per visit
{
  const g = await fresh(1280, 720);
  await g.page.evaluate(() => { window.__toastLog = []; const t = document.querySelector("#toast"); new MutationObserver(() => { if (!t.hidden && t.textContent) window.__toastLog.push(t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] }); });
  await g.app("cheat.setLevel", 4); await g.app("step", 2);
  const p = (await g.state()).player;
  check("[points] the hero holds unspent points", p.attrPoints > 0, p.attrPoints);
  await g.page.waitForTimeout(3600); await g.page.evaluate(() => { window.__toastLog.length = 0; });
  await g.app("cheat.teleportFloor", 1); await g.app("step", 2); await g.page.waitForTimeout(3600);
  const f1 = await g.page.evaluate(() => window.__toastLog.filter((x) => /points to spend/.test(x)).length);
  check("[points] floor 1: no nudge", f1 === 0, f1);
  await g.page.evaluate(() => { window.__toastLog.length = 0; });
  await g.app("cheat.teleportFloor", 2); await g.app("step", 2);
  await g.page.waitForFunction(() => window.__toastLog.some((x) => /points to spend/.test(x)), null, { timeout: 9000 }).catch(() => {});
  await g.page.waitForTimeout(4000);
  const log = await g.page.evaluate(() => window.__toastLog.slice());
  const n = log.filter((x) => /points to spend/.test(x)).length, floorFirst = log.findIndex((x) => /Floor 2/.test(x)) <= log.findIndex((x) => /points to spend/.test(x));
  check("[points] floor 2: exactly one nudge, after the floor name", n === 1 && floorFirst, log);
  await g.page.waitForTimeout(4000);
  const n2 = (await g.page.evaluate(() => window.__toastLog.filter((x) => /points to spend/.test(x)).length));
  check("[points] it does not repeat while the hero stays on the floor", n2 === 1, n2);
  check("[points] no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}
await browser.close();
const r = finish("r8t3-fix");
process.exit(r.failed ? 1 : 0);
