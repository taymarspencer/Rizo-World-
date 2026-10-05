// Rizo Dungeon input (dungeon-input.js): the phone-native control rules, with
// a fake DOM that fires handlers in the browser's order (window capture, the
// target, window bubble) so a lost release, a second finger or a rotation can
// be played back exactly. The real-browser version is browser-dungeon-controls.py.
const path = require("path");
const assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const Input = require(path.join(ROOT, "modes/dungeon/dungeon-input.js"));

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("PASS", name); }
  catch (error) { console.log("FAIL", name, "\n   ", error.message); process.exitCode = 1; }
}

// ---- a very small DOM
class Target {
  constructor(rect = { left: 0, top: 0, width: 120, height: 120 }) { this.listeners = []; this.rect = rect; this.hidden = false; this.dataset = {}; }
  addEventListener(type, fn, options) { this.listeners.push({ type, fn, capture: options === true || Boolean(options && options.capture) }); }
  removeEventListener(type, fn) { this.listeners = this.listeners.filter(item => !(item.type === type && item.fn === fn)); }
  getBoundingClientRect() { return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height }; }
  setPointerCapture() {}
  count(type) { return this.listeners.filter(item => item.type === type).length; }
}
function world() {
  const win = new Target(), doc = new Target();
  doc.hidden = false; doc.activeElement = null;
  win.matchMedia = () => { const mq = new Target(); win.portrait = mq; return mq; };
  globalThis.window = win; globalThis.document = doc;
  const dpad = new Target({ left: 20, top: 400, width: 120, height: 120 });
  const keys = { primary: new Target(), secondary: new Target(), system: new Target() };
  for (const [name, el] of Object.entries(keys)) el.dataset.dungeonKey = name;
  const screen = new Target(), device = new Target();
  const dialogue = { hidden: false }, choice = { hidden: true };
  device.querySelector = selector => (selector === ".dungeon-choice" ? choice : null);
  const input = Input.create({ device, screen, dpad, keys });
  input.bind();
  // Browser order: window capture → target → window bubble.
  function fire(target, type, event = {}) {
    const e = { type, target, currentTarget: target, button: 0, isPrimary: false, pointerType: "touch", pointerId: 1, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...event };
    for (const item of win.listeners.filter(l => l.type === type && l.capture)) item.fn(e);
    for (const item of target.listeners.filter(l => l.type === type)) item.fn({ ...e, currentTarget: target, preventDefault: e.preventDefault.bind(e), stopPropagation() {} });
    for (const item of win.listeners.filter(l => l.type === type && !l.capture)) item.fn(e);
    return e;
  }
  const at = (dx, dy) => ({ clientX: 80 + dx, clientY: 460 + dy }); // pad centre is (80, 460)
  const finger = (id, extra = {}) => ({ pointerId: id, pointerType: "touch", ...extra });
  const down = (id, dx, dy, extra = {}) => fire(dpad, "pointerdown", { ...finger(id, extra), ...at(dx, dy) });
  const move = (id, dx, dy) => fire(dpad, "pointermove", { ...finger(id), ...at(dx, dy) });
  const up = (id, where = dpad) => fire(where, "pointerup", finger(id));
  const read = () => { const out = input.consume(); return { x: out.moveX, y: out.moveY, ...out }; };
  return { win, doc, dpad, keys, screen, device, dialogue, choice, input, fire, down, move, up, read, finger };
}
const vec = r => [r.x, r.y];

