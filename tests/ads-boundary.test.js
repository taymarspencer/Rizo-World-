/* Contract tests use injected callbacks only. They never fetch Google or load ads. */
const assert=require('node:assert/strict');
const {createBridge}=require('../core/rizo-ads.js');
const {createProvider}=require('../providers/google-h5.js');
let passed=0,total=0;
async function test(name,fn){total++;try{await fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}}
const input=(id='run:1')=>({opportunityId:id,naturalBreak:true,userInitiated:true,confirm:offer=>offer.show()});
function fixture(extra={}){
 let time=1000000,allow=true,safe=true,timeout,events=[];
 const bridge=createBridge({enabled:()=>true,canRequestAds:()=>allow,contextSafe:()=>safe,
 placements:{reward:{enabled:true,format:'rewarded'},between:{enabled:true,format:'interstitial',type:'next'}},
 now:()=>time,schedule:fn=>(timeout=fn,1),cancelTimer:()=>{},
 onStart:detail=>events.push(['start',detail]),onEnd:detail=>events.push(['end',detail]),...extra});
 return {bridge,events,advance:n=>time+=n,privacy:v=>allow=v,safety:v=>safe=v,timeout:()=>timeout()};
}
function google(fx){let config,sound;fx.bridge.setProvider(createProvider({adBreak:v=>config=v,adConfig:v=>sound=v}));return{get config(){return config},get sound(){return sound}}}
(async()=>{
await test('provider attachment cannot enable a shipped or unknown placement',async()=>{
 const b=createBridge();b.setProvider({request:()=>{throw Error('must not run')}});assert.equal(await b.showRewarded('reward',input()),false);assert.equal(b.status().enabled,false);
 const f=fixture();f.bridge.setProvider({request:()=>{throw Error('must not run')}});assert.equal(await f.bridge.showRewarded('unreviewed',input()),false);
});
await test('unresolved/revoked privacy and active gameplay reject before provider calls',async()=>{
 const f=fixture();let calls=0;f.bridge.setProvider({request:()=>{calls++;return {rewardEarned:true}}});
 f.privacy(false);assert.equal(await f.bridge.showRewarded('reward',input()),false);f.privacy(true);f.safety(false);assert.equal(await f.bridge.showRewarded('reward',input()),false);assert.equal(calls,0);
});
await test('reward opt-in, a truthful offer callback, natural break and opportunity ID are mandatory',async()=>{
 const f=fixture();let calls=0;f.bridge.setProvider({request:()=>{calls++;return {rewardEarned:true}}});
 for(const args of [{...input(),userInitiated:false},{...input(),confirm:null},{...input(),naturalBreak:false},{...input(),opportunityId:''}])assert.equal(await f.bridge.showRewarded('reward',args),false);
 assert.equal(calls,0);
});
await test('single in-flight request and opportunity dedupe prevent double reward delivery',async()=>{
 const f=fixture();let settle,calls=0;f.bridge.setProvider({request:()=>{calls++;return new Promise(r=>settle=r)}});
 const first=f.bridge.showRewarded('reward',input());assert.equal(await f.bridge.showRewarded('reward',input('run:2')),false);
 settle({rewardEarned:true});assert.equal(await first,true);f.advance(31000);assert.equal(await f.bridge.showRewarded('reward',input()),false);assert.equal(calls,1);
});
await test('no inventory, provider exceptions and rejected promises fail without reward or holds',async()=>{
 for(const request of [()=>({status:'noAdPreloaded'}),()=>{throw Error('offline')},()=>Promise.reject(Error('blocked'))]){
  const f=fixture();f.bridge.setProvider({request});assert.equal(await f.bridge.showRewarded('reward',input()),false);assert.equal(f.bridge.status().busy,false);assert.deepEqual(f.events,[]);
 }
});
await test('Google beforeReward never auto-shows; a player may refuse with no reward',async()=>{
 const f=fixture(),g=google(f);let offered,shown=0;
 const result=f.bridge.showRewarded('reward',{...input(),confirm:o=>offered=o});g.config.beforeReward(()=>shown++);
 assert.equal(shown,0);assert(offered);offered.cancel();assert.equal(await result,false);assert.equal(shown,0);assert.deepEqual(f.events,[]);
});
await test('privacy changes between offer and Watch prevent showing the ad',async()=>{
 const f=fixture(),g=google(f);let offered,shown=0;const result=f.bridge.showRewarded('reward',{...input(),confirm:o=>offered=o});
 g.config.beforeReward(()=>shown++);f.privacy(false);assert.equal(offered.show(),false);assert.equal(await result,false);assert.equal(shown,0);
});
await test('Google completion grants once and only after adViewed and the terminal callback',async()=>{
 const f=fixture(),g=google(f);let shown=0,resolved=false;
 const result=f.bridge.showRewarded('reward',input()).then(v=>(resolved=true,v));g.config.beforeReward(()=>shown++);assert.equal(shown,1);
 g.config.beforeAd();g.config.beforeAd();g.config.adViewed();g.config.adViewed();await Promise.resolve();assert.equal(resolved,false);
 g.config.afterAd();g.config.afterAd();g.config.adBreakDone({breakStatus:'viewed'});assert.equal(await result,true);
 assert.deepEqual(f.events.map(e=>e[0]),['start','end']);assert.deepEqual(g.sound,{sound:'off'});
});
await test('dismissal, shown-only and a viewed status string alone never earn a reward',async()=>{
 for(const scenario of ['dismissed','shown','status']){
  const f=fixture(),g=google(f);const result=f.bridge.showRewarded('reward',input());
  if(scenario!=='status'){g.config.beforeReward(()=>{});g.config.beforeAd();if(scenario==='dismissed')g.config.adDismissed();g.config.afterAd();}
  g.config.adBreakDone({breakStatus:'viewed'});assert.equal(await result,false);
 }
});
await test('stalled requests settle, release a started hold, quarantine the provider and reject late rewards',async()=>{
 const f=fixture();let hooks,settle;f.bridge.setProvider({request:(_,h)=>(hooks=h,new Promise(r=>settle=r))});
 const result=f.bridge.showRewarded('reward',input());hooks.start();f.timeout();assert.equal(await result,false);
 assert.equal(f.bridge.status().ready,false);assert.equal(f.events[1][1].requiresResume,true);settle({rewardEarned:true});hooks.end();await Promise.resolve();assert.equal(f.events.length,2);
});
await test('late SDK display after an initial timeout still receives a balanced pause and requires Resume',async()=>{
 const f=fixture();let hooks;f.bridge.setProvider({request:(_,h)=>(hooks=h,new Promise(()=>{}))});const result=f.bridge.showRewarded('reward',input());
 f.timeout();assert.equal(await result,false);hooks.start();hooks.end();assert.deepEqual(f.events.map(e=>e[0]),['start','end']);assert.equal(f.events[1][1].requiresResume,true);assert.equal(hooks.canShow(),false);
});
await test('interstitial cooldown, attempt cooldown, and per-session cap remain conservative',async()=>{
 const f=fixture();let calls=0;f.bridge.setProvider({request:(_,h)=>{calls++;h.start();h.end();return {shown:true}}});
 assert.equal(await f.bridge.showInterstitial('between',input()),true);f.advance(31000);assert.equal(await f.bridge.showInterstitial('between',input('run:2')),false);
 f.advance(180000);assert.equal(await f.bridge.showInterstitial('between',input('run:3')),true);
 assert.equal(await f.bridge.showInterstitial('between',input('run:4')),false);f.advance(180000);assert.equal(await f.bridge.showInterstitial('between',input('run:5')),true);f.advance(180000);assert.equal(await f.bridge.showInterstitial('between',input('run:6')),false);assert.equal(calls,3);
});
await test('an interstitial cannot impersonate a reward or a preroll placement',async()=>{
 for(const type of ['reward','preroll','start','made-up']){
  const f=fixture({placements:{between:{enabled:true,format:'interstitial',type}}});let calls=0;
  f.bridge.setProvider({request:()=>{calls++;return {shown:true}}});
  assert.equal(f.bridge.available('between'),false);assert.equal(await f.bridge.showInterstitial('between',input()),false);assert.equal(calls,0);
 }
});
await test('a provider error after beginning cannot silently restart play',async()=>{
 const f=fixture();f.bridge.setProvider({request:(_,h)=>{h.start();return Promise.reject(Error('SDK failed'))}});
 assert.equal(await f.bridge.showRewarded('reward',input()),false);assert.equal(f.events[1][1].requiresResume,true);assert.deepEqual(f.events.map(e=>e[0]),['start','end']);
});
console.log('\n'+passed+'/'+total+' advertising boundary checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
