# Visual review r1: character selection screen

Date: 2026-10-14. Reviewer: visual-reviewer. Lens: appeal + craft + usability (appeal weighted heavily; the customer asked for "a visually appealing character selection screen").
Own screenshots (Playwright, Chromium) in `/tmp/claude-0/vr-cs/`: per variant `-d-sel0/1/2` (1280x800), `-d-load`, `-m-sel0/1/2` and `-m-load` (390x844), `-d-f20/50/80` (mid-flourish frames), `-kbd-load`. Compared against `docs/shots/final-lobby.jpg` and `docs/shots/polish-title.jpg`. Skill names ignored (placeholders, ADR-0005). No page errors in any variant.

## Scores (1-5, /40)

| Criterion | A Lobby | B Files | C Elevator |
|---|---|---|---|
| 1 First impression | 5 | 4 | 4 |
| 2 Readability | 4 | 3 | 3 |
| 3 Cohesion with game | 5 | 2 | 4 |
| 4 Colour and contrast | 4 | 4 | 4 |
| 5 Composition, hierarchy | 4 | 4 | 3 |
| 6 Motion and feedback | 4 | 4 | 4 |
| 7 Theme and tone | 4 | 4 | 4 |
| 8 Polish | 4 | 3 | 4 |
| **Total** | **34, ship-range (no item <3)** | **28, iterate** | **30, iterate** |

Evidence, one line each:
- A: A-d-sel1/sel2: three full-length characters in a lit Lobby, chosen one steps forward into a cone and white ring, the same ring as in final-lobby.jpg; accent colour (orange / pink / cyan) carries into chips, bars and icons. Best "I want to play this" read of the three.
- B: B-d-sel0: the manila-and-wood desk is charming and the polaroid plus SELECTED stamp is a delight, but the cream form is the only light-theme screen in a dark game (polish-title, final-lobby are both dark), and the folders overlap so the neighbours' names are cut ("FACILIT MANAG", "S I").
- C: C-d-sel1: strongest single-moment drama (lit car, indicator, floor spill), but two of three classes are two identical grey doors, so the player cannot compare; the figure is ~190 px tall on an 800 px screen.

## The three class figures (judged in A, B, C renders)
- Silhouettes are distinct and readable even at the small sizes in A (unchosen, dimmed) and in the B badge busts: Facilities = wide, bulky, tall hat and a long wrench diagonal; Sales = slim, pink suit, headset, a business-card fan to one side; IT = hunched hoodie with a laptop and floating keycaps (widest at head height). Different hair/hat shapes (yellow helmet, blonde swoop, dark spikes) help at bust size (load dialog thumbnails are told apart instantly).
- Roles read at a glance: yes. Hi-vis vest plus wrench = maintenance, suit plus headset = sales, hoodie plus laptop = IT. Palette per class (orange, pink, cyan on desaturated bodies) is colour-blind-safe enough because the shape and prop differ, not only the hue. Facilities and Sales are both warm and the two dim figures in A are close in value; watch that.
- Fit with the in-game look: line weight and one-shade fill match the C2 sprites, but the figures are far bigger and more detailed (full beard, hand props) than the in-world ~60 px heroes in final-lobby.jpg, and are front-on, not isometric (notes.md already flags this). The in-world hero is a plain blue-shirted worker, so players will not recognise "their" class when the game starts unless the in-world sprite carries the same hat, vest, suit or hoodie.
- Nits: Facilities Manager's face is dense at bust size (beard + helmet shadow, B badge); IT Wizard's keycap labels (Ctrl / Alt / F5 / Esc) are illegible in the B badge and in motion; the Sales Rep's right-hand stapler is a thin grey bar that vanishes against the dim floor in A.

## Load dialog (5 slots), same in all three
- Works well: portrait, class, level, depth, play time and last played per row; empty Slot 5 uses a dashed "+" tile and "New game here"; first Load button receives a bright cyan focus ring; scrim dims the screen behind it (A-d-load, B-d-load, C-d-load). Phone version (A-m-load, C-m-load) stacks the button full width under each row and fits exactly in 844 px.
- Problems: (1) Esc closes it but focus drops to `<body>` (keyboard test: after Esc `document.activeElement` is BODY, not the Load game button), so the next Tab restarts at the first class. (2) All four filled slots look identical, with nothing to say which is the newest or the one "Continue" would pick; add a "most recent" chip. (3) On phone the dialog fills the whole viewport, Close sits at the very bottom edge, and there is no sticky header. (4) In B the dialog is dark purple over the cream paper: consistent with the other variants but not with B's own paper look.

