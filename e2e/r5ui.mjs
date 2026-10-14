// R5 UI through the real browser: character creation (class selection, name, Start), play, quit and Continue in the right slot, five slots
// (full, replace with confirmation, delete, undo, rename), class per slot, the skill tree (learn, tooltips, respec, aura, bar assignment),
// phone layouts. Screenshots (JPEG q85) go to docs/shots/r5-ui-{charselect,charselect-390,tree-fm,tree-it,slots-options}.jpg.
import { mkdirSync, statSync, readFileSync } from "node:fs";
import { launch, open, check, finish, startNew, DIST } from "./helpers.mjs";
import { content } from "../src/core/index.js";

const browser = await launch();
const T = (id) => `[data-testid="${id}"]`;
const SHOTS = "docs/shots";
mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { const path = `${SHOTS}/r5-ui-${name}.jpg`; await page.screenshot({ path, type: "jpeg", quality: 85 }); const kb = statSync(path).size / 1024; check(`screenshot r5-ui-${name}.jpg is at most 300 KB`, kb <= 300, kb); };
const [FM, SR, IT] = content.classes;
const lobby = (viewport = { width: 1280, height: 720 }, query = "test=1&seed=1") => open(browser, { query, viewport, lobby: true });
const slotState = (page, n) => page.locator(T(`slot-${n}`)).getAttribute("data-state");
const slotName = (page, n) => page.locator(T(`slot-name-${n}`)).innerText();
const openLoad = async (page) => { await page.click(T("load-game")); await page.waitForSelector(T("slots-view")); };
const toTitle = async (g) => { await g.app("pause"); await g.page.click(T("quit")); };
const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll(".screen")].every((e) => e.scrollWidth <= innerWidth + 1));

