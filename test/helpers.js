// Shared test helpers (no tests in this file). Fixtures are drawn as ASCII maps:
// '#' wall, '.' floor, '@' player start (entry stairs), '>' exit stairs.
import { newGame, step, spawnMonster } from "../src/core/index.js";

export function floorFromRows(rows) {
  const h = rows.length, w = rows[0].length, tiles = [];
  let entry = null, exit = null;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`row ${y} has the wrong width`);
    [...row].forEach((ch, x) => {
      tiles.push(ch === "#" ? 2 : ch === "@" ? 4 : ch === ">" ? 5 : 1);
      if (ch === "@") entry = { x, y };
      if (ch === ">") exit = { x, y };
    });
  });
  if (!entry) throw new Error("fixture needs an '@'");
  return { depth: 1, seed: 1, theme: "open-plan", w, h, tiles, rooms: [], entry, exit, props: [], spawns: [] };
}

/** A game on an ASCII floor; monsters = [[type, x, y, packId?], ...]. `opts` goes to newGame (for example { class: "sales-rep" }). */
export function gameOn(rows, monsters = [], seed = 1, opts = {}) {
  const state = newGame(seed, { ...opts, floor: floorFromRows(rows) });
  for (const [type, x, y, packId] of monsters) {
    if (!spawnMonster(state, type, { x, y }, packId ?? null)) throw new Error(`cannot spawn ${type} at ${x},${y}`);
  }
  return state;
}

export const run = (state, n, inputs = []) => { for (let i = 0; i < n; i++) step(state, i === 0 ? inputs : []); return state; };

/** Reference breadth-first search on an ASCII map, same movement rules as the game. Returns steps or -1. */
export function bfsSteps(rows, a, b) {
  const open = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] !== "#";
  const dist = new Map([[`${a.x},${a.y}`, 0]]), queue = [a];
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    if (x === b.x && y === b.y) return dist.get(`${x},${y}`);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if ((!dx && !dy) || !open(x + dx, y + dy)) continue;
      if (dx && dy && (!open(x + dx, y) || !open(x, y + dy))) continue;
      const k = `${x + dx},${y + dy}`;
      if (!dist.has(k)) { dist.set(k, dist.get(`${x},${y}`) + 1); queue.push({ x: x + dx, y: y + dy }); }
    }
  }
  return -1;
}

/** Replay a recorded input script: { seed, ticks, inputs: [{ tick, input }] }. `opts` goes to newGame (for example { class: "it-wizard" }). */
export function replay(script, opts = {}) {
  const state = newGame(script.seed, opts);
  for (let t = 0; t < script.ticks; t++) step(state, script.inputs.filter((i) => i.tick === t).map((i) => i.input));
  return state;
}

export const OPEN = [
  "####################",
  "#..................#",
  "#..................#",
  "#..................#",
  "#........@.........#",
  "#..................#",
  "#..................#",
  "#..................#",
  "####################",
];
