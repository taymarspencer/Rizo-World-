import assert from "node:assert/strict";

import { ContentRegistry } from "../src/rizo-core/registry.js";
import { createSelectors } from "../src/rizo-core/selectors.js";
import { StateStore, createInitialCoreState } from "../src/rizo-core/state-store.js";
import { EventBus } from "../src/rizo-core/event-bus.js";
import { createPersistenceController } from "../src/rizo-core/persistence.js";
import { createRizoCore, mergeContentPacks } from "../src/rizo-core/core.js";

const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

function baseContent() {
  return {
    abilities: [
      { id: "ability.ember_shot", name: "Ember Shot", tags: ["Fire", "Ranged"], damage: 8 },
      { id: "ability.slam", name: "Slam", tags: ["heavy"], damage: 14 }
    ],
    rizos: [
      { id: "rizo.scout", name: "Scout", tags: ["starter"], abilityIds: ["ability.ember_shot"] }
    ],
    items: [
      { id: "item.bat_hoodie", name: "Bat Hoodie", tags: ["halloween", "wearable"], rarity: 3 }
    ]
  };
}

const abilityRefs = [
  { from: "rizos", field: "abilityIds", to: "abilities", many: true }
];

await test("stable ID lookup", () => {
  const core = createRizoCore({ content: baseContent(), referenceRules: abilityRefs });
  assert.equal(core.registry.get("abilities", "ability.ember_shot").damage, 8);
});

await test("category lookup is case-insensitive", () => {
  const core = createRizoCore({ content: { Items: [{ id: "item.case" }] } });
  assert.equal(core.registry.get("ITEMS", "item.case").id, "item.case");
});

await test("source content is not frozen by registry", () => {
  const source = { id: "item.mutable_source", nested: { value: 1 }, tags: ["TEST"] };
  const registry = new ContentRegistry().registerCategory("items", [source]);
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(source.nested), false);
  assert.equal(Object.isFrozen(source.tags), false);
  assert.equal(Object.isFrozen(registry.get("items", source.id).nested), true);
  assert.deepEqual(registry.get("items", source.id).tags, ["test"]);
});

await test("duplicate IDs are rejected", () => {
  assert.throws(() => createRizoCore({
    content: { items: [{ id: "item.same" }, { id: "item.same" }] }
  }), /Duplicate id/);
});

await test("stable IDs are globally unique across categories", () => {
  const registry = new ContentRegistry().registerCategory("items", [{ id: "thing.same" }]);
  assert.throws(
    () => registry.registerCategory("rewards", [{ id: "thing.same" }]),
    /Global id\/alias collision/
  );
});

await test("global namespace rejects every canonical and alias collision direction", () => {
  assert.throws(() => new ContentRegistry()
    .registerCategory("items", [{ id: "item.one", aliases: ["shared.address"] }])
    .registerCategory("rewards", [{ id: "shared.address" }]), /Global id\/alias collision/);
  assert.throws(() => new ContentRegistry()
    .registerCategory("items", [{ id: "shared.address" }])
    .registerCategory("rewards", [{ id: "reward.one", aliases: ["shared.address"] }]), /Global id\/alias collision/);
  assert.throws(() => new ContentRegistry()
    .registerCategory("items", [{ id: "item.one", aliases: ["shared.address"] }])
    .registerCategory("rewards", [{ id: "reward.one", aliases: ["shared.address"] }]), /Global id\/alias collision/);
});

await test("registry locates canonical IDs and aliases without a category", () => {
  const registry = new ContentRegistry().registerCategory("games", [
    { id: "game.defense", aliases: ["defense"] }
  ]);
  assert.equal(registry.locate("game.defense").category, "games");
  assert.equal(registry.locate("defense").canonicalId, "game.defense");
  assert.equal(registry.locate("missing"), null);
});

await test("invalid IDs are rejected", () => {
  assert.throws(() => createRizoCore({ content: { items: [{ id: "Bad ID" }] } }), /Invalid Rizo Core id/);
});