// ---------------------------------------------------------------- the pad's maths
test("dpadVector: the same eight directions and dead zone as before when no direction is held", () => {
  const r = 60;
  assert.deepStrictEqual(Input.dpadVector(40, 0, r), [1, 0]);
  assert.deepStrictEqual(Input.dpadVector(-40, 0, r), [-1, 0]);
  assert.deepStrictEqual(Input.dpadVector(0, -40, r), [0, -1]);
  assert.deepStrictEqual(Input.dpadVector(0, 40, r), [0, 1]);
  assert.deepStrictEqual(Input.dpadVector(30, 30, r), [1, 1]);
  assert.deepStrictEqual(Input.dpadVector(-30, -30, r), [-1, -1]);
  assert.deepStrictEqual(Input.dpadVector(5, 5, r), [0, 0]);
  assert.strictEqual(Object.is(Input.dpadVector(-40, 0, r)[1], -0), false, "no negative zero leaks into the state");
});
test("dpadVector: a thumb wobbling ±8° at every sector edge no longer flickers", () => {
  for (const mean of [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]) {
    let seed = 7, flips = 0, last = null, prev;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 400; i += 1) {
      const a = (mean + (rnd() - 0.5) * 16) * Math.PI / 180, r = 34 + rnd() * 16;
      const v = Input.dpadVector(Math.cos(a) * r, Math.sin(a) * r, 60, prev);
      prev = v;
      if (last !== null && v.join() !== last) flips += 1;
      last = v.join();
    }
    assert.ok(flips <= 2, `edge ${mean}°: ${flips} flips in 400 samples (it was 130–215 before)`);
  }
});
test("dpadVector: a real slide still turns the corner, in both directions", () => {
  let prev, seen = [];
  for (let a = 0; a <= 100; a += 5) { prev = Input.dpadVector(Math.cos(a * Math.PI / 180) * 45, Math.sin(a * Math.PI / 180) * 45, 60, prev); seen.push(prev.join()); }
  assert.strictEqual(seen[0], "1,0"); assert.strictEqual(seen[seen.length - 1], "0,1");
  assert.ok(seen.includes("1,1"), "passes through the diagonal");
  const firstTurn = seen.indexOf("1,1") * 5;
  assert.ok(firstTurn <= 40, `turns to the diagonal by 40° (did at ${firstTurn}°)`);
  prev = [0, 1];
  let back = [];
  for (let a = 100; a >= 0; a -= 5) { prev = Input.dpadVector(Math.cos(a * Math.PI / 180) * 45, Math.sin(a * Math.PI / 180) * 45, 60, prev); back.push(prev.join()); }
  assert.strictEqual(back[back.length - 1], "1,0");
});
test("dpadVector: a thumb that is steering lets go nearer the centre than one that is arriving", () => {
  assert.deepStrictEqual(Input.dpadVector(11, 0, 60), [0, 0]);
  assert.deepStrictEqual(Input.dpadVector(11, 0, 60, [1, 0]), [1, 0]);
  assert.deepStrictEqual(Input.dpadVector(7, 0, 60, [1, 0]), [0, 0]);
});

