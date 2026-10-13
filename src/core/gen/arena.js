// The Executive Suite (depth 9): a hand-built boss arena. One boardroom, one vestibule with the way back up, and the boss on
// the dais. Fixed layout (the seed only feeds the floor seed); no population, the boss is the single spawn (R-045, QF-04-5).
import { WALL, STAIRS_UP } from "../tiles.js";
import { carveRooms, carveCorridor, placeDoors } from "./rooms.js";
import { strings } from "../content/strings.js";
import { config } from "../config.js";
import { hash32 } from "../hash.js";

const W = 34, H = 38;

export function generateArena(seed = 0) {
  const tiles = new Array(W * H).fill(WALL);
  const rooms = [{ x: 4, y: 4, w: 26, h: 18, kind: "boardroom" }, { x: 12, y: 27, w: 10, h: 6, kind: "boardroom" }];
  carveRooms(tiles, W, rooms);
  carveCorridor(tiles, W, { x: 17, y: 30 }, { x: 17, y: 13 }, false);
  placeDoors(tiles, W, rooms);
  const entry = { x: 17, y: 30 }, bossTile = { x: 17, y: 8 };
  tiles[entry.y * W + entry.x] = STAIRS_UP;
  const at = [
    ["reception-desk", 15, 5], ["reception-desk", 16, 5], ["reception-desk", 17, 5], ["reception-desk", 18, 5], ["reception-desk", 19, 5],
    ["filing-cabinet", 9, 11], ["filing-cabinet", 25, 11], ["filing-cabinet", 9, 17], ["filing-cabinet", 25, 17],
    ["plant", 5, 5], ["plant", 28, 5], ["plant", 5, 20], ["plant", 28, 20], ["plant", 13, 28], ["plant", 20, 28],
  ];
  const props = at.map(([type, x, y], i) => ({ id: `pr${i + 1}`, type, x, y, blocks: type !== "chair" }));
  return {
    depth: config.bossDepth, seed: hash32(seed, config.bossDepth), theme: "executive", name: strings.arenaName, arena: true, bossStairs: false,
    w: W, h: H, tiles, rooms, entry, exit: null, props, npcs: [], budget: 0,
    spawns: [{ type: "regional-director", tile: bossTile, packId: null, tier: "boss" }],
  };
}
