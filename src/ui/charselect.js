// Character creation (variant A "Lobby lineup", docs/product/variants/character-select/decision.md): three class figures in the lobby, the chosen one
// steps into a light cone and ring, the info panel shows the class (stat bars from classCards(), branch preview), a name field with Suggest, Start
// and Load game. Borrowed: a "ding" pulse on the ring when the class changes, the SELECTED stamp and the elevator doors after Start.
// The figures are the in-world class sprites (render/figure.js drawFigure); this file draws the lobby backdrop and drives the animation.
// Text only via textContent / the T table; no game rules (the class data comes from classCards(), names from validateName/suggestName).
import { classCards, validateName, suggestName } from "../core/index.js";
import { content } from "../core/index.js";
import { T } from "./text.js";
import { skillIcon } from "./icons.js";
import { drawFigure } from "../render/figure.js";
import { HERO_ACCENT } from "../render/styles/vector/heroes.js";
import { errorText, markUndo } from "./slots.js";

const S = content.strings;
const SX = [0.22, 0.5, 0.78]; // class x positions as a share of the stage width (decision must-fix 1)
const OUT = "#0d0a1c", TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (n) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const reduced = () => document.documentElement.classList.contains("noanim") || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** The typed name, chosen class and suggestion counter survive a visit to the Load dialog (the screen is rebuilt when the menu changes). */
const draft = { cls: 0, name: "", nameIdx: -1 };
export const resetDraft = () => { draft.cls = 0; draft.name = ""; draft.nameIdx = -1; };

