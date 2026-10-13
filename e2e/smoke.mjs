// Opens dist/index.html from file:// and checks the test hook. Needs `playwright` available.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const url = pathToFileURL(resolve("dist/index.html")).href + "?seed=7";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url);
const state = await page.evaluate(() => window.__app.state());
await browser.close();
if (errors.length || state.seed !== 7) { console.error("smoke failed", { errors, state }); process.exit(1); }
console.log("smoke ok", state);
