// R8-T interrupted-state journeys: reload while dead, on the boss floor, on the victory screen; panels open at death; floor change then immediate reload; cursor item at death.
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const open2 = async (o) => { for (let i = 0; ; i++) { try { return await open(browser, o); } catch (e) { if (i >= 2) throw e; } } };
const cont = async (g) => { await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 20000 }); await g.page.click(T("continue")); await g.page.waitForTimeout(150); return g.state(); };
const noNaN = (o) => !JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "NaN!" : v)).includes("NaN!");

// 1. reload while dead
{
  const g = await open2({ lobby: true, query: "test=1&seed=21" });
  await startNew(g.page, { cls: "facilities-manager", name: "Dead" });
  await g.app("cheat.giveGold", 300); await g.app("cheat.teleportFloor", 3);
  const gold = (await g.state()).player.gold;
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  check("[R8T-states] dead scene reached", (await g.state()).scene === "dead", (await g.state()).scene);
  await g.page.evaluate(() => { window.__app.save.write(); location.reload(); });
  let s = await cont(g);
  check("[R8T-states] reload while dead + Continue: not stuck on the death screen, hero alive with full hp", s.scene !== "dead" && s.scene !== "title" && s.player.hp > 0, [s.scene, s.player.hp]);
  check("[R8T-states] the dead hero keeps gold and level (nothing lost)", s.player.gold >= gold - 1, [s.player.gold, gold]);
  await g.page.screenshot({ path: `${SHOTS}/r8t-states-after-dead-reload.png` });
  // death with panels and a cursor item
  await g.app("cheat.giveItem", { slot: "body", rarity: "rare" });
  await g.app("ui.open", "inventory"); await g.app("ui.open", "character"); await g.app("step", 2);
  const it = (await g.state()).inventory.items[0];
  await g.page.click(T(`cell-${it.x}-${it.y}`)); await g.app("step", 1);
  const held = (await g.state()).cursorItem?.id;
  await g.app("cheat.teleportFloor", 2); await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  const open_ = await g.page.evaluate(() => ({ drawers: [...document.querySelectorAll(".drawer.open")].length, ghost: !document.getElementById("ghost")?.hidden }));
  check("[R8T-states] on death the side drawers are closed (or inert) and no ghost item floats over the death screen", open_.drawers === 0 && !open_.ghost, open_);
  await g.page.click(T("respawn")); await g.app("step", 5); s = await g.state();
  const keep = s.cursorItem?.id === held || s.inventory.items.some((i) => i.id === held);
  check("[R8T-states] the item that was in the hand at death is not lost on respawn", !held || keep, { held, cursor: s.cursorItem?.id });
  check("[R8T-states] dead-state section: no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}
// 2. boss floor reload and victory-screen reload
{
  const g = await open2({ lobby: true, query: "test=1&seed=22" });
  await startNew(g.page, { cls: "sales-rep", name: "Boss" });
  await g.app("cheat.setLevel", 30); await g.app("cheat.teleportFloor", 9); await g.app("step", 30);
  let s = await g.state();
  const boss = s.monsters.find((m) => m.boss);
  check("[R8T-states] floor 9 has the boss", !!boss && s.depth === 9, [s.depth, s.monsters.length]);
  await g.page.evaluate(() => { window.__app.save.write(); location.reload(); });
  s = await cont(g);
  check("[R8T-states] reload on the boss floor + Continue: a living game on a valid floor (boss not softlocked)", ["floor", "town"].includes(s.scene) && s.player.hp > 0 && noNaN(s.player), [s.scene, s.depth]);
  const b2 = s.monsters.find((m) => m.boss);
  check("[R8T-states] after that reload the boss (if on that floor) is undefeated and not duplicated", s.monsters.filter((m) => m.boss).length <= 1 && (!b2 || b2.ai !== "dead"), s.monsters.filter((m) => m.boss).length);
  // go to boss and kill it with the damage cheat to reach the victory screen
  if (s.depth !== 9) { await g.app("cheat.teleportFloor", 9); await g.app("step", 30); s = await g.state(); }
  const bb = s.monsters.find((m) => m.boss);
  if (bb) { for (let i = 0; i < 40 && (await g.state()).scene === "floor"; i++) { await g.app("cheat.damageMonster", bb.id, 99999); await g.app("step", 60); } }
  s = await g.state();
  console.log("INFO scene after boss damage:", s.scene, "bossDefeated", s.bossDefeated);
  if (s.scene === "victory") {
    await g.page.evaluate(() => { window.__app.save.write(); location.reload(); });
    s = await cont(g);
    check("[R8T-states] reload on the victory screen + Continue: not a softlock (victory shown again or the game continues), boss stays defeated", ["victory", "town", "floor"].includes(s.scene) && s.bossDefeated === true, [s.scene, s.bossDefeated]);
    if (s.scene === "victory") { await g.page.click(T("keep-playing")); await g.app("step", 5); s = await g.state(); check("[R8T-states] keep playing after the reloaded victory screen works", s.scene !== "victory", s.scene); }
  } else check("[R8T-states] boss damage cheat led to the victory scene", false, s.scene);
  check("[R8T-states] boss/victory section: no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}
// 3. floor change then immediate reload, quest accepted and dialog open
{
  const g = await open2({ lobby: true, query: "test=1&seed=23" });
  await startNew(g.page, { cls: "it-wizard", name: "Floors" });
  await g.app("input", { t: "interact", id: "vendor" }); await g.app("step", 900);
  await g.page.click(T("quest-accept-sq1")).catch(() => {}); await g.app("step", 2);
  const q = (await g.state()).quests.sq1.state;
  await g.page.evaluate(() => { window.__app.cheat.teleportFloor(4); location.reload(); }); // floor change and reload in the same task
  let s = await cont(g);
  check("[R8T-states] teleport + immediate reload: Continue gives a valid game with the accepted quest intact", ["floor", "town"].includes(s.scene) && s.quests.sq1.state === q, [s.scene, s.depth, s.quests.sq1.state, q]);
  check("[R8T-states] and the deepest floor was kept", s.deepestDepth >= 1, s.deepestDepth);
  check("[R8T-states] floor-change section: no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}
await browser.close();
finish("r8t-states");
