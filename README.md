# Rizo World

A local browser companion, House, ten training games, Rizo Defense and Dungeon's complete short Threshold episode. The pet is the center: the actual raised Rizo enters its adventures.

Public World: `world.html`. Playable entry remains `index.html` / the static root. Current page/runtime/service-worker build marker: **`v92-public-foundation`**. Advertising and analytics are disabled. The longer Dungeon campaign remains proposed development, not a feature of this build.

Start with:

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

The build validates links/metadata and copies the actual production files. Output must be empty; it never deletes existing work. Use a fresh output path for subsequent builds. Developer docs, tests, reports and the instruction-only `ads.txt.template` are excluded. The preview serves missing paths with the authored 404 and a real 404 status.

The production host must implement equivalent headers/statuses, DNS/TLS and the actual rizo.world routing. `_headers` is not supported by every host. No production ads.txt or verified account metadata exists yet. See the readiness document before account integration or domain migration; a new origin cannot automatically read an old origin's local saves.

## Verification

Run the Node contract suites with `node tests/<name>.test.js`. Browser suites use Python Playwright and its installed Chromium; the current mobile/public check is:

```sh
python3 tests/browser-public-product.py --directory dist --evidence /tmp/rizo-public-review
python3 tests/browser-dungeon.py
python3 tests/browser-defense-integration.py
python3 tests/save-safety.py
```

These are local/mocked tests, never automated live-ad traffic. Browser test dependencies are development tools, not website dependencies. Older v75–v88 documents and historical QA/capture scripts remain available as development history; use the current architecture and verification record to distinguish them from release gates.
