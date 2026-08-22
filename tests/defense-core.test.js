'use strict';
const assert = require('node:assert/strict');
const core = require('../defense-core-v79.js');

const tests = [];
function test(name, fn) { tests.push({name, fn}); }

test('phase model gates actions coherently', () => {
  assert.equal(core.phaseAllows(core.PHASES.PLANNING, 'place'), true);
  assert.equal(core.phaseAllows(core.PHASES.COMBAT, 'place'), false);
  assert.equal(core.phaseAllows(core.PHASES.COMBAT, 'ability'), true);
  assert.equal(core.phaseAllows(core.PHASES.PACKET_BREAK, 'upgrade'), true);
  assert.equal(core.phaseAllows(core.PHASES.PAUSED, 'ability'), false);
});

test('gameplay density is invariant across quality and speed', () => {
  assert.equal(core.densityCap({speed: 2}), core.densityCap({speed: 1}));
  assert.equal(core.densityCap({low: true, speed: 1}), core.densityCap({low: false, speed: 1}));
  assert.equal(core.densityCap({low: true, speed: 2}), core.densityCap({low: false, speed: 1}));
  assert.ok(core.densityCap({bossActive: true, speed: 1}) <= 10);
});

test('2x speed reduces visual pressure independently of combat math', () => {
  const normal = core.visualBudget({low: false, speed: 1});
  const fast = core.visualBudget({low: false, speed: 2});
  const lowFast = core.visualBudget({low: true, speed: 2});
  assert.ok(fast.maxVisibleProjectiles < normal.maxVisibleProjectiles);
  assert.ok(fast.maxImpactEffects < normal.maxImpactEffects);
  assert.ok(fast.weatherParticleScale < normal.weatherParticleScale);
  assert.ok(lowFast.maxVisibleProjectiles <= fast.maxVisibleProjectiles);
});

test('imminent child spawns reserve density without trusting the whole buffer', () => {
  const queue = [
    {releaseAt: 4.01},
    {releaseAt: 4.08},
    {releaseAt: 4.17},
    {releaseAt: 5.5}
  ];
  assert.equal(core.childReservationCount(queue, 4, .18, 3), 3);
  assert.equal(core.childReservationCount(queue, 4, .05, 3), 1);
  assert.equal(core.childReservationCount(queue, 4, .18, 2), 2);
  assert.equal(core.childReservationCount([], 4), 0);
});

test('golden income is capped', () => {
  assert.equal(core.goldenBonus(0), 1);
  assert.equal(core.goldenBonus(1), 1.10);
  assert.ok(core.goldenBonus(100) <= 1.22);
});

test('phase 5 economy constants are centralized', () => {
  assert.equal(core.ECONOMY.baseStartingCash, 220);
  assert.equal(core.ECONOMY.planningRefundRate, .70);
  assert.equal(core.ECONOMY.placementUndoSeconds, 5);
  assert.equal(core.ECONOMY.worldOpeningDiscount, .80);
});

test('deployment pricing escalates canonically and duplicates cost extra', () => {
  assert.equal(core.deploymentCost({paidTowerCount:0,copyCount:0,activeFirst:true}), 0);
  assert.equal(core.deploymentCost({paidTowerCount:0,copyCount:0}), 150);
  assert.equal(core.deploymentCost({paidTowerCount:1,copyCount:0}), 200);
  assert.equal(core.deploymentCost({paidTowerCount:2,copyCount:0}), 270);
  assert.equal(core.deploymentCost({paidTowerCount:3,copyCount:0}), 430);
  assert.equal(core.deploymentCost({paidTowerCount:8,copyCount:0}), 4850);
  assert.equal(core.deploymentCost({paidTowerCount:0,copyCount:1}), 190);
});

test('Golden active income diminishes across duplicates and stops scaling after wave 40', () => {
  assert.equal(core.goldenActivePayout({clearedWave:20,upgradeLevel:2,goldenTowerCount:1}), 152);
  assert.ok(core.goldenActivePayout({clearedWave:20,upgradeLevel:2,goldenTowerCount:5}) < 152);
  assert.equal(core.goldenActivePayout({clearedWave:40,upgradeLevel:4,goldenTowerCount:1}), core.goldenActivePayout({clearedWave:250,upgradeLevel:4,goldenTowerCount:1}));
});

