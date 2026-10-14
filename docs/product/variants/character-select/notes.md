# Notes per variant

## A. Lobby lineup
- Three characters stand in the dimly lit Lobby; the chosen one steps forward (down and larger) into a ceiling-lamp cone and a banded light pool with a white selection ring, like the in-game selection ring. Info panel is a fixed column on the right (stacked above the form on a phone).
- Suits: players who want to compare the three bodies side by side and feel "the world"; best match to the in-game look (`docs/shots/final-lobby.jpg`) so the figures can later be reused as in-world sprites. Trade-off: the unchosen two are dimmed, so their pose detail is less visible; labels are small chips on the floor.
- Effort: M (one canvas scene, DOM panel). Closest to what the WORLD renderer already does; lowest risk for performance (one canvas, three figures).

## B. Personnel files
- Three manila folders with ID badges fan out on a wooden desk; choosing one lifts it and opens a paper "file" with a polaroid of the character (full figure plays the flourish, a SELECTED stamp slams down), stat form, branches and the name line. Paper theme (dark ink on cream), typewriter labels.
- Suits: the customer who wants the office joke front and centre, and the most phone-friendly layout (photo becomes a banner, folders fan across the top). Trade-off: the characters appear small (badge busts and one photo), only one is shown full-length at a time, and the paper look departs from the dark game UI; the name field doubles as a form line.
- Effort: M (DOM and CSS carry most of it; four small canvases). The desk props are static art that need redrawing if the style shifts.

## C. Elevator doors
- Each class waits in its own elevator car. Choosing a car opens its doors with a bright light, a floor spill and a "ding" flash on the indicator; the figure plays the flourish inside while the other doors stay shut with a thin light seam. Stats sit below in three columns.
- Suits: the most dramatic reveal and the clearest "one at a time" focus; fits the game's elevator descent. Trade-off: closed cars hide the other two classes completely (the player must open a car to see who is inside), the stage is the least dense, and the figure is clipped to the door frame, which limits big flourish effects. Needs a short wait (about 1 s) for the doors on each change.
- Effort: M. Door animation is simple, but the light and the clipping need care for each new effect; the three-column stats area needs the most responsive work.

## Shared figure code
The three class figures are one section in each file marked `FIGURES (exported, port to src/render/styles)` and also saved as `figures.js`. API: `drawFacilitiesManager(ctx,t,f,dim)`, `drawSalesRep(...)`, `drawITWizard(...)`, `drawClassFigure(i,...)`. The context must be translated to the feet and scaled (the figure is about 97 units tall, y up is negative); `t` is idle seconds, `f` is the flourish 0..1 or -1, `dim` darkens toward a silhouette. The figures use their own small helpers (`fE`, `fP`, `fL`, `fGlow`, `fText`, `fmix`) and a palette `FIG_MATS`, so they can be lifted without the screen code. They are drawn front-on, not in the game's isometric view; the WORLD implementer will need isometric or three-quarter variants for in-world sprites, but the proportions, palette and props carry over.
