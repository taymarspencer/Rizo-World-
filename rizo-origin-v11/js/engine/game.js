/* RIZO ORIGIN — the game itself.
   Parses the content tables into an indexed graph, owns all state, and
   answers exactly two questions the interface cares about:
     "what happens when I put these two together"  and  "what should I try next". */
(function(){

const SAVE_KEY   = 'rizo.origin.v1';
const STARTERS   = ['fire','water','earth','air'];
const REVEAL_AT  = 0.33;          // fraction of counted elements before the size of it all is shown
const HINT_COOL  = 6000;          // ms before a *new* hint target; escalating the current one is free

/* ── parse content ──────────────────────────────────────────────────────── */
const GROUPS = {}, GROUP_ORDER = [];
window.RIZO_GROUPS.forEach(g => { GROUPS[g.id] = g; GROUP_ORDER.push(g.id); });

const EL = {}, EL_ORDER = [];
window.RIZO_ELEMENT_TABLE.split('\n').forEach(raw => {
  const line = raw.trim();
  if (!line || line[0] === '#') return;
  const p = line.split('|').map(s => s.trim());
  if (p.length !== 5) return;
  EL[p[0]] = { id:p[0], name:p[1], group:p[2], secret:p[3].includes('s'), major:p[3].includes('m'), flavor:p[4] };
  EL_ORDER.push(p[0]);
});

const PAIR = {};                       // "a+b" (sorted) -> primary result id
const EXTRA = {};                      // "a+b" -> [second result id], for reactions that throw off two things
const MADE_BY = {};                    // result id -> [[a,b], ...]
const USES = {};                       // element id -> Set of pair keys it appears in
window.RIZO_RECIPE_TABLE.split('\n').forEach(raw => {
  const line = raw.trim();
  if (!line || line[0] === '#') return;
  const m = line.match(/^([a-z0-9]+)\s*\+\s*([a-z0-9]+)\s*=\s*([a-z0-9]+)(?:\s*\+\s*([a-z0-9]+))?$/);
  if (!m) return;
  const a = m[1], b = m[2], out = m[3], out2 = m[4];
  const key = a < b ? a+'+'+b : b+'+'+a;
  PAIR[key] = out;
  if (out2) EXTRA[key] = [out2];
  [out, out2].forEach(o => { if (o) (MADE_BY[o] = MADE_BY[o] || []).push([a,b]); });
  (USES[a] = USES[a] || new Set()).add(key);
  (USES[b] = USES[b] || new Set()).add(key);
});

const ORDER_IX = {}; EL_ORDER.forEach((id,i) => { ORDER_IX[id] = i; });
const GROUP_IX = {}; GROUP_ORDER.forEach((g,i) => { GROUP_IX[g] = i; });
EL_ORDER.forEach(id => { EL[id].ix = ORDER_IX[id]; EL[id].gix = GROUP_IX[EL[id].group]; });
const COUNTED = EL_ORDER.filter(id => !EL[id].secret);
const TOTAL_COUNTED = COUNTED.length;
const TOTAL_SECRET  = EL_ORDER.length - TOTAL_COUNTED;
const ACH = window.RIZO_ACHIEVEMENTS;

/* ── state ──────────────────────────────────────────────────────────────── */
const S = {
  found:{}, groups:{}, recipes:{}, fresh:{}, favs:{}, ach:{}, dead:{},
  stats:{ attempts:0, fails:0, hits:0, hints:0, started:0, played:0, last:'' },
  flags:{}, revealed:false, ended:false, seenIntro:false,
  settings:{ muted:false, motion:true, motionUserSet:false }
};

function blank(){
  S.found = {}; S.groups = {}; S.recipes = {}; S.fresh = {}; S.favs = {}; S.ach = {}; S.dead = {};
  S.stats = { attempts:0, fails:0, hits:0, hints:0, started:Date.now(), played:0, last:'' };
  S.flags = {}; S.revealed = false; S.ended = false; S.seenIntro = false;
  hintTarget = null; hintTier = 0; hintAt = 0;
  /* A fresh board is a fresh session. Without resetting this clock, choosing
     NEW GAME could inherit a slice of the previous run's play time. */
  sessionStart = Date.now();
  /* Player preferences are not progress. NEW GAME burns the board, not the
     choices the player already made about sound or animation. */
  STARTERS.forEach(id => { S.found[id] = 1; });
  S.groups.element = 1;
}

/* ── save ───────────────────────────────────────────────────────────────── */
let saveTimer = null, sessionStart = Date.now();
function pack(){
  return {
    v:1,
    f:Object.keys(S.found).join(','),
    g:Object.keys(S.groups).join(','),
    r:Object.keys(S.recipes).join(','),
    n:Object.keys(S.fresh).join(','),
    x:Object.keys(S.favs).join(','),
    a:Object.keys(S.ach).join(','),
    d:Object.keys(S.dead).join(','),
    s:S.stats, fl:S.flags, rv:S.revealed?1:0, en:S.ended?1:0, si:S.seenIntro?1:0,
    st:S.settings
  };
}
function unpack(d){
  /* Validate before touching the current board: a rejected import is harmless. */
  const record = x => x && typeof x === 'object' && !Array.isArray(x);
  if (!record(d) || d.v !== 1 || typeof d.f !== 'string') return false;
  for (const k of ['g','r','n','x','a','d']) if (d[k] != null && typeof d[k] !== 'string') return false;
  for (const k of ['s','fl','st']) if (d[k] != null && !record(d[k])) return false;
  blank();
  const set = (str,obj,valid) => { if (str) str.split(',').forEach(k => { if (valid(k)) obj[k] = 1; }); };
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  set(d.f,S.found,k => own(EL,k));
  STARTERS.forEach(id => { S.found[id] = 1; });
  Object.keys(S.found).forEach(id => { S.groups[EL[id].group] = 1; });
  set(d.r,S.recipes,k => own(PAIR,k) && k.split('+').every(id => S.found[id]));
  set(d.n,S.fresh,k => own(S.found,k));
  set(d.x,S.favs,k => own(S.found,k));
  set(d.a,S.ach,k => ACH.some(a => a.id === k));
  /* Dead pairs are memory, not content. If a later game version turns an old
     dead end into a real recipe, the scar disappears automatically. */
  set(d.d,S.dead,k => !PAIR[k] && k.split('+').length===2 && k.split('+').every(id => own(EL,id)));
  if (d.s){
    for (const k of ['attempts','fails','hits','hints','started','played']) {
      if (Number.isFinite(d.s[k]) && d.s[k] >= 0) S.stats[k] = d.s[k];
    }
    if (own(EL,d.s.last) && S.found[d.s.last]) S.stats.last = d.s.last;
  }
  if (d.fl){
    for (const k of ['stubborn','selfcombo','earlyrizo','nohelp','mainComplete','fullComplete','signalIntro','smartIntro','relationIntro']) {
      if (d.fl[k] === 1 || d.fl[k] === true) S.flags[k] = 1;
    }
  }
  S.revealed = !!d.rv; S.ended = !!d.en; S.seenIntro = !!d.si;
  if (d.st){
    if(typeof d.st.muted==='boolean') S.settings.muted=d.st.muted;
    /* V3 could silently inherit OS Reduce Motion. Only preserve motion=false
       when a V4+ save records that the player chose it inside the game. */
    S.settings.motionUserSet=!!d.st.motionUserSet;
    S.settings.motion = S.settings.motionUserSet && typeof d.st.motion==='boolean' ? d.st.motion : true;
  }
  /* Old completed saves must not replay the ending on each later discovery. */
  if (countCounted() === TOTAL_COUNTED) S.flags.mainComplete = 1;
  if (countFound() === EL_ORDER.length) S.flags.fullComplete = 1;
  hintTarget = null; hintTier = 0; hintAt = 0;
  sessionStart = Date.now();
  return true;
}
function save(){
  S.stats.played = (S.stats.played || 0) + (Date.now() - sessionStart);
  sessionStart = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(pack())); } catch(e){}
}
function autosave(){ clearTimeout(saveTimer); saveTimer = setTimeout(save, 700); }
function load(){
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch(e){}
  if (raw) { try { if (unpack(JSON.parse(raw))) return true; } catch(e){} }
  blank();
  return false;
}

