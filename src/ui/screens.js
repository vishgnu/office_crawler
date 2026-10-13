// Title / pause / game-over / error screens as DOM overlays above the canvas. All text comes from
// the string table. Buttons are real <button>s so keyboard, mouse and tests all work.
import { content } from "../core/index.js";

const S = content.strings;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(label, testid, onClick) {
  const b = el("button", "btn", label);
  b.type = "button"; b.dataset.testid = testid;
  b.addEventListener("click", (ev) => { ev.stopPropagation(); onClick(); });
  return b;
}

export function createScreens(root, h) {
  let current = null;
  const build = {
    title: (info) => {
      const s = el("section", "screen title"), box = el("div", "panel");
      box.append(el("h1", "", S.gameTitle), el("p", "tagline", S.tagline));
      box.append(button(S.newGame, "new-game", h.newGame));
      box.append(el("p", "hint", S.controlsHint), el("p", "seed", `${S.seedLabel} ${info.seed}`));
      s.append(box);
      return s;
    },
    pause: () => {
      const s = el("section", "screen pause");
      s.append(el("h2", "", S.paused), button(S.resume, "resume", h.resume), button(S.quitToTitle, "quit", h.quit));
      return s;
    },
    dead: (info) => {
      const s = el("section", "screen dead"), r = info.summary;
      s.append(el("h2", "", S.youDied));
      if (r) { // run summary: kills, time survived, depth
        const mm = Math.floor(r.seconds / 60), ss = String(r.seconds % 60).padStart(2, "0"), list = el("dl", "summary");
        for (const [k, v] of [["Kills", String(r.kills)], ["Time", `${mm}:${ss}`], ["Depth", String(r.depth)]]) { const d = el("div"); d.append(el("dt", "", k), el("dd", "", v)); list.append(d); }
        s.append(list);
      }
      s.append(button(S.restart, "restart", h.restart), button(S.quitToTitle, "quit", h.quit));
      return s;
    },
    error: (info) => {
      const s = el("section", "screen error");
      s.append(el("h2", "", S.errorTitle), el("p", "hint", info.error ?? ""), button(S.quitToTitle, "quit", () => location.reload()));
      return s;
    },
  };
  return {
    /** Show the screen for `menu` (null hides everything). Rebuilds only when something changed. */
    show(menu, info = {}) {
      const key = menu ? `${menu}:${info.seed ?? ""}:${info.summary ? `${info.summary.kills}/${info.summary.seconds}/${info.summary.depth}` : ""}` : "";
      if (key === current) return;
      current = key;
      root.replaceChildren();
      if (!menu) return;
      const s = build[menu](info);
      root.append(s);
      s.querySelector("button")?.focus({ preventScroll: true });
    },
  };
}