// ---- lobby backdrop (ported from A.html paintBG): wall, windows, elevator, reception desk, carpet in perspective, plants ----
function paintBackdrop(W, H, dpr) {
  const bg = document.createElement("canvas"); bg.width = Math.max(1, Math.round(W * dpr)); bg.height = Math.max(1, Math.round(H * dpr));
  const g = bg.getContext("2d"); g.scale(dpr, dpr);
  const hz = H * 0.5, vx = W / 2, vy = H * 0.34;
  let gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, "#1c1740"); gr.addColorStop(1, "#2d2760"); g.fillStyle = gr; g.fillRect(0, 0, W, hz);
  const pw = W / 9;
  for (let i = 0; i < 10; i++) { g.fillStyle = i & 1 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.12)"; g.fillRect(i * pw, 0, pw, hz); }
  g.fillStyle = "#237681"; g.fillRect(0, hz * 0.66, W, hz * 0.34); g.fillStyle = "#2d8a92"; g.fillRect(0, hz * 0.66, W, hz * 0.05);
  g.fillStyle = "#b89040"; g.fillRect(0, hz * 0.66 - 3, W, 3); g.fillStyle = OUT; g.fillRect(0, hz - 2, W, 2);
  const wy = hz * 0.16, wh = hz * 0.4;
  for (const fx of [0.1, 0.34, 0.66, 0.9]) {
    const ww = Math.min(W * 0.1, 117), x = W * fx - ww / 2;
    g.fillStyle = OUT; g.fillRect(x - 4, wy - 4, ww + 8, wh + 8);
    const sg = g.createLinearGradient(0, wy, 0, wy + wh); sg.addColorStop(0, "#2a2a6a"); sg.addColorStop(1, "#6d4a9a"); g.fillStyle = sg; g.fillRect(x, wy, ww, wh);
    g.fillStyle = "#161236";
    for (let k = 0; k < 4; k++) {
      const bh = wh * (0.35 + ((k * 37) % 5) * 0.1), bw = ww / 4;
      g.fillRect(x + k * bw, wy + wh - bh, bw - 2, bh); g.fillStyle = "#ffd05c";
      for (let r = 0; r < Math.floor(bh / 10); r++) if ((r + k) % 2) g.fillRect(x + k * bw + 3, wy + wh - bh + 4 + r * 10, 3, 3);
      g.fillStyle = "#161236";
    }
  }
  const ex = W * 0.5 - W * 0.045, ey = hz * 0.24, ew = W * 0.09, eh = hz * 0.76;
  g.fillStyle = OUT; g.fillRect(ex - 5, ey - 5, ew + 10, eh + 5); g.fillStyle = "#46467a"; g.fillRect(ex, ey, ew, eh);
  g.fillStyle = "#8793ae"; g.fillRect(ex, ey, ew / 2 - 1, eh); g.fillRect(ex + ew / 2 + 1, ey, ew / 2 - 1, eh);
  g.fillStyle = "#5ee07a"; g.beginPath(); g.moveTo(ex + ew / 2 - 9, ey - 18); g.lineTo(ex + ew / 2 + 9, ey - 18); g.lineTo(ex + ew / 2, ey - 8); g.fill();
  const dy = hz * 0.62, dh = hz * 0.38;
  g.fillStyle = "#8a5230"; g.fillRect(W * 0.02, dy, W * 0.14, dh); g.fillStyle = "#b06f3c"; g.fillRect(W * 0.02 - 4, dy - 6, W * 0.14 + 8, 8); g.fillStyle = OUT; g.fillRect(W * 0.02, dy + dh - 2, W * 0.14, 2);
  g.fillStyle = "#8ff3ff"; g.fillRect(W * 0.04, dy - 20, W * 0.03, 14);
  // carpet in perspective
  const rows = 9, cols = 14;
  g.save(); g.beginPath(); g.rect(0, hz, W, H - hz); g.clip();
  const yr = (k) => hz + (H - hz) * Math.pow(k / rows, 1.7), xb = (i) => vx + (i - cols / 2) * ((W * 1.9) / cols), xa = (i, y) => vx + (xb(i) - vx) * ((y - vy) / (H - vy));
  for (let k = 0; k < rows; k++) {
    const y0 = yr(k), y1 = yr(k + 1);
    for (let i = 0; i < cols; i++) { g.fillStyle = (i + k) & 1 ? "#2f3766" : "#272d57"; g.beginPath(); g.moveTo(xa(i, y0), y0); g.lineTo(xa(i + 1, y0), y0); g.lineTo(xa(i + 1, y1), y1); g.lineTo(xa(i, y1), y1); g.closePath(); g.fill(); }
  }
  g.strokeStyle = "rgba(13,10,28,.55)"; g.lineWidth = 1.5;
  for (let k = 0; k <= rows; k++) { const y = yr(k); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(xa(i, hz), hz); g.lineTo(xb(i), H); g.stroke(); }
  g.fillStyle = "rgba(28,24,56,.6)";
  for (const [a, b, rx, ry] of [[0.12, 0.78, 40, 8], [0.62, 0.62, 34, 7], [0.88, 0.9, 50, 10], [0.4, 0.95, 36, 8]]) { g.beginPath(); g.ellipse(W * a, H * b, ((rx * W) / 1280) * 1.3, ((ry * W) / 1280) * 1.3, 0, 0, TAU); g.fill(); }
  g.restore(); g.fillStyle = OUT; g.fillRect(0, hz, W, 2);
  for (const [fx, fy] of [[0.04, 0.58], [0.96, 0.58]]) {
    const x = W * fx, y = H * fy, s = H / 800;
    g.fillStyle = "#a2562e"; g.beginPath(); g.moveTo(x - 22 * s, y); g.lineTo(x + 22 * s, y); g.lineTo(x + 16 * s, y + 36 * s); g.lineTo(x - 16 * s, y + 36 * s); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#3da66a";
    for (let k = 0; k < 5; k++) { const a = -1.9 + k * 0.45; g.beginPath(); g.ellipse(x + Math.cos(a) * 22 * s, y - 8 * s + Math.sin(a) * 34 * s, 9 * s, 30 * s, a + Math.PI / 2, 0, TAU); g.fill(); g.stroke(); }
  }
  return bg;
}

/**
 * createCharSelect(h, info): the screen element (with destroy()).
 * h: { session(cmd), closeCreate(), openSlots(), playTransition(cb), emit(type) }; info: { slots (game.slots), create: {slot}, playing }.
 */
