export const UPGRADES = [
  {
    id: "upgrade.defense.power",
    name: "Power Path",
    type: "doctrine",
    source: "legacy",
    tags: ["defense", "tower", "power"],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseDoctrines", value: "power" }
  },
  {
    id: "upgrade.defense.control",
    name: "Control Path",
    type: "doctrine",
    source: "legacy",
    tags: ["defense", "tower", "control"],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseDoctrines", value: "control" }
  }
];
