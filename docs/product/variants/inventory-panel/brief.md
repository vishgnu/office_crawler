# Brief: inventory panel, equipment and Employee File (slice S2)

## Question being decided
How should the in-game inventory/equipment panel and the character sheet be laid out and opened? S2 adds items, equipment,
attributes and levelling, so the player will open these panels constantly. The choice sets how much of the play area stays
visible, how fast items can be compared and swapped, and what the phone view looks like.

## Requirements involved
- R-050..R-053, R-055 items, rarity, affixes, equipment slots (ten slots: head, ID badge/amulet, body, gloves, shoes, belt, weapon, off-hand, 2 rings), 10x4 grid with items from 1x1 to 2x4
- R-054 requirements (level, attribute); no durability (Q3)
- R-056 potion belt on keys 1-4 (potions never share keys with skills; skills are F1-F4 plus right mouse, QF-01-4)
- R-057 gold shown with the inventory
- R-061 hover tooltip with comparison to the equipped item (numeric difference per stat)
- R-011, R-012, R-016 attributes, derived stats, stat-point allocation, preview of what the next point does, items whose requirements are not yet met
- R-072, R-073 character panel (key C) and inventory panel (key I)
- R-051-2, NFR-A03 rarity never by colour alone (mark shape + border pattern + word + colour); NFR-A04 text contrast >= 4.5:1
- R-102, R-103 original office-themed names (no names from the genre original)

## Fixed by the frozen art direction (C2) and shared by all three variants
- C2 palette: dark purple plates with thick near-black outlines and an inner rim line, Okabe-Ito rarity colours (sky blue magic, yellow rare, vermillion unique), Trebuchet-style sans, the coffee-mug health and water-jug mana vessels and the bottom bar (skill slots F1-F4, belt 1-4) as in the ported game shot.
- Office re-expression: character sheet = "Employee File" (paper sheet with a probation stamp), inventory = "Desk Drawer", amulet slot = "ID badge", gloves, shoes, belt. Gold is plain "gold".
- Same 19 synthetic items (12 in the drawer, 5 equipped, 2 potions on the belt): normal / magic / rare / unique, original pun names and plausible affixes. Comparison cases: **Reorg Letter Opener** (rare weapon) is better than the equipped **Ergonomic Keyboard of Haste**; **Threadbare Hi-Vis Vest** is worse than the equipped **Pinstripe Blazer**; **The Corner Office Keycard** (unique) is better but needs level 8 (player is 7, so it is marked unmet); **Fingerless Gloves of Dexterity** need Agility 10 (player has 9, one stat point unlocks them). A two-handed **Splintered Chair Leg** shows the off-hand rule (QF-05-4).
- Interaction (simulated, no backend): I and C open/close, Esc closes or puts a held item back, drag and drop or click-then-click, swap on overlap with one item, rejection with a message otherwise (does not fit, overlaps two items, wrong slot, requirement not met), potion keys 1-4 (potion consumed, health/mana vessel moves), "+" on an attribute (spends a point, derived stats update, previewed on hover/focus).
- Keyboard: Tab to slots and belt, arrow keys inside the grid (one tab stop), Enter/Space picks up and places, tooltips show on focus, visible focus ring, live region announces results.
- Rarity key (mark, border style, name) is shown inside the inventory panel. Text contrast was measured in the browser for all visible text in both desktop and phone layouts (no pair below 4.5:1).
- Test hooks: `window.__ready = true` after render; `?open=inv|char|both`; `?hover=<itemId>` (item ids: kbd, blazer, lanyard, signet, loafers, opener, vest, keycard, headset, gloves, cinch, overtime, clipboard, chairleg, staples, coffee, energy).
- Each file is one self-contained HTML (about 53-56 KB), no external requests. The game view behind is a static dimmed canvas drawing, not the real renderer.

## What differs (the decision)
| | A Classic split | B Briefcase | C Side drawer |
|---|---|---|---|
| Layout | two half-screen panels, Employee File left, Desk Drawer right | one centred briefcase, tabs Gear / Employee File | slim drawers slide in from left and right edge |
| Both visible at once | yes | no (one tab at a time) | yes |
| Play area visible | no (dimmed) | no (dimmed) | yes, centre ~480 px stays clear |
| Tooltip placement | beside the panel, over the other panel | beside the item, over the doll | beside the drawer, over the play area |
| Phone | panels stack and scroll | same case, tabs | same stack as A |

## Files
`A.html`, `B.html`, `C.html`, `notes.md`, `decision.md`, `shots/` (1280x800 compare shot and 390x844 shot per variant; B's phone shot shows the Employee File tab).
