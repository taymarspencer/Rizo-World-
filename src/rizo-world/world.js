import { createDefaultRizoCore } from "../rizo-core/index.js";
import { LegacyRuntimeAdapter } from "../rizo-core/legacy-runtime.js";
import { readonlySnapshot } from "../rizo-core/legacy-runtime.js";
import { SourceResolver } from "../rizo-core/source-resolver.js";

function safeProperty(object, key) {
  try { return object?.[key]; }
  catch { return null; }
}

export function createRizoWorld({
  globalObject = globalThis,
  documentObject,
  storage,
  coreOptions = {}
} = {}) {
  const resolvedDocument = documentObject === undefined ? safeProperty(globalObject, "document") : documentObject;
  const resolvedStorage = storage === undefined ? safeProperty(globalObject, "localStorage") : storage;
  const playerState = Object.freeze({
    authority: "legacy",
    writable: false,
    snapshot() {
      const snapshot = safeProperty(safeProperty(globalObject, "RizoLegacyRuntime"), "currentState");
      if (!snapshot) throw new Error("Authoritative legacy player state is unavailable.");
      return readonlySnapshot(snapshot);
    }
  });
  const core = createDefaultRizoCore({
    ...coreOptions,
    services: { ...(coreOptions.services || {}), playerState }
  });
  const legacy = new LegacyRuntimeAdapter({
    globalObject,
    documentObject: resolvedDocument,
    storage: resolvedStorage
  });
  const sources = new SourceResolver(core.registry).register("legacy", legacy);

  function locate(id) {
    const located = core.registry.locate(id);
    if (!located) throw new Error(`Unknown Rizo World id: ${id}`);
    return located;
  }

  function address(categoryOrId, id) {
    if (id !== undefined) return { category: categoryOrId, id };
    const located = locate(categoryOrId);
    return { category: located.category, id: located.canonicalId };
  }

  const world = {
    version: 1,
    core,
    playerState,

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

    describe(categoryOrId, id) {
      const target = address(categoryOrId, id);
      return sources.describe(target.category, target.id);
    },

    resolve(categoryOrId, id) {
      const target = address(categoryOrId, id);
      return sources.resolve(target.category, target.id);
    },

    available(categoryOrId, id) {
      const target = address(categoryOrId, id);
      return sources.available(target.category, target.id);
    },

    invoke(categoryOrId, id, ...args) {
      if (arguments.length >= 2 && typeof id === "string" && core.registry.has(categoryOrId, id)) {
        return sources.invoke(categoryOrId, id, ...args);
      }
      const target = address(categoryOrId);
      const invocationArgs = arguments.length > 1 ? [id, ...args] : [];
      return sources.invoke(target.category, target.id, ...invocationArgs);
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

    player() {
      return playerState.snapshot();
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
