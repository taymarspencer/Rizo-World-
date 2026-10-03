// Game-mode host additions (core/rizo-modes.js): confirmed commit with a
// reward receipt, semantic events, exit destination, care policy hooks and
// the optional adapter capabilities. Uses a fake hub adapter.
const path = require("path");
const assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const Modes = require(path.join(ROOT, "core/rizo-modes.js"));

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("PASS", name); }
  catch (error) { console.log("FAIL", name, "\n   ", error.message); process.exitCode = 1; }
}

const calls = [];
let commitResult = { status: "committed", rewardApplied: false, duplicateReward: false, backupSynced: true };
function adapter(extra = {}) {
  const slices = {};
  return {
    slices,
    readSlice: id => (slices[id] ? JSON.parse(JSON.stringify(slices[id])) : null),
    writeSlice: (id, slice) => { slices[id] = JSON.parse(JSON.stringify(slice)); },
    legacyView: () => null,
    petSnapshot: () => ({ id: "P1", name: "MOSSY" }),
    rosterSnapshots: () => [],
    petMarkup: () => "<div></div>",
    applyAward: () => ({}),
    settings: () => ({}),
    runStore: () => ({ read: () => null, write: () => true, clear: () => true }),
    mount: () => ({}),
    unmount: id => calls.push(["unmount", id]),
    keeperId: () => "K",
    report: () => {},
    save: () => {},
    onExit: (id, summary, options) => calls.push(["exit", id, summary, options]),
    ...extra
  };
}
let hosts = {};
function defineProbe(id, extra = {}) {
  return Modes.register({ id, schema: 1, migrate: () => ({}), create: host => { hosts[id] = host; return { start() {}, stop() { calls.push(["stop", id]); }, suspend: reason => (reason === "force-update" ? host.commit({ data: { saved: true } }) : undefined) }; }, ...extra });
}

test("carePolicy defaults to normal and only accepts the two known policies", () => {
  assert.strictEqual(Modes.defineMode({ id: "plain-mode", schema: 1, migrate: () => ({}), create: () => ({}) }).carePolicy, "normal");
  assert.strictEqual(Modes.defineMode({ id: "held-mode", schema: 1, carePolicy: "foreground-hold", migrate: () => ({}), create: () => ({}) }).carePolicy, "foreground-hold");
  assert.throws(() => Modes.defineMode({ id: "bad-mode", schema: 1, carePolicy: "immortal", migrate: () => ({}), create: () => ({}) }), /carePolicy/);
});
test("an adapter without the new optional capabilities still attaches", () => {
  const legacy = adapter();
  Modes.attachHub(legacy);
});
test("host.commit fails clearly when the hub cannot confirm saves", () => {
  defineProbe("probe-old");
  Modes.launch("probe-old");
  assert.throws(() => hosts["probe-old"].commit({ data: { a: 1 } }), /cannot confirm saves/);
  hosts["probe-old"].exit({});
});

const hub = adapter({
  commitSlice: (id, request) => { calls.push(["commit", id, request]); return commitResult; },
  modeEvent: (id, event) => calls.push(["event", id, event]),
  sessionStart: (id, info) => calls.push(["sessionStart", id, info]),
  sessionEnd: (id, info) => calls.push(["sessionEnd", id, info])
});
Modes.attachHub(hub);
defineProbe("probe-hold", { carePolicy: "foreground-hold" });
defineProbe("probe-normal");

