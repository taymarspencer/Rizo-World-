import { ContentRegistry } from "./registry.js";
import { createSelectors } from "./selectors.js";
import { StateStore, createInitialPlayerState } from "./state-store.js";
import { GameHost } from "./game-contract.js";

export const CORE_CATEGORIES = Object.freeze([
  "games",
  "rizos",
  "traits",
  "items",
  "abilities",
  "enemies",
  "towers",
  "upgrades",
  "waves",
  "events",
  "rewards"
]);

export function createRizoCore({
  content = {},
  referenceRules = [],
  stateVersion = 1,
  initialState = createInitialPlayerState(),
  migrations = {},
  services = {},
  registerUnknownCategories = true
} = {}) {
  const registry = new ContentRegistry();
  const categoryNames = registerUnknownCategories
    ? [...new Set([...CORE_CATEGORIES, ...Object.keys(content)])]
    : CORE_CATEGORIES;

  for (const category of categoryNames) {
    registry.registerCategory(category, content[category] || []);
  }

  registry.assertHealthy(referenceRules);

  const state = new StateStore({
    version: stateVersion,
    initialState,
    migrations
  });

  const core = {
    version: 1,
    registry,
    select: createSelectors(registry),
    state,
    references: Object.freeze([...referenceRules])
  };

  core.games = new GameHost(core, services);
  return Object.freeze(core);
}

export function mergeContentPacks(...packs) {
  const merged = {};

  for (const pack of packs.filter(Boolean)) {
    for (const [category, definitions] of Object.entries(pack)) {
      if (!Array.isArray(definitions)) {
        throw new TypeError(`Content pack category ${category} must be an array.`);
      }
      merged[category] = [...(merged[category] || []), ...definitions];
    }
  }

  return merged;
}