export function createCharSelect(h, info) {
  const cards = classCards();
  const root = el("section", "screen create"), app = el("main", "cs-app"), ac = new AbortController(), sig = { signal: ac.signal };
  root.dataset.testid = "create-screen";
  let sel = clamp(draft.cls, 0, cards.length - 1), selT = 0, T0 = 0, busy = false;
  const u = [0, 0, 0]; u[sel] = 1;
  let spot = SX[sel];
  const maxOf = (f) => Math.max(...cards.map(f)), dmgAvg = (c) => (c.derivedPreview.damage.min + c.derivedPreview.damage.max) / 2;
  const STATS = [
    [T.csStatHealth, (c) => c.derivedPreview.hp, maxOf((c) => c.derivedPreview.hp)],
    [T.csStatMana, (c) => c.derivedPreview.mp, maxOf((c) => c.derivedPreview.mp)],
    [T.csStatDamage, dmgAvg, maxOf(dmgAvg)],
    [T.csStatAgility, (c) => c.attrs.agility, maxOf((c) => c.attrs.agility)],
  ];

  // ---- stage ----
  const stage = el("section", "cs-stage"); stage.setAttribute("aria-label", T.csClasses);
  const bgCv = el("canvas", "cs-bg"); bgCv.setAttribute("aria-hidden", "true");
  const ttl = el("div", "cs-ttl"); ttl.append(el("h1", "", T.csTitle), el("p", "", T.csSub));
  const keys = el("div", "cs-keys"); keys.innerHTML = `<kbd>&larr;</kbd> <kbd>&rarr;</kbd> ${T.csKeys} &middot; <kbd>L</kbd> ${T.csLoadKey}`;
  const lineup = el("div", "cs-lineup"); lineup.setAttribute("role", "radiogroup"); lineup.setAttribute("aria-label", T.csClasses);
  const btns = cards.map((c, i) => {
    const b = el("button", "cs-cls"); b.type = "button"; b.setAttribute("role", "radio"); b.dataset.testid = `class-${c.id}`; b.dataset.class = c.id;
    b.style.setProperty("--x", String(SX[i] * 100)); b.style.setProperty("--c", HERO_ACCENT[c.id] ?? "#ffd43b");
    const fig = el("canvas", "cs-fig"); fig.setAttribute("aria-hidden", "true");
    const lbl = el("span", "lbl", c.name);
    b.append(fig, lbl);
    b.addEventListener("click", () => select(i, false), sig);
    lineup.append(b);
    return { b, fig, c };
  });
  const stamp = el("div", "cs-stamp", T.csSelected); stamp.setAttribute("aria-hidden", "true");
  const conf = el("div", "cs-conf", T.csConfidential); conf.setAttribute("aria-hidden", "true");
  stage.append(bgCv, ttl, keys, lineup, stamp, conf);

  // ---- side panel ----
  const side = el("aside", "cs-side"); side.setAttribute("aria-label", "Class details");
  const infoBox = el("div", "cs-info"); infoBox.setAttribute("aria-live", "polite"); infoBox.dataset.testid = "class-info";
  const foot = el("form", "cs-foot"); foot.noValidate = true; foot.dataset.testid = "create-form";
  side.append(infoBox, foot);
  app.append(stage, side); root.append(app);

  const nameLab = el("label", "cs-label"), nameInp = el("input", "cs-name");
  nameLab.htmlFor = nameInp.id = "cs-name"; nameLab.append(el("span", "", T.csName), el("span", "hint", T.csNameHint));
  nameInp.type = "text"; nameInp.maxLength = 16; nameInp.autocomplete = "off"; nameInp.spellcheck = false; nameInp.placeholder = T.csNamePlaceholder; nameInp.dataset.testid = "create-name"; nameInp.value = draft.name;
  nameInp.setAttribute("aria-describedby", "cs-cnt");
  const suggest = el("button", "btn small", T.csSuggest); suggest.type = "button"; suggest.dataset.testid = "create-suggest";
  const row = el("div", "cs-namerow"); row.append(nameInp, suggest);
  const cnt = el("div", "cs-cnt"); cnt.id = "cs-cnt"; cnt.setAttribute("aria-live", "polite");
  const nCount = el("span", "", "0 / 16"), err = el("span", "err"); err.dataset.testid = "create-error";
  cnt.append(nCount, err);
  const go = el("button", "btn pri cs-go", T.csStart); go.type = "submit"; go.dataset.testid = "create-start"; go.setAttribute("aria-disabled", "true");
  const goHint = el("span", "cs-gohint", T.csStartHint); goHint.dataset.testid = "create-hint";
  const loadBtn = el("button", "btn", T.csLoad); loadBtn.type = "button"; loadBtn.dataset.testid = "create-load"; loadBtn.setAttribute("aria-haspopup", "dialog");
  const back = el("button", "btn", T.csBack); back.type = "button"; back.dataset.testid = "create-back";
  const actions = el("div", "cs-actions"); actions.append(go, loadBtn, back);
  const slotNote = el("p", "cs-slotnote"); slotNote.dataset.testid = "create-slot-note"; slotNote.setAttribute("aria-live", "polite");
  const confirmBox = el("div", "cs-confirm"); confirmBox.hidden = true;
  foot.append(el("div", "cs-namebox"), actions, goHint, slotNote, confirmBox);
  foot.firstChild.append(nameLab, row, cnt);

  // ---- helpers ----
  const slots = () => info.slots?.index?.slots ?? [];
  const firstFree = () => { const e = slots().find((x) => x.state === "empty"); return e ? e.n : null; };
  const target = () => info.create?.slot ?? firstFree();
  const used = () => slots().filter((e) => e.state !== "empty").length;
  const validName = () => validateName(nameInp.value).ok;
  function syncName() {
    draft.name = nameInp.value;
    nCount.textContent = `${[...nameInp.value].length} / 16`;
    const ok = validName();
    go.setAttribute("aria-disabled", ok ? "false" : "true"); goHint.hidden = ok; go.classList.toggle("off", !ok);
    if (ok) err.textContent = "";
  }
  function syncSlotNote() {
    const n = target();
    slotNote.textContent = n === null ? T.csSlotFull : `${T.csSlotNew} ${n}. ${used()} / 5 ${T.csSlotsUsed}.`;
    if (n !== null && slots()[n - 1]?.state !== "empty" && slots()[n - 1]) slotNote.textContent = `${T.csSlotNew} ${n}: ${slots()[n - 1].name ?? ""}. ${used()} / 5 ${T.csSlotsUsed}.`;
  }
  function infoHtml(c) {
    const box = document.createDocumentFragment();
    const head = el("div", "cs-head"), emblem = el("span", "cs-emblem"); emblem.innerHTML = skillIcon(`class:${c.id}`);
    const h2 = el("h2", "", c.name); h2.id = "cs-class-name"; h2.dataset.testid = "class-name";
    head.append(emblem, h2, el("span", "cs-role", S[c.roleKey]));
    const quote = el("p", "cs-quote", S[c.blurbKey]);
    const tags = el("ul", "cs-tags"); tags.setAttribute("aria-label", T.csPlaystyle);
    const sigName = content.skills[c.signature]?.name;
    for (const t of [S[c.roleKey], sigName ? `${T.trSignature}: ${sigName}` : null, content.skills[c.basic]?.name ? `${content.skills[c.basic].name}` : null]) if (t) tags.append(el("li", "", t));
    const stats = el("dl", "cs-stats"); stats.setAttribute("aria-label", T.csStats);
    for (const [label, val, max] of STATS) {
      const v = val(c), pips = Math.max(1, Math.round((v / max) * 5)), d = el("div", "cs-stat");
      const dd = el("dd"), bar = el("span", "pips"); bar.setAttribute("role", "img"); bar.setAttribute("aria-label", `${label} ${v}, ${pips} ${T.csOutOf}`);
      for (let k = 1; k <= 5; k++) bar.append(el("span", k <= pips ? "on" : ""));
      dd.append(bar, el("b", "", String(Math.round(v * 10) / 10)));
      d.append(el("dt", "", label), dd); stats.append(d);
    }
    const bw = el("div", "cs-bwrap"); bw.append(el("h3", "cs-sec", T.csBranches));
    const bl = el("ul", "cs-branches"); bl.dataset.testid = "class-branches";
    for (const b of c.branches) {
      const li = el("li"), ico = el("span", "ico"); ico.innerHTML = skillIcon(b.iconKey);
      const txt = el("span"); txt.append(el("b", "", b.name), el("small", "", b.skills.map((s) => s.name).join(", ")));
      li.append(ico, txt); bl.append(li);
    }
    bw.append(bl);
    box.append(head, quote, tags, stats, bw);
    return box;
  }

  // ---- drawing ----
  let W = 0, H = 0, dpr = 1, bg = null, GY = 0, FH = 0, lastDraw = 0, dirty = true;
  const g = bgCv.getContext("2d");
  function layout() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); dpr = Math.min(window.devicePixelRatio || 1, 2);
    bgCv.width = Math.round(W * dpr); bgCv.height = Math.round(H * dpr); bg = paintBackdrop(W, H, dpr);
    for (const x of btns) {
      const ch = Math.max(1, Math.round(Math.min(H * 0.5, x.b.getBoundingClientRect().height))), cw = Math.round((ch * 104) / 96);
      x.fig.width = Math.round(cw * dpr); x.fig.height = Math.round(ch * dpr); x.fig.style.width = cw + "px"; x.fig.style.height = ch + "px"; x.fig.style.marginLeft = -Math.round(cw / 2) + "px";
    }
    const sr = stage.getBoundingClientRect(), fr = btns[sel].fig.getBoundingClientRect();
    GY = fr.bottom - sr.top - fr.height * 0.03; FH = fr.height;
    drawFigures(true); dirty = true;
  }
  const lastFrame = [-1, -1, -1];
  function drawFigures(all) {
    const still = reduced();
    btns.forEach((x, i) => {
      if (i === sel && !still) { const f = Math.floor((performance.now() - T0) / 83); if (!all && lastFrame[i] === f) return; lastFrame[i] = f; drawFigure(x.fig, x.c.figureKey, { anim: "card-idle", t: (performance.now() - T0) / 1000 }); }
      else if (all || lastFrame[i] !== -2) { lastFrame[i] = -2; drawFigure(x.fig, x.c.figureKey, { anim: "portrait" }); }
    });
  }
  function render(now) {
    if (!bg) return;
    const t = reduced() ? 0 : now / 1000, flour = !busy && selT < 0.5 ? selT / 0.5 : -1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    g.drawImage(bg, 0, 0, W, H);
    g.fillStyle = "rgba(10,8,26,.48)"; g.fillRect(0, 0, W, H);
    const lx = spot * W, poolY = GY, pr = Math.min(W * 0.2, H * 0.5), pop = flour >= 0 ? 1 + 0.5 * (1 - ss(0, 0.35, flour)) : 1;
    g.save(); g.globalCompositeOperation = "lighter";
    const cg = g.createLinearGradient(0, 0, 0, poolY); cg.addColorStop(0, "rgba(255,233,176,.30)"); cg.addColorStop(1, "rgba(255,233,176,.07)");
    g.fillStyle = cg; g.beginPath(); g.moveTo(lx - W * 0.035, 0); g.lineTo(lx + W * 0.035, 0); g.lineTo(lx + pr * 1.05, poolY); g.lineTo(lx - pr * 1.05, poolY); g.closePath(); g.fill();
    for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(255,226,160,${0.13 * pop})`; g.beginPath(); g.ellipse(lx, poolY, pr * (1.05 - k * 0.26), pr * (1.05 - k * 0.26) * 0.3, 0, 0, TAU); g.fill(); }
    for (let i = 0; i < 3; i++) { const fl = 0.5 + 0.5 * (hash(Math.floor(t * 14) + i * 7) > 0.93 ? 0.3 : 1); g.fillStyle = `rgba(255,233,176,${0.1 * fl * (1 - u[i])})`; g.fillRect(SX[i] * W - W * 0.04, 0, W * 0.08, 5); }
    for (let k = 0; k < 22; k++) { const p = (hash(k) * 7 + t * (0.02 + hash(k + 9) * 0.03)) % 1, x = lx + (hash(k + 3) - 0.5) * pr * 1.6 * (0.2 + p * 0.8) + Math.sin(t * 0.7 + k) * 6, y = p * poolY; g.fillStyle = `rgba(255,240,200,${0.25 * Math.sin(p * Math.PI)})`; g.fillRect(x, y, 1.8, 1.8); }
    g.restore();
    // ring on the floor under the chosen class (the ding pulse widens it for a moment)
    const sc = (FH / 100) * 1.14, ringX = spot * W, pulse = flour >= 0 ? ss(0, 1, flour) : 1;
    g.save(); g.lineWidth = Math.max(3, sc * 2.6); g.strokeStyle = OUT; g.beginPath(); g.ellipse(ringX, GY, 33 * sc, 10 * sc, 0, 0, TAU); g.stroke();
    g.lineWidth = Math.max(1.5, sc * 1.2); g.strokeStyle = "#fff"; g.stroke();
    if (flour >= 0 && !reduced()) { g.globalAlpha = 1 - pulse; g.lineWidth = Math.max(2, sc * 1.6); g.strokeStyle = HERO_ACCENT[cards[sel].id]; g.beginPath(); g.ellipse(ringX, GY, (34 + 30 * pulse) * sc, (10 + 9 * pulse) * sc, 0, 0, TAU); g.stroke(); }
    g.restore();
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, "rgba(8,6,20,0)"); vg.addColorStop(1, "rgba(8,6,20,.6)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  let raf = 0, prevNow = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (prevNow || now)) / 1000); prevNow = now; selT += dt;
    let moving = false;
    for (let i = 0; i < 3; i++) { const tg = i === sel ? 1 : 0; u[i] += (tg - u[i]) * Math.min(1, dt * 7); if (Math.abs(tg - u[i]) < 0.002) u[i] = tg; else moving = true; }
    const ds = SX[sel] - spot; spot += ds * Math.min(1, dt * 7); if (Math.abs(ds) < 0.0005) spot = SX[sel]; else moving = true;
    if (reduced()) { if (dirty || moving) { render(now); dirty = false; } return; }
    if (now - lastDraw > 40 || moving) { lastDraw = now; drawFigures(false); render(now); }
  }

  // ---- behaviour ----
  function renderInfo() {
    const c = cards[sel];
    root.style.setProperty("--cl", HERO_ACCENT[c.id] ?? "#ffd43b");
    infoBox.replaceChildren(infoHtml(c)); infoBox.classList.remove("fade"); void infoBox.offsetWidth; if (!reduced()) infoBox.classList.add("fade");
    btns.forEach((x, i) => { x.b.setAttribute("aria-checked", i === sel ? "true" : "false"); x.b.tabIndex = i === sel ? 0 : -1; x.b.classList.toggle("on", i === sel); });
    root.dataset.class = c.id;
  }
  function select(i, focus) {
    if (busy) return;
    const was = sel; sel = clamp(i, 0, cards.length - 1); draft.cls = sel; selT = 0; T0 = performance.now(); dirty = true;
    renderInfo(); drawFigures(true);
    if (was !== sel) h.emit?.("ui:click");
    const sr = stage.getBoundingClientRect(), fr = btns[sel].fig.getBoundingClientRect(); GY = fr.bottom - sr.top - fr.height * 0.03;
    if (focus) btns[sel].b.focus();
  }
  suggest.addEventListener("click", () => { draft.nameIdx = (draft.nameIdx + 1) % 24; nameInp.value = suggestName(draft.nameIdx); syncName(); nameInp.focus(); }, sig);
  nameInp.addEventListener("input", syncName, sig);
  nameInp.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); nameInp.blur(); btns[sel].b.focus(); } }, sig);
  loadBtn.addEventListener("click", () => { h.emit?.("ui:click"); h.openSlots(); }, sig);
  back.addEventListener("click", () => { h.emit?.("ui:click"); h.closeCreate(); }, sig);

  function begin(slot, replacing) {
    busy = true; go.setAttribute("aria-busy", "true"); stamp.classList.add("show"); root.classList.add("starting");
    const c = cards[sel], name = validateName(nameInp.value).name;
    h.playTransition(() => {
      const r = h.session({ t: "createCharacter", slot, class: c.id, name, confirm: !!replacing });
      if (r.ok) { if (replacing) markUndo(slot, "replace"); resetDraft(); return true; }
      busy = false; go.removeAttribute("aria-busy"); stamp.classList.remove("show"); root.classList.remove("starting");
      err.textContent = errorText(r.error); return false;
    });
  }
  foot.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    if (!validName()) { err.textContent = T.csNameError; nameInp.focus(); return; }
    const n = target();
    if (n === null) { err.textContent = T.csSlotFull; h.openSlots(); return; }
    const e0 = slots()[n - 1];
    if (e0 && e0.state !== "empty") {
      confirmBox.replaceChildren(); confirmBox.hidden = false; actions.hidden = true; goHint.hidden = true;
      confirmBox.setAttribute("role", "alertdialog");
      const who = e0.name ?? `${T.slSlot} ${n}`;
      const t = el("h3", "", `${T.csReplaceTitle.replace("this character", who)}`.replace(/^Replace Replace/, "Replace")), p = el("p", "hint", `${who} ${T.csReplaceText}`);
      t.dataset.testid = "create-confirm-title"; p.dataset.testid = "create-confirm-text";
      const yes = el("button", "btn pri", `${T.csReplaceYes}`); yes.type = "button"; yes.dataset.testid = "create-confirm-yes";
      const no = el("button", "btn", T.slCancel); no.type = "button"; no.dataset.testid = "create-confirm-no";
      yes.addEventListener("click", () => { confirmBox.hidden = true; actions.hidden = false; syncName(); begin(n, true); });
      no.addEventListener("click", () => { confirmBox.hidden = true; actions.hidden = false; syncName(); go.focus(); });
      confirmBox.append(t, p, yes, no); yes.focus();
      return;
    }
    begin(n, false);
  }, sig);
  document.addEventListener("keydown", (e) => {
    const tg = e.target;
    if (busy || e.ctrlKey || e.metaKey || e.altKey || tg?.tagName === "INPUT" || tg?.tagName === "TEXTAREA") return;
    const onCls = tg?.classList?.contains("cs-cls");
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); select((sel + 2) % 3, onCls); }
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); select((sel + 1) % 3, onCls); }
    else if (e.key === "1" || e.key === "2" || e.key === "3") select(+e.key - 1, onCls);
    else if ((e.key === "Enter" || e.key === " ") && onCls) { e.preventDefault(); select(sel, true); nameInp.focus(); }
    else if (e.key === "l" || e.key === "L") { e.preventDefault(); h.openSlots(); }
    else if (e.key === "/" || e.key === "n" || e.key === "N") { e.preventDefault(); nameInp.focus(); }
  }, sig);
  window.addEventListener("resize", () => { layout(); }, sig);

  renderInfo(); syncName(); syncSlotNote();
  root.afterMount = () => { // layout needs the element in the document
    layout(); T0 = performance.now(); raf = requestAnimationFrame(loop);
    if (new URLSearchParams(location.search).get("test") === "1") root.dataset.ready = "1";
  };
  root.focusDefault = () => nameInp.focus({ preventScroll: true });
  root.destroy = () => { cancelAnimationFrame(raf); ac.abort(); };
  return root;
}
