// R8-T reachability (L-052): every visible control of every screen/panel lies inside the viewport and elementFromPoint at its centre returns it (or a child).
// Sizes: 1280x720, 1366x768 (desktop minimum band) and, with REACH_PHONE=1, 390x844 and 844x390. One real-mouse click on the key control of each panel.
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";

const SIZES = process.env.REACH_SIZES ? process.env.REACH_SIZES.split(",").map((s) => s.split("x").map(Number)) : process.env.REACH_PHONE ? [[390, 844], [844, 390], [360, 640]] : [[1280, 720], [1366, 768]];
const SEL = 'button, input, select, textarea, a[href], summary, [tabindex]:not([tabindex="-1"]), [role=button], [role=radio], [role=tab], [data-testid^="cell-"], [data-testid^="slot-"], [data-testid^="bslot-"], [data-testid^="hud-belt"], [data-testid^="hud-skill"]';

/** Returns the list of problems on the current screen (empty = every visible control reachable). */
export async function reach(page, label) {
  const r = await page.evaluate((SEL) => {
    const vw = innerWidth, vh = innerHeight, out = [], seen = [];
    for (const el of document.querySelectorAll(SEL)) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden],[inert]")) continue;
      let hid = false; for (let p = el; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0" && p !== el && false) { hid = true; break; } }
      if (hid) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      const id = el.dataset.testid || el.id || el.className || el.tagName;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      seen.push(id);
      const probe = () => {
        const bb = el.getBoundingClientRect(), x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
        const ins = bb.left >= -0.5 && bb.top >= -0.5 && bb.right <= vw + 0.5 && bb.bottom <= vh + 0.5;
        if (!ins) return { why: "outside viewport", rect: [bb.x, bb.y, bb.width, bb.height].map(Math.round) };
        const top = document.elementFromPoint(x, y);
        if (!top || !(top === el || el.contains(top) || (top.contains(el) && top.tagName === "LABEL"))) return { why: "covered/clipped", by: top ? (top.dataset?.testid || top.id || top.className || top.tagName).toString().slice(0, 40) : null, rect: [bb.x, bb.y, bb.width, bb.height].map(Math.round) };
        return null;
      };
      let bad = probe();
      if (bad) {
        // legitimate when a user-scrollable ancestor (overflow auto/scroll that really overflows) can bring it into view
        let sc = null; for (let p = el.parentElement; p; p = p.parentElement) { const c = getComputedStyle(p); if (/(auto|scroll)/.test(c.overflowY + c.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) { sc = p; break; } }
        if (sc || document.scrollingElement.scrollHeight > vh + 1) { el.scrollIntoView({ block: "center", inline: "center" }); const again = probe(); if (!again) { out.scrolled = (out.scrolled || 0) + 1; bad = null; } else bad = { ...again, why: again.why + " even after scrollIntoView" }; }
      }
      if (bad) out.push({ id, ...bad });
    }
    return { out, n: seen.length, scrolled: out.scrolled || 0 };
  }, SEL);
  return r;
}
const rep = async (page, label, vp) => { const r = await reach(page, label); check(`[R8T-reach] ${vp} ${label}: ${r.n} controls reachable (${r.scrolled} via scroll)`, r.out.length === 0 && r.n > 0, r.out.slice(0, 6)); return r; };

const browser = await launch();
for (const [W, H] of SIZES) {
  const vp = `${W}x${H}`;
  const g = await open(browser, { query: "test=1&seed=3", viewport: { width: W, height: H }, lobby: true });
  const { page } = g;
  await rep(page, "title (no save)", vp);
  await page.click('[data-testid="options"]'); await page.waitForTimeout(50); await rep(page, "options", vp);
  await page.click('[data-testid="opt-back"]');
  await page.click('[data-testid="load-game"]'); await page.waitForTimeout(50); await rep(page, "load/slots (empty)", vp);
  await page.keyboard.press("Escape");
  await page.click('[data-testid="new-game"]'); await rep(page, "create screen (nothing chosen)", vp);
  await page.click('[data-testid="class-sales-rep"]'); await page.fill('[data-testid="create-name"]', "Reach"); await rep(page, "create screen (class+name)", vp);
  await page.screenshot({ path: `${SHOTS}/r8t-reach-create-${vp}.png` });
  await page.click('[data-testid="create-start"]'); // real-mouse click on the key control
  check(`[R8T-reach] ${vp} Start by real click enters the game`, (await g.state()).scene === "town", (await g.state()).scene);
  await rep(page, "Lobby HUD", vp);
  for (const p of ["inventory", "character", "skills", "journal"]) {
    await g.app("ui.open", p); await page.waitForTimeout(40);
    await rep(page, `panel ${p}`, vp);
    await page.screenshot({ path: `${SHOTS}/r8t-reach-${p}-${vp}.png` });
    const st = await g.state();
    await page.click(`[data-testid="close-${p === "character" ? "character" : p}"]`).catch(async () => { await page.keyboard.press("Escape"); });
    await g.app("ui.close", p);
  }
  // inventory with a full bag: row 4 and the footer (owed line / drop) must be reachable
  await g.app("ui.open", "inventory"); await page.waitForTimeout(30);
  await rep(page, "inventory + footer (empty bag)", vp);
  for (let i = 0; i < 12; i++) await g.app("cheat.giveItem", { kind: "gear", slot: "body" });
  await rep(page, "inventory (12 gear items)", vp);
  await g.app("ui.close", "inventory");
  // NPC windows
  for (const npc of ["vendor", "potions", "healer", "stash"]) {
    await g.app("input", { t: "interact", id: npc }); await g.app("step", 900);
    const open = await page.evaluate(() => !!document.querySelector('[data-testid="npc-window"]') && getComputedStyle(document.querySelector('[data-testid="npc-window"]')).visibility !== "hidden");
    if (!open) { check(`[R8T-reach] ${vp} NPC ${npc} window opens after walking`, false, "window not open"); continue; }
    await rep(page, `NPC window ${npc}`, vp);
    await page.screenshot({ path: `${SHOTS}/r8t-reach-npc-${npc}-${vp}.png` });
    await page.keyboard.press("Escape"); await g.app("step", 5);
  }
  // pause menu
  await page.keyboard.press("Escape"); await page.waitForTimeout(50);
  await rep(page, "pause menu", vp);
  await page.screenshot({ path: `${SHOTS}/r8t-reach-pause-${vp}.png` });
  await page.keyboard.press("Escape");
  // death screen
  await g.app("cheat.teleportFloor", 2); await g.app("cheat.setHp", 0); await g.app("step", 120); await page.waitForTimeout(700); // the death screen buttons ignore clicks for 0.5 s (.dead .btn unlock animation)
  const sc = (await g.state()).scene;
  check(`[R8T-reach] ${vp} death scene reached`, sc === "dead", sc);
  if (sc === "dead") { await rep(page, "death screen", vp); await page.screenshot({ path: `${SHOTS}/r8t-reach-dead-${vp}.png` }); }
  check(`[R8T-reach] ${vp} no page errors`, g.errors.length === 0, g.errors.slice(0, 4));
  await g.context.close();
}
await browser.close();
finish("r8t-reach");
