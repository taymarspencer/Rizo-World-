# Rizo World — public product foundation

Date: 2026-10-04. Starting branch: `claude/rizo-codebase-audit-yuqlns`, remote `7a64fe6763d81da017458d64d8956abb33e41d48`. Implementation build: `v92-public-foundation`.

Routing update in RC2 (`v92-release-candidate-2`): the owner resolved World as root and the game as `/play`, with Cloudflare Pages as the intended preview/hosting direction. The foundation/design below remains intact.

Rizo World is the public home of an original digital companion and the places that companion can enter. It must be worth visiting with advertising disabled. A player raises one Rizo; care, training, House residents and adventures belong to that continuing life. The public website makes that product understandable and gives people a way to find help, understand its authorship, and decide whether to play.

This document records implemented foundations and explicitly identifies later owner decisions. It does not adopt Dungeon story proposals. Read [ARCHITECTURE.md](../../ARCHITECTURE.md) for game contracts, [the story README](../dungeon/story/README.md) for narrative authority, and [PUBLISHER-READINESS.md](PUBLISHER-READINESS.md) for current Google sources and launch gates.

## What is actually available

| Surface | Current behavior | Public promise |
|---|---|---|
| Den / pet | Local simulation, feeding, washing, sleep, needs, growth, variants, clothing, memories and recovery | Your Rizo continues living while you are away. Keep a backup. |
| House | Opens at Level 4; rooms and residents grow around the active companion | Make room for other Rizos. Resident and active identities remain separate. |
| Arcade / training | Ten short games through `RizoTraining`; the hub converts performance into pet growth | Small runs have a consequence for the pet you bring. |
| Defense | Registered mode with its own rules, canvas, UI, checkpoints and records | Bring your actual Rizo and House crew; place, plan, fight, bank or resume. |
| Dungeon | Authored opening and The Threshold: six BELOW rooms, Latch, Night Porter, First Knot and return to the real Den | A complete short episode is playable. The much longer proposed campaign is not. |
| Progression | Hub is sole save writer; signed v2 envelope, protected mode slices and idempotent receipts | No account or cloud synchronization. Saves belong to this browser origin. |

The hub runtime retains its historical filename. A large filename or old version in CSS is not evidence that a mode should be rebuilt. The established contracts and accepted art are the foundation.

## Information architecture implemented here

