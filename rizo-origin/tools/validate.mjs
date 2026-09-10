/* RIZO ORIGIN — content graph validator + reachability simulator.
   Run: node tools/validate.mjs   (add --verbose for full listings) */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const V = process.argv.includes('--verbose');
const errors = []; const warns = [];
function fail(m){ errors.push(m); }
function warn(m){ warns.push(m); }
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['js/data/groups.js','js/data/elements.js','js/data/recipes.js','js/data/achievements.js']) {
  try { vm.runInContext(readFileSync(new URL('../'+f, import.meta.url),'utf8'), ctx); }
  catch(e){ if(!f.includes('achievements')) throw e; }
}
const W = ctx.window;

// ── parse ──────────────────────────────────────────────────────────────────
const groups = W.RIZO_GROUPS;
const groupIds = new Set(groups.map(g=>g.id));
const els = new Map(); const order = [];
let ln = 0;
for (const raw of W.RIZO_ELEMENT_TABLE.split('\n')) {
  ln++;
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const p = line.split('|').map(s=>s.trim());
  if (p.length !== 5) { fail(`elements.js:${ln} expected 5 columns, got ${p.length}: ${line}`); continue; }
  const [id,name,group,flags,flavor] = p;
  if (els.has(id)) fail(`duplicate element id "${id}"`);
  if (!/^[a-z][a-z0-9]*$/.test(id)) fail(`bad element id "${id}"`);
  if (!groupIds.has(group)) fail(`element "${id}" has unknown group "${group}"`);
  if (!flavor) fail(`element "${id}" has no flavor text`);
  if (flavor.length > 82) fail(`element "${id}" flavor too long (${flavor.length})`);
  els.set(id,{ id,name,group, secret: flags.includes('s'), major: flags.includes('m'), flavor, uses:0, made:0 });
  order.push(id);
}
const recipes = []; const pairSeen = new Map();
ln = 0;
for (const raw of W.RIZO_RECIPE_TABLE.split('\n')) {
  ln++;
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^([a-z0-9]+)\s*\+\s*([a-z0-9]+)\s*=\s*([a-z0-9]+)(?:\s*\+\s*([a-z0-9]+))?$/);
  if (!m) { fail(`recipes.js:${ln} unparseable: ${line}`); continue; }
  const [,a,b,out,out2] = m;
  const outs = out2 ? [out,out2] : [out];
  for (const x of [a,b].concat(outs)) if (!els.has(x)) fail(`recipes.js:${ln} unknown element "${x}" in: ${line}`);
  if (out2 === out) fail(`recipes.js:${ln} reaction produces the same thing twice: ${line}`);
  const key = [a,b].sort().join('+');
  if (pairSeen.has(key)) fail(`duplicate pair ${key} -> ${pairSeen.get(key)} and ${out} (recipes.js:${ln})`);
  pairSeen.set(key,outs.join('+'));
  recipes.push({a,b,out,outs,key});
  if (els.has(a)) els.get(a).uses++;
  if (els.has(b) && b!==a) els.get(b).uses++;
  for (const o of outs) if (els.has(o)) els.get(o).made++;
}

// ── structural checks ──────────────────────────────────────────────────────
const STARTERS = ['fire','water','earth','air'];
for (const id of STARTERS) if (!els.has(id)) fail(`missing starter "${id}"`);
for (const [id,e] of els) {
  if (!STARTERS.includes(id) && e.made === 0) fail(`element "${id}" has no recipe — unmakeable`);
  if (STARTERS.includes(id) && e.made > 0) fail(`starter "${id}" should not have a recipe`);
}
for (const g of groups) {
  const n = [...els.values()].filter(e=>e.group===g.id).length;
  if (n === 0) fail(`group "${g.id}" has no elements`);
}

// ── reachability: closure from the four ────────────────────────────────────
const byPair = new Map(recipes.map(r=>[r.key,r.outs]));
const have = new Set(STARTERS);
const waveOf = new Map(STARTERS.map(s=>[s,0]));
let wave = 0, grew = true;
while (grew) {
  grew = false; wave++;
  const list = [...have];
  const added = [];
  for (let i=0;i<list.length;i++) for (let j=i;j<list.length;j++) {
    const outs = byPair.get([list[i],list[j]].sort().join('+'));
    if (outs) for (const o of outs) if (!have.has(o)) added.push(o);
  }
  for (const a of added) if (!have.has(a)) { have.add(a); waveOf.set(a,wave); grew = true; }
}
const unreachable = order.filter(id=>!have.has(id));
for (const id of unreachable) fail(`UNREACHABLE from fire/water/earth/air: "${id}" (${els.get(id).group})`);

// ── hint sanity: every non-starter reachable element must be reachable via a
//    pair whose two ingredients are themselves reachable strictly earlier ────
for (const id of have) {
  if (STARTERS.includes(id)) continue;
  const w = waveOf.get(id);
  const ok = recipes.some(r=>r.outs.includes(id) && have.has(r.a) && have.has(r.b) && waveOf.get(r.a) < w && waveOf.get(r.b) < w);
  if (!ok) fail(`"${id}" reached at wave ${w} but no recipe of strictly-earlier ingredients`);
}

