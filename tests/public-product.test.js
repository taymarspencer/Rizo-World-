/* Public defaults and real navigation contracts. No browser or network. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),os=require('node:os'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');let passed=0,total=0;
const sourceForRoute = route => route === '/' ? 'world.html' : route === '/play' ? 'index.html' : route.slice(1) + (path.extname(route) ? '' : '.html');
async function test(name,fn){total++;try{await fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e.message);process.exitCode=1}}
function bootstrap(mutate=()=>{}){
 const scripts=[],events={},window={addEventListener:(n,fn)=>events[n]=fn};
 const context={window,location:{protocol:'https:'},setTimeout,clearTimeout,
 document:{head:{appendChild:s=>scripts.push(s)},body:{dataset:{}},createElement:()=>({dataset:{}})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(ROOT,'rizo-config.js'),'utf8'),context);
 mutate(window);vm.runInContext(fs.readFileSync(path.join(ROOT,'monetization.js'),'utf8'),context);
 return{window,scripts,events};
}
(async()=>{
await test('default bootstrap cannot load ads even if another script grants nominal consent',async()=>{
 const f=bootstrap();assert.equal(f.window.RIZO_CONFIG.ads.enabled,false);assert.equal(f.window.RIZO_CONFIG.analytics.enabled,false);
 f.window.RizoPrivacy.setAdapter({canRequestAds:()=>true});assert.equal(await f.window.RizoMonetization.connect(),false);assert.equal(f.scripts.length,0);
});
await test('unverified account and unresolved or throwing permission keep configured integration closed',async()=>{
 for(const privacy of [null,{canRequestAds:()=>false},{canRequestAds:()=>{throw Error('pending')}}]){
  const f=bootstrap(w=>{w.RIZO_CONFIG={...w.RIZO_CONFIG,ads:{...w.RIZO_CONFIG.ads,enabled:true,provider:'google-h5',h5Games:{enabled:true},placements:{test:{enabled:true}},publisherVerified:false}};w.RizoAds={setProvider:()=>true}});
  f.window.RizoPrivacy.setAdapter(privacy);assert.equal(await f.window.RizoMonetization.connect(),false);assert.equal(f.scripts.length,0);
 }
});
await test('published routes have distinct titles, rizo.world canonicals, metadata and static content',()=>{
 const titles=new Set();
 for(const name of ['world','journal','about','support','privacy','terms','404','index']){
  const html=fs.readFileSync(path.join(ROOT,name+'.html'),'utf8');const title=/<title>([^<]+)<\/title>/.exec(html)?.[1];
  assert(title,name);assert(!titles.has(title),name);titles.add(title);
  assert(/rel="canonical"[^>]*https:\/\/rizo.world|https:\/\/rizo.world[^>]*rel="canonical"/.test(html),name);
  assert(html.includes('name="description"'),name);assert(html.includes('property="og:image"'),name);
  assert(!html.includes('google-adsense-account'),name);assert(!html.includes('adsbygoogle.js'),name);
  if(name!=='index'){assert.equal((html.match(/<h1[\s>]/g)||[]).length,1,name);assert(html.includes('tabindex="-1"'),name);assert(!/<script/.test(html),name);}
 }
});
await test('public navigation and fragment links resolve to actual files/sections',()=>{
 for(const name of ['world','journal','about','support','privacy','terms','404']){
  const html=fs.readFileSync(path.join(ROOT,name+'.html'),'utf8');
  for(const m of html.matchAll(/(?:href|src)="([^"?]+)"/g)){
   const ref=m[1];if(/^(https?:|data:|mailto:)/.test(ref))continue;
   const [local,fragment]=ref.split('#'),target=local?path.join(ROOT,sourceForRoute(new URL(local,'https://rizo.world/').pathname)):path.join(ROOT,name+'.html');
   assert(fs.existsSync(target),`${name}: ${ref}`);
   if(fragment)assert(fs.readFileSync(target,'utf8').includes(`id="${fragment}"`),`${name}: ${ref}`);
  }
 }
});
await test('sitemap names existing public content, without invented ads.txt or development pages',()=>{
 const sitemap=fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8');
 for(const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)){
  const u=new URL(m[1]);assert.equal(u.origin,'https://rizo.world');assert(fs.existsSync(path.join(ROOT,sourceForRoute(u.pathname))));
 }
 assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname).sort(),['/','/about','/journal','/play','/privacy','/support','/terms']);
 assert(!sitemap.includes('404.html'));assert(!sitemap.includes('docs/'));assert(!fs.existsSync(path.join(ROOT,'ads.txt')));
 assert(fs.readFileSync(path.join(ROOT,'ads.txt.template'),'utf8').split('\n').every(l=>!l.trim()||l.trim().startsWith('#')));
});
await test('production package makes World root and Play a distinct static entry with stable PWA identity',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rizo-routes-'));
 try {
  const out=path.join(temp,'site');const result=spawnSync('python3',['tools/build-site.py','--out',out],{cwd:ROOT,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const summary=JSON.parse(result.stdout);assert.equal(summary.files,161);assert.match(summary.fingerprint,/^[a-f0-9]{64}$/);
  assert.equal(fs.readFileSync(path.join(out,'index.html'),'utf8'),fs.readFileSync(path.join(ROOT,'world.html'),'utf8'));
  assert.equal(fs.readFileSync(path.join(out,'play.html'),'utf8'),fs.readFileSync(path.join(ROOT,'index.html'),'utf8'));
  assert(!fs.existsSync(path.join(out,'world.html')));assert(!fs.existsSync(path.join(out,'docs')));assert(!fs.existsSync(path.join(out,'tests')));assert(!fs.existsSync(path.join(out,'ads.txt')));
  const home=fs.readFileSync(path.join(out,'index.html'),'utf8');assert(home.includes('href="/play"'));assert(!/<script/.test(home));assert(home.includes('href="https://rizo.world/"'));
  const redirects=fs.readFileSync(path.join(out,'_redirects'),'utf8');assert(redirects.includes('/index.html /play 301'));assert(redirects.includes('/play/ /play 301'));assert(redirects.includes('/world.html / 301'));
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.webmanifest'),'utf8'));assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./play?source=pwa');
 } finally {fs.rmSync(temp,{recursive:true,force:true})}
});
await test('overlapping Cloudflare rules never emit duplicate MIME headers',()=>{
 const rules=[];let current;
 for(const line of fs.readFileSync(path.join(ROOT,'_headers'),'utf8').split('\n')){
  if(!line.trim()||line.trim().startsWith('#'))continue;
  if(line.startsWith('/')){current={pattern:line.trim(),types:[]};rules.push(current)}
  else if(/^\s+Content-Type:/i.test(line))current.types.push(line.split(':').slice(1).join(':').trim());
 }
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const route of ['/','/play','/play.html','/index.html','/sw.js','/manifest.webmanifest','/game-v79-defense.js','/core/rizo-save-core.js','/public-world.css']){
  const types=rules.filter(r=>new RegExp('^'+r.pattern.split('*').map(escape).join('.*')+'$').test(route)).flatMap(r=>r.types);
  assert(types.length<=1,`${route}: Pages combines matching values; duplicate Content-Type is invalid: ${types}`);
 }
});
await test('public text and focus colors have readable contrast on the ink surface',()=>{
 function luminance(hex){const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]}
 const bg=luminance('151513');for(const color of ['eee8dc','b9b5ac','ecd292','8dbac5'])assert((luminance(color)+.05)/(bg+.05)>=4.5,color);
});
console.log(`\n${passed}/${total} public product contract checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
