# Rizo Defense v71 — Known Limitations

## Tunable rather than broken
- Very long perfect runs can still generate more run cash than strategically necessary because of the inherited per-enemy wave reward curve.
- Packet compositions, spawn gaps, and break lengths remain balance knobs.
- World contrast/palette values may need small physical-device adjustments.
- Legacy mascot PNGs have inconsistent internal padding; bounded world-space anchors reduce the problem but do not replace normalized art/per-asset optical anchors.

## Local security boundary
Lightweight signatures detect corruption/casual editing; they are not server-grade anti-cheat. Competitive authority needs a backend.

## Environment limits
- Real deployed iPhone Safari service-worker update lifecycle was not available to test here.
- Headless-host frame and heap measurements are comparative, not a physical phone benchmark.
- Multi-hour GPU/thermal/memory stability needs physical-device soak testing.
- Haptics/audio vary by browser/device and require hardware verification.
