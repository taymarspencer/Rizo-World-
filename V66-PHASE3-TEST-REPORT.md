# V66 Phase 3 Automated Test Report

Test date: 2026-07-31

## Results

| Suite | Result |
|---|---:|
| Pure Defense core | 11/11 passed |
| Static architecture/security audit | 27/27 passed |
| Browser integration | 45/45 passed |
| Browser surface/device containment | 76/76 passed |
| Runtime errors in tested paths | 0 |
| Missing active local assets | 0 |

Raw output and JSON are in `reports/`.

## New Phase 3 coverage

- QA API absent in production
- Legacy QA namespaces absent in production
- QA data consolidated under the gated namespace
- Whole-save signature verification
- Wallet/progression tamper detection
- Arcade and unlock tamper detection
- Phase 2 raw-save migration
- Invalid current save conservative sanitation
- Verified mirror-backup architecture
- Signed corrupted checkpoint clamping
- Unknown enemy, queue, and pet rejection
- Canonical tower investment reconstruction
- Invalid checkpoint fail-closed behavior
- Forged upgrade and reward-counter removal
- Pending income flush before checkpoint
- Build/service-worker identity match

## Regression coverage retained

- Started versus cleared wave separation
- Full-resolution completion gate
- Banking unfinished-wave exclusion
- Death unfinished-wave exclusion
- Zero-clear mastery exclusion
- Contract and record migration
- 2× density reduction
- Target-retarget throttling
- Overlay conflict prevention
- Required viewport containment
- Text-size floor
- Touch/control viewport containment
- No active local asset misses
- No runtime errors in exercised paths

## Performance profile

Environment: headless Chromium, 390×844 CSS viewport, real `requestAnimationFrame` timing on the build host.

| Metric | 1× | 2× |
|---|---:|---:|
| Estimated FPS | 60.0 | 60.0 |
| Average frame | 16.666 ms | 16.666 ms |
| P95 frame | 16.775 ms | 16.7 ms |
| Worst frame | 16.8 ms | 16.8 ms |
| Peak active enemies | 13 | 9 |
| Configured density cap | 14 | 9 |
| Peak projectile nodes | 3 | 3 |
| Peak effect nodes | 4 | 5 |
| HUD writes/sec | 3.85 | 5.23 |
| Target scans/sec | 38.77 | 82.77 |
| Runtime errors | 0 | 0 |

Twenty-wave cleanup profile:

- Baseline DOM nodes: 227
- Final DOM nodes: 205
- DOM growth: -22
- Heap growth: 388,558 bytes
- Live enemy nodes after clear: 0
- Live projectile nodes after clear: 0
- Enemy/projectile/effect pool creation counts remained flat across the cycle

These measurements support comparative regression claims only. Physical iPhone/iPad performance remains a separate verification step.
