const assert=require('node:assert/strict');
const Art=require('../modes/dungeon/dungeon-art.js');
let passed=0;
for(const scale of [.5,.76,.77,.78,.82]) for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:-1},{x:.6,y:.8}]) {
  // A grounded foot must remain at the same WORLD point while its actor moves.
  const a=Art.humanGait(2,direction,scale)[0], b=Art.humanGait(3,direction,scale)[0];
  assert.ok(a.stance&&b.stance);
  assert.ok(Math.abs((b.x-a.x)*scale+direction.x)<1e-9);
  assert.ok(Math.abs((b.y-a.y)*scale+direction.y)<1e-9);
  assert.equal(a.lift,0);
  // One supporting foot throughout the cycle, seamless wrapping, stable idle.
  for(let d=0;d<56;d+=.25) {
    const feet=Art.humanGait(d,direction,scale);
    assert.equal(feet.filter(f=>f.stance).length,1);
    for(const f of feet) assert.ok(Number.isFinite(f.x+f.y+f.lift));
  }
  assert.deepEqual(Art.humanGait(0,direction,scale),Art.humanGait(28,direction,scale));
  const idle=Art.humanGait(11,direction,scale,0);
  for(const f of idle) {assert.equal(Math.abs(f.y),0);assert.equal(Math.abs(f.lift),0);assert.equal(f.x,f.side*4.6);}
  passed++;
}
console.log(`${passed}/${passed} world-space gait checks passed`);
