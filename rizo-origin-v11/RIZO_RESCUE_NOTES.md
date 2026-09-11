# RIZO ORIGIN — V11 Phase 2 / The Living World

V9 made the board keep evidence. It kept it as independent on/off toggles, so
the scene never *developed*: a sea looked the same whether or not the moon
existed. V11 replaces the toggles with a derived model and leaves everything
V10 built — audio, discovery hierarchy, music director, RIZO HEAT, smart
sorting, save shape, RIZO SIGNAL, recipe graph — untouched.

## What changed

- `js/ui/world.js` rewritten as a derived world: `derive()` turns the discovered
  set into ~40 signals and ~25 *relational* readings. Nothing cosmetic is
  written to the save, so a reload rebuilds the same place and NEW GAME returns
  it to dirt.
- Three layers of consequence: birth choreography, persistent state, and later
  discoveries reinterpreting earlier ones.
- New `#worldfield`: a fixed layer behind the collection for the far edge of the
  room — star field, galaxy band, and a black hole that reads as a lensed rim
  rather than a black circle.
- Scene recomposed around the workbench's safe zones. Mass lives in the left and
  right margins and along the horizon; the centre stays sky. The city is a
  distant skyline precisely so it can light up without fighting the slots.
- One SVG (70 nodes total) plus one shared particle canvas and one rAF. Emitters
  share a single budget; the loop stops when nothing is emitting or the tab is
  hidden.

## Things playing it exposed

- The era gate was hiding work the player had already done. A save with SEA,
  MOUNTAIN and VOLCANO at discovery 15 was drawn at 32% opacity because the raw
  counter said "early". Visibility now follows *world weight* — how many systems
  are actually on screen — with count as a minority term, so breadth shows
  immediately and a wide-and-shallow rush still cannot make the board look
  finished at fifty discoveries.
- A world with stars and no life was being called "deep". The cosmic era now
  requires something built to be cosmic *about*; early stars just add stars.
- ICE left no persistent evidence unless you also had SNOW. Fixed.
- `background-position` drift on the full-viewport star layer cost 37fps on a
  phone. Moved to a compositor transform: 23fps → 60fps in the heaviest state.

## The mistake ledger

RIZO philosophy, made material rather than written down: once RIZO exists, the
weight and offset of the second impression on the press is driven by how many
dead ends that specific player has hit. Two saves with the same elements do not
print the same.

## Verification

- `node tools/check-v11-world.mjs`: 91 world invariants, no browser needed.
- V7 / V8 / V9 / V10 continuation checks still pass. The V9 checks were rewritten
  against the new implementation while asserting the same guarantees.
- 18 browser integration checks: V10 save migration with no replayed history,
  reconstruction after reload, new discoveries still animating, NEW GAME reset,
  pointer pass-through, animation preference, double-result reveal ordering.
- 406 elements / 553 recipes / 22 domains / 23 waves unchanged.

---

# RIZO ORIGIN — V10 Sensory Proof / Phase 1 Revisit

This pass deliberately does not reopen V9 Phase 2. It proofreads the sound and
reward choreography only.

## Specific corrections

- Remastered the physical cue bank into fresh `-v10.wav` assets with consistent
  perceived level. V9 had several cues whose RMS was many times below the louder
  effects, so random discoveries could feel under-rewarded despite correct code.
- Added phone-audible upper bass to sub-heavy geology / space cues.
- Rebalanced alternate FOUND / IMPACT / FAIL / CHAIN / TAP variants and replaced
  repeated random selection with shuffle bags.
- Expanded selective sensory coverage for obvious material / mechanical / major
  moments rather than assigning novelty audio to all 406 elements.
- Introduced per-discovery `duck`, `accent`, `hold`, `rate`, `gain`,
  `majorAccent`, and where needed `echo` timing. SEA / WAVE / TIDE and
  STORM / THUNDER can now share a sonic family without sounding cloned.
- Physical cues now get time before the generic RIZO reward punctuation, and the
  moment queue respects that hold before replacing the reveal.
