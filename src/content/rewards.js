const achievements = [
  ["origin", "Took It Home"], ["hatched", "It Lives"],
  ["tap100", "Certified Clicker"], ["tap1000", "Touch Grass Later"],
  ["bond50", "Actually Friends"], ["strong", "Built Different"],
  ["collector5", "Rizo Researcher"], ["capsule10", "Capsule Problem"],
  ["golden", "One Percent Problem"], ["diamond", "Impossible Little Guy"],
  ["legend", "Raised Different"], ["week", "Showed Up"],
  ["heat10", "Seasoned Keeper"], ["walk10", "Regular Route"],
  ["treasure5", "Pocket Museum"], ["retro", "Old Hardware"],
  ["shadow", "Something Followed"], ["rebirth", "The Flame Remembers"],
  ["bondegg", "Two Gardens, One Spark"], ["gen3", "Real Lineage"],
  ["hiddenform", "Hidden Path"]
];

export const REWARDS = [
  {
    id: "reward.embers",
    aliases: ["currency.embers", "embers"],
    name: "Embers",
    type: "currency",
    source: "legacy",
    tags: ["currency", "wallet", "spendable"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.currentState.wallet.embers" }
  },
  {
    id: "reward.prism_shards",
    aliases: ["currency.prism_shards", "prism_shards"],
    name: "Prism Shards",
    type: "currency",
    source: "legacy",
    tags: ["currency", "wallet", "rare"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.currentState.wallet.shards" }
  },
  {
    id: "reward.heat",
    name: "Season Heat",
    type: "progression",
    source: "legacy",
    tags: ["season", "progression"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.currentState.season.xp" }
  },
  {
    id: "reward.forest_capsule",
    name: "Forest Capsule",
    type: "collectible-roll",
    source: "legacy",
    tags: ["capsule", "collection", "rizo"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.currentState.meta.capsules" }
  },
  {
    id: "reward.lore_fragment",
    name: "Lore Fragment",
    type: "collection",
    source: "legacy",
    tags: ["lore", "collection"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.currentState.loreUnlocked" }
  },
  ...achievements.map(([legacyKey, name]) => ({
    id: `reward.achievement.${legacyKey}`,
    name,
    type: "achievement",
    source: "legacy",
    rewardIds: ["reward.embers"],
    tags: ["achievement", "badge", "progression"],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.achievements", value: legacyKey }
  }))
];
