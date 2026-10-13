// Shared Playwright helpers. Tests assert on window.__app state, not on pixels (except where an AC says so).
import { chromium, firefox, webkit } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

export const DIST = pathToFileURL(resolve("dist/index.html")).href;
export const SHOTS = resolve("e2e/shots");
mkdirSync(SHOTS, { recursive: true });
export const engines = { chromium, firefox, webkit };

export async function launch(name = "chromium") {
  return engines[name].launch();
}

/** Open the built game. Records page errors, console errors and every request URL. */
export async function open(browser, { query = "test=1&seed=1", viewport = { width: 1280, height: 720 }, wait = true } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(DIST + (query ? "?" + query : ""));
  if (wait) await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  const state = () => app("getState");
  return { context, page, app, state, errors, requests };
}

let failed = 0, total = 0;
const results = [];
export function check(name, ok, detail) {
  total++;
  if (!ok) failed++;
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? "  -> " + JSON.stringify(detail).slice(0, 400) : ""}`);
}
export function finish(label) {
  console.log(`\n${label}: ${total - failed}/${total} checks passed`);
  if (failed) process.exitCode = 1;
  return { total, failed };
}

/** Walkable, prop-free tiles near a point (for click targets), nearest first. */
export function freeTilesNear(s, centre, radius, minDist = 2) {
  const { w, h, tiles, props } = s.floor, blocked = new Set(props.filter((p) => p.blocks).map((p) => p.y * w + p.x));
  const occ = new Set(s.monsters.map((m) => `${m.tile.x},${m.tile.y}`));
  const out = [];
  for (let y = centre.y - radius; y <= centre.y + radius; y++) for (let x = centre.x - radius; x <= centre.x + radius; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const c = tiles[y * w + x], d = Math.max(Math.abs(x - centre.x), Math.abs(y - centre.y));
    if (![1, 3].includes(c) || blocked.has(y * w + x) || occ.has(`${x},${y}`) || d < minDist) continue;
    out.push({ x, y, d });
  }
  return out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
}

/** Screen centre (CSS px) of a tile from the camera in ui.camera. */
export function tileScreen(cam, x, y) {
  const wx = x + 0.5, wy = y + 0.5;
  return { x: cam.ox + (wx - wy) * 32 * cam.z, y: cam.oy + (wx + wy) * 16 * cam.z };
}
