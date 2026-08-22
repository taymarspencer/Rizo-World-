# V67 Phase 4 Architecture

## Two-clock contract

`simulationClock` advances by speed-adjusted delta. It owns movement, attack cooldowns, status duration, wave gaps, weather mechanics, boss behavior, and exact combat outcomes.

`realClock` advances by unscaled frame delta. It owns operations whose device cost should not double at 2×:

- target refresh
- shared target-snapshot refresh
- UI refresh
- checkpoint cadence
- income flush cadence
- child release pacing
- visual-pressure selection

The animation loop calls:

```js
updateDefenseGame(frameDt * speed, frameDt);
```

## Packet scheduler

A wave remains a pregenerated list of packets. Runtime indexes point to the active packet and enemy. Packet breaks use simulation time because fast-forward should accelerate gameplay rhythm. Admission still requires the centralized density contract.

## Child scheduler

Split, boss-add, and delayed child entries are inserted in release order once. Release requires all three conditions:

1. simulation release time reached;
2. wall-time child interval reached;
3. density budget has room.

Normal packet admission reserves up to three imminent child entries so a normal spawn cannot consume space already owed to a split animation.

## Target scheduler

Each tower stores a stable ID plus a runtime object reference. Dead or missing references invalidate immediately. Otherwise, target choice refreshes on `retargetAtReal` using a shared active-enemy snapshot. The snapshot itself is rebuilt on a wall-time budget instead of separately filtering the full enemy list for every tower.

## Income scheduler

Kills and passive sources append exact values to `pendingIncome`. A real-time flush consolidates multiple events into one cash mutation and one HUD invalidation. Forced flushes run before any persistence or terminal transition.

## Visual scheduler

Simulation objects remain authoritative even when visuals are skipped. At 2×, only presentation ceilings change: fewer projectile nodes, fewer impact nodes, and quieter weather. Damage, travel resolution, rewards, and status effects remain exact.

## Save boundary

`realClock`, target references, target snapshots, child wall timers, and visual scheduler state are runtime-only. Restores rebuild them from safe defaults. Canonical combat and progression fields remain protected by Phase 3 validation.
