// Item, skill and rarity glyphs as inline SVG strings (flat shapes, bold outline, the frozen C2 palette).
// Pure: strings in, strings out. Item icons are drawn per base id into a box of w x h cells (40 units per cell),
// so a 1x3 blade and a 2x2 clipboard each fill their own cells. Rarity is never colour alone: mark shape + border + word.
const OL = "#0d0a1c";
const U = 40; // drawing units per inventory cell

const r = (x, y, w, h, f, rx = 0, sw) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"${sw != null ? ` stroke-width="${sw}"` : ""}/>`;
const p = (d, f, sw) => `<path d="${d}" fill="${f}"${sw != null ? ` stroke-width="${sw}"` : ""}/>`;
const c = (x, y, rad, f, sw) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${f}"${sw != null ? ` stroke-width="${sw}"` : ""}/>`;
const line = (d, s, w = 2) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}"/>`;

/** Wrap shapes in an svg of w x h cells. */
const svg = (w, h, body) => `<svg class="ic" viewBox="0 0 ${w * U} ${h * U}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g stroke="${OL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

// Each glyph gets (W, H) in drawing units and returns shapes. Kept deliberately simple.
const G = {
  blade: (W, H, col = "#d3dcea") => p(`M${W / 2} 4L${W - 8} 18V${H * 0.62}H8V18Z`, col) + r(W / 2 - 9, H * 0.6, 18, H * 0.34, "#c83f38", 5) + c(W / 2, 30, 4, "#ffb81f", 2),
  kbd: (W, H) => (H > W * 1.4 ? `<g transform="translate(${W} 0) rotate(90)">${G.kbdFlat(H, W)}</g>` : G.kbdFlat(W, H)),
  kbdFlat: (W, H) => r(6, H * 0.3, W - 12, H * 0.4, "#363a5e", 6) + Array.from({ length: 24 }, (_, i) => r(12 + (i % 8) * ((W - 24) / 8), H * 0.36 + Math.floor(i / 8) * (H * 0.1), (W - 24) / 8 - 2, H * 0.08, "#8793ae", 1.5, 1)).join(""),
  mace: (W, H) => r(W / 2 - 5, H * 0.34, 10, H * 0.6, "#8793ae", 3) + r(W / 2 - 14, 6, 28, H * 0.34, "#c83f38", 6) + r(W / 2 - 14, 12, 28, 6, "#d3dcea", 2, 2),
  hammer: (W, H) => r(W / 2 - 5, H * 0.3, 10, H * 0.64, "#b06f3c", 3) + r(8, 6, W - 16, H * 0.28, "#8793ae", 5) + c(W / 2, H * 0.17, 5, "#363a5e", 2),
  pole: (W, H) => r(W / 2 - 4, 8, 8, H - 12, "#b06f3c", 3) + p(`M${W / 2} 2L${W - 8} 28L${W / 2} 22L8 28Z`, "#8793ae") + r(W / 2 - 14, H - 34, 28, 22, "#2f78f0", 5),
  club: (W, H) => r(W / 2 - 16, 14, 32, H - 26, "#c83f38", 9) + r(W / 2 - 10, 3, 20, 14, "#363a5e", 4) + r(W / 2 - 16, 28, 32, 8, "#ece4cf", 0, 1.5) + line(`M${W / 2 + 16} 24Q${W - 4} 30 ${W - 8} 50`, OL, 3),
  clip: (W, H) => r(W * 0.18, 8, W * 0.64, H - 14, "#b06f3c", 6) + r(W * 0.26, 20, W * 0.48, H - 38, "#ece4cf", 2, 2) + r(W * 0.38, 3, W * 0.24, 14, "#8793ae", 3) + line(`M${W * 0.32} 38H${W * 0.68}M${W * 0.32} 50H${W * 0.68}M${W * 0.32} 62H${W * 0.58}`, OL, 2),
  binder: (W, H) => r(W * 0.14, 8, W * 0.72, H - 16, "#2f78f0", 8) + c(W / 2, 20, 6, "#d3dcea", 2) + r(W * 0.26, 34, W * 0.48, H - 54, "#ece4cf", 2, 2),
  tray: (W, H) => c(W / 2, H / 2, Math.min(W, H) * 0.42, "#d3dcea") + c(W / 2, H / 2, Math.min(W, H) * 0.26, "#8793ae", 2),
  cap: (W, H) => p(`M8 ${H * 0.62}Q8 ${H * 0.18} ${W / 2} ${H * 0.18}Q${W - 8} ${H * 0.18} ${W - 8} ${H * 0.62}Z`, "#3b6cf0") + r(W * 0.4, H * 0.55, W * 0.58, 10, "#2a4cb8", 4),
  hardhat: (W, H) => p(`M8 ${H * 0.66}Q8 ${H * 0.14} ${W / 2} ${H * 0.14}Q${W - 8} ${H * 0.14} ${W - 8} ${H * 0.66}Z`, "#ffb81f") + r(4, H * 0.62, W - 8, 11, "#e8590c", 4) + r(W / 2 - 4, H * 0.16, 8, H * 0.4, "#ffe27a", 2, 1.5),
  headset: (W, H) => `<path d="M${W * 0.22} ${H * 0.62}A${W * 0.28} ${H * 0.34} 0 0 1 ${W * 0.78} ${H * 0.62}" fill="none" stroke-width="10"/><path d="M${W * 0.22} ${H * 0.62}A${W * 0.28} ${H * 0.34} 0 0 1 ${W * 0.78} ${H * 0.62}" fill="none" stroke="#a3b3d4" stroke-width="5"/>` + r(W * 0.1, H * 0.5, W * 0.2, H * 0.36, "#c83f38", 9) + r(W * 0.7, H * 0.5, W * 0.2, H * 0.36, "#c83f38", 9),
  coat: (W, H, col = "#3b6cf0", acc = "#ffb81f") => p(`M${W * 0.12} ${H * 0.12}L${W * 0.35} ${H * 0.05}L${W / 2} ${H * 0.28}L${W * 0.65} ${H * 0.05}L${W * 0.88} ${H * 0.12}L${W * 0.95} ${H * 0.5}L${W * 0.88} ${H * 0.96}H${W * 0.12}L${W * 0.05} ${H * 0.5}Z`, col) + p(`M${W / 2} ${H * 0.28}L${W * 0.57} ${H * 0.4}L${W * 0.53} ${H * 0.8}H${W * 0.47}L${W * 0.43} ${H * 0.4}Z`, acc, 2),
  vest: (W, H) => G.coat(W, H, "#ff9f1c", "#ece4cf") + r(W * 0.1, H * 0.55, W * 0.8, 8, "#ece4cf", 0, 1.5),
  glove: (W, H, col = "#a3b3d4") => r(W * 0.1, H * 0.42, W * 0.34, H * 0.4, col, 8) + r(W * 0.56, H * 0.42, W * 0.34, H * 0.4, col, 8) + [0.1, 0.2, 0.3].map((x) => r(W * x, H * 0.18, W * 0.07, H * 0.3, col, 3)).join("") + [0.58, 0.68, 0.78].map((x) => r(W * x, H * 0.18, W * 0.07, H * 0.3, col, 3)).join(""),
  brace: (W, H) => r(W * 0.15, H * 0.3, W * 0.7, H * 0.4, "#363a5e", 8) + r(W * 0.3, H * 0.4, W * 0.4, H * 0.2, "#33e0ff", 3, 2),
  shoe: (W, H, col = "#6b3f2a") => p(`M6 ${H * 0.4}Q6 ${H * 0.3} 14 ${H * 0.3}L${W * 0.36} ${H * 0.3}Q${W * 0.42} ${H * 0.5} ${W * 0.62} ${H * 0.55}L${W - 6} ${H * 0.6}Q${W} ${H * 0.66} ${W - 2} ${H * 0.74}L6 ${H * 0.74}Z`, col) + r(6, H * 0.72, W - 8, 8, "#161425", 3),
  boot: (W, H) => G.shoe(W, H, "#8e5a2b") + r(8, H * 0.14, W * 0.3, H * 0.2, "#8e5a2b", 3) + r(W * 0.14, H * 0.6, W * 0.45, 8, "#d3dcea", 2, 1.5),
  belt: (W, H, col = "#e2d9c0") => r(4, H * 0.3, W - 8, H * 0.4, col, 4) + r(W * 0.38, H * 0.18, W * 0.24, H * 0.64, "#b89040", 4) + r(W * 0.44, H * 0.3, W * 0.12, H * 0.4, "#241d4e", 2),
  ring: (W, H, gem = "#56b4e9", band = "#b89040") => c(W / 2, H * 0.62, Math.min(W, H) * 0.3, "none", 9) + `<circle cx="${W / 2}" cy="${H * 0.62}" r="${Math.min(W, H) * 0.3}" fill="none" stroke="${band}" stroke-width="4"/>` + p(`M${W / 2} ${H * 0.1}L${W * 0.7} ${H * 0.3}L${W / 2} ${H * 0.5}L${W * 0.3} ${H * 0.3}Z`, gem),
  clipring: (W, H) => `<path d="M${W * 0.3} ${H * 0.2}Q${W * 0.3} ${H * 0.08} ${W / 2} ${H * 0.08}Q${W * 0.75} ${H * 0.08} ${W * 0.75} ${H * 0.45}V${H * 0.8}Q${W * 0.75} ${H * 0.92} ${W / 2} ${H * 0.92}Q${W * 0.28} ${H * 0.92} ${W * 0.28} ${H * 0.7}V${H * 0.3}" fill="none" stroke-width="8"/><path d="M${W * 0.3} ${H * 0.2}Q${W * 0.3} ${H * 0.08} ${W / 2} ${H * 0.08}Q${W * 0.75} ${H * 0.08} ${W * 0.75} ${H * 0.45}V${H * 0.8}Q${W * 0.75} ${H * 0.92} ${W / 2} ${H * 0.92}Q${W * 0.28} ${H * 0.92} ${W * 0.28} ${H * 0.7}V${H * 0.3}" fill="none" stroke="#d3dcea" stroke-width="3.5"/>`,
  card: (W, H) => r(W * 0.12, H * 0.28, W * 0.76, H * 0.44, "#ffe47c", 4) + r(W * 0.12, H * 0.34, W * 0.76, 6, "#8e3406", 0, 2) + c(W * 0.72, H * 0.58, 4, "#fff", 1.5),
  lanyard: (W, H) => `<path d="M${W * 0.2} 2L${W / 2} ${H * 0.4}L${W * 0.8} 2" fill="none" stroke-width="8"/><path d="M${W * 0.2} 2L${W / 2} ${H * 0.4}L${W * 0.8} 2" fill="none" stroke="#33e0ff" stroke-width="4"/>` + r(W * 0.28, H * 0.42, W * 0.44, H * 0.4, "#fff", 4) + r(W * 0.36, H * 0.52, W * 0.28, 4, "#56b4e9", 0, 0),
  badge: (W, H) => c(W / 2, H / 2, Math.min(W, H) * 0.32, "#e8590c") + c(W / 2, H / 2, Math.min(W, H) * 0.18, "#ffe27a", 2),
  mug: (W, H, col = "#c83f38") => r(W * 0.22, H * 0.34, W * 0.5, H * 0.52, col, 5) + `<path d="M${W * 0.72} ${H * 0.44}H${W * 0.84}Q${W * 0.94} ${H * 0.44} ${W * 0.94} ${H * 0.58}Q${W * 0.94} ${H * 0.72} ${W * 0.84} ${H * 0.72}H${W * 0.72}" fill="none" stroke-width="3"/>` + line(`M${W * 0.34} ${H * 0.1}Q${W * 0.28} ${H * 0.2} ${W * 0.34} ${H * 0.28}M${W * 0.52} ${H * 0.1}Q${W * 0.46} ${H * 0.2} ${W * 0.52} ${H * 0.28}`, "#ece4cf", 2.5),
  cup: (W, H, col = "#56b4e9") => p(`M${W * 0.26} ${H * 0.3}H${W * 0.74}L${W * 0.68} ${H * 0.88}H${W * 0.32}Z`, "#ece4cf") + r(W * 0.3, H * 0.55, W * 0.4, H * 0.28, col, 2, 1.5),
  bottle: (W, H, col = "#2f78f0") => r(W * 0.3, H * 0.2, W * 0.4, H * 0.68, col, 6) + r(W * 0.38, H * 0.08, W * 0.24, H * 0.14, "#d3dcea", 3, 2) + p(`M${W * 0.56} ${H * 0.36}L${W * 0.42} ${H * 0.56}H${W * 0.52}L${W * 0.46} ${H * 0.76}L${W * 0.62} ${H * 0.5}H${W * 0.52}Z`, "#ffe27a", 1.5),
  jug: (W, H) => r(W * 0.22, H * 0.28, W * 0.56, H * 0.62, "#2f78f0", 9) + r(W * 0.4, H * 0.08, W * 0.2, H * 0.22, "#d3dcea", 3, 2) + p(`M${W / 2} ${H * 0.4}Q${W * 0.62} ${H * 0.58} ${W / 2} ${H * 0.72}Q${W * 0.38} ${H * 0.58} ${W / 2} ${H * 0.4}Z`, "#fff", 1.5),
  box: (W, H) => r(8, 8, W - 16, H - 16, "#d3dcea", 4),
};

// base id -> [glyph, extra args]
const BASE = {
  "ruler-rapier": ["blade", "#a3b3d4"], "letter-opener": ["blade"], "stapler-mace": ["mace"], "keyboard-sword": ["kbd"], "hole-punch-hammer": ["hammer"],
  "mop-halberd": ["pole"], "extinguisher-club": ["club"],
  "clipboard-shield": ["clip"], "binder-buckler": ["binder"], "serving-tray-aegis": ["tray"],
  "visor-cap": ["cap"], "hard-hat": ["hardhat"], headset: ["headset"],
  cardigan: ["coat", "#8e5a8f", "#ece4cf"], blazer: ["coat"], "hi-vis-vest": ["vest"], "pinstripe-suit": ["coat", "#4a4f7a", "#c83f38"],
  "wrist-brace": ["brace"], "rubber-gloves": ["glove", "#ffd05c"], "typing-mitts": ["glove"],
  sneakers: ["shoe", "#e8ecf8"], loafers: ["shoe"], "steel-toe-boots": ["boot"],
  "cable-tie-belt": ["belt", "#8793ae"], "leather-belt": ["belt", "#8e5a2b"], "tool-belt": ["belt", "#c8903a"],
  "paperclip-ring": ["clipring"], "rubber-band-ring": ["ring", "#f0e442", "#c83f38"], "lapel-badge": ["badge"],
  "id-card": ["card"], lanyard: ["lanyard"], "access-badge": ["card"],
  "lukewarm-coffee": ["mug", "#c86a38"], "strong-coffee": ["mug", "#8e3406"], "triple-espresso": ["mug", "#4a2a14"],
  "paper-cup-of-water": ["cup"], "water-bottle": ["bottle"], "cooler-jug": ["jug"],
};

/** Inline SVG icon for an item (by its base). Unknown bases get a plain box so a new base never breaks the UI. */
export function itemIcon(item) {
  const w = item.w ?? 1, h = item.h ?? 1, W = w * U, H = h * U, [g, a, b] = BASE[item.base] ?? ["box"];
  return svg(w, h, G[g](W, H, a, b));
}

// Skill glyphs for the HUD slots and the skills panel (one 40x40 cell).
const SKILL = {
  "stapler-throw": () => r(4, 14, 32, 12, "#c83f38", 4) + r(4, 10, 32, 6, "#d3dcea", 2, 2) + line("M8 30h6M18 30h6M28 30h6", "#d3dcea", 2),
  "reply-all": () => r(4, 10, 32, 22, "#ece4cf", 3) + p("M4 12L20 24L36 12", "none", 3) + line("M10 36h20", "#ffb81f", 3),
  "coffee-break": () => G.mug(40, 40),
  mute: () => c(20, 20, 13, "#8793ae") + line("M9 31L31 9", "#ff8f80", 4),
  "dress-code": () => G.coat(40, 40),
  hustle: () => p("M22 4L10 22H19L16 36L30 16H21Z", "#ffe27a", 2),
};
export function skillIcon(id) {
  if (id === "strike") return `<svg class="ic" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g stroke="${OL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${G.kbd(80, 80)}</g></svg>`;
  const body = SKILL[id];
  return body ? `<svg class="ic" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g stroke="${OL}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body()}</g></svg>` : "";
}

const MARK = {
  normal: '<rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"/>',
  magic: '<path d="M8 1L15 8L8 15L1 8Z" fill="currentColor"/>',
  rare: '<path d="M8 .8l2.2 4.6 5 .7-3.6 3.5.9 5L8 12.2l-4.5 2.4.9-5L.8 6.1l5-.7z" fill="currentColor"/>',
  unique: '<path d="M1 13V4l4 4 3-6 3 6 4-4v9z" fill="currentColor"/>',
};
/** Rarity mark: square (common), diamond (magic), star (rare), crown (unique). */
export const rarityMark = (rarity, size = 13) => `<svg class="mk" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true">${MARK[rarity] ?? MARK.normal}</svg>`;
export const arrow = (up) => `<svg class="ar" viewBox="0 0 14 14" aria-hidden="true">${up ? '<path d="M7 1l6 11H1z"/>' : '<path d="M7 13L1 2h12z"/>'}</svg>`;
export const coinIcon = () => `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="#ffd43b" stroke="${OL}" stroke-width="2.5"/><path d="M10 5v10M7 8h5a2 2 0 010 4H7" fill="none" stroke="${OL}" stroke-width="2"/></svg>`;
export const MARK_IDS = Object.keys(MARK);