/* ── queries ────────────────────────────────────────────────────────────── */
const has        = id => !!S.found[id];
const countFound = () => Object.keys(S.found).length;
const countCounted = () => COUNTED.reduce((n,id) => n + (S.found[id] ? 1 : 0), 0);
const countSecret  = () => EL_ORDER.reduce((n,id) => n + (EL[id].secret && S.found[id] ? 1 : 0), 0);
const progress   = () => countCounted() / TOTAL_COUNTED;
const playedMs   = () => (S.stats.played || 0) + Math.max(0, Date.now() - sessionStart);

function groupsFound(){ return Object.keys(S.groups).filter(g => GROUPS[g]); }
function groupSize(g){ return EL_ORDER.reduce((n,id) => n + (EL[id].group===g && !EL[id].secret ? 1 : 0), 0); }
function groupFoundCount(g){ return EL_ORDER.reduce((n,id) => n + (EL[id].group===g && !EL[id].secret && S.found[id] ? 1 : 0), 0); }
function groupFoundAll(g){ return EL_ORDER.reduce((n,id) => n + (EL[id].group===g && S.found[id] ? 1 : 0), 0); }
function groupComplete(g){
  return groupSize(g) > 0 && groupFoundCount(g) === groupSize(g);
}

function elementPotential(id){
  let live=0, untried=0;
  const keys=USES[id]; if(!keys)return {live,untried};
  keys.forEach(key=>{
    const parts=key.split('+'); if(!parts.every(has))return;
    const outs=[PAIR[key]].concat(EXTRA[key]||[]).filter(Boolean);
    if(outs.some(o=>!S.found[o]&&!EL[o].secret)) live++;
    else if(!S.recipes[key]) untried++;
  });
  return {live,untried};
}
function pairKey(a,b){ return a < b ? a+'+'+b : b+'+'+a; }
function triedDead(a,b){ return !!(a && b && S.dead[pairKey(a,b)]); }
function deadPairsFor(id){
  if(!id)return [];
  return Object.keys(S.dead).filter(key=>key.split('+').includes(id));
}
function routesTo(id){
  const out=[];
  Object.keys(S.recipes).forEach(key=>{
    const outputs=[PAIR[key]].concat(EXTRA[key]||[]);
    if(!outputs.includes(id))return;
    const [a,b]=key.split('+'); out.push({a,b,out:id,key});
  });
  return out.sort((x,y)=>ORDER_IX[x.a]-ORDER_IX[y.a] || ORDER_IX[x.b]-ORDER_IX[y.b]);
}
function recipesUsing(id){
  const out=[];
  Object.keys(S.recipes).forEach(key=>{
    const [a,b]=key.split('+'); if(a!==id && b!==id)return;
    [PAIR[key]].concat(EXTRA[key]||[]).filter(Boolean).forEach(result=>out.push({a,b,out:result,key}));
  });
  return out;
}
function confluenceCount(){
  let n=0; Object.keys(S.found).forEach(id=>{ if(routesTo(id).length>=2)n++; }); return n;
}
function smartLimit(){
  /* Structure should breathe with the world. Six domains need a tight bench;
     twenty-two domains can afford a slightly wider one without becoming a dump. */
  const g=groupsFound().length;
  return g<8?18:g<12?21:g<16?24:g<20?26:28;
}
function smartElements(limit,focus){
  const owned=Object.keys(S.found), rev=owned.slice().reverse(), recent={};
  rev.forEach((id,i)=>recent[id]=i);
  const groupRev=groupsFound().slice().reverse(), groupRecent={}; groupRev.forEach((g,i)=>groupRecent[g]=i);
  const scored=owned.map(id=>{
    const p=elementPotential(id), ri=recent[id]||0, gi=groupRecent[EL[id].group]||0;
    /* The working set is useful without becoming a hint. It knows which pieces
       still have unexplored voltage in the CURRENT board, but never exposes
       the partner or the result. Freshness and recency stop old utility pieces
       from owning the top forever. When a piece is already in hand, only the
       player's OWN memory changes the order: known dead pairs drift backward. */
    let score=p.live*52 + Math.min(4,p.untried)*5 + Math.max(0,44-ri*3.4) + Math.max(0,16-gi*3);
    if(S.fresh[id])score+=72;
    if(S.favs[id])score+=9;
    if(S.stats.last===id)score+=24;
    if(STARTERS.includes(id)&&owned.length>45)score-=13;
    if(focus){
      const key=pairKey(focus,id);
      if(S.dead[key]) score-=150;
      else if(S.recipes[key]) score-=18;
      if(id===focus) score+=7; /* self-combination remains a real possibility */
    }
    score+=((ORDER_IX[id]*17)%13)/20; /* deterministic tie breaker, no jitter on repaint */
    return {id,score,live:p.live,ri};
  });
  scored.sort((a,b)=>b.score-a.score || b.live-a.live || a.ri-b.ri || ORDER_IX[a.id]-ORDER_IX[b.id]);
  const n=Math.max(12,Math.min(limit||smartLimit(),owned.length));
  return scored.slice(0,n).map(x=>x.id);
}
function elementsIn(filter){
  if(filter && filter.smart) return smartElements(filter.limit||smartLimit(),filter.focus||null);
  let list = filter && filter.recent ? Object.keys(S.found).reverse() : EL_ORDER.filter(has);
  if (filter && filter.group) list = list.filter(id => EL[id].group === filter.group);
  if (filter && filter.fresh) list = list.filter(id => S.fresh[id]);
  if (filter && filter.fav)   list = list.filter(id => S.favs[id]);
  if (filter && filter.q){
    const q = filter.q.toLowerCase();
    list = list.filter(id => EL[id].name.toLowerCase().includes(q));
  }
  if (filter && filter.recent) return list.slice(0,30);
  return list.sort((a,b) => (EL[a].gix - EL[b].gix) || (EL[a].ix - EL[b].ix));
}

