// Stable game identities for the current Rizo.world arcade.
// Existing implementations stay where they are; the World bridge invokes the same
// data-minigame controls the live runtime already owns. Rewrites can later switch a
// definition from source:"legacy" to source:"native" without changing its ID.
export const GAMES = [
  {
    id: "game.ember_beat",
    aliases: ["rhythm", "ember_beat"],
    name: "Ember Beat",
    source: "legacy",
    mode: "rhythm",
    tags: ["arcade", "rhythm", "music"],
    binding: { kind: "dom-click", selector: '[data-minigame="rhythm"]' }
  },
  {
    id: "game.rizo_runaway",
    aliases: ["maze", "pacman", "rizo_runaway"],
    name: "Rizo Runaway",
    source: "legacy",
    mode: "maze",
    tags: ["arcade", "maze", "chase"],
    binding: { kind: "dom-click", selector: '[data-minigame="maze"]' }
  },
  {
    id: "game.rain_walk",
    aliases: ["walk", "rain_walk"],
    name: "Rain Walk",
    source: "legacy",
    mode: "walk",
    tags: ["arcade", "exploration", "story"],
    binding: { kind: "dom-click", selector: '[data-minigame="walk"]' }
  },
  {
    id: "game.power_tape",
    aliases: ["power", "punching_bag", "power_tape"],
    name: "Power Tape",
    source: "legacy",
    mode: "power",
    tags: ["arcade", "timing", "training"],
    binding: { kind: "dom-click", selector: '[data-minigame="power"]' }
  },
  {
    id: "game.spark_stash",
    aliases: ["spark", "spark_stash"],
    name: "Spark Stash",
    source: "legacy",
    mode: "spark",
    tags: ["arcade", "risk", "collection"],
    binding: { kind: "dom-click", selector: '[data-minigame="spark"]' }
  },
  {
    id: "game.forest_lunch",
    aliases: ["forage", "forest_lunch"],
    name: "Forest Lunch",
    source: "legacy",
    mode: "forage",
    tags: ["arcade", "sorting", "reaction"],
    binding: { kind: "dom-click", selector: '[data-minigame="forage"]' }
  },
  {
    id: "game.rizo_courier",
    aliases: ["rush", "emberrun", "rizo_courier"],
    name: "Rizo Courier",
    source: "legacy",
    mode: "rush",
    tags: ["arcade", "runner", "platform"],
    binding: { kind: "dom-click", selector: '[data-minigame="rush"]' }
  },
  {
    id: "game.lost_signal",
    aliases: ["memory", "lost_signal"],
    name: "Lost Signal",
    source: "legacy",
    mode: "memory",
    tags: ["arcade", "memory", "puzzle"],
    binding: { kind: "dom-click", selector: '[data-minigame="memory"]' }
  },
  {
    id: "game.skybound",
    aliases: ["glide", "flappy", "skybound"],
    name: "Skybound",
    source: "legacy",
    mode: "glide",
    tags: ["arcade", "flight", "endless"],
    binding: { kind: "dom-click", selector: '[data-minigame="glide"]' }
  },
  {
    id: "game.ember_forge",
    aliases: ["breaker", "ember_forge"],
    name: "Ember Forge",
    source: "legacy",
    mode: "breaker",
    tags: ["arcade", "breaker", "physics"],
    binding: { kind: "dom-click", selector: '[data-minigame="breaker"]' }
  },
  {
    id: "game.defense",
    aliases: ["defense", "rizo_defense"],
    name: "Rizo Defense",
    source: "legacy",
    mode: "defense",
    tags: ["arcade", "strategy", "tower-defense", "flagship"],
    binding: { kind: "dom-click", selector: '[data-minigame="defense"]' }
  }
];
