# Dungeon Character Lab (development only)

A review bench for the Dungeon's characters. It answers one question fast:
**does this character actually look good, at the size a phone shows it?**

It is not a player feature. Nothing links to it, `tools/build-site.py` never
copies `tools/`, and `tests/browser-dungeon-character-lab.py` fails if any
lab file or mention reaches the built site.

## Open it

```sh
python3 tools/dungeon-lab/serve.py        # serves the repo root
# → open http://127.0.0.1:8765/tools/dungeon-lab/
```

It needs http (it fetches the hub's own files to boot Rizo), so `file://`
will not work. Every control is in the URL hash, so any view can be shared
as a link.

## The loop

Edit a painter in `modes/dungeon/dungeon-art.js`, then reload the lab and
compare. Then re-shoot the review sheets:

```sh
python3 tools/dungeon-lab/capture.py            # lossless WebP into docs/dungeon/character-lab (needs Pillow)
python3 tools/dungeon-lab/capture.py --out /tmp/lab --format png
```

## What is real here

- **The art.** Every figure is painted by the real `dungeon-art.js`
  function, with the options `dungeon-view.js` passes for that state.
- **The scale.** World units × (screen CSS width ÷ 320), with the canvas
  capped at 2 device pixels, as in play. The screen sizes per phone were
  measured in the live game, and the test re-measures them each run:

  | Phone | Below (locked) | Outside (open) | Portrait |
  | --- | --- | --- | --- |
  | 320×568 | 284×350 | 292×344 | 46 px |
  | 375×812 | 315×472 | 340×510 | 56 px |
  | 390×844 | 330×495 | 355×532 | 56 px |
  | 430×932 | 370×555 | 393×589 | 56 px |

- **The rooms.** The backgrounds use the game's own materials (brick wall
  and tiles BELOW, plaster, wood and planks for the Hearth and Rows, wet
  concrete and asphalt outside) and its stepped light pass, with the same
  ambient and his flame's pool (86 u below, 70 u outside).
- **Rizo.** He is not a painter: in play he is the hub's pet markup staged by
  `dungeon.css` poses. `hub-bridge.js` boots the real hub in a hidden
  `about:srcdoc` frame, with its storage rewritten to in-memory maps and
  no service worker. Each Rizo slot is then the hub's markup inside a
  transparent frame with the hub's stylesheets, sized and anchored as the
  view does it.

## Views

| View | For |
| --- | --- |
| **Inspect** | One character, one state, any expression, facing, phone, scale (actual, ×2, ×4), background, render (colour, values, silhouette). The world sprite and portrait at 46/56/128 px side by side. Painted bounds, the palette it spends, and the four identity questions. |
| **Sheet** | Every state the game uses, plus every world expression, then the portraits. |
| **Cast lineup** | The cast side by side at actual size: BELOW, a warm room, values only, silhouettes, with a table of height, width, px per phone and palette. |
| **Phones** | The cast inside each phone's real screen, with the real HUD and dialogue box: 320×568, 375×812, 390×844, 430×932. |
| **Portraits** | Every face side by side, then every expression at 46, 56 and 128 px. Colour or values. |

## Characters and states

- **Rizo**: 37 poses: still, walking, flare, spark, tuck, kindle, hurt, down, the 26 `pose-*` stagings, wet, warm, and wearing the wrap. All five stages are available.
- **Latch**: standing, walking, pinned, pulling, seated, unloaded. Expressions: procedural, startled, dry, soft, urgent.
- **Nell**: work, support, lift, clear, point, listen, fix, walk, eat, brace, tired, fit, sit.
- **Orr**: tray, carry, walking, hands free. World expressions: serving, irritated, dry.
- **Nell world expressions**: work, measuring, listening, amused, irritated, tired; independently selectable from her working pose.
- **Night Porter**: closed, opening, open, hit, charge tell, charge, lamp sweep, settled.
- **The kidnappers**:
  - tall hood: standing, walking, grab, flinch;
  - small hood: filming, walking, phone off, flinch;
  - cap hood: pillowcase on shoulder, walking, pillowcase out, flinch.
- **YOU (Keeper)**: standing, walking. **YOU in the car**: idle, reach, keys, turn, look, look-back, reach-up.
- **The van crew, seated** (where they sit in the van; fixed facings): idle, talking (small, driver), quiet, filming, freeze (the phone), stare (the capped one points).
- **Draftling, Needle**: their idle, telegraph, attack, recover and hit states.
- **Collector** (v0.4, the Boss's hunter below): patrol, walking, spot (lamp up), search (lamp swinging), run (v0.5: the Long Hall chase). Never fought.
- **White coats and the jars** (v0.5): a bell jar asleep, and woken by his warmth.
- **The Boss**: only his calling card and his mark at world scale. He is never drawn in the world before the finale; comics show his hands, cufflinks, tie and silhouette.
- **Portraits**:
  - YOU: neutral;
  - Nell: work, measuring, listening, amused, irritated, tired;
  - Orr: serving, irritated, dry;
  - Latch: his five expressions;
  - tall hood, small hood, driver: neutral, scared;
  - capped hood: neutral (his face, finally);
  - The Boss: calm, cold — his caller ID, the mark on a dark phone screen. No face.
  - White coat (v0.5): a coat, a pen and a clipboard with his mark; the head is out of frame.

## Limits

- **Motion.** A still frame cannot show motion: walk bob, talking nods, sway,
  Rizo's CSS pose animations. Set Motion to "animated" to see it.
- **Only listed states.** The lab shows the states the game uses, not every
  value a painter would accept.
- **The van crew** is painted on the street backdrop; the van's interior is
  scenery, not a character.
