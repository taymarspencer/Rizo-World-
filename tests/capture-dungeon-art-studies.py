"""Supplemental, unlit design studies. Full phone evidence stays in the game.

Paints the real art functions at the 320px game's 284/320 scale, plus the
real dialogue SVGs at 46px and 56px. Large portraits are explicitly labelled
as construction studies, never used to claim mobile readability.
"""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=ROOT)
parser.add_argument('--evidence', type=Path, required=True)
args = parser.parse_args()
args.evidence.mkdir(parents=True, exist_ok=True)
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 960, 'height': 900}, device_scale_factor=2)
    page.set_content('''<style>
    *{box-sizing:border-box}body{margin:0;padding:20px;background:#131412;color:#e3d8bf;font:13px system-ui}
    h1{font-size:18px;margin:0 0 8px}h2{font-size:14px;margin:20px 0 12px;color:#bfb190}
    p{margin:0 0 14px;color:#9fadb5}.row{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}
    .face{display:flex;gap:8px;align-items:flex-end}.frame{text-align:center;width:200px;padding:8px;background:#22251f}
    svg{display:block;background:#0b0e14;border:1px solid #8f8167}small{display:block;margin-top:5px;color:#9fadb5;font-size:11px}
    .figure{text-align:center}canvas{display:block}</style><main></main>''')
    page.add_script_tag(path=str(args.source / 'modes/dungeon/dungeon-art.js'))
    page.evaluate('''()=>{
      const A=RizoDungeonArt, main=document.querySelector('main');
      main.innerHTML='<h1>Portrait construction · actual 46 / 56px, then 128px study</h1>';
      for(const who of ['nell','orr','you','hood-tall','hood-small','hood-cap','driver','latch']) {
        const heading=document.createElement('h2');heading.textContent=who.toUpperCase();main.append(heading);
        const row=document.createElement('div');row.className='row';main.append(row);
        for(const [expr, art] of Object.entries(A.PORTRAITS[who])) {
          const card=document.createElement('div');card.className='frame';row.append(card);
          const face=document.createElement('div');face.className='face';card.append(face);
          for(const size of [46,56]) {const wrap=document.createElement('div');wrap.innerHTML=art;
            const svg=wrap.querySelector('svg');svg.style.width=size+'px';svg.style.height=size+'px';face.append(wrap);}
          const study=document.createElement('div');study.innerHTML=art;study.style.margin='12px auto 0';study.style.width='128px';
          const svg=study.querySelector('svg');svg.style.width='128px';svg.style.height='128px';card.append(study);
          const name=document.createElement('small');name.textContent=expr;card.append(name);
        }
      }
    }''')
    page.screenshot(path=str(args.evidence / 'portrait-study.png'), full_page=True, scale='css')
    page.evaluate('''()=>{
      const A=RizoDungeonArt,main=document.querySelector('main');
      const cast=[['NELL','nell',{}],['ORR','orr',{state:'serving'}],['TALL','hood',{kind:'hood-tall'}],
        ['SMALL','hood',{kind:'hood-small'}],['CAP','hood',{kind:'hood-cap'}],['DRIVER','seated',{who:'driver'}],
        ['YOU','keeper',{}],['LATCH','latch',{}],['MARSHAL','collector',{profile:'marshal'}],
        ['GATHERER','collector',{profile:'gatherer'}],['RUNNER','collector',{profile:'runner',state:'run'}],
        ['SENTRY','collector',{profile:'sentry'}]];
      main.innerHTML='<h1>World construction · unchanged 320px phone scale (284/320)</h1><p>Neutral light, original actor coordinates. Silhouettes below. Supporting study only.</p>';
      for(const silhouette of [false,true]) {
        const row=document.createElement('div');row.className='row';row.style.gap='0';main.append(row);
        for(const [name,fn,o] of cast) {
          const card=document.createElement('div');card.className='figure';row.append(card);
          const canvas=document.createElement('canvas');canvas.width=150;canvas.height=240;
          canvas.style.width='75px';canvas.style.height='120px';card.append(canvas);
          const c=canvas.getContext('2d');c.scale(2*284/320,2*284/320);
          if(fn==='hood')A.hood(c,o.kind,40,132,o);
          else if(fn==='seated')A.seated(c,'driver-seat',40,132,o);
          else A[fn](c,40,132,o);
          if(silhouette){c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-in';c.fillStyle='#e3d8bf';c.fillRect(0,0,150,240);}
          const label=document.createElement('small');label.textContent=name;card.append(label);
        }
      }
    }''')
    page.screenshot(path=str(args.evidence / 'silhouette-study.png'), full_page=True, scale='css')
    browser.close()
