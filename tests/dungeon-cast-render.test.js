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

function checkDraw(name, draw) {
  const { ctx, stats } = fakeCanvas();
  assert.doesNotThrow(() => draw(ctx), name);
  assert.equal(stats.depth, 0, name + " leaves Canvas state unbalanced");
  assert.ok(stats.fills >= 15, name + " drew too little");
  assert.ok(stats.strokes >= 12, name + " lost ink or silhouette");
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
  for (const profile of ["marshal", "gatherer", "runner", "sentry"]) {
    for (const state of ["patrol", "watch-down"]) {
      checkDraw("collector " + profile + "/" + state, ctx => Art.collector(ctx, 120, 180, { profile, state, t: 900, face: -1 }));
    }
  }
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
