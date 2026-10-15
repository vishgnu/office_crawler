# Round R11 visual review (R11-2: motion on a page without test flags, overall sweep, viewport matrix)

Date 2026-10-15. Reviewer: visual-reviewer (harness 0.5.1). Build: a copy of `play/index.html` (not rebuilt). Playwright Chromium 1x. Every cited sheet was opened and looked at. 12 evidence shots: `docs/shots/r11-visual-*.jpg`.

## How motion was judged (L-045)

- The no-flag page has no `window.__app`, so it cannot be driven into a fight, a gear state or a death. I therefore used `?test=1&realtime=1&story=1` (real clock loop, intro story on) and removed the `noanim` class that test mode sets, with a MutationObserver (it is re-applied on every options commit). With `noanim` removed the real motion code runs: the elevator-door transition on New game, panel slide (`.drawer` 0.22 s transform), sprite and fx animation. The one truly flag-free load (title, create, first click) was not played further. This is stated so the motion verdict is read for what it is: real-time and animated, but with the test hook and the cheats (spawn, setHp, teleport) used to reach states.
- Input map: left mouse hold on a monster = basic attack; F1-F4 only SELECT the secondary skill (core `selectSkill`), the cast is the RIGHT mouse button on the target (first run with F keys alone produced "no effect" frames, a false negative; redone with F key + right-click). Skills learned through `tree.learn` fill the hotkeys automatically.
- Frames: 8-16 screenshots per sequence at 60-130 ms, contact sheets in the temp dir, 5 key ones copied.
- NOT driven: stair walking to another floor (the hero did not reach the exit in 60 s; `teleportFloor` cheat skips the transition, so the floor-change animation was not seen except the New game doors), death collapse animation (setHp(0) shows the death screen within one 160 ms frame; a real kill by monsters did not happen within 1.5 s). Reduced motion: option sets `noanim` (checked), the frame test after it showed no difference to judge (nothing to compare because teleport has no animation).

## Verdict

Scores (gate >= 34): **Game 38 / 36, UI 37 / 35. Gate met.** Motion verdict: **acceptable, iterate-light** (see below).

| Area | Appeal | Craft | R8-T |
|---|---|---|---|
| G: in game | **38** | **36** | 37 / 35 |
| UI | **37** | **35** | 36 / 34 |

The R8-T L-1 (landscape phone panels cramped to 100-140 px) is fixed: tabs now sit in one row with the close button, and the scroll body is 255-285 px at 667x375, 740x360 and 844x390 (measured `pb` visible height; at 1280x720 517 px). L-2 (390x844 bag below the fold) is fixed: the bag shows with items above the gold footer. The new real defect is a dock overlap at 360x640 (M-1 below).

## Motion verdict (separate)

Good on effects and feedback, thin on body animation.
- Walk: all three classes show a 4-6 pose leg cycle with a bob and a camera that eases after the hero; no foot sliding visible, the ground ring follows (`r11-visual-motion-walk-fm.jpg`). Fine.
- Basic attack, all three classes (`r11-visual-motion-basic-attack-3-classes.jpg`): hit spark at the target, white hit-flash silhouette on the monster, debris papers, damage floaters, coin drops, monster death animation (zombie topples, SR sheet). Reads clearly and is satisfying. The hero body barely changes pose: FM swings the red tool a little, IT keeps the staff raised overhead in every frame (no attack or cast anticipation), SR holds the blade out. The effects carry the attack, not the body (M-3).
- Skills (FM F1 Pallet Slam ring, F2 knockback wave; IT chain lightning, curse ring, wide shockwave; SR volley): distinct per skill, ground rings and arcs fade over ~0.5 s, no flicker (`motion-skills-fm`, `motion-skills-it`). F4 on FM and F3/F4 on some classes produced no visible effect in 10 frames (buff, aura or cooldown, not verified; cannot say "missing", see M-4).
- Monster movement: printer imp glides in on its own timing with a name plate; zombie intern chases. Monster hit reactions are a flash only, no stagger or knockback except F2 (M-3).
- Gear on a moving hero (`motion-gear-walk-attack`): unique hat, blazer, sneakers, rare halberd and wrist braces: the trim does not shimmer or flicker, the outline stays stable over 12 frames. The two-hander is NOT readable in motion: the rare "halberd" is a small red shape in the fist beside the body in walk and attack, no long shaft, identical to the starting tool; the pose does not change for a two-hander (M-2).
- Panels: slide 0.22 s, no jank (captured only after the slide had finished because screenshot latency is ~100 ms; CSS value read directly). Toasts ("Equipped Pending Backlog.", area names) appear above the belt and swap without overlap.
- Death screen: instant full-screen red vignette, text and three buttons, dim hero behind; no collapse or fade-in seen (see "not driven").
- Reduced motion: option sets `noanim`; the transition, panel slide and screen wipes are gated by that class in code; not compared by frames.