| URL | Job | Content source |
|---|---|---|
| `/` | World: explain the invitation, the actual experiences, and the physical brand connection | Current game behavior, actual Den/Hearth captures, original Defense environment plate |
| `/play` | Existing playable entry | Current origin sequence and pet-centered game |
| `/journal` | A small real development journal | Accepted art checkpoint, runtime contracts, this foundation pass; no invented activity |
| `/about` | Rizo's origin and why the two addresses exist | Owner's published [Rizo Apparel story](https://rizo.store/pages/about), linked and attributed |
| `/support` | Keeper Guide, controls, backups, recovery, accessibility limits and contact | Actual runtime and save behavior |
| `/privacy` | Explain local data and the present absence of advertising/analytics | Actual deployed code; hosting details still need owner confirmation |
| `/terms` | Plain language description of access, virtual items and local-save limits | Current product; owner review still required |
| A missing URL | A useful wrong door, served from `404.html` with HTTP 404 | Authored navigation back to World, Play and Guide |

World, Journal and Guide share a compact navigation; About, Contact, Privacy, Terms, Accessibility and Apparel remain in the footer. Games do not each get an empty SEO route. Contact is a Guide section linking to the existing [Rizo Apparel contact form](https://rizo.store/pages/contact-us), clearly identified as another website. A dedicated World inbox/form is an owner decision, not an invented address.

Public content is semantic static HTML and works without JavaScript. Game first arrival, the normal header, Journal settings, boot recovery and the no-script view all give a route back to the public property. The playable experience remains direct: no forced promotional intro, install gate, account signup or advertisement.

### Root-address decision resolved: World first

RC2 packages authored `world.html` as root `index.html`, and the existing game source `index.html` as `play.html`. Cloudflare Pages serves the game at canonical `/play`; old game/World aliases redirect deliberately. No runtime relocation, client-side redirect, new promotional gate or full game load is needed to render World.

Manifest identity and root scope remain stable; installed PWAs intentionally start at `/play?source=pwa`. A fresh World visit does not register the game worker. Save keys/schema remain unchanged. The worker separates World and Play fallbacks and tests the genuine RC1 upgrade. See [deployment preparation](DEPLOYMENT-PREPARATION.md) for the full route and origin contract. `rizo.store` stays separate: no purchase requirement or shared checkout/account system.

## Public content rules

- Explain a real experience or solve a real user problem. The actual game is substantial original content; supplemental text must have its own use.
- Journal entries follow accepted work. Do not generate a posting schedule, fake history, traffic, testimonials, screenshots of nonexistent features, or a quota of articles.
- Screenshots show this build. Keep its authored palette, ink, scale, repaired material and ordinary evidence. Public image cropping may frame a room; it must not fabricate a different game.
- Keep future Dungeon development visibly future. Do not publish proposal scenes as playable features or expose private owner decisions as marketing hooks.
- Copy is dry and short. Help and data disclosures use literal language. A joke cannot carry the instruction for deleting a save or agreeing to an ad.
- Public media uses the project's existing artwork; attribution travels with it. No new photography, external font license, collaborator endorsement or legal entity is assumed.

## Store and World

`rizo.store` is Rizo in the physical world: apparel, photography, Pittsburgh, people, events and commerce. `rizo.world` lets a person enter Rizo's digital life. See [RIZO-DIGITAL-DESIGN-SYSTEM.md](RIZO-DIGITAL-DESIGN-SYSTEM.md) for portable principles rather than shared Shopify code.

The current World page says where real apparel can be found and opens the separate store. Existing game profile links already describe real clothes and use a clearly labeled `SHOP ↗` action. These are first-party commercial links, not Google inventory or earned-game rewards. They never sit over movement buttons, disguise a price as virtual currency, or gate care and progression. Buying apparel currently grants no pet advantage; digital objects cannot currently redeem physical goods.

## Technical and privacy foundations

The public CSS is independent of the mode styles. There are no remote fonts or new trackers. Public pages have their own titles, descriptions, canonical URLs and share metadata; a real sitemap includes published routes only. Robots allows crawling. Host review must confirm the configured URLs actually resolve on the purchased domain.

The game still uses the existing simulation and save schema. This pass adds modal background isolation, keyboard containment, accessible World exits, a separate public style layer and the advertising boundary described in [MONETIZATION-ARCHITECTURE.md](MONETIZATION-ARCHITECTURE.md). Runtime, page and service-worker release stamps change together. No Dungeon or Defense module or narrative file is modified.

`tools/build-site.py` validates metadata and local links, then copies the actual static site into a fresh output directory. It does not bundle, transpile or rewrite gameplay. Developer docs, tests, reports and ad templates do not ship. `tools/serve-site.py` previews that artifact with a real 404 response. Existing direct static hosting remains possible, but packaging makes accidental publication of developer material less likely.

The privacy notice describes local saves and optional export/import. A future analytics provider needs a declared purpose, retention, consent/opt-out treatment and data minimization before activation. Keeper IDs, pet names, save codes, complete URLs with user-supplied codes, and raw saves must not be sent to an ad or analytics provider. In-memory ad diagnostics are not an analytics system.

### Origin migration is a real launch task

`play.rizo.store` and `rizo.world` cannot automatically read each other's localStorage, Cache Storage or installed-PWA data. Keeping the save schema compatible does not move those bytes between origins. Keep the old origin available long enough to export a Keeper save. On the new origin use the existing import flow, verify pet identity, House, mode progress and backup, and tell the player where the save now lives. Do not erase the old origin's data or automatically overwrite a different new-origin pet.

## Release and owner gates

Before public beta: confirm hosting, DNS/TLS, canonical domain, real status codes, old-origin migration, support ownership, operator/privacy details and rights to shipped assets. Verify on physical iOS Safari and Android Chrome, including standalone resume, browser chrome, keyboard, notch/safe areas and low-memory behavior. The Chromium checks in this pass are useful evidence, not a claim of physical-device coverage or complete screen-reader accessibility.

Before monetization: account/site/H5 approval, verified publisher metadata, reviewed audience treatment, real consent integration, a deliberately adopted placement and reward design, and production-host verification. Nothing in this pass requires applying now.

The ten Dungeon owner decisions remain open in v0.2. This product work neither picks a kidnapping motive nor authors Nell's betrayal, adopts relocation, or decides post-ending visits.
