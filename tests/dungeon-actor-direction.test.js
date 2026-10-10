"use strict";
const assert = require("node:assert/strict");
// The actor director lives in Dungeon View, but it is pure: it can be tested
// without a DOM, an audio engine, real enemy logic, or an active game session.
const previous = ["RizoDungeonCore", "RizoDungeonContent", "RizoDungeonArt",
  "RizoDungeonScenery", "RizoDungeonView"].map(key => [key, globalThis[key]]);
let checks = 0;
const check = (name, action) => { action(); checks++; };
try {
  globalThis.RizoDungeonCore = {};
  globalThis.RizoDungeonContent = {};
  globalThis.RizoDungeonArt = { P: {} };
  globalThis.RizoDungeonScenery = {};
  delete require.cache[require.resolve("../modes/dungeon/dungeon-view.js")];
  require("../modes/dungeon/dungeon-view.js");
  const { performanceForActor: direct, footfall, visibleActors, nextRunnerMotion, projectStagePoint } = globalThis.RizoDungeonView;
  const nell = { id: "nell", kind: "nell", x: 90, y: 120, face: 1, state: "work", walking: false, visible: true };
  const orr = { id: "orr", kind: "orr", x: 115, y: 112, face: -1, state: "tray", walking: false, visible: true };
  const small = { id: "hood-small", kind: "hood-small", x: 80, y: 145, face: 1, state: "search", walking: false, visible: true };
  const near = { x: 44, y: 135 }, far = { x: 290, y: 300 };
  const context = (extra = {}) => ({ player: near, actors: [nell, orr, small], barks: [], t: 3000, ...extra });

  check("speaker looks toward Rizo", () => {
    const act = direct(nell, context({ speaker: "nell" }));
    assert.equal(act.cue, "address");
    assert.equal(act.addressed, true);
    assert.ok(act.look.x < 0);
  });
  check("another nearby speaker wins attention over arbitrary Rizo gaze", () => {
    const act = direct(nell, context({ player: far, barks: [{ id: "orr", text: "Come here." }] }));
    assert.equal(act.cue, "listen");
    assert.equal(act.listening, true);
    assert.ok(act.look.x > 0);
  });
  check("portrait conversations direct a nearby listener's eyes", () => {
    const act = direct(orr, context({ speaker: "nell", player: far }));
    assert.equal(act.cue, "listen");
    assert.equal(act.listening, true);
    assert.ok(act.look.x > 0, "Orr faces Nell using mirrored local gaze");
  });
  check("portrait speaking actor gets priority over listening", () => {
    assert.equal(direct(nell, context({ speaker: "nell" })).cue, "address");
  });
  check("distant on-screen portraits do not telepathically direct bystanders", () => {
    const isolated = { ...orr, x: 390, y: 340 };
    assert.equal(direct(isolated, context({ speaker: "nell", player: far, actors: [nell, isolated] })).cue, "job");
  });
  check("silent worker does not stare indefinitely", () => {
    assert.equal(direct(nell, context()).cue, "job");
  });
  check("quiet workers retain their task instead of making random eye movements", () => {
    assert.equal(direct(nell, context({ t: 1000 })).cue, "job");
    assert.equal(direct(nell, context({ t: 3000 })).cue, "job");
    assert.deepEqual(direct(nell, context({ t: 1000 })),
      direct(nell, context({ t: 3000 })));
  });
  check("reduced motion suppresses unimportant glances", () => {
    assert.equal(direct(nell, context({ t: 1000, reduced: true })).cue, "job");
  });
  check("reduced motion still retains conversational meaning", () => {
    assert.equal(direct(nell, context({ speaker: "nell", reduced: true })).cue, "address");
  });
  check("distant players cannot trigger magical gaze tracking", () => {
    assert.equal(direct(nell, context({ player: far, speaker: "nell" })).cue, "job");
  });
  check("walking actors look toward their visible destination", () => {
    const moving = { ...nell, walking: true, toX: 160, toY: 120 };
    assert.equal(direct(moving, context()).cue, "travel");
  });
  check("walking actors do not search for offscreen players", () => {
    const moving = { ...nell, walking: true, toX: 160, toY: 120 };
    assert.equal(direct(moving, context({ player: far })).cue, "travel");
  });
  check("reduced motion hides nonessential travel gaze", () => {
    const moving = { ...nell, walking: true, toX: 160, toY: 120 };
    assert.equal(direct(moving, context({ reduced: true })).cue, "job");
  });
  check("chase focuses on a nearby target", () => {
    assert.equal(direct({ ...small, state: "chase" }, context()).cue, "pursue");
  });
  check("chase does not track players across the world", () => {
    assert.notEqual(direct({ ...small, state: "chase" }, context({ player: far })).cue, "pursue");
  });
  check("visible flare startles a nearby kidnapper", () => {
    assert.equal(direct(small, context({ flare: true })).startled, true);
  });
  check("flare does not magically startle distant kidnappers", () => {
    assert.equal(direct(small, context({ player: far, flare: true })).startled, false);
  });
  check("non-kidnappers do not adopt an invented flinch state", () => {
    assert.equal(direct(nell, context({ flare: true })).startled, false);
  });
  check("invisible cast has no stage direction", () => {
    assert.equal(direct({ ...nell, visible: false }, context()).cue, "job");
  });
  check("missing player position is safe", () => {
    assert.deepEqual(direct(nell, { t: 50 }).look, { x: 0, y: 0 });
  });
  check("mirrored sprites get gaze in local coordinates", () => {
    const left = direct({ ...nell, face: -1 }, context({ speaker: "nell" }));
    const right = direct(nell, context({ speaker: "nell" }));
    assert.equal(left.look.x, -right.look.x);
  });
  check("gaze remains within anatomical limits", () => {
    const act = direct(nell, context({ speaker: "nell", player: { x: 91, y: 210 } }));
    assert.ok(Math.abs(act.look.x) <= 1 && Math.abs(act.look.y) <= 1);
  });
  check("nearby speech does not interfere with Rizo's selected actor", () => {
    const act = direct(orr, context({ speaker: "orr", barks: [{ id: "nell" }] }));
    assert.equal(act.cue, "address");
  });
  check("distance-based footfall is deterministic", () => {
    const actor = { walking: true, stride: 3 };
    assert.equal(footfall(actor), footfall(actor));
    assert.notEqual(footfall(actor), footfall({ walking: true, stride: 6 }));
  });
  check("plant the feet when stopped", () => {
    assert.equal(footfall({ walking: false, stride: 3 }), 0);
  });
  check("reduced motion plants feet", () => {
    assert.equal(footfall({ walking: true, stride: 3 }, true), 0);
  });
  check("unzoomed story bubbles preserve regular CSS coordinates", () => {
    const bounds = { left: 20, top: 30, width: 320 };
    assert.deepEqual(projectStagePoint([110, 80], bounds, bounds, 320), [110, 80]);
  });
  check("story camera zoom keeps speaker attached at the zoom center", () => {
    const screen = { left: 20, top: 30, width: 320 };
    const stage = { left: -12, top: -6, width: 384 };
    const [x, y] = projectStagePoint([160, 80], stage, screen, 320);
    assert.equal(x, 160);
    assert.equal(y, 60);
  });
  check("device-shell CSS scaling does not displace cinematic speech", () => {
    const screen = { left: 20, top: 30, width: 160 };
    const stage = { left: 4, top: 12, width: 192 };
    const [x, y] = projectStagePoint([160, 80], stage, screen, 320);
    assert.equal(x, 160);
    assert.equal(y, 60);
  });
  check("a panning scene transports dialogue bubble anchors together", () => {
    const screen = { left: 20, top: 30, width: 320 };
    const stage = { left: 20, top: 42, width: 320 };
    assert.deepEqual(projectStagePoint([80, 100], stage, screen, 320), [80, 112]);
  });
  check("scene exits remove hidden cast without altering visible identity", () => {
    assert.deepEqual(visibleActors([nell, { ...orr, visible: false }, small]).map(x => x.id),
      ["nell", "hood-small"]);
  });
  check("hidden Latch stays absent until the scripted alcove reveal", () => {
    const hiddenLatch = { id: "latch", kind: "latch", visible: false };
    assert.deepEqual(visibleActors([hiddenLatch]), []);
    assert.equal(direct(hiddenLatch, context()).cue, "job");
    assert.deepEqual(visibleActors([{ ...hiddenLatch, visible: true }]).map(x => x.id), ["latch"]);
  });
  check("cast selection safely handles null and unspecified visibility", () => {
    assert.deepEqual(visibleActors(null), []);
    assert.deepEqual(visibleActors([null, { id: "narrator" }]).map(x => x.id), ["narrator"]);
  });
  check("runner starts with feet planted before taking a real step", () => {
    const p = nextRunnerMotion(null, { x: 100, y: 100, state: "run" }, 150, "play");
    assert.equal(p.moving, false);
    assert.equal(p.stride, 0);
  });
  check("runner steps follow traveled distance and pause when blocked", () => {
    const runner = (x, y) => ({ x, y, state: "run" });
    const start = nextRunnerMotion(null, runner(100, 100), 100, "play");
    const moving = nextRunnerMotion(start, runner(107, 100), 130, "play");
    assert.equal(moving.moving, true);
    assert.equal(moving.stride, 1);
    const planted = nextRunnerMotion(moving, runner(107, 100), 270, "play");
    assert.equal(planted.moving, false);
    assert.equal(planted.stride, 1);
  });
  check("runner does not jiggle during pause or after being caught", () => {
    const start = nextRunnerMotion(null, { x: 100, y: 100, state: "run" }, 100, "play");
    const moving = nextRunnerMotion(start, { x: 107, y: 100, state: "run" }, 130, "play");
    assert.equal(nextRunnerMotion(moving, { x: 108, y: 100, state: "run" }, 150, "down").moving, false);
    assert.equal(nextRunnerMotion(moving, { x: 108, y: 100, state: "caught" }, 150, "play").moving, false);
  });
  check("offscreen detour teleports do not generate giant running steps", () => {
    const before = nextRunnerMotion(null, { x: 110, y: 220, state: "run" }, 100, "play");
    const after = nextRunnerMotion(before, { x: 300, y: 70, state: "run" }, 130, "play");
    assert.equal(after.stride, before.stride);
    assert.equal(after.moving, false);
  });
  check("rewound runner clock safely resets prior stride", () => {
    const previous = { x: 100, y: 100, state: "run", t: 500, stride: 20, lastMoved: 500 };
    const pose = nextRunnerMotion(previous, { x: 101, y: 100, state: "run" }, 0, "play");
    assert.equal(pose.stride, 0);
    assert.equal(pose.moving, false);
  });
  check("missing optional acting state is safe", () => {
    assert.equal(footfall(null), 0);
    assert.equal(direct(null, context()).cue, "job");
  });
  console.log("Dungeon actor direction: " + checks + " checks passed");
} finally {
  for (const [name, value] of previous) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
}
