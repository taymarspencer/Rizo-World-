# V66 Phase 3 Deleted or Superseded Systems

## Removed runtime surfaces

- Direct production assignment of `window.RizoVisualQA`
- Direct production assignment of `window.RizoBeatQA`
- Any individual `window.defense*ForQA` helper exposure
- Production retention of stale QA namespaces after boot

## Superseded storage behavior

- Raw unsigned current-version save writes
- Raw unsigned save exports
- Raw unsigned Keeper recovery payloads
- Raw unsigned pre-recovery backups
- Trusting a failed checkpoint signature after only numeric clamping
- Trusting stored tower source/roster ownership
- Trusting stored enemy reward, HP, armor, speed, and damage
- Trusting stored tower price or upgrade investment
- Using unverified history/counters to justify a supposedly plausible wallet

## Migration-only compatibility retained

- Checkpoint v2 signature salt and verifier
- Legacy checkpoint keys `defense-checkpoint-v64` and `defense-checkpoint-v42`
- Raw state versions below 18

These paths exist only to migrate legitimate existing players. Successful migration rewrites current signed data and removes old checkpoint keys.

## Styling impact

Phase 3 did not add a CSS override block or new `!important` declarations. The Phase 2 UI foundation and its existing consolidated stylesheet were left intact.
