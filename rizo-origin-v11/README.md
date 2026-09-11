# RIZO ORIGIN

Fire. Water. Earth. Air.

Put two things together and find out how far it goes.

---



## RIZO V10 sensory proof / Phase 1 revisit

V10 is intentionally audio-only in scope. It reopens the first half of V9 and
leaves the accumulating-world visual system alone. The sensory director now
controls not just *which* cue plays, but the mix space, timing and reward accent
that belong to that discovery.

- Environmental cues were remastered to a consistent phone-audible range; the
  V9 bank had large loudness differences that could make SEA / FOREST / WIND
  feel much weaker than LIGHTNING / VOLCANO. Low-frequency events such as
  VOLCANO, EARTHQUAKE and SPACE now carry upper-bass harmonics that survive
  small speakers.
- Alternate FOUND / IMPACT / FAIL / CHAIN / TAP samples were level-matched so
  variety changes texture without randomly changing reward strength. Variant
  selection now uses shuffled bags instead of repeated random coin flips.
- The sensory vocabulary expands selectively to obvious physical and authored
  milestones: STEAM, LAVA, SPARK, CRYSTAL, RIVER, WATERFALL, PRIMORDIAL SOUP,
  HUMAN, DEATH, GLASS, METAL, machinery / vehicles, TIME, RITUAL, CHAOS,
  COMPUTER / AI, BIG BANG and BLACK HOLE among others. Related discoveries can
  share a family while using different pitch / gain / timing profiles.
- Reward punctuation is no longer hard-coded 320 ms after every physical cue.
  Each discovery owns its own accent point and reveal hold, so surf can establish
  itself before the RIZO sting while lightning still resolves quickly. Major
  signature echoes are similarly delayed around their physical sound instead of
  stacking at 520 ms.
- The music-duck fade bug was fixed: short requested ducks no longer inherit a
  hidden ~560 ms minimum fade. Transients now get mix space when they actually
  happen.
- Audio startup no longer eagerly loads the entire expanded cue bank. Core and
  likely first-session sounds are hot; later sensory files warm in small batches
  after the first trusted gesture.
- All changed audio URLs and runtime scripts are cache-busted so an existing V9
  deployment cannot quietly serve the older mix.

The recipe graph, save data and V9 persistent-world behavior are unchanged.

## RIZO V9 accumulating world / sensory cut

V9 continues directly from the V8 relational pass. The board now accumulates
physical evidence of selected discoveries instead of treating every new thing as
a temporary card. The workbench becomes a quiet, persistent world layer: sea and
weather move behind the reaction space, geology rises into the horizon, LIFE
starts biological motion, forests grow, cities leave structure, and machine /
electric discoveries add circuitry. Existing saves derive this scene directly
from owned elements, so presentation cannot drift away from game state.

- Sensory discoveries use a deliberately sparse bank of first-discovery SFX:
  surf, rain, storm, lightning, volcano, earthquake, LIFE, forest, city, engine,
  electricity, space, fire, wind and ice. Ordinary discoveries remain in the
  shared RIZO sound language and now rotate through five found cues.
- The sensory cue owns its moment instead of fighting the generic impact sound.
  Major discoveries keep a quieter RIZO sting underneath so they still belong to
  the same game.
- Major world changes are sequenced after their full-screen ceremony. LIFE, for
  example, lands its heartbeat / landmark beat first; when the board returns, the
  workbench itself begins moving.
- Persistent scenery is not a hint system and does not expose undiscovered
  content. It is reconstructed only from the player's actual save.
- No new currency, progress bar, tutorial, or extra scrolling surface was added.
  The reward is that the world increasingly looks and sounds like something the
  player built.

The recipe graph and save format remain compatible with V8.

## RIZO V8 care / relational cut

V8 is the second half of the V7 pass: the new systems are tied back into the
philosophy of the board instead of becoming separate features. The content graph
is unchanged. The player's own path now leaves a trace, multiple valid origins
are treated as relationships rather than contradictions, and adaptive structure
changes meaning as the player earns the language to understand it.

- Failed pairs persist as quiet **scars**. With one ingredient selected, the
  WORKING SET can move previously tested dead partners backward using only the
  player's own history; nothing is disabled and no unseen recipe is exposed.
- After **MISTAKE** is discovered, the exact same scars are reframed as
  **material** in the interface and failure copy. The event did not change; the
  player's relationship to it did.
- A result reached through two or more discovered recipes becomes a
  **confluence**. Both routes are shown at once, with a dedicated convergence
  sound and relational beat. Discovering the hidden CONFLUENCE anomaly teaches
  the interface its own name for the phenomenon.
- The encyclopedia now separates **WAYS THIS IS TRUE** from **WHAT IT HAS
  MADE**, so origin and consequence stop being flattened into one recipe list.
- WORKING SET size now breathes from 18 to 28 pieces as the world expands rather
  than staying fixed at 24.
- RIZO SIGNAL adds experiential RELATION, SHAPE, SOVEREIGN and BLUEPRINT
  transmissions only after the board has actually demonstrated those ideas.
  The outside-RIZO portal also responds to which RIZO artifacts the player has
  created.
