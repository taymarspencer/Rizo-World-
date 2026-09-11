/* V9 world-build invariants: sensory discoveries leave both a one-shot event
   and persistent evidence without touching the recipe graph. */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const html=readFileSync(join(root,'index.html'),'utf8');
const audio=readFileSync(join(root,'js/engine/audio.js'),'utf8');
const ui=readFileSync(join(root,'js/ui/ui.js'),'utf8');
const world=readFileSync(join(root,'js/ui/world.js'),'utf8');
const moments=readFileSync(join(root,'js/ui/moments.js'),'utf8');
const css=readFileSync(join(root,'css/rizo.css'),'utf8');
let n=0; const check=(name,fn)=>{fn();n++;console.log('PASS '+name);};

check('V9 cache-bust and world director are shipped',()=>{
  assert(html.includes('id="worldscape"'));
  assert(/js\/ui\/world\.js\?v=(?:9|1\d)/.test(html));
  for(const f of ['css/rizo.css','js/engine/audio.js','js/engine/game.js','js/ui/ui.js','js/ui/moments.js','js/ui/sheets.js','js/main.js']) assert(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?v=(?:9|1\\d)').test(html),f+' missing cache-bust');
});

check('sensory audio bank is packaged as real WAV files',()=>{
  const files=['world-sea-v10.wav','world-rain-v10.wav','world-lightning-v10.wav','world-storm-v10.wav','world-volcano-v10.wav','world-quake-v10.wav','world-life-v10.wav','world-forest-v10.wav','world-city-v10.wav','world-engine-v10.wav','world-electricity-v10.wav','world-space-v10.wav','world-fire-v10.wav','world-wind-v10.wav','world-ice-v10.wav','found4-v10.wav','found5-v10.wav'];
  for(const f of files){const p=join(root,'assets/audio',f);assert(existsSync(p),f+' missing');const b=readFileSync(p);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert(b.length>50000,f+' suspiciously small');}
});

check('sensory cues are sparse and first-discovery directed',()=>{
  for(const token of ["sea:{cue:'worldSea'","volcano:{cue:'worldVolcano'","life:{cue:'worldLife'","city:{cue:'worldCity'","engine:{cue:'worldEngine'","electricity:{cue:'worldElectricity'","space:{cue:'worldSpace'"]) assert(audio.includes(token),token+' missing');
  assert(audio.includes("found:['found','found2','found3','found4','found5']"));
  assert(audio.includes('playDiscovery'));
  assert(ui.includes("A.hasDiscoveryCue && A.hasDiscoveryCue(e.id)"));
  assert(moments.includes('discoveryVoice'));
});

/* V11 replaced V9's independent on/off toggles with a derived model. The
   guarantee being protected is the same one: every persistent system comes out
   of the discovered set, never out of an ad-hoc flag. */
check('world persists discoveries instead of using only popups',()=>{
  for(const token of ["const seaOn=any('sea','wave','tide','beach','island'","const volcano=has('volcano')","const life=has('life')","const forest=any('forest','tree','jungle')","const city=any('city','empire','crowd')","const machine=any('engine','machine','factory'"]) assert(world.includes(token),token+' missing');
  for(const cls of ['w-sea','w-volcano','w-life','w-forest','w-city','w-machine']) assert(css.includes('#worldscape.'+cls),cls+' CSS missing');
});

check('world birth events are authored for the obvious sensory milestones',()=>{
  for(const evt of ['b-sea','b-rain','b-storm','b-bolt','b-volcano','b-quake','b-life','b-forest','b-city','b-machine','b-space']) assert(css.includes('#worldscape.'+evt),evt+' missing');
  for(const id of ['sea','volcano','life','forest','city','electricity','space']) assert(new RegExp('\\b'+id+":\\{cls:'b-").test(world),id+' has no birth choreography');
});

check('the persistent scene is save-derived and therefore cannot desync',()=>{
  assert(world.includes('function derive()'),'world state must be derived');
  assert(world.includes('const has=id=>!!(R.S.found[id])'),'derivation must read the discovered set');
  assert(world.includes('R.countCounted()'));
  assert(world.includes('document.body.dataset.worldAge'));
  /* nothing cosmetic may be written into the save */
  assert(!/R\.S\.(world|scene|env)\b/.test(world),'the world must not persist its own state');
});

check('both primary and secondary discoveries enter the same sensory director',()=>{
  const uses=(moments.match(/discoveryVoice\(/g)||[]).length;
  assert(uses>=4,'expected helper plus primary/secondary/big calls');
  assert(moments.includes('const sensory=discoveryVoice(out.el,false)'));
  assert(moments.includes('const sensory=discoveryVoice(x.el,false)'));
  assert(moments.includes('const environmental=discoveryVoice(e,true,false)'));
});

check('audio catalogue remains entirely local',()=>{
  const wavs=readdirSync(join(root,'assets/audio')).filter(f=>f.endsWith('.wav'));
  assert(wavs.length>=48,'expected expanded local cue bank');
  assert(!/https?:\/\//.test(audio),'audio engine should not fetch third-party media');
});

console.log(n+' V9 world-build scenarios passed.');
