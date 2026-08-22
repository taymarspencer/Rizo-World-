# V65 Phase 2 Automated Test Report

## Results

| Suite | Result |
|---|---:|
| Pure Defense core | 8/8 passed |
| Static architecture and progression audit | 21/21 passed |
| Browser progression integration | 38/38 passed |
| Browser surfaces and device containment | 76/76 passed |

## New Phase 2 regression checks

- Zero-clear banking grants no wave reward.
- Zero-clear banking creates no permanent Rizo mastery.
- Banking records an explicit `banked` outcome.
- Death records an explicit `gate` outcome.
- Banking during Wave 2 records Cleared 1 and Reached 2.
- Death during Wave 2 records Cleared 1 and Reached 2.
- Whole-save migration preserves cleared and reached waves separately.
- Imported zero-wave mastery is removed.
- Imported contract completion is derived from cleared progress.
- Permanent wave records clamp to the supported maximum.
- Service-worker cache and build metadata match the Phase 2 release.

## Existing integrity checks retained

- Production QA API absent.
- Current and cleared wave separation.
- Packet and child queues block completion.
- Valid completion advances cleared wave.
- Corrupted checkpoints clamp and sanitize.
- Derived tower spending reconstructs.
- Unknown IDs reject.
- Pending income flushes before checkpointing.
- 2× density remains lower than 1×.
- Target selection remains throttled.
- Overlay conflicts and viewport containment remain clean.

Raw outputs are stored in `reports/`.
