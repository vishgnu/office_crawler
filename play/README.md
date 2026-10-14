# Play Office Crawler

Open `index.html` in a desktop browser (double-click works; no install, no server, no internet).
This is a prebuilt copy of `dist/index.html`. Rebuild with `npm install && npm run build` in `office-crawler/`.

Controls: left click = move/attack/pick up · right click = cast the selected skill · F1–F4 = select skill ·
1–4 = belt potions · I = Desk Drawer (inventory) · C = Employee File · S = skills · M/Tab = map · Esc = menu.
Options (title or pause menu): volumes, **sound kit (foley / gothic / chiptune)**, key remapping, high contrast, text size.

## Hosting on Azure Storage (static website)

1. Storage account (Standard, LRS) → **Data management → Static website** → Enabled, index document `index.html`.
2. Upload `index.html` and `robots.txt` from this folder into the `$web` container (portal or Storage Explorer); check that
   Content-Type is `text/html` for `index.html`.
3. Open the **primary endpoint** (`https://<account>.<zone>.web.core.windows.net/`), not the blob URL
   (`…blob.core.windows.net/$web/…` answers `PublicAccessNotPermitted`, which is correct; leave anonymous blob access off).

Bots and crawlers: `robots.txt` and the page's `noindex, nofollow` tag keep well-behaved crawlers out. To restrict who can
open it, use the storage firewall (Networking → selected networks → your IP; test from another network) or move to
Azure Static Web Apps with login. Set a budget alert (Cost Management → Budgets). Saves stay in each visitor's browser.
