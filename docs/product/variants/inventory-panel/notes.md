# Notes: inventory panel variants

## A Classic split
- Employee File (left half) and Desk Drawer (right half) both open together, like the genre convention. The sheet shows attributes beside derived stats, the unmet-gear list and the stat preview without scrolling at 1280x800.
- Suits players who want to allocate points and compare gear in one glance. Costs the whole play area: the game is fully dimmed and hidden while either panel is open.
- Tooltip lands over the other panel (it opens beside the right panel), so the sheet is partly covered during hover.
- Effort S to M: a plain two-panel layout, the shared inventory code is reused by B and C.

## B Briefcase
- One centred case with Gear and Employee File tabs (I and C jump to a tab, arrow keys switch tabs). Strongest theme: leather, stitching, clasps and file-folder tabs.
- Fits phone and desktop with the same structure; the Gear tab has the doll and grid side by side, the Employee File tab adds a "current kit" list. Trade-off: cannot see the sheet and the gear together, so a point spent on Grit cannot be checked against item requirements without switching tabs (the unmet-gear list is on the sheet, the "!" marks are on the gear).
- Hides the game completely while open. Effort M (tab handling, the extra case art).

## C Side drawer
- Narrow drawers slide in from the screen edges and leave the middle of the play area visible and lit, so combat stays readable while managing gear (screen edges are dimmed only). Edge tabs and HUD buttons open them.
- Tightest layout: cells are 38 px (A 44, B 50), the Employee File scrolls slightly at 800 px height. The tooltip opens toward the centre and can cover the game view and the belt.
- Suits a game with constant action; the risk is small targets and a long tooltip over the game. Effort M (slide animation, tighter sizes).
