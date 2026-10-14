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
      if (sub === "import") return buildImport();
      const s = el("section", "screen title"), box = el("div", "panel");
      box.append(el("h1", "", S.gameTitle), el("p", "tagline", S.tagline));
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
    victory: (info) => {
      const s = el("section", "screen victory"), box = el("div", "panel vic"), r = info.victory ?? {};
      box.setAttribute("role", "dialog"); box.setAttribute("aria-label", S.victoryTitle);
      box.append(el("p", "kicker", T.victoryBoss), el("h2", "", S.victoryTitle), el("p", "story", S.victoryText), el("h3", "", S.victoryStats));
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
  function buildImport() {
    const s = el("section", "screen title import"), box = el("div", "panel");
    box.append(el("h2", "", T.importTitle));
    const file = el("input"); file.type = "file"; file.accept = ".json,application/json,text/plain"; file.dataset.testid = "import-file"; file.id = "import-file";
    const lab = el("label", "hint", T.importFile); lab.htmlFor = "import-file";
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (f) { const ok = await h.importFile(f); if (ok) go(null); else go(null); } });
    const ta = el("textarea"); ta.rows = 5; ta.dataset.testid = "import-text"; ta.setAttribute("aria-label", T.importPasteLabel); ta.spellcheck = false;
    const row = el("div", "btn-row");
    row.append(button(T.importGo, "import-go", () => { h.importText(ta.value); go(null); }, "btn small"), button(T.back, "import-back", () => go(null), "btn small"));
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
      const key = menu ? `${menu}:${sub ?? ""}:${info.seed ?? ""}:${sm}:${v}:${info.hasSave ? 1 : 0}${info.hasCorrupt ? 1 : 0}:${info.notice ?? ""}` : "";
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
