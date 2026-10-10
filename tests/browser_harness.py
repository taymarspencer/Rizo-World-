from pathlib import Path
import re, base64, mimetypes
ROOT = Path(__file__).resolve().parents[1]

# Every stylesheet index.html actually loads gets inlined, in document order. Keep
# this as a named constant: it replaced a hard-coded filename list that silently
# stopped covering each new specialist layer, and a bare inline pattern here is a
# magnet for merge damage when several branches add a stylesheet link at once.
STYLESHEET_LINK_RE = r'<link href="\./([A-Za-z0-9_./-]+\.css)" rel="stylesheet"'
SCRIPT_SRC_RE = r'<script src="\./([A-Za-z0-9_./-]+\.js)"></script>'

def _embed_asset_refs(text):
    cache={}
    pattern=re.compile(r"\./assets/[A-Za-z0-9_./-]+\.(?:png|webp|svg|jpg|jpeg|gif)",re.I)
    def replace(match):
        ref=match.group(0)
        if ref in cache:return cache[ref]
        path=ROOT/ref[2:]
        if not path.exists():return ref
        mime=mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        payload=base64.b64encode(path.read_bytes()).decode("ascii")
        cache[ref]=f"data:{mime};base64,{payload}"
        return cache[ref]
    return pattern.sub(replace,text)

def _rebase_css_urls(text, sheet):
    # A stylesheet in a mode folder writes url('../../../assets/x.svg'); once it
    # is inlined into the page those refs must be relative to the page instead.
    def replace(match):
        quote, ref = match.group(1), match.group(2)
        if ref.startswith(('data:', 'http:', 'https:', '#', '/')): return match.group(0)
        target = (sheet.parent/ref).resolve()
        try: rebased = './' + target.relative_to(ROOT.resolve()).as_posix()
        except ValueError: return match.group(0)
        return f'url({quote}{rebased}{quote})'
    return re.sub(r"url\((['\"]?)([^'\")]+)\1\)", replace, text)

def build_inline_app(qa=False, embed_assets=False):
    html=(ROOT/'index.html').read_text()
    # Derive the stylesheet list from index.html instead of hard-coding it.
    # A hard-coded list silently stopped exercising every new specialist layer
    # (Worker I flagged exactly this blind spot); reading the real document keeps
    # browser regression coverage honest as stylesheets are added or reordered.
    local_css = {}
    for name in re.findall(STYLESHEET_LINK_RE, html):
        path=ROOT/name
        if path.exists():
            text=_rebase_css_urls(path.read_text(), path)
            local_css[name]=_embed_asset_refs(text) if embed_assets else text
    if embed_assets:
        html=_embed_asset_refs(html)
    for name, text in local_css.items():
        pattern=rf'<link href="\./{re.escape(name)}" rel="stylesheet"\s*/?>'
        html=re.sub(pattern,lambda m,text=text:'<style>'+text+'</style>',html)
    html=re.sub(r'<link href="\./manifest\.webmanifest" rel="manifest"\s*/?>','',html)
    storage='''<script>const __testStore={};const __testStorage={getItem:k=>Object.prototype.hasOwnProperty.call(__testStore,k)?__testStore[k]:null,setItem:(k,v)=>{__testStore[k]=String(v)},removeItem:k=>{delete __testStore[k]},clear:()=>{for(const k of Object.keys(__testStore))delete __testStore[k]},key:i=>Object.keys(__testStore)[i]||null,get length(){return Object.keys(__testStore).length}};</script>'''
    html=html.replace('</head>',storage+'</head>')
    # Like stylesheets, scripts come from index.html itself so a new runtime file
    # (core/, modes/, training/) is exercised by every browser suite automatically.
    for name in re.findall(SCRIPT_SRC_RE, html):
        js=(ROOT/name).read_text().replace('localStorage','__testStorage')
        if embed_assets:
            js=_embed_asset_refs(js)
        if name=='game-v79-defense.js' and qa:
            js=js.replace('const IS_QA_BUILD=location.hostname==="localhost"||location.hostname==="127.0.0.1"||new URLSearchParams(location.search).get("qa")==="1";','const IS_QA_BUILD=true;')
        html=html.replace(f'<script src="./{name}"></script>', '<script>'+js.replace('</script>','<\\/script>')+'</script>')
    return html

SETUP_STATE = '''(()=>{const s=RizoRuntimeQA.defaultState();s.pet.stage="kid";s.pet.variant="classic";s.pet.hiddenVariant="classic";s.pet.energy=100;s.pet.hunger=100;s.pet.mood=100;s.pet.health=100;s.pet.resting=false;s.pet.sleeping=false;s.player.tutorialDismissed=true;s.player.defenseSchool={dismissed:true,completed:["route","placement","targeting","intel","doctrine","abilities"],replay:false};s.collection.classic=1;RizoRuntimeQA.loadForQA(s);return true})()'''

def start_defense(page, map_id='grove'):
    page.evaluate(SETUP_STATE)
    page.evaluate(f'RizoRuntimeQA.startMiniGame("defense",{{mapId:"{map_id}"}})')
    page.wait_for_timeout(180)
    page.evaluate('document.querySelector("[data-defense-skip-map-intro]")?.click()')
    page.wait_for_timeout(80)
    return page.evaluate('RizoRuntimeQA.defenseSnapshotForQA()')
