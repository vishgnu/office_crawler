// Title / pause / game-over / victory / options / error screens as DOM overlays above the canvas. All text comes from
// the string tables. Buttons are real <button>s so keyboard, mouse and tests all work.
import { content } from "../core/index.js";
import { T } from "./text.js";
import { createOptionsView } from "./options.js";
import { createSlotsView, slotSummary, errorText } from "./slots.js";
import { createSaveStatus } from "./savestatus.js";
import { createCharSelect, resetDraft } from "./charselect.js";

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
  const build = {
    title: (info) => {
      const s = el("section", "screen title"), box = el("div", "panel");
      const art = el("div", "title-art"); art.innerHTML = titleArt(true) + titleArt(false); s.append(art);
      box.append(el("h1", "", S.gameTitle), el("p", "tagline", S.tagline), el("p", "goal", T.titleGoal));
      const banner = createSaveStatus({ session: h.session, slots: h.slots, emit: h.emit }, { errorText });
      box.append(banner);
      if (info.notice) { const n = el("p", "notice-line", info.notice); n.setAttribute("role", "status"); n.dataset.testid = "title-notice"; box.append(n); }
      const slots = info.slots?.index.slots ?? [], lastN = info.slots?.index.last, ok = slots.filter((e) => e.state === "ok");
      const recent = (lastN && slots[lastN - 1]?.state === "ok" ? slots[lastN - 1] : ok.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))[0]) ?? null;
      const cont = button(T.continueGame, "continue", () => { const r = h.session({ t: "continue" }); if (!r.ok) h.titleMessage?.(r); });
      cont.disabled = !recent;
      if (recent) { const sub = el("span", "btn-sub"); sub.dataset.testid = "continue-who"; sub.textContent = `${recent.name} · ${slotSummary(recent).split(" · ").slice(0, 2).join(" · ")}`; cont.append(sub); cont.classList.add("two"); cont.setAttribute("aria-label", `${T.continueGame}: ${recent.name}`); }
      box.append(cont);
      box.append(button(S.newGame, "new-game", () => h.openCreate()));
      const load = button(T.loadGame, "load-game", () => { returnFocus = "load-game"; h.openSlots(); }); 
      box.append(load);
      box.append(button(T.options, "options", () => h.openOptions()));
      box.append(el("p", "hint", S.controlsHint), el("p", "seed", `${S.seedLabel} ${info.seed}`));
      s.append(box);
      return s;
    },
    slots: (info) => {
      const s = el("section", "screen slots-screen"), dlg = el("div", "dlg-card");
      dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-labelledby", "sl-title");
      dlg.append(createSlotsView(slotsHost(), { mode: "dialog", onClose: () => h.closeSlots() }));
      s.append(dlg);
      s.addEventListener("click", (e) => { if (e.target === s) h.closeSlots(); });
      return s;
    },
    create: (info) => createCharSelect({ session: h.session, closeCreate: h.closeCreate, openSlots: () => { returnFocus = "create-load"; h.openSlots(); }, playTransition, emit: h.emit }, info),
    pause: () => {
      const s = el("section", "screen pause");
      const banner = createSaveStatus({ session: h.session, slots: h.slots, emit: h.emit }, { errorText });
      s.append(el("h2", "", S.paused), banner, button(S.resume, "resume", h.resume), button(T.pauseJournal, "pause-journal", h.openJournal), button(T.saveSlots, "pause-slots", () => { returnFocus = "pause-slots"; h.openSlots(); }), button(T.options, "options", () => h.openOptions()), button(S.quitToTitle, "quit", h.quit));
      return s;
    },
    options: () => {
      const v = createOptionsView(h.optionsCtl, () => h.closeOptions(), () => createSlotsView(slotsHost(), { mode: "options" }));
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
  /** What the slot manager needs from the shell (see ui/slots.js). */
  const slotsHost = () => ({ session: h.session, slots: h.slots, playing: h.playing, download: h.download, emit: h.emit, onNewHere: (n) => h.openCreate({ slot: n }) });
  let returnFocus = null;
  /** The elevator doors close, the game starts (cb), the doors open (borrowed from variant C). Skipped under reduced motion and in tests. */
  function playTransition(cb) {
    if (document.documentElement.classList.contains("noanim")) { cb(); return { cancel() {} }; }
    const wrap = el("div", "elevator close"); wrap.setAttribute("aria-hidden", "true");
    wrap.append(el("div", "door l"), el("div", "door r"));
    document.body.append(wrap);
    let fired = false;
    const timer = setTimeout(() => {
      fired = true;
      if (cb() === false) { wrap.remove(); return; }
      wrap.className = "elevator open";
      setTimeout(() => wrap.remove(), 800);
    }, 1100);
    // ADV-R5-11 / AC-R-214-1: Esc (or anything else that destroys the class screen) during the doors cancels the start; nothing is created.
    return { cancel() { if (fired) return; clearTimeout(timer); wrap.remove(); } };
  }
  const screens = {
    /** Show the screen for `menu` (null hides everything). Rebuilds only when something changed. */
    show(menu, info = {}, force = false) {
      last = { menu, info };
      sub = null;
      const sm = info.summary ? `${info.summary.kills}/${info.summary.seconds}/${info.summary.depth}` : "", v = info.victory ? `${info.victory.seconds}/${info.victory.kills}` : "";
      const sl = menu === "title" ? JSON.stringify(info.slots?.index ?? null) : menu === "create" ? `${info.create?.slot ?? ""}/${(info.slots?.index.slots ?? []).map((e) => e.state[0]).join("")}` : "";
      const key = menu ? `${menu}:${sub ?? ""}:${info.seed ?? ""}:${sm}:${v}:${sl}:${menu === "title" ? info.notice ?? "" : ""}:${menu === "title" ? JSON.stringify(info.slots?.status ?? null) : ""}:${info.story ?? ""}` : "";
      if (key === current && !force) return;
      current = key;
      active?.destroy?.(); active = null;
      root.replaceChildren();
      if (!menu) return;
      const s = build[menu](info);
      active = s;
      root.append(s);
      s.afterMount?.();
      const first = [...s.querySelectorAll("button")].find((b) => !b.disabled);
      const back = returnFocus && menu !== "slots" ? s.querySelector(`[data-testid="${returnFocus}"]`) : null; // Esc / Close from the Load dialog: focus goes back to the button that opened it
      if (menu !== "slots") returnFocus = back ? null : returnFocus;
      if (back && !back.disabled) back.focus({ preventScroll: true });
      else if (menu === "options") s.querySelector("input,select,button")?.focus({ preventScroll: true });
      else if (menu === "create") (s.querySelector(".cs-cls.on") ?? first)?.focus({ preventScroll: true });
      else first?.focus({ preventScroll: true });
    },
  };
  return screens;
}
