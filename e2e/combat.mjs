// Gameplay through the real input path: move, hold, attack, kill, death, restart, pause.
import { launch, open, check, finish, freeTilesNear, tileScreen, SHOTS } from "./helpers.mjs";

const browser = await launch();
const g = await open(browser, { query: "test=1&seed=1" });
const { app, state, page } = g;
const SEED = 1;

// ---- move by real mouse click ----
await page.click('[data-testid="new-game"]');
let s = await app("step", 1);
const T = freeTilesNear(s, s.player.tile, 6, 4)[0];
const p = tileScreen(s.ui.camera, T.x, T.y);
await page.mouse.click(p.x, p.y);
s = await state();
const len = s.player.path.length;
check("AC-R-005-1 click sets a path ending on the clicked tile", len > 0 && s.player.path.at(-1).x === T.x && s.player.path.at(-1).y === T.y);
s = await app("step", len * s.config.moveTicksPerTile + 2);
check("AC-R-005-1 player arrives on the tile after path-length x moveTicksPerTile", s.player.tile.x === T.x && s.player.tile.y === T.y, { tile: s.player.tile, T });
await page.screenshot({ path: `${SHOTS}/move.png` });

// ---- hold to keep moving ----
s = await app("newGame", { seed: SEED });
const far = freeTilesNear(s, s.player.tile, 9, 6);
const A2 = far[0], B2 = far.find((t) => Math.abs(t.x - A2.x) + Math.abs(t.y - A2.y) >= 4) ?? far.at(-1);
const pa = tileScreen(s.ui.camera, A2.x, A2.y);
await page.mouse.move(pa.x, pa.y); await page.mouse.down();
await app("step", 5);
let h = await state();
check("AC-R-005-6 holding the button keeps it down (mouse.down true) with the path set", h.input.mouse.down && h.player.path.length + (h.player.next ? 1 : 0) > 0);
const pb = tileScreen(h.ui.camera, B2.x, B2.y);
await page.mouse.move(pb.x, pb.y, { steps: 3 });
await app("step", 3);
h = await state();
check("AC-R-005-6 the destination follows the held cursor", h.input.mouse.applied.x === B2.x && h.input.mouse.applied.y === B2.y, { applied: h.input.mouse.applied, B2 });
await page.mouse.up();
h = await state();
check("releasing the button clears mouse.down", h.input.mouse.down === false);

// ---- attack and kill via click on the monster's sprite ----
s = await app("newGame", { seed: SEED });
const spot = freeTilesNear(s, s.player.tile, 6, 3)[0];
const sp = await app("cheat.spawnMonster", "zombie-intern", spot);
s = await app("step", 1);
const ms = tileScreen(s.ui.camera, spot.x, spot.y);
await page.mouse.click(ms.x, ms.y - 24); // on the body, above the feet
s = await state();
check("AC-R-005-2 clicking a monster sprite targets it (player.target = monster id)", s.player.target === sp.id, { target: s.player.target });
let killed = false, hpMin = s.player.hp;
for (let i = 0; i < 400 && !killed && s.scene === "floor"; i++) {
  s = await app("step", 10);
  hpMin = Math.min(hpMin, s.player.hp);
  killed = s.eventLog.some((e) => e.type === "kill" && e.target === sp.id);
}
const mon = s.monsters.find((m) => m.id === sp.id);
check("AC-R-021-x the targeted monster is killed exactly once and awards XP", killed && (!mon || mon.ai === "dead") && s.eventLog.filter((e) => e.type === "kill" && e.target === sp.id).length === 1 && s.player.xp > 0, { killed, xp: s.player.xp });
check("the hero survived the single zombie", s.player.hp > 0 && s.scene === "floor", s.player.hp);
await app("step", 80);
s = await state();
check("AC-R-020-3 the dead monster is removed after its death animation", !s.monsters.some((m) => m.id === sp.id));

