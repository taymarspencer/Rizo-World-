import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {join,dirname} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const html=readFileSync(join(root,'index.html'),'utf8');
const audio=readFileSync(join(root,'js/engine/audio.js'),'utf8');
const ui=readFileSync(join(root,'js/ui/ui.js'),'utf8');
const sheets=readFileSync(join(root,'js/ui/sheets.js'),'utf8');
for(const f of ['assets/audio/labloop-v5.wav','assets/audio/below-v7.wav','assets/audio/found2-v10.wav','assets/audio/found3-v10.wav','assets/audio/fail2-v10.wav','assets/audio/impact2-v10.wav','assets/audio/chain2-v10.wav','assets/audio/tap3-v10.wav']) assert(existsSync(join(root,f)),f+' missing');
for(const f of readdirSync(join(root,'assets/audio')).filter(x=>x.endsWith('.wav'))){
  const b=readFileSync(join(root,'assets/audio',f)); assert.equal(b.toString('ascii',0,4),'RIFF',f+' not RIFF'); assert.equal(b.toString('ascii',8,12),'WAVE',f+' not WAVE'); assert(b.length>1000,f+' suspiciously tiny');
}
assert(html.includes('id="chipSmart"')); assert(/\?v=(?:[7-9]|1\d)(?:[\"'])/.test(html));
assert(audio.includes("darkAmbient:'below-v7.wav'")); assert(audio.includes('setMusicProgress')); assert(audio.includes('chooseVariant'));
assert(ui.includes("R.groupsFound().length >= 6")); assert(ui.includes("THE WORKING SET")); assert(ui.includes('domain-index'));
assert(sheets.includes('function domains()')); assert(sheets.includes('NEWEST DOORS'));
console.log('PASS V7 media, adaptive navigation, and cache-bust invariants');
console.log('audio assets',readdirSync(join(root,'assets/audio')).filter(x=>x.endsWith('.wav')).length);