/* recipes involving `id` that the player has personally discovered. Kept as
   the broad legacy query; the encyclopedia now also distinguishes origins from
   consequences because those are different relationships. */
function knownRecipesFor(id){
  const seen=new Set(), out=[];
  routesTo(id).concat(recipesUsing(id)).forEach(r=>{ const sig=r.a+'+'+r.b+'='+r.out; if(!seen.has(sig)){seen.add(sig);out.push(r);} });
  return out;
}

/* ── the whole point ────────────────────────────────────────────────────── */
function combine(a, b){
  const key = a < b ? a+'+'+b : b+'+'+a;
  S.stats.attempts++;
  const out = PAIR[key];

  if (!out){
    S.stats.fails++;
    const firstDead=!S.dead[key]; S.dead[key]=1;
    const streak = (S.flags.deadKey === key) ? (S.flags.deadN||1)+1 : 1;
    S.flags.deadKey = key; S.flags.deadN = streak;
    if (streak >= 6) raise('stubborn');
    autosave();
    return { kind:'none', input:[a,b], deadNew:firstDead, ach:checkAchievements() };
  }

  S.flags.deadKey = null; S.flags.deadN = 0;
  delete S.dead[key];
  S.stats.hits++;
  const firstRecipe = !S.recipes[key];
  S.recipes[key] = 1;

  if (a === b) raise('selfcombo');
  const discoveries = [out].concat(EXTRA[key] || []).filter(id => !has(id));
  if (!discoveries.length){
    const ach = checkAchievements();
    const routes=routesTo(out);
    autosave();
    return { kind: firstRecipe ? 'route' : 'known', el:EL[out], input:[a,b], routes, routeCount:routes.length, ach };
  }

  /* The first NEW result leads the reveal, even if the primary was already known.
     Carry the discovery ordinal with each result. A two-result reaction must read
     FOUND 021, FOUND 022 — never two cards both claiming the final count. */
  const preGroups = {}, preComplete = {};
  Object.keys(S.found).forEach(id => { preGroups[EL[id].group] = 1; });
  discoveries.forEach(id=>{ const gid=EL[id].group; if(preComplete[gid]==null) preComplete[gid]=groupComplete(gid); });
  const beforeCounted = countCounted();
  let countedCursor = beforeCounted;
  const revealMeta = [];
  const also = [];
  let primaryNewGroup = false;

  discoveries.forEach((id,i) => {
    const found = EL[id];
    const priorInThisReaction = discoveries.slice(0,i).some(x => EL[x].group===found.group);
    const opensGroup = !preGroups[found.group] && !priorInThisReaction;
    const foundNumber = found.secret ? null : ++countedCursor;
    revealMeta.push({ id, foundNumber });
    if (i===0) primaryNewGroup = opensGroup;
    else also.push({ el:found, newGroup:opensGroup, group:GROUPS[found.group], foundNumber });
    S.found[id] = 1; S.fresh[id] = 1; S.groups[found.group] = 1;
  });

  const e = EL[discoveries[0]];
  S.stats.last = discoveries[discoveries.length-1];
  if (discoveries.includes('rizo') && countCounted() < 200) raise('earlyrizo');
  if (!S.stats.hints && countCounted() >= 150) raise('nohelp');

  const completedGroups=[...new Set(discoveries.map(id=>EL[id].group))].filter(gid=>!preComplete[gid]&&groupComplete(gid));
  const res = { kind:'new', el:e, input:[a,b], newGroup:primaryNewGroup, group:GROUPS[e.group], secret:e.secret, major:e.major,
    foundNumber:revealMeta[0].foundNumber, also, completedGroups };
  res.reveal = !S.revealed && progress() >= REVEAL_AT;
  if (res.reveal) S.revealed = true;
  res.ach = checkAchievements();
  res.ending = discoveries.includes('thematch') && !S.ended;
  if (res.ending) S.ended = true;
  res.complete = countCounted() === TOTAL_COUNTED && !S.flags.mainComplete;
  if (res.complete) S.flags.mainComplete = 1;
  res.fullComplete = countFound() === EL_ORDER.length && !S.flags.fullComplete;
  if (res.fullComplete) S.flags.fullComplete = 1;
  autosave();
  return res;
}