test('upgrade pricing and derived investment are explicit', () => {
  assert.deepEqual([...core.UPGRADE_COSTS], [110, 180, 320, 640]);
  assert.equal(core.calculateTowerInvestment(145, 0), 145);
  assert.equal(core.calculateTowerInvestment(145, 3), 145 + 110 + 180 + 320);
});

test('opening-world discount is derived into canonical investment', () => {
  assert.equal(core.upgradeCost(0, .8), 90);
  assert.equal(core.calculateTowerInvestment(150, 3, [.8, 1, 1, 1]), 150 + 90 + 180 + 320);
});

test('wave and permanent rewards are map-invariant', () => {
  const waveA = core.calculateWaveBonus({clearedWave:10,heartsLostThisWave:0,towersPlaced:3});
  const waveB = core.calculateWaveBonus({clearedWave:10,heartsLostThisWave:0,towersPlaced:3,mapReward:99});
  assert.equal(waveA, waveB);
  const runA = core.calculateRunEmbers({clearedWave:20,kills:100,bossesDefeated:2,perfectWaveCount:8});
  const runB = core.calculateRunEmbers({clearedWave:20,kills:100,bossesDefeated:2,perfectWaveCount:8,mapReward:99});
  assert.equal(runA, runB);
});

test('late run cash growth is normalized without touching the opening curve', () => {
  assert.equal(core.calculateEnemyReward(20, 10), 29); // original Wave 10 curve: 20 × 1.45
  assert.ok(core.calculateEnemyReward(20, 50) < core.calculateEnemyReward(20, 10));
  assert.equal(core.calculateWaveBonus({clearedWave:10,heartsLostThisWave:0,towersPlaced:3}), 82);
  assert.equal(core.calculateWaveBonus({clearedWave:20,heartsLostThisWave:0,towersPlaced:4}), 122);
  assert.equal(core.calculateWaveBonus({clearedWave:50,heartsLostThisWave:0,towersPlaced:8}), 152);
  assert.equal(core.calculateWaveBonus({clearedWave:100,heartsLostThisWave:0,towersPlaced:8}), 152);
});

test('wave plans are capped and packetized', () => {
  for (const wave of [1, 10, 40, 100, 250]) {
    const plan = core.createWavePlan({wave});
    assert.ok(plan.packets.length > 0);
    assert.ok(plan.plannedEnemyCount <= core.LIMITS.MAX_PLANNED_ENEMIES + 1);
    assert.equal(core.flattenPackets(plan.packets).length, plan.plannedEnemyCount);
    for (const packet of plan.packets) {
      assert.ok(packet.spawnGap >= 0.07 && packet.spawnGap <= 1.2);
      assert.ok(packet.breakAfter === 0 || (packet.breakAfter >= 0.8 && packet.breakAfter <= 2.6));
    }
  }
});

test('boss waves reserve a final entrance packet and a pre-boss breath', () => {
  const plan = core.createWavePlan({wave:20});
  const finalPacket = plan.packets.at(-1);
  const priorPacket = plan.packets.at(-2);
  assert.equal(finalPacket.enemies.length, 1);
  assert.equal(finalPacket.enemies[0].type, 'boss');
  assert.ok(priorPacket.breakAfter >= 1.80);
  assert.equal(core.flattenPackets(plan.packets).length, plan.plannedEnemyCount);
});



test('v76 simulation contract is fixed at 30Hz with bounded catch-up', () => {
  assert.equal(core.SIMULATION.stepHz, 30);
  assert.ok(Math.abs(core.SIMULATION.stepSeconds - 1 / 30) < 1e-12);
  assert.equal(core.SIMULATION.maxCatchUpSteps, 4);
  assert.equal(core.visualBudget({low:true,speed:1}).presentationFps, 30);
  assert.ok(core.visualBudget({low:false,speed:2}).projectileEmissionHz < core.visualBudget({low:false,speed:1}).projectileEmissionHz);
});

