// Title / pause / game-over / victory / options / error screens as DOM overlays above the canvas. All text comes from
// the string tables. Buttons are real <button>s so keyboard, mouse and tests all work.
import { content } from "../core/index.js";
import { T } from "./text.js";
import { createOptionsView } from "./options.js";

const S = content.strings;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;


/** Title backdrop art (inline SVG, no assets): the office tower at night with most floors dark, a lit lobby glow and the hero's silhouette. `wide` = landscape layout (tower right, hero left), otherwise portrait (tower above the card, hero below it). */
function titleArt(wide) {
  const W = wide ? 1200 : 600, H = wide ? 720 : 1200, tx = wide ? 930 : 300, tw = wide ? 190 : 170, ty = wide ? 70 : 60, hx = wide ? 150 : 300, gy = wide ? 690 : 1130;
  const cols = 6, rows = Math.floor((gy - ty - 40) / 34);
  let win = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lit = (r * 7 + c * 13 + (r > rows - 4 ? 3 : 0)) % 11 === 0 || (r >= rows - 2 && (c + r) % 2 === 0); // only the lowest floors still have light
    win += `<rect x="${tx - tw / 2 + 12 + c * ((tw - 24) / cols)}" y="${ty + 28 + r * 34}" width="${(tw - 24) / cols - 8}" height="20" rx="2" fill="${lit ? "#ffd98a" : "#141a33"}" ${lit ? 'opacity=".9"' : ""}/>`;
  }
  let stars = "";
  for (let i = 0; i < 40; i++) stars += `<circle cx="${(i * 137) % W}" cy="${(i * 71) % (H * 0.45)}" r="${i % 5 === 0 ? 1.6 : 1}" fill="#cfd8ff" opacity="${0.35 + (i % 4) * 0.12}"/>`;
  const side = (x, w, h, k) => `<rect x="${x}" y="${gy - h}" width="${w}" height="${h}" fill="${k}"/>`;
  return `<svg class="art ${wide ? "wide" : "tall"}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
<defs><linearGradient id="sky${wide ? "w" : "t"}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1030"/><stop offset=".6" stop-color="#1d1a45"/><stop offset="1" stop-color="#3a2150"/></linearGradient>
<radialGradient id="glow${wide ? "w" : "t"}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd29a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd29a" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sky${wide ? "w" : "t"})"/>${stars}
<circle cx="${wide ? 250 : 120}" cy="${wide ? 120 : 140}" r="34" fill="#f4f0ff" opacity=".85"/><circle cx="${wide ? 264 : 134}" cy="${wide ? 112 : 132}" r="30" fill="#1d1a45"/>
${side(tx - tw / 2 - 150, 120, 220, "#171a3a")}${side(tx - tw / 2 - 40, 60, 330, "#1a1e40")}${side(tx + tw / 2 + 20, 110, 260, "#171a3a")}${side(tx + tw / 2 + 140, 90, 180, "#1a1e40")}
<rect x="${tx - tw / 2}" y="${ty}" width="${tw}" height="${gy - ty}" fill="#232851" stroke="#0a0d20" stroke-width="4"/>
<rect x="${tx - tw / 2 - 10}" y="${ty - 12}" width="${tw + 20}" height="16" fill="#2c3263" stroke="#0a0d20" stroke-width="3"/>
<rect x="${tx - 3}" y="${ty - 70}" width="6" height="60" fill="#0a0d20"/><circle cx="${tx}" cy="${ty - 74}" r="6" fill="#ff4a52"/>
${win}
<ellipse cx="${hx}" cy="${gy}" rx="190" ry="34" fill="url(#glow${wide ? "w" : "t"})"/>
<rect x="0" y="${gy}" width="${W}" height="${H - gy + 2}" fill="#0b0d1e"/>
<g transform="translate(${hx} ${gy}) scale(${wide ? 1 : 0.7}) translate(${-hx} ${-gy})" fill="#0a0c18" stroke="#9aa6d8" stroke-width="2.5" stroke-linejoin="round"><ellipse cx="${hx}" cy="${gy}" rx="42" ry="9" fill="#000" stroke="none" opacity=".6"/>
<path d="M${hx - 30} ${gy - 4} L${hx - 26} ${gy - 78} Q${hx - 24} ${gy - 100} ${hx} ${gy - 102} Q${hx + 24} ${gy - 100} ${hx + 26} ${gy - 78} L${hx + 30} ${gy - 4} Z"/>
<circle cx="${hx}" cy="${gy - 126}" r="22"/><path d="M${hx - 22} ${gy - 130} Q${hx - 26} ${gy - 154} ${hx} ${gy - 154} Q${hx + 26} ${gy - 154} ${hx + 22} ${gy - 130}" fill="none"/><path d="M${hx - 20} ${gy - 128} Q${hx - 34} ${gy - 122} ${hx - 24} ${gy - 106}" fill="none"/></g>
</svg>`;
}

