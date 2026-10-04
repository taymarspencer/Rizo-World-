# Rizo World deployment preparation

Owner decision resolved: **World is `/`; the existing game is `/play`.** RC2 starts from reviewed RC1 `77c3582017e41921a9495fb4afb26eee8801e497`, with build marker `v92-release-candidate-2`. Cloudflare Pages is the intended static preview/hosting direction. This pass does not deploy, connect a domain, change DNS or merge PR #7.

## Build the exact reviewed candidate

```sh
python3 tools/build-site.py --out dist
python3 tools/serve-site.py --directory dist --port 8000
```

Use a checkout of the exact RC2 SHA and an empty output directory. Publish **only the contents of `dist/` at the origin root**, keeping all folders. The 161-file artifact excludes developer docs, tests, reports, historical manifests and ad templates. No package install, bundler, application server, Worker or Function is needed. Source filenames remain historical: `world.html` copies to output `index.html`, while the original game `index.html` copies to output `play.html`. Game assets/runtime stay at their existing root paths. Previewing the raw repository does not exercise production routing.

## Deliberate routes

| URL | Static Pages behavior |
| --- | --- |
| `/` | Output `index.html`: lightweight, semantic World; no game scripts or worker registration. |
| `/play` | Output `play.html`: the existing game. This is its canonical URL. |
| `/play/`, `/play.html`, `/index.html`, `/index`, `/game` | Explicit 301 to `/play`, preserving query parameters. |
| `/world.html`, `/world`, `/world/` | Explicit 301 to `/`. |
| `/about`, `/journal`, `/support`, `/privacy`, `/terms` | Their existing static `.html` files; native `.html` normalization converges old URLs. |
| Missing paths, including `/ads.txt` | Authored `404.html` with **HTTP 404**. No SPA catch-all. |

`_redirects` ships eight exact rules. Pages evaluates them before asset handling, so `/index.html` preserves the old direct-game bookmark despite the new packaged root. Canonicals/Open Graph URLs use `https://rizo.world/`, `/play` and the clean public routes; the sitemap contains exactly those seven published pages. `www` → apex and HTTP → HTTPS remain later host setup tasks, not changes made here.

The local Python preview models HTML normalization, redirects and real 404s, but **does not implement `_headers` or compression**. Verify actual responses on the Cloudflare preview: HTML/worker/manifest revalidate; stable-name JS/CSS and mode files revalidate; assets have bounded caching; security headers and MIME types are correct; Brotli/gzip is negotiated. Publish the complete artifact atomically.

## Preview only, without domain or production setup

Use a separate **preview-only Direct Upload project**, such as `rizo-world-preview`. This does not decide how the later production project integrates with GitHub; a Direct Upload project cannot be converted to Git integration later.

```sh
npx wrangler pages project create rizo-world-preview --production-branch=main
npx wrangler pages deploy dist --project-name=rizo-world-preview --branch=develop
```

Authenticate with the intended Cloudflare account when prompted. `develop` is a preview branch because the project's production branch is `main`. Keep this project disconnected from custom domains; do not upload with `--branch=main`. Record the returned preview URL and the source SHA/fingerprint. Commands above are next steps, **not executed deployment actions**. See Cloudflare's [static serving](https://developers.cloudflare.com/pages/configuration/serving-pages/), [redirects](https://developers.cloudflare.com/pages/configuration/redirects/) and [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) documentation.

## Worker, installation and saves

The game registers `/sw.js` at root scope. Cache `rizo-game-v92-release-candidate-2` requires both World `/` and game `/play`, public World CSS and the existing boot/runtime files before takeover. Optional artwork/public pages remain best-effort. Activation claims clients and retires older `rizo-game-*` caches. Navigation/runtime reads use only this candidate's cache; an old game cached at `/` cannot become the new World fallback. Navigation is network-first, preserves real online 404s, and falls back offline only to the corresponding known page. Query variants and legacy aliases work offline; unknown paths return **503**, never either shell. A fresh World-only visit has no offline shell until the game has installed its worker.

Manifest `id: "./"` and `scope: "./"` remain unchanged. Installed Rizo World deliberately opens **`/play?source=pwa`** for useful direct game access. Old `/index.html?source=pwa` launches converge on Play online and under the new worker offline. Full physical installation/update/resume behavior still needs device verification.

| State / origin | Meaning |
| --- | --- |
| GitHub `main` at `e5f09048ec472850c44e69cb4f2e98c8006de02b` | Older v86 candidate; **not the current live deployment**. |
| `https://play.rizo.store` | Actual legacy live **v87**, independently identified during RC1 review; leave untouched and available for exports. |
| `develop` / RC2 | World-first candidate, requiring its own green CI and preview/phone approval. |
| Future `https://rizo.world` | New production origin, only after release approval and separate hosting/DNS authorization. |

Save format/signatures, local keys, pet identity, mode checkpoints and import/export stay unchanged. Origins cannot read one another's storage. Existing players export from legacy v87 and import into the new origin; never attempt automatic cross-origin migration or erase old data. Preview → production is also a different origin. Independently reviewed real-v87 upgrade/export/import evidence belongs to RC1; RC2 adds local signed-save/worker-upgrade regression checks. Do not treat a rollback to GitHub's older v86 reader as a safe rollback for current state-version-22 saves.

## Remaining release gates

- Deploy this exact candidate to the preview and verify routes, response headers/compression, real 404, robots/sitemap/canonicals, no ads/analytics, and full artifact delivery.
- Test physical iPhone Safari and Android Chrome: 320–430px layouts, Play transition, portrait/landscape, text zoom, standalone installation/resume, old/new worker update, offline startup and saves. Chromium emulation is not physical-device evidence or full WCAG certification.
- Measure compressed-host game arrival on weaker phones. RC1's approximately 0.5s World LCP, 8.1s game LCP, 14.1s DCL and 2.6MB uncompressed game resources remain known non-blocking lab findings. Slow first visits can show **“NEEDS A CLEAN RELOAD” around 6.8s before recovering** in legacy v87 and RC1. RC2 does not refactor loading or change that recovery timer.
- Confirm support/operator/host-log/privacy/Terms details and asset rights. Advertising remains absent; Google/account/CMP/placement work is separate.
- Record preview and device outcomes on draft PR #7. Only then seek release approval → merge reviewed `develop` into `main` → separately authorized production setup at `rizo.world`. Keep `play.rizo.store` available.
