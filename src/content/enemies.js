const normalEnemies = [
  ["puff", "Gloom Balloon"], ["fleet", "Zip Balloon"], ["shell", "Iron Balloon"],
  ["split", "Bubble Balloon"], ["fire", "Fire Balloon"], ["frost", "Frost Balloon"],
  ["storm", "Storm Balloon"], ["ghost", "Phase Balloon"], ["shade", "Shade Balloon"],
  ["brick", "Ceramic Balloon"], ["lead", "Lead Balloon"]
];
const bosses = [
  ["crown", "The Warden"], ["vortex", "The Maw"],
  ["mirror", "The Mirror"], ["apex", "The Redline"]
];

function enemyDefinition([legacyKey, name], type, path) {
  return {
    id: `enemy.defense.${legacyKey}`,
    name,
    type,
    source: "legacy",
    tags: ["defense", "enemy", type],
    binding: { kind: "global-record", path: `RizoLegacyRuntime.content.${path}`, value: legacyKey }
  };
}

export const ENEMIES = [
  ...normalEnemies.map(row => enemyDefinition(row, "balloon", "defenseEnemies")),
  ...bosses.map(row => enemyDefinition(row, "boss", "defenseBosses"))
];
