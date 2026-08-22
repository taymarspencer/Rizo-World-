# Rizo Core v1 Testing

Run the executable Core suite from the repository root:

```bash
node --experimental-default-type=module tests/rizo-core-v1.mjs
```

The browser smoke test remains available at:

```text
tests/rizo-core-v1.html
```

GitHub Actions runs the Node suite for the `rizo-core-v1` branch and for pull requests that touch Core/content/test files.
