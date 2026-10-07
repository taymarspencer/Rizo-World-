/*
  RIZO DUNGEON — CONTENT
  ======================
  Pure, frozen data: rooms (geometry, anchors, exits, trigger zones, props,
  encounters), speakers with portrait expressions, and every line. No
  behavior lives here; dungeon-core.js reads geometry, dungeon-mode.js runs
  the scenes, and the save stores only the stable ids declared here.

  Coordinates are fixed logical units (the camera is about 320 wide). Rooms
  never change size with the screen.

  THE THRESHOLD (content revision "threshold-v2"):
    opening, outside, before the handheld locks:  car → sack → van → roadside → drain
    (v0.3: the Keeper's parked car replaced RC2's curb; threshold-v1 saves are
    carried forward by dungeon-core's migrateV1, curb → car, nothing reset)
    below, inside the Rizo Field Unit:            slip → clatter → hem → hearth
                                                  hem → queue → porter
                                                  hearth ↔ queue (shortcut, lever)

  Conditions: a solid, exit or prop may carry `openWhen: "<flag>"` (present
  until the flag is true) or `when: { flag: bool }` (present only then).
  Flags are the campaign's durable room flags and story facts.
*/
(function initRizoDungeonContent(root, factory) {
  // Portraits are art: they live in dungeon-art.js (loaded first in the page).
  let art = root?.RizoDungeonArt || null;
  if (!art && typeof require === "function") { try { art = require("./dungeon-art.js"); } catch (error) { art = null; } }
  const api = factory(art);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) Object.defineProperty(root, "RizoDungeonContent", { value: api, configurable: true });
})(typeof globalThis !== "undefined" ? globalThis : this, function createRizoDungeonContent(Art) {
  "use strict";

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  }
  const walls = (w, h, t = 20, gaps = {}) => {
    // Four walls with optional door gaps: gaps.n/s = [x0, x1], gaps.w/e = [y0, y1].
    const out = [];
    const span = (side, length, gap, make) => {
      if (!gap) { out.push(make(0, length)); return; }
      if (gap[0] > 0) out.push(make(0, gap[0]));
      if (gap[1] < length) out.push(make(gap[1], length - gap[1]));
    };
    span("n", w, gaps.n, (a, l) => ({ id: `wall-n-${a}`, x: a, y: 0, w: l, h: t, kind: "wall" }));
    span("s", w, gaps.s, (a, l) => ({ id: `wall-s-${a}`, x: a, y: h - t, w: l, h: t, kind: "wall" }));
    span("w", h, gaps.w, (a, l) => ({ id: `wall-w-${a}`, x: 0, y: a, w: t, h: l, kind: "wall" }));
    span("e", h, gaps.e, (a, l) => ({ id: `wall-e-${a}`, x: w - t, y: a, w: t, h: l, kind: "wall" }));
    return out;
  };

  const CONTENT_REVISION = "threshold-v4";
  // Revisions this build knows how to carry forward (see dungeon-core normalizeSlice):
  // a Gate 1 review campaign restarts at the opening; an RC2 (threshold-v1)
  // journey keeps everything and only leaves the deleted curb for the car.
  const LEGACY_REVISIONS = ["threshold-gate1"];
  // threshold-v2 → v3 only adds rooms and facts (Mending Rows); v3 → v4 adds
  // the collectors, their marks and four facts (story spine v0.4). Nothing moves.
  const CARRIED_REVISIONS = ["threshold-v1", "threshold-v2", "threshold-v3"];
  const CAMPAIGN_KIND = "proof";
  const CHAPTER_ID = "threshold";
  const OPENING_ROOMS = ["car", "sack", "van", "roadside", "drain"];
  const ROOM_IDS = ["slip", "clatter", "hem", "hearth", "queue", "porter"];
  // Chapter 1 (v0.2 "Mending Rows", condensed): the campaign edition goes on
  // past the Porter (owner decision N-12 / P-01).
  const ROWS_ROOMS = ["receiving", "drytable", "hangrow", "lowrun", "eyelet", "traypass", "press", "upper", "stair", "windowgate"];
  const BUILT_ROOMS = [...OPENING_ROOMS, ...ROOM_IDS, ...ROWS_ROOMS];
  const wallSet = (w, h, t, gaps) => {
    // Like walls(), but any side may have several gaps: gaps.n = [[x0, x1], …].
    const out = [];
    const side = (name, length, list, make) => {
      let at = 0;
      for (const [a, b] of [...(list || [])].sort((m, n) => m[0] - n[0])) { if (a > at) out.push(make(at, a - at)); at = b; }
      if (at < length) out.push(make(at, length - at));
    };
    side("n", w, gaps.n, (a, l) => ({ id: `wall-n-${a}`, x: a, y: 0, w: l, h: t, kind: "wall" }));
    side("s", w, gaps.s, (a, l) => ({ id: `wall-s-${a}`, x: a, y: h - t, w: l, h: t, kind: "wall" }));
    side("w", h, gaps.w, (a, l) => ({ id: `wall-w-${a}`, x: 0, y: a, w: t, h: l, kind: "wall" }));
    side("e", h, gaps.e, (a, l) => ({ id: `wall-e-${a}`, x: w - t, y: a, w: t, h: l, kind: "wall" }));
    return out;
  };

  const ROOMS = {
    // ===== THE OPENING (outside; the handheld is not locked yet) =====
    // The Keeper's car, parked nose-in at the late store. Seen from above with
    // the roof cut away; the store is across the sidewalk, through the glass.
    // Rizo can only move inside the cabin: seats, dash, the side window, YOU.
    car: {
      id: "car", name: "LATE STORE", world: true, w: 360, h: 384, theme: "car", rain: 0.55,
      // On a short screen the camera still keeps the store window in view if it can.
      cameraKeep: { y: 40 },
      solids: [
        { id: "car-front", x: 124, y: 136, w: 112, h: 62, kind: "car" },
        { id: "car-left", x: 124, y: 136, w: 16, h: 240, kind: "car" },
        { id: "car-right", x: 220, y: 136, w: 16, h: 240, kind: "car" },
        { id: "car-rear", x: 124, y: 328, w: 112, h: 48, kind: "car" },
        // YOU in the driver's seat (and the wheel in front of YOU), until YOU goes in.
        { id: "you-seat", x: 142, y: 204, w: 30, h: 64, kind: "you", openWhen: "youGone" }
      ],
      anchors: { seat: { x: 203, y: 252 }, dash: { x: 192, y: 210 } },
      entryAnchor: "seat",
      shelters: [{ x: 124, y: 136, w: 112, h: 240 }],
      props: [
        { id: "you", kind: "npc", x: 162, y: 238, r: 10, prompt: "LOOK", when: { youGone: false, youGreeted: false } },
        { id: "store-window", kind: "inspect", x: 180, y: 203, r: 8, prompt: "LOOK", lines: ["Inside, between the chips and the cold drinks: YOU."], when: { youGone: true, threat: false } }
      ],
      zones: [
        { id: "dash", x: 140, y: 198, w: 80, h: 9 },
        { id: "footwell", x: 192, y: 216, w: 28, h: 8 },
        { id: "you-near", x: 172, y: 206, w: 13, h: 62 },
        { id: "window-side", x: 215, y: 226, w: 5, h: 80 }
      ],
      exits: [], encounters: []
    },
    // Inside the pillowcase: nothing but his own glow through the cloth.
    sack: {
      id: "sack", name: "", world: true, w: 200, h: 200, theme: "sack", rain: 0,
      solids: [
        { id: "sack-n", x: 0, y: 0, w: 200, h: 92, kind: "cloth" },
        { id: "sack-s", x: 0, y: 120, w: 200, h: 80, kind: "cloth" },
        { id: "sack-w", x: 0, y: 0, w: 90, h: 200, kind: "cloth" },
        { id: "sack-e", x: 110, y: 0, w: 90, h: 200, kind: "cloth" }
      ],
      anchors: { start: { x: 100, y: 106 } },
      entryAnchor: "start",
      props: [], zones: [], exits: [], encounters: []
    },
    // The crew's work van, nose to the left, driving left; the cargo bay is
    // his floor. The far wall (top) is the van's side with the sliding door,
    // the cab is past the seatbacks (left), and the back doors (right) are
    // the ones that come loose. The camera keeps the cab and the doors in frame.
    van: {
      id: "van", name: "BACK OF A VAN", world: true, w: 240, h: 150, theme: "van", rain: 0,
      cameraCenterX: 100,
      solids: [
        { id: "seats", x: 0, y: 0, w: 240, h: 42, kind: "seats" },
        { id: "van-floor-s", x: 0, y: 138, w: 240, h: 12, kind: "wall" },
        { id: "van-w", x: 0, y: 0, w: 14, h: 150, kind: "wall" },
        { id: "van-e", x: 226, y: 0, w: 14, h: 150, kind: "vandoor" }
      ],
      anchors: { start: { x: 74, y: 98 }, "door-near": { x: 206, y: 96 } },
      entryAnchor: "start",
      props: [
        { id: "van-door", kind: "door", x: 220, y: 96, r: 8, prompt: "LOOK", lines: ["Locked. The handle is cold."], when: { vanDoorLoose: false } },
        { id: "van-gap", kind: "door", x: 220, y: 96, r: 8, prompt: "LOOK", lines: ["The door isn't shut right. Rain comes through the gap."], when: { vanDoorLoose: true } },
        { id: "van-window", kind: "inspect", x: 128, y: 48, r: 8, prompt: "LOOK", lines: ["Lights go by. None of them are the store."] },
        { id: "chips", kind: "inspect", x: 36, y: 124, r: 7, prompt: "LOOK", lines: ["A bag of chips. Somebody sat on it."] }
      ],
      zones: [{ id: "van-door-zone", x: 186, y: 70, w: 40, h: 56 }],
      exits: [], encounters: []
    },
    roadside: {
      id: "roadside", name: "THE ROADSIDE", world: true, w: 300, h: 1400, theme: "road", rain: 0.75,
      solids: [
        { id: "embankment-w", x: 0, y: 0, w: 22, h: 1400, kind: "bank" },
        { id: "rail", x: 198, y: 70, w: 8, h: 1330, kind: "rail" },
        { id: "road", x: 206, y: 0, w: 94, h: 1400, kind: "street" },
        { id: "bank-n-w", x: 0, y: 0, w: 70, h: 26, kind: "bank" },
        { id: "bank-n-e", x: 130, y: 0, w: 76, h: 26, kind: "bank" },
        { id: "bank-s", x: 0, y: 1386, w: 206, h: 14, kind: "bank" },
        { id: "pole-a", x: 184, y: 1146, w: 6, h: 6, kind: "pole" },
        { id: "pole-b", x: 184, y: 796, w: 6, h: 6, kind: "pole" },
        { id: "pole-c", x: 184, y: 446, w: 6, h: 6, kind: "pole" },
        { id: "trashbag", x: 156, y: 966, w: 18, h: 14, kind: "trash" },
        { id: "shelter-bench", x: 70, y: 612, w: 70, h: 8, kind: "bench" }
      ],
      anchors: { fallen: { x: 172, y: 1330 }, "drain-front": { x: 100, y: 70 } },
      entryAnchor: "fallen",
      lights: [{ x: 187, y: 1150 }, { x: 187, y: 800 }, { x: 187, y: 450 }],
      shelters: [{ x: 56, y: 590, w: 104, h: 64 }],
      props: [
        { id: "bowl-road", kind: "inspect", x: 142, y: 984, r: 7, prompt: "LOOK", lines: ["A bowl in the rain. Somebody's, once.", "Not his."] },
        { id: "bus-sign", kind: "inspect", x: 66, y: 592, r: 7, prompt: "LOOK", lines: ["A bus stop. No bus."] },
        // Wherever a Rizo goes missing, his card turns up.
        { id: "lost-poster", kind: "inspect", x: 128, y: 594, r: 7, prompt: "LOOK", lines: ["A paper on the glass: LOST. Small. Glows. Answers to Pip.", "A black card is tucked under it. A jar, with a light shut inside."] }
      ],
      zones: [{ id: "bowl-near", x: 112, y: 950, w: 64, h: 64 }, { id: "rain-worse", x: 22, y: 26, w: 176, h: 300 }, { id: "midpoint", x: 22, y: 700, w: 176, h: 40 }],
      // Shadow a beam passes over: the ditch along the embankment, the lee of
      // each guardrail post, the torn bin bag.
      hides: [
        { id: "ditch", x: 22, y: 26, w: 30, h: 1360 },
        { id: "bag-lee", x: 140, y: 962, w: 40, h: 30 },
        ...Array.from({ length: 30 }, (_, index) => ({ id: `post-${index}`, x: 184, y: 66 + index * 44, w: 14, h: 16 }))
      ],
      exits: [{ id: "into-drain", x: 70, y: 0, w: 60, h: 40, to: "drain", anchor: "mouth" }],
      encounters: []
    },
    // Concrete at the mouth, then old brick, then rock: further in than a drain goes.
    drain: {
      id: "drain", name: "THE DRAIN", world: true, w: 240, h: 760, theme: "drain", rain: 0.15,
      solids: [
        { id: "drain-w", x: 0, y: 240, w: 42, h: 520, kind: "concrete" },
        { id: "drain-e", x: 198, y: 240, w: 42, h: 520, kind: "concrete" },
        { id: "rock-w", x: 0, y: 0, w: 62, h: 240, kind: "rock" },
        { id: "rock-e", x: 178, y: 0, w: 62, h: 240, kind: "rock" },
        { id: "rock-n", x: 0, y: 0, w: 240, h: 30, kind: "rock" },
        { id: "rock-a", x: 62, y: 150, w: 18, h: 22, kind: "rock" },
        { id: "rock-b", x: 162, y: 94, w: 16, h: 20, kind: "rock" }
      ],
      anchors: { mouth: { x: 120, y: 720 } },
      entryAnchor: "mouth",
      shelters: [{ x: 42, y: 0, w: 156, h: 742 }],
      props: [
        { id: "glove", kind: "inspect", x: 78, y: 680, r: 6, prompt: "LOOK", lines: ["A glove. Dry. Somebody waited here once."] },
        { id: "warm-air", kind: "inspect", x: 120, y: 112, r: 10, prompt: "LOOK", lines: ["Warm air. From down there."] }
      ],
      zones: [{ id: "slope", x: 82, y: 30, w: 76, h: 46 }],
      exits: [{ id: "drain-out", x: 42, y: 752, w: 156, h: 8, to: "roadside", anchor: "drain-front" }],
      encounters: []
    },

    // ===== THE THRESHOLD (below; inside the handheld) =====
    slip: {
      id: "slip", name: "THE SLIP", w: 320, h: 360, theme: "below",
      solids: [
        ...walls(320, 360, 20, { n: [140, 180] }),
        { id: "rubble", x: 120, y: 318, w: 80, h: 22, kind: "rubble" },
        { id: "slip-pipe", x: 250, y: 120, w: 16, h: 70, kind: "pipe" }
      ],
      anchors: { landing: { x: 160, y: 290 }, "slip-north": { x: 160, y: 50 } },
      entryAnchor: "landing",
      homeSign: { x: 160, y: 30 },
      props: [
        { id: "rubble-look", kind: "inspect", x: 160, y: 312, r: 10, prompt: "LOOK", lines: ["The way down filled in behind him.", "Up is the only way left."] },
        { id: "home-sign", kind: "inspect", x: 160, y: 40, r: 8, prompt: "LOOK", lines: ["Someone scratched it with a key: HOME, and an arrow. Up."] }
      ],
      zones: [],
      exits: [{ id: "slip-to-clatter", x: 140, y: 0, w: 40, h: 12, to: "clatter", anchor: "clatter-entry" }],
      encounters: []
    },
    clatter: {
      id: "clatter", name: "CLATTER PASSAGE", w: 336, h: 432, theme: "below",
      solids: [
        { id: "wall-n-west", x: 0, y: 0, w: 236, h: 20, kind: "wall" },
        { id: "wall-n-east", x: 276, y: 0, w: 60, h: 20, kind: "wall" },
        { id: "wall-s-w", x: 0, y: 412, w: 34, h: 20, kind: "wall" },
        { id: "wall-s-e", x: 70, y: 412, w: 266, h: 20, kind: "wall" },
        { id: "wall-w", x: 0, y: 0, w: 20, h: 432, kind: "wall" },
        { id: "wall-e", x: 316, y: 0, w: 20, h: 432, kind: "wall" },
        { id: "crates", x: 60, y: 150, w: 44, h: 34, kind: "crate" },
        { id: "pipe", x: 232, y: 236, w: 16, h: 66, kind: "pipe" },
        { id: "shelf", x: 150, y: 60, w: 72, h: 18, kind: "shelf" }
      ],
      anchors: { "clatter-entry": { x: 52, y: 388 }, "clatter-north": { x: 256, y: 46 } },
      entryAnchor: "clatter-entry",
      props: [
        { id: "ticket-stub", kind: "inspect", x: 290, y: 382, r: 6, prompt: "LOOK", lines: ["A ticket stub, punched twice.", "The name on it has been rubbed away."] },
        { id: "card-clatter", kind: "inspect", x: 290, y: 36, r: 7, prompt: "LOOK", lines: ["A black card, wedged in the doorframe. No words. A jar, with a light shut inside.", "The same mark as the phone. Down here too."] }
      ],
      // The collector's lamp passes the north door; these stay dark.
      hides: [{ id: "crate-lee", x: 50, y: 184, w: 64, h: 28 }, { id: "pipe-lee", x: 212, y: 230, w: 20, h: 78 }, { id: "shelf-lee", x: 146, y: 78, w: 80, h: 20 }, { id: "west-dark", x: 20, y: 200, w: 26, h: 200 }],
      zones: [{ id: "clatter-mid", x: 20, y: 200, w: 296, h: 60 }],
      exits: [
        { id: "clatter-to-slip", x: 34, y: 422, w: 36, h: 10, to: "slip", anchor: "slip-north" },
        { id: "clatter-to-hem", x: 236, y: 0, w: 40, h: 12, to: "hem", anchor: "hem-entry" }
      ],
      encounters: [{ id: "clatter-draftling", kind: "draftling", x: 176, y: 176 }]
    },
    hem: {
      id: "hem", name: "THE HEM ROOM", w: 320, h: 420, theme: "below",
      solids: [
        ...walls(320, 420, 20, { n: [140, 180], s: [140, 180], e: [96, 136] }),
        { id: "gate-w", x: 20, y: 196, w: 120, h: 16, kind: "gate", openWhen: "latchFreed" },
        { id: "gate-mid", x: 140, y: 196, w: 40, h: 16, kind: "gatelatch", openWhen: "latchFreed" },
        { id: "gate-e", x: 180, y: 196, w: 120, h: 16, kind: "gate", openWhen: "latchFreed" },
        { id: "hem-crate", x: 236, y: 300, w: 36, h: 30, kind: "crate" }
      ],
      anchors: { "hem-entry": { x: 160, y: 380 }, "hem-north": { x: 160, y: 46 }, "hem-east": { x: 280, y: 116 }, "latch-trapped": { x: 186, y: 228 } },
      entryAnchor: "hem-entry",
      props: [
        { id: "latch-jam", kind: "warm", x: 150, y: 218, r: 8, prompt: "WARM", when: { latchFreed: false } },
        { id: "latch", kind: "npc", x: 190, y: 232, r: 8, prompt: "LOOK", when: { latchFreed: false } }
      ],
      zones: [{ id: "latch-approach", x: 40, y: 212, w: 240, h: 120 }],
      exits: [
        { id: "hem-to-clatter", x: 140, y: 408, w: 40, h: 12, to: "clatter", anchor: "clatter-north" },
        { id: "hem-to-queue", x: 140, y: 0, w: 40, h: 12, to: "queue", anchor: "queue-entry" },
        { id: "hem-to-hearth", x: 308, y: 96, w: 12, h: 40, to: "hearth", anchor: "hearth-west" }
      ],
      encounters: []
    },
    hearth: {
      id: "hearth", name: "THE SHARED HEARTH", w: 320, h: 340, theme: "hearth",
      solids: [
        ...walls(320, 340, 20, { w: [150, 190], n: [250, 290] }),
        { id: "shortcut-door", x: 250, y: 0, w: 40, h: 20, kind: "door", openWhen: "shortcutOpen" },
        { id: "hearth-shelf", x: 40, y: 40, w: 70, h: 16, kind: "shelf" }
      ],
      anchors: { "hearth-west": { x: 44, y: 170 }, "hearth-side": { x: 200, y: 200 }, "hearth-seat": { x: 156, y: 200 }, "hearth-latch": { x: 130, y: 196 }, "hearth-shortcut": { x: 270, y: 50 } },
      entryAnchor: "hearth-west",
      hearth: { id: "threshold-hearth", x: 172, y: 168, r: 10, spawnAnchorId: "hearth-side" },
      seat: { x: 118, y: 204, w: 52, h: 10 },
      props: [
        { id: "cold-bowl", kind: "bowl", x: 264, y: 288, r: 7, prompt: "LOOK" },
        { id: "latch-hearth", kind: "npc", x: 130, y: 196, r: 8, prompt: "LOOK", when: { latchFreed: true, porterHelp: false } },
        { id: "shortcut-look", kind: "door", x: 270, y: 26, r: 10, prompt: "LOOK", lines: ["Locked from the other side."], when: { shortcutOpen: false } }
      ],
      zones: [{ id: "hearth-arrival", x: 60, y: 110, w: 240, h: 200 }],
      exits: [
        { id: "hearth-to-hem", x: 0, y: 150, w: 12, h: 40, to: "hem", anchor: "hem-east" },
        { id: "hearth-to-queue", x: 250, y: 0, w: 40, h: 10, to: "queue", anchor: "queue-shortcut", openWhen: "shortcutOpen" }
      ],
      encounters: []
    },
    queue: {
      id: "queue", name: "THE COLD QUEUE", w: 320, h: 440, theme: "below",
      solids: [
        ...walls(320, 440, 20, { n: [140, 180], s: [140, 180], w: [330, 370] }),
        { id: "shortcut-gate", x: 0, y: 330, w: 20, h: 40, kind: "door", openWhen: "shortcutOpen" },
        { id: "post-a", x: 96, y: 176, w: 24, h: 24, kind: "post" },
        { id: "post-b", x: 204, y: 246, w: 24, h: 24, kind: "post" },
        { id: "post-c", x: 104, y: 296, w: 24, h: 24, kind: "post" }
      ],
      anchors: { "queue-entry": { x: 160, y: 400 }, "queue-north": { x: 160, y: 48 }, "queue-shortcut": { x: 44, y: 350 } },
      entryAnchor: "queue-entry",
      props: [
        { id: "queue-lever", kind: "lever", x: 36, y: 300, r: 8, prompt: "PULL", when: { shortcutOpen: false } },
        { id: "queue-lever-done", kind: "inspect", x: 36, y: 300, r: 8, prompt: "LOOK", lines: ["The lever stays down. The way to the hearth stays open."], when: { shortcutOpen: true } },
        { id: "card-queue", kind: "inspect", x: 228, y: 278, r: 7, prompt: "LOOK", lines: ["Every post had a lamp hook once. The hooks are empty.", "On this one, a black card. The jar mark."] }
      ],
      // Dark corners the lamp doesn't reach, besides the posts' own shadow.
      hides: [{ id: "nw-dark", x: 20, y: 20, w: 34, h: 70 }, { id: "ne-dark", x: 266, y: 20, w: 34, h: 70 }],
      zones: [{ id: "queue-north", x: 120, y: 12, w: 80, h: 40 }],
      exits: [
        { id: "queue-to-hem", x: 140, y: 428, w: 40, h: 12, to: "hem", anchor: "hem-north" },
        { id: "queue-to-porter", x: 140, y: 0, w: 40, h: 12, to: "porter", anchor: "porter-entry" },
        { id: "queue-to-hearth", x: 0, y: 330, w: 10, h: 40, to: "hearth", anchor: "hearth-shortcut", openWhen: "shortcutOpen" }
      ],
      // v0.4: the Cold Queue is where the hunt becomes real. Nothing to fight:
      // a collector walks the old queue line, lamp first, and the ticket posts
      // throw the only shadow. (Its Draftling and Needle moved on; the Needle
      // now holds the Low Run.)
      encounters: [{ id: "queue-collector", kind: "collector", x: 56, y: 224, patrol: [[56, 224], [270, 224], [270, 140], [56, 140]] }]
    },
    porter: {
      id: "porter", name: "THE NIGHT PORTER", w: 336, h: 260, theme: "porter",
      solids: [
        { id: "porter-n-w", x: 0, y: 0, w: 160, h: 16, kind: "wall" },
        { id: "porter-n-e", x: 200, y: 0, w: 136, h: 16, kind: "wall" },
        { id: "porter-home-door", x: 160, y: 0, w: 40, h: 16, kind: "homedoor", openWhen: "porterDown" },
        { id: "porter-s-w", x: 0, y: 244, w: 160, h: 16, kind: "wall" },
        { id: "porter-s-e", x: 200, y: 244, w: 136, h: 16, kind: "wall" },
        { id: "porter-e", x: 320, y: 0, w: 16, h: 260, kind: "wall" },
        { id: "porter-w-n", x: 0, y: 0, w: 40, h: 120, kind: "wall" },
        { id: "porter-w-s", x: 0, y: 164, w: 40, h: 96, kind: "wall" },
        { id: "porter-niche-back", x: 0, y: 120, w: 10, h: 44, kind: "wall" },
        { id: "porter-hatch", x: 10, y: 120, w: 30, h: 44, kind: "hatch", openWhen: "alcoveOpen" }
      ],
      anchors: { "porter-entry": { x: 180, y: 226 }, "porter-home": { x: 180, y: 78 }, "porter-hatch": { x: 22, y: 134 } },
      entryAnchor: "porter-entry",
      arena: { x: 40, y: 40, w: 280, h: 192 },
      alcove: { x: 10, y: 120, w: 30, h: 44 },
      props: [],
      zones: [{ id: "porter-start", x: 40, y: 16, w: 280, h: 196 }],
      exits: [
        { id: "porter-to-queue", x: 160, y: 250, w: 40, h: 10, to: "queue", anchor: "queue-north" },
        // The campaign edition goes on: the Porter's door opens into the Mending Rows' receiving floor.
        { id: "porter-to-rows", x: 160, y: 0, w: 40, h: 8, to: "receiving", anchor: "receiving-entry", openWhen: "porterDown" }
      ],
      encounters: [{ id: "night-porter", kind: "porter", x: 180, y: 78, durable: true }]
    },

    // ===== CHAPTER 1 — MENDING ROWS (condensed from v0.2 §6) =====
    // A service floor where garments and loads are mended. Nell keeps the
    // work going; the dry route up runs through it.
    receiving: {
      id: "receiving", name: "RECEIVING", w: 320, h: 260, theme: "below",
      solids: [
        ...wallSet(320, 260, 20, { s: [[140, 180]], e: [[100, 140]] }),
        { id: "ledge", x: 110, y: 20, w: 150, h: 30, kind: "ledge" },
        { id: "recv-crate", x: 30, y: 30, w: 40, h: 30, kind: "crate" },
        // The load, frozen to the ledge by their cold, hangs across the way to the table.
        { id: "recv-load", x: 284, y: 96, w: 16, h: 48, kind: "frozen-load", openWhen: "rowsLedge" }
      ],
      anchors: { "receiving-entry": { x: 160, y: 222 }, "receiving-east": { x: 278, y: 120 } },
      entryAnchor: "receiving-entry",
      props: [
        { id: "packet", kind: "inspect", x: 186, y: 58, r: 7, prompt: "LOOK", lines: ["Latch's notice, wet at one corner: COLLECTORS ON THE ROWS. KEEP LIGHTS LOW.", "Stamped at the bottom: the jar mark."] },
        { id: "ledge-catch", kind: "warm", x: 236, y: 58, r: 7, prompt: "WARM", when: { rowsLedge: false, ledgeReady: true } }
      ],
      zones: [{ id: "receiving-near", x: 20, y: 60, w: 280, h: 120 }],
      exits: [
        { id: "receiving-to-porter", x: 140, y: 250, w: 40, h: 10, to: "porter", anchor: "porter-home" },
        { id: "receiving-to-table", x: 308, y: 100, w: 12, h: 40, to: "drytable", anchor: "drytable-west" }
      ],
      encounters: []
    },
    drytable: {
      id: "drytable", name: "THE DRY TABLE", w: 320, h: 340, theme: "below",
      solids: [
        ...wallSet(320, 340, 20, { n: [[60, 100], [240, 280]], w: [[150, 190]], e: [[60, 100], [230, 270]] }),
        { id: "rows-door", x: 60, y: 0, w: 40, h: 20, kind: "door", openWhen: "rowsCatch" },
        { id: "drying-load", x: 240, y: 0, w: 40, h: 24, kind: "load", openWhen: "rowsOnward" },
        { id: "stair-catch", x: 300, y: 60, w: 20, h: 40, kind: "door", openWhen: "rowsStair" },
        { id: "bench", x: 120, y: 120, w: 100, h: 44, kind: "bench" }
      ],
      anchors: { "drytable-west": { x: 40, y: 170 }, "drytable-north": { x: 80, y: 46 }, "drytable-stove": { x: 240, y: 214 }, "drytable-east": { x: 280, y: 250 }, "drytable-stair": { x: 276, y: 80 }, "drytable-onward": { x: 260, y: 48 } },
      entryAnchor: "drytable-west",
      // The table's stove: a dry place to come back to (a checkpoint like the Shared Hearth).
      hearth: { id: "rows-stove", x: 262, y: 176, r: 10, spawnAnchorId: "drytable-stove", banner: "A DRY PLACE TO COME BACK TO" },
      props: [
        { id: "route-card", kind: "inspect", x: 150, y: 30, r: 8, prompt: "LOOK", lines: ["A route card, pinned crooked. The dry way goes up through the rows: north door, low route east, the press, then the stair back here.", "Somebody chalked a jar on it and crossed it out hard."] },
        { id: "drying-load-look", kind: "door", x: 260, y: 32, r: 10, prompt: "LOOK", lines: ["Wet sheets hung right across the doorway. Somebody will have to move them."], when: { rowsOnward: false } },
        { id: "work-catch", kind: "warm", x: 200, y: 172, r: 7, prompt: "WARM", when: { rowsCatch: false, catchReady: true } },
        { id: "low-board", kind: "warm", x: 150, y: 174, r: 8, prompt: "WARM", when: { boardReady: true } },
        { id: "chalk", kind: "inspect", x: 196, y: 172, r: 6, prompt: "LOOK", lines: [], when: { chalkOut: true } },
        { id: "second-portion", kind: "inspect", x: 110, y: 176, r: 7, prompt: "LOOK", lines: ["Two portions on the carrier. Nobody takes the second."], when: { mealOut: true } },
        { id: "wrap-peg", kind: "inspect", x: 40, y: 290, r: 8, prompt: "LOOK", lines: ["The wrap, on the low peg. Dry."], when: { wrapOnPeg: true } }
      ],
      zones: [{ id: "route-pull", x: 120, y: 20, w: 180, h: 60 }],
      exits: [
        { id: "table-to-receiving", x: 0, y: 150, w: 12, h: 40, to: "receiving", anchor: "receiving-east" },
        { id: "table-to-rows", x: 60, y: 0, w: 40, h: 10, to: "hangrow", anchor: "hangrow-entry", openWhen: "rowsCatch" },
        { id: "table-to-window", x: 240, y: 0, w: 40, h: 10, to: "windowgate", anchor: "gate-entry", openWhen: "rowsOnward" },
        { id: "table-to-stair", x: 308, y: 60, w: 12, h: 40, to: "stair", anchor: "stair-bottom", openWhen: "rowsStair" },
        { id: "table-to-tray", x: 308, y: 230, w: 12, h: 40, to: "traypass", anchor: "tray-west" }
      ],
      encounters: []
    },
    hangrow: {
      id: "hangrow", name: "HANGING ROW", w: 320, h: 460, theme: "below",
      solids: [
        ...wallSet(320, 460, 20, { s: [[60, 100]], e: [[40, 80]] }),
        { id: "low-hatch", x: 300, y: 40, w: 20, h: 40, kind: "hatch", openWhen: "rowsLowRoute" },
        { id: "balcony", x: 20, y: 20, w: 50, h: 34, kind: "balcony" },
        { id: "frame-a", x: 130, y: 330, w: 70, h: 8, kind: "frame" },
        { id: "frame-b", x: 200, y: 230, w: 80, h: 8, kind: "frame" },
        { id: "frame-c", x: 40, y: 200, w: 70, h: 8, kind: "frame" },
        { id: "frame-d", x: 150, y: 130, w: 60, h: 8, kind: "frame" }
      ],
      anchors: { "hangrow-entry": { x: 80, y: 430 }, "hangrow-east": { x: 282, y: 60 } },
      entryAnchor: "hangrow-entry",
      props: [
        { id: "low-catch", kind: "warm", x: 278, y: 92, r: 7, prompt: "WARM", when: { rowsLowRoute: false, lowReady: true } },
        { id: "sheets", kind: "inspect", x: 230, y: 380, r: 9, prompt: "LOOK", lines: ["Sheets drying in rows. Somebody counted them; the chalk tally is on the post."] }
      ],
      zones: [{ id: "split", x: 190, y: 20, w: 110, h: 100 }, { id: "row-north", x: 20, y: 20, w: 280, h: 150 }],
      exits: [
        { id: "rows-to-table", x: 60, y: 450, w: 40, h: 10, to: "drytable", anchor: "drytable-north" },
        { id: "rows-to-lowrun", x: 308, y: 40, w: 12, h: 40, to: "lowrun", anchor: "lowrun-west", openWhen: "rowsLowRoute" }
      ],
      // Shadow under the hanging sheets: the lamp passes over it.
      hides: [{ id: "sheet-a", x: 130, y: 338, w: 70, h: 22 }, { id: "sheet-b", x: 200, y: 238, w: 80, h: 22 }, { id: "sheet-c", x: 40, y: 208, w: 70, h: 22 }, { id: "sheet-d", x: 150, y: 138, w: 60, h: 22 }, { id: "west-row", x: 20, y: 240, w: 28, h: 120 }],
      encounters: [{ id: "row-collector", kind: "collector", x: 290, y: 280, patrol: [[290, 280], [120, 280], [120, 180], [290, 180]] }]
    },
    lowrun: {
      id: "lowrun", name: "THE LOW RUN", w: 320, h: 240, theme: "below",
      solids: [
        ...wallSet(320, 240, 20, { w: [[40, 80]], e: [[170, 210]] }),
        { id: "block-a", x: 90, y: 20, w: 30, h: 110, kind: "block" },
        { id: "block-b", x: 170, y: 110, w: 30, h: 110, kind: "block" },
        { id: "block-c", x: 250, y: 20, w: 26, h: 112, kind: "block" }
      ],
      anchors: { "lowrun-west": { x: 36, y: 60 }, "lowrun-east": { x: 284, y: 190 } },
      entryAnchor: "lowrun-west",
      props: [{ id: "warm-pipe", kind: "inspect", x: 140, y: 214, r: 8, prompt: "LOOK", lines: ["A pipe under the boards, warm all the way along. Somebody keeps a fire going."] }],
      zones: [],
      exits: [
        { id: "lowrun-to-rows", x: 0, y: 40, w: 12, h: 40, to: "hangrow", anchor: "hangrow-east" },
        { id: "lowrun-to-eyelet", x: 308, y: 170, w: 12, h: 40, to: "eyelet", anchor: "eyelet-low" }
      ],
      encounters: [{ id: "low-needle", kind: "needle", x: 220, y: 200 }]
    },
    eyelet: {
      id: "eyelet", name: "EYELET LANDING", w: 320, h: 280, theme: "below",
      solids: [
        ...wallSet(320, 280, 20, { w: [[60, 100], [210, 250]], n: [[140, 180]] }),
        { id: "grille", x: 0, y: 60, w: 20, h: 40, kind: "grille", openWhen: "rowsGrille" },
        { id: "press-door", x: 140, y: 0, w: 40, h: 20, kind: "door", openWhen: "rowsPressOpen" },
        // A channel between the low exit and the landing; the short board crosses it.
        { id: "channel-w", x: 20, y: 170, w: 38, h: 26, kind: "channel" },
        { id: "channel-e", x: 94, y: 170, w: 206, h: 26, kind: "channel" }
      ],
      anchors: { "eyelet-low": { x: 36, y: 230 }, "eyelet-west": { x: 36, y: 80 }, "eyelet-north": { x: 160, y: 40 } },
      entryAnchor: "eyelet-low",
      props: [
        { id: "eyelet-plate", kind: "inspect", x: 112, y: 152, r: 7, prompt: "LOOK", lines: ["A square eyelet plate. Its edge is worn bright where cloth catches."] },
        { id: "grille-catch", kind: "warm", x: 36, y: 116, r: 7, prompt: "WARM", when: { rowsGrille: false, grilleReady: true } }
      ],
      zones: [{ id: "eyelet-landing", x: 20, y: 20, w: 280, h: 146 }],
      exits: [
        { id: "eyelet-to-lowrun", x: 0, y: 210, w: 12, h: 40, to: "lowrun", anchor: "lowrun-east" },
        { id: "eyelet-to-tray", x: 0, y: 60, w: 10, h: 40, to: "traypass", anchor: "tray-east", openWhen: "rowsGrille" },
        { id: "eyelet-to-press", x: 140, y: 0, w: 40, h: 10, to: "press", anchor: "press-entry", openWhen: "rowsPressOpen" }
      ],
      encounters: []
    },
    traypass: {
      id: "traypass", name: "TRAY PASSAGE", w: 320, h: 200, theme: "below",
      solids: [
        ...wallSet(320, 200, 20, { w: [[80, 120]], e: [[80, 120]] }),
        { id: "tray-grille", x: 300, y: 80, w: 20, h: 40, kind: "grille", openWhen: "rowsGrille" },
        { id: "tray-shelf", x: 60, y: 20, w: 200, h: 26, kind: "shelf" }
      ],
      anchors: { "tray-west": { x: 40, y: 100 }, "tray-east": { x: 280, y: 100 } },
      entryAnchor: "tray-west",
      props: [{ id: "bent-wheel", kind: "inspect", x: 220, y: 150, r: 7, prompt: "LOOK", lines: ["A tray wheel, bent. Somebody has been carrying this the hard way."] }],
      zones: [],
      exits: [
        { id: "tray-to-table", x: 0, y: 80, w: 12, h: 40, to: "drytable", anchor: "drytable-east" },
        { id: "tray-to-eyelet", x: 308, y: 80, w: 12, h: 40, to: "eyelet", anchor: "eyelet-west", openWhen: "rowsGrille" }
      ],
      encounters: []
    },
    press: {
      id: "press", name: "PRESS HOUSE", w: 320, h: 480, theme: "below",
      solids: [
        ...wallSet(320, 480, 20, { s: [[140, 180]], n: [[140, 180]] }),
        { id: "shutter", x: 140, y: 0, w: 40, h: 22, kind: "shutter", openWhen: "rowsShutter" },
        // The drying recess in the west wall (open in front, never latched) and the east cover.
        { id: "recess-n", x: 20, y: 290, w: 44, h: 10, kind: "wall" },
        { id: "recess-s", x: 20, y: 342, w: 44, h: 10, kind: "wall" },
        { id: "east-cover", x: 236, y: 300, w: 44, h: 24, kind: "crate" },
        { id: "frame-post", x: 290, y: 236, w: 10, h: 36, kind: "post" }
      ],
      anchors: { "press-entry": { x: 160, y: 446 }, "press-north": { x: 160, y: 44 } },
      entryAnchor: "press-entry",
      // The carriage's worn track: an empty job, back and forth across the room.
      track: { y: 250, x0: 46, x1: 274, half: 16 },
      props: [
        { id: "brake-release", kind: "warm", x: 284, y: 210, r: 7, prompt: "WARM", when: { rowsPressStop: true, rowsBrake: false, brakeReady: true } },
        { id: "shutter-release", kind: "warm", x: 196, y: 40, r: 7, prompt: "WARM", when: { rowsBrake: true, rowsShutter: false, shutterReady: true } },
        { id: "low-release", kind: "inspect", x: 42, y: 330, r: 6, prompt: "LOOK", lines: ["A low release lever by the recess. It opens from outside."] },
        { id: "work-card", kind: "inspect", x: 100, y: 34, r: 7, prompt: "LOOK", lines: ["A procedure card: brake, stop, test, then the shutter. Somebody wrote 'TEST TWICE' and crossed out 'TWICE'."] }
      ],
      zones: [{ id: "press-screen", x: 20, y: 300, w: 280, h: 160 }, { id: "press-lane", x: 20, y: 200, w: 280, h: 100 }, { id: "press-north", x: 20, y: 20, w: 280, h: 170 }],
      exits: [
        { id: "press-to-eyelet", x: 140, y: 470, w: 40, h: 10, to: "eyelet", anchor: "eyelet-north" },
        { id: "press-to-upper", x: 140, y: 0, w: 40, h: 10, to: "upper", anchor: "upper-entry", openWhen: "rowsShutter" }
      ],
      encounters: [{ id: "press-needle", kind: "needle", x: 70, y: 110 }]
    },
    upper: {
      id: "upper", name: "UPPER LANDING", w: 320, h: 240, theme: "below",
      solids: [
        ...wallSet(320, 240, 20, { s: [[140, 180]], w: [[100, 140]] }),
        { id: "upper-catch", x: 0, y: 100, w: 20, h: 40, kind: "door", openWhen: "rowsStair" }
      ],
      anchors: { "upper-entry": { x: 160, y: 210 }, "upper-west": { x: 40, y: 120 } },
      entryAnchor: "upper-entry",
      props: [
        { id: "service-window", kind: "inspect", x: 290, y: 110, r: 9, prompt: "LOOK", lines: ["Through the high window: a long hall of service windows. Most are lit. A few say CLOSED.", "Far down the hall, a cold white lamp goes from window to window."] },
        { id: "scratched-arrow", kind: "inspect", x: 288, y: 158, r: 6, prompt: "LOOK", lines: ["Another arrow, scratched into the sill with a key. Up."] },
        { id: "upper-card", kind: "inspect", x: 90, y: 30, r: 7, prompt: "LOOK", lines: ["A route card. Its arrow goes down the stair, past the table, through the doorway the sheets were hiding."] }
      ],
      zones: [],
      exits: [
        { id: "upper-to-press", x: 140, y: 230, w: 40, h: 10, to: "press", anchor: "press-north" },
        { id: "upper-to-stair", x: 0, y: 100, w: 10, h: 40, to: "stair", anchor: "stair-top", openWhen: "rowsStair" }
      ],
      encounters: []
    },
    stair: {
      id: "stair", name: "RETURN STAIR", w: 240, h: 320, theme: "below",
      solids: [
        ...wallSet(240, 320, 20, { e: [[30, 70]], w: [[260, 300]] }),
        { id: "landing-a", x: 20, y: 104, w: 150, h: 14, kind: "rail" },
        { id: "landing-b", x: 70, y: 196, w: 150, h: 14, kind: "rail" }
      ],
      anchors: { "stair-top": { x: 204, y: 50 }, "stair-bottom": { x: 36, y: 280 } },
      entryAnchor: "stair-top",
      props: [{ id: "meal-mark", kind: "inspect", x: 120, y: 160, r: 7, prompt: "LOOK", lines: ["A chalk mark on the step: a bowl, and an arrow toward the table."] }],
      zones: [],
      exits: [
        { id: "stair-to-upper", x: 228, y: 30, w: 12, h: 40, to: "upper", anchor: "upper-west" },
        { id: "stair-to-table", x: 0, y: 260, w: 12, h: 40, to: "drytable", anchor: "drytable-stair" }
      ],
      encounters: []
    },
    windowgate: {
      id: "windowgate", name: "WINDOW HALL", w: 320, h: 300, theme: "below",
      solids: [
        ...wallSet(320, 300, 20, { s: [[140, 180]] }),
        { id: "counter", x: 100, y: 20, w: 120, h: 34, kind: "counter" },
        { id: "gate-bench", x: 30, y: 130, w: 54, h: 14, kind: "bench" }
      ],
      anchors: { "gate-entry": { x: 160, y: 270 } },
      entryAnchor: "gate-entry",
      props: [
        { id: "closed-window", kind: "inspect", x: 160, y: 62, r: 9, prompt: "LOOK", lines: ["CLOSED. Under it, in older writing: BACK SOON."] },
        { id: "far-windows", kind: "inspect", x: 284, y: 120, r: 8, prompt: "LOOK", lines: ["The hall goes on past this window. More counters, more lamps, all the way along."] }
      ],
      zones: [{ id: "gate-window", x: 90, y: 54, w: 140, h: 70 }],
      exits: [{ id: "gate-to-table", x: 140, y: 290, w: 40, h: 10, to: "drytable", anchor: "drytable-onward" }],
      encounters: []
    }
  };

  const ENEMIES = {
    draftling: { hp: 4, radius: 8, detect: 88, windupMs: 850, lockAtMs: 520, lungeMs: 240, lungeDistance: 48, recoverMs: 700, homeDrift: 6 },
    needle: { hp: 4, radius: 7, detect: 150, indicateMs: 1000, pulseMs: 120, recoverMs: 1000, laneWidth: 10, laneMax: 300 },
    // The van's loose cooler: a readable slide that bumps, never burns.
    cargo: { hp: 1, radius: 9, windupMs: 900, slideMs: 320, slideDistance: 150 },
    // The Boss's collectors (v0.4): a cold lamp on a patrol. They cannot be hurt;
    // they can only be avoided. Seen long enough (spotMs) means caught.
    collector: { radius: 9, speed: 24, range: 92, halfAngle: 0.46, spotMs: 1000, loseMs: 350, searchMs: 1600, pauseMs: 900, chase: 30, flareRange: 2 },
    porter: { hp: 28, radius: 18, helpAt: 14, sweepTellMs: 950, sweepMs: 350, sweepOpenMs: 900, chargeTellMs: 850, chargeMs: 400, chargeDistance: 80, chargeOpenMs: 1200, repositionMs: 450, bandHeight: 44, beamWidth: 36 }
  };

  // ===== SPEAKERS AND PORTRAITS =====
  // PORTRAITS[portraitId][expression] is an inline SVG (authored in
  // dungeon-art.js under its portrait rules) or later { src }. Lines choose
  // the expression; the renderer never decides it.
  const PORTRAITS = Art?.PORTRAITS || {};
  const SPEAKERS = {
    you: { name: "YOU", portrait: "you" },
    latch: { name: "LATCH", portrait: "latch" },
    "hood-tall": { name: "TALL HOOD", portrait: "hood-tall" },
    "hood-small": { name: "SMALL HOOD", portrait: "hood-small" },
    driver: { name: "DRIVER", portrait: "driver" },
    nell: { name: "NELL", portrait: "nell" },
    orr: { name: "ORR", portrait: "orr" },
    // v0.4: the capped hood finally gets a face; The Boss never does (his mark stands in).
    "hood-cap": { name: "CAPPED HOOD", portrait: "hood-cap" },
    boss: { name: "THE BOSS", portrait: "boss" }
  };

  // ===== LINES =====
  // { speaker, expr, text } is spoken (portrait beside it); a bare string is
  // narration (no portrait). Rizo never makes speeches: he reacts in-world.
  const L = (speaker, expr, text) => ({ speaker, expr, text });
  const LINES = {
    // The accepted line, split (v0.3 beat sheet 2.2–2.4) so "Be good." lands alone.
    // "{name}" is the pet's own name (campaign.petName), "Rizo" when there is none.
    goingIn: [L("you", "neutral", "Alright {name}, I'm gonna go in the store real quick.")],
    lightsOn: [L("you", "neutral", "There. Light's on.")],
    beGood: [L("you", "neutral", "Be good.")],
    // Parked (beat sheet 1.2): YOU answers each thing once, never twice.
    youHi: [L("you", "neutral", "Hi. Yes. Hi.")],
    youDash: [L("you", "neutral", "Off the dash, please.")],
    youShowOff: [L("you", "neutral", "Okay, show-off.")],
    youRain: [L("you", "neutral", "It's just rain.")],
    // Headlights and taken (4.4–5.4), overheard through the glass.
    twoMinutes: [L("driver", "neutral", "Two minutes.")],
    glowing: [L("hood-small", "neutral", "Bro. It's glowing."), L("hood-tall", "neutral", "Don't tap the glass.")],
    hot: [L("hood-small", "neutral", "It's hot! It's hot!")],
    bag: [L("hood-tall", "neutral", "Bag. Bag.")],
    // The roadside search (9.3–9.4).
    search: [L("hood-tall", "neutral", "It went off right here."), L("hood-small", "neutral", "It's dark as hell."), L("hood-tall", "neutral", "It's a flame. Look for the light."), L("hood-small", "neutral", "I don't see no light.")],
    seen: [L("hood-small", "neutral", "Yo— was that—")],
    leave: [L("driver", "neutral", "Car! Somebody's coming!"), L("hood-tall", "neutral", "We can't go back without it."), L("driver", "neutral", "We can't go back at all if we get pulled over."), L("hood-small", "neutral", "You said probably.")],
    thatHim: [L("hood-small", "neutral", "That him?"), L("hood-tall", "neutral", "Obviously.")],
    flinch: [L("hood-small", "neutral", "Yo—")],
    vanArgue: [L("driver", "neutral", "I thought you said he didn't do that fire shit."), L("hood-tall", "neutral", "I said probably.")],
    bump: [L("driver", "neutral", "My bad. Pothole.")],
    // The van, overheard (v0.3 beat sheet Scene 7). Rizo understands the tone,
    // not the words. v0.4: the player learns WHAT the Boss wants (every Rizo);
    // WHY stays unanswered ("What's he even want it for?" — nobody answers).
    vanTouch: [L("hood-small", "neutral", "Boss said don't touch it."), L("hood-tall", "neutral", "I'm not touching it."), L("hood-small", "neutral", "Then why you keep looking at it?"), L("hood-tall", "neutral", "'Cause it's looking at me.")],
    vanFilm: [L("hood-small", "neutral", "Say hi."), L("hood-tall", "neutral", "Put that away."), L("hood-small", "neutral", "It's for me. It's not for nobody.")],
    vanCooler: [L("hood-small", "neutral", "Why do we even got a cooler."), L("driver", "neutral", "In case."), L("hood-small", "neutral", "In case of what?"), L("driver", "neutral", "…In case.")],
    vanNumber: [L("hood-small", "neutral", "How much we getting for it?"), L("hood-tall", "neutral", "Enough."), L("hood-small", "neutral", "That's not a number."), L("driver", "neutral", "It ain't about the number. You don't say no to him."), L("hood-small", "neutral", "I'd say no."), L("driver", "neutral", "Nah. You wouldn't.")],
    // The collection, said out loud once, as a fear joke.
    vanEvery: [L("hood-small", "scared", "How many of these he even got?"), L("driver", "neutral", "All of 'em. He wants every one there is."), L("hood-small", "scared", "Every one? Like, every every?"), L("hood-tall", "scared", "Stop counting. He can hear you counting.")],
    vanCheckin: [L("driver", "neutral", "We missed the check-in."), L("hood-small", "neutral", "By what, a minute?"), L("hood-tall", "neutral", "Doesn't matter.")],
    vanAsk: [L("hood-small", "neutral", "What's he even want it for?")],
    vanPhone: [L("hood-small", "neutral", "…It's him."), L("driver", "neutral", "Don't."), L("hood-small", "neutral", "If I don't pick up—"), L("hood-tall", "neutral", "Then don't pick up.")],
    vanLost: [L("hood-small", "neutral", "You know what happened to the last dude who lost one."), L("hood-tall", "neutral", "Shut up."), L("hood-small", "neutral", "I'm just saying."), L("hood-tall", "neutral", "I said shut the f—")],
    vanListening: [L("hood-cap", "neutral", "Both of you. It's listening.")],
    // The dropped phone (scene 10), answered: the Boss, for the first time, in his own words.
    bossPhone: [L("boss", "calm", "…That isn't them."), L("boss", "calm", "Hello, little light."), L("boss", "cold", "Stay where you are. Someone will come and collect you.")],
    // A collector's radio in Clatter Passage: the Boss, directing the hunt below.
    bossRadio: [L("boss", "calm", "Anything?"), L("boss", "cold", "Then try the Queue. It wants to go up.")],
    // ===== COMICS (spoken inside the panels; see dungeon-comic.js) =====
    comicBossHands: [L("hood-tall", "scared", "Boss. Funny story. It went down a drain."), L("boss", "calm", "Then it's in the Below."), L("boss", "cold", "Send the collectors down. I want every one of them."), L("hood-small", "scared", "So… we're good?")],
    comicBossGlass: [L("collector", "neutral", "Its light went up through the Rows."), L("boss", "calm", "Then be at the window when it opens.")],
    // ===== THE THRESHOLD (v0.4: the collectors have been here) =====
    latchApproach: [L("latch", "startled", "NO OPEN FLAMES."), L("latch", "dry", "Sorry. Sign's older than the door."), L("latch", "procedural", "Collectors froze this gate on their way through. With me in it.")],
    latchJam: [L("latch", "procedural", "Latch is frozen. I'm Latch. Like the door bit. Different problem."), L("latch", "urgent", "Their cold won't let go. You're warm. Warm it?")],
    latchRescue: [L("latch", "startled", "Oh."), L("latch", "dry", "That was the useful kind of fire."), L("latch", "soft", "They take every light down here. You're the first one that gave some back."), L("latch", "procedural", "Going up? Hearth first. I owe you a route.")],
    latchRescueStranger: [L("latch", "startled", "Oh."), L("latch", "dry", "That was the useful kind of fire. I'm Latch. Like the door bit."), L("latch", "soft", "They take every light down here. You're the first one that gave some back."), L("latch", "procedural", "Going up? Hearth first. I owe you a route.")],
    // The hearth went cold when the collectors came for its fire; he brings it back by arriving.
    hearthLit: [L("latch", "soft", "Cold since they took our fire. You lit it just walking in.")],
    seatOffer: [L("latch", "procedural", "Seat's dry."), L("latch", "dry", "I checked with the wet part of me.")],
    sit: [L("latch", "soft", "You can stay. Just don't eat the chair.")],
    go: [L("latch", "dry", "Right. Officially: route inspection.")],
    beforePorter: [L("latch", "procedural", "Way up is past the Cold Queue. A collector walks it now."), L("latch", "urgent", "Stay in the dark. Posts block his lamp. If it finds you, run back here."), L("latch", "procedural", "Then the Night Porter. He checks every ticket."), L("latch", "soft", "Nobody here has one.")],
    latchHearthIdle: [L("latch", "soft", "Fire's good. The Queue's north. Stay out of the lamp.")],
    bowl: ["A bowl. A familiar shape. Cold ash.", "Under it, a black card. The jar mark."],
    // Caught in a lamp: Latch pulled him back to the hearth. Try again.
    latchCaught: [L("latch", "urgent", "Got you. Their lamp had you. Use the posts, and wait for his back.")],
    help: [L("latch", "urgent", "Here. I found a door that still does doors."), L("latch", "urgent", "He thinks you're one of their lamps. Hide in here!")],
    // After the Porter settles: why he stopped, before the knot.
    porterSettled: [L("latch", "soft", "He's settled. He saw your light is warm. Theirs never is.")],
    gift: [L("latch", "soft", "Keeps the draft off."), L("latch", "dry", "Don't get it cleaned. That's my best knot.")],
    departure: [L("latch", "soft", "Go on."), L("latch", "soft", "Something upstairs is waiting for you.")],
    // ===== MENDING ROWS (v0.4: the collectors are coming through the Rows) =====
    // Receiving: Latch delivers a warning; the load is frozen to the ledge.
    rowsLatchHello: [L("latch", "procedural", "You're through. Good. I'm mid-delivery.")],
    rowsLatchHelloSat: [L("latch", "soft", "You're through. The chair survived, by the way.")],
    rowsDispute: [L("latch", "procedural", "Notice for the Rows, Nell. Collectors tonight."), L("nell", "irritated", "Again? They froze my ledge last time."), L("latch", "dry", "Delivered. Not my fault. Noted, though.")],
    rowsMend: [L("nell", "work", "Load's frozen to the ledge. Their cold. I can't reach the catch.")],
    rowsDry: [L("nell", "work", "This bit's dry.")],
    rowsGoingUp: [L("latch", "procedural", "Nell. He's going up. Home's up there."), L("nell", "listening", "Then he goes through my rows. The dry way's the only way up.")],
    rowsLedgeHelp: [L("nell", "work", "Thanks. Now it lowers."), L("latch", "dry", "That counts as assistance. I'll note it.")],
    rowsLedgeSelf: [L("nell", "tired", "Got it. Took me three tries.")],
    rowsLatchGoes: [L("latch", "procedural", "Next stop. Nell mends what they break. Stick with her.")],
    // The Dry Table: where she works; the dry way up starts here.
    rowsWarmRoom: [L("nell", "work", "Warm room's here.")],
    rowsFurtherUp: [L("nell", "listening", "Oh. Further up. Home's up, is it?"), L("nell", "work", "Dry way's through the rows. Collectors froze the catch.")],
    rowsCorner: [L("nell", "measuring", "That corner's taking bites. Hold on.")],
    rowsCatchAsk: [L("nell", "work", "They froze it low. Warm the catch. I've got the weight.")],
    rowsHolds: [L("nell", "work", "Holds.")],
    rowsLamp: [L("nell", "work", "Lamp. Get behind the sheets.")],
    rowsLampPast: [L("nell", "work", "He's gone by. Good. Over here.")],
    rowsLowAsk: [L("nell", "work", "Low catch again. I'll hold the bar.")],
    rowsEyeletPromise: [L("nell", "work", "Low route's yours. Meet me at Eyelet Landing.")],
    // Eyelet: somebody at the other end.
    rowsThereYouAre: [L("nell", "work", "There you are."), L("nell", "work", "Orr's due with food. Go easy on him. They took his partner.")],
    rowsHatch: [L("orr", "irritated", "That hatch was built for one portion. I carry two."), L("nell", "work", "Grille's got a low catch. He can reach it.")],
    rowsTable: [L("orr", "serving", "Table, then. Food wants sitting down.")],
    // The meal: Nell loses a small argument; Orr says who the second portion is for.
    rowsMeal: [L("nell", "irritated", "Not on the cleared bit."), L("orr", "serving", "It's food. It wants the reachable bit."), L("nell", "work", "I just cleared it."), L("orr", "irritated", "Then move the chalk."), L("nell", "work", "Fine."), L("orr", "dry", "Second portion's Eda's. Collectors took her."), L("orr", "serving", "Nobody they're hunting eats standing up. Sit, if you like.")],
    rowsCrunchy: [L("nell", "amused", "Where's the other crunchy edge?"), L("orr", "dry", "On what you just ate.")],
    rowsPressNext: [L("nell", "work", "Press house next. They left it running so nobody gets up.")],
    rowsTakeEdge: [L("orr", "serving", "Take the edge at least.")],
    // Press House: stop what they left running.
    rowsWaitItOut: [L("nell", "work", "Carriage. Wait it out.")],
    rowsClear: [L("nell", "work", "Clear.")],
    rowsEmptyJob: [L("nell", "work", "It's running an empty job. Something's pulling it.")],
    rowsGotStop: [L("nell", "work", "Got the stop.")],
    rowsBrakeAsk: [L("nell", "work", "Brake's low on your side. Warm it. I'll change the stop.")],
    rowsTest: [L("nell", "work", "One test. Stay off the track.")],
    rowsParked: [L("nell", "work", "Parked.")],
    rowsShutterAsk: [L("nell", "work", "Shutter catch. Warm it, then go under. I'll lift.")],
    rowsUnder: [L("nell", "work", "Go on. I'm right behind.")],
    // Upper landing: the table appointment.
    rowsStairHere: [L("nell", "work", "Stair's here. It comes out by the table.")],
    rowsAtTheTable: [L("nell", "work", "I'll be at the table.")],
    // The table remembers your height.
    rowsSameEnd: [L("nell", "work", "Same end?"), L("nell", "work", "That edge. I've got the heavy bit.")],
    rowsChalk: [L("nell", "tired", "Where's my chalk?")],
    rowsChalkFound: [L("nell", "amused", "Ah. I was keeping it warm.")],
    rowsWrapOffer: [L("nell", "work", "Next hall's draughty. This keeps it off your back."), L("nell", "measuring", "Wear it, or take it folded.")],
    rowsWrapWorn: [L("nell", "work", "Hold still. Strap's twisting."), L("nell", "amused", "Ugly seam. Good seam.")],
    rowsWrapFolded: [L("nell", "work", "Clasp on top. Easier to find.")],
    rowsWrapPeg: [L("nell", "work", "Low peg. It'll stay dry.")],
    rowsOnward: [L("nell", "work", "Window Hall's through there. The way up goes past its counter.")],
    // Window Hall: the staffed side of CLOSED.
    rowsClosed: [L("nell", "tired", "Closed. They'll open.")],
    rowsStayNear: [L("nell", "work", "Stay where I can see you. They call in order.")],
    rowsLatchAgainHelped: [L("latch", "procedural", "Notice delivered. Your catch held."), L("latch", "soft", "I've got the next window. Sit. It's allowed.")],
    rowsLatchAgain: [L("latch", "dry", "You two opened the rows. It shows."), L("latch", "soft", "I've got the next window. Sit. It's allowed.")],
    rested: "WARM AGAIN",
    hearthKnows: "THE HEARTH KNOWS YOU NOW",
    firstDown: "THE FLAME WENT LOW. THE HEARTH KEPT IT.",
    downNoHearth: "BACK WHERE HE LANDED",
    caught: "CAUGHT IN THE LAMP. BACK TO THE HEARTH.",
    caughtNoHearth: "CAUGHT IN THE LAMP. BACK WHERE HE LANDED.",
    shortcutOpen: "THE WAY TO THE HEARTH IS OPEN",
    homeUp: "HOME ↑"
  };
  // What Rizo is trying to do right now, shown on the HUD (see dungeon-mode.js guide()).
  const OBJECTIVES = {
    wait: "WAIT FOR YOU",
    sack: "STRUGGLE FREE",
    van: "GET OUT OF THIS VAN",
    gap: "THE BACK DOOR. PUSH THROUGH.",
    hide: "HIDE IN THE DARK",
    shelter: "GET OUT OF THE RAIN",
    deeper: "FOLLOW THE WARM AIR",
    findWay: "FIND A WAY UP",
    climb: "HOME IS UP. KEEP CLIMBING.",
    lamp: "STAY OUT OF THE LAMP. KEEP GOING UP.",
    freeLatch: "WARM THE FROZEN LATCH",
    toHearth: "FOLLOW LATCH TO THE HEARTH (EAST)",
    hearth: "WARM UP AT THE HEARTH",
    toQueue: "THE WAY UP IS NORTH, THROUGH THE COLD QUEUE",
    toQueueBack: "BACK WEST, THEN NORTH TO THE COLD QUEUE",
    toQueueShort: "NORTH DOOR: THE SHORT WAY TO THE QUEUE",
    queue: "SNEAK PAST THE COLLECTOR. HIDE BEHIND THE POSTS.",
    porter: "GET PAST THE NIGHT PORTER",
    porterDoor: "THROUGH THE PORTER'S DOOR. UP.",
    rowsStart: "THE DRY WAY UP IS THROUGH NELL'S ROWS",
    ledge: "WARM THE LEDGE CATCH FOR NELL",
    toTable: "FOLLOW NELL (EAST)",
    tableCatch: "WARM THE LOW CATCH NELL CAN'T REACH",
    toRows: "INTO THE ROWS (NORTH DOOR)",
    rowLamp: "SLIP PAST THE COLLECTOR'S LAMP",
    lowCatch: "WARM THE LOW CATCH AT THE SPLIT",
    toEyelet: "LOW ROUTE (EAST) TO EYELET LANDING",
    grille: "WARM THE GRILLE CATCH SO ORR'S TRAY FITS",
    toMeal: "BACK TO THE TABLE TO EAT (WEST)",
    meal: "EAT WITH NELL AND ORR",
    toPress: "TO THE PRESS HOUSE (EYELET, NORTH DOOR)",
    stopPress: "STOP THE RUNAWAY PRESS",
    brake: "WARM THE BRAKE BY THE TRACK",
    shutter: "WARM THE SHUTTER CATCH, THEN GO UNDER",
    toStair: "TAKE THE STAIR DOWN TO THE TABLE (WEST)",
    toNell: "MEET NELL AT THE TABLE",
    toWindow: "THROUGH THE DOORWAY TO WINDOW HALL",
    window: "WAIT AT THE WINDOW WITH NELL"
  };
  // Short acknowledgements for a committed beat whose scene was interrupted.
  const ACKS = {
    "latch-rescue": [L("latch", "procedural", "Hearth first. I'll be there.")],
    "hearth-seat": [L("latch", "soft", "Seat's still dry.")],
    "porter-help": [L("latch", "urgent", "The door's open. Use it.")],
    "knot-gift": [L("latch", "soft", "Go on. Something upstairs is waiting for you.")]
  };

  const api = {
    CONTENT_REVISION,
    LEGACY_REVISIONS,
    CARRIED_REVISIONS,
    CAMPAIGN_KIND,
    CHAPTER_ID,
    OPENING_ROOMS,
    ROOM_IDS,
    BUILT_ROOMS,
    ROOMS,
    ENEMIES,
    SPEAKERS,
    PORTRAITS,
    LINES,
    ACKS,
    OBJECTIVES,
    START_ROOM: "car",
    ROWS_ROOMS,
    BELOW_START: "slip",
    // Durable flags a campaign may hold (world.durableRoomFlags / story.facts).
    // callerConnected (v0.3): Rizo touched the ringing phone and the call
    // connected. Its consequence is deliberately undecided; it only persists.
    FLAGS: ["latchFreed", "jamInspected", "sharedRest", "seatChosen", "bowlSeen", "shortcutOpen", "porterHelp", "alcoveOpen", "porterDown", "beforePorterSaid", "hearthArrived", "callerConnected",
      // Mending Rows: work that stays done (routes), and two small remembered kindnesses.
      "rowsCatch", "rowsLowRoute", "rowsGrille", "rowsPressOpen", "rowsPressStop", "rowsBrake", "rowsShutter", "rowsStair", "rowsOnward", "rowsLatchHelped", "rowsChalk",
      // v0.4 (threshold-v4): the hearth he brought back, the collectors he got past, the ledge lowered.
      "hearthKindled", "queueCrossed", "hangrowCrossed", "rowsLedge"],
    // Durable room work lives in world.durableRoomFlags; the rest in story.facts.
    ROOM_FLAGS: ["latchFreed", "shortcutOpen", "alcoveOpen", "porterDown", "rowsCatch", "rowsLowRoute", "rowsGrille", "rowsPressOpen", "rowsPressStop", "rowsBrake", "rowsShutter", "rowsStair", "rowsOnward", "rowsLedge"],
    // Story choices and their allowed values (the save keeps nothing else).
    CHOICES: { "hearth-seat": ["sit", "go"], "rows-meal": ["sit", "go"], "rows-wrap": ["worn", "folded", "peg"] },
    // The caller's symbol is an owner/art decision. Until it exists, the phone
    // shows a neutral placeholder under this internal name, nowhere else.
    CALLER_SYMBOL: "CALLER_SYMBOL",
    knownRoom: id => BUILT_ROOMS.includes(id),
    isOpening: id => OPENING_ROOMS.includes(id),
    isRows: id => ROWS_ROOMS.includes(id),
    knownAnchor: (roomId, anchorId) => Boolean(ROOMS[roomId]?.anchors?.[anchorId]),
    knownHearth: id => Object.values(ROOMS).some(room => room.hearth?.id === id),
    knownEncounter: id => Object.values(ROOMS).some(room => room.encounters.some(item => item.id === id)),
    hearthRoom: id => Object.values(ROOMS).find(room => room.hearth?.id === id) || null
  };
  return deepFreeze(api);
});
