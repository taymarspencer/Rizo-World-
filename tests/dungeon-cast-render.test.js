"use strict";
// A rendering *smoke test*, not an aesthetic grade or pixel screenshot.
// Stand-in Canvas methods catch invalid paths, unbalanced state, and rendering
// exceptions when the same native-sized sprites are used in different poses.
const assert = require("node:assert/strict");
const Art = require("../modes/dungeon/dungeon-art.js");

class TestPath2D {
  constructor(d) {
    assert.equal(typeof d, "string");
    assert.ok(d.length > 0, "character path is not empty");
  }
}
const originalPath2D = globalThis.Path2D;
globalThis.Path2D = TestPath2D;
let checks = 0;

function fakeCanvas() {
  const stats = { fills: 0, strokes: 0, depth: 0 };
  const ctx = {
    globalAlpha: 1,
    save() { stats.depth++; },
    restore() { stats.depth--; assert.ok(stats.depth >= 0, "unexpected restore"); },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {}, arc() {},
    rect() {}, clip() {}, translate() {}, rotate() {}, scale() {},
    fill() { stats.fills++; },
    stroke() { stats.strokes++; },
    fillRect() { stats.fills++; },
    strokeRect() { stats.strokes++; }
  };
  return { ctx, stats };
}

function checkDraw(name, draw, minFills = 15, minStrokes = 12) {
  const { ctx, stats } = fakeCanvas();
  assert.doesNotThrow(() => draw(ctx), name);
  assert.equal(stats.depth, 0, name + " leaves Canvas state unbalanced");
  assert.ok(stats.fills >= minFills, name + " drew too little");
  assert.ok(stats.strokes >= minStrokes, name + " lost ink or silhouette");
  checks++;
}

try {
  for (const expr of ["work", "measuring", "listening", "amused", "irritated", "tired"]) {
    checkDraw("Nell " + expr, ctx => Art.nell(ctx, 160, 120, { t: 900, state: "work", expr, face: 1 }));
  }
  for (const [state, expr] of [["tray", "serving"], ["tray", "dry"], ["carry", "irritated"], ["rest", "dry"]]) {
    checkDraw("Orr " + state + "/" + expr, ctx => Art.orr(ctx, 120, 180, { t: 900, state, expr, face: -1 }));
  }
  for (const kind of ["hood-tall", "hood-small", "hood-cap"]) {
    for (const state of ["idle", "grab"]) {
      checkDraw(kind + "/" + state, ctx => Art.hood(ctx, kind, 120, 180, { t: 900, state, face: 1 }));
    }
  }
  // Both arms must still be present when the passenger-door grab overlay
  // changes Cap's rendering; this was an actual missing-limb defect.
  checkDraw("Cap reaches through the passenger door", ctx =>
    Art.hood(ctx, "hood-cap", 120, 180,
      { state: "idle", reaching: true, t: 700, face: 1 }));
  checkDraw("Cap holds after grabbing", ctx =>
    Art.hood(ctx, "hood-cap", 120, 180,
      { state: "grab", reaching: true, t: 950, face: -1 }));
  for (const profile of ["marshal", "gatherer", "runner", "sentry"]) {
    for (const state of ["patrol", "watch-down"]) {
      checkDraw("collector " + profile + "/" + state, ctx => Art.collector(ctx, 120, 180, { profile, state, t: 900, face: -1 }));
    }
  }
  // A collector must have a complete body in each readable threat state:
  // search, recognition, committed pursuit. These are poses, not new AI.
  for (const profile of ["marshal", "gatherer", "runner", "sentry"]) {
    for (const state of ["search", "spot", "run"]) {
      checkDraw("Collector " + profile + "/" + state, ctx =>
        Art.collector(ctx, 120, 180, { profile, state, t: 950, face: 1 }));
    }
  }
  for (const mode of [{ open: 0, lean: .7 }, { open: 1, lampAim: -1 }]) {
    checkDraw("Porter committed pose", ctx =>
      Art.porter(ctx, 140, 190, { t: 800, ...mode }));
  }
  // Existing game characters matter as much as newly redesigned ones.
  // Confirm their speaking, reaction and van poses still produce a complete
  // Canvas frame after animation-direction edits (not a visual beauty grade).
  for (const expr of ["soft", "startled", "dry", "urgent"]) {
    checkDraw("Latch " + expr, ctx => Art.latch(ctx, 120, 180,
      { t: 1000, expr, look: { x: -1, y: .5 }, face: 1 }));
  }
  for (const who of ["hood-tall", "hood-small", "hood-cap", "driver"]) {
    checkDraw("Van " + who + " speaking", ctx => Art.seated(ctx,
      who === "driver" ? "driver-seat" : "van-seat", 120, 180,
      { who, t: 1400, talking: true, talkAge: 600,
        look: { x: 130, y: 90 }, state: "idle" }));
  }
  checkDraw("Driver afraid", ctx => Art.seated(ctx, "driver-seat", 120, 180,
    { who: "driver", t: 1400, state: "stare", look: { x: 130, y: 90 } }));
  // Seated YOU is intentionally a smaller upper-body cutout (11/15 and
  // 10/11 fill/stroke calls observed), not the 80px standing actor.
  checkDraw("YOU seated / turn", ctx => Art.youSeated(ctx, 120, 180,
    { t: 1400, state: "turn" }), 10, 13);
  checkDraw("YOU seated / look back", ctx => Art.youSeated(ctx, 120, 180,
    { t: 1400, state: "look-back" }), 9, 10);
  checkDraw("YOU walking", ctx => Art.keeper(ctx, 120, 180, { t: 900, walking: true, stride: 4, face: 1 }));
  checkDraw("YOU looking back", ctx => Art.keeper(ctx, 120, 180, { t: 900, state: "look-back", face: -1 }));
  assert.ok(Art.PORTRAITS.orr.serving.includes("<svg"), "Orr has a portrait");
  assert.notEqual(Art.PORTRAITS.orr.serving, Art.PORTRAITS.orr.dry, "Orr's emotional reads differ");
  assert.notEqual(Art.PORTRAITS.driver.neutral, Art.PORTRAITS.driver.scared, "Driver's emotional reads differ");
  assert.ok(Art.PORTRAITS.nell.listening.includes("<svg"), "Nell has a listening portrait");
  console.log("Dungeon cast art: " + checks + " render smoke checks passed");
} finally {
  if (originalPath2D === undefined) delete globalThis.Path2D;
  else globalThis.Path2D = originalPath2D;
}
