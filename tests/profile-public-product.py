"""A reproducible local lab sample, not field CWV or a Lighthouse score.
Run against the packaged site. All external requests are blocked; no live ads.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
import argparse, functools, threading, json, sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from static_site import StaticSiteHandler

parser=argparse.ArgumentParser()
parser.add_argument('--directory',default='dist')
args=parser.parse_args()
directory=Path(args.directory).resolve()
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(StaticSiteHandler,directory=str(directory)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin='http://127.0.0.1:'+str(server.server_address[1])
observer='''window.__lab={lcp:0,cls:0,longTasks:[]};
new PerformanceObserver(list=>{for(const e of list.getEntries())__lab.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)__lab.cls+=e.value}).observe({type:'layout-shift',buffered:true});
new PerformanceObserver(list=>{for(const e of list.getEntries())__lab.longTasks.push(e.duration)}).observe({type:'longtask',buffered:true});'''
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for name in ['/','/play']:
        external=[];errors=[]
        ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,service_workers='block')
        def route(r):
            if r.request.url.startswith(origin+'/'): r.continue_()
            else: external.append(r.request.url);r.abort()
        ctx.route('**/*',route);ctx.add_init_script(observer)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        cdp=ctx.new_cdp_session(page)
        cdp.send('Network.enable')
        cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':200000,'uploadThroughput':93750,'connectionType':'cellular3g'})
        cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        page.goto(origin+name,wait_until='load',timeout=60000);page.wait_for_timeout(1500)
        sample=page.evaluate('''()=>{const n=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource');return {lcpMs:Math.round(__lab.lcp),cls:__lab.cls,dclMs:Math.round(n.domContentLoadedEventEnd),loadMs:Math.round(n.loadEventEnd),longTasks:__lab.longTasks.length,maxLongTaskMs:Math.round(Math.max(0,...__lab.longTasks)),resourceCount:resources.length,resourceTransferBytes:resources.reduce((sum,r)=>sum+r.transferSize,0),gameReady:window.RizoBoot?.status().ready??null}}''')
        sample.update({'page':name,'viewport':'390x844','cpuSlowdown':4,'latencyMs':150,'downloadBytesPerSecond':200000,'errors':errors,'externalRequests':external})
        assert not errors and not external,sample
        if name=='/play':assert sample['gameReady'],sample
        results.append(sample);ctx.close()
    browser.close()
server.shutdown();server.server_close()
print(json.dumps({'scope':'One local cold-cache lab sample per page; uncompressed local HTTP; not field percentiles or INP','samples':results},indent=2))
