// Rizo Dungeon pure rules: profile caps, movement/collision, Flare/Tuck/Kindle
// timing, the Draftling, pause holds and slice validation (dungeon-core.js).
const path = require("path");
const assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const Content = require(path.join(ROOT, "modes/dungeon/dungeon-content.js"));
const Art = require(path.join(ROOT, "modes/dungeon/dungeon-art.js"));
const D = require(path.join(ROOT, "modes/dungeon/dungeon-core.js"));
const T = D.T;

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("PASS", name); }
  catch (error) { console.log("FAIL", name, "\n   ", error.message); process.exitCode = 1; }
}
const clone = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} not within ${tolerance} of ${expected}`);
// An open floor spot far from the Draftling, for movement checks.
function openSim(options = {}) {
  const sim = D.createSim({ roomId: "clatter", ...options });
  sim.enemies = [];
  sim.player.x = 170; sim.player.y = 330;
  return sim;
}
function run(sim, ms, input = {}) {
  const events = [];
  for (let elapsed = 0, first = true; elapsed < ms - 1e-6; elapsed += D.STEP_MS, first = false) {
    const step = D.step(sim, { ...input, primaryPressed: first && input.primaryPressed, secondaryPressed: first && input.secondaryPressed });
    events.push(...step.map(event => ({ ...event, t: sim.t })));
  }
  return events;
}
// A Draftling placed by hand, already noticing the player.
function duel({ assist = false } = {}) {
  const sim = D.createSim({ roomId: "clatter", assist });
  const enemy = sim.enemies[0];
  sim.player.x = 176; sim.player.y = 250;
  enemy.x = 176; enemy.y = 190; enemy.homeX = 176; enemy.homeY = 190;
  return { sim, enemy };
}

// ---------- content ----------
test("content is frozen: the opening plus the six stable Threshold rooms, all reachable", () => {
  assert.ok(Object.isFrozen(Content.ROOMS.clatter.solids[0]));
  assert.deepStrictEqual(Content.ROOM_IDS, ["slip", "clatter", "hem", "hearth", "queue", "porter"]);
  assert.deepStrictEqual(Content.OPENING_ROOMS, ["car", "sack", "van", "roadside", "drain"]);
  assert.strictEqual(Content.CONTENT_REVISION, "threshold-v3");
  assert.strictEqual(Content.ROOMS.curb, undefined, "the curb is gone: the car replaced it");
  for (const [id, room] of Object.entries(Content.ROOMS)) {
    for (const [name, anchor] of Object.entries(room.anchors)) {
      assert.ok(!room.solids.some(rect => !rect.openWhen && D.circleHitsRect(anchor.x, anchor.y, T.PLAYER_RADIUS, rect)), `${id}/${name} stands on open floor`);
    }
    for (const exit of room.exits) if (exit.to !== "home") assert.ok(Content.knownAnchor(exit.to, exit.anchor), `${id} exit ${exit.id} lands on a known anchor`);
  }
});
test("the six rooms connect as specified, with a real hearth–queue shortcut", () => {
  const links = new Set();
  for (const room of Object.values(Content.ROOMS)) for (const exit of room.exits) links.add(`${room.id}>${exit.to}`);
  for (const [a, b] of [["slip", "clatter"], ["clatter", "hem"], ["hem", "hearth"], ["hem", "queue"], ["queue", "porter"], ["hearth", "queue"]]) {
    assert.ok(links.has(`${a}>${b}`) && links.has(`${b}>${a}`), `${a} <-> ${b}`);
  }
  const shortcut = Content.ROOMS.hearth.exits.find(exit => exit.to === "queue");
  assert.strictEqual(shortcut.openWhen, "shortcutOpen", "the shortcut starts locked");
});

test("Orr presentation exposes distinct service, irritated, and dry reads", () => {
  assert.strictEqual(Art.HEIGHT.orr, 82, "speech/staging height follows the authored silhouette");
  assert.deepStrictEqual(Object.keys(Content.PORTRAITS.orr).sort(), ["dry", "irritated", "serving"]);
  assert.strictEqual(new Set(Object.values(Content.PORTRAITS.orr)).size, 3, "each Orr expression has distinct portrait art");
  assert.ok(Object.values(Content.PORTRAITS.orr).every(svg => svg.startsWith("<svg") && svg.length > 900), "Orr portraits are complete authored SVGs");
  assert.strictEqual(Content.LINES.rowsCrunchy[1].speaker, "orr");
  assert.strictEqual(Content.LINES.rowsCrunchy[1].expr, "dry", "his dry joke no longer reuses the serving face");
});
// ---------- profile ----------
test("skill edges use skill/(skill+50) and never pass their caps", () => {
  assert.deepStrictEqual(D.edges({}), { speed: 1, power: 1, instinct: 1, stamina: 1 });
  const half = D.edges({ speed: 50, power: 50, instinct: 50, stamina: 50 });
  assert.deepStrictEqual(half, { speed: 1.04, power: 1.06, instinct: 1.1, stamina: 0.925 });
  const huge = D.edges({ speed: 1e12, power: 1e12, instinct: 1e12, stamina: 1e12 });
  assert.ok(huge.speed <= 1.08 && huge.power <= 1.12 && huge.instinct <= 1.2 && huge.stamina >= 0.85);
  assert.deepStrictEqual(D.normalizeEdges({ speed: 9, power: -3, instinct: "x", stamina: 0 }), { speed: 1.08, power: 1, instinct: 1, stamina: 0.85 });
});
test("a low-bond, untrained Rizo gets a viable profile and only recognition cues", () => {
  const profile = D.legProfile({ skills: {}, careSummary: { favoriteFood: { id: "berry", name: "BERRY" }, favoriteGameId: "rush", bondBand: "new" } });
  assert.deepStrictEqual(profile, { edges: { speed: 1, power: 1, instinct: 1, stamina: 1 }, bondBand: "new", cues: { favoriteFoodId: "berry", favoriteGameId: "rush" } });
  assert.strictEqual(D.legProfile({}).bondBand, "new");
});

// ---------- movement ----------
test("movement is 80 units/sec and diagonals are normalized", () => {
  const straight = openSim();
  run(straight, 1000, { moveX: 1 });
  near(straight.player.x - 170, 80, 0.5, "straight");
  const diagonal = openSim();
  run(diagonal, 500, { moveX: 1, moveY: -1 });
  near(Math.hypot(diagonal.player.x - 170, diagonal.player.y - 330), 40, 0.5, "diagonal");
});
test("the speed edge adds at most 8%", () => {
  const sim = openSim({ edges: D.edges({ speed: 1e9 }) });
  run(sim, 1000, { moveX: -1 });
  near(170 - sim.player.x, 86.4, 0.5, "fast");
});
test("walls stop the Rizo and it slides along them", () => {
  const sim = openSim();
  run(sim, 3000, { moveX: -1 });
  near(sim.player.x, 20 + T.PLAYER_RADIUS, 0.05, "west wall");
  const slide = openSim();
  slide.player.x = 28; slide.player.y = 300;
  run(slide, 500, { moveX: -1, moveY: -1 });
  assert.ok(slide.player.y < 300 - 20 && slide.player.x <= 28, "moves along the wall");
});
test("collision does not depend on frame rate: a long move never tunnels a crate", () => {
  const geo = D.room("clatter");
  const [x] = D.moveCircle(geo, 40, 167, 7, 200, 0);
  assert.ok(x <= 60 - 7 + 1e-6, `stopped at ${x}`);
});

// ---------- Flare ----------
test("Flare: 100 ms anticipation, 100 ms active, 130 ms recovery, facing locked", () => {
  const sim = openSim();
  run(sim, 50, { moveX: 1 });
  run(sim, D.STEP_MS, { primaryPressed: true });
  const act = sim.player.act;
  assert.strictEqual(act.kind, "flare");
  assert.strictEqual(D.flarePhase(act, act.start + 99), "anticipation");
  assert.strictEqual(D.flarePhase(act, act.start + 100), "active");
  assert.strictEqual(D.flarePhase(act, act.start + 200), "recovery");
  assert.strictEqual(D.flarePhase(act, act.start + 330), "done");
  run(sim, 200, { moveY: 1 });
  assert.deepStrictEqual([act.fx, act.fy], [1, 0], "facing stays locked while turning");
});
test("Flare slows movement to 60% during anticipation/active only", () => {
  const sim = openSim();
  run(sim, D.STEP_MS, { primaryPressed: true, moveX: 1 });
  const x0 = sim.player.x;
  run(sim, 150, { moveX: 1 });
  near(sim.player.x - x0, 80 * 0.6 * 0.15, 0.6, "slowed");
  run(sim, 120, { moveX: 1 });
  const x1 = sim.player.x;
  run(sim, 50, { moveX: 1 });
  near(sim.player.x - x1, 80 * 0.05, 0.3, "recovery is full speed");
});
test("Flare hits once per attack, 2 damage, inside range/arc and only while active", () => {
  const { sim, enemy } = duel();
  sim.player.y = enemy.y + 28; sim.player.fx = 0; sim.player.fy = -1;
  enemy.state = "recover"; enemy.stateAt = sim.t; // stands still
  const events = run(sim, 330, { primaryPressed: true });
  const hits = events.filter(event => event.type === "hit");
  assert.strictEqual(hits.length, 1, "one hit per attack id");
  assert.strictEqual(enemy.hp, 2);
  const start = events.find(event => event.type === "flare").t;
  assert.ok(hits[0].t - start >= 100 - 1e-6 && hits[0].t - start < 200, `hit at +${hits[0].t - start}`);
});
test("Flare misses behind, out of range, and through solid cover", () => {
  const { sim, enemy } = duel();
  enemy.state = "recover"; enemy.stateAt = sim.t;
  sim.player.y = enemy.y + 28; sim.player.fx = 0; sim.player.fy = 1; // facing away
  assert.ok(!run(sim, 330, { primaryPressed: true }).some(event => event.type === "hit"), "behind");
  sim.player.fy = -1; sim.player.y = enemy.y + T.FLARE_RANGE + enemy.r + 3;
  assert.ok(!run(sim, 330, { primaryPressed: true }).some(event => event.type === "hit"), "out of range");
  // A crate between them.
  const cover = D.createSim({ roomId: "clatter" });
  const foe = cover.enemies[0];
  foe.state = "recover"; foe.stateAt = cover.t; foe.x = 82; foe.y = 140; cover.player.x = 82; cover.player.y = 196; cover.player.fx = 0; cover.player.fy = -1;
  foe.recoverMs = 1e9;
  assert.ok(!D.lineOfSight(D.geoOf(cover), 82, 196, 82, 140));
});
test("two clean Flares calm a Draftling; the power edge never makes it one", () => {
  const { sim, enemy } = duel();
  enemy.state = "recover"; enemy.stateAt = sim.t;
  sim.player.y = enemy.y + 26; sim.player.fx = 0; sim.player.fy = -1;
  run(sim, 340, { primaryPressed: true });
  enemy.stateAt = sim.t;
  const events = run(sim, 340, { primaryPressed: true });
  assert.ok(events.some(event => event.type === "calmed") && enemy.state === "gone");
  const strong = duel();
  strong.sim.edges = D.normalizeEdges({ power: 1.12 });
  strong.enemy.state = "recover"; strong.enemy.stateAt = strong.sim.t;
  strong.sim.player.y = strong.enemy.y + 26; strong.sim.player.fx = 0; strong.sim.player.fy = -1;
  run(strong.sim, 340, { primaryPressed: true });
  assert.ok(strong.enemy.hp > 0, "still needs a second Flare");
});
test("holding Primary repeats Flare at the attack cadence only during danger", () => {
  const calm = openSim();
  const calmEvents = run(calm, 1000, { primaryHeld: true, primaryPressed: true });
  assert.strictEqual(calmEvents.filter(event => event.type === "flare").length, 1, "no repeat without danger");
  const { sim, enemy } = duel();
  enemy.aware = true; enemy.state = "recover"; enemy.stateAt = sim.t; sim.player.y = 330;
  const events = run(sim, 1000, { primaryHeld: true, primaryPressed: true });
  const flares = events.filter(event => event.type === "flare");
  assert.strictEqual(flares.length, 3, `${flares.length} flares in 1 s`);
  assert.ok(flares[1].t - flares[0].t >= D.FLARE_TOTAL_MS - 1e-6);
});

// ---------- Tuck ----------
test("Tuck travels about 40 units in 200 ms with 160 ms protection and a 650 ms cooldown", () => {
  const sim = openSim();
  const events = run(sim, D.STEP_MS, { secondaryPressed: true, moveX: 1 });
  assert.ok(events.some(event => event.type === "tuck"));
  const start = sim.player.act.start;
  near(sim.player.protectUntil - start, 160, 1e-6, "protection");
  near(sim.player.tuckReadyAt - start, 650, 1e-6, "cooldown");
  run(sim, 200, {});
  near(sim.player.x - 170, 40, 0.01, "travel");
  const again = run(sim, 200, { secondaryPressed: true });
  assert.ok(!again.some(event => event.type === "tuck"), "cooldown holds");
});
test("holding Secondary does not repeat Tuck", () => {
  const sim = openSim();
  const events = run(sim, 2000, { secondaryPressed: true, secondaryHeld: true });
  assert.strictEqual(events.filter(event => event.type === "tuck").length, 1);
});
test("the stamina edge shortens Tuck cooldown by at most 15%", () => {
  const sim = openSim({ edges: D.edges({ stamina: 1e9 }) });
  run(sim, D.STEP_MS, { secondaryPressed: true });
  near(sim.player.tuckReadyAt - sim.player.act.start, 650 * 0.85, 0.01, "cooldown");
});
test("Tuck cannot cancel Flare anticipation/impact but can cancel its recovery", () => {
  const sim = openSim();
  run(sim, D.STEP_MS, { primaryPressed: true });
  const start = sim.player.act.start;
  run(sim, 50, {});
  assert.ok(!D.tuckLegal(sim), "anticipation");
  run(sim, start + 150 - sim.t, {});
  assert.ok(!D.tuckLegal(sim), "active");
  run(sim, start + 210 - sim.t, {});
  assert.ok(D.tuckLegal(sim), "recovery");
});
test("a Secondary press buffers for 120 ms until Tuck becomes legal", () => {
  const late = openSim();
  run(late, D.STEP_MS, { primaryPressed: true });
  const start = late.player.act.start;
  run(late, start + 110 - late.t, {});
  const events = run(late, D.STEP_MS, { secondaryPressed: true });
  const more = run(late, 150, {});
  const tuck = [...events, ...more].find(event => event.type === "tuck");
  assert.ok(tuck && tuck.t >= start + 200 - 1e-6 && tuck.t <= start + 200 + D.STEP_MS + 1e-6, `tuck at ${tuck && tuck.t - start}`);
  const early = openSim();
  run(early, D.STEP_MS, { primaryPressed: true });
  run(early, D.STEP_MS, { secondaryPressed: true });
  assert.ok(!run(early, 400, {}).some(event => event.type === "tuck"), "an expired buffer does nothing");
});
test("when both become legal together, Secondary wins", () => {
  const sim = openSim();
  const events = run(sim, D.STEP_MS, { primaryPressed: true, secondaryPressed: true });
  assert.deepStrictEqual(events.map(event => event.type), ["tuck"]);
});

// ---------- Draftling ----------
test("Draftling: notices, draws back 850 ms, lunges about 48 units in 240 ms, recovers 700 ms", () => {
  const { sim, enemy } = duel();
  sim.player.x = 60; sim.player.y = 300; // out of the lunge line, inside detection
  enemy.x = 120; enemy.y = 260; enemy.homeX = 120; enemy.homeY = 260;
  const events = run(sim, 2400, {});
  const at = type => events.find(event => event.type === type)?.t;
  assert.ok(at("notice") !== undefined, "noticed");
  near(at("lunge") - at("notice"), 850, D.STEP_MS + 1e-6, "draw back");
  assert.ok(at("lock") - at("notice") < 850, "the line commits before the lunge");
  const lungeEvents = run(D.createSim({ roomId: "clatter" }), 0);
  assert.deepStrictEqual(lungeEvents, []);
});
test("the lunge follows the committed line without tracking", () => {
  const { sim, enemy } = duel();
  sim.player.x = 176; sim.player.y = 270;
  enemy.state = "windup"; enemy.stateAt = sim.t; enemy.aware = true; enemy.aimX = 0; enemy.aimY = 1; enemy.locked = true;
  sim.enemies[0].stateAt = sim.t - 840;
  run(sim, 40, {});
  assert.strictEqual(enemy.state, "lunge");
  sim.player.x = 60; // dodge sideways mid-lunge
  run(sim, 260, {});
  assert.strictEqual(enemy.state, "recover");
  near(enemy.x, enemy.lungeFromX, 0.01, "no tracking");
  near(enemy.y - enemy.lungeFromY, 48, 0.01, "lunge distance");
});
test("Gentler timing lengthens the draw back by 35% and hurt protection to 1000 ms", () => {
  const { sim, enemy } = duel({ assist: true });
  sim.player.x = 60; sim.player.y = 300;
  enemy.x = 120; enemy.y = 260; enemy.homeX = 120; enemy.homeY = 260;
  const events = run(sim, 2400, {});
  const at = type => events.find(event => event.type === type)?.t;
  near(at("lunge") - at("notice"), 850 * 1.35, D.STEP_MS + 1e-6, "assisted draw back");
  const hurt = duel({ assist: true });
  hurt.enemy.state = "lunge"; hurt.enemy.stateAt = hurt.sim.t; hurt.enemy.x = hurt.sim.player.x; hurt.enemy.y = hurt.sim.player.y - 10; hurt.enemy.aimX = 0; hurt.enemy.aimY = 1;
  const hit = run(hurt.sim, D.STEP_MS * 2, {}).find(event => event.type === "hurt");
  near(hurt.sim.player.hurtUntil - hit.t, 1000, 1e-6, "assist protection");
});
test("no contact damage outside the lunge; hurt protection prevents chain hits", () => {
  const { sim, enemy } = duel();
  enemy.state = "recover"; enemy.stateAt = sim.t; enemy.x = sim.player.x; enemy.y = sim.player.y;
  assert.ok(!run(sim, 300, {}).some(event => event.type === "hurt"), "touching a recovering Draftling is safe");
  enemy.state = "lunge"; enemy.stateAt = sim.t;
  const events = run(sim, 240, {});
  assert.strictEqual(events.filter(event => event.type === "hurt").length, 1);
  near(sim.player.hurtUntil - events.find(event => event.type === "hurt").t, 750, 1e-6, "protection");
});
test("Tuck protection carries the Rizo through a lunge", () => {
  const { sim, enemy } = duel();
  enemy.state = "lunge"; enemy.stateAt = sim.t; enemy.x = sim.player.x; enemy.y = sim.player.y - 20; enemy.aimX = 0; enemy.aimY = 1;
  const events = run(sim, 160, { secondaryPressed: true, moveX: 1 });
  assert.ok(events.some(event => event.type === "tuck") && !events.some(event => event.type === "hurt"));
});
test("a lethal Flare resolves before a same-step hit", () => {
  const { sim, enemy } = duel();
  sim.player.fx = 0; sim.player.fy = -1;
  enemy.hp = 2; enemy.aware = true;
  sim.player.act = { kind: "flare", start: sim.t - 100, id: 9, fx: 0, fy: -1, hit: [] };
  enemy.state = "lunge"; enemy.stateAt = sim.t; enemy.x = sim.player.x; enemy.y = sim.player.y - 12; enemy.aimX = 0; enemy.aimY = 1;
  const events = D.step(sim, {});
  assert.ok(events.some(event => event.type === "calmed") && !events.some(event => event.type === "hurt"), JSON.stringify(events));
});

// ---------- Kindle, death, rest ----------
test("Kindle takes about 1.2 s at the hearth and Secondary cancels it safely", () => {
  const sim = D.createSim({ roomId: "hearth", flags: { latchFreed: true } });
  const hearth = D.room("hearth").hearth;
  sim.player.x = hearth.x + 20; sim.player.y = hearth.y;
  assert.strictEqual(D.focusTarget(sim)?.id, hearth.id);
  const events = run(sim, 1250, { primaryPressed: true });
  const start = events.find(event => event.type === "kindle-start").t, done = events.find(event => event.type === "kindled").t;
  near(done - start, 1200, D.STEP_MS + 1e-6, "kindle");
  run(sim, D.STEP_MS, { primaryPressed: true });
  const cancel = run(sim, 300, { secondaryPressed: true });
  assert.ok(cancel.some(event => event.type === "kindle-cancel") && !cancel.some(event => event.type === "tuck") && !cancel.some(event => event.type === "kindled"));
});
test("Primary means Flare while an encounter is live, interaction once it ends", () => {
  const sim = D.createSim({ roomId: "clatter" });
  sim.player.x = 284; sim.player.y = 382;
  assert.strictEqual(D.focusTarget(sim)?.id, "ticket-stub");
  sim.enemies[0].aware = true;
  assert.strictEqual(D.focusTarget(sim), null);
  assert.ok(run(sim, D.STEP_MS, { primaryPressed: true }).some(event => event.type === "flare"));
});
test("Flame 0 brings the Rizo down; respawn returns full Flame and resets ordinary enemies", () => {
  const { sim, enemy } = duel();
  sim.player.flame = 1;
  enemy.state = "lunge"; enemy.stateAt = sim.t; enemy.x = sim.player.x; enemy.y = sim.player.y - 12; enemy.aimX = 0; enemy.aimY = 1;
  const events = run(sim, 1300, {});
  assert.ok(events.some(event => event.type === "down") && events.some(event => event.type === "respawn-ready"));
  near(events.find(event => event.type === "respawn-ready").t - events.find(event => event.type === "down").t, T.DOWN_MS, D.STEP_MS + 1e-6, "down time");
  const back = D.respawn(sim, { roomId: "clatter", anchorId: "clatter-entry" });
  assert.strictEqual(back.player.flame, T.FLAME_MAX);
  assert.strictEqual(back.enemies.length, 1);
  assert.strictEqual(back.enemies[0].hp, 4);
  assert.strictEqual(back.phase, "play");
});
test("rest restores Flame and returns ordinary enemies", () => {
  const { sim, enemy } = duel();
  enemy.state = "gone"; sim.cleared = [enemy.id]; sim.player.flame = 2;
  D.rest(sim);
  assert.strictEqual(sim.player.flame, 5);
  assert.strictEqual(sim.enemies[0].state, "idle");
  assert.deepStrictEqual(sim.cleared, []);
});

// ---------- holds ----------
test("pause holds: background → ad → visible → ad-end still needs a fresh Resume", () => {
  let holds = [];
  holds = D.holdsSuspend(holds, "background");
  holds = D.holdsSuspend(holds, "ad");
  holds = D.holdsResume(holds, "visible");
  assert.deepStrictEqual(holds, ["ad", "manual"]);
  holds = D.holdsResume(holds, "ad");
  assert.deepStrictEqual(holds, ["manual"]);
  assert.deepStrictEqual(D.holdsPlayerResume(holds), []);
});
test("pause holds: lifecycle aliases normalize, and release strings need not match", () => {
  for (const reason of ["background", "hidden", "pagehide", "freeze", "unload"]) assert.strictEqual(D.holdForSuspend(reason), "background");
  for (const reason of ["visible", "pageshow", "resume"]) assert.strictEqual(D.holdForResume(reason), "background");
  let holds = D.holdsSuspend([], "pagehide");
  holds = D.holdsResume(holds, "visible");
  assert.deepStrictEqual(holds, ["manual"]);
  assert.strictEqual(D.holdForSuspend("force-update"), "update");
});
test("pause holds: save-blocked is never released by a resume or by the player", () => {
  let holds = D.holdsSuspend([], "save-blocked");
  for (const reason of ["visible", "pageshow", "resume", "ad", "save-blocked", "manual"]) holds = D.holdsResume(holds, reason);
  holds = D.holdsPlayerResume(holds);
  assert.deepStrictEqual(holds, ["save-blocked"]);
});
test("pause holds: the player's Resume clears manual, performance and a failed update only", () => {
  let holds = D.holdsSuspend([], "force-update");
  holds = D.holdsSuspend(holds, "performance");
  holds = D.holdsSuspend(holds, "ad");
  assert.deepStrictEqual(D.holdsPlayerResume(holds), ["ad"]);
});

// ---------- slice ----------
const pet = { id: "PET-1", name: "MOSSY", skills: { speed: 20 }, careSummary: { favoriteFood: null, favoriteGameId: null, bondBand: "familiar" } };
test("a new campaign binds the pet, starts in the parked car and stays small", () => {
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  assert.strictEqual(data.campaign.petId, "PET-1");
  assert.strictEqual(data.campaign.kind, "proof");
  assert.strictEqual(data.campaign.contentRevision, "threshold-v3");
  assert.deepStrictEqual(data.continuation, { roomId: "car", safeAnchorId: "seat", roomEntryFlame: 5, resumeKind: "opening" });
  assert.strictEqual(data.proofComplete, false);
  assert.strictEqual(data.storyComplete, false);
  assert.ok(JSON.stringify(data).length < 50_000);
  assert.throws(() => D.newCampaign({ pet, id: "x" }));
});
test("normalizeSlice: empty, ok, and a round trip keeps everything", () => {
  assert.strictEqual(D.normalizeSlice({}).status, "empty");
  assert.strictEqual(D.normalizeSlice(null).status, "empty");
  const data = { ...D.newCampaign({ pet, id: "threshold-abc123" }), settings: { assist: true, textSpeed: "instant" } };
  const result = D.normalizeSlice(data);
  assert.strictEqual(result.status, "ok");
  assert.deepStrictEqual(D.normalizeSlice(result.data).data, result.data);
  assert.deepStrictEqual(result.data.settings, { assist: true, textSpeed: "instant" });
});
test("an unknown location is repaired to a safe anchor without resetting the campaign", () => {
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  data.checkpoint = { hearthId: "threshold-hearth", roomId: "hearth", spawnAnchorId: "hearth-side" };
  data.continuation = { roomId: "nowhere", safeAnchorId: "void", roomEntryFlame: 3, resumeKind: "room-entry" };
  data.journal.discoveredEntryIds = ["ticket-stub"];
  const result = D.normalizeSlice(data);
  assert.strictEqual(result.status, "repaired");
  assert.deepStrictEqual(result.data.continuation, { roomId: "hearth", safeAnchorId: "hearth-side", roomEntryFlame: 5, resumeKind: "hearth" });
  assert.strictEqual(result.data.campaign.id, "threshold-abc123");
  assert.deepStrictEqual(result.data.journal.discoveredEntryIds, ["ticket-stub"]);
});
test("numeric bounds and unknown ids are clamped on entry", () => {
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  data.continuation.roomEntryFlame = 99;
  data.legProfile.edges = { speed: 50, power: 50, instinct: 50, stamina: -4 };
  data.world.defeatedEncounters = ["clatter-draftling", "made-up"];
  data.world.visitedRooms = ["clatter", "moon"];
  const out = D.normalizeSlice(data).data;
  assert.strictEqual(out.continuation.roomEntryFlame, 5);
  assert.deepStrictEqual(out.legProfile.edges, { speed: 1.08, power: 1.12, instinct: 1.2, stamina: 0.85 });
  assert.deepStrictEqual(out.world.defeatedEncounters, ["clatter-draftling"]);
  assert.deepStrictEqual(out.world.visitedRooms, ["clatter"]);
});
test("a newer or unknown content revision is preserved untouched", () => {
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  data.campaign.contentRevision = "threshold-v9";
  data.world.visitedRooms = ["clatter", "observatory"];
  const result = D.normalizeSlice(data);
  assert.strictEqual(result.status, "unsupported");
  assert.deepStrictEqual(result.data, clone(data));
});
test("death returns to the registered hearth, or where he landed before one", () => {
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  assert.deepStrictEqual(D.safeReturn(data), { roomId: "car", anchorId: "seat", resumeKind: "opening" });
  data.story.committedSceneBeats.push("opening:below");
  assert.deepStrictEqual(D.safeReturn(data), { roomId: "slip", anchorId: "landing", resumeKind: "room-entry" });
  data.checkpoint = { hearthId: "threshold-hearth", roomId: "hearth", spawnAnchorId: "hearth-side" };
  assert.deepStrictEqual(D.safeReturn(data), { roomId: "hearth", anchorId: "hearth-side", resumeKind: "hearth" });
});
test("summary publishes only labels and a journey; never ENDLESS/energy", () => {
  assert.deepStrictEqual(D.summary({}), { bestLabel: "NEW", unit: "journey", badge: null, entryLabel: "FREE", lengthLabel: "~10 MIN", journey: null });
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  const summary = D.summary(data);
  assert.deepStrictEqual(Object.keys(summary).sort(), ["badge", "bestLabel", "entryLabel", "journey", "lengthLabel", "unit"]);
  assert.deepStrictEqual(summary.journey, { petId: "PET-1", petName: "MOSSY", status: "active", complete: false });
  assert.strictEqual(summary.bestLabel, "OUTSIDE");
  data.world.visitedRooms.push("slip", "clatter");
  assert.strictEqual(D.summary(data).bestLabel, "ROOM 2/6");
  data.proofComplete = true;
  assert.strictEqual(D.summary(data).bestLabel, "ROOM 2/6", "the First Knot alone is not home: the campaign goes on");
  assert.deepStrictEqual(D.summary(data).badge, { text: "KNOT", title: "Carries Latch's First Knot" });
  data.campaign.status = "complete";
  assert.strictEqual(D.summary(data).bestLabel, "HOME", "a proof journey that walked home stays complete");
  assert.strictEqual(D.summary(data).journey.complete, true);
  data.world.visitedRooms.push("receiving", "drytable");
  assert.strictEqual(D.summary(data).bestLabel, "ROWS 2/10", "a journey that went on through the Porter's door shows how far it went");
});


// ---------- Run 2: the opening, rooms, the Threshold's enemies ----------
test("in the parked car the Rizo moves only inside the cabin: seats, dash, window, YOU", () => {
  const sim = D.createSim({ roomId: "car" });
  assert.deepStrictEqual([sim.player.x, sim.player.y], [203, 252], "he starts on the passenger seat");
  run(sim, 3000, { moveX: 1 });
  assert.ok(sim.player.x <= 213.5, "the passenger door holds");
  const toDash = run(sim, 3000, { moveY: -1 });
  assert.ok(sim.player.y <= 206 && toDash.some(event => event.type === "zone" && event.id === "dash"), "up to the dash, nose to the windshield");
  run(sim, 3000, { moveX: -1 });
  assert.ok(sim.player.x >= 172 + 7 - 0.5, "YOU, in the driver's seat, is in the way");
  sim.flags = { youGone: true };
  run(sim, 3000, { moveX: -1 });
  assert.ok(sim.player.x < 160, "with YOU gone the driver's seat is his too");
  const back = D.createSim({ roomId: "car" });
  run(back, 4000, { moveY: 1 });
  assert.ok(back.player.y <= 321.5, "the back bench, and no further");
  const props = id => D.interactables({ ...back, flags: id }).map(item => item.id);
  assert.deepStrictEqual(props({}), ["you"]);
  assert.deepStrictEqual(props({ youGone: true }), ["store-window"]);
  assert.deepStrictEqual(props({ youGone: true, threat: true }), [], "nothing to look at once they come");
});
test("the drain goes back too far: concrete, brick, rock, then a slope into nothing", () => {
  const drain = D.room("drain");
  assert.deepStrictEqual(drain.anchors.mouth, { x: 120, y: 720 });
  const sim = D.createSim({ roomId: "drain", anchorId: "mouth" });
  const events = run(sim, 12000, { moveY: -1 });
  assert.ok(events.some(event => event.type === "zone" && event.id === "slope"), "walking inward reaches the slope");
  assert.ok(D.room("drain").props.some(prop => prop.id === "warm-air" && prop.lines[0] === "Warm air. From down there."));
});
test("exits fire once, only after stepping clear; zones report entry", () => {
  const sim = D.createSim({ roomId: "slip", anchorId: "slip-north" });
  const first = run(sim, 500, { moveY: -1 });
  const exit = first.find(event => event.type === "exit");
  assert.ok(exit && exit.to === "clatter" && exit.anchor === "clatter-entry");
  assert.strictEqual(first.filter(event => event.type === "exit").length, 1);
  const hem = D.createSim({ roomId: "hem" });
  hem.player.x = 160; hem.player.y = 300;
  const zones = run(hem, 300, { moveY: -1 });
  assert.ok(zones.some(event => event.type === "zone" && event.id === "latch-approach"));
});
test("the jammed gate holds until Latch is freed; warming it is a Kindle", () => {
  const sim = D.createSim({ roomId: "hem" });
  sim.player.x = 160; sim.player.y = 240;
  run(sim, 1500, { moveY: -1 });
  assert.ok(sim.player.y > 212, "the gate stops him");
  sim.player.x = 150; sim.player.y = 230;
  assert.strictEqual(D.focusTarget(sim)?.id, "latch-jam");
  const events = run(sim, 1300, { primaryPressed: true });
  const done = events.find(event => event.type === "kindled");
  assert.ok(done && done.targetKind === "warm" && done.targetId === "latch-jam");
  const freed = D.createSim({ roomId: "hem", flags: { latchFreed: true } });
  freed.player.x = 160; freed.player.y = 240;
  run(freed, 1500, { moveY: -1 });
  assert.ok(freed.player.y < 150, "the gate is open once latchFreed");
  assert.strictEqual(D.interactables(freed).some(item => item.id === "latch-jam"), false);
});
test("Needle: a 10-wide lane shown for 1000 ms, a 120 ms pulse, a 1000 ms rest; cover stops it", () => {
  const sim = D.createSim({ roomId: "queue" });
  sim.enemies = sim.enemies.filter(enemy => enemy.kind === "needle");
  sim.player.x = 160; sim.player.y = 220;
  const events = run(sim, 1300, {});
  const at = type => events.find(event => event.type === type)?.t;
  near(at("pulse") - at("lane"), 1000, D.STEP_MS + 1e-6, "indicate");
  assert.ok(events.some(event => event.type === "hurt"), "standing in the lane hurts");
  const covered = D.createSim({ roomId: "queue" });
  covered.enemies = covered.enemies.filter(enemy => enemy.kind === "needle");
  const needle = covered.enemies[0];
  needle.aware = true; needle.state = "indicate"; needle.stateAt = 0; needle.aimX = 0; needle.aimY = 1;
  needle.laneLength = D.rayLength(D.geoOf(covered), 160, 93, 0, 1, 300);
  covered.player.x = 108; covered.player.y = 330; // behind post-c, out of the lane
  assert.ok(!run(covered, 300, {}).some(event => event.type === "hurt"));
  const blocked = D.rayLength(D.geoOf(covered), 108, 100, 0, 1, 300);
  assert.ok(blocked < 200, `a post stops the lane at ${blocked}`);
});
test("the van's cooler bumps but never burns, and Tuck slips it", () => {
  const sim = D.createSim({ roomId: "van" });
  D.spawnCargo(sim, { id: "c1", x: 26, y: sim.player.y, aimX: 1, aimY: 0 });
  const events = run(sim, 1400, {});
  assert.ok(events.some(event => event.type === "bump"));
  assert.strictEqual(sim.player.flame, 5);
  const done = events.find(event => event.type === "cargo-done");
  assert.strictEqual(done.dodged, false);
  const dodge = D.createSim({ roomId: "van" });
  D.spawnCargo(dodge, { id: "c2", x: 26, y: dodge.player.y, aimX: 1, aimY: 0 });
  run(dodge, 900, {});
  const later = run(dodge, 600, { secondaryPressed: true, moveY: 1 });
  assert.ok(later.find(event => event.type === "cargo-done").dodged);
});
function porterSim(flags = {}) {
  const sim = D.createSim({ roomId: "porter", flags });
  const porter = sim.enemies[0];
  return { sim, porter };
}
test("Night Porter: wakes, then alternates a 950 ms sweep tell and an 850 ms charge tell", () => {
  const { sim } = porterSim();
  sim.player.x = 180; sim.player.y = 190;
  const events = run(sim, 8000, {});
  const at = type => events.find(event => event.type === type)?.t;
  near(at("sweep") - at("sweep-tell"), 950, D.STEP_MS + 1e-6, "sweep tell");
  near(at("charge") - at("charge-tell"), 850, D.STEP_MS + 1e-6, "charge tell");
  assert.ok(at("sweep-tell") < at("charge-tell"));
});
test("Night Porter: the closed coat deflects Flare; the open hem takes damage", () => {
  const { sim, porter } = porterSim();
  porter.aware = true; porter.state = "reposition"; porter.stateAt = sim.t; porter.fromX = porter.x; porter.fromY = porter.y; porter.nextMove = "sweep";
  sim.player.x = porter.x; sim.player.y = porter.y + 30; sim.player.fx = 0; sim.player.fy = -1;
  const shut = run(sim, 330, { primaryPressed: true });
  assert.ok(shut.some(event => event.type === "deflect") && porter.hp === 28);
  porter.state = "open"; porter.stateAt = sim.t; porter.openFor = 5000;
  const open = run(sim, 330, { primaryPressed: true });
  assert.ok(open.some(event => event.type === "hit") && porter.hp === 26);
});
test("Night Porter: help is asked once at 14 HP, never again once committed; it settles at 0", () => {
  const { sim, porter } = porterSim();
  porter.aware = true; porter.state = "open"; porter.stateAt = sim.t; porter.openFor = 9000; porter.hp = 15;
  sim.player.x = porter.x; sim.player.y = porter.y + 30; sim.player.fx = 0; sim.player.fy = -1;
  const half = run(sim, 330, { primaryPressed: true });
  assert.ok(half.some(event => event.type === "porter-half"));
  assert.strictEqual(porter.state, "reposition", "its hazard ends for the beat");
  const helped = porterSim({ porterHelp: true, alcoveOpen: true });
  helped.porter.aware = true; helped.porter.state = "open"; helped.porter.stateAt = 0; helped.porter.openFor = 9000; helped.porter.hp = 15;
  helped.sim.player.x = helped.porter.x; helped.sim.player.y = helped.porter.y + 30; helped.sim.player.fx = 0; helped.sim.player.fy = -1;
  assert.ok(!run(helped.sim, 330, { primaryPressed: true }).some(event => event.type === "porter-half"));
  helped.porter.hp = 2; helped.porter.state = "open"; helped.porter.stateAt = helped.sim.t;
  const down = run(helped.sim, 330, { primaryPressed: true });
  assert.ok(down.some(event => event.type === "porter-down") && helped.porter.state === "settled");
  assert.ok(helped.sim.defeated.includes("night-porter"));
  assert.ok(!run(helped.sim, 2000, {}).some(event => event.type === "hurt"), "no hidden hits after the last Flare");
});
test("the alcove shelters from the sweep once opened", () => {
  const { sim, porter } = porterSim({ alcoveOpen: true });
  porter.aware = true; porter.state = "sweep"; porter.stateAt = sim.t; porter.bandY = 142; porter.sweepDir = 1;
  sim.player.x = 25; sim.player.y = 142;
  assert.ok(D.inAlcove(sim));
  assert.ok(!run(sim, 350, {}).some(event => event.type === "hurt"));
});
test("a durable defeat never respawns; ordinary enemies return on rest", () => {
  const sim = D.createSim({ roomId: "porter", defeated: ["night-porter"] });
  assert.strictEqual(sim.enemies.length, 0);
  const queue = D.createSim({ roomId: "queue", cleared: ["queue-draftling"] });
  assert.deepStrictEqual(queue.enemies.map(enemy => enemy.id), ["queue-needle"]);
  D.rest(queue);
  assert.strictEqual(queue.enemies.length, 2);
});
test("a Gate 1 review campaign is carried into The Threshold explicitly", () => {
  const gate1 = { settings: { assist: true, textSpeed: "instant" }, campaign: { id: "threshold-old123", kind: "proof", contentRevision: "threshold-gate1", petId: "PET-1", petName: "MOSSY", status: "active", chapterId: "threshold" }, world: { visitedRooms: ["clatter"] }, checkpoint: { hearthId: "clatter-review-hearth", roomId: "clatter", spawnAnchorId: "clatter-hearth-side" }, continuation: { roomId: "clatter", safeAnchorId: "clatter-hearth-side", roomEntryFlame: 5, resumeKind: "hearth" }, journal: { discoveredEntryIds: ["ticket-stub"] } };
  const result = D.normalizeSlice(gate1);
  assert.strictEqual(result.status, "migrated");
  assert.strictEqual(result.data.campaign.id, "threshold-old123");
  assert.strictEqual(result.data.campaign.petId, "PET-1");
  assert.strictEqual(result.data.campaign.contentRevision, "threshold-v3");
  assert.deepStrictEqual(result.data.settings, { assist: true, textSpeed: "instant" });
  assert.deepStrictEqual(result.data.journal.discoveredEntryIds, ["ticket-stub"]);
  assert.strictEqual(result.data.continuation.roomId, "car");
  assert.strictEqual(result.data.checkpoint.hearthId, null);
});
test("story facts, choices and beats are validated against known ids", () => {
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  data.story.facts = { sharedRest: true, latchFreed: "yes", madeUp: true };
  data.story.choices = { "hearth-seat": "sit", other: "x" };
  data.world.durableRoomFlags = { shortcutOpen: true, teleport: true };
  data.npcs.latch = { state: "gifted", locationAnchor: "porter-door", evidence: ["rescue", "Bad Id"] };
  const out = D.normalizeSlice(data).data;
  assert.deepStrictEqual(out.story.facts, { sharedRest: true });
  assert.deepStrictEqual(out.story.choices, { "hearth-seat": "sit" });
  assert.deepStrictEqual(out.world.durableRoomFlags, { shortcutOpen: true });
  assert.deepStrictEqual(out.npcs.latch.evidence, ["rescue"]);
  assert.deepStrictEqual(D.flagsOf(out), { shortcutOpen: true, sharedRest: true });
});

// ---------- v0.3: the threshold-v1 → threshold-v2 migration ----------
function v1Save(mutate) {
  const data = D.newCampaign({ pet, id: "threshold-rc2abc" });
  data.campaign.contentRevision = "threshold-v1";
  data.world.visitedRooms = ["curb"];
  data.continuation = { roomId: "curb", safeAnchorId: "start", roomEntryFlame: 5, resumeKind: "opening" };
  mutate?.(data);
  return clone(data);
}
test("an RC2 journey still at the curb becomes the same journey in the car, nothing reset", () => {
  const raw = v1Save(data => { data.settings = { assist: true, textSpeed: "instant" }; data.journal.discoveredEntryIds = ["puddle"]; });
  const result = D.normalizeSlice(raw);
  assert.strictEqual(result.status, "migrated");
  assert.deepStrictEqual(result.notes, ["migrated-from-v1"]);
  assert.strictEqual(result.data.campaign.id, "threshold-rc2abc");
  assert.strictEqual(result.data.campaign.contentRevision, "threshold-v3");
  assert.deepStrictEqual(result.data.continuation, { roomId: "car", safeAnchorId: "seat", roomEntryFlame: 5, resumeKind: "opening" });
  assert.deepStrictEqual(result.data.world.visitedRooms, ["car"]);
  assert.deepStrictEqual(result.data.settings, { assist: true, textSpeed: "instant" });
  assert.deepStrictEqual(result.data.journal.discoveredEntryIds, ["puddle"]);
  assert.strictEqual(D.normalizeSlice(result.data).status, "ok", "migrated once; afterwards it is an ordinary v2 save");
});
test("RC2 journeys mid-opening keep every committed beat and their room", () => {
  for (const [roomId, anchor, beats] of [["van", "start", ["opening:taken"]], ["roadside", "fallen", ["opening:taken", "opening:fell"]], ["drain", "mouth", ["opening:taken", "opening:fell"]], ["roadside", "drain-front", ["opening:taken", "opening:fell"]]]) {
    const raw = v1Save(data => { data.world.visitedRooms = ["curb", "van", roomId]; data.story.committedSceneBeats = [...beats]; data.continuation = { roomId, safeAnchorId: anchor, roomEntryFlame: 5, resumeKind: "opening" }; });
    const result = D.normalizeSlice(raw);
    assert.strictEqual(result.status, "migrated", roomId);
    assert.deepStrictEqual(result.data.story.committedSceneBeats, beats, `${roomId}: beats kept`);
    assert.deepStrictEqual(result.data.continuation, raw.continuation, `${roomId}: same room and anchor`);
    assert.deepStrictEqual(result.data.world.visitedRooms, ["car", "van", roomId].filter((id, index, list) => list.indexOf(id) === index));
  }
});
test("RC2 journeys below keep hearth, facts, choices, Latch and rewards exactly", () => {
  const raw = v1Save(data => {
    data.world.visitedRooms = ["curb", "van", "roadside", "drain", "slip", "clatter", "hem", "hearth"];
    data.world.durableRoomFlags = { latchFreed: true, shortcutOpen: true };
    data.world.openedShortcuts = ["hearth-queue"];
    data.story.facts = { jamInspected: true, hearthArrived: true, seatChosen: true, sharedRest: true };
    data.story.choices = { "hearth-seat": "sit" };
    data.story.committedSceneBeats = ["opening:taken", "opening:fell", "opening:below", "latch-rescue:freed", "hearth-seat:sit"];
    data.npcs.latch = { state: "waiting-hearth", locationAnchor: "hearth-latch", evidence: ["rescue"] };
    data.checkpoint = { hearthId: "threshold-hearth", roomId: "hearth", spawnAnchorId: "hearth-side" };
    data.continuation = { roomId: "queue", safeAnchorId: "queue-entry", roomEntryFlame: 3, resumeKind: "room-entry" };
    data.pendingRewards = [{ receiptId: "threshold-rc2abc:threshold-complete", entitlements: ["first-knot"] }];
  });
  const out = D.normalizeSlice(raw).data;
  for (const key of ["story", "npcs", "checkpoint", "continuation", "pendingRewards", "legProfile", "inventory", "journal"]) assert.deepStrictEqual(out[key], raw[key], key);
  assert.deepStrictEqual(out.world.durableRoomFlags, raw.world.durableRoomFlags);
  assert.deepStrictEqual(out.world.visitedRooms, ["car", "van", "roadside", "drain", "slip", "clatter", "hem", "hearth"]);
  assert.strictEqual(D.summary(raw).bestLabel, "ROOM 4/6", "the shelf card reads the migrated journey");
});
test("callerConnected is the one new opening fact: allowlisted, persisted, never invented", () => {
  assert.ok(Content.FLAGS.includes("callerConnected"));
  assert.ok(!Content.FLAGS.includes("jumpedGap"), "the gap is never persisted");
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  data.story.facts = { callerConnected: true, jumpedGap: true };
  data.story.committedSceneBeats = ["opening:left", "opening:taken", "opening:fell", "opening:searched", "opening:phone", "opening:below", "thought:home"];
  const out = D.normalizeSlice(data).data;
  assert.deepStrictEqual(out.story.facts, { callerConnected: true });
  assert.deepStrictEqual(out.story.choices, {}, "it is a fact, not a menu choice");
  assert.deepStrictEqual(out.story.committedSceneBeats, data.story.committedSceneBeats, "every new beat token is valid");
  assert.deepStrictEqual(D.normalizeSlice(v1Save()).data.story.facts, {}, "a migrated RC2 save gets no phone fact");
});
test("a newer revision is still preserved untouched; a v1 save is never mistaken for one", () => {
  const future = v1Save(data => { data.campaign.contentRevision = "threshold-v9"; });
  assert.strictEqual(D.normalizeSlice(future).status, "unsupported");
  assert.deepStrictEqual(D.normalizeSlice(future).data, future);
  const badId = v1Save(data => { data.campaign.id = "not-a-threshold"; });
  assert.strictEqual(D.normalizeSlice(badId).status, "unsupported");
});

// ---------- Chapter 1: Mending Rows ----------
test("the Porter's door now opens into the Mending Rows, and the rows connect both ways", () => {
  const door = D.room("porter").exits.find(exit => exit.id === "porter-to-rows");
  assert.deepStrictEqual([door.to, door.anchor, door.openWhen], ["receiving", "receiving-entry", "porterDown"]);
  assert.ok(!D.room("porter").exits.some(exit => exit.to === "home"), "no shortcut home from the proof door any more");
  const links = new Set();
  for (const room of Object.values(Content.ROOMS)) for (const exit of room.exits) links.add(`${room.id}>${exit.to}`);
  for (const [a, b] of [["porter", "receiving"], ["receiving", "drytable"], ["drytable", "hangrow"], ["hangrow", "lowrun"], ["lowrun", "eyelet"], ["eyelet", "traypass"], ["traypass", "drytable"], ["eyelet", "press"], ["press", "upper"], ["upper", "stair"], ["stair", "drytable"], ["drytable", "windowgate"]]) {
    assert.ok(links.has(`${a}>${b}`) && links.has(`${b}>${a}`), `${a} <-> ${b}`);
  }
});
test("each Rows route opens through work, never through affection", () => {
  const gated = (roomId, exitId) => D.room(roomId).exits.find(exit => exit.id === exitId).openWhen;
  assert.strictEqual(gated("drytable", "table-to-rows"), "rowsCatch");
  assert.strictEqual(gated("hangrow", "rows-to-lowrun"), "rowsLowRoute");
  assert.strictEqual(gated("eyelet", "eyelet-to-tray"), "rowsGrille");
  assert.strictEqual(gated("eyelet", "eyelet-to-press"), "rowsPressOpen");
  assert.strictEqual(gated("press", "press-to-upper"), "rowsShutter");
  assert.strictEqual(gated("upper", "upper-to-stair"), "rowsStair");
  assert.strictEqual(gated("drytable", "table-to-window"), "rowsOnward", "Nell moves the sheets when she heads to the counter herself");
  for (const flag of ["rowsCatch", "rowsLowRoute", "rowsGrille", "rowsPressOpen", "rowsPressStop", "rowsBrake", "rowsShutter", "rowsStair", "rowsOnward"]) assert.ok(Content.ROOM_FLAGS.includes(flag) && Content.FLAGS.includes(flag), flag);
  const sim = D.createSim({ roomId: "drytable" });
  run(sim, 3000, { moveY: -1, moveX: 1 });
  assert.ok(sim.player.y > 20, "the onward doorway is blocked by the drying load until Nell moves it");
  assert.strictEqual(D.room("drytable").hearth.id, "rows-stove");
});
test("a threshold-v2 journey is carried into v3 untouched (rooms and facts were only added)", () => {
  const data = D.newCampaign({ pet, id: "threshold-v2abcd" });
  data.campaign.contentRevision = "threshold-v2";
  data.world.visitedRooms = ["car", "sack", "van", "roadside", "drain", "slip", "clatter", "hem", "hearth", "queue", "porter"];
  data.story.facts = { callerConnected: true, sharedRest: true, seatChosen: true, porterHelp: true };
  data.story.choices = { "hearth-seat": "sit" };
  data.world.durableRoomFlags = { latchFreed: true, porterDown: true, alcoveOpen: true };
  data.story.committedSceneBeats = ["opening:left", "opening:taken", "opening:fell", "opening:searched", "opening:phone", "opening:below", "thought:home", "knot-gift:granted"];
  data.continuation = { roomId: "porter", safeAnchorId: "porter-entry", roomEntryFlame: 5, resumeKind: "boss" };
  data.proofComplete = true; data.campaign.status = "homecoming-ready";
  const result = D.normalizeSlice(clone(data));
  assert.strictEqual(result.status, "migrated");
  assert.strictEqual(result.data.campaign.contentRevision, "threshold-v3");
  for (const key of ["world", "story", "continuation", "checkpoint", "npcs", "journal", "pendingRewards", "proofComplete"]) assert.deepStrictEqual(result.data[key], clone(data)[key], key);
});
test("Rows choices are allowlisted with their exact values; anything else is dropped", () => {
  const data = D.newCampaign({ pet, id: "threshold-abc123" });
  data.story.choices = { "hearth-seat": "sit", "rows-meal": "sit", "rows-wrap": "worn", "rows-trust": "high", "rows-wrap-2": "folded" };
  assert.deepStrictEqual(D.normalizeSlice(data).data.story.choices, { "hearth-seat": "sit", "rows-meal": "sit", "rows-wrap": "worn" });
  data.story.choices = { "rows-wrap": "burned", "rows-meal": "go" };
  assert.deepStrictEqual(D.normalizeSlice(data).data.story.choices, { "rows-meal": "go" });
  data.story.facts = { rowsLatchHelped: true, rowsChalk: true, rowsFriend: true };
  assert.deepStrictEqual(D.normalizeSlice(data).data.story.facts, { rowsLatchHelped: true, rowsChalk: true }, "no friendship score exists to be saved");
});

console.log(`\n${passed}/${total} dungeon core checks passed`);
