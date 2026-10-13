// Page loads from file://, shows the title screen, ships no hook without ?test=1, makes no foreign requests.
import { launch, open, check, finish } from "./helpers.mjs";

const browser = await launch();
{
  const g = await open(browser, { query: "seed=5", wait: false });
  await g.page.waitForSelector('[data-testid="new-game"]', { timeout: 15000 });
  check("AC-R-123-1 / AC-NFR-S01-1 window.__app is undefined without ?test=1", (await g.page.evaluate(() => typeof window.__app)) === "undefined");
  check("title screen offers New game (text from the string table)", (await g.page.textContent('[data-testid="new-game"]')) === "New game");
  check("AC-R-102-4 document title is the working title", (await g.page.title()) === "Office Crawler");
  check("AC-R-110-3 no plug-in elements", (await g.page.locator("object, embed, applet").count()) === 0);
  check("AC-NFR-B03-1 no account or login inputs", (await g.page.locator('input[type=password], input[type=email]').count()) === 0 && !/log in|sign in|account/i.test(await g.page.innerText("body")));
  check("CSP meta tag present", (await g.page.locator('meta[http-equiv="Content-Security-Policy"]').count()) === 1);
  check("AC-R-110-1 no page error / console.error on load", g.errors.length === 0, g.errors);
  check("AC-NFR-O02-1 only file:// or data: requests", g.requests.every((u) => /^(file|data|blob):/.test(u)), g.requests);
  await g.page.click('[data-testid="new-game"]');
  await g.page.waitForSelector('[data-testid="new-game"]', { state: "detached" });
  check("clicking New game leaves the title screen", (await g.page.locator(".screen").count()) === 0);
  await g.context.close();
}
{
  const g = await open(browser, { query: "test=1&seed=5" });
  check("AC-NFR-S01-1 window.__app defined with ?test=1", (await g.page.evaluate(() => typeof window.__app)) === "object");
  const s = await g.state();
  check("AC-R-110-1 scene is title on load", s.scene === "title" && s.ui.menu === "title");
  check("AC-R-076-1 title offers New game", (await g.page.locator('[data-testid="new-game"]').count()) === 1);
  await g.page.click('[data-testid="new-game"]');
  const s2 = await g.state();
  check("AC-R-001-2 clicking New game starts a floor", s2.scene === "floor" && s2.seed === 5, { scene: s2.scene, seed: s2.seed });
  check("no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}
await browser.close();
finish("smoke");
