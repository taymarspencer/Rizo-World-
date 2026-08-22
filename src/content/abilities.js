const abilities = [
  ["classic", "Rally", "Guard Line"], ["ember", "Fire Ring", "Cinder Wall"],
  ["toxic", "Spore Cloud", "Spore Snare"], ["violet", "Chain Surge", "Arc Net"],
  ["moss", "Root Garden", "Root Maze"], ["bubblegum", "Big Bounce", "Rebound Field"],
  ["frost", "Deep Freeze", "Ice Lock"], ["glitch", "Rewrite", "Signal Jam"],
  ["obsidian", "Quake", "Fault Lock"], ["aurora", "Prism Field", "Prism Lens"],
  ["golden", "Payday", "Toll Gate"], ["diamond", "Shard Line", "Prism Cage"],
  ["shadow", "Night Cut", "Blackout"], ["retro", "Overclock", "Frame Skip"]
];

export const ABILITIES = abilities.flatMap(([legacyKey, powerName, controlName]) => [
  {
    id: `ability.defense.${legacyKey}.power`,
    name: powerName,
    type: "active",
    source: "legacy",
    rizoId: `rizo.${legacyKey}`,
    tags: ["defense", "ability", "power"],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseAbilities", value: legacyKey }
  },
  {
    id: `ability.defense.${legacyKey}.control`,
    name: controlName,
    type: "active",
    source: "legacy",
    rizoId: `rizo.${legacyKey}`,
    tags: ["defense", "ability", "control"],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseControlAbilities", value: legacyKey }
  }
]);
