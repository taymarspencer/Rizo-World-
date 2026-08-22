const towerProfiles = [
  ["classic", "Classic Defense Rizo"], ["ember", "Ember Defense Rizo"],
  ["toxic", "Toxic Defense Rizo"], ["violet", "Violet Defense Rizo"],
  ["moss", "Moss Defense Rizo"], ["bubblegum", "Bubblegum Defense Rizo"],
  ["frost", "Frost Defense Rizo"], ["glitch", "Glitch Defense Rizo"],
  ["obsidian", "Obsidian Defense Rizo"], ["aurora", "Aurora Defense Rizo"],
  ["golden", "Golden Defense Rizo"], ["diamond", "Diamond Defense Rizo"],
  ["shadow", "Shadow Defense Rizo"], ["retro", "Retro Defense Rizo"]
];

// Towers are legacy player-pet instances. These entries identify their authoritative
// per-variant combat profile; placement and instance state stay private in the game.
export const TOWERS = towerProfiles.map(([legacyKey, name]) => ({
  id: `tower.defense.${legacyKey}`,
  name,
  type: "variant-profile",
  source: "legacy",
  rizoId: `rizo.${legacyKey}`,
  abilityIds: [
    `ability.defense.${legacyKey}.power`,
    `ability.defense.${legacyKey}.control`
  ],
  upgradeIds: ["upgrade.defense.power", "upgrade.defense.control"],
  tags: ["defense", "tower", "legacy-instance"],
  binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseAbilities", value: legacyKey }
}));
