// Pure rules of the save core, the training contract and the game-mode contract.
const path = require("path");
const assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const Save = require(path.join(ROOT, "core/rizo-save-core.js"));
const Training = require(path.join(ROOT, "core/rizo-training.js"));
const Modes = require(path.join(ROOT, "core/rizo-modes.js"));
const golden = require(path.join(ROOT, "tests/fixtures/v1-signature-golden.json"));
const fixture = require(path.join(ROOT, "tests/fixtures/v86-live-checkpoint.json")).state;

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("PASS", name); }
  catch (error) { console.log("FAIL", name, "\n   ", error.message); process.exitCode = 1; }
}
const clone = value => JSON.parse(JSON.stringify(value));

// ---------- save core ----------
// golden: signatures the pre-v88 implementation (defense-core-v79.js) produced.
test("frozen v1 signature is byte-identical to the one every pre-v88 save used", () => {
  const states = [fixture, {}, { ...clone(fixture), wallet: { embers: "9e99" } }, { ...clone(fixture), scores: { ...fixture.scores, defense: 12000, power: 1e13 } }];
  for (const [index, state] of states.entries()) {
    for (const [column, savedAt] of golden.savedAts.entries()) {
      assert.strictEqual(Save.createStateSignatureV1(state, savedAt), golden.signatures[index][column], `state ${index} @ ${savedAt}`);
    }
  }
});
test("v1 envelopes written by older builds still verify, and edits are caught", () => {
  const envelope = { app: "RIZO LIFE", saveVersion: 1, stateVersion: 19, savedAt: 42, state: clone(fixture), signature: golden.envelope42 };
  assert(Save.verifyEnvelope(envelope));
  const edited = clone(envelope); edited.state.wallet.embers += 1;
  assert(!Save.verifyEnvelope(edited));
});
test("v2 envelope signs the whole state and every mode slice", () => {
  const envelope = Save.createEnvelope({ state: fixture, modes: { defense: { schema: 1, data: { best: 3 } } }, savedAt: 7, writeId: "W-1", stateVersion: 19 });
  const stored = JSON.parse(JSON.stringify(envelope));
  assert.strictEqual(stored.saveVersion, 2);
  assert(Save.verifyEnvelope(stored));
  const stateEdit = clone(stored); stateEdit.state.pet.name = "EDITED"; assert(!Save.verifyEnvelope(stateEdit));
  const modeEdit = clone(stored); modeEdit.modes.defense.data.best = 99; assert(!Save.verifyEnvelope(modeEdit));
  const writeIdOnly = clone(stored); writeIdOnly.writeId = "W-2"; assert(Save.verifyEnvelope(writeIdOnly), "writeId is bookkeeping, not signed data");
});
test("v2 signing survives values JSON cannot round-trip", () => {
  const state = { ...clone(fixture), odd: { when: new Date(5), set: new Set([1]), gone: undefined, inf: Infinity } };
  const stored = JSON.parse(JSON.stringify(Save.createEnvelope({ state, savedAt: 9 })));
  assert(Save.verifyEnvelope(stored));
});
test("unknown or newer envelope versions never verify", () => {
  const envelope = JSON.parse(JSON.stringify(Save.createEnvelope({ state: fixture, savedAt: 1 })));
  assert(!Save.verifyEnvelope({ ...envelope, saveVersion: 3 }));
  assert.strictEqual(Save.envelopeVersion({ ...envelope, saveVersion: 3 }), 3);
  assert(!Save.verifyEnvelope({ ...envelope, saveVersion: "x" }));
});
test("mode slices keep only well-formed ids and object data", () => {
  const modes = Save.normalizeModes({ defense: { schema: 2, data: { a: 1 } }, "Bad Id": { schema: 1, data: {} }, list: [], dungeon: { schema: "3", data: [1, 2] } });
  assert.deepStrictEqual(modes, { defense: { schema: 2, data: { a: 1 } }, dungeon: { schema: 3, data: {} } });
});
test("hub limits live in the save core; Defense keeps only its own", () => {
  const DefenseCore = require(path.join(ROOT, "modes/defense/defense-core.js"));
  assert.strictEqual(Save.LIMITS.MAX_ARCADE_SCORE, 1e9);
  assert.strictEqual(Save.LIMITS.MAX_WALLET_EMBERS, 50_000_000);
  for (const key of ["MAX_WALLET_EMBERS", "MAX_PLAYER_XP", "MAX_META_COUNTER"]) assert(!(key in DefenseCore.LIMITS), `${key} is a hub limit`);
  assert(!("createStateSignature" in DefenseCore), "the whole-save signature belongs to the save core");
});
// Moved from the Defense core tests in v88: the frozen v1 signature still
// covers every field the v87 one did, Defense history and mastery included.
const v1Envelope = (state, savedAt) => ({ app: "RIZO LIFE", saveVersion: 1, stateVersion: 18, savedAt, state, signature: Save.createStateSignatureV1(state, savedAt) });
test("v1 whole-save signatures detect progression edits", () => {
  const state = {version:18,player:{keeperId:'keeper-1',streak:4,totalSessions:8},wallet:{embers:321,shards:12},pet:{id:'p1',number:1,name:'RIZO',stage:'kid',variant:'classic',xp:400,bond:20,skills:{power:10},genes:{power:100}},inventory:{accessories:['none'],rooms:['rain'],phoenix:0,growth:0,care:0},collection:{classic:1},scores:{power:12,spark:9,defense:3,defenseMaps:{grove:3},defenseMilestones:[],defensePerfectMaps:[],defenseContracts:[],defenseHistory:[],defenseMastery:{}},farm:{roster:[],unlockedRooms:[0]},meta:{totalGames:2,totalHatched:1,totalTaps:5,capsules:0,rebirths:0,bondEggs:0},achievements:['origin'],daily:{date:'2026-07-31',type:'tap',progress:2,claimed:false,giftClaimed:false},season:{xp:10,level:1},expedition:{active:false},treasures:{},loreUnlocked:['keeper']};
  const envelope = v1Envelope(state, 123456);
  assert(Save.verifyEnvelope(envelope));
  state.wallet.embers = 999999;
  assert(!Save.verifyEnvelope(envelope));
});
test("v1 whole-save signatures cover arcade and unlock progression", () => {
  const state = {version:18,player:{keeperId:'keeper-1'},wallet:{embers:100,shards:0},pet:{id:'p1',number:1,name:'RIZO',stage:'egg',variant:'classic',skills:{},genes:{}},inventory:{accessories:['none'],rooms:['rain']},collection:{classic:1},scores:{power:10,defense:0,defenseMaps:{},defenseMilestones:[],defensePerfectMaps:[],defenseContracts:[],defenseHistory:[],defenseMastery:{}},farm:{roster:[],unlockedRooms:[0]},meta:{},achievements:[],daily:{},season:{level:1},expedition:{},treasures:{},loreUnlocked:['keeper']};
  const envelope = v1Envelope(state, 123456);
  state.scores.power = 999999;
  assert(!Save.verifyEnvelope(envelope));
});
test("v1 whole-save signature protects Defense history and mastery", () => {
  const state = {
    version:18, player:{keeperId:'keeper-qa',streak:0,totalSessions:1}, wallet:{embers:10,shards:0},
    pet:{id:'pet-main',number:1,name:'RIZO',stage:'kid',variant:'classic',xp:10,bond:10,skills:{},genes:{}},
    inventory:{accessories:[],rooms:[],phoenix:0,growth:0,care:0}, collection:{classic:1}, achievements:[],
    daily:{date:'2026-09-12',type:'tap',progress:0,claimed:false,giftClaimed:false}, season:{xp:0,level:1},
    expedition:{}, treasures:{}, farm:{activeRoom:0,unlockedRooms:[0],totalAdoptions:0,totalReleased:0,materials:0,roster:[]},
    meta:{totalGames:0,totalHatched:1,totalTaps:0,totalCareActions:0,totalWalks:0,deaths:0,recoveries:0,capsules:0,rebirths:0,bondEggs:0,pity:0,shadowFinds:0}, loreUnlocked:[],
    scores:{defense:10,defenseMaps:{grove:10},defenseMilestones:[],defensePerfectMaps:[],defenseContracts:[],
      defenseHistory:[{id:'run-1',mapId:'grove',clearedWave:10,reachedWave:10,kills:40,bosses:1,perfectWaveCount:8}],
      defenseMastery:{'pet-main':{runs:1,waves:10,bestWave:10,pops:40,damage:5000}}}
  };
  const envelope = v1Envelope(state, 1_726_154_000_000);
  assert(Save.verifyEnvelope(envelope));
  const historyTamper = clone(envelope); historyTamper.state.scores.defenseHistory[0].clearedWave = 20;
  assert(!Save.verifyEnvelope(historyTamper));
  const masteryTamper = clone(envelope); masteryTamper.state.scores.defenseMastery['pet-main'].waves = 999;
  assert(!Save.verifyEnvelope(masteryTamper));
});

