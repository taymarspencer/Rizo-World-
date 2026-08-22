// Stable identities for the fourteen collectible variants. The live values remain
// authoritative inside game-v79-defense.js and resolve through RizoLegacyRuntime.
const variants = [
  ["classic", "Classic Blue", "common"],
  ["ember", "Ember Red", "uncommon"],
  ["toxic", "Toxic Lime", "rare"],
  ["violet", "Void Violet", "rare"],
  ["moss", "Moss Rizo", "rare"],
  ["bubblegum", "Bubblegum", "epic"],
  ["frost", "Frostbite", "epic"],
  ["glitch", "Glitch Rizo", "mythic"],
  ["obsidian", "Obsidian", "mythic"],
  ["aurora", "Aurora Rizo", "mythic"],
  ["golden", "Golden Rizo", "legendary"],
  ["diamond", "Diamond Rizo", "secret"],
  ["retro", "Retro Rizo", "secret"],
  ["shadow", "Shadow Rizo", "secret"]
];

export const RIZOS = variants.map(([legacyKey, name, rarity]) => ({
  id: `rizo.${legacyKey}`,
  name,
  type: "variant",
  source: "legacy",
  tags: ["rizo", "collectible", rarity],
  binding: {
    kind: "global-record",
    path: "RizoLegacyRuntime.content.rizos",
    value: legacyKey
  }
}));