function raise(flag){ S.flags[flag] = 1; }

/* ── achievements ───────────────────────────────────────────────────────── */
function achDone(a){
  switch(a.kind){
    case 'own':      return a.need.every(has);
    case 'count':    return countCounted() >= a.n;
    case 'groups':   return groupsFound().length >= a.n;
    case 'domain':   return groupsFound().some(groupComplete);
    case 'secrets':  return countSecret() >= a.n;
    case 'flag':     return !!S.flags[a.flag];
    case 'stat':     return (S.stats[a.stat]||0) >= a.n;
    case 'complete': return countCounted() === TOTAL_COUNTED;
  }
  return false;
}
function checkAchievements(){
  const got = [];
  ACH.forEach(a => { if (!S.ach[a.id] && achDone(a)) { S.ach[a.id] = 1; got.push(a); } });
  return got;
}

/* ── hints ──────────────────────────────────────────────────────────────── */
/* A hint is only ever a pair the player can physically make right now whose
   result they have not seen. Escalates in place; a new target costs a cooldown. */
let hintTarget = null, hintTier = 0, hintAt = 0;

function candidates(){
  const owned = EL_ORDER.filter(has);
  const out = [];
  for (let i=0;i<owned.length;i++){
    for (let j=i;j<owned.length;j++){
      const a = owned[i], b = owned[j];
      const key = a < b ? a+'+'+b : b+'+'+a;
      const r = PAIR[key];
      if (!r) continue;
      if (!S.found[r] && !EL[r].secret) out.push({ a, b, out:r, key });
      else (EXTRA[key]||[]).forEach(r2 => { if (!S.found[r2] && !EL[r2].secret) out.push({ a, b, out:r2, key }); });
    }
  }
  return out;
}

