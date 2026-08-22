# Rizo Defense v68 — Economy Flow Policy

Target rhythm: **Fight → Collect → Plan → Commit → Fight**.

| Phase | Place | Move | Sell | Upgrade | Ability | Bank |
|---|---:|---:|---:|---:|---:|---:|
| Planning | Yes | Yes | Yes | Yes | No | Yes |
| Countdown | No | No | No | No | No | Yes |
| Combat | No | No | No | No | Yes | Yes |
| Packet break | No | No | No | Yes | Yes | Yes |
| Wave complete | Yes | Yes | Yes | Yes | No | Yes |
| Paused | No | No | No | No | No | Yes |
| Run complete | No | No | No | No | No | No |

## Placement undo

A newly placed tower can be fully undone for five **real seconds**, not five simulation seconds. The full refund exists only while the current phase allows selling. Starting combat therefore closes the undo path immediately.

After five seconds, a planning sale returns 70% of canonical investment.

## Safe upgrade window

Packet breaks are intentionally narrow tactical windows: upgrades remain available, but placing and selling do not reopen. This keeps the battlefield from becoming a mid-combat construction editor while still giving the player a useful micro-decision between packets.

## Banking

Banking remains available during an active run, but Phase 2 rules remain authoritative: only `clearedWave` and legitimately resolved accomplishments feed permanent progression. Pending batched income is flushed before the bank snapshot.
