# World-first verification — RC2

2026-10-04 UTC. Starting remote `develop` was fetched and independently read through GitHub at **`77c3582017e41921a9495fb4afb26eee8801e497`**, exactly the reviewed RC1. It had not advanced; no newer work was discarded. RC2 build marker: **`v92-release-candidate-2`**. The exact resulting commit and its own hosted CI outcomes belong to draft [PR #7](https://github.com/taymarspencer/Rizo-World-/pull/7), not an older green branch run.

## One product change

The build copies source `world.html` to output `index.html` and original game source `index.html` to `play.html`. Cloudflare Pages serves **World `/` and game `/play`**, with eight explicit permanent redirects for old game/World aliases. All existing game assets stay at root; no base tag, JS entry redirect, runtime relocation, bundler or Worker/Function was added. Public pages keep their design/content, with navigation and canonical/share URLs aligned to Pages' clean HTML paths. PLAY is explicit; Apparel stays separate and optional.

Manifest identity/root scope remain `./`; installed apps deliberately start at `/play?source=pwa`. A fresh World-only visit loads no game runtime and registers no worker. The new worker requires both shells plus the existing boot files before takeover, reads only its own cache, preserves query/alias navigation offline and returns 503 for unknown offline pages. Real online missing paths return the authored HTTP 404. See [deployment preparation](../current/DEPLOYMENT-PREPARATION.md) for exact routes and preview-only commands.

## Executed local checks

Node 24.19.0; Python 3.12.14; Playwright 1.51.0; headless Chromium 134.0.6998.35 on Linux. Browser dependencies and Wrangler 4.147.0 are development-only, outside the repository. No live ad or legacy-site test requests were made.

| Suite / command | Final result |
| --- | --- |
| All eleven `node tests/*.test.js` suites | **192/192** |
| `tests/browser-dungeon.py --directory <artifact>` | **154/154** |
| `tests/save-safety.py` | **37/37** |
| `tests/browser-defense-integration.py` | **78/78** |
| `tests/mode-contract.py` | **25/25** |
| `tests/training-contract.py` | **22/22** |
| `tests/browser-launch-recovery.py` | **5/5** |
| `tests/browser-v88-training-fixes.py` | **13/13** |
| `tests/browser-v88-authored.py` | **25/25** |
| `tests/browser-v87-arcade-freeze.py` | **66/66** |
| `tests/browser-public-product.py --directory <artifact> --evidence <captures>` | **150/150** |
| New `tests/browser-world-first.py --directory <artifact>` | **77/77** |
| Supplemental Wrangler Pages local HTTP assertions | **26/26** |
| Build/asset/canonical/link validation; source syntax; whitespace; CI YAML | **Pass** |

**192 Node + 652 browser = 844/844 release checks; zero failures.** All previous 187 Node and 575 browser checks remain represented. Added: two public/package/header contracts, three worker-policy cases and 77 routing/upgrade browser checks. The supplemental 26 Wrangler HTTP assertions are separate from the 844 release checks.

World/public/game browser checks use 320, 375, 390 and 430 CSS-pixel phone emulation. They cover overflow, tap targets, keyboard skip/focus/PLAY, real route entry/refresh, signed pet persistence, no fresh-World runtime/worker, no unexpected third-party requests, actual game/mode behavior and known/unknown offline responses. Native World captures at 320/390px were visually inspected. These are not physical iPhone/Android or full WCAG claims.

The upgrade test reconstructs **the exact RC1** via `git archive`, reproduces its 160-file fingerprint, installs its real worker/game, writes a signed pet, and changes the same HTTP origin to RC2. A deliberately missing required `/play` rejects takeover and retains RC1. Complete RC2 claims the page, retires the old cache, opens World at `/`, preserves the pet at the PWA/game entry, and works offline after the server is actually shut down. Old index/query/trailing aliases converge; public queries receive their own cached page; unknown routes remain 503.

The first new browser run was 75/77: its cache poll treated a Promise as immediately ready, and its About-heading comparison omitted a real line break. Those harness errors were corrected without relaxing the intended assertions; the final full run passes 77/77. Initial Chromium installation and Wrangler interface-enumeration problems were environment setup failures, not product results.

Wrangler accepted eight redirect and 22 header rules and served both real shells, aliases, canonical public pages, deep 404 and revalidation/security headers. Its first run exposed overlapping inherited Content-Type rules on index/worker responses. Redundant definitions were removed and a Node contract now rejects overlapping MIME values. `/play.html` has an explicit 301 instead of relying on native HTML normalization's 308. The local emulator returns 502 for reserved `_headers`/`_redirects` requests while keeping their contents inaccessible; actual preview behavior still needs verification. A local-only Node preload worked around unavailable interface enumeration; no such workaround ships.

## Artifact and preservation

**161 files; fingerprint `bed8104a16b4bc75f5e1a5fb0e237214b144bf11406abb4a26702fa69f0ca16d`.** Method: sorted relative-path → file SHA-256 map, Python `json.dumps(map, sort_keys=True)`, then SHA-256. Output World/game bytes match their respective authored sources. Source World aliases do not ship as a second page. No developer docs/tests/reports/tools, ad template or production ads.txt ships; public artwork credits remain intentional. Sitemap: `/`, `/play`, `/journal`, `/about`, `/support`, `/privacy`, `/terms`, all on apex `https://rizo.world`.

From RC1, `core/`, `providers/`, `training/`, all `modes/`, artwork, public CSS, install manager, monetization/config and Dungeon story authority are byte-identical. Hub changes are only the release marker, public links and latest-build probe route. Save format/signatures/keys, mode state, identity, receipts, progression and balance remain intact. Incidental Defense reports generated by tests were restored to their prior bytes.

The owner-provided independent RC1 review already tested actual live **v87 at play.rizo.store**, real-v87 save → v92 same-origin upgrade and export → different-origin import. RC2 preserves that implementation and reruns save safety plus its own signed-save routing/worker checks; it does not claim a new live-v87 review. No automatic cross-origin migration exists. GitHub `main` remains the separate older v86 candidate.

## Performance and remaining gates

The affected profile tool ran against `/` and `/play` with the same 390×844, 4× CPU, 150-ms latency, 200,000-byte/s download, worker-blocked, cold-cache/uncompressed local profile. One sample each, not field CWV/INP: **World LCP 484ms, CLS 0, DCL 194ms; game LCP 8,128ms, DCL 14,112ms, 2,604,010 resource bytes, healthy final boot**. Neither had page errors or external requests. World remains fast; the known game cold-start warning remains non-blocking. The independently observed “NEEDS A CLEAN RELOAD” around 6.8s before eventual recovery in v87/RC1 is unchanged and left for future work.

Next: exact-SHA successful CI → Cloudflare preview → physical Safari/Android layout, installation/resume/update/offline/save testing and compressed-host checks → release approval. Operator/support/privacy/asset-rights confirmation remains operational work. Advertising/analytics stay disabled. This pass does not modify `main`, merge PR #7, deploy, change DNS/domains, alter the legacy site, rewrite history or touch narrative/gameplay decisions. Stop after this routing candidate.
