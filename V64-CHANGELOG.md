# V64 Changelog

## Progression integrity

- Added independent `currentWave` and `clearedWave` state.
- Wave completion now requires empty packet, flat spawn, child-spawn, active-enemy, projectile, boss-add, and delayed-spawn work before advancing `clearedWave`.
- Banking during combat excludes the active wave and explains the exclusion.
- Death records the reached wave separately while awarding only cleared progress.
- Rewired Ember rewards, high scores, map records, mastery, training, contracts, milestones, perfect-wave counts, achievements, run history, and recaps to completed accomplishments.

## Production hardening

- Removed direct public QA helper globals.
- Added one gated `window.RizoRuntimeQA` factory for localhost, `127.0.0.1`, or `?qa=1` only.
- Added centralized number/integer/ID validation and meaningful defense limits.
- Added versioned checkpoint signatures for corruption/casual-tamper detection.
- Reconstructs tower investment, enemy HP/armor/reward, tower stats, and checkpoint entities from canonical registries.
- Rejects unknown map, enemy, boss, tower target-mode, doctrine, queue, and status IDs.

## Scheduler and performance

- Replaced the continuous wave stream with generated packets and short packet breaks.
- Capped planned normal-wave population at 46.
- Added `childSpawnQueue`; split children release through the scheduler and cannot bypass density limits.
- Added explicit normal/low budgets for enemies, projectiles, impacts, target scans, HUD writes, and income flushes.
- 2× speed now has a hard visual ceiling of nine active enemies even if adaptive quality changes tiers.
- Added cached tower targets and retarget timers.
- Batches kill income and HUD writes without changing combat math.
- Preserved and verified enemy/projectile/impact pools.

## Economy and flow

- Standardized all worlds to 220 starting coins and removed obsolete per-world starting-cash fields.
- Added clear wave allowance plus perfect/efficiency bonuses.
- Added explicit upgrade costs: 110, 180, 280, 420.
- Added one 20% first-upgrade opening perk for eligible Rizos in Moon, Storm, Blizzard, Ember, and Eclipse.
- Capped global Golden income at 1.22× with diminishing duplicate value.
- Added 70% planning refund and five-second 100% placement undo.
- Disabled normal placement/selling during combat; upgrades are allowed only in phase-approved planning/safe windows.
- Added late-run diminishing returns to permanent Ember payout.

## Phase and UI architecture

- Added explicit planning, countdown, combat, packet-break, wave-complete, paused, and run-complete phases.
- Consolidated portrait, short-phone, landscape, and tablet layouts around one Defense shell.
- Rebuilt HUD, command rail, roster, tower sheet, powers, threat intel, field menu, lobby, records, and guide into one component language.
- Added bounded modal/sheet behavior and conflicting-overlay prevention.
- Increased recurring touch targets and enforced a 10.5px automated text floor.
- Preserved safe areas and tested all required viewport classes.

## CSS reduction

- Active stylesheet: 484,527 → 245,913 bytes (**49.2% smaller**).
- Lines: 5,655 → 3,313.
- `!important`: 3,676 → 250; active Defense rules contain none.
- Media queries: 104 → 26.
- The old v54–v63 Defense override chain is no longer loaded by `index.html`.
