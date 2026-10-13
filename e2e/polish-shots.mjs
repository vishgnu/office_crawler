// After-screenshots for the S1 visual polish pass: docs/shots/s1-polish-{fight,pile-lowhp,death,title}.jpg (1920x1080) and a 390x844 fight.
// Usage: node e2e/polish-shots.mjs [outDir=docs/shots]
import { launch, open, freeTilesNear } from "./helpers.mjs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "docs/shots");
const shot = (g, name) => g.page.screenshot({ path: `${outDir}/s1-polish-${name}.jpg`, type: "jpeg", quality: 85 });
const browser = await launch();

async function pile(g, seed) {
  await g.app("newGame", { seed });
  let s = await g.app("step", 30);
  const near = freeTilesNear(s, s.player.tile, 6, 1);
  const types = ["printer-imp", "zombie-intern", "printer-imp", "printer-imp", "zombie-intern"];
  for (let i = 0; i < types.length; i++) await g.app("cheat.spawnMonster", types[i], near[i * 2] ?? near[i]);
  return s;
}

{ // fight (1920x1080), like the reviewer's: a short fight caught on the tick a hit lands
  const g = await open(browser, { query: "test=1&seed=1", viewport: { width: 1920, height: 1080 } });
  await g.app("newGame", { seed: 1 });
  let s = await g.app("step", 30);
  const near = freeTilesNear(s, s.player.tile, 6, 2);
  await g.app("cheat.spawnMonster", "zombie-intern", near[0]);
  await g.app("cheat.spawnMonster", "zombie-intern", near[3] ?? near[1]);
  await g.app("cheat.spawnMonster", "printer-imp", near[5] ?? near[2]);
  await g.app("step", 40);
  s = await g.state();
  const m = s.monsters.filter((x) => x.ai !== "dead").sort((a, b) => b.tile.x + b.tile.y - (a.tile.x + a.tile.y))[0];
  if (m) await g.app("cmd.attack", m.id);
  for (let i = 0; i < 400; i++) { s = await g.app("step", 1); if (s.events.some((e) => e.type === "hit" && e.source === "player")) break; }
  await g.page.waitForTimeout(70);
  await shot(g, "fight");
  console.log("fight errors", g.errors);
  await g.context.close();
}
{ // pile at low HP, then death on the frame of the state change
  const g = await open(browser, { query: "test=1&seed=3", viewport: { width: 1920, height: 1080 } });
  await pile(g, 3);
  let s, shotLow = false;
  for (let i = 0; i < 3000; i++) {
    s = await g.app("step", 1);
    const r = s.player.hp / s.player.hpMax;
    if (!shotLow && r < 0.3 && r > 0 && s.events.some((e) => e.type === "hit" && e.target === "player")) { await shot(g, "pile-lowhp"); shotLow = true; }
    if (s.scene === "dead") break;
  }
  console.log("lowhp shot", shotLow, "scene", s.scene);
  await shot(g, "death"); // same frame as the state change (no waiting)
  console.log("death errors", g.errors);
  await g.context.close();
}
{ // title
  const g = await open(browser, { query: "test=1&seed=1", viewport: { width: 1920, height: 1080 } });
  await g.page.waitForTimeout(700);
  await shot(g, "title");
  await g.context.close();
}
{ // phone
  const g = await open(browser, { query: "test=1&seed=3", viewport: { width: 390, height: 844 } });
  await pile(g, 3);
  let s;
  for (let i = 0; i < 3000; i++) { s = await g.app("step", 1); if (s.player.hp / s.player.hpMax < 0.3 && s.scene === "floor") break; }
  await shot(g, "390-lowhp");
  await g.context.close();
}
await browser.close();
