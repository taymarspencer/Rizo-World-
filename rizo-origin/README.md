# RIZO ORIGIN

Fire. Water. Earth. Air.

Put two things together and find out how far it goes.

---

## Run it

There is no build step, no server and no dependencies. Open `index.html`.

```
open index.html            # or drag it into a browser
```

For static hosting, upload the whole folder as-is. `index.html` must stay at the
deployment root; everything else is relative to it.

```
python3 -m http.server 8080     # if you want a local server
```

Everything is saved to `localStorage` in the browser. No account, no server,
no network calls, no analytics, no purchases.

---

## What is in here

```
index.html               the whole game
manifest.webmanifest     installable on a phone
css/rizo.css             all of the styling
assets/                  the RIZO mark, icons
js/
  data/groups.js         the 22 domains
  data/elements.js       406 elements — id | NAME | domain | flags | flavour
  data/recipes.js        542 reactions — a + b = result
  data/achievements.js   40 achievements
  art/mark.js            the RIZO mark, vector-traced from the supplied artwork
  art/glyphs.js          406 hand-authored pictograms in a 32×32 ink grid
  art/render.js          glyph renderer (memoised)
  engine/audio.js        every sound, synthesised at runtime
  engine/game.js         state, save, the recipe graph, hints, achievements
  ui/ui.js               board, bench, grid
  ui/moments.js          discoveries, domains, the reveal, the ending
  ui/sheets.js           discoveries / achievements / the board
  main.js                boot and wiring
tools/validate.mjs       content validator + reachability simulator
```

### Editing the content

Both content tables are plain text inside a JS string, so a recipe is one line:

```
fire + water = steam
sea + volcano = island + broth      # a reaction may throw off two things
```

Order never matters — the parser normalises every pair — and a result may be
reached by more than one route. Elements are one line each:

```
id | NAME | domain | flags | flavour
```

`flags` is `.` for ordinary, `m` for a landmark (bigger ceremony), `s` for an
anomaly (uncounted, never hinted, never spoiled).

### Validate after any change

```
node tools/validate.mjs            # add --verbose for group sizes and dead ends
```

It checks that every id is unique, every recipe input and output exists, no pair
is defined twice, no element is unmakeable, every achievement is earnable, and
then simulates the whole game forward from FIRE / WATER / EARTH / AIR to prove
that all 406 elements are actually reachable and that nothing required is gated
behind an anomaly. It also prints the wave at which each domain opens, which is
the fastest way to see whether the pacing has drifted.

---

## Controls

Tap a thing. Tap another thing. That is the whole control scheme.

Tapping the same thing twice is a self-combination, not a mistake.

| | |
|---|---|
| tap a slot | put it back |
| tap the result | use it as the next ingredient |
| long press an element | favourite it |
| `H` | hint |
| `E` | discoveries |
| `/` | search |
| `Esc` | close / clear |

Hints are free, escalate when you press again, and only ever point at something
you can actually make right now. They will never hand you an anomaly first and
they will never send you somewhere you cannot reach.

---

## Content

406 elements across 22 domains, 542 reactions, 40 achievements, 32 anomalies,
16 self-combinations, one ending.

The game never tells you how big it is until you have earned the right to know.

---

## Credits

The RIZO mark is the supplied brand artwork, vector-traced and normalised into
the same ink grid as the rest of the pictograms. Every other mark in the game
was drawn for it. Every sound is synthesised at runtime through WebAudio. No
third-party art, audio, fonts or code.
