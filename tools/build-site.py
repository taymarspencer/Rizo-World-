"""Validate and package the actual static property. No bundler or runtime rewrite.
Run: python3 tools/build-site.py --out dist
Tests/docs/reports/templates never ship as website assets.
"""
from pathlib import Path
import argparse, hashlib, json, re, shutil
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--out', default='dist')
args = parser.parse_args()
out = Path(args.out).resolve()
if out == ROOT or out in ROOT.parents or ROOT in out.parents and out != ROOT/'dist':
    parser.error('Use dist or a separate output directory, never a source directory.')
if out.exists() and any(out.iterdir()):
    parser.error('Output must be empty; choose a fresh directory. This command never deletes existing work.')
index = (ROOT/'index.html').read_text()
sw = (ROOT/'sw.js').read_text()
# Source index.html remains the game so its runtime/contracts stay in place.
# Only the deployment names change: World -> index.html, game -> play.html.
pages = {'index.html':'world.html', 'play.html':'index.html', **{name+'.html':name+'.html' for name in ['journal','about','support','privacy','terms','404']}}
def packaged_name(ref):
    name = urlsplit(ref).path.removeprefix('./').removeprefix('/')
    if not name: return 'index.html'
    if name in {'play','journal','about','support','privacy','terms','404'}: return name+'.html'
    return name

def source(name):
    return ROOT / pages.get(name, name)

loaded = {packaged_name(ref) for ref in re.findall(r'(?:src|href)="\./([^"?#]+\.(?:js|css))"', index)}
loaded.update(packaged_name(ref) for ref in re.findall(r'"\./([^"?#]*)"', sw.split('const NETWORK_FIRST_PATHS')[0]))
files = loaded | set(pages) | {'sw.js','robots.txt','sitemap.xml','manifest.webmanifest','_headers','_redirects','ASSET-CREDITS.md'}
if (ROOT/'ads.txt').exists():
    ads = (ROOT/'ads.txt').read_text()
    records = [line for line in ads.splitlines() if line.strip() and not line.lstrip().startswith('#')]
    if not records or any('REPLACE' in line or 'pub-0000000000000000' in line for line in records):
        raise SystemExit('Refusing an empty or placeholder ads.txt. Copy verified account data before publishing.')
    files.add('ads.txt')
for name in sorted(files):
    if not source(name).is_file(): raise SystemExit('Missing production asset: ' + name)
for name in sorted(pages):
    text = source(name).read_text()
    if '<html lang="en"' not in text or 'name="description"' not in text or 'rel="canonical"' not in text:
        raise SystemExit('Missing public metadata: ' + name)
    if 'google-adsense-account' in text and 'publisherVerified: false' in (ROOT/'rizo-config.js').read_text():
        raise SystemExit('Unverified publisher metadata in ' + name)
    canonical = 'https://rizo.world/' + ('' if name == 'index.html' else name.removesuffix('.html'))
    if canonical not in text or not re.search(r'(?:rel="canonical"[^>]*href="'+re.escape(canonical)+r'"|href="'+re.escape(canonical)+r'"[^>]*rel="canonical")', text):
        raise SystemExit('Wrong canonical for packaged page: ' + name)
    for ref in re.findall(r'(?:src|href)="([^"#?]+)',text):
        if ref.startswith(('https:', 'http:', 'data:', 'mailto:')): continue
        local = packaged_name(ref)
        if not source(local).is_file(): raise SystemExit('Broken local link in ' + name + ': ' + ref)
out.mkdir(parents=True, exist_ok=True)
for name in sorted(files):
    dest = out/name; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(source(name),dest)
for folder in ['assets','core','providers','training','modes']:
    shutil.copytree(ROOT/folder,out/folder,dirs_exist_ok=True)
fingerprints = {str(p.relative_to(out)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file()}
print(json.dumps({'output':str(out),'files':len(fingerprints),'build':'v94-alive','ads_txt':(out/'ads.txt').exists(),'fingerprint':hashlib.sha256(json.dumps(fingerprints,sort_keys=True).encode()).hexdigest()},indent=2))
