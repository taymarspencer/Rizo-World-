# Rizo Defense v66 — Phase 3 Production Hardening

Build date: 2026-07-31  
Build ID: `v66-phase3-production-hardening`  
State schema: `18`  
Defense checkpoint schema: `3`  
Signed save envelope schema: `1`

## What changed

Phase 3 closes the production trust-boundary gaps left after progression integrity:

- QA tools now exist only inside one explicitly gated `window.RizoRuntimeQA` namespace.
- Normal public sessions expose no runtime QA API and no legacy visual/rhythm QA globals.
- Whole saves are written as signed, versioned envelopes with a verified mirror backup.
- Defense checkpoints use a broader v3 signature covering reward-bearing and derived combat state.
- Existing valid v2 checkpoints remain migratable.
- Invalid current checkpoints fail closed instead of resuming forged cash, waves, upgrades, queues, kills, damage, bosses, or perfect-wave counters.
- Unknown pet, tower-owner, enemy, boss, map, queue, ability, doctrine, and status identifiers are rejected or replaced by canonical defaults.
- Enemy HP, armor, speed, damage, reward, tower cost, upgrade investment, source, roster index, and sell basis are reconstructed from canonical registries.
- Permanent save values are centrally clamped and normalized.
- Save-validation warnings are recorded locally without crashing the game.
- Build and service-worker identities were advanced together to prevent stale-runtime cache mismatch.

## Verification

- Pure core tests: **11/11 passed**
- Static architecture/security checks: **27/27 passed**
- Browser integration checks: **45/45 passed**
- Browser surface/device checks: **76/76 passed**
- Runtime errors in tested paths: **0**
- Missing active local assets: **0**

The included host benchmark held an estimated **60 FPS** at 1× and 2×, with peak active enemies of **13 at 1×** and **9 at 2×**. The 20-wave cleanup profile ended with **22 fewer DOM nodes than baseline** and no live enemy/projectile nodes. This is a comparative headless-Chromium test, not a physical-iPhone claim.
