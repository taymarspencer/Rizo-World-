const worldEvents = [
  ["window-letter", "A Letter Hit the Window", "story"],
  ["sock-case", "The Sock Is Missing", "story"],
  ["tiny-concert", "Rizo Started a Concert", "story"],
  ["glowing-puddle", "A Puddle Is Glowing", "story"],
  ["hide-event", "The Den Is Too Quiet", "story"],
  ["shadow-watch", "Something Is Outside", "story"],
  ["roof-leak", "The Roof Started Leaking", "misfortune"],
  ["spoiled-stash", "The Snack Stash Turned", "misfortune"],
  ["broken-window", "A Branch Broke the Window", "misfortune"],
  ["lost-pouch", "The Ember Pouch Is Gone", "misfortune"]
];

export const EVENTS = [
  ...worldEvents.map(([legacyKey, name, type]) => ({
    id: `event.world.${legacyKey}`,
    name,
    type,
    source: "legacy",
    tags: ["world", "random", type],
    binding: { kind: "global-record", path: "RizoLegacyRuntime.content.worldEvents", value: legacyKey }
  })),
  {
    id: "event.rizo_run",
    name: "Rizo Run Endless Season",
    type: "season",
    source: "legacy",
    rewardIds: ["reward.embers", "reward.prism_shards", "reward.heat"],
    tags: ["season", "progression", "endless"],
    binding: { kind: "global-value", path: "RizoLegacyRuntime.systems.season" }
  }
];
