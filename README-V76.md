# Rizo.game v76 — Defense Rhythm Engine

## Product goal
Turn Rizo Defense from a continuously busy browser tower-defense loop into an authored mobile strategy game: pressure arrives in readable formations, the player owns wave boundaries, late difficulty comes from composition and enemy properties, and iOS performance can degrade visually without changing combat rules.

v76 is based on the supplied **BTD5 → Rizo Defense Design Translation** research. It translates pacing and mobile-engine principles only; it does not copy BTD5 code, maps, art, characters, sounds, UI, economy, or exact round tables.

## What changed

### 1. Authored packet rhythm
Waves are pregenerated into deterministic packets instead of behaving like one continuous enemy faucet.

General v76 grammar:
`intro -> packet -> breath -> packet -> optional twist -> cleanup -> resolved field`

Starting pacing bands:
- waves 1–5: 5–9 unit packets, ~0.40–0.55 s spawn gaps, ~1.20–1.80 s breaths
- waves 6–15: 7–12 unit packets, ~0.24–0.34 s gaps, ~1.05–1.65 s breaths
- later standard play: 8–14 unit packets, ~0.16–0.26 s gaps, ~0.90–1.50 s breaths
- rushes are short authored exceptions, not the permanent late-game cadence
- boss entrances receive their own final packet and a larger pre-boss breath
- the wave after each boss is deliberately a recovery valley

### 2. Difficulty is composition-led
Late top-level counts flatten instead of scaling forever. Existing Rizo enemy vocabulary now carries more of the difficulty curve: armor, splitters, camouflage, phasing, fire/slow resistance, speed pressure, weather interactions, heavy durability, and bosses.

The scheduler targets memorable formations and leaves concurrency headroom for child splits instead of filling the battlefield to its safety ceiling every wave.

### 3. Fixed 30 Hz combat simulation
Defense logic now advances in deterministic 1/30-second steps independent of presentation frequency.

- simulation: 30 Hz fixed
- presentation: normally 60 fps when affordable
- measured-pressure Q1 presentation tier: 30 fps; dense fields can shed cosmetics while retaining 60 Hz motion when frame health is good
- maximum catch-up: 4 fixed steps before quality is forced down and backlog is clamped
- 2x executes more fixed game-time steps; it never doubles `dt`
- enemy/projectile presentation interpolates numeric simulation snapshots

This means a throttled browser can become lower-frame-rate-looking without becoming lower-frame-rate-thinking.

### 4. Gameplay no longer changes with device pressure
The authored active-enemy ceiling is invariant across 1x, 2x, full visual quality, and low visual quality. The low-power path reduces presentation work instead:

- fewer rendered projectile tracers
- fewer impact effects
- reduced weather density
- no expensive soft visual layers at lower tiers
- slower noncritical UI / target-candidate refreshes
- 30 fps presentation when necessary

Enemy formation difficulty, rewards, cooldown math, movement, and child release remain deterministic.

### 5. Logical shots are separate from visible shots
A rapid-fire tower can deal every logical hit while rendering only a representative subset of projectile tracers.

Default visual emission targets:
- normal: ~10 projectile visuals/sec/tower
- 2x: ~8/sec
- low presentation tier: ~6/sec

Logical projectiles remain exact up to a separate safety ceiling. Ordinary impacts and pops were shortened so the commonest combat event is also one of the cheapest.

### 6. Adaptive quality governor
The runtime tracks frame samples and p95/p99 behavior rather than trying to detect iOS Low Power Mode directly.

Sustained measured frame pressure moves through Q3 -> Q2 -> Q1-style presentation tiers. Density can preemptively shed expensive cosmetics without automatically forcing motion to 30 fps; only the measured performance governor earns that presentation downgrade. Recovery requires a much longer stable window than degradation, preventing constant visual-quality oscillation.

Priority under pressure:
1. input
2. simulation/reward correctness
3. enemy movement continuity
4. tower responsiveness
5. core hit readability
6. cosmetic particles/trails
7. shadows/glow
8. weather/decorative motion

### 7. Player-owned wave boundaries
Auto waves are **OFF by default**.

After the final threat resolves:
- reward bookkeeping completes once
- the battlefield gets a ~0.55 s punctuation/settling beat
- the player decides when the next formation begins
- optional Auto Waves uses a ~2.4 s planning countdown and is postponed by planning interactions

### 8. Route fidelity preserved
The v74 canonical road/path system remains active. Simulation and artwork still derive from the same map route, including corrected boss visual anchors.

## Arcade preservation
v75 Arcade Revival remains included: ten games, permanent Rizo training, Skybound Rizo, Ember Breaker, rebuilt DX cabinets, Ember Beat, Rain Walk, and Defense.

## Physical-device reality
The automated suite can verify deterministic behavior, bounded DOM growth, route fidelity, 30-fps-like callback behavior, and comparative browser performance. It cannot reproduce an actual iPhone's battery, temperature, screen-share encoder, or Safari power policy perfectly. Physical iPhone Low Power Mode + screen-share testing remains the authority for subjective smoothness.

## Final QA gate
The final v76 deployable build passed **445/445 automated checks** across the retained and new suites:

- 27/27 Defense core logic
- 4/4 service-worker policy
- 80/80 static architecture
- 5/5 launch/recovery
- 17/17 v75 Arcade behavior/training/replay regression
- 66/66 v75 Arcade phone/landscape surfaces
- 77/77 Defense gameplay/economy integration
- 76/76 Defense device/surface matrix
- 43/43 battlefield-art regression
- 17/17 cinematic/exploit regression
- 19/19 canonical route-fidelity regression
- 14/14 new v76 rhythm-engine checks

Latest headless 390x844 comparative profile held ~60 fps requestAnimationFrame cadence at both 1x and 2x in the dense stress harness. At 13–14 active enemies the runtime shed to the cheapest cosmetic tier but retained a 60 fps presentation target because measured frame health stayed good; the 30 fps presentation target is reserved for measured pressure. Long-session pooling finished with no DOM growth and no heap-growth signal in that harness. These are build-host measurements, not a claim about a physical iPhone under Low Power Mode or screen sharing.
