/* World-first public shell and direct Play. Third-party requests are never cached. */
const CACHE_PREFIX = "rizo-game-";
const CACHE = "rizo-game-v95-dungeon-depth";
const SHELL = [
  "./", "./play", "./public-world.css", "./launch-v79-defense-alive.css", "./modes/defense/styles/rtd-defense-integration.css", "./modes/defense/styles/worker-b-economy.css", "./modes/defense/styles/worker-e-abilities-depth.css", "./modes/defense/styles/worker-h-ui.css", "./modes/defense/styles/v81-art.css", "./modes/defense/styles/rtd-worker-i-feel.css", "./arcade-v75.css", "./arcade-v83.css", "./arcade-v84-depth.css", "./rizo-v85-handmade.css", "./arcade-v87-system.css", "./modes/defense/styles/worker-d-towers.css", "./modes/defense/defense-core.js", "./modes/defense/defense-canvas.js", "./modes/defense/defense-mode.js", "./modes/dungeon/dungeon-art.js", "./modes/dungeon/dungeon-content.js", "./modes/dungeon/dungeon-core.js", "./modes/dungeon/dungeon-input.js", "./modes/dungeon/dungeon-scenery.js", "./modes/dungeon/dungeon-view.js", "./modes/dungeon/dungeon-mode.js", "./modes/dungeon/styles/dungeon.css", "./rizo-config.js", "./install-manager.js",
  "./core/rizo-ads.js", "./providers/google-h5.js", "./public-game.css", "./monetization.js", "./core/rizo-save-core.js", "./core/rizo-training.js", "./core/rizo-home.js", "./home-world.css", "./home-alive.css", "./core/rizo-modes.js", "./core/rizo-catalog.js", "./training/kit.js", "./training/power.js", "./training/spark.js", "./training/forage.js", "./training/rush.js", "./training/walk.js", "./training/rhythm.js", "./training/memory.js", "./training/glide.js", "./training/breaker.js", "./training/maze.js", "./game-v79-defense.js", "./manifest.webmanifest", "./about",
  "./privacy", "./terms", "./support", "./journal", "./404", "./public-world.css", "./assets/public/den.png", "./assets/public/threshold.png", "./assets/icon-192.png",
  "./assets/defense-pine-bend.svg", "./assets/defense-ember-switchback.svg", "./assets/defense-moon-loop.svg", "./assets/defense-storm-circuit.svg", "./assets/defense-whiteout-pass.svg", "./assets/defense-eclipse-ridge.svg", "./assets/icon-512.png", "./assets/rizo-full-mark.png", "./assets/rizo-classic.png",
  "./assets/rizo-ember.png", "./assets/rizo-toxic.png", "./assets/rizo-violet.png",
  "./assets/rizo-bubblegum.png", "./assets/rizo-frost.png", "./assets/rizo-glitch.png",
  "./assets/rizo-obsidian.png", "./assets/rizo-golden.png", "./assets/rizo-diamond.png",
  "./assets/rizo-moss.png", "./assets/rizo-aurora.png", "./assets/rizo-retro.png",
  "./assets/rizo-shadow.png", "./ASSET-CREDITS.md",
  "./assets/wearables/antenna-back.svg", "./assets/wearables/antenna-front.svg",
  "./assets/wearables/backpack-back.svg", "./assets/wearables/backpack-body.svg", "./assets/wearables/backpack-front.svg",
  "./assets/wearables/bandana-back.svg", "./assets/wearables/bandana-body.svg", "./assets/wearables/bandana-front.svg",
  "./assets/wearables/beanie-body.svg", "./assets/wearables/beanie-front.svg", "./assets/wearables/bow-front.svg",
  "./assets/wearables/bucket-body.svg", "./assets/wearables/bucket-front.svg", "./assets/wearables/cap-body.svg",
  "./assets/wearables/cap-front.svg", "./assets/wearables/cape-back.svg", "./assets/wearables/cape-front.svg",
  "./assets/wearables/chain-front.svg", "./assets/wearables/crown-front.svg", "./assets/wearables/earmuffs-body.svg",
  "./assets/wearables/earmuffs-front.svg", "./assets/wearables/eyepatch-back.svg", "./assets/wearables/eyepatch-front.svg",
  "./assets/wearables/flower-back.svg", "./assets/wearables/flower-front.svg", "./assets/wearables/goggles-back.svg",
  "./assets/wearables/goggles-front.svg", "./assets/wearables/halo-back.svg", "./assets/wearables/headphones-body.svg",
  "./assets/wearables/headphones-front.svg", "./assets/wearables/horns-back.svg", "./assets/wearables/horns-front.svg",
  "./assets/wearables/leafcrown-back.svg", "./assets/wearables/leafcrown-front.svg", "./assets/wearables/mask-back.svg",
  "./assets/wearables/mask-front.svg", "./assets/wearables/scarf-back.svg", "./assets/wearables/scarf-body.svg",
  "./assets/wearables/scarf-front.svg", "./assets/wearables/shades-back.svg", "./assets/wearables/shades-front.svg",
  "./assets/wearables/starclip-back.svg", "./assets/wearables/starclip-front.svg",
  "./assets/wearables/thumb-antenna.png", "./assets/wearables/thumb-backpack.png", "./assets/wearables/thumb-bandana.png",
  "./assets/wearables/thumb-beanie.png", "./assets/wearables/thumb-bow.png", "./assets/wearables/thumb-bucket.png",
  "./assets/wearables/thumb-cap.png", "./assets/wearables/thumb-cape.png", "./assets/wearables/thumb-chain.png",
  "./assets/wearables/thumb-crown.png", "./assets/wearables/thumb-earmuffs.png", "./assets/wearables/thumb-eyepatch.png",
  "./assets/wearables/thumb-flower.png", "./assets/wearables/thumb-goggles.png", "./assets/wearables/thumb-halo.png",
  "./assets/wearables/thumb-headphones.png", "./assets/wearables/thumb-horns.png", "./assets/wearables/thumb-leafcrown.png",
  "./assets/wearables/thumb-mask.png", "./assets/wearables/thumb-scarf.png", "./assets/wearables/thumb-shades.png",
  "./assets/wearables/thumb-starclip.png", "./assets/wearables/thumb-visor.png", "./assets/wearables/thumb-wings.png",
  "./assets/wearables/visor-back.svg", "./assets/wearables/visor-front.svg", "./assets/wearables/wings-back.svg",
  "./assets/wearables/first-knot-back.svg", "./assets/wearables/first-knot-body.svg", "./assets/wearables/first-knot-front.svg", "./assets/wearables/thumb-first-knot.svg"
];
const REQUIRED_SHELL = [
  "./", "./play", "./public-world.css", "./launch-v79-defense-alive.css", "./modes/defense/styles/rtd-defense-integration.css", "./modes/defense/styles/worker-b-economy.css", "./modes/defense/styles/worker-h-ui.css", "./modes/defense/styles/v81-art.css", "./arcade-v75.css", "./arcade-v83.css", "./arcade-v84-depth.css", "./rizo-v85-handmade.css", "./arcade-v87-system.css", "./modes/defense/styles/worker-d-towers.css", "./modes/defense/styles/worker-e-abilities-depth.css", "./modes/defense/styles/rtd-worker-i-feel.css",
  "./core/rizo-save-core.js", "./core/rizo-training.js", "./core/rizo-home.js", "./home-world.css", "./home-alive.css", "./core/rizo-modes.js", "./core/rizo-catalog.js", "./training/kit.js", "./training/power.js", "./training/spark.js", "./training/forage.js", "./training/rush.js", "./training/walk.js", "./training/rhythm.js", "./training/memory.js", "./training/glide.js", "./training/breaker.js", "./training/maze.js", "./modes/defense/defense-core.js", "./modes/defense/defense-canvas.js", "./modes/defense/defense-mode.js", "./modes/dungeon/dungeon-art.js", "./modes/dungeon/dungeon-content.js", "./modes/dungeon/dungeon-core.js", "./modes/dungeon/dungeon-input.js", "./modes/dungeon/dungeon-scenery.js", "./modes/dungeon/dungeon-view.js", "./modes/dungeon/dungeon-mode.js", "./modes/dungeon/styles/dungeon.css", "./rizo-config.js", "./install-manager.js", "./core/rizo-ads.js", "./providers/google-h5.js", "./public-game.css", "./monetization.js",
  "./game-v79-defense.js", "./manifest.webmanifest", "./assets/icon-192.png",
  "./assets/defense-pine-bend.svg", "./assets/icon-512.png", "./assets/rizo-classic.png"
];
const NETWORK_FIRST_PATHS = new Set([...REQUIRED_SHELL, "./journal", "./about", "./privacy", "./terms", "./support", "./404", "./public-world.css"].map(path => new URL(path, self.location.href).pathname));

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Core boot files are atomic: if one is missing, this worker must not replace
    // the known-good worker. Optional art is best-effort so one cosmetic asset
    // can never block an application update.
    await cache.addAll(REQUIRED_SHELL);
    const required = new Set(REQUIRED_SHELL);
    await Promise.allSettled(SHELL.filter(path => !required.has(path)).map(path => cache.add(path)));
    // Once the complete required shell exists, converge immediately. iOS standalone
    // sessions can keep an old worker alive for a surprisingly long time otherwise.
    await self.skipWaiting();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function cacheIfUsable(request, response) {
  if (response && response.ok && (response.type === "basic" || response.type === "cors")) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

// Only this candidate's cache may satisfy navigation. An old index was the
// game; the new root is World. Never consult an older build for either shell.
const PAGE_FALLBACKS = new Map(["./", "./play", "./journal", "./about", "./support", "./privacy", "./terms", "./404"].map(path => {
  const url = new URL(path, self.location.href);
  return [url.pathname, url.href];
}));
const NAVIGATION_ALIASES = new Map([
  ["./index.html", "./play"], ["./index", "./play"], ["./game", "./play"],
  ["./play.html", "./play"], ["./play/", "./play"],
  ["./world.html", "./"], ["./world", "./"], ["./world/", "./"],
  ...["journal", "about", "support", "privacy", "terms", "404"].flatMap(name => [[`./${name}.html`, `./${name}`], [`./${name}/`, `./${name}`]])
].map(([from, to]) => [new URL(from, self.location.href).pathname, new URL(to, self.location.href).pathname]));

async function navigationResponse(request) {
  const url = new URL(request.url);
  const alias = NAVIGATION_ALIASES.get(url.pathname);
  if (alias !== undefined) {
    url.pathname = alias; // Keep query parameters, including the old PWA launch.
    return Response.redirect(url.href, 301);
  }
  try { return await cacheIfUsable(request, await fetch(request, { cache: "no-store" })); }
  catch (error) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const page = PAGE_FALLBACKS.get(url.pathname);
    if (page) {
      const shell = await cache.match(page);
      if (shell) return shell;
    }
    // Unknown paths must never impersonate World, the game, or a policy.
    return new Response("This page is not available offline. Reconnect, or return to World or Play.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function networkFirst(request) {
  try { return await cacheIfUsable(request, await fetch(request, { cache: "no-store" })); }
  catch (error) { return (await (await caches.open(CACHE)).match(request)) || Response.error(); }
}

async function cacheFirst(request) {
  const cached = await (await caches.open(CACHE)).match(request);
  if (cached) return cached;
  try { return await cacheIfUsable(request, await fetch(request)); }
  catch (error) { return Response.error(); }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") { event.respondWith(navigationResponse(event.request)); return; }
  // Runtime files are intentionally network-first even though their filenames are
  // release-versioned. This prevents a previous service worker from mixing a new
  // Play shell with an old JS/CSS runtime during deployment. Cached copies remain
  // the offline fallback.
  if (NETWORK_FIRST_PATHS.has(url.pathname)) { event.respondWith(networkFirst(event.request)); return; }
  event.respondWith(cacheFirst(event.request));
});
