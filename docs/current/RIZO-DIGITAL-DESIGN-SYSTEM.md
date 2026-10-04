# Rizo digital design system — Store / World relationship

Foundation: 2026-10-04. Applies to future collaboration between the Rizo World repository and Rizo Apparel's Shopify work. Implemented examples live in `public-world.css`, `world.html` and the existing game. This is a portable direction document; it does not change Shopify or override Dungeon's accepted visual constitution.

**Store: Rizo exists in our world. World: you enter Rizo's.** The same authored face should be recognizable before either address is explained. Consistency comes from decisions, materials and behavior; these properties do not need identical layouts, palettes, templates or runtimes.

## Shared identity and different evidence

| Principle | Store expression | World expression | Boundary |
|---|---|---|---|
| Real first, professional second | Garments, people, Pittsburgh, actual photos and lived history | A companion with needs; repaired objects, places and small playable memories | Never fabricate evidence of either kind |
| Rizo face / flame | Brand mark on physical objects and photography | Brand mark at the doorway; an actual named creature during play | A static logo is not a replacement pet renderer |
| Premium restraint | A few deliberate product images and clear commerce | Quiet entry, readable text, room to notice the creature | No generic streetwear slogans or SaaS feature wall |
| Deliberate asymmetry | Art direction, placement, human composition | A slightly skewed image, imperfect repair, an offset mark | Navigation, touch targets and reading order stay predictable |
| Material | Fabric, print, label, tape, wear | Paper, ink, stitches, clasps, service signs and continued repairs | Wear has local meaning; no global grunge filter |
| Warmth | Real people and gatherings | Care, fire, a saved place, ordinary life | No constant sentimental copy |
| Accountability | Published origin includes making and learning | Honest current features, local-save limits and a real changelog | Do not advertise the full proposed campaign as built |

The current physical story is linked at [rizo.store/pages/about](https://rizo.store/pages/about). The live store was reviewed during this pass; its source theme, exact font licenses and internal tokens were not transferred. Do not invent a claim that both sites now use the same font files or design-token package.

## Typography

Shared system has two roles: an assured, compact main voice and a small utilitarian voice for labels, instructions, dates and wayfinding. Public World currently uses the operating system sans stack with a system monospace stack. This keeps the entry fast, readable and independent of third-party font requests. Actual game specialist styles retain their established type choices and scale.

Future shared typefaces are an owner/art-direction decision after identifying the Store's licensed source assets. Keep font licensing, self-hosting and fallback metrics explicit. A shared face should not make body text tiny or turn every sentence into tracked uppercase. Main body copy is 16px on the public pages, with a generous line height and a maximum readable measure. Micro-labels are supplementary, never the only explanation of a control or data consequence.

## Rhythm and palette

Public World implements ink `#151513`, paper `#eee8dc`, muted text `#b9b5ac`, a quiet boundary `#48463f`, warm accent `#ecd292` and a reserved cool accent `#8dbac5`. These are public-page tokens, not new colors for Dungeon. Dark paper is a doorway to the game; Store can remain grounded in its photographic/product setting.

Use a broad margin, a strong short heading and a smaller line of evidence. Break rhythm where the content earns it: the creature can occupy an imperfect pocket of space; a physical-world link can sit beside an ordinary footer. Do not make every block a floating rounded card. Mobile reading collapses to one column in source order. Text, focus outlines and controls must survive enlarged text, forced colors and reduced motion.

Frame screenshots as records of a place. A modest angle is optional decoration and disappears under reduced motion. Keep the scene intact; do not recolor it into the public-site palette or smooth away the artist's ink language. Existing Dungeon bands, stable seeded wobble, stepped light, repaired silhouettes and scale rules remain authoritative.

## Face and flame usage

- Use the actual project marks and creature assets. Preserve the two eyes, mouth/stitch language, silhouette and the distinction between a mark and a living Rizo.
- Brand chrome may use a quiet static mark; the hero can show a single larger creature. Avoid a repetitive wall of mascot stickers.
- In a game, the active pet's form, name and clothing come from the canonical pet renderer. Marketing must not silently substitute a stock protagonist for it.
- The favicon/app-icon family retains the existing flame assets and current PWA identity. A later cross-site icon family should share the face, not make a storefront and installed companion indistinguishable in a tab list.
- A face without visible text needs an accessible name if it is an action. Decorative repeated marks have empty alt text. Screenshot alt text explains the actual place or game state, rather than praising the art.

## Interaction and motion

The shared rule is: an action feels intentional and the consequence is legible. Navigation says where it goes. A button presses; a door opens; a repaired thing holds. Neither address should trap the user in an atmospheric transition.

Focus is visible. Main navigation and action targets have at least 44px touch height; important game controls retain their proven geometry. The website scrolls and permits text selection. A full-screen mode can lock scroll and selection for its own lifetime, then must release both. A modal makes its background inert, keeps keyboard navigation inside the active surface and returns focus to the initiating control.

Motion should explain a state change or let Rizo behave. Do not import the entire handheld entrance into every web page load. Public pages have no animation dependency. Honor both the system preference and the game's existing setting; removing decorative motion must never remove content or a useful state cue. No forced cross-domain animation, delay, unskippable logo, sound or fake loading progress.

## Copy and naming

Public navigation is World, Journal, Guide and Play. Inside the game retain useful existing names: Den, House, Arcade, Journal, Defense, Dungeon. The public development journal and the personal Keeper Journal have different jobs; context should make that clear.

Rizo can be dry, absurd and occasionally rude. Instructions about saves, privacy, money, consent and rewards must be literal. Keep a funny sentence and a practical sentence distinct. Avoid motivational speeches, artificial scarcity, generic brand manifestos and invented community scale.

Example voice: “Rizo checked.” can belong on a wrong door. The links beneath it must still say “Back to World” and “Go to your Rizo.” A guide can explain care without turning every warning into a threat from the pet.

## Loading, failures and transitions

Public pages are static; their text arrives with the HTML. Image dimensions reserve space. Game loading uses its existing inline boot guard and real recovery actions. A failed script yields a readable error with retry, Guide and World routes; it does not ask the user to install an app or watch an advertisement to continue.

The installed game can use cached content. An unknown URL must retain a real 404 online and an unavailable response offline, rather than impersonating a successful game page. A failed optional screenshot cannot block an atomic game update.

## Crossing between addresses

Implemented World wording identifies “Apparel / rizo.store ↗” as real commerce. It opens a separate site with `rel="noopener"`. Existing profile/shop links remain labeled as physical apparel. The user can stay in the game; no purchase overlay appears during movement, a boss, rest, homecoming or a care problem.

Recommended future Store counterpart: an ordinary “Enter Rizo's world ↗” link, using the same face at the boundary. Its destination should be the owner-adopted World entry. An optional change in framing from photographed object to living flame may make the crossing memorable, but it must finish immediately under reduced motion and never pretend two origins share a save or checkout.

**Proposal only:** a real garment could eventually have a small discoverable digital history, or a familiar digital item could point to its physical counterpart. First decide licensing, availability, price disclosure, account/save integrity and whether the discovery is worth having without a purchase. No commerce/progression coupling, redeemed ad reward, shared Shopify account or automatic ownership claim is implemented here.

## What a second repository should consume

Share this document, approved source marks, confirmed type licenses and examples of actual successful interactions. Adopt portable role names and principles only after the relevant art owner reviews them. Each repository keeps its own host, deployment, consent, commerce/game contracts and accessibility checks. A shared brand is not permission to copy the whole game stylesheet into Shopify or move checkout into the pet simulation.
