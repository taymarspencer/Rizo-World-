# Rizo World

A local browser companion, House, ten training games, Rizo Defense and Dungeon's complete short Threshold episode. The pet is the center: the actual raised Rizo enters its adventures.

**World is `/`; the existing game is `/play`.** Current page/runtime/service-worker build marker: **`v92-release-candidate-2`**. Source `world.html` packages as `dist/index.html`; source `index.html` packages as `dist/play.html`. Use the packaged site to preview production routes. Advertising and analytics are disabled. The longer Dungeon campaign remains proposed development, not a feature of this build.

Start with:

- [Taymar's GitHub and release workflow](docs/current/GITHUB-AND-RELEASE-WORKFLOW.md) — use `develop` for the next version; `main` changes only through an intentional release.
- [ARCHITECTURE.md](ARCHITECTURE.md) — save, training and mode contracts; canonical rendering and lifecycle ownership.
- [Current documentation](docs/current/README.md) — public product, Store/World design relationship, monetization boundary and publisher readiness.
- [Dungeon story authority](docs/dungeon/story/README.md) — preserved v0.1 and newest v0.2 addendum; locked foundations, proposals and ten open owner decisions.
- [Foundation verification](docs/verification/PUBLIC-FOUNDATION-VERIFICATION.md) — executed checks and practical limits.

## Preview / production artifact

This is a static HTML/CSS/JS PWA, with no bundler or dependency install needed for deployment. Existing historical runtime filenames are intentional. Keep the tree and load order intact.

```sh
python3 tools/build-site.py --out dist
python3 tools/serve-site.py --directory dist --port 8000
```

The build validates links/metadata and copies 161 production files. Output must be empty; it never deletes existing work. Use a fresh output path for subsequent builds. Developer docs, tests, reports and the instruction-only `ads.txt.template` are excluded. The local preview follows the shipped redirects and Pages-style HTML routes, with the authored 404 and a real 404 status; it does not apply production headers or compression.

Cloudflare Pages is the intended preview/hosting direction. It serves `/play` from `play.html`; `_redirects` converges old World/game bookmarks and `_headers` defines revalidation/security intentions. Installed PWAs deliberately start at `/play?source=pwa`, preserving their root identity/scope. See [deployment preparation](docs/current/DEPLOYMENT-PREPARATION.md) for preview-only commands and host/device gates. The legacy live game at `play.rizo.store` is **v87**, stays available, and requires user-controlled export/import to a different origin. GitHub `main` is a separate older v86 candidate, not proof of the current live deployment.

## Verification

Run the Node contract suites with `node tests/<name>.test.js`. Browser suites use Python Playwright and its installed Chromium; the current mobile/public check is:

```sh
python3 tests/browser-public-product.py --directory dist --evidence /tmp/rizo-public-review
python3 tests/browser-world-first.py --directory dist
python3 tests/browser-dungeon.py
python3 tests/browser-defense-integration.py
python3 tests/save-safety.py
```

These are local/mocked tests, never automated live-ad traffic. The World-first suite reconstructs the exact reviewed RC1 from Git ancestry to test the real worker upgrade. Browser test dependencies are development tools, not website dependencies. See [RC2 verification](docs/verification/WORLD-FIRST-RC2-VERIFICATION.md) for current results; older v75–v88 documents and historical QA/capture scripts remain development history.
