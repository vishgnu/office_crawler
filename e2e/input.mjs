// Input edge cases through the real browser: held mouse across pause (S1 review B1), pointer cancel,
// resize while playing, Escape and Tab with focused menu buttons.
import { launch, open, check, finish, freeTilesNear, tileScreen, startNew } from "./helpers.mjs";

const browser = await launch();
const frames = (page, n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

// ---- B1: hold, Esc, release, Esc, move -> the hero must not follow ----
{
  const g = await open(browser, { query: "test=1&seed=1&realtime=1" });
  await startNew(g.page);
  let s = await g.state();
  const [A, B] = [freeTilesNear(s, s.player.tile, 6, 3)[0], freeTilesNear(s, s.player.tile, 9, 7).at(-1)];
  const pa = tileScreen(s.ui.camera, A.x, A.y);
  await g.page.mouse.move(pa.x, pa.y);
  await g.page.mouse.down();
  s = await g.state();
  check("B1 [setup] the core sees the button held", s.input.mouse.down === true);
  await g.page.keyboard.press("Escape");
  await g.page.mouse.up();
  s = await g.state();
  check("B1 releasing the button while paused clears mouse.down", s.paused === true && s.input.mouse.down === false, s.input.mouse);
  await g.page.keyboard.press("Escape");
  // let the hero finish the walk to A, then move the cursor to B with no button down
  await g.page.waitForFunction((t) => { const p = window.__app.getState().player; return !p.next && p.path.length === 0 && p.tile.x === t.x && p.tile.y === t.y; }, A, { timeout: 20000 });
  const before = (await g.state()).player.tile;
  const pb = tileScreen((await g.state()).ui.camera, B.x, B.y);
  await g.page.mouse.move(pb.x, pb.y, { steps: 5 });
  await frames(g.page, 60);
  s = await g.state();
  check("B1 after resume, moving the cursor does not move the hero", s.player.tile.x === before.x && s.player.tile.y === before.y && s.player.path.length === 0 && !s.player.next, { before, now: s.player.tile });
  check("B1 no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---- pointercancel releases the button ----
{
  const g = await open(browser);
  await startNew(g.page);
  let s = await g.app("step", 1);
  const T = freeTilesNear(s, s.player.tile, 6, 3)[0], p = tileScreen(s.ui.camera, T.x, T.y);
  await g.page.mouse.move(p.x, p.y);
  await g.page.mouse.down();
  check("pointercancel [setup] button held", (await g.state()).input.mouse.down === true);
  await g.page.evaluate(() => document.getElementById("game").dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true })));
  check("pointercancel clears mouse.down", (await g.state()).input.mouse.down === false);
  await g.page.mouse.up();
  await g.context.close();
}

// ---- resize while playing ----
{
  const g = await open(browser, { viewport: { width: 1280, height: 720 } });
  await startNew(g.page);
  let s = await g.app("step", 1);
  const T = freeTilesNear(s, s.player.tile, 5, 3)[0];
  const sizes = [[1280, 720], [1920, 1080], [900, 600]];
  const bad = [];
  for (const [w, h] of sizes) {
    await g.page.setViewportSize({ width: w, height: h });
    await g.page.waitForFunction(([ww, hh]) => { const c = window.__app.getState().ui.camera; return c.w === ww && c.h === hh; }, [w, h]);
    await g.app("newGame", { seed: 1 });
    s = await g.app("step", 1);
    const cv = await g.page.evaluate(() => { const c = document.getElementById("game"); return { cw: c.width, ch: c.height, dpr: window.devicePixelRatio }; });
    const cam = s.ui.camera, p = tileScreen(cam, T.x, T.y);
    await g.page.mouse.click(p.x, p.y);
    const end = (await g.state()).player.path.at(-1);
    if (cam.w !== w || cam.h !== h || Math.abs(cv.cw - w * Math.min(cv.dpr, 2)) > 1 || Math.abs(cv.ch - h * Math.min(cv.dpr, 2)) > 1 || !end || end.x !== T.x || end.y !== T.y) bad.push({ w, h, cam, cv, end });
  }
  check("resize: camera and canvas follow the viewport and a click still maps to the same tile (3 sizes)", bad.length === 0, bad);
  check("resize: no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---- menu keyboard: Tab moves focus, Escape on a focused button acts once ----
{
  const g = await open(browser);
  await startNew(g.page);
  await g.app("step", 1);
  await g.page.keyboard.press("Escape");
  const focused = () => g.page.evaluate(() => document.activeElement?.dataset?.testid ?? null);
  check("pause screen focuses Resume", (await focused()) === "resume");
  await g.page.keyboard.press("Tab");
  check("Tab moves focus between pause buttons (Resume, Journal, Save slots, Options, Quit)", (await focused()) === "pause-journal");
  await g.page.keyboard.press("Tab");
  check("Tab again reaches Save slots", (await focused()) === "pause-slots");
  await g.page.keyboard.press("Tab");
  check("Tab again reaches Options", (await focused()) === "options");
  await g.page.keyboard.press("Tab");
  check("Tab again reaches Quit", (await focused()) === "quit");
  await g.page.keyboard.press("Shift+Tab");
  await g.page.keyboard.press("Shift+Tab");
  await g.page.keyboard.press("Shift+Tab");
  await g.page.keyboard.press("Shift+Tab");
  check("Shift+Tab moves focus back", (await focused()) === "resume");
  await g.page.keyboard.press("Escape");
  let s = await g.state();
  check("Escape with Resume focused resumes exactly once (not re-paused)", s.paused === false && s.ui.menu === null, { paused: s.paused, menu: s.ui.menu });
  await g.page.keyboard.press("Escape");
  await g.page.keyboard.press("Enter"); // activates the focused Resume button
  s = await g.state();
  check("Enter on the focused Resume button resumes exactly once", s.paused === false && s.ui.menu === null, { paused: s.paused });
  const prevented = await g.page.evaluate(() => {
    const ev = new KeyboardEvent("keydown", { code: "Tab", cancelable: true, bubbles: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  check("Tab is captured while playing (reserved for the skill selector)", prevented === true);
  check("input: no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}
await browser.close();
finish("input");