// ---------------------------------------------------------------- holding, releasing, cancelling
test("a held thumb moves continuously and a release stops it", () => {
  const w = world();
  w.down(1, 40, 0);
  assert.deepStrictEqual(vec(w.read()), [1, 0]);
  assert.deepStrictEqual(vec(w.read()), [1, 0], "still held on the next frame");
  w.up(1);
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  assert.strictEqual(w.input.view().dir, "none");
});
test("sliding across the pad changes direction without lifting; sliding off it keeps steering", () => {
  const w = world();
  w.down(1, 40, 0); assert.strictEqual(w.input.view().dir, "right");
  w.move(1, 0, -40); assert.strictEqual(w.input.view().dir, "up");
  w.move(1, 500, -300); assert.strictEqual(w.input.view().dir, "up-right", "far outside the pad still steers by angle");
  w.up(1); assert.strictEqual(w.input.view().dir, "none");
});
test("pointercancel releases the pad and the keys", () => {
  const w = world();
  w.down(1, 40, 0); w.fire(w.keys.primary, "pointerdown", { ...w.finger(2) });
  assert.strictEqual(w.input.view().primary, true);
  w.fire(w.dpad, "pointercancel", w.finger(1)); w.fire(w.keys.primary, "pointercancel", w.finger(2));
  const r = w.read(); assert.deepStrictEqual(vec(r), [0, 0]); assert.strictEqual(r.primaryHeld, false);
});
test("a release that lands somewhere else (capture lost) still releases", () => {
  const w = world();
  w.down(1, 40, 0);
  w.fire(w.screen, "pointerup", w.finger(1)); // delivered to the screen, not the pad
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  w.fire(w.keys.primary, "pointerdown", w.finger(2));
  w.fire({ listeners: [] }, "pointerup", w.finger(2)); // delivered to a node with no listeners at all
  assert.strictEqual(w.read().primaryHeld, false);
  assert.deepStrictEqual(w.input.describe().sources, []);
});
test("a pointerup that never arrives is healed when the browser reports no touches left", () => {
  const w = world();
  w.down(1, 40, 0);
  w.fire(w.screen, "touchend", { touches: [{}], pointerType: undefined });
  assert.deepStrictEqual(vec(w.read()), [1, 0], "other touches are still down: nothing is forgotten");
  w.fire(w.screen, "touchend", { touches: [], pointerType: undefined });
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  assert.strictEqual(w.input.describe().padOwner, null);
  w.down(1, 40, 0); w.fire(w.screen, "touchcancel", { touches: [] });
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
});
test("a new first finger forgets an older touch that was lost without a release", () => {
  const w = world();
  w.down(7, 40, 0, { isPrimary: true });
  assert.deepStrictEqual(vec(w.read()), [1, 0]);
  w.down(8, -40, 0, { isPrimary: true }); // the browser says 8 is the only finger: 7 is gone
  assert.deepStrictEqual(vec(w.read()), [-1, 0]);
  w.up(8);
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  assert.deepStrictEqual(w.input.describe().sources, []);
});
test("a second finger on the pad is not the first finger's business", () => {
  const w = world();
  w.down(7, 40, 0, { isPrimary: true });
  w.down(8, 40, 0); // a later, non-primary finger
  assert.deepStrictEqual(vec(w.read()), [1, 0]);
  w.up(7); // the first lifts: the pad is free again
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
});

// ---------------------------------------------------------------- one thumb on the pad
test("two fingers on the pad: opposite directions do not cancel and diagonals are not invented", () => {
  const w = world();
  w.down(1, 40, 0); w.down(2, -40, 0);
  assert.deepStrictEqual(vec(w.read()), [1, 0], "the first thumb keeps the pad");
  w.down(3, 0, -40);
  assert.deepStrictEqual(vec(w.read()), [1, 0], "a third finger is ignored too");
  w.move(2, 0, 40); // the ignored finger wandering does nothing
  assert.deepStrictEqual(vec(w.read()), [1, 0]);
  w.up(2); w.up(3);
  assert.deepStrictEqual(vec(w.read()), [1, 0], "ignored fingers lifting changes nothing");
  w.up(1);
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  w.down(2, -40, 0);
  assert.deepStrictEqual(vec(w.read()), [-1, 0], "after the first lifts a new touch takes over");
});
test("the pad and Flare/Tuck work together, in either release order", () => {
  for (const order of [[1, 2], [2, 1]]) {
    const w = world();
    w.down(1, 40, 0); w.fire(w.keys.primary, "pointerdown", w.finger(2)); w.fire(w.keys.secondary, "pointerdown", w.finger(3));
    const r = w.read();
    assert.deepStrictEqual(vec(r), [1, 0]); assert.strictEqual(r.primaryHeld, true); assert.strictEqual(r.secondaryHeld, true);
    assert.strictEqual(r.primaryPressed, true); assert.strictEqual(r.secondaryPressed, true);
    for (const id of order) { if (id === 1) w.up(1); else w.fire(w.keys.primary, "pointerup", w.finger(2)); }
    w.fire(w.keys.secondary, "pointerup", w.finger(3));
    const end = w.read(); assert.deepStrictEqual(vec(end), [0, 0]); assert.strictEqual(end.primaryHeld, false); assert.strictEqual(end.secondaryHeld, false);
    assert.deepStrictEqual(w.input.describe().sources, []);
  }
});
test("mashing the pad leaves nothing held", () => {
  const w = world();
  for (let i = 0; i < 80; i += 1) { w.down(1, i % 2 ? 40 : -40, 0); w.up(1); }
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  assert.deepStrictEqual(w.input.describe(), { sources: [], quiet: [], padOwner: null, staleKeys: [] });
});
test("a quick tap between frames still registers as a direction edge", () => {
  const w = world();
  w.down(1, 40, 0); w.up(1);
  const r = w.read(); assert.strictEqual(r.dirX, 1); assert.deepStrictEqual(vec(r), [0, 0]);
});