// ── secrets must never gate required content ───────────────────────────────
{
  const openHave = new Set(STARTERS);
  let grew = true;
  while (grew){
    grew = false;
    const list = [...openHave];
    const add = [];
    for (let i=0;i<list.length;i++) for (let j=i;j<list.length;j++){
      const outs = byPair.get([list[i],list[j]].sort().join('+'));
      if (outs) for (const o of outs) if (!openHave.has(o) && !els.get(o).secret) add.push(o);
    }
    for (const a of add) if (!openHave.has(a)) { openHave.add(a); grew = true; }
  }
  /* One declared exception: the endgame chain is *meant* to run through two
     anomalies (ECHO and ORIGIN). Nothing else may. */
  const ENDGAME = new Set(['rizobuiltrizo','thematch']);
  const gated = [];
  for (const id of order){
    if (els.get(id).secret || openHave.has(id)) continue;
    if (ENDGAME.has(id)) { gated.push(id); continue; }
    fail(`"${id}" can only be reached through a secret — required content must not depend on anomalies`);
  }
  console.log(`\nsecret-gated by design: ${gated.join(', ') || 'none'}`);
  for (const id of ENDGAME) if (!gated.includes(id))
    warn(`"${id}" was declared an endgame exception but no longer needs one`);
}

// ── names & achievements must be sane ──────────────────────────────────────
{
  const names = new Set();
  for (const e of els.values()){
    if (names.has(e.name)) fail(`duplicate element name "${e.name}"`);
    names.add(e.name);
  }
  const secretTotal = order.filter(id=>els.get(id).secret).length;
  for (const a of (W.RIZO_ACHIEVEMENTS||[])){
    const nCounted = order.filter(id=>!els.get(id).secret).length;
    if (a.kind === 'count'   && a.n > nCounted) fail(`achievement "${a.id}" needs ${a.n} counted elements, only ${nCounted} exist`);
    if (a.kind === 'groups'  && a.n > groups.length)  fail(`achievement "${a.id}" needs ${a.n} domains, only ${groups.length} exist`);
    if (a.kind === 'secrets' && a.n > secretTotal)    fail(`achievement "${a.id}" needs ${a.n} secrets, only ${secretTotal} exist`);
    if (a.kind === 'own') for (const n of a.need) if (!have.has(n)) fail(`achievement "${a.id}" needs unreachable "${n}"`);
  }
}

// ── dead ends & balance ────────────────────────────────────────────────────
const deadEnds = order.filter(id=>els.get(id).uses===0);
const secrets = order.filter(id=>els.get(id).secret);
const counted = order.filter(id=>!els.get(id).secret);

// achievements
if (W.RIZO_ACHIEVEMENTS) {
  const ids = new Set();
  for (const a of W.RIZO_ACHIEVEMENTS) {
    if (ids.has(a.id)) fail(`duplicate achievement id "${a.id}"`);
    ids.add(a.id);
    if (!a.name || !a.desc) fail(`achievement "${a.id}" missing name/desc`);
    for (const need of (a.need||[])) if (!els.has(need)) fail(`achievement "${a.id}" references unknown element "${need}"`);
    if (a.group && !groupIds.has(a.group)) fail(`achievement "${a.id}" references unknown group "${a.group}"`);
  }
}

// ── report ─────────────────────────────────────────────────────────────────
const gcount = {};
for (const e of els.values()) gcount[e.group]=(gcount[e.group]||0)+1;
console.log('── RIZO ORIGIN content validation ─────────────────────────────');
console.log(`elements      ${els.size}   (counted ${counted.length} · secret ${secrets.length})`);
console.log(`recipes       ${recipes.length}   (unique pairs ${pairSeen.size})`);
console.log(`groups        ${groups.length}`);
console.log(`depth         ${Math.max(...waveOf.values())} waves from the four`);
console.log(`reachable     ${have.size}/${els.size}`);
console.log(`dead ends     ${deadEnds.length}  (elements never used as an ingredient)`);
if (V) {
  console.log('\ngroup sizes:'); for (const g of groups) console.log(`  ${g.id.padEnd(9)} ${String(gcount[g.id]||0).padStart(3)}`);
  console.log('\ndead ends: '+deadEnds.join(', '));
  const late = order.filter(id=>waveOf.get(id)>=1).sort((a,b)=>waveOf.get(b)-waveOf.get(a)).slice(0,15);
  console.log('\ndeepest: '+late.map(i=>`${i}(${waveOf.get(i)})`).join(' '));
}
// domain opening order + landmark depth
const gWave = {};
for (const id of order){ const g=els.get(id).group; const w=waveOf.get(id); if(gWave[g]==null||w<gWave[g]) gWave[g]=w; }
const gOrder = Object.entries(gWave).sort((a,b)=>a[1]-b[1]);
console.log('\ndomains open at wave:');
console.log('  '+gOrder.map(([g,w])=>{const f=order.filter(i=>els.get(i).group===g&&waveOf.get(i)===w);return g+'('+w+' via '+f.join('/')+')';}).join('\n  '));
const LAND = ['life','animal','human','thought','village','engine','internet','story','god','hell','devil','rizo','rizologo','nofamous','rizoworld','pittsburgh','origin','echo','player','rizobuiltrizo','thematch'];
console.log('\nlandmark depth:');
console.log('  '+LAND.filter(i=>els.has(i)).map(i=>i+'('+waveOf.get(i)+')').join('  '));
// how many elements are available by wave
const cum={}; for(const id of order){ const w=waveOf.get(id); cum[w]=(cum[w]||0)+1; }
let run=0; const curve=[];
Object.keys(cum).map(Number).sort((a,b)=>a-b).forEach(w=>{ run+=cum[w]; curve.push(w+':'+run); });
console.log('\ncumulative by wave:\n  '+curve.join('  '));

if (warns.length){ console.log('\nWARNINGS'); warns.forEach(w=>console.log('  ! '+w)); }
if (errors.length){ console.log(`\nERRORS (${errors.length})`); errors.forEach(e=>console.log('  ✗ '+e)); process.exit(1); }
console.log('\n✓ all checks passed');
