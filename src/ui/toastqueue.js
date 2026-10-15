// The toast lane (CR7-04, CR7L-01, CR7L-02): which one-line message is on screen and which wait. Pure logic: the clock, timers and the
// `show(n)` callback are injected, so the rules are unit-tested without a DOM.
//   quest line   holds the lane for its whole time (n.ms); later lines wait behind it. A quest line that comes more than burstMs after the one on show replaces it at once.
//   direct line  (a refusal, a hint) replaces a world line on show at once, but never cuts a held quest line short (it waits behind it) and never empties the waiting list.
//   passive line (level-up, floor name, potion...) waits behind a held line.
//   One dispatch (begin/end) collects its lines first and orders them quest, direct, passive, so a level-up that the same reward caused is shown after the reward line instead of being overwritten by it (CR7L-01).
// Every line that goes on screen is passed to show() exactly once, which is where the live region is written; a line that never goes on screen (the same text already shown or waiting, the cap) is a duplicate by text.
const PRI = (opt) => (opt.quest ? 0 : opt.passive ? 2 : 1);

export function createToastQueue({ show, now = () => performance.now(), setT = setTimeout, clearT = clearTimeout, burstMs = 250, cap = 8, holdMs = 3200 }) {
  const tq = { q: [], timer: 0, until: 0, at: 0, text: null, quest: false };
  let batch = [], depth = 0;
  const held = () => tq.until > now();
  function display(n) {
    clearT(tq.timer); tq.timer = 0; tq.until = 0; tq.at = now(); tq.text = n.text; tq.quest = n.pri === 0;
    if (n.hold || tq.q.length > 0) { // lines are waiting: this one keeps the lane for its time so they are not stranded
      tq.until = now() + (n.ms ?? holdMs);
      tq.timer = setT(() => { tq.timer = 0; tq.until = 0; const nx = tq.q.shift(); if (nx) display({ ...nx, hold: true }); }, n.ms ?? holdMs);
    }
    show(n);
  }
  function place(n) {
    if (!held() || (n.pri === 0 && now() - tq.at >= burstMs)) return display(n);
    if (n.pri === 1 && !tq.quest && n.text !== tq.text) return display(n); // direct feedback only waits behind a quest line; a world line on show is replaced (the waiting list is kept)
    if (n.text === tq.text || tq.q.some((w) => w.text === n.text)) return;
    if (n.kind === "floorEnter") tq.q = tq.q.filter((w) => w.kind !== "floorEnter"); // only the latest floor name waits: a backlog of stale names never builds up
    let i = tq.q.length;
    while (i > 0 && tq.q[i - 1].pri > n.pri) i--;
    tq.q.splice(i, 0, n);
    while (tq.q.length > cap) tq.q.pop();
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
