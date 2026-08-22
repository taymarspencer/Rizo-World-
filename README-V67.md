# Rizo Defense v67 — Phase 4 Performance Scheduler

Build date: 2026-07-31  
Build ID: `v67-phase4-performance-scheduler`  
Defense checkpoint schema: `4`  
Prior signed checkpoint schemas accepted: `2`, `3`

Phase 4 converts the existing packet foundation into an explicit mobile performance scheduler. Combat math still uses simulation time. Target refresh, UI refresh, checkpoint cadence, income settlement, child release pacing, and visual budgets now use real elapsed time so 2× speed cannot silently double control-system pressure.

Verification summary:

- Core: **14/14**
- Static architecture: **36/36**
- Browser integration: **57/57**
- Browser surfaces: **76/76**
- Total automated assertions: **183/183**
- Runtime errors in exercised paths: **0**
- Missing active local assets: **0**

See `V67-PHASE4-DELIVERY-STATUS.md` first.