- Major signature echoes yield to their physical sound instead of all firing at a
  fixed 520 ms.
- Fixed the mixer fade-step bug that made a nominal 180 ms music duck take about
  560 ms. Duck attack is now genuinely quick enough for lightning / spark /
  camera-style transients.
- Added staged sensory preloading: core / first-session cues remain hot while the
  rest of the expanded bank warms four files at a time after audio is armed.
- V10 cache-busts both runtime JS and every remastered cue URL.

## Verification

- `node tools/check-v10-sensory.mjs`: 10 dedicated sensory-quality invariants.
- V7, V8 and V9 continuation checks still pass.
- Baseline engine progression remains unchanged.
- All runtime JS passes syntax validation.

---

# RIZO ORIGIN — V9 Accumulating World / Sensory Cut

V9 is intentionally split into two internal passes that ship as one continuation
of V8. Phase one gives a limited set of physical discoveries their own sound.
Phase two makes those same discoveries leave evidence in the board instead of
vanishing when the reveal card goes away.

## Phase 1 — sensory discovery language

- Added 15 authored environmental / material WAV cues plus two additional normal
  discovery variants. The full local audio bank is now 48 WAV assets.
- Dedicated first-discovery sounds cover SEA / WAVE, RAIN, STORM / THUNDER,
  LIGHTNING, VOLCANO, EARTHQUAKE, LIFE, FOREST, CITY / VILLAGE, ENGINE / MACHINE,
  ELECTRICITY, SPACE / STAR, FIRE, WIND and ICE.
- The list is intentionally incomplete. A noun does not earn a novelty sound
  merely because it exists; the cue is reserved for discoveries with an obvious
  physical sonic identity. This prevents 406 elements from becoming a soundboard.
- Sensory discoveries suppress the generic pre-reveal impact, duck the music, and
  let their physical cue lead. A quieter RIZO birth sting follows ordinary
  sensory finds to keep a common reward language.
- Major sensory discoveries keep their environmental sound as the foreground and
  receive only a reduced landmark sting. LIFE no longer stacks extra generic
  heartbeat-like impacts on top of its dedicated heartbeat cue.

## Phase 2 — the board keeps what you made

- Added `js/ui/world.js`, a save-derived world director mounted directly inside
  the workbench. It never stores a second copy of progression; it reads `R.has()`
  and reconstructs itself from the canonical save.
- SKY / SUN / MOON / CLOUD / RAIN / STORM alter the upper field. SEA leaves a
  moving waterline. MOUNTAIN and VOLCANO build the horizon. LIFE introduces
  persistent motes; PLANT / TREE / FOREST grow line-work; VILLAGE / CITY add a
  skyline; ENGINE / MACHINE / FACTORY / ELECTRICITY / COMPUTER / INTERNET leave
  circuitry; NIGHT / STAR / SPACE alter the sky.
- The persistent layer stays behind the actual workbench controls and consumes no
  vertical space. This was deliberate: world-building must reduce the feeling of
  using a database, not create another interface to manage.
- First discoveries trigger one-shot choreography on the persistent layer: sea
  rises in, rain crosses the bench, lightning flashes, the volcano erupts, the
  ground shakes, LIFE pulses, forest / city rise, circuitry runs, and space wakes.
- Landmark world animations occur after the landmark ceremony releases control.
  They are not allowed to run invisibly behind the full-screen stage.
- Existing V8 saves immediately reconstruct their already-built world but do not
  replay old discovery sounds or birth events. New discoveries animate normally.

## Verified

- Content graph unchanged: 406 / 406 reachable, 553 unique reactions, 22 domains,
  23 waves, 19 self-combinations.
- `node tools/check-engine.mjs`: 14 baseline engine scenarios pass.
- V7 adaptive-navigation / audio invariants pass.
- V8 care / relational invariants pass.
- `node tools/check-v9.mjs`: 8 dedicated sensory/world-state scenarios pass.
- 48 local WAV files parse as RIFF/WAVE; no third-party audio fetch is introduced.
- Every shipped JS / MJS file passes `node --check`.

