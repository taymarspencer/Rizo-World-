# V76 — Defense Rhythm Engine

## Source thesis translated into Rizo
The supplied BTD5 reverse-design study argues that smooth mobile tower defense is primarily about **scheduling chaos**: discrete rounds, packets and recovery gaps, property-driven difficulty, fixed spatial composition, and bounded presentation work. v76 implements those principles in Rizo's existing architecture rather than reproducing BTD content.

## Wave scheduler
`defense-core-v76.js` owns deterministic wave construction.

Key rules:
- top-level enemy growth flattens in late bands
- themed rush/wall/swarm waves are set pieces
- every tenth wave reserves a boss entrance packet
- post-boss waves create recovery valleys
- packet timing is authored before combat
- child fan-out is reserved against the same gameplay density budget
- runtime caps remain emergency safety, not a device-specific difficulty scaler

## Simulation / presentation split
`game-v76-defense.js` uses an accumulator-driven fixed simulation:

- `stepSeconds = 1/30`
- `maxCatchUpSteps = 4`
- wall-clock input/UI/checkpoint work remains separate
- game time is multiplied by selected speed before accumulating
- 2x runs additional fixed steps rather than increasing the fixed `dt`
- simulation owns numeric position/cooldown/damage state
- presentation interpolates `prevX/prevY -> x/y`

A regression found during this pass was also removed: enemy status/class refreshes were still able to perform direct position writes while fixed simulation was active. In v76, non-forced status refreshes no longer own movement; presentation is the sole routine mover.

## Representative projectile renderer
`fireDefenseTower()` always creates/executes logical combat state unless the logical safety ceiling itself is reached. A separate visual cadence decides whether that logical shot receives a DOM tracer.

This reduces allocation, transforms, and compositing under rapid fire while keeping DPS deterministic.

## Adaptive governor
The governor records frame timing and evaluates rolling p95/p99 samples. Sustained pressure downshifts presentation; recovery requires sustained stability.

The low tier does **not** reduce authored enemy density. Dense scenes can reduce projectile/effect/weather budgets while retaining 60 Hz motion; presentation drops to 30 fps only when the measured governor reaches the hard-low tier.

## Player rhythm
Wave completion is now a real state boundary:
- `WAVE_COMPLETE` finalizes reward and checkpoint first
- next wave is locked for ~0.55 s so completion lands perceptually
- manual start remains default
- Auto Waves are optional and use ~2.4 s planning time

## New QA coverage
`tests/browser-v76-rhythm-engine.py` verifies:
- packet/breath grammar
- flattened late top-level counts
- deterministic 30 Hz simulation under 30-fps-like callbacks
- exact 2x game-time behavior
- adaptive quality under sustained bad frame samples
- device-invariant gameplay density
- logical-vs-visible projectile coalescing
- manual wave punctuation / default auto-wave policy

## Known next ceiling
Defense combat objects are still primarily DOM/CSS entities. v76 deliberately first fixes pacing, simulation architecture, and unnecessary presentation work. If physical iPhone testing still exposes insufficient headroom, the next major renderer step is migrating combat sprites to Canvas/OffscreenCanvas while retaining this fixed simulation and authored wave model.