// ---------------------------------------------------------------- clear(reason)
test("after a dialogue the finger is quiet, wakes on a new direction, and a held direction is never counted again on its own", () => {
  const w = world();
  w.down(1, 40, 0); w.read();
  w.input.clear("dialogue");
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  assert.deepStrictEqual(w.input.describe().quiet, ["pointer:1"]);
  w.move(1, 42, 3); w.move(1, 38, -4);
  assert.deepStrictEqual(vec(w.read()), [0, 0], "jitter in the same direction stays quiet");
  assert.strictEqual(w.input.consume().dirX, 0);
  w.move(1, 0, -40);
  const r = w.read(); assert.deepStrictEqual(vec(r), [0, -1]); assert.strictEqual(r.dirY, -1, "a slide counts as a fresh press");
  assert.deepStrictEqual(w.input.describe().quiet, []);
  w.up(1);
  assert.deepStrictEqual(w.input.describe(), { sources: [], quiet: [], padOwner: null, staleKeys: [] });
});
test("every reason except the page-changed ones leaves the finger quiet, including reasons that do not exist yet", () => {
  for (const reason of ["dialogue", "scene", "choice", "help", "down", "respawn", "something-new", undefined]) {
    const w = world();
    w.down(1, 40, 0); w.input.clear(reason);
    assert.deepStrictEqual(w.input.describe().quiet, ["pointer:1"], String(reason));
    assert.deepStrictEqual(vec(w.read()), [0, 0], String(reason));
  }
});
test("a finger that is quiet still keeps the pad: no second thumb takes it", () => {
  const w = world();
  w.down(1, 40, 0); w.input.clear("scene");
  w.down(2, -40, 0);
  assert.deepStrictEqual(vec(w.read()), [0, 0]);
  assert.deepStrictEqual(w.input.describe().quiet, ["pointer:1"]);
  w.move(2, 0, 40);
  assert.deepStrictEqual(vec(w.read()), [0, 0], "the second finger is still ignored");
});
test("blur, hidden, rotation, resize and resume forget every finger and key", () => {
  for (const reason of ["blur", "hidden", "pagehide", "pageshow", "orientation", "resize", "resume"]) {
    const w = world();
    w.down(1, 40, 0); w.input.key({ code: "KeyZ", key: "z", preventDefault() {}, target: {} });
    w.input.clear(reason);
    assert.deepStrictEqual(w.input.describe(), { sources: [], quiet: [], padOwner: null, staleKeys: [] }, reason);
    w.move(1, 0, -40);
    assert.deepStrictEqual(vec(w.read()), [0, 0], `${reason}: the old finger no longer steers`);
    w.up(1);
    w.down(2, -40, 0);
    assert.deepStrictEqual(vec(w.read()), [-1, 0], `${reason}: a new touch works at once`);
  }
});
test("the page events call the right clears: blur, visibility, pagehide, pageshow, orientation", () => {
  const w = world();
  const cases = [
    () => w.fire(w.win, "blur"),
    () => { w.doc.hidden = true; w.fire(w.doc, "visibilitychange"); w.doc.hidden = false; },
    () => w.fire(w.win, "pagehide"),
    () => w.fire(w.win, "pageshow"),
    () => w.fire(w.win, "orientationchange"),
    () => w.fire(w.win.portrait, "change")
  ];
  cases.forEach((trigger, index) => {
    w.down(1, 40, 0); assert.deepStrictEqual(vec(w.read()), [1, 0]);
    trigger();
    assert.deepStrictEqual(vec(w.read()), [0, 0], `event ${index} clears input`);
    assert.deepStrictEqual(w.input.describe().quiet, [], `event ${index} forgets the finger`);
    w.up(1);
  });
  w.doc.hidden = false; w.down(1, 40, 0); w.fire(w.doc, "visibilitychange");
  assert.deepStrictEqual(vec(w.read()), [1, 0], "becoming visible again is not a reason to drop a finger");
});

