/* V10 sensory proof: the sound layer should feel deliberate, not merely exist. */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const html=readFileSync(join(root,'index.html'),'utf8');
const audio=readFileSync(join(root,'js/engine/audio.js'),'utf8');
const moments=readFileSync(join(root,'js/ui/moments.js'),'utf8');
const elements=readFileSync(join(root,'js/data/elements.js'),'utf8');
let n=0; const check=(name,fn)=>{fn();n++;console.log('PASS '+name);};

function wavInfo(path){
  const b=readFileSync(path);
  assert.equal(b.toString('ascii',0,4),'RIFF'); assert.equal(b.toString('ascii',8,12),'WAVE');
  const channels=b.readUInt16LE(22), rate=b.readUInt32LE(24), bits=b.readUInt16LE(34);
  let off=12,data=null;
  while(off+8<=b.length){const id=b.toString('ascii',off,off+4),len=b.readUInt32LE(off+4); if(id==='data'){data=b.subarray(off+8,off+8+len);break;} off+=8+len+(len%2);}
  assert(data,'no data chunk'); assert.equal(bits,16); assert.equal(channels,1);
  let sum=0,peak=0,count=0;
  for(let i=0;i+1<data.length;i+=2){const x=data.readInt16LE(i)/32768; sum+=x*x; peak=Math.max(peak,Math.abs(x)); count++;}
  return {rate,rms:Math.sqrt(sum/Math.max(1,count)),peak,duration:count/rate};
}

check('fresh cache-bust guarantees the revised mix is actually fetched',()=>{
  for(const f of ['css/rizo.css','js/engine/audio.js','js/engine/game.js','js/ui/ui.js','js/ui/world.js','js/ui/moments.js','js/ui/sheets.js','js/main.js']) assert(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?v=(?:1\\d)').test(html),f+' not cache-busted at v10 or later');
});

check('alternate dopamine cues no longer contain accidental quiet variants',()=>{
  const targets=['found2-v10.wav','found3-v10.wav','found4-v10.wav','found5-v10.wav','impact2-v10.wav','fail2-v10.wav','chain2-v10.wav','tap3-v10.wav'];
  for(const f of targets){const i=wavInfo(join(root,'assets/audio',f)); assert(i.rms>=.065,f+' too quiet '+i.rms); assert(i.peak<.94,f+' clipping risk');}
});

check('environmental cues are phone-audible and consistently mastered',()=>{
  const files=readdirSync(join(root,'assets/audio')).filter(f=>/^world-.*-v10\.wav$/.test(f));
  assert(files.length>=40,'expected expanded sensory bank');
  for(const f of files){const i=wavInfo(join(root,'assets/audio',f)); assert.equal(i.rate,44100,f+' sample rate'); assert(i.rms>=.05,f+' too quiet '+i.rms); assert(i.rms<=.13,f+' too hot '+i.rms); assert(i.peak<.94,f+' peak risk');}
});

check('obvious physical and milestone discoveries have authored profiles',()=>{
  const ids=['steam','lava','spark','wind','ice','crystal','rain','storm','lightning','thunder','sea','wave','tide','river','waterfall','volcano','earthquake','broth','life','death','human','village','forest','glass','metal','engine','machine','computer','ai','train','car','plane','rocket','clock','electricity','radio','signal','internet','camera','time','ritual','chaos','space','universe','bigbang','blackhole'];
  for(const id of ids){assert(new RegExp('\\n\\s*'+id+':\\{cue:').test(audio),id+' has no sensory profile'); assert(new RegExp('^'+id+'\\s*\\|','m').test(elements),id+' is not an element');}
});

check('shared sound families are shaped instead of cloned',()=>{
  assert(audio.includes("sea:{cue:'worldSea',gain:1.00,rate:.96"));
  assert(audio.includes("wave:{cue:'worldSea',gain:.88,rate:1.12"));
  assert(audio.includes("tide:{cue:'worldSea',gain:.78,rate:.82"));
  assert(audio.includes("storm:{cue:'worldStorm',gain:.94,rate:1.00"));
  assert(audio.includes("thunder:{cue:'worldStorm',gain:.90,rate:.84"));
});

check('sensory timing gives the physical cue room before reward punctuation',()=>{
  const lines=[...audio.matchAll(/^\s*([a-z0-9]+):\{cue:'[^']+'[^\n]*duck:(\d+),accent:(\d+),hold:(\d+)(?:,majorAccent:(\d+))?/gm)];
  assert(lines.length>=40,'profiles not parseable');
  for(const m of lines){const [,id,duck,accent,hold,major]=m; assert(+accent<+hold,id+' accent after reveal hold'); assert(+hold<=+duck+250,id+' hold badly exceeds duck'); if(major)assert(+major<+duck,id+' major accent after duck');}
  assert(moments.includes('sensory&&sensory.hold'));
  assert(moments.includes('environmental.majorAccent'));
});

check('the mix no longer preloads the entire cue library at boot',()=>{
  assert(audio.includes('HOT_PRELOAD'));
  assert(audio.includes("a.preload = HOT_PRELOAD.has(name)"));
  assert(audio.includes('warmSensoryBank'));
  assert(audio.includes('for(let n=0;n<4 && i<names.length;n++,i++)'));
});

check('variant selection uses shuffle bags, not repeated coin flips',()=>{
  assert(audio.includes('const variantBags = Object.create(null)'));
  assert(audio.includes('bag=arr.slice()'));
  assert(audio.includes('bag.shift()'));
});

check('every background source yields to discovery transients',()=>{
  assert(audio.includes('clearTimeout(ambientDuckTimer); stopMotif();'));
  assert(audio.includes('ambientSynth.g.gain.exponentialRampToValueAtTime'));
  assert(audio.includes('fadeMusic(t.lab*f,t.below*f,90)'));
  assert(!audio.includes('steps=Math.max(8,Math.round(ms/70))'));
});

check('sensory discoveries still suppress the generic impact at collision time',()=>{
  const ui=readFileSync(join(root,'js/ui/ui.js'),'utf8');
  assert(ui.includes("out.kind==='new' && A.hasDiscoveryCue && A.hasDiscoveryCue(e.id)"));
  assert(moments.includes("A.playDiscovery(e.id"));
});

console.log(n+' V10 sensory-proof scenarios passed.');
