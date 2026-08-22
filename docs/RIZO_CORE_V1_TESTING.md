# Rizo World Testing

Run from the repository root:

```bash
node --experimental-default-type=module tests/rizo-core-v1.mjs
node --experimental-default-type=module tests/rizo-world-bridge.mjs
node --experimental-default-type=module tests/rizo-world-static.mjs
python -m pip install playwright
python -m playwright install chromium
python tests/browser-rizo-world-organizer.py
```

The Node suites cover the global ID/alias namespace, references, state and lifecycle primitives, legacy/native availability semantics, all eleven launch IDs, truthful Defense profiles, rewards, player authority, and read-only resolution. The browser suite covers production-style/mobile and QA boot, reverse parity against exposed legacy collections, home/arcade/two normal games/Defense, save/reload, runtime errors, World-bootstrap failure with playable legacy fallback, and installed offline reload.

GitHub Actions runs all Node suites plus portable Chromium smoke on pushes and relevant pull requests. `RIZO_BROWSER=webkit` can run the same local smoke when WebKit is installed; Chromium is the required CI engine.
