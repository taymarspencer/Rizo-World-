"use strict";
// Exercise the real source atlas (bytes + frame boundaries) and game Canvas
// drawImage path. This tests integration, not whether the art is beautiful.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const atlasFile = path.join(__dirname,"../modes/dungeon/assets/keeper-sprite-atlas.png");
const bytes = fs.readFileSync(atlasFile);
assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a",
  "the production sprite is a real local PNG");
assert.equal(bytes.readUInt32BE(16),480,"four 120px sprite columns");
assert.equal(bytes.readUInt32BE(20),360,"two 180px sprite rows");
assert.ok(bytes.length > 15000,"atlas file is populated");

const originalImage = globalThis.Image;
let requested = 0;
class LoadedImage {
  constructor() { this.naturalWidth=480; this.naturalHeight=360; }
  set src(v) { this._src=v; requested++; queueMicrotask(() => this.onload()); }
  get src() { return this._src; }
}
globalThis.Image = LoadedImage;
const Art = require("../modes/dungeon/dungeon-art.js");

function canvas() {
  const calls = [], transforms = [];
  let depth = 0;
  const c = new Proxy({}, {
    get(_target,key) {
      if(key==="drawImage") return (...args) => calls.push(args);
      if(key==="save") return () => depth++;
      if(key==="restore") return () => { depth--; assert.ok(depth >= 0); };
      if(key==="scale") return (...args) => transforms.push(args);
      return () => {};
    },
    set() { return true; }
  });
  return {c,calls,transforms,get depth(){return depth;}};
}
(async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requested,1,"load the atlas once");
  assert.equal(Art.keeperSpriteStatus(),"ready","sprite is ready");
  assert.ok(Art.KEEPER_ATLAS.src.endsWith("/modes/dungeon/assets/keeper-sprite-atlas.png")
    || Art.KEEPER_ATLAS.src==="modes/dungeon/assets/keeper-sprite-atlas.png");
  assert.equal(Art.keeperSpriteFrame({}),4);
  assert.equal(Art.keeperSpriteFrame({state:"look-back"}),5);
  assert.equal(Art.keeperSpriteFrame({state:"door"}),6);
  assert.equal(Art.keeperSpriteFrame({addressed:true}),7);
  assert.equal(Art.keeperSpriteFrame({walking:false,stride:99}),4,
    "stopped characters never moonwalk through frames");
  for(let n=0;n<4;n++) {
    const frame=Art.keeperSpriteFrame({walking:true,stride:n*(Math.PI*2/1.9)/4+.001});
    assert.equal(frame,n,"each movement phase reaches one real walk frame");
  }
  for(let frame=0;frame<8;frame++) {
    const {c,calls,transforms,depth}=canvas();
    const options=frame<4
      ? {walking:true,stride:frame*(Math.PI*2/1.9)/4+.001,face:-1}
      : frame===4 ? {face:1}
      : frame===5 ? {state:"look-back"}
      : frame===6 ? {state:"door"}
      : {front:true};
    assert.equal(Art.keeperSprite(c,100,130,options),true);
    assert.equal(calls.length,1,"one exact sprite; not compounded polygons");
    const [img,sx,sy,sw,sh,dx,dy,dw,dh]=calls[0];
    assert.equal(img.src,Art.KEEPER_ATLAS.src);
    assert.equal(sx,(frame%4)*120);
    assert.equal(sy,Math.floor(frame/4)*180);
    assert.equal(sw,120);assert.equal(sh,180);
    // Frame-by-frame torso registration removes x jitter; idle/look/reach
    // frames have padded bottoms, but their shoes still touch world floor.
    assert.equal(dx,-39+[-1,4,10,10,0,-1,0,2][frame]);
    assert.equal(dy,-117+(frame<4?0:9));
    assert.equal(dw,78);assert.equal(dh,117);
    assert.equal(depth,0,"balanced Canvas state");
    if(frame<4) assert.ok(transforms.some(x=>x[0]===-1),
      "face left mirrors the sprite rather than redrawing anatomy");
  }
  const {c,calls,depth}=canvas();
  Art.keeper(c,100,130,{walking:true,stride:2.2});
  assert.equal(calls.length,1,"the real game painter uses the loaded sprite");
  assert.equal(depth,0);
  globalThis.Image=originalImage;
  console.log("Keeper sprite atlas: PNG checked, 8/8 frames drawn, movement and facing pass.");
})().catch(e=>{globalThis.Image=originalImage;console.error(e);process.exitCode=1;});
