export const UPGRADES = [
  {
    id: "upgrade.defense.doctrine.power",
    name: "Power Doctrine",
    type: "doctrine",
    source: "legacy",
    tags: ["defense", "tower", "power"],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseDoctrines", value: "power" }
  },
  {
    id: "upgrade.defense.doctrine.control",
    name: "Control Doctrine",
    type: "doctrine",
    source: "legacy",
    tags: ["defense", "tower", "control"],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.defenseDoctrines", value: "control" }
  }
];
