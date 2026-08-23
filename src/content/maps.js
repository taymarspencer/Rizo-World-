const maps = [
  ["grove", "Pine Bend"],
  ["ember", "Ember Switchback"],
  ["moon", "Moon Loop"],
  ["storm", "Storm Circuit"],
  ["blizzard", "Whiteout Pass"],
  ["eclipse", "Eclipse Ridge"]
];

export const MAPS = maps.map(([legacyKey, name]) => ({
  id: `map.defense.${legacyKey}`,
  name,
  type: "defense-map",
  source: "legacy",
  tags: ["defense", "map", "world"],
  binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseMaps", value: legacyKey }
}));
