const assert = require('node:assert/strict');
const Home = require('../core/rizo-home.js');
let passed = 0, total = 0;
function test(name, fn) {
  total++;
  try { fn(); passed++; console.log('PASS', name); }
  catch (error) { console.error('FAIL', name, error.message); process.exitCode = 1; }
}
test('an old home starts without spending or inventing past rewards', () => {
  const legacy = { wallet: { embers: 4321 }, scores: { maze: 80, rhythm: 20, power: 0, defense: 10 } };
  const before = JSON.stringify(legacy), h = Home.normalize(undefined, legacy);
  assert.equal(h.tier, 0); assert.deepEqual(h.trained, ['rhythm', 'maze']);
  assert.equal(JSON.stringify(legacy), before); assert.equal(h.lastReturn, null);
});
test('malformed home records cannot add tiers, arbitrary drills, or repeat bonus ids', () => {
  const h = Home.normalize({ tier: Infinity, activity: { training: -9 }, trained: ['maze', 'maze', '<x>'], routine: { date: '<script>', care: ['pat', 'pat', 'cheat'] }, lastReturn: { source: 'cheat' } });
  assert.equal(h.tier, 0); assert.equal(h.activity.training, 0);
  assert.deepEqual(h.trained, ['maze']); assert.deepEqual(h.routine.care, ['pat']); assert.equal(h.routine.date, ''); assert.equal(h.lastReturn, null);
});
test('a purchased room keeps training history and the original record immutable', () => {
  const h = Home.normalize({ trained: ['maze'], activity: { training: 5 } });
  const result = Home.purchase(h, 200, 'warm', 1234);
  assert(result.ok); assert.equal(result.home.tier, 1); assert.equal(result.embers, 20);
  assert.equal(result.home.builtAt, 1234); assert.equal(result.home.activity.training, 5);
  assert.deepEqual(result.home.trained, ['maze']); assert.equal(h.tier, 0);
});
test('insufficient funds, duplicate purchases, and skipped tiers never spend Embers', () => {
  const h = Home.normalize();
  assert.deepEqual(Home.purchase(h, 179, 'warm', 1), { ok: false, reason: 'embers' });
  assert.deepEqual(Home.purchase(h, 9999, 'roof', 1), { ok: false, reason: 'order' });
  const built = Home.purchase(h, 180, 'warm', 1).home;
  assert.deepEqual(Home.purchase(built, 9999, 'warm', 1), { ok: false, reason: 'order' });
});
test('the aspirational Orbit goal cannot sell unimplemented content', () => {
  const h = Home.normalize({ tier: 3 });
  assert.equal(Home.HORIZON.available, false); assert.equal(Home.HORIZON.cost, 1000000);
  assert.equal(Home.next(h), null); assert.equal(Home.purchase(h, 1000000, 'orbit', 1).ok, false);
});
test('care and object variety pay at most 36 bonus Embers per date', () => {
  const h = Home.normalize(); let reward = 0;
  for (let n = 0; n < 8; n++) {
    for (const id of ['feed', 'clean', 'pat', 'talk']) reward += Home.everyday(h, 'care', id, '2026-10-05');
    for (const id of ['ball', 'stump', 'puddle', 'bush']) reward += Home.everyday(h, 'play', id, '2026-10-05');
  }
  assert.equal(reward, 36); assert.equal(h.activity.play, 32);
  assert.equal(Home.everyday(h, 'care', 'cheat', '2026-10-05'), 0);
});
test('bonus receipts survive reload and a different date has no streak debt', () => {
  const h = Home.normalize(); assert.equal(Home.everyday(h, 'care', 'pat', '2026-10-05'), 3);
  const saved = Home.normalize(JSON.parse(JSON.stringify(h)));
  assert.equal(Home.everyday(saved, 'care', 'pat', '2026-10-05'), 0);
  assert.equal(Home.everyday(saved, 'care', 'pat', '2026-10-08'), 3);
});
test('drill variety is a memory with ten slots, never a reward multiplier', () => {
  const h = Home.normalize();
  Home.recordTraining(h, 'maze'); Home.recordTraining(h, 'maze'); Home.recordTraining(h, 'probe');
  assert.deepEqual(h.trained, ['maze']); assert.equal(h.activity.training, 3);
});
test('position normalization preserves real zero/fractional coordinates and bounds bad data', () => {
  assert.deepEqual(Home.position({ x: 61.5, y: 0 }), { x: 61.5, y: 0 });
  assert.deepEqual(Home.position({ x: null, y: Infinity }), { x: 50, y: 0 });
  assert.deepEqual(Home.position({ x: 999, y: -999 }), { x: 75, y: -4 });
});
console.log(`\n${passed}/${total} home rule checks passed`);
