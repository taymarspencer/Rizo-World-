"""Validate and package the actual static property. No bundler or runtime rewrite.
Run: python3 tools/build-site.py --out dist
Tests/docs/reports/templates never ship as website assets.
"""
from pathlib import Path
import argparse, json, re, shutil
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
loaded = set(re.findall(r'(?:src|href)="\./([^"?#]+\.(?:js|css))"', index))
loaded.update(re.findall(r'"\./([^"?#]+)"', sw.split('const NETWORK_FIRST_PATHS')[0]))
pages = {'index.html','world.html','journal.html','about.html','support.html','privacy.html','terms.html','404.html'}
files = loaded | pages | {'sw.js','robots.txt','sitemap.xml','manifest.webmanifest','_headers','ASSET-CREDITS.md'}
files.discard('')
if (ROOT/'ads.txt').exists():
    ads = (ROOT/'ads.txt').read_text()
    records = [line for line in ads.splitlines() if line.strip() and not line.lstrip().startswith('#')]
    if not records or any('REPLACE' in line or 'pub-0000000000000000' in line for line in records):
        raise SystemExit('Refusing an empty or placeholder ads.txt. Copy verified account data before publishing.')
    files.add('ads.txt')
for name in sorted(files):
    if not (ROOT/name).is_file(): raise SystemExit('Missing production asset: ' + name)
for name in sorted(pages):
    text = (ROOT/name).read_text()
    if '<html lang="en"' not in text or 'name="description"' not in text or 'rel="canonical"' not in text:
        raise SystemExit('Missing public metadata: ' + name)
    if 'google-adsense-account' in text and 'publisherVerified: false' in (ROOT/'rizo-config.js').read_text():
        raise SystemExit('Unverified publisher metadata in ' + name)
    for ref in re.findall(r'(?:src|href)="([^"#?]+)',text):
        if ref.startswith(('https:', 'http:', 'data:', 'mailto:')): continue
        local = ref.removeprefix('./').removeprefix('/')
        if local and not (ROOT/local).is_file(): raise SystemExit('Broken local link in ' + name + ': ' + ref)
out.mkdir(parents=True, exist_ok=True)
for name in sorted(files):
    dest = out/name; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(ROOT/name,dest)
for folder in ['assets','core','providers','training','modes']:
    shutil.copytree(ROOT/folder,out/folder,dirs_exist_ok=True)
print(json.dumps({'output':str(out),'files':sum(p.is_file() for p in out.rglob('*')),'build':'v92-public-foundation','ads_txt':(out/'ads.txt').exists()},indent=2))
