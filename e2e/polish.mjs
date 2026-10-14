// Final polish: high contrast + text 1.5 (no overlap / overflow, contrast >= 4.5:1), loot labels (cap, commons hidden), title (goal line, 390 px).
import { launch, open, check, finish } from "./helpers.mjs";
const browser = await launch();
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

{ // high contrast + text 1.5
  const g = await open(browser, { query: "test=1&seed=11", viewport: { width: 1280, height: 720 } });
  await g.app("newGame", { seed: 11, start: "floor" });
  await g.app("options.setFlag", "highContrast", true); await g.app("options.setTextScale", 1.5);
  await g.app("cheat.setLevel", 6);
  await g.app("cheat.giveItem", { rarity: "rare", slot: "weapon" });
  await g.app("ui.open", "inventory"); await g.app("ui.open", "character"); await g.app("ui.open", "skills");
  await g.page.waitForTimeout(500);
  const dock = await g.page.evaluate(() => [...document.querySelectorAll(".dock .hbtn")].map((b) => {
    const pick = (n) => { const cs = getComputedStyle(n); return { color: cs.color, bg: cs.backgroundColor, w: n.getBoundingClientRect().width }; };
    return { pressed: b.getAttribute("aria-pressed"), label: b.firstElementChild.textContent, ...pick(b), lab: pick(b.firstElementChild), scroll: b.scrollWidth > b.clientWidth + 1 };
  }));
  check("hc + 1.5: every dock button label has contrast >= 4.5:1 on the button (open and closed)", dock.length === 4 && dock.every((d) => ratio(rgb(d.lab.color), rgb(d.bg)) >= 4.5), dock);
  check("hc + 1.5: at least one dock button is in the open state (so the open state was tested)", dock.some((d) => d.pressed === "true"));
  check("hc + 1.5: dock labels do not overflow their buttons", dock.every((d) => !d.scroll), dock);
  await g.app("ui.open", "character"); await g.page.waitForTimeout(400);
  const rows = await g.page.evaluate(() => {
    const out = [];
    const sets = [...document.querySelectorAll(".xpl"), ...document.querySelectorAll(".sheet h3"), ...document.querySelectorAll(".attr")];
    for (const n of sets) {
      const kids = [...n.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0);
      out.push({ cls: n.className || n.tagName, kids: kids.map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })), over: n.scrollWidth > n.clientWidth + 1 });
    }
    return out;
  });
  const clash = rows.filter((r) => r.kids.some((a, i) => r.kids.some((b, j) => j > i && hit(a, b))));
  check("hc + 1.5: Employee File label rows (experience, section heads, attributes) do not overlap", rows.length > 3 && clash.length === 0, clash);
  check("hc + 1.5: Employee File rows do not overflow horizontally", rows.every((r) => !r.over), rows.filter((r) => r.over));
  const sheet = await g.page.evaluate(() => { const n = document.querySelector(".sheet"); return n ? n.scrollWidth <= n.clientWidth + 1 : false; });
  check("hc + 1.5: Employee File sheet has no horizontal overflow", sheet);
  await g.app("ui.close", "character"); await g.app("ui.close", "skills");
  await g.page.waitForTimeout(400);
  const cells = g.page.locator('[data-testid^="cell-"][data-tip]');
  const n = await cells.count();
  let allOk = n > 0; const seen = [];
  for (let i = 0; i < Math.min(n, 3); i++) {
    await cells.nth(i).hover(); await g.page.waitForTimeout(250);
    const t = await g.page.evaluate(() => { const e = document.getElementById("tip"); if (e.hidden) return null; const r = e.getBoundingClientRect(), hudTop = document.querySelector(".hud, #hudui")?.getBoundingClientRect().top; const cs = getComputedStyle(e); return { l: r.left, t: r.top, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight, clipped: e.scrollHeight > e.clientHeight + 1 && cs.overflowY === "hidden", ratio: [cs.color, cs.backgroundColor] }; });
    seen.push(t);
    if (!t || t.l < 0 || t.t < 0 || t.r > t.vw || t.b > t.vh || t.clipped || ratio(rgb(t.ratio[0]), rgb(t.ratio[1])) < 4.5) allOk = false;
  }
  check("hc + 1.5: the compare tooltip stays inside the viewport (not cut, text contrast >= 4.5:1)", allOk, seen);
  check("hc + 1.5: no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}
{ // loot labels
  const g = await open(browser, { query: "test=1&seed=11", viewport: { width: 1280, height: 720 } });
  await g.app("newGame", { seed: 11, start: "floor" });
  let s = await g.app("step", 10);
  const t = s.player.tile;
  const tiles = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [0, 2], [-2, 0], [0, -2]];
  for (const [dx, dy] of tiles) await g.app("cheat.spawnItem", { rarity: "normal" }, { x: t.x + dx, y: t.y + dy });
  await g.app("step", 3); await g.page.waitForTimeout(250);
  const commons = (await g.app("perf")).lootPlates;
  check("loot: common-rarity labels are hidden until hover / Alt (12 commons around the hero, 0 labels)", commons === 0, commons);
  for (let i = 0; i < 6; i++) await g.app("cheat.spawnItem", { rarity: "magic" }, { x: t.x + (i % 3) - 1, y: t.y + 2 + Math.floor(i / 3) });
  for (let i = 0; i < 6; i++) await g.app("cheat.spawnItem", { rarity: "rare" }, { x: t.x + (i % 3) - 1, y: t.y - 3 - Math.floor(i / 3) });
  await g.app("step", 3); await g.page.waitForTimeout(250);
  const capped = (await g.app("perf")).lootPlates;
  check("loot: visible labels are capped at 6 (12 rare / magic around the hero)", capped >= 1 && capped <= 6, capped);
  check("loot: no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}
{ // title
  for (const [w, h] of [[1280, 720], [390, 844], [320, 568]]) {
    const g = await open(browser, { query: "test=1&seed=11", lobby: true, viewport: { width: w, height: h } });
    await g.page.waitForTimeout(700);
    const r = await g.page.evaluate(() => {
      const goal = document.querySelector(".screen.title .goal"), panel = document.querySelector(".screen.title .panel"), art = document.querySelector(".title-art .art:not([style*='none'])");
      const gr = goal?.getBoundingClientRect(), pr = panel.getBoundingClientRect(), cs = goal && getComputedStyle(goal);
      return { text: goal?.textContent, color: cs?.color, vw: innerWidth, vh: innerHeight, pl: pr.left, pr: pr.right, gl: gr?.left, gr: gr?.right, sx: document.documentElement.scrollWidth, art: [...document.querySelectorAll(".title-art .art")].some((a) => getComputedStyle(a).display !== "none") };
    });
    check(`title ${w}px: goal line shown and inside the card`, /floors went dark/.test(r.text ?? "") && r.gl >= r.pl - 1 && r.gr <= r.pr + 1, r);
    check(`title ${w}px: goal text contrast >= 4.5:1 on the card (#0b0c12 ish)`, ratio(rgb(r.color), [11, 12, 18]) >= 4.5, r.color);
    check(`title ${w}px: backdrop art is drawn and nothing scrolls sideways`, r.art && r.sx <= r.vw && r.pl >= 0 && r.pr <= r.vw, r);
    await g.context.close();
  }
}
await browser.close();
finish("polish");
