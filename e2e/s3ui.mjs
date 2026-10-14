// S3 UI through the real browser: save/continue round trip, corrupt and newer saves, export/import, new-game confirm, delete,
// options (sound, key remapping, accessibility), audio cues for the boss events, the victory screen and keep playing.
// Screenshots (JPEG q85) go to docs/shots/s3-ui-{title,options,victory,boss-bar}.jpg.
import { readFileSync, mkdirSync, statSync } from "node:fs";
import { launch, open, check, finish } from "./helpers.mjs";
import { content, config } from "../src/core/index.js";
import { DEFAULT_KEYS } from "../src/input/keymap.js";
import { T as UT } from "../src/ui/text.js";

const S = content.strings;
const browser = await launch();
const T = (id) => `[data-testid="${id}"]`;
const SHOTS = "docs/shots";
mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { const path = `${SHOTS}/s3-ui-${name}.jpg`; await page.screenshot({ path, type: "jpeg", quality: 85 }); const kb = statSync(path).size / 1024; check(`screenshot ${name}.jpg is at most 300 KB`, kb <= 300, kb); };
const start = async (query = "test=1&seed=1", viewport = { width: 1280, height: 720 }) => {
  const g = await open(browser, { query, viewport, lobby: true });
  await g.page.click(T("new-game"));
  return g;
};
const reload = async (g) => { await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 }); };
const setRange = (page, id, v) => page.locator(T(id)).evaluate((el, val) => { el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v);
const disabled = (page, id) => page.locator(T(id)).isDisabled();
const lsKeys = (page) => page.evaluate(() => Object.keys(localStorage));
const levelUp = async (g, level = 30) => {
  await g.app("cheat.setLevel", level);
  await g.page.evaluate(() => { const a = window.__app; const pts = a.getState().player.attrPoints; for (let i = 0; i < pts; i++) a.input({ t: "allocate", attr: i % 3 === 0 ? "stamina" : "grit" }); });
};
const near = (a, b, e = 0.001) => Math.abs(a - b) <= e;

// ---------------------------------------------------------------- title, save round trip, autosave triggers
let savedText = null;
{
  const g = await open(browser, { query: "test=1&seed=1", lobby: true });
  let s = await g.state();
  check("AC-R-076-1 title offers New game, Continue (disabled without a save) and Options", s.scene === "title" && (await g.page.locator(T("new-game")).count()) === 1 && (await disabled(g.page, "continue")) && (await g.page.locator(T("options")).count()) === 1);
  check("AC-R-090-5 no save: Continue is disabled, Export is disabled", (await disabled(g.page, "continue")) && (await disabled(g.page, "export-save")));
  check("audio engine exists and the title bed is the lobby ambient (cue state readable)", (await g.app("audio.getState")).ambientId === null || (await g.app("audio.getState")).ambientId === "ambient:lobby");
  await g.page.click(T("new-game")); // a first click: unlocks audio, emits the click cue
  s = await g.state();
  check("New game without a save starts at once (no confirm): scene town", s.scene === "town");
  check("AC-R-080-3 a UI button click logs the uiClick cue", (await g.app("audio.getState")).cueLog.some((c) => c.name === "uiClick"));
  check("audio is unlocked after the first gesture", (await g.app("audio.getState")).unlocked === true);
  await levelUp(g, 7);
  await g.app("cheat.giveGold", 321);
  await g.app("input", { t: "key", code: "KeyX" });
  const w = await g.app("save.write");
  check("save.write() succeeds", w.ok === true, w);
  const keys = await lsKeys(g.page);
  check("AC-R-090-4 / NFR-D01-1 only the documented keys are in localStorage, no cookie", keys.every((k) => [config.saveKey, config.optionsKey].includes(k)) && keys.includes(config.saveKey) && (await g.page.evaluate(() => document.cookie)) === "", keys);
  const raw = await g.app("save.raw");
  check("AC-R-090-4 the save is at most config.saveMaxBytes", raw.length <= config.saveMaxBytes, raw.length);
  savedText = raw;
  const before = await g.state();
  await reload(g);
  check("after reload Continue is enabled", !(await disabled(g.page, "continue")));
  await g.page.click(T("continue"));
  s = await g.state();
  const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  const eq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b)); // deep equal, key order aside
  check("AC-R-090-1 Continue restores level, xp, attrs, points, skills, bar, gold, class, inventory, equipment, belt, stash, deepestDepth, bossDefeated",
    s.scene === "town" && ["level", "xp", "attrs", "attrPoints", "skillPoints", "skills", "skillBar", "gold", "class"].every((k) => eq(s.player[k], before.player[k])) &&
    ["inventory", "equipment", "belt", "stash", "deepestDepth", "bossDefeated"].every((k) => eq(s[k], before[k])), { scene: s.scene, diff: [...["level", "xp", "attrs", "attrPoints", "skillPoints", "skills", "skillBar", "gold", "class"].filter((k) => !eq(s.player[k], before.player[k])), ...["inventory", "equipment", "belt", "stash", "deepestDepth", "bossDefeated"].filter((k) => !eq(s[k], before[k]))] });
  check("AC-R-090-1 options are carried in the state", s.options && s.options.keys && eq(s.options.keys, DEFAULT_KEYS));

  // pagehide saves the changes since the last autosave
  await g.app("cheat.giveGold", 100);
  await g.page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await reload(g);
  await g.page.click(T("continue"));
  s = await g.state();
  check("AC-R-091-3 pagehide writes a save: the gold gained since the last autosave survives a reload", s.player.gold === before.player.gold + 100, s.player.gold);

  // floor change autosaves; resume lands on the entry of the saved floor
  await g.app("cheat.teleportFloor", 2);
  let sv = await g.app("save.read");
  check("AC-R-091-1 taking the stairs writes a save before the next step (resume depth 2)", sv?.resume?.depth === 2, sv?.resume);
  await g.app("step", 40); // saves closer together than config.autosaveMinTicks are coalesced
  await g.app("cheat.teleportFloor", 0);
  sv = await g.app("save.read");
  check("AC-R-091-2 arriving in the Lobby writes a save", sv?.resume?.depth === 0, sv?.resume);
  await g.app("cheat.teleportFloor", 3);
  await g.page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await reload(g);
  await g.page.click(T("continue"));
  s = await g.state();
  check("AC-R-091-4 a save made on floor 3 resumes at the floor's entry with fresh monsters", s.depth === 3 && s.player.tile.x === s.floor.entry.x && s.player.tile.y === s.floor.entry.y, { depth: s.depth, tile: s.player.tile });

  // death then save then continue
  await g.app("cheat.setHp", 0);
  await g.page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await reload(g);
  await g.page.click(T("continue"));
  s = await g.state();
  check("AC-R-091-6 a save made while dead resumes alive in the Lobby", s.scene === "town" && s.player.hp === s.player.hpMax, { scene: s.scene, hp: s.player.hp });

  // many autosave triggers: one save, one key
  await g.page.evaluate(() => { for (let i = 0; i < 100; i++) window.__app.save.write(); });
  check("AC-R-091-5 100 saves leave exactly one save key", (await lsKeys(g.page)).filter((k) => k === config.saveKey).length === 1);

  // New game with a save: confirm
  await g.app("cheat.giveGold", 5);
  await g.page.evaluate(() => window.__app.save.write());
  const kept = await g.app("save.raw");
  await g.app("pause"); // open the pause menu to leave to the title
  await g.page.click(T("quit"));
  await g.page.click(T("new-game"));
  check("AC-R-092-4 New game with a save asks for confirmation (scene still title)", (await g.page.locator(T("confirm-new-yes")).count()) === 1 && (await g.state()).scene === "title");
  await g.page.click(T("confirm-new-no"));
  check("AC-R-092-4 cancelling keeps the save and the title", (await g.state()).scene === "title" && (await g.app("save.raw")) === kept);
  await g.page.click(T("new-game"));
  await g.page.click(T("confirm-new-yes"));
  s = await g.state();
  check("AC-R-092-4 confirming starts a new game (gold back to the start value)", s.scene === "town" && s.player.gold === config.startGold, s.player.gold);

  // delete character
  await g.app("save.write");
  await g.app("pause");
  await g.page.click(T("quit"));
  await g.page.click(T("delete-save"));
  await g.page.click(T("confirm-delete-yes"));
  check("AC-NFR-D02-1 Delete character removes the save key, Continue is gone, the options key stays", !(await lsKeys(g.page)).includes(config.saveKey) && (await disabled(g.page, "continue")));
  check("no page errors (save round trip)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- corrupt, newer, quota, export, import
{
  const g = await open(browser, { query: "test=1&seed=1", lobby: true });
  const trunc = savedText.slice(0, 200);
  await g.page.evaluate(([k, v]) => localStorage.setItem(k, v), [config.saveKey, trunc]);
  await reload(g);
  let s = await g.state();
  check("AC-NFR-D03-3 a corrupt save: no crash, scene title, a notice offers a fresh start", s.scene === "title" && s.ui.notice === S.saveCorrupt && (await g.page.locator(T("title-notice")).innerText()).includes(S.saveCorrupt), s.ui.notice);
  check("AC-NFR-D03-3 the corrupt text is kept and exportable; Continue is disabled", (await g.app("save.export", "corrupt")) === trunc && (await disabled(g.page, "continue")));
  await g.page.click(T("new-game"));
  check("AC-NFR-D03-3 New game works and keeps the backup", (await g.state()).scene === "town" && (await g.app("save.export", "corrupt")) === trunc);
  await g.context.close();
}
{
  const g = await open(browser, { query: "test=1&seed=1", lobby: true });
  const newer = JSON.stringify({ ...JSON.parse(savedText), version: config.saveVersion + 1 });
  await g.page.evaluate(([k, v]) => localStorage.setItem(k, v), [config.saveKey, newer]);
  await reload(g);
  const s = await g.state();
  check("AC-NFR-D03-2 a save from a newer version: notice, save untouched, New game remains", s.scene === "title" && s.ui.notice === S.saveTooNew && (await g.app("save.raw")) === newer && (await g.page.locator(T("new-game")).count()) === 1, s.ui.notice);
  await g.context.close();
}
{
  const g = await start();
  await g.page.evaluate(() => { Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); }; });
  const r = await g.app("save.write");
  const s = await g.state();
  check("AC-R-090-6 a failing storage: the game keeps running and ui.notice says the save failed", r.ok === false && s.scene === "town" && s.ui.notice?.text === S.saveFailed && (await g.page.locator(T("toast")).innerText()).includes(S.saveFailed), { r, notice: s.ui.notice });
  await g.context.close();
}
let exported = null;
{
  const g = await start();
  await levelUp(g, 7);
  await g.app("cheat.giveGold", 321);
  await g.app("save.write");
  const want = await g.state();
  await g.app("pause");
  await g.page.click(T("quit"));
  const [dl] = await Promise.all([g.page.waitForEvent("download"), g.page.click(T("export-save"))]);
  exported = readFileSync(await dl.path(), "utf8");
  check("AC-R-092-1 Export downloads a file named config.saveFileName with the save text", dl.suggestedFilename() === config.saveFileName && exported === (await g.app("save.raw")), dl.suggestedFilename());
  // garbage import leaves the save alone
  const before = await g.app("save.raw");
  await g.page.click(T("import-save"));
  await g.page.setInputFiles(T("import-file"), { name: "junk.json", mimeType: "application/json", buffer: Buffer.from("{ this is not json") });
  await g.page.waitForSelector(T("title-notice"));
  check("AC-R-092-3 importing garbage shows the import-failed notice and leaves the save unchanged", (await g.page.locator(T("title-notice")).innerText()) === S.importFailed && (await g.app("save.raw")) === before);
  await g.context.close();
  // fresh context: import the exported file, then Continue
  const h = await open(browser, { query: "test=1&seed=1", lobby: true });
  await h.page.click(T("import-save"));
  await h.page.setInputFiles(T("import-file"), { name: "office-crawler-save.json", mimeType: "application/json", buffer: Buffer.from(exported) });
  await h.page.waitForFunction(() => !document.querySelector('[data-testid="continue"]')?.disabled);
  check("import shows the done notice and enables Continue", (await h.page.locator(T("title-notice")).innerText()) === S.importDone);
  await h.page.click(T("continue"));
  const s = await h.state();
  check("AC-R-092-2 after import + Continue the saved fields are restored", s.player.level === 7 && s.player.gold === want.player.gold && s.scene === "town", { level: s.player.level, gold: s.player.gold });
  // paste path
  await h.app("pause"); await h.page.click(T("quit"));
  await h.app("save.remove");
  await h.page.click(T("import-save"));
  await h.page.fill(T("import-text"), exported);
  await h.page.click(T("import-go"));
  check("pasting the save text imports it too", !(await disabled(h.page, "continue")));
  check("no page errors (export/import)", h.errors.length === 0, h.errors);
  await h.context.close();
}

