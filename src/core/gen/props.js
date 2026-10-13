// Decorates rooms with office props without ever splitting the walkable area.
import { buildGrid, flood } from "../grid.js";
import { props as propDefs, propsByRoomKind } from "../content/props.js";

export function placeProps(rng, floor) {
  const { w } = floor;
  const taken = new Set([floor.entry, floor.exit].map((t) => t.y * w + t.x));
  const nearStairs = (x, y) => [floor.entry, floor.exit].some((t) => Math.abs(t.x - x) <= 1 && Math.abs(t.y - y) <= 1);
  const walkableCount = () => buildGrid(floor).walk.reduce((a, b) => a + b, 0);
  for (const room of floor.rooms) {
    const def = propsByRoomKind[room.kind];
    if (!def) continue;
    const n = Math.floor(room.w * room.h * def.density);
    for (let i = 0; i < n; i++) {
      const type = rng.pick(def.types);
      const blocks = propDefs[type].blocks;
      // Blocking props keep one tile off the walls so doorways stay open.
      const m = blocks ? 1 : 0;
      const x = rng.int(room.x + m, room.x + room.w - 1 - m), y = rng.int(room.y + m, room.y + room.h - 1 - m);
      if (taken.has(y * w + x) || nearStairs(x, y)) continue;
      const prop = { id: `pr${floor.props.length + 1}`, type, x, y, blocks };
      floor.props.push(prop);
      if (blocks) {
        // Reject a blocker that cuts off part of the floor (flood from entry must still see every walkable tile).
        const grid = buildGrid(floor);
        const reached = flood(grid, floor.entry.x, floor.entry.y).count;
        if (reached !== walkableCount()) { floor.props.pop(); continue; }
      }
      taken.add(y * w + x);
    }
  }
}
