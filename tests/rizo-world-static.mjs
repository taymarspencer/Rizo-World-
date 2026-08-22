import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFile(resolve(ROOT, path), "utf8");

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

async function collectModuleGraph(entry, seen = new Set()) {
  const normalized = entry.replaceAll("\\", "/");
  if (seen.has(normalized)) return seen;
  seen.add(normalized);

  const source = await read(normalized);
  const pattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const child = relative(ROOT, resolve(ROOT, dirname(normalized), specifier)).replaceAll("\\", "/");
    await collectModuleGraph(child, seen);
  }
  return seen;
}

await test("rizo-config boots World at DOM ready and keeps failure non-fatal", async () => {
  const config = await read("rizo-config.js");
  assert.match(config, /DOMContentLoaded/);
  assert.match(config, /import\("\.\/src\/rizo-world\/bootstrap\.js"\)/);
  assert.match(config, /\.catch\(/);
});

await test("service worker cache version changed for the World foundation", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /rizo-game-v86-launch-hotfix-rizo-world-organizer-v1/);
  assert.doesNotMatch(sw, /const CACHE = "rizo-game-v86-launch-hotfix"/);
});

await test("legacy runtime publishes one binding surface before boot", async () => {
  const runtime = await read("game-v79-defense.js");
  const bridgeAt = runtime.indexOf('Object.defineProperty(window, "RizoLegacyRuntime"');
  const bootAt = runtime.lastIndexOf("boot();");
  assert.ok(bridgeAt > 0, "RizoLegacyRuntime binding surface is missing");
  assert.ok(bridgeAt < bootAt, "legacy binding surface must exist before boot completes");
  assert.match(runtime, /rizos:\s*VARIANTS/);
  assert.match(runtime, /wavePlan:\s*defenseWavePlan/);
});

await test("script and World boot order preserves the active runtime", async () => {
  const html = await read("index.html");
  const expected = [
    "rizo-config.js",
    "install-manager.js",
    "monetization.js",
    "defense-core-v79.js",
    "defense-canvas-v79.js",
    "game-v79-defense.js"
  ];
  const positions = expected.map(file => html.indexOf(`src="./${file}"`));
  assert.ok(positions.every(position => position >= 0), "active runtime script missing from index.html");
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  const config = await read("rizo-config.js");
  assert.match(config, /DOMContentLoaded/);
  assert.match(config, /src\/rizo-world\/bootstrap\.js/);
});

await test("every module required by the World bootstrap is present in the offline shell", async () => {
  const graph = await collectModuleGraph("src/rizo-world/bootstrap.js");
  const sw = await read("sw.js");

  for (const modulePath of graph) {
    assert.match(sw, new RegExp(`\\.\\/${modulePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`), `${modulePath} is not cached by sw.js`);
  }

  assert.ok(graph.size >= 20, `unexpectedly small World module graph: ${graph.size}`);
});

await test("all World module files referenced by service worker exist", async () => {
  const sw = await read("sw.js");
  const matches = [...sw.matchAll(/"(\.\/src\/(?:rizo-world|rizo-core|content)\/[^"?]+\.js)"/g)]
    .map(match => match[1].slice(2));
  assert.ok(matches.length >= 20, `unexpectedly small cached module list: ${matches.length}`);
  await Promise.all(matches.map(path => read(path)));
});

for (const result of results) {
  if (result.ok) console.log(`PASS  ${result.name}`);
  else console.error(`FAIL  ${result.name}\n      ${result.error?.stack || result.error}`);
}

const failed = results.filter(result => !result.ok);
console.log(`\nRizo World static/offline: ${results.length - failed.length}/${results.length} tests passed.`);
if (failed.length) process.exitCode = 1;
