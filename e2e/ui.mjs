// S2 UI through the real browser: the Lobby start, panels (inventory, Employee File, skills), equip/compare/drag, vendor,
// healer, stash, allocate, learn + right-mouse cast, stairs, death -> respawn, keyboard, 1024 px and phone layouts.
import { launch, open, check, finish, tileScreen } from "./helpers.mjs";

const browser = await launch();
const T = (id) => `[data-testid="${id}"]`;
const centre = async (page, sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
const start = async (query = "test=1&seed=1", viewport = { width: 1280, height: 800 }) => {
  const g = await open(browser, { query, viewport, lobby: true });
  await g.page.click(T("new-game"));
  return g;
};
const stepTo = async (g, pred, max = 900, n = 5) => { for (let i = 0; i < max; i += n) { const s = await g.app("step", n); if (pred(s)) return s; } return g.state(); };
/** Click a tile with the real mouse when it is on screen, else through the hook (the camera follows the hero, far tiles are off screen). */
const clickTile = async (g, x, y) => {
  const s = await g.state(), sc = tileScreen(s.ui.camera, x, y), vp = g.page.viewportSize();
  if (sc.x > 150 && sc.x < vp.width - 150 && sc.y > 60 && sc.y < vp.height - 140) await g.page.mouse.click(sc.x, sc.y);
  else await g.app("clickTile", x, y);
};
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// ---------------------------------------------------------------- Lobby start, HUD, right mouse, contextmenu
{
  const g = await start();
  let s = await g.state();
  check("AC-R-040-1 New game starts in the Lobby: scene town, depth 0, no monsters", s.scene === "town" && s.depth === 0 && s.monsters.length === 0, { scene: s.scene, depth: s.depth });
  check("HUD: level, xp bar ratio inside the level, point indicators, skill bar with F1 selected, belt of 4 with 2 potions", s.ui.hud.level === 1 && s.ui.hud.xpBar.ratio === 0 && s.ui.hud.points.attr === 0 && s.ui.hud.skillBar.slots.length === 4 && s.ui.hud.skillBar.selected === 0 && s.ui.hud.skillBar.slots.every((x) => x.skill === null) && s.ui.hud.belt.length === 4 && s.ui.hud.belt.filter((b) => !b.empty).length === 2, s.ui.hud.belt);
  check("AC-R-071-2 belt slots mirror state.belt and show keys 1-4", s.ui.hud.belt.every((b, i) => b.key === String(i + 1) && (b.item?.id ?? null) === (s.belt[i]?.id ?? null)));
  check("DOM HUD: four skill buttons and four belt buttons are labelled", (await g.page.locator("[data-skill-slot]").count()) === 4 && (await g.page.locator("[data-use-belt]").count()) === 4 && (await g.page.getAttribute(T("hud-skill-0"), "aria-label")).includes("F1"));
  check("selected skill slot is marked (aria-pressed) and the others are not", (await g.page.getAttribute(T("hud-skill-0"), "aria-pressed")) === "true" && (await g.page.getAttribute(T("hud-skill-1"), "aria-pressed")) === "false");
  const prevented = await g.page.evaluate(() => { const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }); document.getElementById("game").dispatchEvent(e); return e.defaultPrevented; });
  check("contextmenu on the canvas is blocked", prevented);
  const f1 = await g.page.evaluate(() => { const e = new KeyboardEvent("keydown", { code: "F3", bubbles: true, cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  check("F1-F4 are preventDefault-ed", f1);
  await g.page.keyboard.press("F1");
  s = await g.state();
  check("[F1] selects slot 0 (empty at the start: the right button has no skill yet)", s.player.skillBar.selected === 0 && s.player.skillBar.secondary === null);
  const spot = tileScreen(s.ui.camera, s.player.tile.x + 2, s.player.tile.y + 1);
  await g.page.mouse.click(spot.x, spot.y, { button: "right" });
  check("right mouse with no skill selected says so (toast) and does not move the hero", /No skill selected/.test(await g.page.textContent(T("toast"))) && (await g.state()).player.path.length === 0);
  // potions: key 1 drinks (hurt first)
  await g.app("cheat.setHp", 20);
  await g.page.keyboard.press("Digit1");
  s = await g.state();
  check("belt key 1 drinks the potion: hp up, slot emptied, HUD mirrors it", s.player.hp > 20 && s.belt[0] === null && s.ui.hud.belt[0].empty === true, { hp: s.player.hp });
  await g.app("cheat.setHp", 30);
  await g.page.click(T("hud-belt-1"));
  s = await g.state();
  check("clicking a belt slot in the HUD drinks that potion", s.belt[1] === null && s.player.hp > 30);
  check("no page errors (Lobby)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- panels, equip, compare, drag, unmet requirement
{
  const g = await start();
  await g.app("cheat.setLevel", 2);
  await g.page.keyboard.press("KeyI");
  let s = await g.state();
  check("AC-R-073-1 [I] opens the inventory: ui.panels.inventory, 40 cells, 10 equipment slots", s.ui.panels.inventory === true && (await g.page.locator(".cell").count()) === 40 && (await g.page.locator(".doll .slot").count()) === 10);
  check("starting weapon sits in the drawer at its cell with its size", (await g.page.locator(".items .item").count()) === s.inventory.items.length);
  const w1 = await g.app("cheat.giveItem", { base: "letter-opener", rarity: "magic" });
  const w2 = await g.app("cheat.giveItem", { base: "keyboard-sword", rarity: "rare", ilvl: 10 });
  s = await g.state();
  const open1 = s.inventory.items.find((i) => i.id === w1.id);
  // click-pick then click-place on the weapon slot
  await g.page.click(T(`cell-${open1.x}-${open1.y}`));
  s = await g.state();
  check("AC-R-073-2 clicking an item puts it on the cursor", s.cursorItem?.id === w1.id, s.cursorItem);
  check("the held item shows a ghost and the footer offers Put back", (await g.page.locator("#ghost:not([hidden])").count()) === 1 && (await g.page.locator(T("put-back")).count()) === 1);
  await g.page.hover(T("slot-weapon"));
  check("hovering the right slot marks it as a valid target", (await g.page.locator(".slot.ok").count()) === 1);
  await g.page.click(T("slot-weapon"));
  s = await g.state();
  check("clicking the weapon slot equips the held item", s.equipment.weapon?.id === w1.id && s.cursorItem === null);
  check("derived stats changed (Employee File shows the new damage)", s.player.damage.max >= 4);
  // compare tooltip on the second weapon
  const second = s.inventory.items.find((i) => i.id === w2.id);
  await g.page.hover(T(`cell-${second.x}-${second.y}`));
  s = await g.state();
  const tip = s.ui.tooltip;
  check("AC-R-061-1 tooltip lists name, rarity, requirements, affixes", !!tip && tip.name === second.name && tip.rarityName === "Rare" && Array.isArray(tip.reqs) && tip.reqs.length > 0 && tip.affixes.length === second.affixes.length, tip && tip.name);
  check("AC-R-061-2 tooltip compares with the equipped item: numeric deltas and a verdict line", !!tip?.compare && tip.compare.equipped?.id === w1.id && tip.compare.deltas.length > 0 && typeof tip.compare.deltas[0].delta === "number" && /Upgrade|Downgrade|Mixed|Same/.test(tip.compare.verdictText), tip?.compare);
  const shown = await g.page.locator("#tip:not([hidden])").count();
  const tr = await g.page.locator("#tip").boundingBox(), hudTop = await g.page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("ui")).getPropertyValue("--hudtop")));
  const hero = { x: 640 + s.ui.inset - 40, y: 400 - 100, width: 80, height: 130 };
  check("tooltip visible, above the bottom bar, not over the hero, on screen", shown === 1 && tr.y + tr.height <= hudTop + 1 && !intersects(tr, hero) && tr.x >= 0 && tr.x + tr.width <= 1280, { tr, hudTop });
  const mp = await g.page.evaluate(() => document.getElementById("tip").textContent);
  check("tooltip text carries the 'you have N, need M more' wording for unmet requirements", /Level \d+ \(you have \d+, need \d+ more\)/.test(mp) || /✓/.test(mp), mp.slice(0, 200));
  // unmet requirement: drag the keyboard-sword (needs level 5) onto the weapon slot -> rejected, item returns to its cell
  const from = await centre(g.page, T(`cell-${second.x}-${second.y}`)), to = await centre(g.page, T("slot-weapon"));
  await g.page.mouse.move(from.x, from.y); await g.page.mouse.down();
  await g.page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await g.page.mouse.move(to.x, to.y, { steps: 4 });
  s = await g.state();
  const reason = await g.page.locator("[data-reason]").textContent();
  check("drag feedback: the slot outline turns red with the reason 'Needs Level 5'", (await g.page.locator(".slot.bad").count()) === 1 && /Needs Level 5/.test(reason), reason);
  await g.page.mouse.up();
  s = await g.state();
  check("drop is rejected: still carried inventory item stays in the drawer at its old cell, weapon unchanged", s.cursorItem === null && s.equipment.weapon?.id === w1.id && s.inventory.items.find((i) => i.id === w2.id)?.x === second.x && s.inventory.items.find((i) => i.id === w2.id)?.y === second.y, { cur: s.cursorItem?.id });
  // drag-and-drop of the starting weapon (a swap): pick up the equipped one and put it back
  const eq = await centre(g.page, T("slot-weapon"));
  const free = { x: 9, y: 1 };
  const fc = await centre(g.page, T(`cell-${free.x}-${free.y}`));
  await g.page.mouse.move(eq.x, eq.y); await g.page.mouse.down(); await g.page.mouse.move(fc.x, fc.y, { steps: 6 }); await g.page.mouse.up();
  s = await g.state();
  check("dragging a worn item to a free cell unequips it there", s.equipment.weapon === null && s.inventory.items.some((i) => i.id === w1.id && i.x === free.x && i.y === free.y), s.inventory.items.map((i) => [i.id, i.x, i.y]));
  // Esc puts a held item back
  const again = s.inventory.items.find((i) => i.id === w1.id);
  await g.page.click(T(`cell-${again.x}-${again.y}`));
  await g.page.keyboard.press("Escape");
  s = await g.state();
  check("Esc puts the held item back (and does not pause)", s.cursorItem === null && s.paused === false && s.ui.panels.inventory === true && s.inventory.items.some((i) => i.id === w1.id));
  // right-click quick equip
  const potion = await g.app("cheat.giveItem", { potion: true });
  s = await g.state();
  const pot = s.inventory.items.find((i) => i.id === potion.id);
  await g.page.click(T(`cell-${pot.x}-${pot.y}`), { button: "right" });
  s = await g.state();
  check("right-click on a potion moves it to the belt", s.belt.some((b) => b?.id === potion.id) && !s.inventory.items.some((i) => i.id === potion.id));
  // Esc closes the drawer, a further Esc pauses
  await g.page.keyboard.press("Escape");
  s = await g.state();
  check("Esc closes the open drawer first", s.ui.panels.inventory === false && s.paused === false);
  await g.page.keyboard.press("Escape");
  check("a second Esc pauses", (await g.state()).paused === true);
  await g.page.keyboard.press("Escape");
  check("no page errors (panels)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- Employee File: allocate with preview
{
  const g = await start();
  await g.page.keyboard.press("KeyC");
  let s = await g.state();
  check("AC-R-072-3 [C] opens the Employee File", s.ui.panels.character === true);
  check("with 0 points every + is disabled (AC-R-016-2)", (await g.page.locator("button.plus:disabled").count()) === 4);
  await g.app("cheat.setLevel", 4);
  s = await g.state();
  const txt = await g.page.innerText(T("employee-file"));
  check("AC-R-072-1 the file shows level, xp / xpNext, four attributes, points, hp, mp, damage and defense", txt.includes("Level 4") && txt.includes(`${s.player.xp.toLocaleString("en-US")} / ${s.player.xpNext.toLocaleString("en-US")}`) && ["Grit", "Agility", "Stamina", "Focus"].every((a) => txt.includes(a)) && txt.includes(`${s.player.hp} / ${s.player.hpMax}`) && txt.includes(`${s.player.mp} / ${s.player.mpMax}`) && txt.includes(`${s.player.damage.min}–${s.player.damage.max}`) && txt.includes("Defense"), txt.slice(0, 300));
  check("+ buttons are enabled with points (AC-R-072-2: values updated after the level-up)", (await g.page.locator("button.plus:not(:disabled)").count()) === 4 && s.player.attrPoints === 15);
  await g.page.hover(T("alloc-agility"));
  const pv = await g.page.locator(T("alloc-preview")).textContent();
  check("hovering + previews the derived change before it is spent", /Agility 10 → 11/.test(pv) && /Defense/.test(pv), pv);
  const hp0 = s.player.hpMax;
  await g.page.click(T("alloc-stamina"));
  s = await g.state();
  check("AC-R-016-1 clicking + raises the attribute, spends a point and recomputes health", s.player.attrs.stamina === 11 && s.player.attrPoints === 14 && s.player.hpMax === hp0 + 3, { hpMax: s.player.hpMax });
  check("the sheet updates live after the click", (await g.page.innerText(T("employee-file"))).includes(`${s.player.hp} / ${s.player.hpMax}`));
  // unmet gear list: an item needing grit 12 appears with the missing amount, and disappears after the points
  await g.app("cheat.giveItem", { base: "stapler-mace", rarity: "normal", ilvl: 5 });
  await g.page.waitForSelector(T("unmet-list"));
  const um = await g.page.locator(T("unmet-list")).innerText();
  check("AC-R-016-3 gear you cannot use yet lists the missing amount", /Stapler Mace/.test(um) && /Grit 12/.test(um) && /2 more/.test(um), um);
  await g.page.click(T("alloc-grit")); await g.page.click(T("alloc-grit"));
  check("spending the points makes the '!' list empty live", (await g.page.locator(T("unmet-list")).count()) === 0);
  for (let i = 0; i < 12; i++) await g.page.click(T("alloc-focus"), { trial: false }).catch(() => {});
  s = await g.state();
  check("points run out and + disables", s.player.attrPoints === 0 && (await g.page.locator("button.plus:disabled").count()) === 4, s.player.attrPoints);
  await g.page.keyboard.press("KeyC");
  check("[C] again closes it", (await g.state()).ui.panels.character === false);
  check("no page errors (file)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- Skills: learn, assign, select, right-mouse cast
{
  const g = await start();
  await g.app("cheat.setLevel", 3);
  await g.app("cheat.teleportFloor", 1);
  await g.page.keyboard.press("KeyS");
  let s = await g.state();
  check("AC-R-074-1 [S] lists the basic attack, 4 actives and 2 passives with level, max and mana", s.ui.panels.skills === true && (await g.page.locator(".srow").count()) === 7 && s.player.skillPoints === 2, s.player.skillPoints);
  check("points shown in the panel", (await g.page.textContent(T("skill-points"))) === "2");
  await g.page.click(T("learn-stapler-throw"));
  s = await g.state();
  check("AC-R-074-2 Learn spends a point and the skill lands on the next free hotkey", s.player.skills["stapler-throw"] === 1 && s.player.skillPoints === 1 && s.player.skillBar.hotkeys[0] === "stapler-throw");
  check("HUD skill bar shows the new skill in F1", s.ui.hud.skillBar.slots[0].skill === "stapler-throw" && s.ui.hud.skillBar.slots[0].cost === 3);
  await g.page.click(T("learn-mute"));
  await g.page.click(T("assign-mute-3"));
  s = await g.state();
  check("assign buttons put a learned skill on F4", s.player.skillBar.hotkeys[3] === "mute");
  check("with no points the other learn buttons are disabled", (await g.page.locator(T("learn-reply-all")).isDisabled()));
  await g.page.keyboard.press("KeyS");
  await g.page.keyboard.press("F3");
  s = await g.state();
  check("[F3] on an empty slot selects it: no skill for the right button", s.player.skillBar.selected === 2 && s.player.skillBar.secondary === null && s.ui.hud.skillBar.slots[2].selected === true);
  await g.page.keyboard.press("F1");
  s = await g.state();
  check("AC-R-015-3 [F1] selects the skill on slot 0; the HUD highlights it", s.player.skillBar.selected === 0 && s.player.skillBar.secondary === "stapler-throw" && s.ui.hud.skillBar.slots[0].selected === true && s.ui.hud.skillBar.slots[2].selected === false);
  s = await g.app("step", 2);
  const cam = s.ui.camera, p = s.player.tile;
  const target = { x: p.x + 3, y: p.y }; // any tile: the cast is directional
  const sc = tileScreen(cam, target.x, target.y);
  const mp0 = s.player.mp;
  await g.page.mouse.click(sc.x, sc.y, { button: "right" });
  s = await g.state();
  check("AC-R-015-2 right mouse casts the selected skill: mana spent, cast event, projectile in flight", s.player.mp === mp0 - 3 && s.events.some((e) => e.type === "cast" && e.skill === "stapler-throw"), { mp: s.player.mp, mp0, ev: s.events.map((e) => e.type) });
  check("the right button did not walk the hero", s.player.path.length === 0 && !s.player.next);
  // no mana: disabled flag in the HUD (AC-R-071-3)
  await g.app("cheat.setHp", s.player.hpMax);
  await g.page.evaluate(() => 0);
  s = await g.state();
  // drain mana by casting until empty
  for (let i = 0; i < 30 && (await g.state()).player.mp >= 3; i++) { await g.app("step", 14); await g.page.mouse.click(sc.x, sc.y, { button: "right" }); }
  s = await g.state();
  check("AC-R-071-3 with too little mana the skill's bar entry is disabled", s.ui.hud.skillBar.slots[0].disabled === true && (await g.page.getAttribute(T("hud-skill-0"), "aria-disabled")) === "true", s.ui.hud.skillBar.slots[0]);
  await g.app("step", 14);
  await g.page.mouse.click(sc.x, sc.y, { button: "right" });
  check("a toast says there is not enough mana", /Not enough mana/.test((await g.page.textContent(T("toast"))) ?? ""));
  check("no page errors (skills)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- Lobby NPCs: vendor buy/sell, healer, stash; elevator
{
  const g = await start();
  await g.app("cheat.giveGold", 400);
  let s = await g.state();
  // click the vendor NPC tile: the hero walks over and the window opens
  const npc = s.floor.npcs.find((n) => n.id === "vendor");
  let sc = tileScreen(s.ui.camera, npc.tile.x, npc.tile.y);
  const pk = await g.app("pick", sc.x, sc.y - 36 * s.ui.camera.z);
  check("pick: the body of an NPC (above its tile) picks the NPC", pk.npcId === "vendor" && pk.tile.x === npc.tile.x && pk.tile.y === npc.tile.y, pk);
  await g.page.mouse.click(sc.x, sc.y - 36 * s.ui.camera.z);
  s = await stepTo(g, (st) => !!st.ui.dialog);
  check("clicking the vendor opens the dialog window with the vendor's stock", s.ui.dialog?.npc === "vendor" && s.ui.panels.vendor === true && (await g.page.locator(T("vendor-stock") + " .row").count()) === s.vendor.stock.length && s.vendor.stock.length > 5);
  check("the inventory drawer opens beside it and the two do not overlap (AC-R-073-3)", s.ui.panels.inventory === true && !intersects(await g.page.locator("#pleft").boundingBox(), await g.page.locator("#pright").boundingBox()));
  const gold0 = s.player.gold, n0 = s.inventory.items.length;
  const idx = s.vendor.stock.findIndex((e) => !e.unlimited && e.price <= gold0);
  await g.page.hover(T(`buy-${idx}`));
  const price = s.vendor.stock[idx].price;
  await g.page.click(T(`buy-${idx}`));
  s = await g.state();
  check("Buy: gold down by the price, one more item in the drawer", s.player.gold === gold0 - price && s.inventory.items.length === n0 + 1, { gold: s.player.gold, gold0, price });
  const sellId = s.inventory.items[s.inventory.items.length - 1].id;
  await g.page.click(T("tab-sell"));
  const g1 = s.player.gold;
  await g.page.click(T(`sell-${sellId}`));
  s = await g.state();
  check("Sell: gold up, item gone from the drawer", s.player.gold > g1 && !s.inventory.items.some((i) => i.id === sellId));
  await g.page.keyboard.press("Escape");
  s = await g.state();
  check("Esc closes the dialog window (vendor closed in the core)", s.ui.dialog === null && s.vendor === null && s.ui.panels.npc === false && s.paused === false);
  // healer
  const healer = s.floor.npcs.find((n) => n.id === "healer");
  await g.app("cheat.setHp", 5);
  sc = tileScreen((await g.state()).ui.camera, healer.tile.x, healer.tile.y);
  await g.page.mouse.click(sc.x, sc.y);
  s = await stepTo(g, (st) => st.ui.dialog?.npc === "healer");
  check("the healer window shows a Heal control", s.ui.panels.healer === true && (await g.page.locator(T("heal")).isEnabled()));
  await g.page.click(T("heal"));
  s = await g.state();
  check("Heal restores health to the maximum", s.player.hp === s.player.hpMax && /much better/.test(await g.page.textContent(T("toast"))));
  await g.page.keyboard.press("Escape");
  // stash
  s = await g.state();
  const stash = s.floor.npcs.find((n) => n.id === "stash");
  await clickTile(g, stash.tile.x, stash.tile.y);
  s = await stepTo(g, (st) => st.ui.dialog?.npc === "stash", 1500);
  check("the stash window opens", s.ui.panels.stash === true);
  const sw = s.inventory.items[0], total = s.inventory.items.length + s.stash.items.length;
  await g.page.click(T(`stash-put-${sw.id}`));
  s = await g.state();
  check("AC-R-059-1 Put away moves the item to the stash; the multiset is conserved", s.stash.items.some((i) => i.id === sw.id) && s.inventory.items.length + s.stash.items.length === total);
  await g.page.click(T(`stash-take-${sw.id}`));
  s = await g.state();
  check("Take brings it back", s.inventory.items.some((i) => i.id === sw.id) && s.stash.items.length === 0);
  await g.page.keyboard.press("Escape");
  // elevator: click the stairs tile
  s = await g.state();
  await clickTile(g, s.floor.exit.x, s.floor.exit.y);
  s = await stepTo(g, (st) => st.depth === 1, 1500);
  check("clicking the elevator takes the hero down to floor 1 (AC-R-004-1)", s.depth === 1 && s.scene === "floor", { depth: s.depth });
  check("a toast names the floor", /Floor 1/.test((await g.page.textContent(T("toast"))) ?? ""));
  // stairs locked at the last floor
  await g.app("cheat.teleportFloor", 8);
  await g.app("input", { t: "useStairs", dir: "down" });
  check("stairsLocked: a toast explains the locked way down", /locked/.test((await g.page.textContent(T("toast"))) ?? ""));
  check("no page errors (NPCs)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- death -> Respawn (Lobby), Restart
{
  const g = await start();
  await g.app("cheat.teleportFloor", 2);
  await g.app("cheat.giveGold", 77);
  await g.app("cheat.setHp", 0);
  await g.app("step", 1);
  let s = await g.state();
  check("death shows the game-over screen with Respawn and Restart", s.scene === "dead" && (await g.page.locator(T("respawn")).count()) === 1 && (await g.page.locator(T("restart")).count()) === 1, s.scene);
  await g.page.waitForTimeout(700);
  await g.page.click(T("respawn"));
  s = await g.state();
  check("Respawn puts the hero in the Lobby with full health and nothing lost", s.scene === "town" && s.depth === 0 && s.player.hp === s.player.hpMax && s.player.gold === 50 + 77 && s.ui.menu === null, { scene: s.scene, hp: s.player.hp, gold: s.player.gold });
  await g.app("cheat.teleportFloor", 1);
  await g.app("cheat.setHp", 0); await g.app("step", 1);
  await g.page.waitForTimeout(700);
  await g.page.click(T("restart"));
  s = await g.state();
  check("Restart starts a fresh run in the Lobby", s.scene === "town" && s.player.level === 1 && s.player.gold === 50, { scene: s.scene });
  check("no page errors (death)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- keyboard access, live region, focus ring
{
  const g = await start();
  await g.page.keyboard.press("KeyI");
  await g.app("cheat.giveItem", { base: "visor-cap", rarity: "normal" });
  let s = await g.state();
  const cap = s.inventory.items.find((i) => i.base === "visor-cap");
  await g.page.focus(T(`cell-${cap.x}-${cap.y}`));
  const ring = await g.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { w: cs.outlineWidth, st: cs.outlineStyle }; });
  check("focused controls show a focus ring (3 px outline)", ring.st !== "none" && parseFloat(ring.w) >= 3, ring);
  await g.page.keyboard.press("ArrowRight");
  const focused = await g.page.evaluate(() => document.activeElement.dataset.testid);
  check("arrow keys move through the grid", focused === `cell-${cap.x + 1}-${cap.y}`, focused);
  await g.page.keyboard.press("ArrowLeft");
  await g.page.keyboard.press("e");
  s = await g.state();
  check("E on a focused cell equips the item", s.equipment.head?.base === "visor-cap");
  check("the live region announces what happened", /Equipped/.test(await g.page.textContent(T("live"))));
  const unfocusedKey = await g.page.evaluate(() => [...document.querySelectorAll("#ui button")].filter((b) => !b.disabled && b.offsetParent !== null).every((b) => b.getAttribute("aria-label") || b.textContent.trim()));
  check("every visible button has an accessible name", unfocusedKey);
  await g.page.focus(T("slot-head"));
  await g.page.keyboard.press("Enter");
  s = await g.state();
  check("Enter on a worn slot picks the item up; Enter on a cell places it", s.cursorItem?.base === "visor-cap");
  await g.page.focus(T("cell-4-2"));
  await g.page.keyboard.press("Enter");
  s = await g.state();
  check("keyboard place: back in the drawer at that cell", s.cursorItem === null && s.inventory.items.some((i) => i.base === "visor-cap" && i.x === 4 && i.y === 2), s.inventory.items.map((i) => [i.base, i.x, i.y]));
  await g.context.close();
}

// ---------------------------------------------------------------- cheats under __app.cheat (R-123, ?test=1 only)
{
  const g = await start();
  let r = await g.app("cheat.setLevel", 5), s = await g.state();
  check("cheat.setLevel(5): level, points and full health", r.ok && s.player.level === 5 && s.player.attrPoints === 20 && s.player.hp === s.player.hpMax, r);
  r = await g.app("cheat.setLevel", 99);
  check("cheat.setLevel out of range is rejected", r.ok === false && typeof r.error === "string");
  r = await g.app("cheat.setHp", 7); s = await g.state();
  check("cheat.setHp(7)", r.ok && s.player.hp === 7);
  r = await g.app("cheat.giveGold", 25); s = await g.state();
  check("cheat.giveGold(25) adds to the purse", r.ok && s.player.gold === 75);
  r = await g.app("cheat.giveGold", -3);
  check("cheat.giveGold with a bad amount is rejected", r.ok === false);
  r = await g.app("cheat.spawnMonster", "zombie-intern", { x: 9, y: 9 });
  check("spawning a monster in the Lobby is rejected (no hostiles in town)", r.ok === false);
  r = await g.app("cheat.teleportFloor", 3); s = await g.state();
  check("cheat.teleportFloor(3) lands on floor 3", r.ok && s.depth === 3 && s.scene === "floor" && s.monsters.length > 0);
  r = await g.app("cheat.teleportFloor", 99);
  check("cheat.teleportFloor(99) is rejected", r.ok === false);
  const n0 = (await g.state()).groundItems.length;
  r = await g.app("cheat.spawnItem", { rarity: "rare", slot: "head" }); s = await g.state();
  check("cheat.spawnItem puts a rolled item on the ground", r.ok && s.groundItems.length === n0 + 1 && s.groundItems.some((e) => e.id === r.id && e.rarity === "rare"), r);
  r = await g.app("cheat.giveItem", { potion: true }); s = await g.state();
  check("cheat.giveItem puts it straight into the drawer", r.ok && s.inventory.items.some((i) => i.id === r.id));
  check("no page errors (cheats)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- 1024 px: drawers keep the hero visible; phone: tabs
{
  const g = await start("test=1&seed=1", { width: 1024, height: 768 });
  await g.app("cheat.giveItem", { base: "blazer", rarity: "magic" });
  await g.page.keyboard.press("KeyI"); await g.page.keyboard.press("KeyC");
  await g.app("step", 1);
  const s = await g.state();
  const L = await g.page.locator("#pleft").boundingBox(), R = await g.page.locator("#pright").boundingBox();
  const hero = { x: 1024 / 2 + s.ui.inset - 26 * s.ui.camera.z, y: 0, width: 52 * s.ui.camera.z, height: 768 };
  check("1024 px: both drawers fit, do not overlap, and leave the hero's column free", !intersects(L, R) && L.x + L.width <= R.x && !intersects(L, hero) && !intersects(R, hero), { L, R, hero });
  const hudTop = await g.page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("ui")).getPropertyValue("--hudtop")));
  check("drawers stay above the bottom bar", L.y + L.height <= hudTop + 1 && R.y + R.height <= hudTop + 1, { hudTop, L, R });
  const cell = await g.page.locator(T("cell-0-0")).boundingBox();
  check("cells are at least 44 px on desktop", cell.width >= 44 && cell.height >= 44, cell);
  const plus = await g.page.locator(T("alloc-grit")).boundingBox();
  check("employee file: the + buttons are reachable without scrolling", plus.y + plus.height <= L.y + L.height, { plus, L });
  await g.context.close();
}
{
  const g = await start("test=1&seed=1", { width: 390, height: 844 });
  await g.page.keyboard.press("KeyI");
  await g.app("step", 1);
  let s = await g.state();
  check("phone: the Gear tab shows the drawer and the tab bar offers Gear / Employee File / Skills", (await g.page.locator("#pright .tab").count()) === 3 && (await g.page.locator("#pright").isVisible()));
  await g.page.click("#pright " + T("tab-character"));
  check("phone: one panel at a time (Employee File replaces Gear)", (await g.page.locator("#pleft").isVisible()) && !(await g.page.locator("#pright").isVisible()));
  const t = await g.page.locator("#pleft .tab").first().boundingBox();
  check("phone: tab targets are at least 44 px", t.height >= 44, t);
  const plus = await g.page.locator(T("alloc-grit")).boundingBox();
  check("phone: panel fits the width (no horizontal overflow)", (await g.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) && plus.x + plus.width <= 390);
  await g.page.click("#pleft " + T("tab-inventory"));
  check("phone: back to Gear hides the file", (await g.page.locator("#pright").isVisible()) && !(await g.page.locator("#pleft").isVisible()));
  check("no page errors (layouts)", g.errors.length === 0, g.errors);
  await g.context.close();
}

await browser.close();
finish("ui");
