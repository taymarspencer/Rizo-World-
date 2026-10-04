const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const listeners={};
const store=new Map();
let networkMode='online';
const keyOf=req=>typeof req==='string'?new URL(req,'https://play.rizo.store/').href:req.url;
const cache={
  async put(req,res){store.set(keyOf(req),res.clone())},
  async match(req){const r=store.get(keyOf(req));return r?r.clone():undefined},
  async add(){}, async addAll(){}
};
const caches={
  async open(){return cache},
  async match(req){return cache.match(req)},
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
    if(url.endsWith('index.html')||url.endsWith('/')) return make('<!doctype html>NETWORK_HTML',{status:200,headers:{'Content-Type':'text/html'}});
    return make('NETWORK_ASSET',{status:200});
  },
  self:{
    location:new URL('https://play.rizo.store/sw.js'),
    addEventListener(type,fn){listeners[type]=fn},
    clients:{claim:async()=>true}, skipWaiting:async()=>true
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
    const url='https://play.rizo.store/game-v79-defense.js';
    store.set(url,new Response('STALE_CACHE_RUNTIME_EXECUTED',{status:200}));networkMode='online';
    const r=await dispatch(url);assert.equal(await r.text(),'NETWORK_RUNTIME');
    assert.equal(await (await cache.match(url)).text(),'NETWORK_RUNTIME');
  });
  await test('runtime JS falls back to repaired cache offline',async()=>{
    const url='https://play.rizo.store/game-v79-defense.js';networkMode='offline';
    const r=await dispatch(url);assert.equal(await r.text(),'NETWORK_RUNTIME');
  });
  await test('navigation is network-first and cache-backed offline',async()=>{
    const url='https://play.rizo.store/index.html';networkMode='online';
    let r=await dispatch(url,{mode:'navigate'});assert((await r.text()).includes('NETWORK_HTML'));
    networkMode='offline';r=await dispatch(url,{mode:'navigate'});assert((await r.text()).includes('NETWORK_HTML'));
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
    networkMode='online';const url='https://play.rizo.store/unknown/deep/';
    const r=await dispatch(url,{mode:'navigate'});assert.equal(r.status,404);assert.equal(await r.text(),'MISSING_PAGE');assert(!store.has(url));
  });
  await test('only the actual root/index can use a game fallback offline',async()=>{
    networkMode='offline';
    for(const path of ['unknown/deep/','unknown/index.html','ads.txt','missing-policy.html']){
      const r=await dispatch('https://play.rizo.store/'+path,{mode:'navigate'});
      assert.equal(r.status,503,path);assert(!(await r.text()).includes('NETWORK_HTML'),path);
    }
    const r=await dispatch('https://play.rizo.store/',{mode:'navigate'});assert.equal(r.status,200);assert((await r.text()).includes('NETWORK_HTML'));
  });
  await test('same-origin worker does not intercept or cache a third-party ad request',async()=>{
    assert.equal(await dispatch('https://pagead2.googlesyndication.com/never-requested-test'),null);
  });
  console.log(`\n${passed}/7 service-worker policy checks passed`);
  if(process.exitCode)process.exit(process.exitCode);
})().catch(e=>{console.error(e);process.exit(1)});
