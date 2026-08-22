export const REWARDS = [
  {
    id: "reward.embers",
    name: "Embers",
    type: "currency",
    source: "legacy",
    tags: ["currency", "wallet", "spendable"],
    statePath: "wallet.embers",
    implementation: "private-legacy-flow"
  },
  {
    id: "reward.prism_shards",
    name: "Prism Shards",
    type: "currency",
    source: "legacy",
    tags: ["currency", "wallet", "rare"],
    statePath: "wallet.shards",
    implementation: "private-legacy-flow"
  },
  {
    id: "reward.heat",
    name: "Season Heat",
    type: "progression",
    source: "legacy",
    tags: ["season", "progression"],
    statePath: "season.xp",
    implementation: "private-legacy-flow"
  },
  {
    id: "reward.lore_fragment",
    name: "Lore Fragment",
    type: "unlock",
    source: "legacy",
    tags: ["lore", "collection"],
    implementation: "private-legacy-flow"
  }
];