test("a held mode opens and closes a care session around its life", () => {
  calls.length = 0;
  Modes.launch("probe-hold");
  assert.deepStrictEqual(calls[0], ["sessionStart", "probe-hold", { carePolicy: "foreground-hold" }]);
  hosts["probe-hold"].exit({ destination: "home", reason: "quit" });
  const order = calls.map(call => call[0]);
  assert.deepStrictEqual(order.slice(-4), ["stop", "unmount", "sessionEnd", "exit"]);
  assert.deepStrictEqual(calls[calls.length - 1][3], { destination: "home" });
});
test("existing exits keep their behavior: no destination unless a known one is asked for", () => {
  calls.length = 0;
  Modes.launch("probe-normal");
  hosts["probe-normal"].exit({ destination: "moon" });
  assert.deepStrictEqual(calls[calls.length - 1][3], { destination: null });
});
test("host.commit validates the slice and reward shape before the hub sees it", () => {
  Modes.launch("probe-normal");
  const host = hosts["probe-normal"];
  assert.throws(() => host.commit({ data: [] }), /plain object/);
  assert.throws(() => host.commit({ data: { big: "x".repeat(Modes.MAX_SLICE_BYTES) } }), RangeError);
  assert.throws(() => host.commit({ data: {}, reward: { receiptId: "", petId: "P1", entitlements: ["first-knot"] } }), /receiptId/);
  assert.throws(() => host.commit({ data: {}, reward: { receiptId: "ok", petId: "", entitlements: ["first-knot"] } }), /petId/);
  assert.throws(() => host.commit({ data: {}, reward: { receiptId: "ok", petId: "P1", entitlements: [] } }), /entitlements/);
  assert.throws(() => host.commit({ data: {}, reward: { receiptId: "ok", petId: "P1", entitlements: ["A B"] } }), /entitlements/);
  calls.length = 0;
  const outcome = host.commit({ data: { room: "clatter" }, reward: { receiptId: "threshold-x:threshold-complete", petId: "P1", entitlements: ["shared-hearth", "first-knot", "first-knot"] } });
  assert.strictEqual(outcome.status, "committed");
  const sent = calls.find(call => call[0] === "commit")[2];
  assert.deepStrictEqual(sent.reward.entitlements, ["first-knot", "shared-hearth"], "sorted and de-duplicated");
  assert.strictEqual(sent.schema, 1);
  host.exit({});
});
test("commit outcomes are normalized; anything unconfirmed is a failure", () => {
  assert.deepStrictEqual({ ...Modes.commitOutcome(null) }, { status: "failed", rewardApplied: false, duplicateReward: false, backupSynced: false, reason: "failed" });
  assert.strictEqual(Modes.commitOutcome({ status: "maybe" }).status, "failed");
  const blocked = Modes.commitOutcome({ status: "blocked", rewardApplied: true, backupSynced: true });
  assert.strictEqual(blocked.rewardApplied, false, "a blocked commit never claims a reward");
  assert.strictEqual(blocked.backupSynced, false);
  assert.strictEqual(Modes.commitOutcome({ status: "committed", rewardApplied: true, backupSynced: false }).backupSynced, false);
});
test("late callbacks after exit are refused without reaching the hub", () => {
  Modes.launch("probe-normal");
  const host = hosts["probe-normal"];
  host.exit({});
  calls.length = 0;
  assert.strictEqual(host.commit({ data: {} }).status, "failed");
  assert.strictEqual(host.commit({ data: {} }).reason, "inactive");
  assert.strictEqual(host.event("checkpointRest", { boundaryId: "hearth" }), false);
  assert.ok(!calls.some(call => call[0] === "commit" || call[0] === "event"));
});
test("events are allowlisted, tagged with the mode, and default to protected/none", () => {
  Modes.launch("probe-normal");
  const host = hosts["probe-normal"];
  calls.length = 0;
  assert.throws(() => host.event("showAd", { boundaryId: "x" }), /unknown mode event/);
  assert.throws(() => host.event("returnedToHub", { boundaryId: "x" }), /unknown mode event/, "the hub owns returnedToHub");
  assert.throws(() => host.event("checkpointRest", { boundaryId: "Bad Id" }), /boundaryId/);
  assert.strictEqual(host.event("checkpointRest", { boundaryId: "clatter-review-hearth", campaignId: "threshold-abc", tone: "loud" }), true);
  const sent = calls.find(call => call[0] === "event");
  assert.deepStrictEqual(sent.slice(0, 2), ["event", "probe-normal"]);
  assert.deepStrictEqual({ ...sent[2] }, { kind: "checkpointRest", boundaryId: "clatter-review-hearth", campaignId: "threshold-abc", tone: "protected", interruption: "none" });
  host.exit({});
});
test("suspend('force-update') hands the mode's commit outcome back to the hub", () => {
  Modes.launch("probe-normal");
  commitResult = { status: "failed" };
  const outcome = Modes.suspendActive("force-update");
  assert.strictEqual(outcome.status, "failed");
  commitResult = { status: "committed", backupSynced: true };
  assert.strictEqual(Modes.suspendActive("force-update").status, "committed");
  assert.strictEqual(Modes.suspendActive("background"), undefined, "other suspends return nothing, as before");
  hosts["probe-normal"].exit({});
});
test("a mode that throws on create closes its care session again", () => {
  Modes.register({ id: "probe-broken", schema: 1, carePolicy: "foreground-hold", migrate: () => ({}), create: () => { throw new Error("boom"); } });
  calls.length = 0;
  assert.throws(() => Modes.launch("probe-broken"), /boom/);
  assert.deepStrictEqual(calls.map(call => call[0]), ["sessionStart", "sessionEnd", "unmount"]);
  assert.strictEqual(Modes.active(), null);
});

console.log(`\n${passed}/${total} mode host checks passed`);