## Findings

M-1 **High (new, small phone).** At 360x640 on floors the dock overlaps: Journal (with its "!" badge, 85 px wide) is placed at x 269-354 over Skills (233-307) and Map (310-354); the Map button cannot be tapped (measured `getBoundingClientRect`; on 390x844 the same row fits: 18-384 with a 3 px gap). Where: `r11-visual-dock-overlap-360x640.jpg` (floor 3, level 10, File and Skills badges present). Fix: let the dock wrap to two rows or drop the labels to icons below 380 px; give the badge no extra width; keep every button 44x44 and non-overlapping.

M-2 **Medium.** The two-hander does not read in motion or at rest: rare Mop Halberd looks like the start tool (red stub at the hip), no long shaft, no two-hand grip pose (`motion-gear-walk-attack`). Fix: draw the halberd shaft above head height beside the body, hold it with both hands, and use a two-hand swing pose.

M-3 **Medium.** Hero attack or cast poses are nearly static (IT staff permanently overhead, FM stub), and monsters do not stagger on hit; only fx and floaters show the hit. Fix: add a 2-3 frame windup and swing offset on the hero sprite and a 2 px recoil on the target.

M-4 **Low (unverified).** Some skill keys give no visible reaction in 10 frames (FM F4, IT F4 shows a ring only, no target effect). Check whether the skill is a buff/aura and whether the cooldown or mana gate gives feedback ("not enough mana" toast or a bar flash).

M-5 **Low.** Damage floaters detach from the target: they rise to ~100-150 px up-right of the monster and drift apart from it (e.g. "8", "10", "15" stacked at the top right in the basic-attack sheets). Fix: spawn at the target's head and cap the rise at ~40 px.

M-6 **Low.** The imp (and zombie) stands inside the hero's footprint, sprite overlapping the hero in front of it (`motion-monster-overlap-fm`: imp drawn over the hero's torso for many frames without any attack frame). Fix: stop monsters at the tile edge (melee range 1), sort the hero behind only when the monster is further down the screen.

U-1 **Medium (landscape).** The victory screen at 667x375, 740x360, 844x390 and 360x640 scrolls: the run summary is cut and "Keep playing" / "Quit to title" are below the fold (screen scroll height 672 for a 375 viewport). Reachable but not visible. Fix: below 430 px height hide the story paragraphs behind a "Read" fold or lay summary and buttons side by side.

U-2 **Low-Medium (landscape).** At 667x375 the panel (270 px body) leaves the quest pill and hotbar visible behind the panel edges; the Skills panel shows only about 1.5 skill rows at a time and the Employee File shows header plus two attributes (`sweep-667x375`). Usable now, still tight: fix by hiding hotbar and belt while a panel is open on short landscape.

U-3 **Low.** Options at 390x844, 360x640 and the landscape phones: the panel runs to the bottom edge; the last help lines ("Quit to title to delete or replace...") touch the viewport edge and the panel border is cut (c390 third frame). Fix: 16 px bottom padding in the scroll body.

U-4 **Low.** 360x640 create screen: the class stat bars (HEALTH / MANA) are clipped by the name field for the Facilities Manager card (`sweep-360x640` frame 2).

U-5 **Info.** Scroll-body heights (visible px) at all sizes: 1920x1080 815, 1366x768 556, 1280x720 517, 390x844 569, 360x640 365, landscape 255-285; all above 150. No horizontal page scroll in any of the 8 viewports for any screen (`hscroll` 0 everywhere). Console and page errors: none.

## Carry-over from R8-T

G-R1 (full rare set turns the hero gold) still visible on the unique/rare set in `motion-gear-walk-attack`: hat, vest and sneakers read orange-yellow, class colour is lost. G-R2 unique body on IT and SR not re-checked. L-3 (tracker pill behind the death screen) is fixed: the death screen shows only the dim background. L-5 skill tree tier 1 still left-aligned. L-6 not re-checked.

## Keep

- Hit feedback chain on basic attacks (spark, flash silhouette, debris, floater, coins, fall) for all three classes.
- Skill effects have unique shapes per skill and stay readable over the ground; no flicker on trim while moving.
- The landscape panel layout (tabs in one row, close button in the header), the 390 portrait bag now visible, and the 44 px dock down to 390 wide.
- Floor themes at 1280: lobby, open-plan, basement and executive floors differ clearly in colour and light.

processes: none
