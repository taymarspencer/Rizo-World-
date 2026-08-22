# V66 Phase 3 Known Limitations

1. **Client-side signatures are not cryptographic authority.** The algorithm and salt are shipped to the browser. They detect corruption and discourage casual edits but cannot defeat a determined user with source access.

2. **Verified backup is local to the same browser origin.** Clearing site data, Safari eviction, private browsing, or device loss can remove both copies.

3. **Legacy raw saves are trusted once for compatibility.** Any Phase 2-or-older raw save migrates through clamps and registry validation because no prior whole-save signature exists. This is necessary to avoid deleting legitimate existing progress.

4. **No-backup sanitation is conservative.** When a current signature fails and no valid mirror exists, reward-bearing progress resets. Pet timeline and known cosmetics are retained where practical, but the game cannot prove which unsigned fields were legitimate.

5. **Physical-device validation remains required.** Included benchmarks are host-based Chromium measurements, not Safari/iOS hardware certification.

6. **Server authority remains the real long-term solution.** Competitive leaderboards, purchases, account recovery, and cross-device progression should eventually be validated remotely.
