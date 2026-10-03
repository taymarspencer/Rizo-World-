/*
  RIZO DUNGEON — CONTENT
  ======================
  Pure, frozen data: rooms (geometry, anchors, exits, trigger zones, props,
  encounters), speakers with portrait expressions, and every line. No
  behavior lives here; dungeon-core.js reads geometry, dungeon-mode.js runs
  the scenes, and the save stores only the stable ids declared here.

  Coordinates are fixed logical units (the camera is about 320 wide). Rooms
  never change size with the screen.

  THE THRESHOLD (content revision "threshold-v1"):
    opening, outside, before the handheld locks:  curb → van → roadside → drain
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

  const CONTENT_REVISION = "threshold-v1";
  // Revisions this build knows how to carry forward (see dungeon-core normalizeSlice).
  const LEGACY_REVISIONS = ["threshold-gate1"];
  const CAMPAIGN_KIND = "proof";
  const CHAPTER_ID = "threshold";
  const OPENING_ROOMS = ["curb", "van", "roadside", "drain"];
  const ROOM_IDS = ["slip", "clatter", "hem", "hearth", "queue", "porter"];
  const BUILT_ROOMS = [...OPENING_ROOMS, ...ROOM_IDS];

  const ROOMS = {
    // ===== THE OPENING (outside; the handheld is not locked yet) =====
    curb: {
      id: "curb", name: "LATE STORE", world: true, w: 360, h: 300, theme: "curb", rain: 0.55,
      solids: [
        { id: "storefront", x: 0, y: 0, w: 360, h: 96, kind: "storefront" },
        { id: "icebox", x: 296, y: 104, w: 34, h: 26, kind: "icebox" },
        { id: "bin", x: 28, y: 110, w: 20, h: 22, kind: "bin" },
        { id: "curbstone", x: 0, y: 236, w: 360, h: 64, kind: "street" }
      ],
      anchors: { start: { x: 178, y: 152 }, "store-door": { x: 176, y: 104 }, "keeper-start": { x: 204, y: 140 } },
      entryAnchor: "start",
      // Rizo will not wander far from the door: it slows and looks back.
      leash: { x: 176, y: 156, r: 74 },
      shelters: [{ x: 116, y: 96, w: 124, h: 30 }],
      props: [
        { id: "puddle", kind: "inspect", x: 112, y: 182, r: 10, prompt: "LOOK", lines: ["The store sign shakes in the puddle.", "It says OPEN. Mostly."] },
        { id: "icebox-look", kind: "inspect", x: 312, y: 134, r: 8, prompt: "LOOK", lines: ["ICE. The machine hums like it's thinking about it."] }
      ],
      exits: [], zones: [], encounters: []
    },
    van: {
      id: "van", name: "BACK OF A VAN", world: true, w: 240, h: 150, theme: "van", rain: 0,
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
        { id: "bus-sign", kind: "inspect", x: 66, y: 592, r: 7, prompt: "LOOK", lines: ["A bus stop. No bus."] }
      ],
      zones: [{ id: "bowl-near", x: 112, y: 950, w: 64, h: 64 }, { id: "rain-worse", x: 22, y: 26, w: 176, h: 300 }],
      exits: [{ id: "into-drain", x: 70, y: 0, w: 60, h: 40, to: "drain", anchor: "mouth" }],
      encounters: []
    },
    drain: {
      id: "drain", name: "THE DRAIN", world: true, w: 240, h: 380, theme: "drain", rain: 0.15,
      solids: [
        { id: "drain-w", x: 0, y: 0, w: 42, h: 380, kind: "concrete" },
        { id: "drain-e", x: 198, y: 0, w: 42, h: 380, kind: "concrete" },
        { id: "drain-n", x: 0, y: 0, w: 240, h: 22, kind: "concrete" }
      ],
      anchors: { mouth: { x: 120, y: 340 } },
      entryAnchor: "mouth",
      shelters: [{ x: 42, y: 22, w: 156, h: 318 }],
      props: [
        { id: "glove", kind: "inspect", x: 78, y: 300, r: 6, prompt: "LOOK", lines: ["A glove. Dry. Somebody waited here once."] }
      ],
      zones: [{ id: "deep", x: 84, y: 40, w: 72, h: 70 }],
      exits: [{ id: "drain-out", x: 42, y: 372, w: 156, h: 8, to: "roadside", anchor: "drain-front" }],
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
        { id: "ticket-stub", kind: "inspect", x: 290, y: 382, r: 6, prompt: "LOOK", lines: ["A ticket stub, punched twice.", "The name on it has been rubbed away."] }
      ],
      zones: [],
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
        { id: "queue-lever-done", kind: "inspect", x: 36, y: 300, r: 8, prompt: "LOOK", lines: ["The lever stays down. The way to the hearth stays open."], when: { shortcutOpen: true } }
      ],
      zones: [],
      exits: [
        { id: "queue-to-hem", x: 140, y: 428, w: 40, h: 12, to: "hem", anchor: "hem-north" },
        { id: "queue-to-porter", x: 140, y: 0, w: 40, h: 12, to: "porter", anchor: "porter-entry" },
        { id: "queue-to-hearth", x: 0, y: 330, w: 10, h: 40, to: "hearth", anchor: "hearth-shortcut", openWhen: "shortcutOpen" }
      ],
      encounters: [{ id: "queue-draftling", kind: "draftling", x: 236, y: 330 }, { id: "queue-needle", kind: "needle", x: 160, y: 84 }]
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
        { id: "porter-to-home", x: 160, y: 0, w: 40, h: 8, to: "home", anchor: "", openWhen: "porterDown" }
      ],
      encounters: [{ id: "night-porter", kind: "porter", x: 180, y: 78, durable: true }]
    }
  };

  const ENEMIES = {
    draftling: { hp: 4, radius: 8, detect: 88, windupMs: 850, lockAtMs: 520, lungeMs: 240, lungeDistance: 48, recoverMs: 700, homeDrift: 6 },
    needle: { hp: 4, radius: 7, detect: 150, indicateMs: 1000, pulseMs: 120, recoverMs: 1000, laneWidth: 10, laneMax: 300 },
    // The van's loose cooler: a readable slide that bumps, never burns.
    cargo: { hp: 1, radius: 9, windupMs: 900, slideMs: 320, slideDistance: 150 },
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
    driver: { name: "DRIVER", portrait: "driver" }
  };

  // ===== LINES =====
  // { speaker, expr, text } is spoken (portrait beside it); a bare string is
  // narration (no portrait). Rizo never makes speeches: he reacts in-world.
  const L = (speaker, expr, text) => ({ speaker, expr, text });
  const LINES = {
    beGood: [L("you", "neutral", "Alright Rizo, I'm gonna go in the store real quick. Be good.")],
    thatHim: [L("hood-small", "neutral", "That him?"), L("hood-tall", "neutral", "Obviously.")],
    flinch: [L("hood-small", "neutral", "Yo—")],
    vanArgue: [L("driver", "neutral", "I thought you said he didn't do that fire shit."), L("hood-tall", "neutral", "I said probably.")],
    bump: [L("driver", "neutral", "My bad. Pothole.")],
    latchApproach: [L("latch", "startled", "NO OPEN FLAMES."), L("latch", "dry", "Sorry. Sign's older than the door.")],
    latchJam: [L("latch", "procedural", "Latch is frozen. Name's Latch. Different problem.")],
    latchRescue: [L("latch", "startled", "Oh."), L("latch", "dry", "That was the useful kind."), L("latch", "procedural", "You're going up? Hearth first.")],
    latchRescueStranger: [L("latch", "startled", "Oh."), L("latch", "dry", "That was the useful kind. I'm Latch, by the way."), L("latch", "procedural", "You're going up? Hearth first.")],
    seatOffer: [L("latch", "procedural", "Seat's dry."), L("latch", "dry", "I checked with the wet part of me.")],
    sit: [L("latch", "soft", "You can stay. Just don't eat the chair.")],
    go: [L("latch", "dry", "Right. Officially: route inspection.")],
    beforePorter: [L("latch", "procedural", "He checks every ticket."), L("latch", "soft", "Nobody here has one.")],
    latchHearthIdle: [L("latch", "soft", "Fire's good. Go on when you're ready.")],
    bowl: ["A bowl. A familiar shape. Cold ash."],
    help: [L("latch", "urgent", "Here. I found a door that still does doors.")],
    gift: [L("latch", "soft", "Keeps the draft off."), L("latch", "dry", "Don't get it cleaned. That's my best knot.")],
    departure: [L("latch", "soft", "Go on."), L("latch", "soft", "Something upstairs is waiting for you.")],
    rested: "WARM AGAIN",
    hearthKnows: "THE HEARTH KNOWS YOU NOW",
    firstDown: "THE FLAME WENT LOW. THE HEARTH KEPT IT.",
    downNoHearth: "BACK WHERE HE LANDED",
    shortcutOpen: "THE WAY TO THE HEARTH IS OPEN",
    homeUp: "HOME ↑"
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
    START_ROOM: "curb",
    BELOW_START: "slip",
    // Durable flags a campaign may hold (world.durableRoomFlags / story.facts).
    FLAGS: ["latchFreed", "jamInspected", "sharedRest", "seatChosen", "bowlSeen", "shortcutOpen", "porterHelp", "alcoveOpen", "porterDown", "beforePorterSaid", "hearthArrived"],
    knownRoom: id => BUILT_ROOMS.includes(id),
    isOpening: id => OPENING_ROOMS.includes(id),
    knownAnchor: (roomId, anchorId) => Boolean(ROOMS[roomId]?.anchors?.[anchorId]),
    knownHearth: id => Object.values(ROOMS).some(room => room.hearth?.id === id),
    knownEncounter: id => Object.values(ROOMS).some(room => room.encounters.some(item => item.id === id)),
    hearthRoom: id => Object.values(ROOMS).find(room => room.hearth?.id === id) || null
  };
  return deepFreeze(api);
});