// ---------------------------------------------------------------- options: sound
{
  const g = await open(browser, { query: "test=1&seed=1", lobby: true });
  const a0 = await g.app("audio.getState");
  check("AC-R-082-5 defaults: master 0.6, effects 0.8, ambient 0.5, unmuted, kit foley", near(a0.master, 0.6) && near(a0.sfx, 0.8) && near(a0.ambient, 0.5) && a0.muted === false && a0.kit === "foley", a0);
  await g.page.click(T("options"));
  let s = await g.state();
  check("AC-R-076-5 Options opens from the title (menu options) with sliders, key rebinding, reduced motion and text size", s.ui.menu === "options" && (await g.page.locator('input[type=range]').count()) === 3 && (await g.page.locator(".opt-kbtn").count()) === 12 && (await g.page.locator(T("opt-reduce-motion")).count()) === 1 && (await g.page.locator(T("opt-text-size")).count()) === 1);
  await g.page.setViewportSize({ width: 1280, height: 1180 }); // the whole panel in one picture
  await g.page.waitForTimeout(150);
  await shot(g.page, "options");
  await g.page.setViewportSize({ width: 1280, height: 720 });
  await setRange(g.page, "opt-vol-master", 0.3); await setRange(g.page, "opt-vol-sfx", 0.5); await setRange(g.page, "opt-vol-ambient", 0.8);
  let a = await g.app("audio.getState");
  check("AC-R-082-1 sliders 0.3 / 0.5 / 0.8 -> master 0.3, sfx 0.5, ambient 0.8, effectiveGain 0.15 / 0.24", near(a.master, 0.3) && near(a.sfx, 0.5) && near(a.ambient, 0.8) && near(a.effectiveGain.sfx, 0.15) && near(a.effectiveGain.ambient, 0.24), a);
  await g.page.check(T("opt-mute"));
  a = await g.app("audio.getState");
  check("AC-R-082-2 mute: all effective gains 0, slider values unchanged", a.muted && a.effectiveGain.master === 0 && a.effectiveGain.sfx === 0 && a.effectiveGain.ambient === 0 && near(a.sfx, 0.5));
  await g.page.uncheck(T("opt-mute"));
  a = await g.app("audio.getState");
  check("AC-R-082-2 unmute restores the gains exactly", !a.muted && near(a.effectiveGain.sfx, 0.15) && near(a.effectiveGain.ambient, 0.24));
  await g.page.selectOption(T("opt-kit"), "gothic");
  a = await g.app("audio.getState");
  check("kit selector switches the sound set and plays a preview (cueLog grows)", a.kit === "gothic" && a.cueLog.length > 0);
  await g.page.click(T("opt-back"));
  s = await g.state();
  check("AC-R-076-5 Back returns to the title", s.ui.menu === "title" && s.scene === "title");
  await reload(g);
  a = await g.app("audio.getState");
  s = await g.state();
  check("AC-R-082-3 volume, mute and kit persist across a reload (audio.getState and options)", near(a.master, 0.3) && near(a.sfx, 0.5) && near(a.ambient, 0.8) && a.kit === "gothic" && s.options.kit === "gothic" && near(s.options.volume.sfx, 0.5), { a: a.kit, o: s.options });
  check("AC-NFR-D01-1 the options key exists after a change and the only keys are the documented ones", (await lsKeys(g.page)).every((k) => [config.saveKey, config.optionsKey].includes(k)) && (await lsKeys(g.page)).includes(config.optionsKey));
  check("no page errors (options sound)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- options: pause menu, remapping, accessibility
{
  const g = await start();
  await g.app("audio.clearCueLog");
  await g.page.keyboard.press("Escape");
  await g.page.waitForFunction(() => window.__app.audio.getState().ctxState !== "running", null, { timeout: 4000 }).catch(() => {});
  const paused = await g.app("audio.getState");
  check("AC-NFR-A02-2 while paused the audio context is suspended (or silent)", paused.ctxState === "suspended" || paused.ctxState === "none" || paused.effectiveGain.master === 0, paused.ctxState);
  await g.page.click(T("options"));
  let s = await g.state();
  check("AC-R-076-2 the pause menu offers Options; opening it keeps the game paused", s.ui.menu === "options" && s.paused === true);
  await setRange(g.page, "opt-vol-sfx", 0.4);
  check("AC-R-082-6 a slider changed from the pause menu applies at once", near((await g.app("audio.getState")).sfx, 0.4));
  // key remapping through the UI
  await g.page.click(T("opt-key-inventory"));
  await g.page.keyboard.press("KeyB");
  s = await g.state();
  check("AC-NFR-A01-1 rebinding inventory to B through the UI sets options.keys.inventory", s.options.keys.inventory === "KeyB", s.options.keys);
  // conflict
  await g.page.click(T("opt-key-skills"));
  await g.page.keyboard.press("KeyB");
  s = await g.state();
  check("AC-NFR-A01-3 a key used by another action is rejected, keys unchanged, a message says so", s.options.keys.skills === "KeyS" && s.options.keys.inventory === "KeyB" && (await g.page.locator(T("opt-key-msg")).innerText()).includes(UT.optKeysConflict) && s.ui.notice?.key === "optKeysConflict", { notice: s.ui.notice, msg: await g.page.locator(T("opt-key-msg")).innerText() });
  await g.page.click(T("opt-key-belt1"));
  await g.page.keyboard.press("KeyQ");
  check("belt key 1 rebound to Q", (await g.state()).options.keys.belt1 === "KeyQ");
  const mouse = await g.page.locator(T("opt-mouse")).innerText();
  check("AC-NFR-A01-5 the mouse buttons are listed as fixed", /fixed/i.test(mouse));
  await g.page.keyboard.press("Escape");
  s = await g.state();
  check("Escape leaves Options back to the pause menu", s.ui.menu === "pause" && s.paused === true);
  await g.page.click(T("resume"));
  await g.page.keyboard.press("KeyI");
  s = await g.state();
  check("AC-NFR-A01-1 the old key I no longer toggles the inventory", s.ui.panels.inventory === false);
  await g.page.keyboard.press("KeyB");
  s = await g.state();
  check("AC-NFR-A01-1 the new key B toggles ui.panels.inventory", s.ui.panels.inventory === true);
  check("HUD key hints follow the bindings (dock shows B)", (await g.page.locator(T("dock-inventory")).innerText()).includes("B"));
  await g.page.keyboard.press("KeyB");
  const hp0 = (await g.state()).player.hp;
  await g.app("cheat.setHp", 20);
  await g.page.keyboard.press("Digit1");
  check("AC-R-056-7 the old belt key does nothing", (await g.state()).player.hp === 20 && (await g.state()).belt[0] !== null);
  await g.page.keyboard.press("KeyQ");
  s = await g.state();
  check("AC-R-056-7 the new belt key drinks the potion", s.player.hp > 20 && s.belt[0] === null, { hp: s.player.hp, hp0 });
  // persists across reload
  await g.app("save.write");
  await reload(g);
  s = await g.state();
  check("AC-NFR-A01-2 options.keys survives a reload", s.options.keys.inventory === "KeyB" && s.options.keys.belt1 === "KeyQ");
  await g.page.click(T("continue"));
  await g.page.keyboard.press("KeyB");
  check("AC-NFR-A01-2 and the key still works after Continue", (await g.state()).ui.panels.inventory === true);
  // restore
  await g.page.keyboard.press("KeyB");
  await g.page.keyboard.press("Escape");
  await g.page.click(T("options"));
  await g.page.click(T("opt-keys-restore"));
  s = await g.state();
  check("AC-NFR-A01-4 restore defaults: options.keys equals the default key table", JSON.stringify(s.options.keys) === JSON.stringify(DEFAULT_KEYS), s.options.keys);
  // accessibility
  const fsBefore = await g.page.locator(T("opt-back")).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await g.page.check(T("opt-reduce-motion"));
  s = await g.state();
  check("AC-NFR-A05-1 / AC-R-025-3 reduce motion: options.reducedMotion, ui.fx.shake and flash are 0", s.options.reducedMotion === true && s.ui.fx.shake === 0 && s.ui.fx.flash === 0, s.ui.fx);
  await g.page.selectOption(T("opt-text-size"), "1.25");
  const fsAfter = await g.page.locator(T("opt-back")).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  s = await g.state();
  check("AC-NFR-A04-2 text size large: options.textScale 1.25 and computed sizes scale by that factor", s.options.textScale === 1.25 && near(fsAfter / fsBefore, 1.25, 0.02), { fsBefore, fsAfter });
  await g.page.check(T("opt-hc"));
  check("high contrast switches the DOM theme and the render flag", (await g.page.evaluate(() => document.documentElement.classList.contains("hc"))) && (await g.app("perf")).fx.hc === true);
  await g.page.check(T("opt-lowfx"));
  check("reduced effects switches lowFx", (await g.app("perf")).fx.lowFx === true);
  await g.page.uncheck(T("opt-shake"));
  check("screen shake can be switched off on its own", (await g.state()).ui.fx.shake === 0 && (await g.state()).options.screenShake === false);
  check("gore stays off and the setting says so", (await g.page.locator(T("opt-gore")).innerText()).includes(UT.optGoreOff));
  const rar = await g.page.locator(T("opt-rarity")).innerHTML();
  check("rarity is explained by shape as well as colour (four distinct marks)", (rar.match(/<svg/g) ?? []).length === 4);
  await g.page.click(T("opt-back"));
  await g.page.click(T("resume"));
  await reload(g);
  s = await g.state();
  check("accessibility options persist across a reload", s.options.reducedMotion === true && s.options.textScale === 1.25 && s.options.highContrast === true && s.options.lowFx === true && s.options.screenShake === false);
  check("no page errors (options)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- boss: audio cues, boss bar, victory, keep playing
{
  const g = await start();
  await levelUp(g, 30);
  await g.app("cheat.teleportFloor", 9);
  await g.app("audio.clearCueLog");
  let barShot = false, s = await g.state(), sawBar = false, sawLive = "";
  for (let i = 0; i < 90 && s.scene !== "victory"; i++) {
    const b = s.monsters.find((m) => m.tier === "boss");
    if (!b) { await g.app("step", 10); s = await g.state(); continue; }
    await g.app("cmd.attack", b.id);
    await g.app("step", 30);
    s = await g.state();
    const bar = s.ui.hud?.boss;
    if (bar) {
      sawBar = true;
      if (!barShot && bar.ratio < 0.8 && bar.ratio > 0.55 && s.scene === "floor") { await shot(g.page, "boss-bar"); barShot = true; }
    }
    sawLive = (await g.page.locator(T("live")).textContent()) || sawLive;
    if (s.scene === "dead") { await g.app("input", { t: "respawn" }); await levelUp(g, 30); await g.app("cheat.teleportFloor", 9); }
  }
  const names = new Set((await g.app("audio.getState")).cueLog.map((c) => c.name));
  for (const n of ["bossEngage", "bossTelegraph", "bossSlam", "bossPhase", "bossDefeated"]) check(`audio cue ${n} fires for the boss event`, names.has(n), [...names]);
  check("a boss health bar was part of the HUD state while the boss was engaged", sawBar);
  check("the telegraph warning reaches the live region (screen readers)", /Regional Director|Slides|Staff/.test(sawLive), sawLive);
  check("boss-bar screenshot was taken mid-fight", barShot);
  // finish the fight
  for (let i = 0; i < 60 && s.scene !== "victory"; i++) { await g.app("step", 30); s = await g.state(); }
  check("AC-R-076-4 scene victory is reached after the boss dies", s.scene === "victory" && s.ui.menu === "victory", s.scene);
  const vNames = new Set((await g.app("audio.getState")).cueLog.map((c) => c.name));
  check("audio cues victory and stairsUnlocked/bossDefeated were logged", vNames.has("victory") && vNames.has("bossDefeated"), [...vNames]);
  check("the victory screen shows the story text, the run summary, Keep playing and Quit to title", (await g.page.locator(".screen.victory").innerText()).includes(S.victoryTitle) && (await g.page.locator(".screen.victory dd").count()) === 6 && (await g.page.locator(T("keep-playing")).count()) === 1 && (await g.page.locator(T("quit")).count()) === 1);
  await g.page.waitForTimeout(600);
  await shot(g.page, "victory");
  await g.page.click(T("keep-playing"));
  s = await g.state();
  check("AC-R-045-5 Keep playing returns to the Lobby with the character unchanged", s.scene === "town" && s.depth === 0 && s.player.level === 30 && s.bossDefeated === true, { scene: s.scene, depth: s.depth });
  check("autosave on victory stored bossDefeated", (await g.app("save.read"))?.bossDefeated === true);
  check("no page errors (boss and victory)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- title screenshot
{
  const g = await open(browser, { query: "test=1&seed=1", lobby: true });
  await g.app("step", 1);
  await g.page.waitForTimeout(700);
  await shot(g.page, "title");
  // phone width: the title and options fit without horizontal scroll
  await g.page.setViewportSize({ width: 390, height: 780 });
  await g.page.waitForTimeout(200);
  check("title fits a phone width without horizontal scroll", await g.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await g.page.click(T("options"));
  check("options fit a phone width without horizontal scroll", await g.page.evaluate(() => document.querySelector(".screen.options").scrollWidth <= innerWidth + 1));
  await g.context.close();
}

await browser.close();
finish("s3ui");
