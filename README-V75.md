# Rizo.game v75 — Arcade Revival

## Product goal
Turn the Arcade from a collection of short side activities into a memorable part of raising a Rizo: simple controls, strong replay loops, permanent pet training, old-school readability, and modern quality-of-life features.

## Arcade lineup — 10 playable games

| Game | v75 role | Permanent training |
| --- | --- | --- |
| Power Tap DX | Moving timing target, streak multiplier, Overdrive, persistent bag damage feedback | Power |
| Spark Catch DX | Normal/gold signals plus shadow decoys that reward restraint | Instinct |
| Forest Forage DX | Three-lane movement, five-item lunch orders, chains, prisms, hazards | Instinct + Luck |
| Rizo Rush DX | Air jump, mixed obstacle heights, prism pickups, clean-clear streaks, 3 hearts | Speed |
| Rain Walk | Existing branching outdoor adventure retained | Stamina + Luck |
| Ember Beat | Existing four-lane / ten-song rhythm pillar retained | Speed |
| Forest Memory DX | Forward/reverse rounds, escalating playback speed, 3-life pressure | Instinct + Luck |
| Skybound Rizo | New one-touch flight with wind, precision gates, prism gates, 3 hearts | Stamina + Speed |
| Ember Breaker | New Rizo-as-paddle breakout game with rebound angles, armored/prism blocks, walls | Power + Instinct |
| Rizo Defense | v74 Smooth Defense retained intact as the strategy pillar | Deployed-Rizo mastery |

## Shared arcade philosophy
- Games are playable immediately without tutorial walls.
- Runs are short enough to invite another attempt.
- Mastery is expressed through streaks, accuracy, changing rules, rare events, and risk/reward rather than merely raising raw speed.
- Results retain personal bests and show game-specific run statistics.
- Every normal Arcade result explains that the run permanently trained the active Rizo.
- `RUN IT BACK` gives a direct replay loop.
- Arcade activity can contribute to the existing Retro Rizo signal instead of living outside the Rizo world.

## New games
### Skybound Rizo
A one-touch flight game inspired by the readability of old mobile score chasers without being a clone. Gravity and wind create the physics; gates contain variable openings; rare prism gates are tighter and worth more; center-threading earns precision bonuses. Three hearts make one mistake recoverable instead of instantly deleting a good run.

### Ember Breaker
A Rizo-world interpretation of brick-breaker games. Rizo is the paddle, so dragging the pet directly controls the rebound angle. Walls grow with level, armored blocks take two hits, prism blocks temporarily widen the paddle, and rebounds build a mastery streak. Three lost balls end the run.

## Rebuilt cabinets
### Power Tap DX
The perfect zone moves instead of remaining a static center target. Clean timing builds streak multipliers, repeated accuracy accelerates the needle, and a heat meter triggers an Overdrive reward. The bag visibly cracks as the run progresses.

### Spark Catch DX
Reaction speed is no longer the only answer. Gold sparks create high-value opportunities while shadow decoys explicitly reward *not* tapping. This adds signal reading and restraint to a previously pure reaction game.

### Forest Forage DX
Rizo now asks for a five-item lunch sequence. Correct catches advance the order and build multipliers; wrong edible items give only a consolation point; mushrooms punish mistakes; prisms are rare bonuses. Completing an order creates a clear mini-goal inside the run.

### Rizo Rush DX
Adds an air jump, tall obstacles that demand it, prism pickups, clean-obstacle streaks, and a three-heart fail state. Difficulty now comes from reading obstacle types and choosing jump timing rather than endless raw acceleration.

### Forest Memory DX
Every third round reverses the required sequence. Playback accelerates over time, mistakes cost one of three hearts, and failed rounds replay their pattern rather than resetting the whole activity immediately.

## Performance / maintainability
- v75 is an additive Arcade layer (`arcade-v75.css`) on the v74 Defense renderer; Defense layout and tuned performance CSS are not reworked in this release.
- No `!important` declarations were added by the v75 Arcade stylesheet.
- New games keep small bounded entity counts: Skybound only carries a few gates; Ember Breaker uses one ball and a compact block board.
- Reduced-motion rules stop decorative Skybound/Spark animation without altering game logic.
- New score fields (`glide`, `breaker`) migrate through the existing normalized score object with safe defaults.
- Service-worker cache/build markers are advanced together to `v75-arcade-revival`.

## QA gate
Final v75 gates include:
- 25/25 Defense core logic
- 4/4 service-worker policy
- 74/74 static architecture
- 5/5 launch/recovery
- 17/17 v75 Arcade behavior/training/replay
- 66/66 v75 Arcade phone/landscape surfaces
- 77/77 Defense gameplay/economy integration on final rerun
- 76/76 Defense device/surface matrix
- 43/43 Defense battlefield-art regression
- 17/17 Defense cinematic/exploit regression
- 19/19 Defense route-fidelity regression (worst visual knot error 0.066 px)

Physical-device playtesting is still the authority for subjective game feel, especially sound mix, haptic feel, and difficulty curves.