test('wave grammar flattens top-level count and creates recovery valleys', () => {
  assert.ok(core.plannedEnemyCount(100) <= 30);
  assert.ok(core.plannedEnemyCount(100) <= core.plannedEnemyCount(40) + 8);
  const boss = core.createWavePlan({wave:20});
  const recovery = core.createWavePlan({wave:21});
  const normal = core.createWavePlan({wave:22});
  assert.equal(boss.modifier, 'boss');
  assert.equal(recovery.modifier, 'recovery');
  assert.ok(recovery.plannedEnemyCount < normal.plannedEnemyCount);
  assert.ok(recovery.packets.every(packet => packet.enemies.length <= 12));
});

test('run rewards use cleared accomplishments and soften late farming', () => {
  const unfinished = core.calculateRunEmbers({clearedWave: 19, kills: 200, bossesDefeated: 1, perfectWaveCount: 4});
  const illegitimate = core.calculateRunEmbers({clearedWave: 20, kills: 200, bossesDefeated: 1, perfectWaveCount: 4});
  assert.ok(illegitimate > unfinished);
  const huge = core.calculateRunEmbers({clearedWave: 250, kills: 100000, bossesDefeated: 2000, perfectWaveCount: 250});
  const raw = 250 * 8 + 100000 * 1.1 + 2000 * 25 + 250 * 3;
  assert.ok(huge < raw);
});

test('checkpoint signatures detect casual tampering across derived surfaces', () => {
  const save = {keeperId:'k1', mapId:'grove', currentWave:20, clearedWave:19, lives:7, cash:600, kills:90, totalDamage:4000, towers:[{id:'t1',petId:'p1',source:'active',x:.2,y:.4,upgrade:2,kills:4,damage:800}], enemies:[{id:'e1',type:'puff',progress:.4,hpRatio:.8}], spawnQueue:['puff'], childSpawnQueue:[], bossesBeaten:['crown'], bossesDefeated:1, perfectWaveCount:8, savedAt:123456};
  save.signature = core.createSaveSignature(save);
  assert.equal(core.verifySaveSignature(save), true);
  save.towers[0].upgrade = 4;
  assert.equal(core.verifySaveSignature(save), false);
});

test('v5 checkpoint signatures cover opening-economy state', () => {
  const save = {keeperId:'k1', mapId:'ember', currentWave:8, clearedWave:7, lives:8, cash:410, kills:20, totalDamage:900, phase:'planning', resumePhase:'combat', speed:1, clock:21, towers:[{id:'t1',petId:'p1',source:'active',x:.4,y:.5,upgrade:1,kills:4,damage:200,doctrine:'power',openingPerkApplied:true}], enemies:[], spawnQueue:[], childSpawnQueue:[], bossesBeaten:[], bossesDefeated:0, perfectWaveCount:4, waveTotal:0, waveResolved:0, worldPerkUsed:true, savedAt:123456};
  save.signature = core.createSaveSignature(save, 5);
  assert.equal(core.verifySaveSignature(save), true);
  save.towers[0].openingPerkApplied = false;
  assert.equal(core.verifySaveSignature(save), false);
});

test('v7 checkpoint signatures cover Super Rizo form', () => {
  const save = {keeperId:'k1', mapId:'grove', currentWave:50, clearedWave:49, lives:12, cash:800, kills:200, totalDamage:12000, phase:'combat', resumePhase:'combat', speed:2, clock:90, towers:[{id:'t1',petId:'p1',source:'active',x:.4,y:.5,upgrade:4,kills:50,damage:5000,doctrine:'power',openingPerkApplied:false,superForm:'power'}], enemies:[], spawnQueue:[], childSpawnQueue:[], bossesBeaten:[], bossesDefeated:0, perfectWaveCount:10, waveTotal:10, waveResolved:3, worldPerkUsed:false, gateFlameReadyAt:0, gateFlameUntil:0, gateFlameProgress:.86, gateFlameNextTick:0, gateFlameTicks:0, savedAt:123456};
  save.signature = core.createSaveSignature(save, 7);
  assert.match(save.signature, /^v7\./);
  assert.equal(core.verifySaveSignature(save), true);
  save.towers[0].superForm = 'control';
  assert.equal(core.verifySaveSignature(save), false);
});

