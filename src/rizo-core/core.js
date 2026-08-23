import { ContentRegistry } from "./registry.js";
import { createSelectors } from "./selectors.js";
import { StateStore, createInitialCoreState } from "./state-store.js";
import { GameHost } from "./game-contract.js";
import { EventBus } from "./event-bus.js";

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
  "rewards",
  "systems",
  "achievements",
  "maps"
]);

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeContentPack(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new TypeError("Rizo Core content must be an object of category arrays.");
  }

  const normalized = {};

  for (const [rawCategory, definitions] of Object.entries(content)) {
    const category = normalizeCategory(rawCategory);
    if (!category) throw new Error("Content category names cannot be empty.");
    if (!Array.isArray(definitions)) {
      throw new TypeError(`Content pack category ${rawCategory} must be an array.`);
    }

    normalized[category] = [...(normalized[category] || []), ...definitions];
  }

  return normalized;
}

export function createRizoCore({
  content = {},
  referenceRules = [],
  stateVersion = 1,
  initialState = createInitialCoreState(),
  migrations = {},
  services = {},
  registerUnknownCategories = true
} = {}) {
  const normalizedContent = normalizeContentPack(content);
  const registry = new ContentRegistry();
  const categoryNames = registerUnknownCategories
    ? [...new Set([...CORE_CATEGORIES, ...Object.keys(normalizedContent)])]
    : CORE_CATEGORIES;

  for (const category of categoryNames) {
    registry.registerCategory(category, normalizedContent[category] || []);
  }

  registry.assertHealthy(referenceRules);

  const state = new StateStore({
    version: stateVersion,
    initialState,
    migrations
  });

  const events = new EventBus();

  const core = {
    version: 1,
    registry,
    select: createSelectors(registry),
    state,
    events,
    references: Object.freeze([...referenceRules])
  };

  // The core event bus is authoritative. Services may add capabilities, but cannot
  // silently replace the bus and split system/game communication into two channels.
  core.games = new GameHost(core, { ...services, events });
  return Object.freeze(core);
}

export function mergeContentPacks(...packs) {
  const merged = {};

  for (const pack of packs.filter(Boolean)) {
    const normalized = normalizeContentPack(pack);
    for (const [category, definitions] of Object.entries(normalized)) {
      merged[category] = [...(merged[category] || []), ...definitions];
    }
  }

  return merged;
}
