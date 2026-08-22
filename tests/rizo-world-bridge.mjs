import assert from "node:assert/strict";

import { ContentRegistry } from "../src/rizo-core/registry.js";
import { LegacyRuntimeAdapter } from "../src/rizo-core/legacy-runtime.js";
import { SourceResolver } from "../src/rizo-core/source-resolver.js";
import { createDefaultRizoCore } from "../src/rizo-core/index.js";
import { createRizoWorld } from "../src/rizo-world/world.js";

const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

function fakeLegacyRuntime() {
  const clicks = new Map();
  const buttons = new Map();

  for (const mode of ["rhythm", "maze", "walk", "power", "spark", "forage", "rush", "memory", "glide", "breaker", "defense"]) {
    const selector = `[data-minigame="${mode}"]`;
    buttons.set(selector, {
      click() { clicks.set(mode, (clicks.get(mode) || 0) + 1); }
    });
  }

  const storageValues = new Map([
    ["rizo-life-overhaul-v2", JSON.stringify({ version: 19, pet: { name: "TEST RIZO" } })]
  ]);

  const documentObject = {
    querySelector(selector) { return buttons.get(selector) || null; }
  };

  const storage = {
    getItem(key) { return storageValues.has(key) ? storageValues.get(key) : null; }
  };

  const globalObject = {
    document: documentObject,
    localStorage: storage,
    RizoDefenseCore: { VERSION: 7, PHASES: { PLANNING: "planning" } },
    RizoAds: { provider: null },
    RizoCloud: { provider: null },
    RIZO_CONFIG: { brand: { siteName: "Rizo.game" } },
    RizoBoot: { expected: "v86-launch-hotfix" },
    __RIZO_RUNTIME_BUILD__: "v86-launch-hotfix"
  };

  return { globalObject, documentObject, storage, clicks };
}

await test("current arcade is registered as eleven stable games", () => {
  const core = createDefaultRizoCore();
  assert.equal(core.registry.all("games").length, 11);
  assert.equal(core.registry.get("games", "game.defense").mode, "defense");
});

await test("legacy mode names resolve as aliases instead of duplicate definitions", () => {
  const core = createDefaultRizoCore();
  assert.equal(core.registry.canonicalId("games", "defense"), "game.defense");
  assert.equal(core.registry.canonicalId("games", "pacman"), "game.rizo_runaway");
  assert.equal(core.registry.canonicalId("games", "flappy"), "game.skybound");
  assert.equal(core.registry.get("games", "defense"), core.registry.get("games", "game.defense"));
});

await test("alias collisions are rejected at registration", () => {
  assert.throws(() => new ContentRegistry().registerCategory("games", [
    { id: "game.one", aliases: ["play"] },
    { id: "game.two", aliases: ["play"] }
  ]), /Duplicate alias/);

  assert.throws(() => new ContentRegistry().registerCategory("games", [
    { id: "game.one", aliases: ["game.two"] },
    { id: "game.two" }
  ]), /Alias collides/);
});

await test("Rizo World launches existing Defense without moving its implementation", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);

  assert.equal(world.available("games", "defense"), true);
  assert.equal(world.launch("defense"), true);
  assert.equal(runtime.clicks.get("defense"), 1);
  assert.equal(world.canonicalId("games", "defense"), "game.defense");
});

await test("all eleven legacy arcade launches pass through the same world API", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);
  const modes = ["rhythm", "maze", "walk", "power", "spark", "forage", "rush", "memory", "glide", "breaker", "defense"];

  for (const mode of modes) world.launch(mode);
  for (const mode of modes) assert.equal(runtime.clicks.get(mode), 1, `${mode} did not launch exactly once`);
});

await test("legacy global systems resolve through stable system IDs", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);

  assert.equal(world.system("defense_core"), runtime.globalObject.RizoDefenseCore);
  assert.equal(world.system("system.config"), runtime.globalObject.RIZO_CONFIG);
  assert.equal(world.system("runtime_build"), "v86-launch-hotfix");
});

await test("existing player save can be referenced without copying it into Core", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);
  const save = world.system("player_save");

  assert.equal(save.version, 19);
  assert.equal(save.pet.name, "TEST RIZO");
});

await test("World selectors sort and filter legacy and future content uniformly", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);

  assert.equal(world.query("games").tag("arcade").count(), 11);
  assert.equal(world.query("games").tag("flagship").first().id, "game.defense");
  assert.equal(world.query("games").tag("runner").first().id, "game.rizo_courier");
});

await test("missing legacy targets report unavailable and fail explicitly on invoke", () => {
  const core = new ContentRegistry().registerCategory("games", [
    {
      id: "game.missing",
      source: "legacy",
      binding: { kind: "dom-click", selector: "#not-there" }
    }
  ]);
  const adapter = new LegacyRuntimeAdapter({
    globalObject: {},
    documentObject: { querySelector() { return null; } },
    storage: null
  });
  const sources = new SourceResolver(core).register("legacy", adapter);

  assert.equal(sources.available("games", "game.missing"), false);
  assert.throws(() => sources.invoke("games", "game.missing"), /unavailable/);
});

await test("native and legacy definitions coexist behind one resolver", () => {
  const registry = new ContentRegistry()
    .registerCategory("things", [
      { id: "thing.native", source: "native", value: 7 },
      { id: "thing.legacy", source: "legacy", binding: { kind: "global-value", path: "ExistingThing" } }
    ]);
  const root = { ExistingThing: { value: 9 } };
  const sources = new SourceResolver(registry)
    .register("legacy", new LegacyRuntimeAdapter({ globalObject: root, documentObject: null, storage: null }));

  assert.equal(sources.resolve("things", "thing.native").value, 7);
  assert.equal(sources.resolve("things", "thing.legacy"), root.ExistingThing);
});

for (const result of results) {
  if (result.ok) console.log(`PASS  ${result.name}`);
  else console.error(`FAIL  ${result.name}\n      ${result.error?.stack || result.error}`);
}

const failed = results.filter(result => !result.ok);
console.log(`\nRizo World bridge: ${results.length - failed.length}/${results.length} tests passed.`);
if (failed.length) process.exitCode = 1;