function pickHint(){
  const c = candidates();
  if (!c.length) return null;
  /* prefer a door into a domain that does not exist yet, then non-secret,
     then something that will itself unlock more */
  const score = h => {
    let s = 0;
    if (!S.groups[EL[h.out].group]) s += 100;
    if (EL[h.out].secret) s -= 60;
    if (EL[h.out].major) s += 20;
    s += Math.min(20, (USES[h.out] ? USES[h.out].size : 0) * 2);
    return s + Math.random() * 8;
  };
  c.sort((x,y) => score(y) - score(x));
  return c[0];
}

function hint(){
  const now = Date.now();
  /* a hint that has been pushed as far as it goes rotates to a different one,
     so nobody can be permanently stuck on a single riddle */
  const exhausted = hintTarget && hintTier >= 3;
  const stillValid = !exhausted && hintTarget && !S.found[hintTarget.out] && has(hintTarget.a) && has(hintTarget.b);
  if (!stillValid){
    if (now - hintAt < HINT_COOL && hintTarget) return { kind:'wait', ms: HINT_COOL - (now - hintAt) };
    const previous = hintTarget;
    hintTarget = pickHint();
    if (!hintTarget) return { kind:'none' };
    /* try not to hand back the same riddle twice in a row */
    if (previous && hintTarget.key === previous.key){
      const alt = candidates().filter(c => c.key !== previous.key);
      if (alt.length) hintTarget = alt[Math.floor(Math.random()*alt.length)];
    }
    hintTier = 0; hintAt = now;
  }
  hintTier = Math.min(3, hintTier + 1);
  S.stats.hints++; autosave();

  const t = hintTarget, e = EL[t.out];
  const unknownDomain = !S.groups[e.group];
  const ga = GROUPS[EL[t.a].group].name, gb = GROUPS[EL[t.b].group].name;

  if (hintTier === 1){
    return { kind:'nudge', tier:1, text: unknownDomain
      ? 'There is something you can build right now, and it does not belong to anywhere you have been.'
      : 'There is something you can build right now. It belongs to <b>' + GROUPS[e.group].name + '</b>.' };
  }
  if (hintTier === 2){
    return { kind:'domain', tier:2, text: (ga === gb)
      ? 'Both halves of it are sitting in <b>' + ga + '</b>.'
      : 'One half is in <b>' + ga + '</b>. The other is in <b>' + gb + '</b>.' };
  }
  /* strong: name one ingredient outright, describe the other */
  const showA = Math.random() < 0.5;
  const shown = showA ? t.a : t.b, other = showA ? t.b : t.a;
  return { kind:'strong', tier:3,
    text: 'Take <b>' + EL[shown].name + '</b>. The other one goes: &ldquo;' + EL[other].flavor + '&rdquo;' };
}
function hintState(){
  return { armed: !!hintTarget && !S.found[hintTarget.out], tier: hintTier };
}

