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
  found:{}, groups:{}, recipes:{}, fresh:{}, favs:{}, ach:{},
  stats:{ attempts:0, fails:0, hits:0, hints:0, started:0, played:0, last:'' },
  flags:{}, revealed:false, ended:false, seenIntro:false,
  settings:{ muted:false, motion:true }
};

function blank(){
  S.found = {}; S.groups = {}; S.recipes = {}; S.fresh = {}; S.favs = {}; S.ach = {};
  S.stats = { attempts:0, fails:0, hits:0, hints:0, started:Date.now(), played:0, last:'' };
  S.flags = {}; S.revealed = false; S.ended = false;
  /* respect the system setting the first time, then it's the player's call */
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) S.settings.motion = false; } catch(e){}
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
    s:S.stats, fl:S.flags, rv:S.revealed?1:0, en:S.ended?1:0, si:S.seenIntro?1:0,
    st:S.settings
  };
}
function unpack(d){
  if (!d || d.v !== 1) return false;
  blank();
  const set = (str,obj) => { if (str) str.split(',').forEach(k => { if (k) obj[k] = 1; }); };
  set(d.f,S.found); set(d.g,S.groups); set(d.r,S.recipes); set(d.n,S.fresh);
  set(d.x,S.favs); set(d.a,S.ach);
  Object.keys(S.found).forEach(id => { if (!EL[id]) delete S.found[id]; });
  STARTERS.forEach(id => { S.found[id] = 1; });
  Object.keys(S.found).forEach(id => { S.groups[EL[id].group] = 1; });
  if (d.s) Object.assign(S.stats, d.s);
  if (d.fl) S.flags = d.fl;
  S.revealed = !!d.rv; S.ended = !!d.en; S.seenIntro = !!d.si;
  if (d.st) Object.assign(S.settings, d.st);
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

function groupsFound(){ return GROUP_ORDER.filter(g => S.groups[g]); }
function groupSize(g){ return EL_ORDER.reduce((n,id) => n + (EL[id].group===g && !EL[id].secret ? 1 : 0), 0); }
function groupFoundCount(g){ return EL_ORDER.reduce((n,id) => n + (EL[id].group===g && !EL[id].secret && S.found[id] ? 1 : 0), 0); }
function groupFoundAll(g){ return EL_ORDER.reduce((n,id) => n + (EL[id].group===g && S.found[id] ? 1 : 0), 0); }
function groupComplete(g){
  return groupSize(g) > 0 && groupFoundCount(g) === groupSize(g);
}

function elementsIn(filter){
  let list = EL_ORDER.filter(has);
  if (filter && filter.group) list = list.filter(id => EL[id].group === filter.group);
  if (filter && filter.fresh) list = list.filter(id => S.fresh[id]);
  if (filter && filter.fav)   list = list.filter(id => S.favs[id]);
  if (filter && filter.q){
    const q = filter.q.toLowerCase();
    list = list.filter(id => EL[id].name.toLowerCase().includes(q));
  }
  return list.sort((a,b) => (EL[a].gix - EL[b].gix) || (EL[a].ix - EL[b].ix));
}

/* recipes involving `id` that the player has personally discovered */
function knownRecipesFor(id){
  const out = [];
  Object.keys(S.recipes).forEach(key => {
    const [a,b] = key.split('+');
    [PAIR[key]].concat(EXTRA[key] || []).forEach(res => {
      if (res && (a === id || b === id || res === id)) out.push({ a, b, out:res });
    });
  });
  return out;
}

/* ── the whole point ────────────────────────────────────────────────────── */
function combine(a, b){
  const key = a < b ? a+'+'+b : b+'+'+a;
  S.stats.attempts++;
  const out = PAIR[key];

  if (!out){
    S.stats.fails++;
    const streak = (S.flags.deadKey === key) ? (S.flags.deadN||1)+1 : 1;
    S.flags.deadKey = key; S.flags.deadN = streak;
    if (streak >= 6) raise('stubborn');
    autosave();
    return { kind:'none' };
  }

  S.flags.deadKey = null; S.flags.deadN = 0;
  S.stats.hits++;
  const firstRecipe = !S.recipes[key];
  S.recipes[key] = 1;

  if (has(out)){
    autosave();
    return { kind: firstRecipe ? 'route' : 'known', el:EL[out] };
  }

  /* new discovery */
  const e = EL[out];
  const newGroup = !S.groups[e.group];
  S.found[out] = 1; S.fresh[out] = 1; S.groups[e.group] = 1;
  S.stats.last = out;

  if (a === b) raise('selfcombo');
  if (out === 'rizo' && countCounted() < 200) raise('earlyrizo');
  if (!S.stats.hints && countCounted() >= 150) raise('nohelp');

  /* a reaction that throws off two things hands over the second one as well */
  const also = [];
  (EXTRA[key] || []).forEach(id2 => {
    if (S.found[id2]) return;
    const e2 = EL[id2];
    also.push({ el:e2, newGroup:!S.groups[e2.group], group:GROUPS[e2.group] });
    S.found[id2] = 1; S.fresh[id2] = 1; S.groups[e2.group] = 1;
  });

  const res = { kind:'new', el:e, newGroup, group:GROUPS[e.group], secret:e.secret, major:e.major, also };
  res.reveal = !S.revealed && progress() >= REVEAL_AT;
  if (res.reveal) S.revealed = true;
  res.ach = checkAchievements();
  res.ending = (out === 'thematch') && !S.ended;
  if (res.ending) S.ended = true;
  res.complete = countCounted() === TOTAL_COUNTED;
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
      if (!S.found[r]) out.push({ a, b, out:r, key });
      else (EXTRA[key]||[]).forEach(r2 => { if (!S.found[r2]) out.push({ a, b, out:r2, key }); });
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
      for (const r of outs) if (r && !S.found[r] && !S.groups[EL[r].group]) return true;
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
  has, countFound, countCounted, countSecret, progress,
  groupsFound, groupSize, groupFoundCount, groupFoundAll, groupComplete,
  elementsIn, knownRecipesFor, combine, hint, hintState, nearNewDomain,
  checkAchievements, exportSave, importSave,
  resetHint(){ hintTarget = null; hintTier = 0; hintAt = 0; }
};
})();
