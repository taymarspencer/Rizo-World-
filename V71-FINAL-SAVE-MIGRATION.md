# Rizo Defense v71 — Save Migration Notes

## Current schema
- Defense checkpoint schema: version 5.
- Whole-state signed envelope schema: version 1.
- v71 does not invent a new checkpoint schema because Phase 8 cinematic/UI state is intentionally non-persistent.

## Supported checkpoint migration
Legacy checkpoint signature versions 2, 3, and 4 remain verifiable so legitimate v64/v66/v67 data can migrate into the current v5 canonical form. The v68 economy state is represented by v5.

## Wave migration
Older history/save data is interpreted conservatively:
- completed record authority becomes `clearedWave`;
- `reachedWave` may retain the started-but-unfinished wave for analytics;
- migration never promotes a merely reached wave into permanent completion credit.

## Canonical reconstruction
Checkpoint normalization reconstructs or validates:
- enemy HP/reward/armor/speed/damage from known definitions and wave;
- tower identity/source/copy metadata from legitimate pets/roster;
- tower upgrade investment from explicit upgrade tables;
- opening-world discount state from canonical tower investment;
- queue entries, bosses, map IDs, enemy IDs, and other registries against known IDs.

## Failed validation
A failed signature does not crash the game. The checkpoint is sanitized to conservative values: no forged current/cleared wave, run cash, kills, damage, upgrades, queues, or reward counters are trusted. Legitimate broader player state is preserved where the verified save envelope supports it.

## Cache recovery is not save deletion
The Phase 6+ boot recovery path unregisters Rizo service workers and removes `rizo-game-*` caches only. It deliberately does not erase localStorage/player saves.
