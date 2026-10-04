# Rizo World deployment preparation

Started from public-foundation commit `a5b10db4ae19426e09967025baf543237bebe7c1`. The candidate is **`v92-release-candidate-1`**, with a minimal fix for Dungeon held controls during the hub's periodic refresh. No host, deployment, DNS, TLS or production routing was changed in this pass.

## The artifact a host must serve

This is a static site. It needs no application server, package install, bundler or runtime build on the host.

```sh
python3 tools/build-site.py --out dist
python3 tools/serve-site.py --directory dist --port 8000
```

Run the build from the exact reviewed release commit. Output must be empty; for another build choose a fresh directory. Publish **the contents of `dist/` at the origin root**, retaining the folders and filenames. The verified artifact has 160 files. Do not publish the whole repository: the packaging excludes developer docs, tests, reports, historical manifests and the instruction-only ad template. Do not use historical ZIP instructions as the current deployment contract.

The preview provides static files and a real authored 404, but **does not implement `_headers` or compression**. Preview success does not verify production headers. A provider's settings must translate the repository's header intentions and status behavior.

## Routing is still an owner decision

| URL | Current artifact behavior |
| --- | --- |
| `/` | Serves `index.html`, the game. |
| `/index.html` | Direct Play entry; the PWA starts at `/index.html?source=pwa`. |
| `/world.html` | Public World page. It does not load the game runtime. |
| `/journal.html`, `/about.html`, `/support.html`, `/privacy.html`, `/terms.html` | Real static public pages. |
| A missing path, including `/ads.txt` | Serve the authored `404.html` with **HTTP 404**, never a successful game response. |

Choose whether launch keeps direct play at `/` or deliberately changes it to World. Keeping the current root is technically coherent. Changing it requires reviewing the worker's cached root/index fallback, manifest identity/start URL, navigation, canonical URLs and update behavior together. Do not implement a host-only rewrite and assume offline/PWA behavior follows automatically. Serve at the origin root; mounting under a subdirectory requires a separate path/metadata review.

The build does not copy the old `_redirects` file. No SPA catch-all is needed. Do not redirect every unknown path to the game. Retain real `.html` routes unless a later explicit route migration preserves old links.

## Host behavior to verify

| Resource/behavior | Required deployment treatment |
| --- | --- |
| HTML, `/`, worker and manifest | Revalidate (`Cache-Control: no-cache`); serve correct MIME types. |
| JS/CSS, including `core/`, `providers/`, `training/`, `modes/` | Revalidate (`no-cache, must-revalidate`). Filenames survive releases; never assume they are immutable version hashes. |
| `/assets/*` | Current intention: `public, max-age=3600, must-revalidate`; avoid indefinite stale artwork at stable names. |
| Security headers | Translate `_headers`: `nosniff`, strict-origin-when-cross-origin referrer policy, disabled camera/microphone/geolocation, CSP `object-src 'none'; base-uri 'self'`. Check actual responses, not the existence of the file. |
| Compression | Negotiate Brotli/gzip for text resources; verify `Content-Encoding` and `Vary: Accept-Encoding` with production responses. |
| Public reachability | HTTPS, one intended canonical hostname, deliberate HTTP/alternate-host redirects, accessible robots/sitemap and real 200/404 statuses. |
| Deployment atomicity | Publish a complete artifact together. Do not let new HTML point at missing or stale mode/runtime files. |

There is no production `ads.txt`, verified publisher metadata or active ads/analytics. These are future monetization gates, not a reason to invent seller data or turn on live ads during beta tests.

## Service-worker and save implications

`sw.js` lives at `/sw.js` and has origin-root scope. Its required shell installs atomically; a missing required file prevents takeover. After successful install it skips waiting, claims clients and deletes only old `rizo-game-*` caches. Required runtime and public pages use network-first revalidation; other same-origin assets use cache-first. It does not intercept third-party traffic.

Offline root/index can recover the actual game. Visited public pages remain cached. Unknown offline routes return **503**, rather than pretend to be the game. Test a genuine old-worker → new-worker update and an offline reload on the chosen host. The matching HTML/boot/hub/worker release markers are a delivery contract. This candidate bumps them together because of the control fix; the documentation/CI commit afterward does not change the artifact.

Saves are in the browser's local storage, with v2 primary/backup, old migration sources and separate mode checkpoints. Keeping the schema compatible does **not** transfer them between `play.rizo.store`, a preview hostname, `www.rizo.world` and `rizo.world`. HTTPS vs HTTP also changes the origin.

Keep the old playable origin available. Export a Keeper backup there, import it on the chosen new origin, and verify the same pet, House residents, clothes, wallet, Defense progress and Dungeon reward. Check reload and a fresh export. Do not overwrite an already different new-origin pet automatically or erase the old data. An installed PWA belongs to its original origin; direct users to the new origin and test its installation separately.

## Gates before merging for public beta

- Approve the root experience and primary hostname; choose a host and verify the actual headers, compression, route/status policy and atomic publication.
- Confirm support responsibility, operator/privacy/host-log details, Terms wording and rights to shipped assets. The existing support page links to the separately labeled Apparel contact form.
- Complete old-origin export/import verification and explain the migration to existing players.
- Play on physical iOS Safari and Android Chrome, including portrait/landscape, standalone PWA resume, notch/browser chrome, keyboard, offline/update and constrained-memory behavior.
- Measure first game arrival on production compression and weaker real phones. The existing local profile's approximately **524ms World LCP, 8.1s game LCP, 14.2s DOMContentLoaded and 2.6MB game transfer** is one throttled, uncompressed lab sample, not field percentiles. Keep this warning open; optimize measured problems in a separate pass.

After DNS/TLS, check the whole actual origin: public pages, direct Play, mode/training entry and return, real 404, robots/sitemap/canonicals/share images, no console/asset errors, no external ad requests, save reload/import, worker update, offline and installation. Keep the draft release gate open until the applicable checks are recorded.