// ---------------------------------------------------------------- class selection screen
{
  const g = await lobby();
  await g.page.click(T("new-game"));
  let s = await g.state();
  check("New game opens the class selection screen (menu create), nothing is started yet", s.ui.menu === "create" && s.scene === "title", s.ui.menu);
  check("three classes are offered as a radio group with the first one chosen", (await g.page.locator('[role=radio]').count()) === 3 && (await g.page.getAttribute(T(`class-${FM.id}`), "aria-checked")) === "true");
  const cards = await g.app("character.cards");
  check("the info panel shows the chosen class: name, role, four stat bars with numbers and three skill branches with their skills", (await g.page.locator(T("class-name")).innerText()) === FM.name && (await g.page.locator(".cs-stat").count()) === 4 && (await g.page.locator(`${T("class-branches")} li`).count()) === 3 && (await g.page.locator(T("class-branches")).innerText()).includes(cards[0].branches[0].skills[0].name));
  check("the health bar shows the real starting health of the class", (await g.page.locator(".cs-stat b").first().innerText()) === String(cards[0].derivedPreview.hp));
  check("Start is visibly unavailable without a name and says why", (await g.page.getAttribute(T("create-start"), "aria-disabled")) === "true" && (await g.page.locator(T("create-hint")).isVisible()) && /name/i.test(await g.page.locator(T("create-hint")).innerText()));
  await g.page.click(T("create-start"), { force: true }); // aria-disabled, not disabled: it can be pressed and then explains itself
  check("pressing Start without a name does not start: an error line names the rule and the field gets focus", (await g.state()).ui.menu === "create" && (await g.page.locator(T("create-error")).innerText()).length > 5 && (await g.page.evaluate(() => document.activeElement?.dataset?.testid)) === "create-name");
  await g.page.click(T(`class-${IT.id}`));
  check("clicking a class chooses it: aria-checked, the panel and the stat bars change", (await g.page.getAttribute(T(`class-${IT.id}`), "aria-checked")) === "true" && (await g.page.locator(T("class-name")).innerText()) === IT.name && (await g.page.locator(".cs-stat b").first().innerText()) === String(cards[2].derivedPreview.hp));
  await g.page.focus(T(`class-${IT.id}`));
  await g.page.keyboard.press("ArrowLeft");
  check("arrow keys move the choice (Left from IT Wizard is Sales Rep) and keep focus on the class", (await g.page.locator(T("class-name")).innerText()) === SR.name && (await g.page.evaluate(() => document.activeElement?.dataset?.testid)) === `class-${SR.id}`);
  await g.page.keyboard.press("3");
  check("the digit keys choose a class too", (await g.page.locator(T("class-name")).innerText()) === IT.name);
  await g.page.click(T("create-suggest"));
  const sug = await g.page.inputValue(T("create-name"));
  check("Suggest fills a valid name and enables Start", sug.length >= 3 && (await g.page.getAttribute(T("create-start"), "aria-disabled")) === "false");
  await g.page.fill(T("create-name"), "<b>x</b>");
  await g.page.click(T("create-start"), { force: true });
  check("a name with markup characters is refused and nothing starts", (await g.state()).ui.menu === "create");
  await g.page.fill(T("create-name"), "Pat Pending");
  await g.page.click(T(`class-${FM.id}`));
  await g.page.waitForTimeout(500);
  await shot(g.page, "charselect");
  // Escape and Back leave the screen without starting
  await g.page.click(T("create-load"));
  check("Load game opens the slot list over the class selection", (await g.state()).ui.menu === "slots");
  await g.page.keyboard.press("Escape");
  check("Esc closes the slot list, the typed name and class survive, focus is back on Load game", (await g.state()).ui.menu === "create" && (await g.page.inputValue(T("create-name"))) === "Pat Pending" && (await g.page.getAttribute(T(`class-${FM.id}`), "aria-checked")) === "true" && (await g.page.evaluate(() => document.activeElement?.dataset?.testid)) === "create-load");
  await g.page.click(T("create-start"));
  s = await g.state();
  check("Start creates the character: scene town, chosen class and name, its own start kit worn, the class signature on F1", s.scene === "town" && s.player.class === FM.id && s.player.name === "Pat Pending" && s.equipment.weapon?.base === FM.startKit.weapon && s.player.skillBar.hotkeys[0] === FM.signature, { cls: s.player.class });
  const list = await g.app("slots.list");
  check("the character is saved in slot 1, which is active and last used", list.slots[0].state === "ok" && list.slots[0].name === "Pat Pending" && list.slots[0].class === FM.id && list.active === 1 && list.last === 1, list);
  check("the Employee File shows the character name and class", await (async () => { await g.page.keyboard.press("KeyC"); const t = await g.page.locator(T("employee-file")).innerText(); await g.page.keyboard.press("KeyC"); return t.includes("Pat Pending") && t.includes(FM.name); })());
  // play, quit, Continue
  await g.app("cheat.setLevel", 6); await g.app("cheat.giveGold", 77);
  await g.app("step", 30);
  const before = await g.state();
  await toTitle(g);
  check("Continue names the character and class", /Pat Pending/.test(await g.page.locator(T("continue-who")).innerText()) && /Facilities/.test(await g.page.locator(T("continue-who")).innerText()));
  await g.page.click(T("continue"));
  s = await g.state();
  check("quit, then Continue lands in the same slot with the same character (level, gold, name, class)", s.player.name === "Pat Pending" && s.player.class === FM.id && s.player.level === 6 && s.player.gold === before.player.gold && (await g.app("slots.list")).active === 1, { level: s.player.level });
  check("no page errors (class selection)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- phone: class selection and slots fit without scroll
{
  const g = await lobby({ width: 390, height: 844 });
  await g.page.click(T("new-game"));
  await g.page.fill(T("create-name"), "Pat Pending");
  await g.page.waitForTimeout(500);
  const rects = await g.page.evaluate(() => Object.fromEntries(["class-facilities-manager", "class-it-wizard", "create-start", "create-load", "create-suggest"].map((id) => { const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(); const lb = document.querySelector(`[data-testid="${id}"] .lbl`)?.getBoundingClientRect(); return [id, { h: (lb ?? r).height, w: (lb ?? r).width, bottom: r.bottom }]; })));
  check("phone: no horizontal scroll, the class chips and Start are at least 44 px high, Start is on screen", (await hscroll(g.page)) && rects["class-facilities-manager"].h >= 44 && rects["class-it-wizard"].h >= 44 && rects["create-start"].h >= 44 && rects["create-start"].bottom <= 844, rects);
  await shot(g.page, "charselect-390");
  await g.page.click(T("create-load"));
  check("phone: the Load game dialog has a Close button in a sticky header and no horizontal scroll", (await g.page.locator(T("slots-close-x")).isVisible()) && (await hscroll(g.page)));
  await g.page.click(T("slots-close-x"));
  check("phone: closing the dialog returns to the class selection", (await g.state()).ui.menu === "create");
  check("no page errors (phone)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- five slots: class per slot, full, replace with confirmation, undo, delete, rename
{
  const g = await lobby({ width: 1280, height: 900 });
  const mk = (slot, cls, name) => g.app("character.create", { slot, class: cls, name });
  check("character.create starts a character in a slot", (await mk(1, FM.id, "Slot One")).ok === true);
  await g.app("cheat.setLevel", 4);
  await mk(2, SR.id, "Slot Two"); await g.app("cheat.setLevel", 5);
  await mk(3, IT.id, "Slot Three"); await g.app("cheat.setLevel", 6);
  await mk(4, SR.id, "Slot Four");
  await mk(5, FM.id, "Slot Five");
  const list = await g.app("slots.list");
  check("five characters fill the five slots; the running one (5) is active", list.slots.every((e) => e.state === "ok") && list.active === 5 && ["Slot One", "Slot Two", "Slot Three", "Slot Four", "Slot Five"].every((n, i) => list.slots[i].name === n), list.slots.map((e) => e.name));
  check("each slot keeps its own class and level", list.slots[0].class === FM.id && list.slots[1].class === SR.id && list.slots[2].class === IT.id && list.slots[1].level === 5 && list.slots[2].level === 6, list.slots.map((e) => [e.class, e.level]));
  await toTitle(g);
  await openLoad(g.page);
  check("the list shows all five with name, class and level; the most recent one is tagged", (await g.page.locator(".sl-card.ok").count()) === 5 && (await g.page.locator(".sl-tag", { hasText: "Most recent" }).count()) === 1 && /Sales Rep · Level 5/.test(await g.page.locator(T("slot-2")).innerText()));
  // class switch per slot: load another slot and check the class everywhere
  await g.page.click(T("slot-load-3"));
  let s = await g.state();
  check("class switch: loading slot 3 plays the IT Wizard (class, name, signature on F1, mana pool)", s.player.class === IT.id && s.player.name === "Slot Three" && s.player.skillBar.hotkeys[0] === IT.signature && s.player.mpMax > s.player.hpMax / 3 && (await g.app("slots.list")).active === 3);
  check("the HUD skill bar follows the class (F1 is the IT Wizard signature)", (await g.page.locator(T("hud-skill-0")).getAttribute("aria-label")).includes(content.skills[IT.signature].name));
  await g.app("pause"); await g.page.click(T("pause-slots"));
  check("from the pause menu the slot list opens; the playing slot cannot be deleted, replaced or imported over", (await g.state()).ui.menu === "slots" && (await g.page.locator(T("slot-delete-3")).isDisabled()) && (await g.page.locator(T("slot-new-3")).isDisabled()) && (await g.page.locator(T("slot-import-3")).isDisabled()));
  await g.page.click(T("slot-load-2"));
  s = await g.state();
  check("class switch from the pause menu: loading slot 2 saves slot 3 first and plays the Sales Rep", s.player.class === SR.id && s.player.name === "Slot Two" && s.ui.menu === null && (await g.app("slots.list")).slots[2].level === 6 && (await g.app("slots.list")).active === 2);
  // rename the playing character from the pause menu
  await g.app("pause"); await g.page.click(T("pause-slots"));
  await g.page.click(T("slot-rename-2"));
  await g.page.fill(T("slot-rename-input"), "Renamed Rep");
  await g.page.keyboard.press("Enter");
  s = await g.state();
  const raw2 = await g.app("slots.raw", 2);
  check("rename: the slot, the saved text and the running character all carry the new name, the level is untouched", (await slotName(g.page, 2)).includes("Renamed Rep") && s.player.name === "Renamed Rep" && raw2.includes("Renamed Rep") && JSON.parse(raw2).player.level === 5, { card: await slotName(g.page, 2), name: s.player.name, lvl: JSON.parse(raw2).player?.level });
  await g.page.click(T("slot-rename-4"));
  await g.page.fill(T("slot-rename-input"), "<img src=x>");
  await g.page.keyboard.press("Enter");
  check("rename refuses a name with markup characters and keeps the old one", (await g.page.locator(T("slot-rename-error")).innerText()).length > 5 && (await g.app("slots.list")).slots[3].name === "Slot Four");
  await g.page.keyboard.press("Escape"); // closes the rename form
  await g.page.keyboard.press("Escape"); // closes the slot list: back on the pause menu
  await g.page.click(T("quit"));
  // all five full: Start asks for a slot to replace
  await g.page.click(T("new-game"));
  check("all slots full: the screen says so", /full/i.test(await g.page.locator(T("create-slot-note")).innerText()));
  await g.page.fill(T("create-name"), "Newcomer");
  await g.page.click(T(`class-${IT.id}`));
  await g.page.click(T("create-start"));
  check("all slots full: Start opens the slot list instead of overwriting anything", (await g.state()).ui.menu === "slots" && (await g.app("slots.list")).slots.every((e) => e.state === "ok"));
  const old5 = await g.app("slots.raw", 5);
  await g.page.click(T("slot-new-5"));
  check("choosing a slot to replace goes back to the class selection for that slot", (await g.state()).ui.menu === "create" && /slot 5/i.test(await g.page.locator(T("create-slot-note")).innerText()) && (await g.page.inputValue(T("create-name"))) === "Newcomer");
  await g.page.click(T("create-start"));
  check("replacing asks first and names the character that goes", /Slot Five/.test(await g.page.locator(T("create-confirm-title")).innerText()) && (await g.app("slots.raw", 5)) === old5);
  await g.page.click(T("create-confirm-yes"));
  s = await g.state();
  check("confirm: the new IT Wizard lives in slot 5, the old character is kept once for undo", s.player.name === "Newcomer" && s.player.class === IT.id && (await g.app("slots.list")).active === 5 && (await g.app("slots.keys")).includes("office-crawler.slot.5.prev"));
  await g.app("save.write");
  await toTitle(g);
  await openLoad(g.page);
  check("the replaced slot offers Undo replace", (await g.page.locator(T("slot-undo-5")).count()) === 1);
  await g.page.click(T("slot-undo-5"));
  check("undo replace brings Slot Five back (class and name)", (await slotName(g.page, 5)).includes("Slot Five") && JSON.parse(await g.app("slots.raw", 5)).name === "Slot Five" && JSON.parse(await g.app("slots.raw", 5)).class === FM.id);
  // delete with confirmation, then undo
  const old4 = await g.app("slots.raw", 4);
  await g.page.click(T("slot-delete-4"));
  check("delete asks first and names the character, nothing is removed yet", /Slot Four/.test(await g.page.locator(T("slot-confirm-title")).innerText()) && (await g.app("slots.raw", 4)) === old4);
  await g.page.click(T("slot-confirm-no"));
  check("cancel keeps the character", (await slotState(g.page, 4)) === "ok" && (await g.app("slots.raw", 4)) === old4);
  await g.page.click(T("slot-delete-4"));
  await g.page.click(T("slot-confirm-yes"));
  check("confirm deletes slot 4; the other four stay", (await slotState(g.page, 4)) === "empty" && (await g.app("slots.raw", 4)) === null && (await slotState(g.page, 3)) === "ok");
  await g.page.click(T("slot-undo-4"));
  check("Undo delete restores slot 4 exactly", (await slotState(g.page, 4)) === "ok" && (await g.app("slots.raw", 4)) === old4);
  // Options hold the slots too (customer wish), same actions
  await g.page.keyboard.press("Escape");
  await g.page.click(T("options"));
  check("the Options menu has a Save slots section with the same five slots", (await g.page.locator(".opt-slots .sl-card").count()) === 5 && (await g.page.locator(`.opt-slots ${T("slot-load-1")}`).count()) === 1);
  await g.page.click(T("slot-load-1"));
  s = await g.state();
  check("loading from the Options menu starts that character and closes the menu", s.scene === "town" && s.player.name === "Slot One" && s.ui.menu === null && (await g.app("slots.list")).active === 1);
  check("no page errors (slots)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- slots screenshot in Options (three characters, one playing)
{
  const g = await lobby({ width: 1280, height: 1300 });
  await g.app("character.create", { slot: 1, class: FM.id, name: "Pat Pending" }); await g.app("cheat.setLevel", 14); await g.app("save.write");
  await g.app("character.create", { slot: 2, class: IT.id, name: "Sir Reboot" }); await g.app("cheat.setLevel", 9); await g.app("save.write");
  await g.app("character.create", { slot: 3, class: SR.id, name: "Max Quarterly" }); await g.app("cheat.setLevel", 5); await g.app("save.write");
  await g.app("pause");
  await g.page.click(T("options"));
  await g.page.evaluate(() => document.querySelector(".opt-slots")?.scrollIntoView());
  await g.page.waitForTimeout(250);
  await g.page.evaluate(() => { const o = document.querySelector(".screen.options"); if (o) o.scrollTop = 0; });
  await shot(g.page, "slots-options");
  await g.context.close();
}

// ---------------------------------------------------------------- skill tree: learn, tooltips, respec, aura, bar assignment
async function treeScenario(cls, level, shotName) {
  const g = await lobby({ width: 1280, height: 720 });
  await g.app("character.create", { slot: 1, class: cls.id, name: "Tree Tester" });
  await g.app("cheat.setLevel", level);
  await g.page.keyboard.press("KeyS");
  let s = await g.state();
  const tv = await g.app("tree.get");
  check(`${cls.name}: [S] opens the tree with three branches, ten skills, the class signature learned and the points shown`, s.ui.panels.skills === true && (await g.page.locator(".branch").count()) === 3 && (await g.page.locator(".tnode").count()) === 10 && tv.branches.length === 3 && (await g.page.textContent(T("skill-points"))) === String(s.player.skillPoints) && s.player.skills[cls.signature] === 1);
  check(`${cls.name}: [K] closes it again (K is the alias of S)`, await (async () => { await g.page.keyboard.press("KeyK"); const closed = (await g.state()).ui.panels.skills === false; await g.page.keyboard.press("KeyK"); return closed; })());
  const states = await g.page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".tnode")].map((n) => [n.dataset.testid.replace("skill-", ""), n.dataset.state])));
  check(`${cls.name}: every node carries a state and the lock reason is text, not only colour`, Object.values(states).every((x) => ["learned", "available", "locked-level", "locked-prereq", "maxed", "no-points"].includes(x)) && (await g.page.locator(".tnode .tn-st").allInnerTexts()).every((t) => t.trim().length > 2));
  // pick an available active skill and learn it
  const nodes = tv.branches.flatMap((b) => b.nodes);
  const cand = nodes.find((n) => n.kind === "active" && n.state === "available");
  const prereq = nodes.find((n) => n.requires.length && n.state !== "learned");
  await g.page.hover(T(`node-${cand.id}`));
  s = await g.state();
  const tip = await g.page.locator("#tip").innerText();
  check(`${cls.name}: hovering a skill shows a tooltip with the per-level numbers now and at the next level`, s.ui.tooltip?.key === `node:${cand.id}` && /next level/i.test(tip) && /Mana/.test(tip) && /Level 0 \/ \d/.test(tip), tip.slice(0, 200));
  await g.page.mouse.move(5, 5);
  const p0 = s.player.skillPoints;
  await g.page.click(T(`learn-${cand.id}`));
  s = await g.state();
  check(`${cls.name}: Learn spends one point; the skill is learned at level 1 and lands on a free bar slot`, s.player.skills[cand.id] === 1 && s.player.skillPoints === p0 - 1 && s.player.skillBar.hotkeys.includes(cand.id), { id: cand.id });
  await g.page.click(T(`learn-${cand.id}`));
  s = await g.state();
  check(`${cls.name}: a second click raises it to level 2 (level-up inside the tree), the panel shows 2`, s.player.skills[cand.id] === 2 && (await g.page.textContent(T(`level-${cand.id}`))) === "2");
  await g.page.hover(T(`node-${cand.id}`));
  const tip2 = await g.page.locator("#tip").innerText();
  check(`${cls.name}: a learned skill's tooltip lists the numbers at its current level and at the next one`, /now \(level 2\)/i.test(tip2) && /next level \(3\)/i.test(tip2) && /Damage|Heal|Absorb|Allies|Duration|Radius/.test(tip2), tip2.slice(0, 250));
  await g.page.mouse.move(5, 5);
  await g.page.click(T(`assign-${cand.id}-3`));
  check(`${cls.name}: the F4 button in the tree assigns the skill to the bar`, (await g.state()).player.skillBar.hotkeys[3] === cand.id && (await g.page.locator(T("hud-skill-3")).getAttribute("aria-label")).includes(cand.name));
  if (prereq) {
    const lock = await g.page.locator(T(`node-${prereq.id}`)).getAttribute("aria-label");
    check(`${cls.name}: a locked skill says what it needs (${prereq.id})`, prereq.state.startsWith("locked") ? /Needs/.test(lock) : true, lock);
  }
  await g.page.mouse.move(5, 5);
  await g.page.evaluate(() => document.querySelector("#pleft .pb")?.scrollTo(0, 0));
  await g.page.waitForTimeout(150);
  await shot(g.page, shotName);
  // respec only in the Lobby
  const spent = (await g.state()).player;
  check(`${cls.name}: Respec is available in the Lobby`, !(await g.page.locator(T("respec")).isDisabled()));
  await g.page.click(T("respec"));
  s = await g.state();
  const total = Object.entries(spent.skills).reduce((n, [id, l]) => n + (id === cls.signature ? l - 1 : l), 0) + spent.skillPoints;
  check(`${cls.name}: Respec returns every point (${total}), keeps the signature at level 1 and clears the learned skill from the bar`, s.player.skillPoints === total && s.player.skills[cls.signature] === 1 && !s.player.skills[cand.id] && !s.player.skillBar.hotkeys.includes(cand.id), { sp: s.player.skillPoints, total });
  await g.app("cheat.teleportFloor", 1);
  check(`${cls.name}: outside the Lobby the Respec button is disabled and the note says where it works`, (await g.page.locator(T("respec")).isDisabled()) && /Lobby/.test(await g.page.locator(T("respec-note")).innerText()));
  const rr = await g.app("tree.respec");
  check(`${cls.name}: the core refuses it too (not-in-town)`, rr.ok === false && rr.error === "not-in-town", rr);
  check(`no page errors (tree ${cls.id})`, g.errors.length === 0, g.errors);
  await g.context.close();
}
await treeScenario(FM, 20, "tree-fm");
await treeScenario(IT, 20, "tree-it");

// aura toggle and the tree on a phone
{
  const g = await lobby({ width: 390, height: 844 });
  await g.app("character.create", { slot: 1, class: FM.id, name: "Aura Tester" });
  await g.app("cheat.setLevel", 12);
  await g.app("input", { t: "learnSkill", id: "dress-code" }).catch(() => {});
  const r = await g.app("input", { t: "learnSkill", id: "fire-drill" });
  await g.page.keyboard.press("KeyS");
  await g.app("step", 1);
  check("phone: the skill tree fits the width and the Learn buttons are at least 44 px", (await hscroll(g.page)) && (await g.page.locator(T("learn-pallet-slam")).boundingBox()).height >= 44);
  if (r.ok) {
    await g.page.locator(T("aura-fire-drill")).scrollIntoViewIfNeeded();
    await g.page.click(T("aura-fire-drill"));
    let s = await g.state();
    check("the aura toggle in the tree switches the aura on (player.aura) and reserves mana", s.player.aura === "fire-drill" && (await g.page.getAttribute(T("aura-fire-drill"), "aria-pressed")) === "true");
    await g.page.click(T("aura-fire-drill"));
    s = await g.state();
    check("and off again", s.player.aura === null);
  } else check("the aura skill could be learned at level 12 (prerequisites met)", false, r);
  check("no page errors (aura, phone tree)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- migration: the old single-slot save becomes slot 1, with a notice
{
  const v1 = readFileSync("test/fixtures/save-v1.json", "utf8");
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await context.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await context.addInitScript((text) => { if (!localStorage.getItem("office-crawler.slots") && !localStorage.getItem("office-crawler.save")) localStorage.setItem("office-crawler.save", text); }, v1);
  await page.goto(`${DIST}?test=1&seed=1&start=town`);
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const g = { page, errors, context, app: (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]), state: () => page.evaluate(() => window.__app.getState()) };
  const list = await g.app("slots.list");
  check("migration: the old single-slot save is slot 1, a Facilities Manager (the Clerk), the old key stays as a backup", list.slots[0].state === "ok" && list.slots[0].class === FM.id && list.last === 1 && (await g.page.evaluate(() => localStorage.getItem("office-crawler.save"))) !== null, list.slots[0]);
  const notice = await g.page.locator(T("title-notice")).innerText();
  check("migration: the title shows a notice with the number of refunded skill points", /Facilities Manager/.test(notice) && /\d+ skill points/.test(notice), notice);
  check("migration: Continue is enabled and opens the migrated character", !(await g.page.locator(T("continue")).isDisabled()));
  await g.page.click(T("continue"));
  const s = await g.state();
  check("migration: the migrated character plays (class model, a name, skill points to spend)", s.player.class === FM.id && typeof s.player.name === "string" && s.player.name.length > 0 && s.player.skillPoints > 0 && (await g.app("slots.list")).active === 1, { name: s.player.name, sp: s.player.skillPoints });
  check("no page errors (migration)", g.errors.length === 0, g.errors);
  await g.context.close();
}

await browser.close();
finish("r5ui");
