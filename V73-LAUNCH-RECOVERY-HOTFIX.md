# Rizo Defense v73 — Launch Recovery Hotfix

## Why this release exists
v72 correctly hardened service-worker versioning, but one architectural hole remained: the recovery watchdog itself lived in an external JavaScript file. If Safari/Home Screen mode loaded the HTML but failed to obtain a coherent boot runtime, the recovery code could fail for the same reason as the game and the player could still end up with a blank/white launch.

## Shipped fixes
- Moved the startup watchdog and recovery controller inline into `index.html`.
- Added a dependency-free dark startup shell that exists before external CSS/JS is required.
- The startup shell remains dormant after a successful boot so it can be reused after a broken `pageshow` / foreground restore.
- Added foreground surface validation: if the runtime exists but Origin, the main game shell, and the minigame overlay are all non-visible after resume, recovery is surfaced instead of leaving a blank page.
- Added early resource-error capture so missing boot files are recorded even when they fail as `<script>` / `<link>` resources.
- `RELOAD CLEAN` uses a cache-busting navigation instead of a plain reload.
- `REPAIR APP CACHE & RELOAD` unregisters Rizo service workers, deletes only `rizo-game-*` caches, preserves localStorage/player saves, then performs a cache-busting navigation.
- Advanced boot-critical filenames and cache identity to v73.
- The v73 service worker calls `skipWaiting()` only after the complete required shell has cached, then `clients.claim()` on activation. This prevents a valid new worker from sitting indefinitely behind an old iOS standalone session while still refusing to activate if required release files are incomplete.
- Added a runtime resume heartbeat back into the boot guard.

## What was deliberately not changed
Defense economy, combat math, packets, tower placement, sprites, HUD layout, powers architecture, save/checkpoint format, and progression logic are unchanged from v72.

## Verification personally executed
- Node syntax: inline boot, runtime, Defense core, service worker — pass.
- Defense core: 25/25.
- Service-worker policy: 4/4.
- Static architecture: 74/74.
- New launch-recovery browser suite: 5/5.
- Defense viewport/surface suite: 76/76.
- Phase 8 cinematic/exploit suite: 17/17.
- Healthy embedded-asset production boot: exact v73 build, zero boot problems, zero page errors.
- Full gameplay/economy integration rerun was started and the first 36 checks passed with zero failures, but the monolithic harness exceeded the execution ceiling before completing. The affected subsystem is startup/service-worker recovery; v72's full 77/77 integration result remains the last completed full integration baseline.

## Verification boundary
Browser testing used Chromium emulation. A genuine iPhone Safari / Add-to-Home-Screen service-worker lifecycle cannot be physically reproduced in this environment. This release specifically removes the architectural dependency that allowed a failed runtime fetch to also disable its own recovery UI, but deployment on the user's real iPhone remains the decisive device check.
