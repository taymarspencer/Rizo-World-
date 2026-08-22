# V67 Phase 4 Wave and Packet Generation

## Generation

The canonical core calculates a capped planned count:

```js
Math.min(MAX_PLANNED_ENEMIES, 8 + Math.floor(wave * 1.15))
```

`MAX_PLANNED_ENEMIES` is 46. Boss, rush, swarm, wall, veil, and hazard waves modify composition and timing without granting an unlimited count multiplier.

## Packet shape

Generated enemies are divided into recognizable packets. Current contracts keep normal spawn gaps roughly 0.62–0.82 seconds, with specialized formations allowed approximately 0.58–1.05 seconds. Inter-packet breaks remain 0.6–1.4 seconds and the final packet has no forced dead pause.

## Runtime state

- `wavePackets`
- `packetIndex`
- `packetEnemyIndex`
- `nextSpawnAt`
- `packetBreakUntil`
- `childSpawnQueue`
- `nextChildReleaseAtReal`

## Admission order

1. Release at most one eligible child when its simulation and wall timers permit.
2. Calculate active enemy count.
3. Reserve space for imminent children.
4. Admit the next packet enemy only if the remaining density budget allows it.
5. Enter packet break only after the current packet is exhausted.
6. Complete the wave only when packets, child queue, active enemies, projectiles, and delayed threats are resolved.

## Why two clocks are intentional

Packet gaps and breaks are gameplay rhythm, so 2× accelerates them. Child DOM release pacing is device pressure, so it remains wall-timed. This lets the game feel faster without producing a one-frame split burst.
