# Rizo World: Home / Train / Go

Starting remote `develop`: `35ddead37c0ed8f08fb4c33d0737cb8ac8fdf24b`.
Branch: `feat/rizo-world-home-train-go`. Runtime: `v93-home-train-go`. Hub state: v23.

## The product model

The Den is Home. Its creature, objects, care, and evolving room are the first screen.
Training is a place to do small repeatable games together. Go is the departure point for
substantial authored experiences. All three share the existing pet, wallet, and signed save.
There is one suggested drill, a collapsed full library, and three primary navigation buttons.
House, Wardrobe, and Journal remain secondary places around Home. The Den contains no mode cards.

| Existing activity | Current place | Preserved role |
| --- | --- | --- |
| Pet simulation, care, direct taps, ball/stump/puddle/bush, rest | Home / Den | Persistent creature, skills, XP, bond, care history |
| House, adoption, resident rooms, Friendship Sparks / Legacy | Home → House | Existing unlocks, prices, roster, inheritance |
| Room themes, clothing, capsules | Home → Wardrobe | Existing purchases, variants and cosmetic ownership |
| Stats, growth, collection, memories, settings, export/import/recovery | Home → Journal / More | Existing records and save tools |
| Power Tape (`power`) | Train → drill library | Called strikes, feints, Power |
| Spark Stash (`spark`) | Train → drill library | Stash, bank/spill, Instinct |
| Forest Lunch (`forage`) | Train → drill library | Orders, lanes, Instinct |
| Rizo Courier (`rush`) | Train → drill library | Deliveries, obstacles, Speed |
| Rain Walk (`walk`) | Train → drill library | Routes, weather, errands, Stamina |
| Ember Beat (`rhythm`) | Train → drill library | Ten songs, charts, existing song unlocks |
| Lost Signal (`memory`) | Train → drill library | Sequence transformations, existing payout contract |
| Skybound (`glide`) | Train → drill library | Wind gates, Thermal Burst, flight |
| Ember Forge (`breaker`) | Train → drill library | Authored block walls and modifiers |
| Rizo Runaway / Pac-Man Rizo (`maze`) | Train → drill library | Existing maze, hunters, Prism Seeds, signal progression |
| Rizo Dungeon | Go → Dungeon | threshold-v3 opening, The Threshold, Mending Rows / Nell Chapter 1 |
| Rizo Defense | Go → Defense | Maps, roster, contracts, waves, bosses, upgrades, run checkpoints |
| Passive forest expeditions | Go → collapsed “A little errand” | Existing short passive loot/lore errands |
| Daily gifts, quests, seasons, heat and achievements | Home → “The little things” / Journal | Existing rewards and unlocks |

**Pac-Man decision:** Rizo Runaway is a strong arcade drill. It has a single repeatable maze,
a short run, three hunter behaviors and Prism Seeds, plus the existing Retro signal progression.
It does not currently have a destination-sized campaign, authored world map, or independent
long-term progression loop. Keep its game intact in Training; graduation can follow additional content.

## Creature and physical play

Each pet owns `denPosition: {x, y}`. A separate `#denPlacement` DOM parent paints spatial location;
the actor inside owns stage/health scale and the motion shell owns local reactions. A tap, pat,
food reaction, redraw, or reaction timeout cannot replace the pet's coordinates. Autonomous walks
and object interactions can move the pet deliberately; the destination remains after the reaction. Rendering also bounds the body inside the current phone
scene as Rizo grows, without changing his saved logical position.
Positions follow residents through House swaps. Reaction timers check pet identity and sequence,
and presentation is reset on replacement, import, restoration, rebirth, and QA load.
Den behavior cannot leak into a Training actor or a wardrobe preview.

Play now highlights objects in the room instead of opening an action menu. Tap the ball, stump,
puddle, or bush, or drag the ball across the Den. Rizo moves toward the object/drop and reacts there.
Repeated object uses have small varied responses. The bed is a real rest/wake target; waking does
not recenter him. Existing eye attention, personality, care, grime, clothing, and flame/body reactions remain.
No physics engine, toy inventory currency, or minigame launch buttons were added to the room.

Physical feeding is retained. Its suppressed follow-up click belongs to the previous feeding release;
a fresh pointer press is accepted immediately. Decorative Power Tape artwork no longer blocks a
called-strike button, and those buttons have a 44px minimum height.

## Economy and visible home growth

**No new currency.** Use the existing Ember wallet. Shards retain their existing capsule role.
Training's qualification, energy cost, par conversion, 1.5× ceiling, XP, skills, bond and unlocks stay intact.
Defense retains its existing larger payouts and pet training. Dungeon retains confirmed one-time
First Knot / Shared Hearth entitlements; it is not a currency grind or a gate on ordinary care.

The first feed, qualifying clean, pat, and talk in a calendar day each add 3 Embers.
The first credited use of each of the four toys adds 6. These save-backed receipts cap the new
bonus at 36 Embers/day. There is no required checklist, streak bonus or missed-day debt.
Toys retain the existing 12-second growth cooldown; a repeated reaction can still play without a payout.
Existing achievements, daily rewards and other rewards continue unchanged.

