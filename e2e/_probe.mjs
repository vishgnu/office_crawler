import { launch, open } from "./helpers.mjs";
const browser = await launch();
const g = await open(browser, { query: "test=1&seed=1", lobby: true, viewport: { width: 390, height: 780 } });
await g.page.click('[data-testid="options"]');
console.log(await g.page.evaluate(() => { const sc = document.querySelector(".screen.options"); const out = [sc.scrollWidth, sc.clientWidth, innerWidth]; for (const e of sc.querySelectorAll("*")) { const r = e.getBoundingClientRect(); if (e.scrollWidth > e.clientWidth + 1 || r.left < -1) out.push(e.tagName + "." + e.className + " " + e.scrollWidth + "/" + e.clientWidth + " " + Math.round(r.left)+"-"+Math.round(r.right)); } return out.slice(0, 12); }));
await g.page.screenshot({ path: "/tmp/claude-0/scratch/opt-phone.png" });
await browser.close();