---

# RIZO ORIGIN — V8 Care / Relational Cut

V8 continues directly from V7. It does not reopen the recipe graph or add a new
progression economy. The pass asks whether the systems already present remember
why they exist, then makes that reasoning visible through play.

## The player's path now matters

- Undefined combinations are persisted as dead-pair memory. When one ingredient
  is in hand, partners the player already proved dead carry a quiet scar and can
  drift backward in WORKING SET. They remain selectable. The game remembers
  evidence without turning evidence into an invisible hint.
- A future content update cannot let an old scar suppress a new recipe: imported
  dead-pair memory is accepted only when the pair is still genuinely undefined.
- Once MISTAKE exists, those same marks are called material and warm slightly.
  The history remains true while its meaning changes.

## Two roads can both hold

- Known results now report how many recipe routes the player has personally
  demonstrated. A second valid origin receives a dedicated confluence sound, a
  two-road relation diagram and an authored first-convergence beat.
- The hidden CONFLUENCE discovery now has a signature ceremony: `BOTH ROADS HELD`
  / `THE MISSING PIECE WAS THE RELATIONSHIP.` Once the player knows CONFLUENCE,
  future two-road diagrams use the earned word instead of explaining it again.
- The encyclopedia distinguishes origins (`WAYS THIS IS TRUE`) from downstream
  consequences (`WHAT IT HAS MADE`) and badges elements with multiple recorded
  routes.

## Structure that breathes

- WORKING SET is no longer a fixed 24 pieces. It grows 18 → 21 → 24 → 26 → 28
  as open-domain pressure increases. Early boards stay intimate; late boards get
  more surface area without falling back into an endless dump.
- RIZO SIGNAL can now reflect RELATION, SHAPE, SOVEREIGN and BLUEPRINT only after
  those ideas have become true in the player's board. The RIZO portal copy also
  reacts to RIZO LOGO / RIZO TEE / RIZO WORLD discoveries.
- The final wording keeps two readings alive instead of demanding the player
  choose one after spending the whole game learning that relationships can hold
  apparent opposites together.

## Verification

- 406 total elements: 374 counted + 32 anomalies.
- 553 unique reactions across 22 domains and 23 progression waves.
- 19 self-combinations.
- `node tools/validate.mjs`: all checks pass, 406 / 406 reachable.
- `node tools/check-engine.mjs`: 14 baseline engine scenarios pass.
- `node tools/check-v7.mjs`: inherited V7 adaptive-navigation / audio invariants pass.
- `node tools/check-v8.mjs`: 8 care-pass scenarios cover scar persistence, stale-scar safety, confluence routes, breathing WORKING SET, contextual dead-end ordering and export/import continuity.
- All shipped JavaScript passes `node --check`; all local asset references resolve.

---

# RIZO ORIGIN — V7 Descent / Smart-Sort Cut

V7 assumes the core game is already good and fixes the next problem created by
success: the world becomes too large for the opening UI and too emotionally flat
if every ordinary action keeps using one exact reward pattern. The recipe graph
is unchanged. This pass adds an adaptive collection/navigation layer, an adaptive
music director, restrained feedback variation, and a real domain-completion beat.

## Adaptive collection

- At **six open domains**, the default full collection becomes **WORKING SET**.
- WORKING SET caps itself at 24 owned pieces and scores them by fresh status,
  recency, newest domains and remaining reachable reaction potential. It never
  tells the player the partner or output, so it reduces thumb mileage without
  turning into a recipe guide.
- Tapping EVERYTHING explicitly restores the complete board. Search, NEW, FAV
  and RECENT remain explicit player choices.
- RECENT is capped at 30 instead of becoming another endless list.
- On mobile, the long horizontal domain conveyor becomes a four-slot dock: a
  DOMAINS index plus the three newest relevant domains. The full sheet shows
  WORKING SET, EVERYTHING, newest doors and every open domain with live counts.
