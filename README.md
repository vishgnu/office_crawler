# Office Crawler (working title)

A browser action-RPG tribute to the classic isometric hack-and-slash genre, set in an office.
**Also the harness's second target project**: it is built with the agents and conventions in `../harness/`,
with the `customer-proxy` agent standing in for the user, to find and fix weaknesses in the harness.

Start at `docs/product/STATE.md`. Harness learnings are logged in `docs/harness-learnings.md`.

## CI

`.github-workflows/ci.yml` is the CI workflow (`npm ci`, `npm test`, build, `npm run e2e` with Playwright 1.56.1 chromium, advisory `npm run bench`, and a check that `play/index.html` equals `dist/index.html`). GitHub only runs workflows from the repository root, so it does not run from this folder: copy it to `.github/workflows/office-crawler-ci.yml` in the repository root to enable it.

## Saves

The save lives in `localStorage` under `office-crawler.save`. Quit to title, floor changes, victory and leaving the page save it. A damaged, replaced or newer-version save is kept as a backup (three rotating copies, `office-crawler.save.corrupt`, `.1`, `.2`) and can be exported from the title screen. Dropped loot on the floor and monster positions are not saved. Two tabs share one slot; the last writer wins.