test('v6 checkpoint signatures cover Gate Flame tactical state', () => {
  const save = {keeperId:'k1', mapId:'grove', currentWave:9, clearedWave:8, lives:7, cash:450, kills:22, totalDamage:1100, phase:'combat', resumePhase:'combat', speed:1, clock:24, towers:[], enemies:[], spawnQueue:[], childSpawnQueue:[], bossesBeaten:[], bossesDefeated:0, perfectWaveCount:3, waveTotal:8, waveResolved:2, worldPerkUsed:false, gateFlameReadyAt:40, gateFlameUntil:31, gateFlameProgress:.52, gateFlameNextTick:21.5, gateFlameTicks:4, savedAt:123456};
  save.signature = core.createSaveSignature(save, 6);
  assert.match(save.signature, /^v6\./);
  assert.equal(core.verifySaveSignature(save), true);
  save.gateFlameReadyAt = 0;
  assert.equal(core.verifySaveSignature(save), false);
});

test('legacy v4 checkpoint signatures remain verifiable for v67 migration', () => {
  const save = {keeperId:'k1', mapId:'ember', currentWave:8, clearedWave:7, lives:8, cash:410, kills:20, totalDamage:900, phase:'planning', resumePhase:'combat', speed:1, clock:21, towers:[{id:'t1',petId:'p1',source:'active',x:.4,y:.5,upgrade:1,kills:4,damage:200,doctrine:'power'}], enemies:[], spawnQueue:[], childSpawnQueue:[], bossesBeaten:[], bossesDefeated:0, perfectWaveCount:4, waveTotal:0, waveResolved:0, savedAt:123456};
  save.signature = core.createSaveSignature(save, 4);
  assert.match(save.signature, /^v4\./);
  assert.equal(core.verifySaveSignature(save), true);
});

test('legacy v3 checkpoint signatures remain verifiable after the packet-clock migration', () => {
  const save = {keeperId:'k1', mapId:'storm', currentWave:18, clearedWave:17, lives:5, cash:720, kills:90, totalDamage:6400, phase:'combat', resumePhase:'combat', speed:2, clock:44.2, towers:[{id:'t1',petId:'p1',source:'active',x:.4,y:.5,upgrade:2,kills:8,damage:900,doctrine:'power'}], enemies:[{id:'e1',type:'fleet',progress:.48,hpRatio:.6}], spawnQueue:['puff'], childSpawnQueue:[{entry:'fleet',progress:.5,releaseAt:44.28}], bossesBeaten:['crown'], bossesDefeated:1, perfectWaveCount:7, waveTotal:30, waveResolved:18, savedAt:123456};
  save.signature = core.createSaveSignature(save, 3);
  assert.match(save.signature, /^v3\./);
  assert.equal(core.verifySaveSignature(save), true);
});

test('legacy v2 checkpoint signatures remain verifiable for migration', () => {
  const save = {keeperId:'k1', mapId:'grove', currentWave:12, clearedWave:11, lives:8, cash:500, kills:40, totalDamage:1200, towers:[{},{}], bossesBeaten:[], perfectWaveCount:3, savedAt:123456};
  save.signature = core.createSaveSignature(save, 2);
  assert.match(save.signature, /^v2\./);
  assert.equal(core.verifySaveSignature(save), true);
});

