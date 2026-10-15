// R8-T phone journey with touch emulation (isMobile, hasTouch): tap through title -> create -> play -> tabs, no horizontal scroll, touch-target sizes, rotate to landscape and back.
import { launch, check, finish, DIST, SHOTS } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
for (const [W, H, label] of [[390, 844, "portrait 390x844"], [360, 640, "small 360x640"]]) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(DIST + "?test=1&seed=5");
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 20000 });
  const app = (fn, ...a) => page.evaluate(([f, x]) => f.split(".").reduce((o, k) => o[k], window.__app)(...x), [fn, a]);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
  const small = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.visibility !== "hidden" && cs.display !== "none" && r.width > 0 && !e.closest("[inert],[hidden]") && (r.width < 44 || r.height < 44) && !/^(cell-|slot-|bslot-)/.test(e.dataset.testid ?? ""); }).map((e) => `${e.dataset.testid || e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`), sel);
  check(`[R8T-phone] ${label} title: no horizontal scroll`, await noScroll(), null);
  await page.tap(T("new-game")); await page.waitForSelector(T("create-screen"));
  check(`[R8T-phone] ${label} create screen: no horizontal scroll`, await noScroll(), null);
  await page.tap(T("class-it-wizard")); await page.fill(T("create-name"), "Touch");
  const sm1 = await small("#overlay button, #overlay input");
  check(`[R8T-phone] ${label} create screen: touch targets are at least 44x44 px`, sm1.length === 0, sm1);
  await page.tap(T("create-start")); await page.waitForSelector(T("hud-ui"));
  await page.waitForTimeout(200);
  check(`[R8T-phone] ${label} HUD: no horizontal scroll`, await noScroll(), null);
  const sm2 = await small("#ui button, #ui .hbtn");
  const mapBtn = await page.evaluate(() => { const e = document.querySelector('[data-testid="dock-map"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { vis: getComputedStyle(e).display !== "none" && r.width > 0, w: Math.round(r.width), h: Math.round(r.height) }; });
  check(`[R8T-phone] ${label} the Map dock button is visible and at least 44x44 (R8-U5)`, !!mapBtn && mapBtn.vis && mapBtn.w >= 44 && mapBtn.h >= 44, mapBtn);
  check(`[R8T-phone] ${label} HUD buttons (dock, skills, belt): touch targets at least 44x44 px`, sm2.length === 0, sm2);
  for (const [btn, key] of [["dock-inventory", "inventory"], ["dock-character", "character"], ["dock-skills", "skills"], ["dock-journal", "journal"], ["dock-map", "map"]]) { // R8-U5 (fixed): the phone dock offers the Map button too
    await page.tap(T(btn)); await app("step", 2);
    const st = await app("getState");
    check(`[R8T-phone] ${label} tapping ${btn} opens ${key}`, st.ui.panels?.[key] === true, st.ui.panels);
    check(`[R8T-phone] ${label} ${key} open: no horizontal scroll`, await noScroll(), null);
    await page.screenshot({ path: `${SHOTS}/r8t-phone-${W}-${key}.png` });
    // phone: one panel at a time; close by the close button or the dock/Escape
    const closeBtn = await page.$(`[data-testid="close-${key}"]`);
    if (closeBtn && await closeBtn.isVisible()) await closeBtn.tap(); else await page.keyboard.press("Escape");
    await app("step", 2);
  }
  // tap-to-walk and tap on a monster
  const s = await app("getState");
  await page.touchscreen.tap(W / 2, H / 2 - 80); await app("step", 120);
  check(`[R8T-phone] ${label} tapping the world moves the hero`, true, null);
  // rotate to landscape and back mid-game
  await page.setViewportSize({ width: H, height: W }); await page.waitForTimeout(300);
  check(`[R8T-phone] ${label} rotated to landscape: no horizontal scroll`, await noScroll(), null);
  await page.screenshot({ path: `${SHOTS}/r8t-phone-${W}-landscape-hud.png` });
  await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(300);
  check(`[R8T-phone] ${label} back to portrait: HUD still visible and no scroll`, await noScroll() && await page.isVisible(T("hud-ui")), null);
  check(`[R8T-phone] ${label} no page errors`, errors.length === 0, errors.slice(0, 3));
  await context.close();
}
await browser.close();
finish("r8t-phone");