- The transition is acknowledged once with `SMART SORT ONLINE`; it is queued only
  when the board is free so it cannot disappear behind a landmark ceremony.

## Music director

- The existing `labloop-v5.wav` remains intact as the middle musical identity.
- New `below-v7.wav` is a 51.2-second darker composition built around sub pulses,
  perceptible bass harmonics, relay ticks, electrical shards and uneasy note
  relationships.
- The director measures **both discovery count and open-domain count**, so mood
  follows how large the player's actual world has become instead of one arbitrary
  level number.
- Five internal moods — CURIOUS, LAB, UNSETTLED, DESCENT, BELOW — continuously
  cross-fade the two records. There is no level-up music cut.
- CURIOUS lowers the darker lab bed and overlays a sparse, brighter procedural
  three-note motif; as the world grows, that motif disappears, the original lab
  score takes over, then BELOW gradually infects it.
- Both media elements are silently blessed inside the first trusted iPhone/Safari
  gesture, preserving the mobile audio reliability work from V4–V6.
- Major discoveries still duck the room so the soundtrack never steals a reveal.

## Less canned, more authored

- Tap, impact, failed-reaction, discovery and chain cues now draw from real WAV
  variant banks without immediately repeating the same sample.
- Failed reactions, known recipes, alternate routes and RIZO HEAT have expanded
  no-immediate-repeat copy pools.
- Ordinary discovery words use four deterministic screen-print registrations and
  discovery cards use three restrained entrance variants. The element itself
  chooses the variation, keeping identity coherent instead of random visual noise.
- Completing a domain is now recognized as a meaningful accomplishment with its
  own short sound / visual beat before control returns. No currency or fake reward
  layer was added.

## Verified

- 406 total elements: 374 counted + 32 anomalies.
- 553 unique reactions across 22 domains and 23 progression waves.
- 19 self-combinations.
- `node tools/validate.mjs`: all checks passed, 406 / 406 reachable.
- `node tools/check-engine.mjs`: **14 engine scenarios passed**, including WORKING
  SET usefulness/ownership invariants and exact domain-completion reporting.
- `node tools/check-v7.mjs`: media, adaptive-navigation and cache-bust invariants pass.
- 30 valid local WAV assets are packaged; both score files parse as PCM WAV.
- Every shipped JavaScript file passes `node --check`.

The container's Chromium path remains unreliable even for a data URL, so V7 does
not pretend a visual browser playthrough happened here. Deterministic engine,
content, asset and package checks are clean; feel is intended to be judged on the
deployed phone build.

---

# RIZO ORIGIN — V6 Intuition / Continuity Cut

V6 does not add another major system. It is the pass where the game is treated
as one continuous experience instead of a set of individually working parts.
The content graph is unchanged; the work is in timing, state continuity,
feedback order, and the small contradictions a player can feel before they can
name them.

## Seams found and closed

- **Reusable results read as stale on mobile.** The result slot now deliberately
  changes from BORN / KNOWN / NEW ROUTE to **TAP TO USE**, and the workbench copy
  explains that the result can go straight back in.
- **A failed reaction could leave the bench feeling sticky.** Both ingredients
  now burn out as one completed event after the failure has landed.
- **Old result flavour could leak into the next attempt.** Starting or clearing a
  new pair now removes stale reaction copy while preserving a real active hint.
- **RECENT was not truly recent.** The encyclopedia now uses actual discovery
  chronology rather than content-table order.
- **Opening the encyclopedia could consume NEW state.** A discovery stays fresh
  until the player actually uses it.
- **Count semantics disagreed after anomalies appeared.** FOUND remains the
  counted world everywhere; anomalies are shown separately instead of silently
  inflating some screens and not others.
- **Two-output reactions could give both reveals the same FOUND number.** Every
  result now carries its own discovery ordinal. `sea + volcano`, for example,
  cannot produce two cards both claiming the final count.
