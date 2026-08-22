import { createDefaultRizoCore } from "../rizo-core/index.js";
import { LegacyRuntimeAdapter } from "../rizo-core/legacy-runtime.js";
import { SourceResolver } from "../rizo-core/source-resolver.js";

export function createRizoWorld({
  globalObject = globalThis,
  documentObject = globalObject?.document,
  storage = globalObject?.localStorage,
  coreOptions = {}
} = {}) {
  const core = createDefaultRizoCore(coreOptions);
  const legacy = new LegacyRuntimeAdapter({ globalObject, documentObject, storage });
  const sources = new SourceResolver(core.registry).register("legacy", legacy);

  const world = {
    version: 1,
    core,
    sources,

    get(category, id) {
      return core.registry.get(category, id);
    },

    has(category, id) {
      return core.registry.has(category, id);
    },

    canonicalId(category, id) {
      return core.registry.canonicalId(category, id);
    },

    aliases(category, id) {
      return core.registry.aliases(category, id);
    },

    query(category) {
      return core.select.query(category);
    },

    resolve(category, id) {
      return sources.resolve(category, id);
    },

    available(category, id) {
      return sources.available(category, id);
    },

    invoke(category, id, ...args) {
      return sources.invoke(category, id, ...args);
    },

    launch(gameId) {
      return sources.invoke("games", gameId);
    },

    game(gameId) {
      return core.registry.get("games", gameId);
    },

    system(systemId) {
      return sources.resolve("systems", systemId);
    },

    manifest() {
      return core.registry.snapshot();
    },

    status() {
      return Object.freeze({
        version: 1,
        categories: core.registry.categories(),
        games: core.registry.all("games").map(game => ({
          id: game.id,
          source: game.source || "native",
          available: sources.available("games", game.id)
        })),
        systems: core.registry.all("systems").map(system => ({
          id: system.id,
          source: system.source || "native",
          available: sources.available("systems", system.id)
        }))
      });
    }
  };

  return Object.freeze(world);
}