export function createScreens(root, h) {
  let current = null, sub = null, last = null, active = null;
  const click = () => h.emit?.("ui:click");
  function button(label, testid, onClick, cls = "btn") {
    const b = el("button", cls, label);
    b.type = "button"; b.dataset.testid = testid;
    b.addEventListener("click", (ev) => { ev.stopPropagation(); click(); onClick(); });
    return b;
  }
  const go = (name) => { sub = name; if (last) screens.show(last.menu, last.info, true); };
  const stats = (pairs) => {
    const list = el("dl", "summary");
    for (const [k, v] of pairs) { const d = el("div"); d.append(el("dt", "", k), el("dd", "", v)); list.append(d); }
    return list;
  };
  const confirmBox = (title, text, yes, onYes, testid) => {
    const s = el("section", "screen title confirm"), box = el("div", "panel");
    box.setAttribute("role", "alertdialog"); box.setAttribute("aria-label", title);
    box.append(el("h2", "", title), el("p", "hint", text), button(T.confirmYes, `${testid}-yes`, () => { sub = null; onYes(); }), button(T.confirmNo, `${testid}-no`, () => go(null)));
    s.append(box);
    return s;
  };
  const build = {
    title: (info) => {
      if (sub === "confirm-new") return confirmBox(T.confirmNewTitle, T.confirmNewText, S.newGame, () => h.newGame(), "confirm-new");
      if (sub === "confirm-delete") return confirmBox(T.confirmDeleteTitle, T.confirmDeleteText, T.deleteCharacter, () => h.deleteSave(), "confirm-delete");
      if (sub === "import") return buildImport(info);
      if (sub === "confirm-import") return confirmBox(T.confirmImportTitle, T.confirmImportText, T.importGo, () => { const t = pendingImport; pendingImport = null; h.importText(t); }, "confirm-import");
      const s = el("section", "screen title"), box = el("div", "panel");
      const art = el("div", "title-art"); art.innerHTML = titleArt(true) + titleArt(false); s.append(art);
      box.append(el("h1", "", S.gameTitle), el("p", "tagline", S.tagline), el("p", "goal", T.titleGoal));
      if (info.notice) { const n = el("p", "notice-line", info.notice); n.setAttribute("role", "status"); n.dataset.testid = "title-notice"; box.append(n); }
      const cont = button(T.continueGame, "continue", () => h.continueGame());
      cont.disabled = !info.hasSave;
      box.append(cont);
      box.append(button(S.newGame, "new-game", () => (info.hasSave ? go("confirm-new") : h.newGame())));
      box.append(button(T.options, "options", () => h.openOptions()));
      const row = el("div", "btn-row");
      const exp = button(T.exportSave, "export-save", () => h.exportSave("current"), "btn small"); exp.disabled = !info.hasSave;
      row.append(exp, button(T.importSave, "import-save", () => go("import"), "btn small"));
      if (info.hasSave) row.append(button(T.deleteCharacter, "delete-save", () => go("confirm-delete"), "btn small"));
      if (info.hasCorrupt) row.append(button(T.exportCorrupt, "export-corrupt", () => h.exportSave("corrupt"), "btn small"));
      box.append(row);
      box.append(el("p", "hint", S.controlsHint), el("p", "seed", `${S.seedLabel} ${info.seed}`));
      s.append(box);
      return s;
    },
    pause: () => {
      const s = el("section", "screen pause");
      s.append(el("h2", "", S.paused), button(S.resume, "resume", h.resume), button(T.options, "options", () => h.openOptions()), button(S.quitToTitle, "quit", h.quit));
      return s;
    },
    options: () => {
      const v = createOptionsView(h.optionsCtl, () => h.closeOptions());
      return v;
    },
    story: (info) => {
      const st = content.story[info.story] ?? content.story.start, s = el("section", "screen story-screen"), box = el("div", "panel vic");
      box.setAttribute("role", "dialog"); box.setAttribute("aria-label", st.title);
      box.append(el("p", "kicker", T.storyKicker), el("h2", "", st.title));
      for (const line of st.lines) box.append(el("p", "story", line));
      box.append(button(T.storyContinue, "story-continue", h.dismissStory));
      s.append(box);
      return s;
    },
    victory: (info) => {
      const s = el("section", "screen victory"), box = el("div", "panel vic"), r = info.victory ?? {};
      box.setAttribute("role", "dialog"); box.setAttribute("aria-label", S.victoryTitle);
      box.append(el("p", "kicker", T.victoryBoss), el("h2", "", S.victoryTitle), ...content.story.victory.lines.map((l) => el("p", "story", l)), el("h3", "", S.victoryStats));
      box.append(stats([[S.victoryTime, fmtTime(r.seconds ?? 0)], [S.victoryKills, String(r.kills ?? 0)], [S.victoryDeaths, String(r.deaths ?? 0)], [S.victoryLevel, String(r.level ?? 1)], [S.victoryGold, String(r.gold ?? 0)], [S.victoryDeepest, String(r.deepestDepth ?? 0)]]));
      box.append(button(S.keepPlaying, "keep-playing", h.keepPlaying), button(T.victoryQuit, "quit", h.quit));
      s.append(box);
      return s;
    },
    dead: (info) => {
      const s = el("section", "screen dead"), r = info.summary;
      s.append(el("h2", "", S.youDied));
      if (r) s.append(stats([["Kills", String(r.kills)], ["Time", fmtTime(r.seconds)], ["Depth", String(r.depth)]])); // run summary: kills, time survived, depth
      s.append(el("p", "hint", T.respawnHint), button(T.respawn, "respawn", h.respawn), button(S.restart, "restart", h.restart), button(S.quitToTitle, "quit", h.quit));
      return s;
    },
    error: (info) => {
      const s = el("section", "screen error");
      s.append(el("h2", "", S.errorTitle), el("p", "hint", info.error ?? ""));
      if (info.hasSave) s.append(button(T.errorExport, "export-save", () => h.exportSave("current")));
      s.append(button(S.quitToTitle, "quit", () => location.reload()));
      return s;
    },
  };
  let pendingImport = null;
  const requestImport = (text, info) => { // a save already exists: ask before it is replaced
    if (info.hasSave && h.canImport(text)) { pendingImport = text; go("confirm-import"); } else { h.importText(text); go(null); }
  };
  function buildImport(info) {
    const s = el("section", "screen title import"), box = el("div", "panel");
    box.append(el("h2", "", T.importTitle));
    const file = el("input"); file.type = "file"; file.accept = ".json,application/json,text/plain"; file.dataset.testid = "import-file"; file.id = "import-file";
    const lab = el("label", "hint", T.importFile); lab.htmlFor = "import-file";
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (!f) return; let text = ""; try { text = await f.text(); } catch { /* reported as a failed import */ } requestImport(text, info);  });
    const ta = el("textarea"); ta.rows = 5; ta.dataset.testid = "import-text"; ta.setAttribute("aria-label", T.importPasteLabel); ta.spellcheck = false;
    const row = el("div", "btn-row");
    row.append(button(T.importGo, "import-go", () => requestImport(ta.value, info), "btn small"), button(T.back, "import-back", () => go(null), "btn small"));
    box.append(lab, file, el("p", "hint", T.importPaste), ta, row);
    s.append(box);
    return s;
  }
  const screens = {
    /** Show the screen for `menu` (null hides everything). Rebuilds only when something changed. */
    show(menu, info = {}, force = false) {
      last = { menu, info };
      if (menu !== "title") sub = null;
      const sm = info.summary ? `${info.summary.kills}/${info.summary.seconds}/${info.summary.depth}` : "", v = info.victory ? `${info.victory.seconds}/${info.victory.kills}` : "";
      const key = menu ? `${menu}:${sub ?? ""}:${info.seed ?? ""}:${sm}:${v}:${info.hasSave ? 1 : 0}${info.hasCorrupt ? 1 : 0}:${info.notice ?? ""}:${info.story ?? ""}` : "";
      if (key === current && !force) return;
      current = key;
      active?.destroy?.(); active = null;
      root.replaceChildren();
      if (!menu) return;
      const s = build[menu](info);
      active = s;
      root.append(s);
      const first = [...s.querySelectorAll("button")].find((b) => !b.disabled);
      if (menu === "options") s.querySelector("input,select,button")?.focus({ preventScroll: true });
      else (sub === "import" ? s.querySelector("input") : first)?.focus({ preventScroll: true });
    },
  };
  return screens;
}
