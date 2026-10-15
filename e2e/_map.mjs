import { launch, open, startNew } from "./helpers.mjs";
const b = await launch();
const g = await open(b, { query: "test=1&seed=3", viewport: { width: 390, height: 844 }, lobby: true });
await startNew(g.page, {}); await g.app("step", 5); await g.app("ui.open", "map"); await g.page.waitForTimeout(400);
await g.page.screenshot({ path: "/tmp/claude-0/shots/map-m.png", clip: { x: 0, y: 0, width: 390, height: 200 } });
await b.close();
