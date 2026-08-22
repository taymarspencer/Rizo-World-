# V67 Phase 4 Automated Test Report

## Results

| Suite | Result |
|---|---:|
| Core unit tests | 14/14 |
| Static architecture/security checks | 36/36 |
| Browser integration checks | 57/57 |
| Browser surface/device checks | 76/76 |
| Total | **183/183** |

Runtime errors in exercised browser/profile paths: **0**.  
Missing active local assets: **0**.

## New Phase 4 regressions

- 2× visual budget is lower than 1×.
- Imminent child reservation is bounded and deterministic.
- V3 checkpoint signatures still verify under core schema 4.
- 2× does not double real-time target scans.
- 2× advances simulation while control clocks remain real-time.
- Split children release gradually.
- Split children cannot exceed density cap.
- Income batching uses the same real-time cadence at 1× and 2×.
- Income batches preserve exact totals.
- V67 checkpoint metadata and V66 migration keys are present.
- Child queue is not sorted every frame.
- Boss density bypass is absent.
- Weather visual density consumes the centralized budget.

## Device matrix

The browser suites cover:

- 320×568
- 360×640
- 375×667
- 390×844
- 430×932
- 844×390
- 768×1024
- 1024×768

They exercise planning, combat, packet queues, child queues, overlays, tower panel, field menu, powers, intel, records, lobby, checkpoint sanitation, bank, death, 1×, 2×, and low-performance contracts.

## Reproduction

```bash
node tests/defense-core.test.js
python3 tests/static-defense-audit.py
python3 tests/browser-defense-integration.py
python3 tests/browser-defense-surfaces.py
python3 tests/profile-defense.py
python3 tests/capture-defense-gallery.py
```
