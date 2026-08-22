import { GAMES } from "./games.js";
import { RIZOS } from "./rizos.js";
import { TRAITS } from "./traits.js";
import { ITEMS } from "./items.js";
import { ABILITIES } from "./abilities.js";
import { ENEMIES } from "./enemies.js";
import { TOWERS } from "./towers.js";
import { UPGRADES } from "./upgrades.js";
import { WAVES } from "./waves.js";
import { EVENTS } from "./events.js";
import { REWARDS } from "./rewards.js";
import { SYSTEMS } from "./systems.js";

export const RIZO_CONTENT = Object.freeze({
  games: GAMES,
  rizos: RIZOS,
  traits: TRAITS,
  items: ITEMS,
  abilities: ABILITIES,
  enemies: ENEMIES,
  towers: TOWERS,
  upgrades: UPGRADES,
  waves: WAVES,
  events: EVENTS,
  rewards: REWARDS,
  systems: SYSTEMS
});

// Standard reference rules. Add rules here when a category gains a new ID-based relationship.
export const RIZO_REFERENCE_RULES = Object.freeze([
  { from: "rizos", field: "traitIds", to: "traits", many: true, optional: true },
  { from: "rizos", field: "abilityIds", to: "abilities", many: true, optional: true },
  { from: "items", field: "abilityIds", to: "abilities", many: true, optional: true },
  { from: "towers", field: "rizoId", to: "rizos", optional: true },
  { from: "towers", field: "abilityIds", to: "abilities", many: true, optional: true },
  { from: "towers", field: "upgradeIds", to: "upgrades", many: true, optional: true },
  { from: "events", field: "itemIds", to: "items", many: true, optional: true },
  { from: "events", field: "rewardIds", to: "rewards", many: true, optional: true },
  { from: "games", field: "rewardIds", to: "rewards", many: true, optional: true }
]);
