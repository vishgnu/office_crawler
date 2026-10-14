# Character selection screen: variants

Date: 2026-10-14. Topic `character-select`. Maker: prototyper.

## Question being decided
The real customer asked for "a visually appealing character selection screen" (third briefing, `../../00-brief.md`). How should the player meet the three classes and choose one: where does the character stand, how does the stage relate to the information, and how does it fit on a phone? Circle 2 (`../../circles/circle-02.md`) answered class concepts; the names below are working names and the final names stay escalated (R-233).

## Requirements involved
R-200 (three classes), R-202 (a skill tree per class), R-210 / R-211 (name and class, name rules 1 to 16 characters), R-212 (visually appealing, intent), R-213 (selection screen content), R-214 (keyboard, accessibility, performance), R-215 (flow title, slot, class, game), R-220 / R-222 / R-223 (five slots, slot preview, reachable from the screen), NFR-A07, NFR-P06.

## What all three variants share
- Same content: class name, one-line pitch, playstyle tags, four stat bars (Toughness, Damage, Speed, Reach, 1 to 5 plus the number, so not colour-only), difficulty (text plus three dots), the three skill-branch names with an icon each (branch names from circle 2), a name field (label, 1 to 16 characters with counter, Suggest button), Start, and Load game.
- Load game opens a dialog with the 5 slots (sample data: four filled, slot 5 empty; class, level, depth, play time, last played; class bust on each). Empty slot offers "New game here". Start shows which slot a new game will use.
- Frozen art style (C2): flat fill plus one shade, bold dark outline, one rim-light arc, oversized head. Three figures drawn on canvas, each with an idle loop and a 1.7 s "selected" flourish: Facilities Manager (wrench slam and shockwave), Sales Rep (fan of business cards and a stapler), IT Wizard (Reboot: spell circle, power glyph, flying keycaps).
- Input: mouse (click a class, buttons), keyboard (Left/Right or A/D, 1/2/3, Enter replays the flourish, L opens Load, N or / jumps to the name field, Esc closes the dialog, Tab order sane, visible focus ring), radiogroup semantics for the class choice. `prefers-reduced-motion` freezes idle and flourish.
- Screenshot hooks: `?frame=N` (deterministic, N frames at 60 fps, no animation loop), `?sel=0|1|2`, `window.__ready`. Extras: `?name=...` prefills the name, `?load=1` opens the slot dialog.
- Single file, no external requests, each about 43 to 46 KB. Dark theme only (the game is dark); contrast checked by eye on the rendered shots, not measured.

## Not in these variants
Name collision or profanity rules, overwrite and delete confirmations (R-221), the tree panel itself (only branch names and icons), sound, and any final class names or game title.

## Files
`A.html`, `B.html`, `C.html`, `notes.md`, `decision.md`, `shots/` (two JPEGs per variant), `figures.js` (the exported figure functions, identical to the marked FIGURES section in each HTML).
