/*
  RIZO DUNGEON — CONTENT
  ======================
  Pure, frozen data: room geometry, anchors, encounters, inspectable objects
  and their few lines. No behavior lives here; dungeon-core.js reads it and
  the save stores only the stable ids it declares.

  Coordinates are fixed logical units (the camera is about 320 wide). Rooms
  never change size with the screen.

  GATE 1 (review build): one room. "clatter" is the second room of The
  Threshold; until the full episode lands it carries a small review hearth so
  rest and retry can be played. Its campaigns use content revision
  "threshold-gate1", which a later build migrates explicitly.
*/
(function initRizoDungeonContent(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonContent", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonContent() {
  "use strict";

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  }

  const CONTENT_REVISION = "threshold-gate1";
  const CAMPAIGN_KIND = "proof";
  const CHAPTER_ID = "threshold";
  // Every room id The Threshold will ever use. Only "clatter" is built in Gate 1.
  const ROOM_IDS = ["slip", "clatter", "hem", "hearth", "queue", "porter"];
  const BUILT_ROOMS = ["clatter"];

  const ROOMS = {
    clatter: {
      id: "clatter",
      name: "CLATTER PASSAGE",
      w: 336,
      h: 432,
      // Solid rectangles. Walls are 20 thick; the north door is a solid until
      // the next room exists.
      solids: [
        { id: "wall-n-west", x: 0, y: 0, w: 236, h: 20, kind: "wall" },
        { id: "north-door", x: 236, y: 0, w: 40, h: 20, kind: "door" },
        { id: "wall-n-east", x: 276, y: 0, w: 60, h: 20, kind: "wall" },
        { id: "wall-s", x: 0, y: 412, w: 336, h: 20, kind: "wall" },
        { id: "wall-w", x: 0, y: 0, w: 20, h: 432, kind: "wall" },
        { id: "wall-e", x: 316, y: 0, w: 20, h: 432, kind: "wall" },
        { id: "crates", x: 60, y: 150, w: 44, h: 34, kind: "crate" },
        { id: "pipe", x: 232, y: 236, w: 16, h: 66, kind: "pipe" },
        { id: "shelf", x: 150, y: 60, w: 72, h: 18, kind: "shelf" }
      ],
      anchors: {
        "clatter-entry": { x: 52, y: 388 },
        "clatter-hearth-side": { x: 124, y: 380 }
      },
      entryAnchor: "clatter-entry",
      // Review scaffold: the first real hearth is its own room in the full episode.
      hearth: { id: "clatter-review-hearth", x: 98, y: 362, r: 9, spawnAnchorId: "clatter-hearth-side" },
      props: [
        { id: "ticket-stub", kind: "inspect", x: 290, y: 382, r: 6, prompt: "LOOK", lines: ["A ticket stub, punched twice.", "The name on it has been rubbed away."] },
        { id: "north-door", kind: "door", x: 256, y: 28, r: 10, prompt: "LOOK", lines: ["The door is shut from the other side.", "Something past it is still being built."] },
        { id: "way-back", kind: "inspect", x: 52, y: 406, r: 8, prompt: "LOOK", lines: ["The way you came in rattled shut.", "Home is still up there. The menu can take you back."] }
      ],
      encounters: [
        { id: "clatter-draftling", kind: "draftling", x: 176, y: 176, durable: false }
      ],
      palette: { floor: "#2b251e", floorLine: "#362e25", wall: "#100e0c", wallEdge: "#5d4c39", crate: "#6e5238", crateEdge: "#2a1f16", pipe: "#4a5a64", pipeEdge: "#1c2328", shelf: "#55442f", door: "#3a3229", doorEdge: "#8a7458", hearth: "#ff9a3c" }
    }
  };

  const ENEMIES = {
    draftling: { hp: 4, radius: 8, detect: 88, windupMs: 850, lockAtMs: 520, lungeMs: 240, lungeDistance: 48, recoverMs: 700, homeDrift: 6 }
  };

  const LINES = {
    rested: "Warm again.",
    firstDown: "The flame went low. The hearth kept it.",
    reviewNote: "REVIEW BUILD • ONE ROOM OF THE THRESHOLD. THE REST IS NOT BUILT YET."
  };

  const api = {
    CONTENT_REVISION,
    CAMPAIGN_KIND,
    CHAPTER_ID,
    ROOM_IDS,
    BUILT_ROOMS,
    ROOMS,
    ENEMIES,
    LINES,
    START_ROOM: "clatter",
    knownRoom: id => BUILT_ROOMS.includes(id),
    knownAnchor: (roomId, anchorId) => Boolean(ROOMS[roomId]?.anchors?.[anchorId]),
    knownHearth: id => Object.values(ROOMS).some(room => room.hearth?.id === id),
    knownEncounter: id => Object.values(ROOMS).some(room => room.encounters.some(item => item.id === id)),
    hearthRoom: id => Object.values(ROOMS).find(room => room.hearth?.id === id) || null
  };
  return deepFreeze(api);
});