// ---------------------------------------------------------------- the keyboard
const keyEvent = (code, extra = {}) => ({ code, key: extra.key || code.replace("Key", "").toLowerCase(), repeat: false, preventDefault() { this.prevented = true; }, target: { closest: () => null }, ...extra });
test("keyboard: WASD/arrows, Z/Space/J, X/K, Escape/P, repeats ignored, shortcuts and text fields left alone", () => {
  const w = world();
  assert.strictEqual(w.input.key(keyEvent("KeyD")), true); assert.deepStrictEqual(vec(w.read()), [1, 0]);
  w.input.key(keyEvent("KeyD", { repeat: true })); assert.deepStrictEqual(vec(w.read()), [1, 0]);
  w.input.keyup(keyEvent("KeyD")); assert.deepStrictEqual(vec(w.read()), [0, 0]);
  for (const [code, name] of [["KeyZ", "primary"], ["Space", "primary"], ["KeyJ", "primary"], ["KeyX", "secondary"], ["KeyK", "secondary"]]) {
    w.input.key(keyEvent(code)); const r = w.read(); assert.strictEqual(r[`${name}Held`], true, code); w.input.keyup(keyEvent(code));
  }
  w.input.key(keyEvent("Escape")); assert.strictEqual(w.read().systemPressed, true); w.input.keyup(keyEvent("Escape"));
  assert.strictEqual(w.input.key(keyEvent("KeyD", { ctrlKey: true })), false);
  assert.strictEqual(w.input.key(keyEvent("KeyD", { target: { closest: () => ({}) } })), false);
  assert.strictEqual(w.input.key(keyEvent("KeyQ")), false);
});
test("keyboard: a key held through a dialogue stays dead until released; after a blur the next fresh press works", () => {
  const w = world();
  w.input.key(keyEvent("KeyD")); w.input.clear("dialogue");
  w.input.key(keyEvent("KeyD", { repeat: true })); w.input.key(keyEvent("KeyD")); // typematic echoes, however they are flagged
  assert.deepStrictEqual(vec(w.read()), [0, 0], "no leak after a dialogue");
  w.input.keyup(keyEvent("KeyD"));
  w.input.key(keyEvent("KeyD")); assert.deepStrictEqual(vec(w.read()), [1, 0], "released and pressed again works");
  w.input.keyup(keyEvent("KeyD"));
  // The window loses focus with D down and its keyup is lost; coming back, D is pressed again.
  w.input.key(keyEvent("KeyD")); w.fire(w.win, "blur");
  w.input.key(keyEvent("KeyD", { repeat: true }));
  assert.deepStrictEqual(vec(w.read()), [0, 0], "a browser repeat of the still-held key cannot restart it");
  w.input.key(keyEvent("KeyD"));
  assert.deepStrictEqual(vec(w.read()), [1, 0], "a fresh press after a blur is never swallowed (it used to be)");
});

