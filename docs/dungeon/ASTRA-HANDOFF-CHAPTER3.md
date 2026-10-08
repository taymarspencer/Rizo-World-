# Chapter 3 → Astra: where art would help most

From the Chapter 3 director's polish (PR #33, branch `claude/dungeon-story-overhaul`). That pass made every mechanic readable with procedural light, timing and sound. It did not redraw characters. The items below are where hand-made art would add the most, in priority order. Each one names the code that draws it today, so the new art can replace the drawing without touching the rules.

**Rules that must survive the art pass.** Each is listed with the code that enforces it.

- Light = being watched. Hold this across the whole chapter.
- The Boss never shows a face: hands, cufflinks and a silhouette only.
- His mark is the bell jar with a light inside. It is never Rizo-Signal blue.
- Rizo is the only warm colour in the building until the jars wake.
- The six reachable jars are all the same jar. Only the light inside differs.

| # | Element | Today | What would help | Where |
|---|---|---|---|---|
| 1 | **The six named jars** (Moth, Pip, Bean, Spark, Wick, the unnamed one) | About 10 px on a 390 px phone: a warm blob with two 1 px eyes. Each one's personality is only a colour and a motion: Moth flutters, Pip hops, Bean rocks, Spark flickers, Wick blinks sleepily, the old one barely moves. They lean toward Rizo and press to the glass at the promise. | A tiny authored creature inside each jar that reads at 1× and fits Rizo's flame-creature family without copying him. Keep the motion keys: they are what carries the emotion. | `JAR_SOULS`, `jarLight()` in `dungeon-art.js`; `jarMood()` in `dungeon-scenery.js`. All six are side by side in the Character Lab under "White coats (and the jars)". |
| 2 | **The small hood in Intake** | One arm pose (phone raised) for both of his states. Watching: the phone is a torch aimed at Rizo. Looking away: he reads the screen. The procedural beam does the work; his body barely changes. | Two clear poses: torch held out toward the crate, and head bowed to the screen. Add a head-turn frame for the "…hm?" tell, 650 ms before he looks back. | `hood()` (`hood-small`) in `dungeon-art.js`; `guardLook()` and `intakeOver()` in `dungeon-scenery.js` |
| 3 | **The runner** (Long Hall) | The patrolling collector, rotated forward. No run cycle, no grab, no gate-slam pose. Its feet matter, because the catch ring is drawn there. | A run cycle (lamp swinging, the jar on its back bouncing), a reach-and-grab frame for the catch, and a slam-into-the-gate frame. Keep the feet planted where the sprite's origin is. | `collector()` `state: "run"` in `dungeon-art.js`; `paintReach()` in `dungeon-view.js`; the slam in `buildingDynamic()` |
| 4 | **Service windows and the night gate** | A window is a 16-unit sliver that jitters. The lamp is a white rectangle, and its warning is light creeping across the floor. The gate is flat bars with two blinkers. | A window face whose shutter visibly lifts, with a real lamp head behind it. A heavier gate housing with a klaxon light and a slam frame. | `frostedPane()`, `buildingDynamic()` longhall branch in `dungeon-scenery.js` |
| 5 | **Factory machines** | Generic steel boxes with a cold window. They now strike in turn down the line: a press head drops, the window flashes and cold breathes out of the pipes. | Machines that read as one production line feeding the belts: a press head, pipes running from machine to machine, and maybe a jar being capped. "Nothing says what it does" is canon; keep it unexplained. | `BUILDING_SOLIDS.machine`, `machineStroke()` in `dungeon-scenery.js`; `factory.machineBeat` in content |
| 6 | **Grate views** (the scale of the collection, the lab, the Boss's desk) | 172×104 procedural vignettes. The office (his hands, cufflinks, the list with a red line) is the chapter's biggest Boss reveal, and it is drawn with rectangles. | Hand-painted vignettes, the office above all. The frame must stop at his wrists. | `VIEW_ART` in `dungeon-scenery.js` |
| 7 | **Belt crates and jar trays** | The factory's one rule (a crate hides you, a tray of jars does not) rests on a 30×24 crate and a 26×14 tray telling themselves apart. | Make the crate read as tall, solid cover and the tray as low, see-through glass. | `beltCrate()`, `jarTray()` in `dungeon-art.js` |
| 8 | **Rizo holding his breath** | In the vents (still on a lit grate) and behind cover, he "curls": a CSS squash, plus his light pulling in. | A real hold-still pose for the DOM actor: eyes shut, flame tucked. It is the Chapter 3 player's main defensive verb. | `.pose-curl` in `styles/dungeon.css` |

**Fine to leave as is.** These are procedural and readable, and redrawing them would add risk without adding clarity:

- the reach ring;
- the creeping lamp band;
- the latch notches;
- the catch flash;
- the vent pre-glow.

If any of them is restyled, keep its shape and timing. They are the rules made visible, and the tests in `browser-dungeon-escape.py` read their brightness.