// ---- pause ----
s = await app("newGame", { seed: SEED });
const pz = freeTilesNear(s, s.player.tile, 6, 4)[0];
await app("cheat.spawnMonster", "printer-imp", pz);
await app("step", 40);
const before = await state();
const paused = await app("key", "Escape");
const pauseState = await state();
check("AC-NFR-A02-1 key('Escape') sets paused and shows the pause menu", paused.ok && pauseState.paused === true && pauseState.ui.menu === "pause");
check("AC-R-076-2 pause menu offers Resume and Quit to title", (await page.locator('[data-testid="resume"]').textContent()) === "Resume" && (await page.locator('[data-testid="quit"]').textContent()) === "Quit to title");
await app("step", 100);
const frozen = await state();
check("AC-NFR-A02-1 step(100) while paused changes neither tick, monster tiles nor hp", frozen.tick === before.tick && frozen.player.hp === before.player.hp && JSON.stringify(frozen.monsters.map((m) => m.tile)) === JSON.stringify(before.monsters.map((m) => m.tile)));
await page.waitForFunction(() => getComputedStyle(document.querySelector(".screen")).opacity === "1");
await page.screenshot({ path: `${SHOTS}/pause.png` });
const pathBefore = JSON.stringify(frozen.player.path);
await page.mouse.click(300, 300); // lands on the overlay, not the canvas
const behind = await state();
check("AC-R-076-7 a click behind the modal does not move the player", JSON.stringify(behind.player.path) === pathBefore && behind.input.mouse.down === false);
const hookClick = await app("clickTile", pz.x, pz.y);
check("hook click while paused is refused", hookClick.ok === false);
await page.click('[data-testid="resume"]');
s = await state();
check("AC-R-076-2 Resume clears the menu and unpauses", s.paused === false && s.ui.menu === null && (await page.locator(".screen").count()) === 0);
s = await app("step", 5);
check("the simulation advances after resume", s.tick === before.tick + 5);
await page.keyboard.press("Escape");
check("real Escape key pauses too", (await state()).paused === true);
await page.click('[data-testid="quit"]');
s = await state();
check("AC-R-076-2 Quit to title gives scene title", s.scene === "title" && s.ui.menu === "title");

// ---- death and restart ----
await page.click('[data-testid="new-game"]');
s = await state();
const h0 = (await app("newGame", { seed: SEED })).hash;
s = await state();
const ring = freeTilesNear(s, s.player.tile, 3, 1).slice(0, 7);
for (const t of ring) await app("cheat.spawnMonster", "zombie-intern", t);
let died = null;
for (let i = 0; i < 700 && !died; i++) { s = await app("step", 10); if (s.scene === "dead") died = s; }
check("AC-R-023-1 the hero can die: scene dead, hp 0 in the same snapshot", !!died && died.player.hp === 0, died && died.player.hp);
check("AC-R-070-4 hud ratio is exactly 0 at hp 0", died.ui.hud.health.ratio === 0);
check("AC-R-076-3 game-over screen with a Restart control", died.ui.menu === "dead" && (await page.locator('[data-testid="restart"]').textContent()) === "Restart");
await page.waitForFunction(() => getComputedStyle(document.querySelector(".screen")).opacity === "1");
await page.screenshot({ path: `${SHOTS}/dead.png` });
const tickDead = died.tick, again = await app("step", 50);
check("nothing advances while dead", again.tick === tickDead && again.scene === "dead");
await app("key", "Escape");
check("Escape does not open the pause menu while dead", (await state()).paused === false);
await page.click('[data-testid="restart"]');
s = await state();
check("AC-R-023-2/-3 Restart starts a fresh run of the same seed (hash equals a new game, tick 0, full hp)", s.scene === "floor" && s.tick === 0 && s.player.hp === s.player.hpMax && s.hash === h0 && s.ui.menu === null, { scene: s.scene, tick: s.tick });
check("no page errors", g.errors.length === 0, g.errors);
check("AC-NFR-O02-1 every request is file: or data:", g.requests.every((u) => /^(file|data|blob):/.test(u)), g.requests);
await g.context.close();
await browser.close();
finish("combat");
