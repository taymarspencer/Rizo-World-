# V67 Phase 4 Known Limitations

- Host profiling is headless Chromium, not Mobile Safari on a physical iPhone.
- The short profile cannot prove multi-hour memory stability; it only shows stable pool creation across 20 forced waves.
- Target selection still performs a bounded scan of the shared snapshot when a tower retargets. Spatial buckets were intentionally deferred because current density caps keep candidate counts small.
- Packet composition and gap values need human feel-testing, especially beyond Wave 50.
- Enemy position writes rise at 2× because exact movement covers more simulation distance; density and target scans remain controlled.
- Full economy balance, combat purchase restrictions, and sell rules are Phase 5 work.
- Full CSS/layout consolidation is Phase 6 work.
- World structural mechanics and art differentiation are Phase 7 work.
- Competitive records remain local and are not cheat-proof.
