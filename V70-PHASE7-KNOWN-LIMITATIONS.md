# Rizo Defense v70 — Known Limitations / Deferred Work

## Tunable
- Exact world palette/contrast values still benefit from physical-device tuning.
- Some legacy mascot PNGs have different internal padding; the world-space contract stabilizes gameplay geometry but cannot fully correct every sprite's optical silhouette without per-asset anchor metadata or normalized source art.
- Structural terrain features are CSS/world-space primitives, not bespoke illustrated assets.

## Deferred to Phase 8 / future content
- Full cinematic event hierarchy and final audio/animation polish.
- More bespoke world mechanics beyond the existing route/weather/opening differences where desired.
- Server-authoritative competitive records.

## Not verified in this environment
- Real deployed iPhone Safari service-worker upgrade lifecycle.
- Physical-device GPU/memory behavior over multi-hour play.
- Every brightness/contrast condition on OLED/LCD hardware.
