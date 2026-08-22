# V64 Wave and Packet Generation

## Count curve

Normal planned enemy count:

`min(46, 8 + floor(wave × 1.15))`

Rush and swarm plans change composition, packet size, and timing while respecting the same hard ceiling. Boss plans use a smaller support population plus the boss.

## Packet state

The live run tracks:

- `wavePackets`
- `packetIndex`
- `packetEnemyIndex`
- `nextSpawnAt`
- `packetBreakUntil`
- `spawnQueue` as a compatibility/preview flattening of remaining work
- `childSpawnQueue`

Packet enemies generally spawn 0.45–1.4 seconds apart. Breaks are 0–1.4 seconds, with ordinary non-final breaks centered around 0.72–1.14 seconds. The final packet has no artificial closing pause.

## Representative neutral packet shapes

| Wave | Planned total | Packet sizes | Typical gap |
|---:|---:|---|---:|
| 1 | 9 | 7, 2 | 0.777 s |
| 12 | 21 | 6, 7, 6, 2 | 0.744 s |
| 25 | 36 | 7, 6, 7, 6, 7, 3 | 0.705 s |
| 50 | 46 | 5, 6, 5, 6, 5, 6, 5, 6, 2 | 0.660 s |
| 100 | 46 | 5, 6, 5, 6, 5, 6, 5, 6, 2 | 0.660 s |

Actual enemy identities are chosen by wave, map, modifiers, special bias, boss schedule, and world mechanics.

## Child and delayed spawns

Split children, boss adds, revived threats, and delayed world summons must enter `childSpawnQueue`. The scheduler releases them gradually only when the active-density budget allows. The buffer is capped at 48 entries. A wave cannot complete while this queue is nonempty.

## Completion proof

`completeDefenseWave()` refuses to run unless all of the following are resolved:

- packet plan exhausted
- flattened spawn queue empty
- child queue empty
- no active enemies
- no active projectiles that can still resolve damage
- no pending boss/delayed spawn work

This is the only path that advances `clearedWave`.
