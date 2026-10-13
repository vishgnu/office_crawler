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
      const s = el("section", "screen title");
      s.append(el("h1", "", S.gameTitle), el("p", "tagline", S.tagline));
      s.append(button(S.newGame, "new-game", h.newGame));
      s.append(el("p", "hint", S.controlsHint), el("p", "seed", `${S.seedLabel} ${info.seed}`));
      return s;
    },
    pause: () => {
      const s = el("section", "screen pause");
      s.append(el("h2", "", S.paused), button(S.resume, "resume", h.resume), button(S.quitToTitle, "quit", h.quit));
      return s;
    },
    dead: () => {
      const s = el("section", "screen dead");
      s.append(el("h2", "", S.youDied), button(S.restart, "restart", h.restart), button(S.quitToTitle, "quit", h.quit));
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
      const key = menu ? `${menu}:${info.seed ?? ""}` : "";
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