// ---------- training contract ----------
const base = { id: "probe", duration: 30, energy: 10, par: 40, trains: { speed: 3, stamina: 1 }, care: { bond: 0.5, mood: 1, hunger: -6 } };
test("training definitions are validated at load", () => {
  assert.throws(() => Training.defineGame({ ...base, id: "Bad" }), /lowercase/);
  assert.throws(() => Training.defineGame({ ...base, duration: 5 }), /duration/);
  assert.throws(() => Training.defineGame({ ...base, par: 0 }), /par/);
  assert.throws(() => Training.defineGame({ ...base, trains: {} }), /at least one skill/);
  assert.throws(() => Training.defineGame({ ...base, trains: { charisma: 1 } }), /unknown skill/);
  const game = Training.defineGame(base);
  assert.deepStrictEqual(game.trains, { speed: 0.75, stamina: 0.25 });
  assert(Object.isFrozen(game));
});
test("a warm-up run earns nothing and costs nothing", () => {
  const game = Training.defineGame(base);
  for (const result of [{ score: 0 }, { score: 30, qualified: false }, { score: 30, inputs: 0 }, null]) {
    const gains = Training.convert(game, result);
    assert(!gains.qualified); assert.strictEqual(gains.embers, 0); assert.strictEqual(gains.energy, 0); assert.deepStrictEqual(gains.skills, {});
  }
});
test("a par run pays the documented budget for its Energy", () => {
  const gains = Training.convert(Training.defineGame(base), { score: 40, reason: "timeup" });
  assert.strictEqual(gains.performance, 1);
  assert.deepStrictEqual(gains.skills, { speed: 3.75, stamina: 1.25 });
  assert.strictEqual(gains.xp, 35); assert.strictEqual(gains.embers, 50); assert.strictEqual(gains.energy, -10);
  assert.strictEqual(gains.bond, 2); assert.strictEqual(gains.mood, 10); assert.strictEqual(gains.hunger, -6);
});
test("score scale does not change pay: 40-point and 600-point games pay alike", () => {
  const small = Training.convert(Training.defineGame({ ...base, par: 40 }), { score: 40 });
  const large = Training.convert(Training.defineGame({ ...base, id: "large", par: 600 }), { score: 600 });
  assert.deepStrictEqual({ ...small, game: "" }, { ...large, game: "" });
});
test("no run can exceed 1.5x a par run, however high the score", () => {
  const game = Training.defineGame(base);
  const ceiling = Training.ceiling(game), par = Training.convert(game, { score: 40 });
  assert.strictEqual(ceiling.performance, Training.MAX_PERFORMANCE);
  assert.strictEqual(ceiling.embers, Math.round(par.embers * 1.5));
  assert(ceiling.bond <= 4 * 1.5 && ceiling.xp <= par.xp * 1.5);
  assert.deepStrictEqual(Training.convert(game, { score: 1e12 }), ceiling);
});
test("unknown end reasons fall back to timeup", () => {
  assert.strictEqual(Training.convert(Training.defineGame(base), { score: 10, reason: "exploded" }).reason, "timeup");
});

