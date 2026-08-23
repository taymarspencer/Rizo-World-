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
    RizoBoot: { expected: "v86-world-organizer" },
    __RIZO_RUNTIME_BUILD__: "v86-world-organizer",
    RizoLegacyRuntime: {
      currentState: { wallet: { embers: 100, shards: 3 }, season: { xp: 40 }, meta: { capsules: 2 }, loreUnlocked: ["keeper"] },
      content: {
        rizos: [{ id: "classic", name: "CLASSIC BLUE" }],
        defenseAbilities: { classic: { active: "RALLY" } },
        defenseTowerProfiles: { classic: { damage: 1, rate: 1, range: 1, projectile: "spark", label: "BALANCED" } }
      },
      systems: {
        defense: { wavePlan: wave => ({ wave }) }
      }
    }
  };

  return { globalObject, documentObject, storage, clicks };
}

await test("current arcade is registered as eleven stable games", () => {
  const core = createDefaultRizoCore();
  assert.equal(core.registry.all("games").length, 11);
  assert.equal(core.registry.get("games", "game.defense").mode, "defense");
});

await test("authoritative manifest covers every active category", () => {
  const core = createDefaultRizoCore();
  assert.deepEqual(Object.fromEntries(core.registry.categories().map(category => [category, core.registry.all(category).length])), {
    games: 11,
    rizos: 14,
    traits: 19,
    items: 61,
    abilities: 28,
    enemies: 15,
    towers: 14,
    upgrades: 2,
    waves: 1,
    events: 11,
    rewards: 4,
    systems: 17,
    achievements: 21,
    maps: 6
  });
  assert.equal(core.registry.get("rizos", "rizo.classic").category, "rizos");
  assert.deepEqual(core.registry.validateReferences(core.references), []);
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
  ]), /Global id\/alias collision/);

  assert.throws(() => new ContentRegistry().registerCategory("games", [
    { id: "game.one", aliases: ["game.two"] },
    { id: "game.two" }
  ]), /Global id\/alias collision/);
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

await test("every registered game launches through its authoritative mode binding", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);

  for (const game of world.query("games").value()) world.launch(game.id);
  for (const game of world.query("games").value()) {
    assert.equal(runtime.clicks.get(game.mode), 1, `${game.id} did not launch exactly once`);
  }
});

await test("globally unique IDs resolve without repeating their category", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);

  assert.equal(world.resolve("game.defense").click instanceof Function, true);
  assert.equal(world.describe("game.defense").category, "games");
  assert.equal(world.resolve("rizo.classic").name, "CLASSIC BLUE");
  assert.deepEqual(world.invoke("wave.defense.generator", 12), { wave: 12 });
});

await test("legacy global systems resolve through stable system IDs", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);

  assert.equal(world.system("defense_core"), runtime.globalObject.RizoDefenseCore);
  assert.equal(world.system("system.config"), runtime.globalObject.RIZO_CONFIG);
  assert.equal(world.system("runtime_build"), "v86-world-organizer");
});

await test("existing player save can be referenced without copying it into Core", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);
  const save = world.system("player_save");

  assert.equal(save.version, 19);
  assert.equal(save.pet.name, "TEST RIZO");
});

await test("manifest and registry use their real direct APIs, not fake system records", () => {
  const world = createRizoWorld(fakeLegacyRuntime());
  assert.equal(world.has("systems", "system.world_manifest"), false);
  assert.deepEqual(world.manifest(), world.core.registry.snapshot());
  assert.equal(world.resolve("system.defense_core").VERSION, 7);
});

await test("World selectors sort and filter legacy and future content uniformly", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);

  assert.equal(world.query("games").tag("arcade").count(), 11);
  assert.equal(world.query("games").tag("flagship").first().id, "game.defense");
  assert.equal(world.query("games").tag("runner").first().id, "game.rizo_courier");
  assert.equal(world.query("items").tag("wearable").count(), 25);
  assert.equal(world.query("enemies").tag("boss").count(), 4);
});

await test("global-record bindings return immutable snapshots", () => {
  const root = { Catalog: { rows: [{ id: "one", value: 7 }] } };
  const registry = new ContentRegistry().registerCategory("things", [{
    id: "thing.one",
    source: "legacy",
    binding: { kind: "global-record", path: "Catalog.rows", value: "one" }
  }]);
  const sources = new SourceResolver(registry).register("legacy", new LegacyRuntimeAdapter({
    globalObject: root,
    documentObject: null,
    storage: null
  }));
  const resolved = sources.resolve("things", "thing.one");
  assert.deepEqual(resolved, root.Catalog.rows[0]);
  assert.equal(Object.isFrozen(resolved), true);
  assert.throws(() => { resolved.value = 99; }, TypeError);
  assert.equal(root.Catalog.rows[0].value, 7);
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

  assert.equal(sources.resolve("things", "thing.native"), null);
  assert.equal(sources.available("things", "thing.native"), false);
  assert.throws(() => sources.invoke("things", "thing.native"), /unavailable/);
  assert.equal(sources.resolve("things", "thing.legacy"), root.ExistingThing);
});

await test("source adapters cannot be replaced silently", () => {
  const registry = new ContentRegistry().registerCategory("things", []);
  const sources = new SourceResolver(registry);
  assert.throws(() => sources.register("native", { resolve() { return {}; } }), /already registered/);
});

await test("every canonical ID and alias has one global address", () => {
  const core = createDefaultRizoCore();
  for (const category of core.registry.categories()) {
    for (const address of core.registry.ids(category, { includeAliases: true })) {
      const located = core.registry.locate(address);
      assert.ok(located, address);
      assert.equal(located.category, category, address);
    }
  }
});

await test("Defense towers resolve combat profiles rather than abilities", () => {
  const world = createRizoWorld(fakeLegacyRuntime());
  const tower = world.resolve("tower.defense.classic");
  assert.equal(tower.label, "BALANCED");
  assert.equal(tower.projectile, "spark");
  assert.equal(tower.active, undefined);
  assert.equal(world.get("upgrades", "upgrade.defense.doctrine.power").type, "doctrine");
});

await test("live legacy player is the sole current authority", () => {
  const runtime = fakeLegacyRuntime();
  const world = createRizoWorld(runtime);
  const player = world.player();
  assert.equal(world.playerState.authority, "legacy");
  assert.equal(world.playerState.writable, false);
  assert.equal(player.wallet.embers, 100);
  assert.equal(Object.isFrozen(player.wallet), true);
  assert.throws(() => { player.wallet.embers = 999; }, TypeError);
  assert.equal(runtime.globalObject.RizoLegacyRuntime.currentState.wallet.embers, 100);
});

await test("rewards describe grant identities instead of current balances", () => {
  const world = createRizoWorld(fakeLegacyRuntime());
  assert.equal(world.get("rewards", "reward.embers").statePath, "wallet.embers");
  assert.equal(world.resolve("reward.embers"), null);
  assert.equal(world.available("reward.embers"), false);
  assert.equal(world.core.registry.locate("currency.embers"), null);
  assert.equal(world.get("achievements", "achievement.origin").type, "badge");
  assert.equal(world.get("maps", "map.defense.grove").type, "defense-map");
});

for (const result of results) {
  if (result.ok) console.log(`PASS  ${result.name}`);
  else console.error(`FAIL  ${result.name}\n      ${result.error?.stack || result.error}`);
}

const failed = results.filter(result => !result.ok);
console.log(`\nRizo World bridge: ${results.length - failed.length}/${results.length} tests passed.`);
if (failed.length) process.exitCode = 1;
