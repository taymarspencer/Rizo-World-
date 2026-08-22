# Rizo Defense v71 — Economy Balance Table

| System | Current rule |
|---|---|
| Starting cash | 220 on every world |
| Paid tower deployment | explicit escalating canonical curve; first active Rizo copy remains free |
| Standard planning refund | 70% |
| New-placement undo | 100% for 5 real seconds while selling is permitted |
| Upgrades | 110 / 180 / 280 / 420 |
| First eligible world upgrade | 20% discount; first 110 upgrade becomes 90 after rounding |
| Combat placement | locked after deployment window/current planning policy |
| Packet-break upgrades | allowed safe upgrade window |
| Golden global income | 1.10× first Golden, diminishing duplicates, hard cap 1.22× |
| Golden active payout | diminishing duplicate return; wave contribution stops growing after cleared Wave 40 |
| Wave clear | `24 + clearedWave×4` plus up to 10 no-heart-loss bonus and 8 efficiency bonus |
| Permanent Ember raw basis | `clearedWave×8 + kills×1.1 + bosses×25 + perfectWaves×3` |
| Permanent late-run soft cap | first 1600 full value; excess contributes 35% |

## Paid deployment examples
150, 200, 270, 360, 500, 670, 920, 1250 for paid tower indexes 1–8 before applicable duplicate/class adjustments. Maximum tower count remains physically bounded.

## World identity
Worlds no longer receive general starting-cash/reward multipliers. Their opening identity comes from one strategic first-upgrade discount category (or the balanced Grove opening), plus their route/weather/mechanical differences.

## Remaining tuning surface
The nominal perfect-pop simulation from Phase 5 reaches about 92,361 cumulative run cash by Wave 50. That is intentionally classified as **tunable**: late perfect runs can still accumulate excess cash from the inherited per-enemy wave reward curve. It no longer creates unbounded tower/enemy DOM because object budgets and tower caps are separate.
