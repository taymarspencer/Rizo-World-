# Rizo Defense v69 — Phase 6 Changelog

## UI foundation
- Added one explicit Defense phase-transition contract: planning, countdown, combat, packet break, wave complete, paused, run complete.
- Runtime phase changes now reject illegal transitions instead of allowing contradictory boolean combinations.
- Added a persistent phase treatment to the battlefield HUD with separate `WAVE` and `CLEARED` values.
- Added semantic phase labels: PLAN, INCOMING, DEFEND, BREATHER, CLEARED, PAUSED, COMPLETE.
- Consolidated contextual Defense surfaces behind one overlay manager.
- Field menu, abilities, threat intel, and tower context are mutually exclusive.
- Open context surfaces make battlefield, command deck, and roster inert, apply a controlled scrim, trap keyboard focus, and restore interaction on close.
- Escape/back closes the active Defense context before any run-exit behavior.

## Responsive layout
- Added an explicit `minmax(0,1fr)` portrait grid contract so intrinsic child width cannot widen the game beyond the viewport.
- Short portrait now prioritizes Hearts + Coins over persistent map metadata.
- All six primary command controls fit at 320 px; the start-wave control becomes icon-first rather than overflowing.
- Triple-digit waves retain a visible Cleared value and phase indicator.
- Large cash values use compact HUD presentation (`K`/`M`) while exact economy math is unchanged.
- Preserved the intentional landscape command-wing layout and tablet layouts.

## Startup / white-screen hardening
- Release runtime filenames are now versioned for v69 instead of mutating files still named v64.
- Added `boot-v70-phase7.js`, which detects incomplete/mixed startup and displays recovery controls instead of leaving a blank screen.
- Recovery can reload cleanly or unregister Rizo service workers + delete Rizo offline caches without deleting local player saves.
- Service-worker core runtime requests are network-first with cached offline fallback.
- Required boot shell caches atomically; optional art caches best-effort so one missing cosmetic cannot invalidate an update.
- Added explicit deployment MIME/cache headers and `nosniff`.
- Disabled the automatic install gate on normal launch. Install help remains available manually in Settings.

## Regression hardening
- Added phase-transition and phase-permission unit coverage.
- Added runtime HUD/state-machine checks.
- Added overlay inert/focus/Escape checks.
- Added service-worker stale-runtime and offline-fallback policy tests.
