# Rizo Defense v68 — Known Limitations

1. **Late-run cash remains a tuning surface.** Removing map inflation fixes a structural multiplier, but the inherited per-enemy wave scaling can still produce surplus cash in very long clean runs. The machine simulation documents this instead of claiming final balance.
2. **Golden remains a global aura.** It is capped and duplicates diminish, but it is not yet the preferred localized-kill/support-aura design.
3. **World perks are variant-class lists.** They are explicit and testable, but exact eligibility may be adjusted after real play.
4. **Physical Safari is not profiled here.** Chromium viewport tests cannot verify iOS thermal throttling, memory pressure, haptics, or real finger ergonomics.
5. **Local-only security has a ceiling.** Checksum/signature validation is not server authority.
6. **Phase 6 UI debt still exists.** Phase 5 changes economy messaging where required but intentionally does not begin the full UI foundation rewrite early.