await test("missing references are rejected", () => {
  assert.throws(() => createRizoCore({
    content: {
      rizos: [{ id: "rizo.bad", abilityIds: ["ability.missing"] }],
      abilities: []
    },
    referenceRules: abilityRefs
  }), /missing abilities:ability\.missing/);
});

await test("tags normalize and filter", () => {
  const core = createRizoCore({ content: baseContent(), referenceRules: abilityRefs });
  assert.equal(core.select.byTag("abilities", "FIRE").count(), 1);
});

await test("query supports all/any tag filtering", () => {
  const core = createRizoCore({ content: baseContent(), referenceRules: abilityRefs });
  assert.equal(core.select.query("abilities").tags(["fire", "ranged"]).count(), 1);
  assert.equal(core.select.query("abilities").tags(["fire", "heavy"], "any").count(), 2);
});

await test("query supports search, sortBy, clone and limit", () => {
  const core = createRizoCore({ content: baseContent(), referenceRules: abilityRefs });
  const original = core.select.query("abilities");
  const first = original.clone().search("a").sortBy([
    { field: "damage", direction: "desc" },
    { field: "id", direction: "asc" }
  ]).limit(1).first();
  assert.equal(first.id, "ability.slam");
  assert.equal(original.count(), 2);
});

await test("state update safely supports Array.push", () => {
  const state = new StateStore({ initialState: { version: 1, queue: [] } });
  state.update(current => current.queue.push("rizo.scout"));
  assert.deepEqual(state.get().queue, ["rizo.scout"]);
});

await test("default Core state has no shadow player domain", () => {
  const state = createInitialCoreState();
  assert.equal(state.player, undefined);
  assert.deepEqual(state.games, {});
});

await test("state get returns defensive clones", () => {
  const state = new StateStore({ initialState: { version: 1, nested: { value: 1 } } });
  const copy = state.get();
  copy.nested.value = 99;
  assert.equal(state.get().nested.value, 1);
});

await test("state migrations chain in order", () => {
  const state = new StateStore({
    version: 3,
    initialState: { version: 1, value: 1 },
    migrations: {
      1: current => ({ ...current, value: current.value + 1 }),
      2: current => ({ ...current, value: current.value * 10 })
    }
  });
  assert.deepEqual(state.get(), { version: 3, value: 20 });
});

await test("future state versions are rejected", () => {
  assert.throws(() => new StateStore({ version: 1, initialState: { version: 2 } }), /newer than supported/);
});

await test("primitive state replacement is rejected", () => {
  const state = new StateStore({ initialState: { version: 1 } });
  assert.throws(() => state.replace(1), /state must be a plain object/);
});

await test("event bus on/off/once semantics", () => {
  const events = new EventBus();
  let regular = 0;
  let once = 0;
  const off = events.on("hit", () => regular++);
  events.once("hit", () => once++);
  assert.equal(events.emit("hit", {}), 2);
  assert.equal(events.emit("hit", {}), 1);
  off();
  assert.equal(events.emit("hit", {}), 0);
  assert.equal(regular, 2);
  assert.equal(once, 1);
});

await test("core event bus cannot be shadowed by services", async () => {
  const fakeEvents = { emit() {} };
  const core = createRizoCore({ services: { events: fakeEvents } });
  const game = makeGame({
    initialize(context) {
      assert.equal(context.services.events, core.events);
    }
  });
  await core.games.mount("game.test", game);
  await core.games.unmount();
});

await test("game host runs full lifecycle", async () => {
  const core = createRizoCore();
  const calls = [];
  const game = makeGame({
    initialize() { calls.push("initialize"); },
    start() { calls.push("start"); },
    pause() { calls.push("pause"); },
    resume() { calls.push("resume"); },
    destroy() { calls.push("destroy"); },
    getState() { return { running: true }; }
  });

  await core.games.mount("game.test", game);
  await core.games.start();
  await core.games.pause();
  await core.games.resume();
  assert.deepEqual(core.games.getState(), { running: true });
  await core.games.unmount();
  assert.deepEqual(calls, ["initialize", "start", "pause", "resume", "destroy"]);
});

