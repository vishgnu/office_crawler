// Save status banner (R5 fix contract section 1 and 2): game.slots.status = { storage: "ok"|"memory"|"full", owner: "self"|"other"|"stale"|"none", notice }.
//   storage "memory"  persistent banner "Saving is off in this browser" (nothing is written; ADV-R5-06)
//   storage "full"    persistent banner with the way out
//   notice            a text key (T.notices) with a Dismiss button -> { t: "dismissSaveNotice" }
//   owner other/stale a "Take over saves" action behind a confirmation -> { t: "takeOverSaves" }
// The element reads the live status through h.slots() and rebuilds itself after each command; every field is guarded for undefined
// (the data side may be older than this UI). All text goes in with textContent. The confirmation takes focus, traps Tab, closes on Esc and
// gives focus back to the "Take over saves" button (AC-NFR-A07-1).
import { T } from "./text.js";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Keep Tab / Shift+Tab inside `box`; Esc calls onEsc. Attach to the box itself (keydown bubbles from its buttons). */
export function trapDialog(box, onEsc, signal) {
  box.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); onEsc(); return; }
    if (ev.key !== "Tab") return;
    const f = [...box.querySelectorAll("button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex='-1'])")];
    if (!f.length) { ev.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], at = box.ownerDocument.activeElement;
    if (!box.contains(at)) { ev.preventDefault(); first.focus(); }
    else if (ev.shiftKey && at === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && at === last) { ev.preventDefault(); first.focus(); }
  }, { signal });
}

/**
 * createSaveStatus(h, { errorText, onChange }): h.session(cmd), h.slots(), h.emit?.
 * Returns an element (display: contents when empty) with refresh() and destroy().
 */
export function createSaveStatus(h, { errorText = () => "", onChange = null } = {}) {
  const root = el("div", "sv-status");
  root.dataset.testid = "save-status";
  const ac = new AbortController();
  let confirming = false, focusTarget = null, msg = "";
  const status = () => h.slots?.()?.status ?? {};
  const cmd = (c) => { try { return h.session?.(c) ?? { ok: false }; } catch { return { ok: false, error: "write-failed" }; } };
  const btn = (label, testid, fn, cls = "mini") => {
    const b = el("button", cls, label); b.type = "button"; b.dataset.testid = testid;
    b.addEventListener("click", (ev) => { ev.stopPropagation(); h.emit?.("ui:click"); fn(); }, { signal: ac.signal });
    return b;
  };
  const line = (cls, testid, title, text, role = "status") => {
    const d = el("div", `sv-line ${cls}`); d.dataset.testid = testid; d.setAttribute("role", role);
    const body = el("div", "sv-body"); body.append(el("strong", "sv-title", title));
    if (text) body.append(el("span", "sv-text", text));
    d.append(body);
    return d;
  };

  function render() {
    const s = status();
    root.replaceChildren();
    root.classList.toggle("confirming", confirming && (s.owner === "other" || s.owner === "stale")); // R6 N7: banner text is not repeated while the confirmation is open
    if (s.storage === "memory") root.append(line("mem", "save-banner-memory", T.svMemory, T.svMemoryText));
    else if (s.storage === "full") root.append(line("mem", "save-banner-full", T.svFull, T.svFullText));
    if (s.notice) {
      const d = line("note", "save-notice", T.notices[s.notice] ?? T.notices.generic, "");
      d.append(btn(T.svDismiss, "save-notice-dismiss", () => { cmd({ t: "dismissSaveNotice" }); render(); onChange?.(); }));
      root.append(d);
    }
    if (s.owner === "other" || s.owner === "stale") {
      const d = line("own", "save-owner", s.owner === "stale" ? T.svStale : T.svOther, s.owner === "stale" ? T.svStaleText : T.svOtherText);
      if (!confirming) d.append(btn(T.svTakeOver, "take-over-saves", () => { confirming = true; render(); }));
      root.append(d);
      if (confirming) {
        const box = el("div", "sl-confirm sv-confirm"); box.setAttribute("role", "alertdialog"); box.setAttribute("aria-modal", "true"); box.dataset.testid = "take-over-confirm";
        const t = el("h3", "", T.svTakeTitle); t.id = "sv-take-title"; box.setAttribute("aria-labelledby", t.id);
        const close = () => { confirming = false; focusTarget = "take-over-saves"; render(); };
        const yes = btn(T.svTakeYes, "take-over-yes", () => {
          const r = cmd({ t: "takeOverSaves" });
          confirming = false; msg = r.ok ? T.svTaken : errorText(r.error);
          focusTarget = r.ok ? null : "take-over-saves"; render(); onChange?.();
        }, "btn pri");
        const no = btn(T.slCancel, "take-over-no", close, "btn");
        box.append(t, el("p", "hint", T.svTakeText), yes, no);
        trapDialog(box, close, ac.signal);
        root.append(box);
        queueMicrotask(() => no.focus());
      }
    }
    if (msg) { const m = el("p", "sv-msg", msg); m.setAttribute("role", "status"); m.dataset.testid = "save-status-message"; root.append(m); }
    root.hidden = !root.childElementCount;
    if (focusTarget) { root.querySelector(`[data-testid="${focusTarget}"]`)?.focus({ preventScroll: true }); focusTarget = null; }
  }
  root.refresh = render;
  root.destroy = () => ac.abort();
  render();
  return root;
}
