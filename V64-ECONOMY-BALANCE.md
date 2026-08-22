# V64 Economy Balance Table

## Opening economy

| System | V64 value | Notes |
|---|---:|---|
| Starting coins | 220 on every world | Removes difficulty-by-inflated-opening-cash |
| Standard tower cap | 8 target / 10 hard | Contracts may reduce it |
| Upgrade 1 | 110 | Explicit table |
| Upgrade 2 | 180 | Explicit table |
| Upgrade 3 | 280 | Explicit table |
| Upgrade 4 | 420 | Explicit table |
| Eligible world-opening upgrade | 20% off once | Applies only to the first upgrade: 110 → 90 after rounding |
| Standard planning refund | 70% | No combat selling |
| New-placement undo | 100% within 5 seconds | Planning only, before combat |

World opening perks:

- Moon: first eligible reveal/detection-family upgrade
- Storm: first eligible control-family upgrade
- Blizzard: first eligible wide-range/frost-resistant upgrade
- Ember: first eligible damage-family upgrade
- Eclipse: first eligible support/reveal-family upgrade
- Grove: neutral opening

## Wave allowance examples on the neutral 1.0 reward map

| Cleared wave | Planned enemies | Perfect + efficient | Damaged + overbuilt |
|---:|---:|---:|---:|
| 1 | 9 | 46 | 28 |
| 5 | 13 | 62 | 44 |
| 10 | 19 | 82 | 64 |
| 25 | 36 | 142 | 124 |
| 50 | 46 | 242 | 224 |
| 100 | 46 | 442 | 424 |

Formula:

`24 + clearedWave × 4 + 10 perfect bonus + 8 efficiency bonus`, then documented map reward compensation is applied and clamped.

## Permanent Ember examples

Formula before diminishing returns:

`clearedWave × 8 + kills × 1.1 + bosses × 25 + perfectWaves × 3`

| Accomplishment sample | Ember payout |
|---|---:|
| Clear 10, 100 kills, 1 boss, 5 perfect waves | 230 |
| Clear 25, 400 kills, 3 bosses, 12 perfect waves | 751 |
| Clear 50, 1,200 kills, 6 bosses, 25 perfect waves | 1,720 |
| Clear 100, 3,000 kills, 12 bosses, 45 perfect waves | 2,627 |

Payouts above the soft-cap threshold receive diminishing returns. Unfinished current waves add zero completion value.

## Golden stacking

| Golden towers | Global multiplier |
|---:|---:|
| 0 | 1.00× |
| 1 | 1.10× |
| 2 | 1.13× |
| 3 | 1.16× |
| 4 | 1.19× |
| 5+ | Maximum 1.22× |

The global cap is solved. A localized aura redesign is intentionally deferred because it changes character identity and requires a larger balance pass.

## Tuning status

The formulas are structurally safe and simulation-tested, but exact rewards remain telemetry-tunable. Real-player completion rates and average tower counts should decide future numeric changes rather than adding more raw enemies.
