# Phase 6 Architecture Summary

## Phase authority
`defense-core-v70.js` owns `PHASES`, `PHASE_TRANSITIONS`, `canTransitionPhase()` and `phaseAllows()`. Gameplay code uses `defenseSetPhase()` as the normal transition boundary. QA may force a phase only inside the gated QA namespace.

## UI structure
The Defense shell uses one grid contract with named areas for HUD, battlefield, feed, contextual surface, and roster. Portrait uses one constrained column; landscape explicitly becomes three command/field/roster columns. The consolidated v69 Defense CSS remains the single active Defense styling system and contains no Defense `!important` patch layer.

## Context surface manager
`syncDefenseOverlayState()` resolves one of: menu, abilities, intel, tower. It controls scrim state, `inert`, `aria-hidden`, focus entry/return, and conflict cleanup. Background input is disabled conceptually rather than solved by ever-higher z-index values.

## Startup boundary
`index.html` declares the expected v69 build, loads `boot-v70-phase7.js`, then the versioned runtime. The runtime reports readiness with `RizoBoot.ready(actualBuild)`. A mismatch or startup failure produces a recovery surface instead of a silent blank page.

## Offline/update boundary
`sw.js` uses a v69 cache. Required boot/runtime resources are network-first after install; cached copies are offline fallback. Art remains cache-first. Required shell failure prevents a broken worker from replacing a known-good worker; optional asset failures do not abort the worker update.