// ---------- game-mode contract ----------
const modeDef = { id: "probe", schema: 2, create: () => ({}), migrate: (data, from, legacy) => ({ runs: (data?.runs || legacy?.runs || 0) + (from === 1 ? 100 : 0), schemaSeen: from }) };
test("mode definitions are validated at load", () => {
  assert.throws(() => Modes.defineMode({ ...modeDef, id: "X" }), /lowercase/);
  assert.throws(() => Modes.defineMode({ ...modeDef, schema: 0 }), /schema/);
  assert.throws(() => Modes.defineMode({ ...modeDef, create: null }), /create/);
  assert.throws(() => Modes.defineMode({ ...modeDef, migrate: undefined }), /migrate/);
});
test("first slice migration receives the legacy hub fields once", () => {
  const def = Modes.defineMode(modeDef);
  const fresh = Modes.migrateSlice(def, null, { runs: 7 });
  assert.deepStrictEqual(fresh, { schema: 2, data: { runs: 7, schemaSeen: 0 }, migrated: true });
});
test("older slices migrate forward; current ones are left alone", () => {
  const def = Modes.defineMode(modeDef);
  assert.deepStrictEqual(Modes.migrateSlice(def, { schema: 1, data: { runs: 3 } }).data, { runs: 103, schemaSeen: 1 });
  const current = Modes.migrateSlice(def, { schema: 2, data: { runs: 5 } });
  assert.strictEqual(current.migrated, false); assert.deepStrictEqual(current.data, { runs: 5 });
});
test("a slice from a newer build is preserved untouched", () => {
  const def = Modes.defineMode(modeDef);
  const newer = Modes.migrateSlice(def, { schema: 9, data: { future: true } });
  assert(newer.newer); assert.deepStrictEqual(newer.data, { future: true }); assert.strictEqual(newer.schema, 9);
});
test("legacy views handed to migrate() are read-only", () => {
  const def = Modes.defineMode({ ...modeDef, migrate: function (data, from, legacy) { "use strict"; legacy.runs = 1; return {}; } });
  assert.throws(() => Modes.migrateSlice(def, null, { runs: 2 }), TypeError);
});
test("awards are clamped and unknown fields dropped", () => {
  const award = Modes.normalizeAward({
    embers: 1e12, heat: -5, run: 1, junk: true,
    pets: { a: { xp: -10, bond: 99, skills: { power: 3, charisma: 9, speed: Infinity } }, "": { xp: 5 } },
    active: { energy: -500, hunger: "x", mood: 4 }
  });
  assert.strictEqual(award.embers, Modes.AWARD_LIMITS.embers);
  assert.strictEqual(award.heat, 0); assert.strictEqual(award.run, true); assert(!("junk" in award));
  assert.deepStrictEqual(award.pets, { a: { xp: 0, bond: 10, skills: { power: 3 }, played: false } });
  assert.deepStrictEqual(award.active, { energy: -40, hunger: 0, mood: 4 });
  assert(Object.isFrozen(award.pets.a.skills));
});

console.log(`\n${passed}/${total} core contract checks passed`);