// ---------------------------------------------------------------- the dialogue box and the keys
test("a tap on the dialogue box is NEXT for a finger or pen, not while a choice is up, not for the mouse", () => {
  const w = world();
  const inBox = { closest: sel => (sel === ".dungeon-dialogue" ? w.dialogue : null) };
  const outside = { closest: () => null };
  w.fire(w.screen, "pointerdown", { ...w.finger(4), target: inBox });
  let r = w.read(); assert.strictEqual(r.primaryPressed, true); assert.strictEqual(r.primaryHeld, true);
  w.fire(w.screen, "pointerup", { ...w.finger(4), target: inBox });
  r = w.read(); assert.strictEqual(r.primaryHeld, false);
  w.fire(w.screen, "pointerdown", { ...w.finger(5), pointerType: "pen", target: inBox }); assert.strictEqual(w.read().primaryPressed, true);
  w.fire(w.screen, "pointerup", { ...w.finger(5), pointerType: "pen", target: inBox });
  w.fire(w.screen, "pointerdown", { ...w.finger(6), target: outside }); assert.strictEqual(w.read().primaryPressed, false, "the game screen is not a button for a finger");
  w.fire(w.screen, "pointerup", { ...w.finger(6), target: outside });
  w.choice.hidden = false;
  w.fire(w.screen, "pointerdown", { ...w.finger(7), target: inBox }); assert.strictEqual(w.read().primaryPressed, false, "with a choice open the box is not NEXT");
  w.fire(w.screen, "pointerup", { ...w.finger(7), target: inBox });
  w.choice.hidden = true; w.dialogue.hidden = true;
  w.fire(w.screen, "pointerdown", { ...w.finger(8), target: inBox }); assert.strictEqual(w.read().primaryPressed, false, "a hidden box does nothing");
  w.dialogue.hidden = false;
  const ui = { closest: sel => (sel.includes("data-dungeon-ui") ? {} : sel === ".dungeon-dialogue" ? w.dialogue : null) };
  w.fire(w.screen, "pointerdown", { ...w.finger(1), pointerType: "mouse", button: 0, target: ui }); assert.strictEqual(w.read().primaryPressed, false, "the mouse path is unchanged");
  w.fire(w.screen, "pointerup", { ...w.finger(1), pointerType: "mouse", button: 0, target: ui });
  w.fire(w.screen, "pointerdown", { ...w.finger(1), pointerType: "mouse", button: 0, target: outside }); assert.strictEqual(w.read().primaryPressed, true, "a mouse click on the screen is still Flare");
  w.fire(w.screen, "pointerup", { ...w.finger(1), pointerType: "mouse", button: 0, target: outside }); assert.strictEqual(w.read().primaryHeld, false);
  w.fire(w.screen, "pointerdown", { ...w.finger(1), pointerType: "mouse", button: 2, target: outside }); assert.strictEqual(w.read().secondaryPressed, true, "right button is Tuck");
  w.fire(w.win, "pointerup", { ...w.finger(1), pointerType: "mouse", button: 2 }); assert.strictEqual(w.read().secondaryHeld, false, "and a mouse release anywhere lets go");
});
test("a key finger that drifts off the key and releases elsewhere does not stay pressed", () => {
  const w = world();
  w.fire(w.keys.primary, "pointerdown", w.finger(3));
  assert.strictEqual(w.read().primaryHeld, true);
  w.fire(w.keys.secondary, "pointerup", w.finger(3)); // the release was delivered to a different key
  assert.strictEqual(w.read().primaryHeld, false);
});
test("bind blurs a focused text field so the keys work; unbind clears and removes every listener", () => {
  const w = world();
  let blurred = false;
  const w2 = (() => { document.activeElement = { matches: () => true, blur() { blurred = true; } }; const dpad = new Target(); const x = Input.create({ device: new Target(), screen: new Target(), dpad, keys: {} }); x.bind(); return { x, dpad }; })();
  assert.strictEqual(blurred, true);
  const before = globalThis.window.listeners.length;
  assert.ok(before > 0);
  w2.x.unbind();
  assert.strictEqual(w2.x.bound, false);
  assert.strictEqual(w2.dpad.listeners.length, 0);
  w.input.unbind();
  assert.strictEqual(globalThis.window.listeners.length, 0);
});

console.log(`\n${passed}/${total} dungeon input checks passed`);
