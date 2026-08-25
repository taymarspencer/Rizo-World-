import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEMS } from "../src/content/systems.js";
import { EVENTS } from "../src/content/events.js";

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

await test("rizo-config boots World, onboarding, and combat presentation without making gameplay fatal", async () => {
  const config = await read("rizo-config.js");
  assert.match(config, /DOMContentLoaded/);
  assert.match(config, /import\("\.\/src\/rizo-world\/bootstrap\.js"\)/);
  assert.match(config, /import\("\.\/defense-onboarding-v1\.js"\)/);
  assert.match(config, /defense-combat-feedback-v1\.css/);
  assert.match(config, /rizo-defense-combat-feedback-v1/);
  assert.ok((config.match(/\.catch\(/g) || []).length >= 2, "World and onboarding imports must fail independently");
});

await test("service worker cache version changed for Phase 2 combat presentation", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /const CACHE = "rizo-game-v86-world-organizer-p2"/);
});

await test("Defense onboarding and combat feedback are required offline dependencies", async () => {
  const [sw, onboarding, combat] = await Promise.all([
    read("sw.js"),
    read("defense-onboarding-v1.js"),
    read("defense-combat-feedback-v1.css")
  ]);
  assert.match(sw, /"\.\/defense-onboarding-v1\.js"/);
  assert.match(sw, /"\.\/defense-combat-feedback-v1\.css"/);
  assert.match(onboarding, /rizo-defense-first-120-v1/);
  assert.match(onboarding, /data-defense-roster-id/);
  assert.match(onboarding, /data-defense-upgrade/);
  assert.match(combat, /defense-tower\.firing/);
  assert.match(combat, /defense-impact/);
  assert.match(combat, /defense-enemy\.popped/);
  assert.match(combat, /fx-lean/);
  assert.match(combat, /prefers-reduced-motion/);
});

await test("page, runtime, and service worker share one build identity", async () => {
  const [html, runtime, sw] = await Promise.all([read("index.html"), read("game-v79-defense.js"), read("sw.js")]);
  for (const source of [html, runtime, sw]) assert.match(source, /v86-world-organizer/);
  assert.doesNotMatch(`${html}\n${runtime}\n${sw}`, /v86-launch-hotfix/);
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

await test("player-mutating legacy helpers stay metadata-only in World", () => {
  for (const id of ["system.player_save_engine", "system.arcade", "system.progression", "system.season"]) {
    const definition = SYSTEMS.find(system => system.id === id);
    assert.ok(definition, `${id} identity is missing`);
    assert.equal(definition.binding, undefined, `${id} must not expose a live mutator binding`);
    assert.equal(definition.implementation, "private-legacy-flow", `${id} must remain explicitly private`);
  }
  const seasonEvent = EVENTS.find(event => event.id === "event.rizo_run");
  assert.ok(seasonEvent, "event.rizo_run identity is missing");
  assert.equal(seasonEvent.binding, undefined, "season event must not resolve to the mutating season service");
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
  assert.match(config, /defense-onboarding-v1\.js/);
  assert.match(config, /defense-combat-feedback-v1\.css/);
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
