// R11 fix round (render): motion judged on a real-time page WITHOUT the noanim flag. A Facilities Manager wears a rare two-handed Mop Halberd, fights a tough monster
// next to him and casts a skill; 1x crops around the hero are taken every ~60 ms and laid out as a contact sheet (E2E_SHOTS or a temp dir, see shots-dir.mjs).
// Checks are state based (no page errors, the monster took damage); the picture is for a human to look at.
import { launch, open, check, finish, freeTilesNear, tileScreen, SHOTS, startNew } from "./helpers.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const browser = await launch();
const g = await open(browser, { query: "test=1&seed=3&realtime=1" });
await g.page.evaluate(() => { const r = document.documentElement; new MutationObserver(() => r.classList.contains("noanim") && r.classList.remove("noanim")).observe(r, { attributes: true, attributeFilter: ["class"] }); r.classList.remove("noanim"); });
await startNew(g.page, { cls: "facilities-manager", name: "Motion Tester" });
await g.page.waitForFunction(() => window.__app.getState().tick > 5, null, { timeout: 20000 }); // the elevator-door transition plays here (noanim is off)
await g.app("cheat.setLevel", 20); // gear requirements: level, then plenty of grit (rare items ask for more)
for (let i = 0; i < 30; i++) await g.app("input", { t: "allocate", attr: "grit" });
const club = await g.app("cheat.giveItem", { base: "mop-halberd", rarity: "rare" });
const eq = await g.app("input", { t: "equip", id: club.id });
check("the rare two-handed halberd is worn", club.ok !== false && eq.ok !== false, { club, eq });
let s = await g.state();
const sp = freeTilesNear(s, s.player.tile, 3, 1)[0];
const m = await g.app("cheat.spawnMonster", "middle-manager", sp);
const frames = [];
const grab = async () => {
  s = await g.state();
  const c = await g.page.evaluate(() => { const st = window.__app.getState(); return st.ui.heroScreen ?? null; });
  const p = c ?? tileScreen(s.ui.camera, s.player.tile.x, s.player.tile.y);
  const clip = { x: Math.max(0, Math.round(p.x - 110)), y: Math.max(0, Math.round(p.y - 130)), width: 220, height: 170 };
  frames.push((await g.page.screenshot({ clip, type: "png" })).toString("base64"));
};
const mp = tileScreen(s.ui.camera, sp.x, sp.y);
await g.page.mouse.move(mp.x, mp.y - 20); await g.page.mouse.down();
for (let i = 0; i < 24; i++) { await grab(); await g.page.waitForTimeout(40); }
await g.page.mouse.up();
const after = (await g.state()).monsters.find((x) => x.id === m.id);
check("the monster took damage (or died) in the real-time fight", !after || after.hp < (after.hpMax ?? Infinity), after);
// one skill cast at the end of the sheet
await g.app("input", { t: "selectSkill", slot: 0 });
await g.app("input", { t: "cast", target: { x: sp.x, y: sp.y } });
await grab();
check("no page errors", g.errors.length === 0, g.errors);
// contact sheet
const sheet = await g.context.newPage();
await sheet.setContent("<canvas id=c></canvas>");
const out = await sheet.evaluate(async (fr) => {
  const imgs = await Promise.all(fr.map((b) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + b; })));
  const cols = 8, w = imgs[0].width, h = imgs[0].height, c = document.getElementById("c");
  c.width = cols * w; c.height = Math.ceil(imgs.length / cols) * h;
  const x = c.getContext("2d"); imgs.forEach((im, k) => x.drawImage(im, (k % cols) * w, Math.floor(k / cols) * h));
  return c.toDataURL("image/png").split(",")[1];
}, frames);
writeFileSync(join(SHOTS, "r11fix-render-sheet.png"), Buffer.from(out, "base64"));
console.log("sheet:", join(SHOTS, "r11fix-render-sheet.png"), "frames:", frames.length);
await g.context.close(); await browser.close();
finish("r11fix-render");
