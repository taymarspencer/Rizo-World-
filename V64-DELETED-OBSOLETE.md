# V64 Deleted Obsolete Rules and Systems

## Removed from the active production path

- `launch-v63-art-direction.css` and its versioned predecessors are no longer loaded.
- `game-v63-art-direction.js` and earlier runtime copies are no longer loaded.
- direct global QA helper functions
- the single mutable `wave` value as a progression authority
- continuous unstructured wave spawning
- direct split-child spawning
- 2× extra density allowance
- every-frame every-tower target scanning
- stored enemy reward/HP/armor trust
- stored tower spending/cost trust
- spent-dependent upgrade formula
- uncapped linear Golden multiplier
- per-world starting-cash inflation metadata
- combat placement/selling ambiguity
- old microscopic field-guide/lobby/record overrides
- Defense-specific arbitrary high z-index patches
- the active V54–V63 cascade of device corrections layered over previous Defense layouts

## Quantified CSS deletion

| Metric | Previous active CSS | V64 active CSS | Change |
|---|---:|---:|---:|
| Bytes | 484,527 | 245,913 | -238,614 (49.2%) |
| Lines | 5,655 | 3,313 | -2,342 |
| `!important` | 3,676 | 250 | -3,426 |
| Media queries | 104 | 26 | -78 |

The remaining 250 `!important` declarations are inherited non-Defense game styles. The static audit confirms no active Defense selector uses one.

Historical source files remain only in the audit workspace/backups. They are excluded from the clean delivery ZIP.
