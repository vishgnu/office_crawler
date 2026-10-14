import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { T } from "../src/ui/text.js";
import { content, newGame } from "../src/core/index.js";
import { messageFor } from "../src/ui/messages.js";
import { panelFor, preventsDefault, PANEL_KEYS } from "../src/input/keys.js";

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
const ui = files("src").filter((f) => /^src\/(ui|input)\/|^src\/(game|main)\.js$|^src\/render\/hud\.js$/.test(f.replaceAll("\\", "/")) && f.endsWith(".js"));

test("every UI string id (T.x) used in UI code exists in the UI string table, and every entry is non-empty", () => {
  for (const f of ui) for (const m of readFileSync(f, "utf8").matchAll(/\bT\.(\w+)/g)) assert.ok(m[1] in T, `${f}: T.${m[1]} is missing`);
  const walk = (o, path) => { for (const [k, v] of Object.entries(o)) { if (typeof v === "string") assert.ok(v.length > 0, `${path}${k} is empty`); else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, `${path}${k}.`); } };
  walk(T, "T.");
});

test("panels.js has no visible text literals outside the tables (AC-R-102-2)", () => {
  const code = readFileSync("src/ui/panels.js", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  // text between tags in template literals must come from ${...}; allow only symbols and numbers as literal tag content
  for (const m of code.matchAll(/<[a-z][^<>`]*>([^<>${}`]*[A-Za-z]{3}[^<>${}`]*)</g)) assert.fail(`panels.js: literal text "${m[1]}"`);
});

test("UI text and item names carry no denylisted IP terms", () => {
  const terms = readFileSync("docs/product/ip-denylist.txt", "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
  const blob = JSON.stringify(T).toLowerCase();
  for (const t of terms) assert.ok(!new RegExp(`(^|[^a-z])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(blob), `T contains "${t}"`);
});

test("keys: I, C, S and K open panels; F1-F4 are default-prevented; digits are not", () => {
  assert.deepEqual(Object.keys(PANEL_KEYS).sort(), ["KeyC", "KeyI", "KeyJ", "KeyK", "KeyM", "KeyS", "Tab"]);
  assert.equal(panelFor("KeyI"), "inventory"); assert.equal(panelFor("KeyC"), "character"); assert.equal(panelFor("KeyS"), "skills"); assert.equal(panelFor("KeyK"), "skills");
  assert.equal(panelFor("KeyM"), "map"); assert.equal(panelFor("Tab"), "map"); assert.equal(panelFor("KeyJ"), "journal");
  assert.equal(panelFor("KeyQ"), null);
  assert.ok(["F1", "F2", "F3", "F4"].every(preventsDefault));
  assert.equal(preventsDefault("Digit1"), false);
});

test("messages: core events become one line of feedback", () => {
  const s = newGame(1, { start: "town" });
  const it = { ...s.inventory.items[0], id: "x1", reqs: { level: 9 } };
  s.inventory.items.push(it);
  assert.match(messageFor({ type: "reqNotMet", id: "x1" }, s), /^Needs Level 9 \(you have 1\)/);
  assert.equal(messageFor({ type: "stairsLocked", depth: 8 }, s), content.strings.stairsLocked);
  assert.equal(messageFor({ type: "noMana", skill: "mute", cost: 7 }, s), T.notEnoughMana);
  assert.match(messageFor({ type: "levelup", level: 4 }, s), /Level up! Now level 4/);
  assert.match(messageFor({ type: "cannotAfford", price: 120 }, s), /Not enough gold \(120 gold\)/);
  assert.match(messageFor({ type: "buy", name: "Cardigan", price: 15 }, s), /Bought Cardigan/);
  assert.match(messageFor({ type: "skillLearned", skill: "mute", level: 2 }, s), /Learned Mute \(Level 2\)/);
  assert.equal(messageFor({ type: "floorEnter", depth: 0 }, s), "Lobby");
  assert.equal(messageFor({ type: "hit" }, s), null);
});
