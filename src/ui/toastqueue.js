// The toast lane (CR7-04, CR7L-01, CR7L-02): which one-line message is on screen and which wait. Pure logic: the clock, timers and the
// `show(n)` callback are injected, so the rules are unit-tested without a DOM.
//   quest line   holds the lane for its whole time (n.ms); later lines wait behind it. A quest line that comes more than burstMs after the one on show replaces it at once.
//   direct line  (a refusal, a hint) replaces a world line on show at once, but never cuts a held quest line short (it waits behind it), never cuts another direct line short before it
//                has been on screen minMs (two refusals of one dispatch both show, one after the other), and never empties the waiting list (CR8-05).
//   passive line (level-up, floor name, potion...) waits behind a held line.
//   One dispatch (begin/end) collects its lines first and orders them quest, direct, passive, so a level-up that the same reward caused is shown after the reward line instead of being overwritten by it (CR7L-01).
// Every line that goes on screen is passed to show() exactly once, which is where the live region is written; a line that never goes on screen is a duplicate by text (the same text already shown or waiting) or a dropped world/direct line.
// The cap (CR8-05) drops the oldest waiting world line first, then the oldest direct line; a quest line is never dropped (its live-region announcement may be the only channel a player has), so
// the waiting list can exceed the cap by quest lines only.
const QP = [1, 0, 2]; // queue order by class (quest 0, direct 1, passive 2 -> rank): direct, quest, passive
const PRI = (opt) => (opt.quest ? 0 : opt.passive ? 2 : 1);

export function createToastQueue({ show, now = () => performance.now(), setT = setTimeout, clearT = clearTimeout, burstMs = 250, cap = 8, holdMs = 3200, minMs = 700 }) {
  const tq = { q: [], timer: 0, until: 0, at: 0, text: null, quest: false, pri: 2 };
  let batch = [], depth = 0;
  const held = () => tq.until > now();
  function display(n) {
    clearT(tq.timer); tq.timer = 0; tq.until = 0; tq.at = now(); tq.text = n.text; tq.quest = n.pri === 0; tq.pri = n.pri;
    if (n.hold || tq.q.length > 0) { // lines are waiting: this one keeps the lane for its time so they are not stranded
      tq.until = now() + (n.ms ?? holdMs);
      tq.timer = setT(() => { tq.timer = 0; tq.until = 0; const nx = tq.q.shift(); if (nx) display({ ...nx, hold: true }); }, n.ms ?? holdMs);
    }
    show(n);
  }
  function place(n) {
    if (!held() || (n.pri === 0 && now() - tq.at >= burstMs)) return display(n);
    if (n.pri === 1 && !tq.quest && (tq.pri === 2 || now() - tq.at >= minMs) && n.text !== tq.text) return display(n); // direct feedback only waits behind a quest line; a world line on show is replaced (the waiting list is kept)
    if (n.text === tq.text || tq.q.some((w) => w.text === n.text)) return;
    if (n.kind === "floorEnter") tq.q = tq.q.filter((w) => w.kind !== "floorEnter"); // only the latest floor name waits: a backlog of stale names never builds up
    let i = tq.q.length;
    while (i > 0 && QP[tq.q[i - 1].pri] > QP[n.pri]) i--; // in the queue a direct line goes ahead of the quest lines that wait too (it never cuts the one on screen short)
    tq.q.splice(i, 0, n);
    while (tq.q.length > cap) {
      let k = -1;
      for (const pri of [2, 1]) { for (let j = 0; j < tq.q.length && k < 0; j++) if (tq.q[j].pri === pri) k = j; if (k >= 0) break; }
      if (k < 0) break; // only quest lines are left: none is dropped
      tq.q.splice(k, 1);
    }
  }
  return {
    /** `opt.quest` holds the lane; `opt.passive` is a world line; neither is a direct line. `opt.kind` names the event, `opt.qid` the quest. */
    offer(text, ms, opt = {}) {
      const n = { text, ms, hold: !!opt.quest, kind: opt.kind, qid: opt.qid, pri: PRI(opt) };
      if (depth > 0) batch.push(n); else place(n);
    },
    begin() { depth++; },
    end() {
      if (depth === 0 || --depth > 0) return;
      const items = batch; batch = [];
      if (items.length > 1) items.sort((a, b) => a.pri - b.pri); // stable: event order inside a class
      if (items.length > 1 && !held()) items[0].hold = true; // the first line of a burst keeps the lane so the others take their turn behind it
      for (const n of items) place(n);
    },
    drop(qid) { if (qid) { tq.q = tq.q.filter((w) => w.qid !== qid); batch = batch.filter((w) => w.qid !== qid); } },
    reset() { tq.q.length = 0; batch = []; depth = 0; clearT(tq.timer); tq.timer = 0; tq.until = 0; tq.text = null; },
    waiting: () => tq.q.map((w) => w.text),
    held,
  };
}
