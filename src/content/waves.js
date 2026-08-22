// Defense waves are generated, not authored as independent records. Keep the generator
// legacy until individual wave content is deliberately rebuilt.
export const WAVES = [
  {
    id: "wave.defense.generator",
    name: "Defense Endless Wave Generator",
    type: "generator",
    source: "legacy",
    tags: ["defense", "wave", "endless", "generated"],
    binding: { kind: "global-call", path: "RizoLegacyRuntime.systems.defense.wavePlan" }
  }
];
