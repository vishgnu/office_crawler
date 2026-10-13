// Floor themes (R-043, R-101): the Lobby (town, depth 0), open-plan offices (1-4) and the basement / server zone (5-8).
import { config } from "../config.js";

export const themes = {
  lobby: { id: "lobby", nameKey: "lobbyName", roomKinds: ["reception", "breakroom"] },
  "open-plan": { id: "open-plan", nameKey: "floorName", roomKinds: ["cubicle", "conference", "copy", "storage"] },
  executive: { id: "executive", nameKey: "arenaName", roomKinds: ["boardroom"] },
  basement: { id: "basement", nameKey: "basementName", roomKinds: ["server", "archive", "boiler", "storage"] },
};

export const themeForDepth = (depth) => (depth <= 0 ? "lobby" : depth >= config.bossDepth ? "executive" : depth <= config.zoneSplit ? "open-plan" : "basement");
