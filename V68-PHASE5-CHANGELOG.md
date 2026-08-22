# Rizo Defense v68 — Phase 5 Changelog

## Economy core

- Promoted defense economy constants into `DefenseCore.ECONOMY`.
- Set `baseStartingCash` to 220 for every world.
- Kept upgrade pricing explicit through `UPGRADE_COSTS = [110, 180, 280, 420]`.
- Added canonical `deploymentCost()` and removed the runtime copy of its formula.
- Added canonical `goldenActivePayout()`.
- Added canonical `calculateEnemyReward()` as the single reconstruction path for live/restored enemy rewards.
- Removed map reward multipliers from wave bonuses and permanent Ember rewards.
- Added permanent-Ember soft cap: raw value through 1600, then 35% value for the excess.

## World openings

- Grove: balanced default opening.
- Ember: first eligible damage upgrade 20% off.
- Moon: first eligible detection upgrade 20% off.
- Storm: first eligible control upgrade 20% off.
- Blizzard: first eligible wide-range upgrade 20% off.
- Eclipse: first eligible support/reveal upgrade 20% off.
- The world perk is one-shot per run and is shown in the lobby/tower economy UI.

## Golden economy

- Global Golden multiplier now caps at 1.22× total income.
- Duplicate Golden towers add progressively smaller global value.
- Golden active payday uses `clearedWave`, not the started wave.
- Golden active wave contribution stops increasing after cleared Wave 40.
- Duplicate Golden active payouts diminish to a 52% floor.

## Placement / upgrades / selling

- Planning and wave-complete: place, move, upgrade, sell.
- Countdown/combat: no normal placement, selling, or upgrades.
- Packet break: upgrades allowed; placement and selling remain locked.
- Five-second full placement undo now uses the real/control clock.
- After the undo window, planning refund is 70% of canonical tower investment.
- Reloaded towers cannot regain a fresh five-second undo window.

## Save migration

- Defense checkpoint version advanced to v5 / key `defense-checkpoint-v68`.
- v67/v4 signatures remain verifiable for migration.
- v68 signatures cover `worldPerkUsed` and per-tower `openingPerkApplied`.
- Legacy v67 checkpoints conservatively infer at most one valid opening discount.

## Regression caught during final audit

Removing obsolete map reward fields initially also removed canonical enemy `reward` definitions. The final source audit caught this before packaging. All nine standard enemy rewards and four boss rewards were restored, runtime QA now exposes the calculated reward, and tests require positive/map-invariant kill rewards so the failure cannot silently return.
