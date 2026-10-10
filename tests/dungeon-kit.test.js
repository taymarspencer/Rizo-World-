// Rizo Dungeon late-game kit (dev only): stealth, watchers, the chase, the
// cage and the vents, and the guarantee that the live game never loads it.
const path = require("path");
const fs = require("fs");
const assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const Kit = require(path.join(ROOT, "modes/dungeon/kit/dungeon-kit.js"));

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("PASS", name); }
  catch (error) { console.log("FAIL", name, "\n   ", error.message); process.exitCode = 1; }
}
const STEP = Kit.STEP_MS;
const floor = Kit.FACTORY.floor;

test("stealth: a cone, line of sight, shadow and lockers; a Flare carries", () => {
  const eye = { x: 60, y: 200, aimX: 1, aimY: 0 }, def = { range: 96, halfAngle: 0.45 };
  assert.strictEqual(Kit.Stealth.sees(eye, { x: 140, y: 200 }, floor, def), false, "a machine line stands between them");
  assert.strictEqual(Kit.Stealth.sees(eye, { x: 90, y: 200 }, floor, def), true, "in front of it, he is seen");
  const open = { w: 200, h: 200, solids: [], hides: [{ x: 90, y: 90, w: 20, h: 20, still: true }] };
  const look = { x: 20, y: 100, aimX: 1, aimY: 0 };
  assert.strictEqual(Kit.Stealth.sees(look, { x: 80, y: 100 }, open, def), true);
  assert.strictEqual(Kit.Stealth.sees(look, { x: 80, y: 160 }, open, def), false, "outside the cone");
  assert.strictEqual(Kit.Stealth.sees(look, { x: 100, y: 100, moving: false }, open, def), false, "still in shadow");
  assert.strictEqual(Kit.Stealth.sees(look, { x: 100, y: 100, moving: true }, open, def), true, "shadow only hides him still");
  assert.strictEqual(Kit.Stealth.sees(look, { x: 180, y: 100, flaring: true }, open, def), true, "a Flare is seen from twice as far");
  const pts = Kit.Stealth.cone(eye, floor, def);
  assert.strictEqual(pts.length, 17);
  assert.ok(pts.every(p => p.x <= 101), "the fan stops at the machine line");
});
test("a watcher patrols, spots, catches after spotMs, or loses him and goes back to walking", () => {
  const w = Kit.createWatcher({ id: "w", patrol: [[20, 100], [180, 100]] });
  const room = { w: 200, h: 200, solids: [], hides: [] };
  let t = 0, events = [];
  const target = { x: 100, y: 100 };
  while (t < 2000 && w.state !== "caught") { t += STEP; events.push(...Kit.stepWatcher(w, target, room, t)); }
  assert.deepStrictEqual(events, ["spotted", "caught"]);
  const w2 = Kit.createWatcher({ id: "w2", patrol: [[20, 100], [180, 100]] });
  const hidden = { x: 100, y: 100 };
  t = 0; events = [];
  for (; t < 300; t += STEP) events.push(...Kit.stepWatcher(w2, hidden, room, t));
  hidden.y = 190; // out of the cone
  for (; t < 3000; t += STEP) events.push(...Kit.stepWatcher(w2, hidden, room, t));
  assert.deepStrictEqual(events, ["spotted", "lost", "resume"]);
});
test("the chase follows his trail, gains when he stops, and loses him at the goal", () => {
  const run = Kit.FACTORY.run;
  const c = Kit.createChase({ from: { x: 10, y: 80 }, goal: run.goal });
  const me = { x: 40, y: 80 };
  let t = 0, events = [];
  // He runs at 80 u/s; it runs at 72 and starts 0.9 s late: he makes the goal.
  while (t < 12000 && !events.length) { t += STEP; me.x = Math.min(590, me.x + 80 * STEP / 1000); events = Kit.stepChase(c, me, t); }
  assert.deepStrictEqual(events, ["escaped"]);
  const c2 = Kit.createChase({ from: { x: 10, y: 80 }, goal: run.goal });
  const still = { x: 120, y: 80 };
  t = 0; events = [];
  while (t < 6000 && !events.length) { t += STEP; events = Kit.stepChase(c2, still, t); }
  assert.deepStrictEqual(events, ["caught"], "standing still, it reaches him");
});
test("the cage opens only to rattles while the guard looks away; a rattle under his eye costs two notches", () => {
  const cage = Kit.createCage();
  let t = 0;
  const at = ms => { const out = []; while (t < ms) { t += STEP; out.push(...Kit.stepCage(cage, {}, t)); } return out; };
  assert.deepStrictEqual(Kit.stepCage(cage, { rattle: true }, t += STEP), ["noticed"]);
  assert.strictEqual(cage.loose, 0);
  assert.ok(at(4000).includes("looks-away"), "with the extra second he looked longer");
  for (let n = 0; n < 4; n += 1) { t += 300; Kit.stepCage(cage, { rattle: true }, t); }
  assert.strictEqual(cage.open, true);
  const c2 = Kit.createCage(); c2.phase = "away"; c2.phaseAt = 0; c2.loose = 3;
  assert.strictEqual(Kit.cageTell(c2, c2.def.awayMs - 100), true, "a readable warning before he looks back");
});
test("vents: a grid, three grates that show darker rooms when he stays still on them, and the way out", () => {
  const v = Kit.createVents(Kit.FACTORY.vents);
  assert.deepStrictEqual(Object.values(v.grates), ["office", "lab", "collection"]);
  let t = 0;
  const seen = [];
  const go = (dx, dy, n) => { for (let i = 0; i < n; i += 1) { t += Kit.VENT_MOVE_MS; seen.push(...Kit.stepVents(v, { moveX: dx, moveY: dy }, t)); } };
  const wait = ms => { for (let e = 0; e < ms; e += STEP) { t += STEP; seen.push(...Kit.stepVents(v, {}, t)); } };
  go(1, 0, 3); wait(500);
  assert.ok(seen.includes("view:office"), seen.join(","));
  go(1, 0, 3); go(0, 1, 2); wait(500);
  assert.ok(seen.includes("view:collection"), "the collection is on the way out");
  // The side duct to the lab, and back.
  go(0, -1, 2); go(-1, 0, 4); go(0, 1, 2); go(-1, 0, 2); go(0, 1, 2); go(1, 0, 4); go(0, -1, 2); wait(500);
  assert.ok(seen.includes("view:lab"), seen.join(","));
  go(0, 1, 2); go(-1, 0, 4); go(0, -1, 2); go(1, 0, 2); go(0, -1, 2); go(1, 0, 4); go(0, 1, 4); go(1, 0, 2);
  assert.ok(seen.includes("out"), seen.join(","));
});
test("the kit is dev only: no page, service worker or live script loads it", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  for (const text of [index, sw]) assert.ok(!/dungeon\/kit\//.test(text));
  for (const file of fs.readdirSync(path.join(ROOT, "modes/dungeon")).filter(name => name.endsWith(".js"))) {
    assert.ok(!/RizoDungeonKit|dungeon-kit/.test(fs.readFileSync(path.join(ROOT, "modes/dungeon", file), "utf8")), file);
  }
  const build = fs.readFileSync(path.join(ROOT, "tools/build-site.py"), "utf8");
  assert.ok(/ignore_patterns\('kit'\)/.test(build), "the production package leaves modes/dungeon/kit out");
  const page = fs.readFileSync(path.join(ROOT, "tools/dungeon-kit/index.html"), "utf8");
  assert.ok(/dev=1/.test(page), "the greybox page asks for ?dev=1");
});

console.log(`\n${passed}/${total} dungeon kit checks passed`);