await test("failed game initialize is cleaned up", async () => {
  const core = createRizoCore();
  let destroyed = false;
  const game = makeGame({
    initialize() { throw new Error("initialize failed"); },
    destroy() { destroyed = true; }
  });

  await assert.rejects(core.games.mount("game.test", game), /initialize failed/);
  assert.equal(destroyed, true);
  assert.equal(core.games.active, null);
});

await test("game context cannot write shadow player state", async () => {
  const core = createRizoCore();
  const game = makeGame({
    initialize(context) {
      assert.throws(() => context.updatePlayer(() => {}), /read-only/);
      context.updateGameState(gameState => {
        gameState.bestWave = 7;
      });
    }
  });

  await core.games.mount("game.defense", game);
  assert.equal(core.state.get().player, undefined);
  assert.equal(core.state.get().games["game.defense"].bestWave, 7);
  await core.games.unmount();
});

await test("game context reads only a configured authoritative player adapter", async () => {
  const snapshot = Object.freeze({ wallet: Object.freeze({ embers: 42 }) });
  const core = createRizoCore({ services: { playerState: { snapshot: () => snapshot } } });
  const game = makeGame({ initialize(context) { assert.equal(context.getPlayerSnapshot(), snapshot); } });
  await core.games.mount("game.test", game);
  await core.games.unmount();
});

await test("persistence keeps write order and destroy flushes latest", async () => {
  const state = new StateStore({ initialState: { version: 1, value: 0 } });
  const writes = [];
  const adapter = {
    async load() { return null; },
    async save(serialized) {
      await new Promise(resolve => setTimeout(resolve, 5));
      writes.push(JSON.parse(serialized).value);
    },
    async clear() {}
  };
  const persistence = createPersistenceController(state, adapter, { debounceMs: 10000 });

  state.update(current => { current.value = 1; });
  await persistence.flush();
  state.update(current => { current.value = 2; });
  await persistence.destroy();
  assert.deepEqual(writes, [1, 2]);
});

await test("persistence recovers after a transient save failure", async () => {
  const state = new StateStore({ initialState: { version: 1, value: 0 } });
  let attempts = 0;
  const adapter = {
    async load() { return null; },
    async save() {
      attempts++;
      if (attempts === 1) throw new Error("transient");
    },
    async clear() {}
  };
  const persistence = createPersistenceController(state, adapter, { debounceMs: 10000 });

  state.update(current => { current.value = 1; });
  await assert.rejects(persistence.flush(), /transient/);
  assert.match(persistence.getLastError().message, /transient/);

  state.update(current => { current.value = 2; });
  await persistence.flush();
  assert.equal(attempts, 2);
  assert.equal(persistence.getLastError(), null);
  await persistence.destroy();
});

await test("hydrate does not immediately echo-save loaded state", async () => {
  const state = new StateStore({ initialState: { version: 1, value: 0 } });
  let saves = 0;
  const adapter = {
    async load() { return JSON.stringify({ version: 1, value: 5 }); },
    async save() { saves++; },
    async clear() {}
  };
  const persistence = createPersistenceController(state, adapter, { debounceMs: 0 });
  await persistence.hydrate();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(state.get().value, 5);
  assert.equal(saves, 0);
  await persistence.destroy();
});

await test("content packs merge by normalized category", () => {
  const merged = mergeContentPacks(
    { Items: [{ id: "item.a" }] },
    { items: [{ id: "item.b" }] }
  );
  assert.deepEqual(merged.items.map(item => item.id), ["item.a", "item.b"]);
});

function makeGame(overrides = {}) {
  return {
    initialize() {},
    start() {},
    pause() {},
    resume() {},
    destroy() {},
    getState() { return {}; },
    ...overrides
  };
}

for (const result of results) {
  if (result.ok) console.log(`PASS  ${result.name}`);
  else console.error(`FAIL  ${result.name}\n      ${result.error?.stack || result.error}`);
}

const failures = results.filter(result => !result.ok);
console.log(`\nRizo Core v1: ${results.length - failures.length}/${results.length} tests passed.`);
if (failures.length) process.exitCode = 1;