- The ending no longer forces an either/or reading where the game has already
  taught a both/and one.

The save format remains backward-compatible with V7. Old saves simply begin
without scars and accumulate their own trace from this point forward.


## RIZO V7 descent / smart-sort cut

V7 is the expansion-pressure pass. Once six domains are open, the collection
stops treating a 100+ piece board like the four-element opening: a 24-piece
**WORKING SET** automatically pulls fresh, recent and still-productive pieces
forward, while mobile replaces the ever-growing sideways domain rail with a
compact DOMAINS index plus the three newest doors. EVERYTHING remains one tap
away and search / NEW / RECENT / favourites still work normally. The sorter
never exposes a recipe, partner or result.

The soundtrack is now directed by the state of the world. The original lab score
remains the musical spine; early play sits under a lighter curious motif, the lab
track wakes up as the board expands, and a new 51-second bass-heavy **BELOW**
score gradually contaminates and overtakes it as discoveries and open domains
accumulate. Both music elements are armed on the original iPhone gesture and are
continuously cross-faded rather than hard-switched. Ordinary SFX, discovery
cards, reaction copy and world stamps also rotate through restrained variants so
repeat actions retain a shared language without feeling canned. Closing an
entire domain now gets its own earned micro-ceremony.


## RIZO V6 intuition / continuity cut

V6 is a director's pass over the finished game rather than a feature expansion.
It reconciles the small states that could disagree with one another: real NEW
GAME behavior, discovery chronology, counted-vs-anomaly totals, multi-result
discovery numbering, achievement surfacing, result reuse, stale reaction copy,
and RIZO milestone delivery. Landmark ceremonies now own their reveal instead
of immediately repeating themselves as a smaller card, and authored animations
have protected time to finish before they can be dismissed.

Audio permission and audible ambience are also separated: iPhone can still bless
the music element on the trusted gesture, but the laboratory does not fade in
until BREAK THE SEAL actually opens the board. Existing V5 saves remain
compatible.

## RIZO V5 universe / pacing pass

V5 adds a quiet dark laboratory score, fixes the sticky failed-combination
behavior, gives discoveries more time to land, and adds authored ceremonies for
major turning points such as LIFE, HUMAN, TIME, CHAOS, UNIVERSE and RIZO. At 25
discoveries the RIZO mark becomes a subtle in-world signal: lore and philosophy
unfold with progress, with a secondary portal into the larger RIZO world and a
native SHARE THE BOARD action.

The V5 music element is explicitly armed on the first physical gesture for
iPhone/Safari and uses a cache-busted `labloop-v5.wav` asset.

## RIZO V4 rescue pass

This build keeps the 406-element / 553-reaction graph intact but treats sound and
reaction feel as first-class game systems. V4 packages 23 real WAV cues, uses a
first-gesture media bus for iPhone/Safari reliability, retains WebAudio as a
fallback, and adds a visible `TEST SOUND` path in THE BOARD. Ingredient travel,
fusion timing, impact, discovery stamps, domain/landmark moments, RIZO HEAT and
the **BREAK THE SEAL** opening have all been pushed further so the first minutes
read as a game rather than a recipe database.

The header speaker has three states: green = audio live, amber `!` = sound is on
but the browser still needs a physical tap, red slash = muted. On a locked
session the first speaker tap tests/arms sound instead of muting it.

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
no analytics, no purchases. The only external navigation is the player-triggered
RIZO portal inside RIZO SIGNAL.

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
  data/recipes.js        553 reactions — a + b = result
  data/achievements.js   40 achievements
  art/mark.js            the RIZO mark, vector-traced from the supplied artwork
  art/glyphs.js          original 406-glyph semantic base
  art/plates-*.js        244 authored 64×64 ink/screenprint discovery plates
  art/render.js          layered plate/specimen renderer (memoised)
  engine/audio.js        hybrid real-file + WebAudio sound engine
  engine/game.js         state, save, the recipe graph, hints, achievements
  ui/ui.js               board, bench, grid
  ui/world.js            persistent accumulating world + reveal choreography
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
| speaker | sound on / off |
| `H` | hint |
| `E` | discoveries |
| `/` | search |
| `Esc` | close / clear |

Hints are free, escalate when you press again, and only ever point at something
you can actually make right now. They will never hand you an anomaly first and
they will never send you somewhere you cannot reach.

---

## Content

406 elements across 22 domains, 553 reactions, 40 achievements, 32 anomalies,
19 self-combinations, one ending.

The game never tells you how big it is until you have earned the right to know.

---

## Credits

The RIZO mark is the supplied brand artwork, vector-traced and normalised for
the game. The element art combines authored two-ink discovery plates with a
procedural field-guide treatment for the remaining semantic glyphs so the full
406-piece library stays coherent without pretending every noun is the same kind
of icon. Audio is original and packaged with the game, with WebAudio retained as a
fallback/enhancement. No third-party art, audio, fonts or code.
