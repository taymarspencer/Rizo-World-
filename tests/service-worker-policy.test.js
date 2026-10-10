const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const listeners={};
const store=new Map(),oldStore=new Map();let skipWaitingCalls=0;
let networkMode='online';
const keyOf=req=>typeof req==='string'?new URL(req,'https://rizo.world/').href:req.url;
const cache={
  async put(req,res){store.set(keyOf(req),res.clone())},
  async match(req){const r=store.get(keyOf(req));return r?r.clone():undefined},
  async add(){}, async addAll(){}
};
const caches={
  async open(){return cache},
  async match(req){return (await cache.match(req))||oldStore.get(keyOf(req))?.clone()},
  async keys(){return ['rizo-game-v87-first-ten']},
  async delete(){return true}
};
const context={
  URL,Set,Map,Promise,Response,Request,console,caches,
  fetch:async req=>{
    if(networkMode==='offline') throw new Error('offline');
    const url=keyOf(req);
    const make=(body,init={})=>{const r=new Response(body,init);Object.defineProperty(r,'type',{value:'basic'});return r};
    if(url.endsWith('game-v79-defense.js')) return make('NETWORK_RUNTIME',{status:200,headers:{'Content-Type':'application/javascript'}});
    if(url.includes('/unknown/')) return make('MISSING_PAGE',{status:404});
    if(new URL(url).pathname==='/') return make('<!doctype html>NETWORK_WORLD',{status:200,headers:{'Content-Type':'text/html'}});
    if(new URL(url).pathname==='/play') return make('<!doctype html>NETWORK_GAME',{status:200,headers:{'Content-Type':'text/html'}});
    return make('NETWORK_ASSET',{status:200});
  },
  self:{
    location:new URL('https://rizo.world/sw.js'),
    addEventListener(type,fn){listeners[type]=fn},
    clients:{claim:async()=>true}, skipWaiting:async()=>{skipWaitingCalls++;return true}
  }
};
vm.createContext(context);vm.runInContext(code,context,{filename:'sw.js'});
async function dispatch(url,{mode='same-origin'}={}){
  const request=new Request(url,{method:'GET'});
  // Request.mode is readonly; provide the minimal request-shaped object used by worker.
  const shaped={url:request.url,method:'GET',mode};
  let promise=null;listeners.fetch({request:shaped,respondWith(value){promise=Promise.resolve(value)}});
  return promise?await promise:null;
}
(async()=>{
  let passed=0;const test=async(name,fn)=>{try{await fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e.message);process.exitCode=1}};
  await test('runtime JS is network-first even with poisoned cache',async()=>{
    const url='https://rizo.world/game-v79-defense.js';
    store.set(url,new Response('STALE_CACHE_RUNTIME_EXECUTED',{status:200}));networkMode='online';
    const r=await dispatch(url);assert.equal(await r.text(),'NETWORK_RUNTIME');
    assert.equal(await (await cache.match(url)).text(),'NETWORK_RUNTIME');
  });
  await test('runtime JS falls back to repaired cache offline',async()=>{
    const url='https://rizo.world/game-v79-defense.js';networkMode='offline';
    const r=await dispatch(url);assert.equal(await r.text(),'NETWORK_RUNTIME');
  });
  await test('navigation is network-first and cache-backed offline',async()=>{
    const url='https://rizo.world/play';networkMode='online';
    let r=await dispatch(url,{mode:'navigate'});assert((await r.text()).includes('NETWORK_GAME'));
    networkMode='offline';r=await dispatch(url,{mode:'navigate'});assert((await r.text()).includes('NETWORK_GAME'));
  });
  await test('worker has versioned release cache and optional best-effort install',async()=>{
    const build=/<meta name="rizo-build" content="([^"]+)"/.exec(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'))[1];
    assert(code.includes(`const CACHE = "rizo-game-${build}"`),'service-worker cache must carry the page build marker');
    assert(code.includes('Promise.allSettled'));
    assert(code.includes('cache.addAll(REQUIRED_SHELL)'));
    assert(code.includes('./arcade-v84-depth.css'));
    assert(code.includes('./rizo-v85-handmade.css'));
    assert(code.includes('await self.skipWaiting()'));
  });
  await test('missing online navigation preserves 404 and is never cached as successful content',async()=>{
    networkMode='online';const url='https://rizo.world/unknown/deep/';
    const r=await dispatch(url,{mode:'navigate'});assert.equal(r.status,404);assert.equal(await r.text(),'MISSING_PAGE');assert(!store.has(url));
  });
  await test('only known World and Play routes have their own offline fallbacks',async()=>{
    networkMode='online';await dispatch('https://rizo.world/',{mode:'navigate'});networkMode='offline';
    for(const path of ['unknown/deep/','unknown/index.html','ads.txt','missing-policy.html']){
      const r=await dispatch('https://rizo.world/'+path,{mode:'navigate'});
      assert.equal(r.status,503,path);assert(!(await r.text()).includes('NETWORK_GAME'),path);
    }
    const r=await dispatch('https://rizo.world/?cold=1',{mode:'navigate'});assert.equal(r.status,200);assert((await r.text()).includes('NETWORK_WORLD'));
    const game=await dispatch('https://rizo.world/play?source=pwa',{mode:'navigate'});assert.equal(game.status,200);assert((await game.text()).includes('NETWORK_GAME'));
  });
  await test('legacy and trailing Play aliases redirect once, preserving the PWA query',async()=>{
    networkMode='offline';
    for(const path of ['/index.html','/index','/game','/play.html','/play/']){
      const r=await dispatch('https://rizo.world'+path+'?source=pwa',{mode:'navigate'});
      assert.equal(r.status,301);assert.equal(r.headers.get('Location'),'https://rizo.world/play?source=pwa');
    }
    for(const path of ['/world','/world.html','/world/']){
      const r=await dispatch('https://rizo.world'+path,{mode:'navigate'});assert.equal(r.status,301);assert.equal(r.headers.get('Location'),'https://rizo.world/');
    }
  });
  await test('an old cached game cannot masquerade as a missing new World shell',async()=>{
    const url='https://rizo.world/',current=store.get(url);store.delete(url);oldStore.set(url,new Response('OLD_ROOT_GAME'));
    const r=await dispatch(url,{mode:'navigate'});assert.equal(r.status,503);assert(!(await r.text()).includes('OLD_ROOT_GAME'));
    store.set(url,current);oldStore.clear();
  });
  await test('a missing required World or Play shell blocks takeover',async()=>{
    const original=cache.addAll;cache.addAll=async()=>{throw Error('missing required shell')};const before=skipWaitingCalls;
    let install;listeners.install({waitUntil(p){install=p}});await assert.rejects(install,/missing required shell/);assert.equal(skipWaitingCalls,before);cache.addAll=original;
  });
  await test('same-origin worker does not intercept or cache a third-party ad request',async()=>{
    assert.equal(await dispatch('https://pagead2.googlesyndication.com/never-requested-test'),null);
  });
  console.log(`\n${passed}/10 service-worker policy checks passed`);
  if(process.exitCode)process.exit(process.exitCode);
})().catch(e=>{console.error(e);process.exit(1)});
