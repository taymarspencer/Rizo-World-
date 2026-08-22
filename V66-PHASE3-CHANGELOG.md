# V66 Phase 3 Changelog — Production Hardening

## QA isolation

- Removed production assignments for `window.RizoVisualQA` and `window.RizoBeatQA`.
- Kept all development helpers in one frozen `RizoRuntimeQA` factory.
- Exposed that namespace only when the host is `localhost`, `127.0.0.1`, or the explicit `?qa=1` condition is present.
- Added production cleanup for all legacy QA namespaces.
- Kept production gameplay independent of the QA API.

## Whole-save integrity

- Added a versioned signed save envelope containing `app`, `saveVersion`, `stateVersion`, `savedAt`, `state`, and `signature`.
- Added a verified mirror backup under a separate storage key.
- Added automatic recovery from the verified mirror when the primary signature fails.
- Added local validation-warning records for load, import, recovery, and write failures.
- Extended the signature payload across wallet, pet progression, inventory, collection, arcade scores, Defense records, contracts, mastery, season, expedition, treasures, farm roster/counters, achievements, lore unlocks, and important meta counters.
- Updated normal saves, exports, Keeper recovery codes, and pre-recovery backups to use signed envelopes.
- Invalid current signed data can no longer use forged history or counters to justify currency. With no valid backup, reward-bearing progress resets conservatively while sanitized pet identity and known cosmetics are retained where possible.

## Checkpoint integrity

- Advanced Defense checkpoint schema from v2 to v3.
- Preserved v2 signature verification solely for migration.
- Expanded checkpoint signatures to cover tower identities/owners/positions/upgrades/combat counters, active enemies, spawn queue, child queue, phase, speed, clock, wave accounting, bosses, and perfect-wave counters.
- Added a new checkpoint key and retained old keys as migration sources.
- Invalid v2/v3 signatures now fail closed to verified permanent map progress and canonical opening cash.
- Forged active-wave income, kills, damage, bosses, perfect waves, upgrades, cooldowns, doctrines, statuses, queues, and active enemies are discarded.

## Canonical reconstruction

- Reconstructs tower ownership from the actual active/house roster.
- Rejects unknown pet IDs instead of trusting stored owner/source fields.
- Recalculates placement cost and upgrade investment from canonical rules.
- Recalculates enemy HP, armor, speed, damage, and reward from canonical definitions, map modifiers, wave, boss intensity, and child scale.
- Rejects unknown enemies, bosses, queued entries, maps, doctrines, and target modes.
- Clears stored target references and retarget timers.

## Centralized validation

Added or applied explicit ceilings for:

- Wallet Embers and Shards
- Inventory stacks and collection counts
- Player/pet XP
- Current and cleared wave
- Run cash, towers, upgrade level
- Kills, damage, bosses, and perfect waves
- Mastery waves/runs
- Season XP/level
- Farm and meta counters

## Build consistency

- Advanced state schema to `18`.
- Advanced build metadata to `v66-phase3-production-hardening`.
- Advanced service-worker cache to `rizo-game-v66-phase3-production-hardening`.
- Added automated checks that index metadata and service-worker identity match the release.