## Keyboard flow (tested)
Tab order is identical in all: class radiogroup (one stop, arrows move inside) then Name, Suggest, Start, Load game; a visible focus ring exists. L opens the dialog with focus on the first Load button, Esc closes it. Issue: focus not restored on close (above). Start is visibly dim until a name is typed in all three (olive in A and C, washed-out beige in B); the disabled state reads as broken, and the reason ("type a name") appears nowhere near the button.

## Phone layout (390x844)
- A: scene as a 390x320 banner, chips under it, panel below; everything fits without scroll, stats are readable. Characters shrink to ~110 px but still read. Best of three.
- B: folders fan across the top, polaroid becomes a wide banner with the figure only ~90 px tall in a lot of pink; engaging but the hero is the weakest here. Folder tabs ("FACILITIES") are cropped.
- C: cars become a 390x240 strip; the open car is narrow and the figure is ~100 px; the other two cars are slim grey slabs. Fits, but the class chips (FACILITIES / MANAGER wrapped in two lines) are small tap targets in all three, around 32 px tall; raise to 44 px.

## Ranking
1. **A Lobby lineup** (34/40). Gives the customer the most appealing, game-faithful screen, shows all three classes at once, lowest effort and risk, and the best phone result.
2. **C Elevator doors** (30/40). Best drama and a good story hook (the game descends by elevator), but hides two of three classes.
3. **B Personnel files** (28/40). Most charming joke and strongest phone concept, but breaks the dark game look and the figures are small.

## Pick: A, with fixes

### Top 5 fixes for A
1. **Make the selected figure the hero on the stage and fix the framing** (A-d-sel0): Facilities steps forward to the extreme left edge, the light cone and ring are cut at x=0 while Sales and IT are centred. Re-space slots (for example 22 / 50 / 78 percent of the stage width, so each forward-stepped figure and its ring fit) and let the cone stay inside the stage.
2. **Let the unchosen two read better** (A-d-sel1): the two dimmed figures sit in near-same dark values as the floor and lose their props (stapler, laptop edge). Cap the dim at roughly 70 percent brightness, keep the 1 px rim light, and add a small hover lift so they invite a click; also put the class chips closer to the feet and enlarge them (A-d-sel0, chips about 28 px high).
3. **Fill the info panel's dead zone and strengthen the hierarchy** (A-d-sel0/1/2): the right column has 180-200 px of empty purple between Skill branches and the name form, while the form is small. Either centre-lock a class emblem or portrait plus a one-line "playstyle" quote in the gap, or enlarge the name field and Start (primary action) so Start is the brightest object in the panel.
4. **Fix Start's disabled state** (A-d-sel0): olive-brown with dark text looks muddy and unclickable; use the class accent at 40 percent with a visible hint "Type a name to start" and keep contrast at 4.5:1 for the text.
5. **Close the keyboard and phone loose ends**: restore focus to Load game on Esc / Close; sticky header and Close in the phone dialog; enlarge phone class chips to 44 px height; add a "most recent" tag in the slot list.

### What to borrow
- From C: the three-column stats area below the stage (stats, pitch, branches in a wide row) would suit a phone-landscape or a short desktop window, and the indicator-light idea (a floor-level "ding" flash) can be a short pulse on the ring when switching class in A. A door gag can also be used as the transition into the game after Start (figure walks into the car, doors close).
- From B: the polaroid / SELECTED stamp as the confirmation beat after pressing Start; the ID-badge bust as a compact class card for the Load dialog and for a future in-game File screen; the typewriter "CONFIDENTIAL, FLOOR 0" micro-copy for flavour.
- From all: the shared load dialog is good; reuse unchanged apart from the focus fix.

### Why not C or B
- C: hidden classes make it a "pick blind" screen; the figure is clipped to the door frame, and the IT Wizard's spell circle and keycaps are cut by the frame (C-d-f20, C-d-sel2), losing the best flourish; each change costs about 1 s of door animation.
- B: paper theme departs from dark game UI; folders overlap and hide names; the figure shown is a small polaroid.

## Mid-animation frames (checked)
A-d-f20: IT Wizard Reboot with spell circle, keycaps flying, laptop glow, clearly readable and the most satisfying feedback of the three because it is unclipped. B-d-f20: the same effect inside the polaroid but the keycaps are crowded and tiny. C-d-f20: the doors are half-open, the indicator lights and the light is good, but the figure's effects are cropped.

## Keep
- A's lit-lobby stage, white selection ring and per-class accent colour carried into chips, bars and icons.
- The distinct figure silhouettes and props; the Reboot spell circle flourish.
- The shared Load dialog and the text-plus-number stat bars (not colour-only).