| Home stage | Incremental Ember price | Visible change |
| --- | ---: | --- |
| Rain Shelter | Starting stage | Familiar little corner, simple rest spot, existing objects |
| Warm Den | 180 | Woven rug, proper bed, lamp and warm light |
| Open Room | 750 | Archway into another living space, books, moved display/window |
| Rooftop Home | 2,400 | Balcony, string lights, telescope and starry sky |
| Orbit / a world of our own | 1,000,000 concept | Visible distant plan; explicitly unavailable for purchase |

Current construction costs 3,330 Embers in total. Costs are incremental, ordered purchases.
The next visible goal uses current spendable Embers, not a second lifetime-total currency.
A construction commits the signed primary save before showing success. Failed primary writes
restore both home and wallet; a failed backup mirror leaves a confirmed primary purchase intact.
A duplicate, skipped tier, stale tab, or unimplemented Orbit purchase cannot spend again.

Home is shared across residents and generations. It is independent of the existing room-theme
cosmetics and House resident-room system; neither inventory nor prices are reinterpreted.
The room displays a patch for distinct trained drills (migrated from old best scores), a Defense
best-wave pennant, First Knot, and the Shared Hearth light. Valid hearth receipts keep that memory
visible after rebirth. Training results show progress toward the next room and offer Take it Home,
Another Drill, or Run it Back. Dungeon and Defense return to the real Den. Their departures show
journey ownership/progress and saved Defense-run awareness.

## Save migration and preservation

Envelope/signature schema remains **v2**. Frozen v1 signing stays unchanged. Hub state advances
22 → 23 through defensive normalization. Missing home becomes tier 0; no past Ember spending or
past care rewards are invented. Existing game bests populate the training patch. Missing pet/resident
placement becomes center, while real zero/fractional coordinates survive. Current Home state and
bonus receipts are saved in the existing envelope, including export/import and Keeper recovery.

Dungeon slices and threshold-v3 facts/choices are not changed by this migration. Defense slices,
checkpoints, receipts, pet identity, care/bond, settings, cosmetics, unlocks and valid wallet values
remain under their original contracts. Newer-save blocking, quarantine, primary/backup recovery,
and two-tab conflict protection remain in place.

`tests/fixtures/v92-home-source.json` was produced by the actual starting build, including real
confirmed Dungeon entitlement receipts. The browser migration test first verifies its original
signature, then rebases only care/session clocks and re-signs the same v2 format so later CI runs
test migration rather than legitimate elapsed neglect. Mode slices, story choices, entitlements,
identity, wallet, cosmetics and settings are compared against that source.

The public landing page, all Dungeon files/assets/story, all ten `training/*.js` implementations,
and Defense gameplay are preserved. The only mode-file change is two outward Defense labels:
“BACK TO ARCADE” now reads “GO HOME.”

## Verification and deliberate limits

`tests/home-core.test.js` checks rules, normalization, cost/order protection, bonus bounds, reload
receipts, drill variety, and position sanitation. `tests/browser-home-world.py` verifies the actual
phone loop at 320/375/390/430, real food/ball interactions and Power Tape taps, spatial continuity,
all current room tiers, reduced motion, save-write failure, old-save migration, mode returns, and Legacy.
It is included in the release CI. Existing release suites continue to cover every authored game,
Dungeon story, Defense, save recovery/conflicts, landing, routing, and atomic offline updates.

Automated device results are Chromium emulation. Physical iOS/Safari, Android and installed-PWA
feel remain device-review work; this pass does not claim physical-device testing.

The current release suite passes **1,190 checks**: 211 in twelve Node suites, and 979 in twelve
browser suites. This includes 110 new Home-loop checks, 371 Dungeon checks, 78 Defense checks,
37 save-safety checks, and 227 checks of the packaged public property and offline routes.
Source syntax passes for all 33 runtime JavaScript files; `git diff --check` is clean.

| Phone viewport | Home / play / Training / build / Dungeon / return / reload |
| --- | --- |
| 320 × 568 | Pass; no horizontal overflow; 44px primary targets |
| 375 × 812 | Pass; no horizontal overflow; 44px primary targets |
| 390 × 844 | Pass; no horizontal overflow; 44px primary targets |
| 430 × 932 | Pass; no horizontal overflow; 44px primary targets |

All four also keep every grown Rizo stage inside the scene at both movement edges. Construction
persists across reload; tests cover primary-write rollback, backup failure, and duplicate purchases.

Files changed: `core/rizo-home.js`, `game-v79-defense.js`, `index.html`, `home-world.css`, `sw.js`,
`modes/defense/defense-mode.js`, `tools/build-site.py`, `ARCHITECTURE.md`, this report,
`.github/workflows/release-candidate.yml`, `tests/home-core.test.js`, `tests/browser-home-world.py`,
`tests/fixtures/v92-home-source.json`, `tests/browser-dungeon.py`, `tests/browser-public-product.py`,
`tests/browser-world-first.py`, `tests/mode-contract.py`, `tests/public-product.test.js`,
and `tests/save-safety.py`.

For Astra: finish the room/destination art direction, richer physical toy poses and modest arrival
staging. Add further room tiers and an actual Orbit destination only when authored. The table-driven
home rules and scoped scene props support that expansion. Do not sell the distant concept first.
No new Dungeon writing, Defense mechanics, minigame campaign, physics engine, idle income,
daily chore loop, or economy replacement was introduced.
