// Existing globals/state exposed through the World bridge. These entries are
// references, not copies. Their stable IDs can survive future rewrites.
export const SYSTEMS = [
  {
    id: "system.defense_core",
    aliases: ["defense_core"],
    name: "Defense Core",
    source: "legacy",
    tags: ["defense", "simulation", "rules"],
    binding: { kind: "global-value", path: "RizoDefenseCore" }
  },
  {
    id: "system.ads",
    aliases: ["ads"],
    name: "Ad Bridge",
    source: "legacy",
    tags: ["monetization", "bridge"],
    binding: { kind: "global-value", path: "RizoAds" }
  },
  {
    id: "system.cloud",
    aliases: ["cloud"],
    name: "Cloud Bridge",
    source: "legacy",
    tags: ["cloud", "bridge"],
    binding: { kind: "global-value", path: "RizoCloud" }
  },
  {
    id: "system.config",
    aliases: ["config"],
    name: "Launch Config",
    source: "legacy",
    tags: ["config", "launch"],
    binding: { kind: "global-value", path: "RIZO_CONFIG" }
  },
  {
    id: "system.boot",
    aliases: ["boot"],
    name: "Boot Recovery",
    source: "legacy",
    tags: ["boot", "recovery"],
    binding: { kind: "global-value", path: "RizoBoot" }
  },
  {
    id: "system.runtime_build",
    aliases: ["runtime_build"],
    name: "Runtime Build Marker",
    source: "legacy",
    tags: ["runtime", "version"],
    binding: { kind: "global-value", path: "__RIZO_RUNTIME_BUILD__" }
  },
  {
    id: "system.player_save",
    aliases: ["player_save", "legacy_save"],
    name: "Current Player Save",
    source: "legacy",
    tags: ["save", "player", "legacy"],
    binding: { kind: "local-storage", key: "rizo-life-overhaul-v2", parse: "json" }
  }
];
