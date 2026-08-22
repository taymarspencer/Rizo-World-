# Rizo Defense v71 — Wave / Packet Generation

## Model
Each wave is pregenerated into a bounded sequence of packets. A packet owns an enemy formation, spawn gap, and short break after it. Runtime tracks the packet index, enemy index, next spawn time, packet-break deadline, and child-spawn queue.

## Density
Normal-mode admission targets at most 14 active enemies at 1× and 9 at 2×. Low-performance mode uses 9 at 1× and 7 at 2×. Bosses, split children, boss adds, and delayed children are admitted through the same budget instead of bypassing it.

## Split children
Split children enter `childSpawnQueue` with ordered release times. Release is paced on wall time and reserves density room for imminent children. The wave cannot complete while this queue remains nonempty.

## Difficulty philosophy
Planned enemy count is capped (current `MAX_PLANNED_ENEMIES = 46`). Later difficulty therefore leans on HP, armor, speed, resistance, combinations, timing, boss mechanics, route/weather effects, and status interactions instead of indefinite raw DOM population.

## Timing
Packet breaks are deliberately brief so the field breathes without becoming idle. Exact compositions, spawn gaps, and break lengths remain balance-tunable without changing the scheduler architecture.
