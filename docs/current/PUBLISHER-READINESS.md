# Publisher readiness — Rizo World

Research checked against Google's official pages on 2026-10-03/04; foundation document dated 2026-10-04. Starting remote: `7a64fe6763d81da017458d64d8956abb33e41d48`, branch `claude/rizo-codebase-audit-yuqlns`. Recheck the sources and account-specific instructions before applying or enabling ads.

**Status: public-product foundations implemented; advertising disabled; no application or production ad deployment performed. Approval is not guaranteed.** Domain purchase alone does not establish hosting, a reviewed AdSense site or H5 access. The inherited publisher client is unverified for this property.

This is a readiness record, not legal advice or a certificate of policy compliance. Required below means a published Google condition for the relevant activity; it does not mean every advertising condition applies to the present ad-free build. Strong practice means useful engineering/product work without an invented Google quota. Owner decisions stay explicit.

## Required or conditionally required

| Requirement | Primary source | Repository position / remaining action |
|---|---|---|
| Original, useful content; control of submitted HTML; an eligible adult account applicant | [AdSense eligibility](https://support.google.com/adsense/answer/9724?hl=en) | Original pet, ten games, Defense and a complete Dungeon episode exist. Static public explanation now accompanies them. Owner must confirm account eligibility, rights and actual domain control. |
| Policy-compliant content and behavior; usable navigation; no misleading ad presentation | [AdSense program policies](https://support.google.com/adsense/answer/48182?hl=en), [Google Publisher Policies](https://support.google.com/publisherpolicies/answer/10502938?hl=en) | Clear World/Play/Guide navigation; no active inventory. Review actual future ad-bearing screens, rights and audience treatment before serving. |
| A live, reachable site Google can crawl; valid SSL if HTTPS is used | [Site isn't ready](https://support.google.com/adsense/answer/12176698?hl=en) | Robots permits crawling and static pages require no login/JS. DNS, TLS, firewall/crawler access, redirects and production status codes are not verified by a local build. |
| Connect/verify the property using a supported account-issued method | [Connect your site](https://support.google.com/adsense/answer/7584263?hl=en) | Unverified static publisher metadata removed. Insertion points documented; owner supplies exact verified tag, code or seller file. Do not enable gameplay ads merely to verify ownership. |
| Approved AdSense account and separately granted H5 product access | [H5 signup](https://support.google.com/adsense/answer/1705831?hl=en), [API signup](https://developers.google.com/ad-placement/docs/signup) | Not established. H5 serving gates default closed. Ordinary AdSense access does not authorize full-screen game ads. |
| H5 ads through the legitimate API, placed in appropriate breaks | [H5 best practices](https://support.google.com/adsense/answer/9959170?hl=en), [API overview](https://developers.google.com/ad-placement/apis) | Provider adapter exists; no adopted placement. Active modes and training currently deny requests. Protected narrative/care moments stay ad-free. |
| Avoid accidental clicks, deception and ads confused with game/navigation controls | [Ad placement policies](https://support.google.com/adsense/answer/1346295?hl=en), [game-play pages](https://support.google.com/adsense/answer/2768340?hl=en) | All old display units stay hidden and `mountBanner` refuses. No overlay over touch controls or fake Play/download button. Any future content units need separate layout review. |
| No own-ad clicking, artificial impressions, automated live-ad tests or incentivized ordinary ad clicks | [Invalid traffic](https://support.google.com/adsense/answer/16737?hl=en) | Automated tests use local mocks and block external requests. Honest traffic acquisition only; owner must monitor real account/traffic when serving begins. |
| Clear rewarded offer, affirmative choice, a usable decline path and delivery on earned completion | [Rewarded-ad policies](https://support.google.com/adsense/answer/9121589?hl=en) | Google adapter never auto-shows from inventory and requires `adViewed`. Actual reward UI, value and durable delivery are unimplemented; adopt and test before activation. |
| Privacy notice describing actual collection, use, sharing and ad-related technologies when present | [Publisher Policies: privacy](https://support.google.com/publisherpolicies/answer/10502938?hl=en) | Current notice describes local saves, no active ads/analytics and separate external sites. Operator, host logs/retention and future provider disclosures need owner confirmation. |
| Applicable consent, records, withdrawal and recipient identification for Google's covered European regions | [EU User Consent Policy](https://www.google.com/about/company/user-consent-policy/) | Unknown permission denies ads. No cookie banner or regional decision is fabricated. Real integration and actual provider signals remain blocked. |
| Google-certified TCF CMP for personalized ads in EEA/UK/Switzerland | [Current CMP requirement](https://support.google.com/adsense/answer/13554116?hl=en) | Adapter seam only. Current source permits some non-certified non-personalized/limited traffic where supported; do not mistake that for blanket permission to bypass required consent. |
| Appropriate US opt-out / restricted-processing treatment where applicable | [US states guidance](https://support.google.com/adsense/answer/14182916?hl=en), [RDP signals](https://support.google.com/adsense/answer/9560818?hl=en) | No US policy or signals invented. Review GPC, relevant state scope, CMP behavior and account/tag settings; a nominal boolean alone is insufficient. |
| Correct child-directed treatment and no prohibited targeting/data handling | [Publisher Policies](https://support.google.com/publisherpolicies/answer/10502938?hl=en) | Existing 13+ recommendation retained and clarified as a recommendation. It is not a legal audience classification or substitute for actual review/tagging. |
| If ads.txt is used, it must authorize the actual seller correctly | [Publisher Policies](https://support.google.com/publisherpolicies/answer/10502938?hl=en), [ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en) | No production seller file exists. Comment-only template is excluded from packaging. Exact verified account records must be copied to root `/ads.txt` before using it. |

### Audience and narrative review

Google's [Publisher Restrictions](https://support.google.com/publisherpolicies/answer/10437795?hl=en) concern reduced eligible inventory and can produce no fill; they are distinct from prohibited publisher content. [Shocking-content guidance](https://support.google.com/publisherpolicies/answer/10437538?hl=en) includes prominent/significant profanity and a specific gameplay-imagery exception with exclusions such as torture and violence against minors. Do not infer that every non-graphic fantasy fight is prohibited, or that a cute character automatically makes a game suitable for child-directed advertising.

Rizo's death/fire identity and Dungeon's abduction, fear, absence and proposed confinement require context-sensitive audience review. This pass preserves the accepted art and story and gives Dungeon no inventory. Future confinement is unadopted narrative development, not a current monetized screen. No plot or language has been rewritten to chase approval. The owner must decide audience presentation and review actual ad-bearing content against then-current policies rather than labeling it family content by default.

## Strong practice / likely beneficial

| Practice | Implemented foundation | Practical limit |
|---|---|---|
| A real public product around the game | World, real Journal, About, Keeper Guide and honest physical-brand links | No fixed page count guarantees adequate value; keep publishing actual work only. See [site readiness](https://support.google.com/adsense/answer/7299563?hl=en&ref_topic=1319756). |
| Crawler-accessible explanation | Static HTML, descriptive headings, normal links, no auth wall | The game itself still needs JS/canvas; production reachability must be checked. |
| Titles, descriptions, canonical/share metadata, real sitemap | All published pages use rizo.world; robots names an existing sitemap | DNS/redirect/canonical behavior must match the eventual host. Metadata is not approval. |
| Responsive and accessible public navigation | Phone layout, skip links, focus, selectable/scrolled copy, readable contrast, reduced motion, 44px primary navigation | Timed visual games are not fully screen-reader playable. No complete WCAG certification is claimed. |
| Honest errors and resilient updates | Real 404 document, local preview status, public/offline routes, atomic required game shell | Host must serve 404 as 404, not a 200 catch-all. `_headers` syntax is host-specific. |
| No display ads beside play | Current inventory stays absent; explicit API boundary for a future opportunity | Google's 150px game guidance is a recommendation, not a magical universal safety/legal threshold. |
| ads.txt when account data exists | Correct documented root insertion and build rejection of obvious placeholders | Google says ads.txt is not mandatory, but strongly recommends it. Never ship guessed seller data. |
| Meaningful performance measurement | Static public pages, no external fonts/tracking, fixed image space; packaging excludes developer material | Test on deployed hosting and weaker real phones before asserting performance. |
| Consent-aware analytics architecture | Disabled config and documented data minimization | No SDK, chosen provider, retention policy or telemetry endpoint is implemented. |
| Testing the failure path | Local SDK callbacks, no fill/denial/timeouts/deduplication, save and mode regression tests | Google test mode does not validate production account configuration. |

Google's [Web Vitals guidance](https://web.dev/articles/vitals) uses LCP at most 2.5s, INP at most 200ms and CLS at most 0.1 for a good experience, assessed at the 75th percentile with mobile/desktop segmentation. These are engineering targets, not an invented H5 acceptance score. Local Chromium results cannot establish field percentiles or low-end phone performance.

Remaining performance risks: the game loads its large established hub plus specialist mode scripts/styles at entry. A constrained uncompressed local sample transferred 2.6MB and observed an 8.1s game LCP / 14.2s DOMContentLoaded, versus 524ms public World LCP. This is a real remaining cold-load concern, not a field percentile. Confirm negotiated Brotli/gzip on the chosen production host and retest; full render paths, canvas, layered Den effects and service-worker precaching also need real-device profiling. Avoid a speculative bundle rewrite in this pass. A future measured lazy-mode load needs contract/boot/update testing and must not introduce mixed runtime versions. Public pages do not load the game runtime.

## Not actually required / folklore rejected

- The cited general eligibility/readiness documents do not prescribe twenty articles, a particular word count, a universal traffic quota or an arbitrary publishing streak. H5 partner eligibility and account-specific instructions may differ; do not invent a public numeric threshold or promise access.
- A game property does not need unrelated SEO articles to disguise that it is a game. Original gameplay, actual art, useful explanation and help are the content.
- No fake traffic, purchased clicks, review-bait content, automatically repeated ad opportunities or self-clicking.
- A universal six-month domain wait is not established by the cited general requirements. Follow any actual account/country-specific criterion presented during application.
- Terms, About, Contact, a sitemap, analytics and perfect Lighthouse scores are not all separately mandated page/checklist items in those eligibility pages. Some support real usability, accountability or applicable legal obligations; build them for that purpose.
- ads.txt is strongly recommended, not an excuse to invent a publisher ID before an account exists.
- “150px away” does not cure an accidental-click design. This project keeps display inventory outside active play entirely.
- “Non-personalized” does not mean consent and privacy obligations vanish. “13+” does not decide COPPA or Google's child-directed treatment. A hand-built banner is not a certified CMP.
- A separate Shopify property does not have to be technically fused with World to establish brand authorship. A real apparel link is commerce, not a Google placement.

## Engineering delivered

- Added a static public World and real Journal; strengthened About, Guide, Privacy and Terms using actual project facts and working existing contact route.
- Added shared design and public-product documents; accepted Dungeon art and all story documentation remain unchanged. The ten narrative owner choices stay open.
- Removed unverified publisher metadata and the unavailable rewarded-care prompt. Added a provider-independent boundary, Google callback adapter and privacy-deny bootstrap with no active placements.
- Isolated modal backgrounds and keyboard focus, enlarged public/control-adjacent links, and bounded the Dungeon device's host grid row on rotation without editing the mode's art, runtime or control styles.
- Added metadata, sitemap, domain-correct robots, useful 404, deployment header insertion points, fresh-output static packaging and a real-status local preview. PWA identity and save schema remain unchanged; release stamps advance together.
- Added local contract and phone-width HTTP checks. Validation evidence is recorded below; no live ad or automatic review submission occurred.

## Deployment procedure and account insertion points

1. Build into an empty directory: `python3 tools/build-site.py --out dist`. The command refuses to delete existing output. For another build, choose a fresh external path or deliberately clean only your previous generated artifact.
2. Preview: `python3 tools/serve-site.py --directory dist --port 8000`. Open World, game, published help/policy pages, a deep missing URL and `/ads.txt`. The latter is intentionally 404 until real records exist.
3. On the chosen host, serve HTML/JS/CSS with revalidation and correct MIME types. Apply the equivalent of `_headers`: no sniffing, strict-origin referrer, disabled unnecessary camera/mic/geolocation, limited `object-src`/`base-uri` CSP. This is not a comprehensive CSP; do not claim inline code or future SDK origins were fully audited under one.
4. Configure DNS and TLS for rizo.world, a deliberate www/HTTP redirect policy, status-preserving 404 and no blanket application fallback for `/ads.txt` or missing assets. Verify that `/robots.txt`, `/sitemap.xml`, public content and game assets are live without an owner session or firewall challenge. Do not add HSTS before the domain/subdomain policy is understood.
5. Verify domain/site ownership using the exact method supplied by the account. A static tag belongs in the actual submitted root HTML's head (and any host-mapped root document as appropriate), not a JS-only token. Keep serving disabled. Record verified ownership before setting `publisherVerified`.
6. If using ads.txt, copy the exact account-authorized seller snippet into root `ads.txt`; verify plain-text HTTPS 200 and redirects/crawler access. [Google's crawl guidance](https://support.google.com/adsense/answer/7679060?hl=en) applies. The template itself is never deployed.
7. Make the source and deployed release stamps agree and check SW update/offline behavior. Keep the old origin available for user-controlled export/import; domain purchase does not migrate saves.

## Remaining gates by milestone

| Milestone | Remaining blockers / owner actions |
|---|---|
| Public beta | World root, game `/play`, apex rizo.world and Cloudflare Pages direction are resolved in RC2. Remaining: preview and later DNS/TLS/redirect/status/header verification; confirm operator, host logs/retention, support responsibility and Terms/Privacy wording; review rights/audience; user-controlled old-origin migration; physical Safari/Android/PWA and constrained-device performance checks. |
| AdSense application | Public beta gates; eligible owner account and verified control; live substantial original property and crawlability; current content/privacy review; exact verification method. No traffic or article quota invented. Serving configuration, consent and placements must be settled before any live ads. |
| H5 application / integration | Approved AdSense account, separate H5 application/access subject to Google's eligibility, current HTML5 implementation and policy review. Access not inferred from existing legacy ID. |
| Live H5 serving | Real CMP/region/audience/provider-signal integration; deliberately adopted placement and reward design; durable reward delivery; official mock-mode manual integration checks; staging/mobile/SDK failure checks; verified account/seller data; invalid-traffic operations; separately reviewed switch to production. |

Resolved launch direction: World `/`, game `/play`, Cloudflare Pages preview/hosting, and keeping legacy live **v87** at `play.rizo.store` untouched for exports. Owner choices still required: operator/contact/log retention; actual audience classification and geographic availability; future personalized/non-personalized/limited-ad policy and CMP; whether ads belong in the product at all, and which placement/reward first; future analytics purpose/provider; confirmed typography/asset licenses across Store/World. These do not resolve Dungeon's ten story decisions. Advertising remains disabled; no application/submission is authorized by RC2.

## Validation record

See [PUBLIC-FOUNDATION-VERIFICATION.md](../verification/PUBLIC-FOUNDATION-VERIFICATION.md) for executed commands, results, artifact/browser scope and remaining physical-device limitations. Application, live DNS/TLS, live Google configuration, complete assistive-technology playability and field Core Web Vitals have not been tested or claimed.