- **The second output could visually exist before its reveal.** Queued extra
  results now stay backstage: the grid and visible counters advance only when
  that result's own reveal begins, so an AND ALSO surprise cannot spoil itself.
- **Secondary landmarks were not receiving landmark treatment.** PRIMORDIAL
  SOUP exposed this because it is the second output of `sea + volcano`; second
  results now obey the same landmark / anomaly / new-domain presentation rules
  as primary results.
- **LAST DISCOVERY could name the first result of a two-output reaction.** It now
  records the last thing the player actually saw emerge.
- **Achievements earned on a failure or known route could unlock silently.**
  They now receive their sound and toast on the turn that earned them.
- **Achievement toasts could evict the current discovery card.** Their stack is
  capped independently; the thing the player just made always owns its moment.
- **A discovery card was allowed to breathe in one system and replaced too soon
  by another.** The queue now gives ordinary reveals a real read beat before the
  next queued event can replace them.
- **Authored RIZO beats could fire behind a full-screen landmark and be lost.**
  Reaction feedback is now directed in order: discovery ceremony first, then the
  board speaks. A signal is not marked delivered until it was actually shown.
- **Milestone copy could be skipped by a two-result reaction.** First-session
  authored beats now trigger when a threshold is crossed, not only when the
  count happens to land on one exact number.
- **Momentum audio could chirp over a landmark cue.** Landmark reactions still
  keep their heat internally, but the smaller chain sound yields to the larger
  discovery so the sound hierarchy remains legible.
- **Landmarks could announce themselves twice.** A major discovery ceremony is
  now the reveal instead of being immediately followed by a smaller duplicate
  card. If it also opens a domain, that fact is folded into the same ceremony.
- **Signature animation could be skipped before it finished.** LIFE in particular
  is protected long enough for both heartbeat beats to play; other landmark
  holds are matched to their authored motion before a tap can dismiss them.
- **NEW GAME was not completely new at the presentation layer.** It now resets
  the intro, session clock, cached newborn tiles, search/filter/book state,
  transient cards and reaction UI, while preserving the player's explicit sound
  and animation preferences.
- **The hint lamp could keep begging after the player accepted a hint.** Taking
  the hint now quiets the lamp; it only starts asking again when no hint is
  currently active.
- **TIME IN HERE could lag behind the run by an autosave interval.** Record and
  completion screens now read live session time instead of only persisted time.
- **The laboratory could seep in behind the sealed intro on a restarted game.**
  Audio permission is still armed from the trusted gesture, but audible ambience
  now begins only when the seal actually breaks.
- **Ambient music could continue while the page was hidden.** It pauses with the
  page and resumes cleanly; major moments duck the room instead of fighting it.
- **Clipboard sharing lost the challenge text.** The non-native-share fallback
  now copies the score challenge and URL together.

## Restraint decisions

- LIFE is still not spoiled. Getting stuck is part of the game.
- No new currency, daily system, ad loop, tutorial layer, or navigation was
  added. The existing mystery remains the retention mechanic.
- RIZO SIGNAL stays an in-world reveal first and a bridge to the brand second.
- The recipe graph, progression depth, and save key remain compatible with V5.

## Verified

- 406 total elements: 374 counted + 32 anomalies.
- 553 unique reactions.
- 22 domains.
- 23 progression waves from FIRE / WATER / EARTH / AIR.
- 19 self-combinations.
- `node tools/validate.mjs`: all checks passed, 406 / 406 reachable.
- `node tools/check-engine.mjs`: all 12 engine scenarios passed, including the
  new multi-result ordinal / last-discovery regression and true-new-game test.
- Every shipped JavaScript file passes `node --check`.
- Every local asset referenced by `index.html` exists.
- All 23 packaged audio files resolve and parse as valid PCM WAV files.

The execution environment still cannot provide trustworthy Chromium rendering,
so this pass does not claim a visual browser playthrough from the container.
The engine/content/package checks are deterministic; final feel should be judged
on the deployed phone build.
