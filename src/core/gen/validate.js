// Checks every generated floor must pass; the generator retries or falls back when it fails.
import { buildGrid, flood } from "../grid.js";
import { STAIRS_UP, STAIRS_DOWN } from "../tiles.js";
import { config } from "../config.js";

export function validateFloor(floor) {
  const errors = [];
  const { w, h, tiles } = floor;
  const count = (code) => tiles.reduce((n, t) => n + (t === code ? 1 : 0), 0);
  if (count(STAIRS_UP) !== 1) errors.push("needs exactly one entry");
  if (count(STAIRS_DOWN) !== 1) errors.push("needs exactly one exit");
  if (floor.rooms.length < config.minRooms) errors.push("too few rooms");
  const grid = buildGrid(floor);
  const { dist } = flood(grid, floor.entry.x, floor.entry.y);
  if (dist[floor.exit.y * w + floor.exit.x] < 0) errors.push("exit not reachable");
  for (let i = 0; i < w * h; i++) if (grid.walk[i] && dist[i] < 0) { errors.push("unreachable walkable tile"); break; }
  return { ok: errors.length === 0, errors };
}
