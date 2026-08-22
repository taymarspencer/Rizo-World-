# V67 Phase 4 Deleted or Superseded Systems

- Removed the single-delta assumption where all control work inherited simulation speed.
- Removed simulation-clock income flush scheduling.
- Removed simulation-clock target refresh scheduling.
- Removed simulation-speed UI and checkpoint cadence coupling.
- Removed per-frame `childSpawnQueue.sort(...)`.
- Removed unrestricted same-frame child release pressure.
- Removed the boss-only active-density bypass.
- Superseded repeated full enemy-array filtering per tower with one shared target snapshot.
- Superseded repeated ID lookup as the primary target cache with a runtime object reference plus stable ID.
- Superseded fixed 2× visual ceilings with explicit reduced projectile, impact, and weather budgets.
- Superseded V66 checkpoint output with V67 schema 4 while retaining migration readers.

No large CSS override block was added. One existing weather rule was edited to consume the new variable.
