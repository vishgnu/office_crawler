// Determinism through the browser: replay the recorded run (test/fixtures/run-a.json) via the hook and compare
// with the frozen golden hash that the Node test also uses. Runs in every installed engine.
import { readFileSync } from "node:fs";
import { engines, launch, open, check, finish } from "./helpers.mjs";

const script = JSON.parse(readFileSync("test/fixtures/run-a.json", "utf8"));
const golden = readFileSync("test/fixtures/run-a.hash", "utf8").trim();
const hashes = {};

for (const name of Object.keys(engines)) {
  let browser;
  try { browser = await launch(name); } catch (e) { console.log(`SKIP ${name}: not installed in this environment`); continue; }
  const g = await open(browser, { query: `test=1&seed=${script.seed}` });
  const run = () => g.page.evaluate(async (sc) => {
    const app = window.__app;
    app.newGame({ seed: sc.seed });
    for (let t = 0; t < sc.ticks; t++) {
      for (const i of sc.inputs) if (i.tick === t) app.input(i.input);
      app.step(1);
    }
    return app.getState().hash;
  }, script);
  const a = await run(), b = await run();
  hashes[name] = a;
  check(`AC-NFR-Q01-1 [${name}] the recorded run gives the same hash twice`, a === b, { a, b });
  check(`AC-NFR-Q01-2 [${name}] hash equals the frozen golden hash (same as Node)`, a === golden, { a, golden });
  check(`AC-R-110-2 [${name}] newGame + step(60) gives tick 60 on a floor`, await g.page.evaluate(() => { window.__app.newGame({ seed: 1 }); const s = window.__app.step(60); return s.tick === 60 && s.scene === "floor"; }));
  check(`AC-R-110-1 [${name}] no page errors`, g.errors.length === 0, g.errors);
  await browser.close();
}
check("at least one engine ran", Object.keys(hashes).length >= 1);
finish("replay");
