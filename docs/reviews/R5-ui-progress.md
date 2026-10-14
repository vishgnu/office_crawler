# R5 UI progress (UI-R5, implementer)

Progress lines (L-15): one line per finished item, "done: X; next: Y".

- done: read inputs (R4 notes/contract, decision, A.html, game/main/screens/panels/options); audio cues for 24 skills + 18 event types, PENDING emptied, todo test replaced by a real test (test/audio.test.js 24/24); next: shell wiring (game.js/main.js/testhook).
- done: HUD chrome wired into hud.js (drawPanelChrome/snapRect from hudchrome.js, inline copy removed); next: shell wiring
- done: e2e/run-all.mjs per-script timeout (240 s default, replay/polish overrides), live summary lines, TIMEOUT marker, new script slot r5ui (to be written); next: shell wiring (game/main/testhook)
