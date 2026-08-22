# Rizo.game v77 — Defense Feel Pass

v77 is a focused finishing pass on Rizo Defense built on top of the v76 rhythm engine and the v75 Arcade Revival.

## Player-facing changes
- Slower, clearer packet cadence and longer breaths without changing authored difficulty by device.
- Slightly calmer global balloon travel pace while preserving fast/heavy class identities.
- True square battlefield geometry in portrait and landscape so route art is never vertically stretched.
- Balloon bodies, including bosses, are visually centered on the exact gameplay route; decorative knots/strings are shortened.
- Touch deployment owns its pointer immediately on roster press, with manual bench scrolling when the gesture follows the roster axis. Tap-to-place remains as a fallback.
- Defense command buttons, status feed, intel cards, ability cards, and menu controls use a tactile game-control language rather than display-font-heavy flat labels.
- Impact FX are short, typed sparks/shards/leaves/cracks instead of one generic ring.
- Burn, poison, frost, and root status art is integrated inside the balloon silhouette so status overlays do not expose rectangular edges.

## Compatibility
- Uses the same v76 engine filenames to preserve the existing Cloudflare root/test harness structure.
- Runtime build marker: `v77-defense-feel-pass`.
- Service-worker cache: `rizo-game-v77-defense-feel-pass`.
