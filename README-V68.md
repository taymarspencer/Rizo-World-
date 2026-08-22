# Rizo Defense v68 — Phase 5

Phase 5 rebuilds the **economy and decision flow** on top of the verified v67 packet scheduler.

The release intentionally changes economy structure without rewriting combat difficulty at the same time. All worlds now begin with the same 220 cash. World identity is expressed through a one-shot opening discount on an appropriate strategic class rather than starting-cash and reward inflation. Upgrades use the explicit `[110, 180, 280, 420]` table. Golden global income is capped at +22%, duplicate Golden active payouts diminish, and permanent Embers use completed accomplishments with a late-run soft cap.

Planning and combat also have a clear contract: full construction in planning/wave-complete, upgrades during packet breaks, abilities during combat, and no normal placement or selling once combat is committed.

See `V68-PHASE5-DELIVERY-STATUS.md` for completion classification and verification.
