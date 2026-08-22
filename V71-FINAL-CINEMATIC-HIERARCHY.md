# Rizo Defense v71 — Cinematic Moment Hierarchy

Phase 8 deliberately quiets the default battlefield and uses one controlled status layer for important moments.

## Supported moments
- wave start
- packet arrival
- boss entrance
- gate damage / danger
- tower upgrade
- ability/doctrine unlock
- perfect wave
- normal wave clear / boss popped
- successful banking
- final defeat

## Technical contract
- One persistent `#defenseMoment` host; events update it rather than append overlay trees.
- Priority arbitration prevents routine packet messages from replacing boss or terminal messages.
- Moment host has `pointer-events: none`; gameplay input is not trapped by a cinematic banner.
- Terminal banking/defeat changes the phase to `run-complete` first, freezes the simulation, flushes pending income, then transitions to recap.
- Reduced-motion mode removes moment/frame animation while preserving text, semantic state, and terminal behavior.
- Cinematic state is ephemeral and is intentionally excluded from save/checkpoint schema.

## Stress verification
100 consecutive QA moment updates reused exactly one moment host with unchanged total DOM node count and no runtime errors.
