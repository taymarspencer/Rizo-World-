# Rizo Defense v68 — Phase 5 Architecture

## Single economy authority

`defense-core-v64.js` owns the stable economic contracts:

- `ECONOMY`
- `UPGRADE_COSTS`
- `deploymentCost()`
- `upgradeCost()` / `calculateTowerInvestment()`
- `goldenBonus()` / `goldenActivePayout()`
- `calculateEnemyReward()`
- `calculateWaveBonus()`
- `calculateRunEmbers()`

The runtime asks the core for those values instead of maintaining parallel formulas.

## Runtime responsibility

`game-v64-professional-defense.js` supplies game context to the core:

- current map and phase
- tower/pet variant
- whether the one-shot world opening perk is still available
- real placement time
- current tower count/copy count
- completed wave and run accomplishment counters

The runtime is responsible for player feedback and action gating, not economic math duplication.

## Phase/economy boundary

The existing `DefenseCore.phaseAllows()` table is the authority for build actions. Economy functions do not infer permissions from booleans such as `combatStarted`.

- planning / wave-complete → build economy open
- packet-break → upgrade window only
- combat → abilities/targeting/bank, no build economy

## Checkpoint trust boundary

Checkpoint data stores enough identity/state to resume a run, but derived spending/reward values are reconstructed. v68 additionally signs world-opening economy state. A migrated v67 checkpoint cannot create multiple discounted first upgrades.

## Performance compatibility

Phase 5 does not bypass the Phase 4 scheduler. Kill income still enters the pending-income batch, and saving/completion/banking/death flush pending income before serialization or permanent progression.