/* ── domain teasing ─────────────────────────────────────────────────────── */
/* true when a single reachable combination would open a domain the player has
   never seen. The interface uses it to make something flicker at the edge. */
function nearNewDomain(){
  const owned = EL_ORDER.filter(has);
  for (let i=0;i<owned.length;i++){
    for (let j=i;j<owned.length;j++){
      const a = owned[i], b = owned[j];
      const key = a < b ? a+'+'+b : b+'+'+a;
      const outs = [PAIR[key]].concat(EXTRA[key] || []);
      for (const r of outs) if (r && !EL[r].secret && !S.found[r] && !S.groups[EL[r].group]) return true;
    }
  }
  return false;
}

/* ── export / import ────────────────────────────────────────────────────── */
function exportSave(){ save(); return btoa(unescape(encodeURIComponent(JSON.stringify(pack())))); }
function importSave(str){
  try{
    const d = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!unpack(d)) return false;
    save(); return true;
  } catch(e){ return false; }
}

window.Rizo = {
  EL, EL_ORDER, GROUPS, GROUP_ORDER, PAIR, EXTRA, MADE_BY, ACH, STARTERS,
  TOTAL_COUNTED, TOTAL_SECRET, REVEAL_AT,
  S, load, save, autosave, blank,
  has, countFound, countCounted, countSecret, progress, playedMs,
  groupsFound, groupSize, groupFoundCount, groupFoundAll, groupComplete,
  elementsIn, smartElements, smartLimit, elementPotential, knownRecipesFor, routesTo, recipesUsing, confluenceCount, triedDead, deadPairsFor, combine, hint, hintState, nearNewDomain,
  checkAchievements, exportSave, importSave,
  resetHint(){ hintTarget = null; hintTier = 0; hintAt = 0; }
};
})();