test('whole-save signatures detect progression edits', () => {
  const state = {version:18,player:{keeperId:'keeper-1',streak:4,totalSessions:8},wallet:{embers:321,shards:12},pet:{id:'p1',number:1,name:'RIZO',stage:'kid',variant:'classic',xp:400,bond:20,skills:{power:10},genes:{power:100}},inventory:{accessories:['none'],rooms:['rain'],phoenix:0,growth:0,care:0},collection:{classic:1},scores:{power:12,spark:9,defense:3,defenseMaps:{grove:3},defenseMilestones:[],defensePerfectMaps:[],defenseContracts:[],defenseHistory:[],defenseMastery:{}},farm:{roster:[],unlockedRooms:[0]},meta:{totalGames:2,totalHatched:1,totalTaps:5,capsules:0,rebirths:0,bondEggs:0},achievements:['origin'],daily:{date:'2026-07-31',type:'tap',progress:2,claimed:false,giftClaimed:false},season:{xp:10,level:1},expedition:{active:false},treasures:{},loreUnlocked:['keeper']};
  const envelope = {saveVersion:core.STATE_SAVE_VERSION,savedAt:123456,state};
  envelope.signature = core.createStateSignature(state,envelope.savedAt,envelope.saveVersion);
  assert.equal(core.verifyStateSignature(envelope), true);
  state.wallet.embers = 999999;
  assert.equal(core.verifyStateSignature(envelope), false);
});

test('whole-save signatures cover arcade and unlock progression', () => {
  const state = {version:18,player:{keeperId:'keeper-1'},wallet:{embers:100,shards:0},pet:{id:'p1',number:1,name:'RIZO',stage:'egg',variant:'classic',skills:{},genes:{}},inventory:{accessories:['none'],rooms:['rain']},collection:{classic:1},scores:{power:10,defense:0,defenseMaps:{},defenseMilestones:[],defensePerfectMaps:[],defenseContracts:[],defenseHistory:[],defenseMastery:{}},farm:{roster:[],unlockedRooms:[0]},meta:{},achievements:[],daily:{},season:{level:1},expedition:{},treasures:{},loreUnlocked:['keeper']};
  const envelope = {saveVersion:core.STATE_SAVE_VERSION,savedAt:123456,state};
  envelope.signature = core.createStateSignature(state,envelope.savedAt,envelope.saveVersion);
  state.scores.power = 999999;
  assert.equal(core.verifyStateSignature(envelope), false);
});

test('phase transitions form one explicit runtime state machine', () => {
  const P=core.PHASES;
  assert.equal(core.canTransitionPhase(P.PLANNING,P.COUNTDOWN),true);
  assert.equal(core.canTransitionPhase(P.PLANNING,P.COMBAT),false);
  assert.equal(core.canTransitionPhase(P.COUNTDOWN,P.COMBAT),true);
  assert.equal(core.canTransitionPhase(P.COMBAT,P.PACKET_BREAK),true);
  assert.equal(core.canTransitionPhase(P.COMBAT,P.WAVE_COMPLETE),true);
  assert.equal(core.canTransitionPhase(P.COMBAT,P.PAUSED),true);
  assert.equal(core.canTransitionPhase(P.PAUSED,P.COMBAT),true);
  assert.equal(core.canTransitionPhase(P.RUN_COMPLETE,P.PLANNING),false);
});

test('phase action permissions prevent contradictory build and combat states', () => {
  const P=core.PHASES;
  assert.equal(core.phaseAllows(P.PLANNING,'place'),true);
  assert.equal(core.phaseAllows(P.PLANNING,'sell'),true);
  assert.equal(core.phaseAllows(P.COMBAT,'place'),false);
  assert.equal(core.phaseAllows(P.COMBAT,'sell'),false);
  assert.equal(core.phaseAllows(P.COMBAT,'ability'),true);
  assert.equal(core.phaseAllows(P.COMBAT,'upgrade'),true);
  assert.equal(core.phaseAllows(P.COUNTDOWN,'upgrade'),true);
  assert.equal(core.phaseAllows(P.PACKET_BREAK,'upgrade'),true);
  assert.equal(core.phaseAllows(P.PAUSED,'ability'),false);
  assert.equal(core.phaseAllows(P.RUN_COMPLETE,'bank'),false);
});

test('clamps reject impossible imported numbers', () => {
  assert.equal(core.clampInteger(Infinity, 0, 10, 3), 3);
  assert.equal(core.clampInteger(999, 0, 10, 3), 10);
  assert.equal(core.clampNumber(-30, 0, 10, 3), 0);
});

let passed = 0;
for (const {name, fn} of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} core tests passed.`);
