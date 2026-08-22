// Deliberately exposed legacy services and diagnostic values. Static catalogs
// resolve through immutable RizoLegacyRuntime snapshots; live services stay live.
// Player-mutating helpers and the direct arcade starter remain identity metadata only
// until an explicit World command/write boundary exists.
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
    optional: true,
    tags: ["save", "player", "legacy", "read-only"],
    binding: { kind: "local-storage", key: "rizo-life-overhaul-v2", parse: "json" }
  },
  {
    id: "system.player_save_engine",
    aliases: ["player_save_engine"],
    name: "Player Save and Migration Engine",
    type: "persistence",
    source: "legacy",
    tags: ["save", "migration", "player", "private-command"],
    implementation: "private-legacy-flow"
  },
  {
    id: "system.defense_checkpoint",
    aliases: ["defense_checkpoint"],
    name: "Defense Run Checkpoint",
    type: "persistence",
    source: "legacy",
    optional: true,
    tags: ["save", "defense", "checkpoint", "read-only"],
    binding: { kind: "local-storage", key: "rizo-life-overhaul-v2:defense-checkpoint-v68", parse: "json" }
  },
  {
    id: "system.arcade",
    aliases: ["arcade"],
    name: "Arcade Runtime",
    type: "game-manager",
    source: "legacy",
    tags: ["arcade", "launch", "runtime", "private-command"],
    implementation: "private-legacy-flow"
  },
  {
    id: "system.progression",
    aliases: ["progression"],
    name: "Player Progression",
    type: "progression",
    source: "legacy",
    tags: ["player", "progression", "achievements", "private-command"],
    implementation: "private-legacy-flow"
  },
  {
    id: "system.season",
    aliases: ["season"],
    name: "Rizo Run Season",
    type: "progression",
    source: "legacy",
    tags: ["season", "heat", "progression", "private-command"],
    implementation: "private-legacy-flow"
  },
  {
    id: "system.defense_runtime",
    aliases: ["defense_runtime"],
    name: "Defense Runtime",
    type: "game-runtime",
    source: "legacy",
    tags: ["defense", "simulation", "legacy"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.systems.defense" }
  },
  {
    id: "system.defense_canvas",
    aliases: ["defense_canvas"],
    name: "Defense Canvas Renderer",
    type: "renderer",
    source: "legacy",
    tags: ["defense", "canvas", "presentation"],
    binding: { kind: "global-value", path: "RizoDefenseCanvas" }
  },
  {
    id: "system.install",
    aliases: ["install"],
    name: "Install Manager",
    type: "pwa",
    source: "legacy",
    tags: ["pwa", "install"],
    binding: { kind: "global-value", path: "RizoInstall" }
  },
  {
    id: "system.monetization",
    aliases: ["monetization"],
    name: "Monetization Adapter",
    type: "bridge",
    source: "legacy",
    tags: ["monetization", "ads", "bridge"],
    binding: { kind: "global-value", path: "RizoMonetization" }
  },
  {
    id: "system.rizo_forms",
    aliases: ["rizo_forms"],
    name: "Rizo Visual Forms",
    type: "visual-catalog",
    source: "legacy",
    tags: ["rizo", "visual", "compatibility"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.content.rizoForms" }
  }
];
