export { ContentRegistry } from "./registry.js";
export { ContentQuery, createSelectors } from "./selectors.js";
export { StateStore, createInitialPlayerState } from "./state-store.js";
export { EventBus } from "./event-bus.js";
export { GameHost, assertGameModule, createGameContext, GAME_CONTRACT_METHODS } from "./game-contract.js";
export { MemoryPersistenceAdapter, LocalStoragePersistenceAdapter, createPersistenceController } from "./persistence.js";
export { LegacyRuntimeAdapter, NativeRuntimeAdapter, resolveGlobalPath } from "./legacy-runtime.js";
export { SourceResolver } from "./source-resolver.js";
export { createRizoCore, mergeContentPacks, CORE_CATEGORIES } from "./core.js";

import { createRizoCore } from "./core.js";
import { RIZO_CONTENT, RIZO_REFERENCE_RULES } from "../content/index.js";

export function createDefaultRizoCore(options = {}) {
  return createRizoCore({
    content: RIZO_CONTENT,
    referenceRules: RIZO_REFERENCE_RULES,
    ...options
  });
}
