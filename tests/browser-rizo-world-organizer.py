import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ENGINE = os.environ.get("RIZO_BROWSER", "chromium").lower()
results = []


def record(name, passed, detail=""):
    results.append((name, bool(passed), detail))
    print(("PASS" if passed else "FAIL"), name, detail)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def watch_errors(page, errors):
    page.on("pageerror", lambda error: errors.append(f"pageerror {error}"))
    page.on(
        "response",
        lambda response: errors.append(f"http {response.status} {response.url}")
        if response.status >= 400 and not response.url.endswith("/favicon.ico")
        else None,
    )
    page.on(
        "console",
        lambda message: errors.append(f"console error {message.text}")
        if message.type == "error" and "favicon.ico" not in message.text
        else None,
    )


handler = partial(QuietHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_port}"

try:
    with sync_playwright() as playwright:
        browser = getattr(playwright, ENGINE).launch(headless=True)

        production = browser.new_context(viewport={"width": 390, "height": 844})
        production_page = production.new_page()
        production_errors = []
        watch_errors(production_page, production_errors)
        production_page.goto(f"{origin}/index.html", wait_until="domcontentloaded", timeout=120000)
        production_page.wait_for_function("window.RizoWorld && window.RizoLegacyRuntime", timeout=120000)
        record(
            f"{ENGINE} production-style mobile boot",
            production_page.evaluate("RizoBoot.status().ready && __RIZO_RUNTIME_BUILD__ === 'v86-world-organizer'")
            and production_page.viewport_size == {"width": 390, "height": 844},
        )
        record(f"{ENGINE} production boot has no runtime errors", not production_errors, "; ".join(production_errors[:5]))
        production.close()

        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        errors = []
        watch_errors(page, errors)
        page.goto(f"{origin}/index.html?qa=1", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_function("window.RizoWorld && window.RizoRuntimeQA", timeout=120000)

        manifest = page.evaluate(
            """() => Object.fromEntries(
              RizoWorld.core.registry.categories().map(category => [category, RizoWorld.query(category).count()])
            )"""
        )
        record(
            "World boots with the truthful manifest",
            manifest == {
                "games": 11, "rizos": 14, "traits": 19, "items": 61,
                "abilities": 28, "enemies": 15, "towers": 14, "upgrades": 2,
                "waves": 1, "events": 11, "rewards": 4, "systems": 17,
                "achievements": 21, "maps": 6,
            },
            str(manifest),
        )

        parity = page.evaluate(
            """() => {
              const paths = [
                "rizos", "foods", "wearables", "treasures", "rooms", "boosts",
                "skills", "mutations", "evolutionForms", "worldEvents", "achievements",
                "defenseMaps", "defenseEnemies", "defenseBosses", "defenseAbilities",
                "defenseControlAbilities", "defenseDoctrines", "defenseTowerProfiles"
              ];
              const definitions = RizoWorld.core.registry.categories().flatMap(category => RizoWorld.query(category).value());
              const issues = [];
              for (const name of paths) {
                const collection = RizoLegacyRuntime.content[name];
                const actual = Array.isArray(collection) ? collection.map(row => row.id) : Object.keys(collection || {});
                const indexed = definitions
                  .filter(row => row.binding?.path === `RizoLegacyRuntime.content.${name}`)
                  .map(row => row.binding.value);
                const missing = actual.filter(key => !indexed.includes(key));
                const extra = indexed.filter(key => !actual.includes(key));
                if (missing.length || extra.length) issues.push({name, missing, extra});
              }
              return issues;
            }"""
        )
        record("reverse parity covers every intentionally indexed legacy collection", not parity, str(parity))

        integrity = page.evaluate(
            """() => {
              const addresses = RizoWorld.core.registry.categories().flatMap(category =>
                RizoWorld.core.registry.ids(category, {includeAliases:true}));
              const unresolved = addresses.filter(id => !RizoWorld.core.registry.locate(id));
              const broken = RizoWorld.core.registry.categories().flatMap(category =>
                RizoWorld.query(category).value()
                  .filter(definition => definition.source === "legacy" && definition.binding && !definition.optional)
                  .filter(definition => !RizoWorld.available(category, definition.id))
                  .map(definition => definition.id));
              const tower = RizoWorld.resolve("tower.defense.classic");
              const rizo = RizoWorld.resolve("rizo.classic");
              try { rizo.name = "BROKEN"; } catch {}
              return {
                unresolved, broken,
                towerTruthful: tower.label === "BALANCED" && tower.projectile === "spark" && !tower.active,
                mutationBlocked: Object.isFrozen(rizo) && Object.isFrozen(RizoLegacyRuntime.content.rizos[0]) && rizo.name === "CLASSIC BLUE" && RizoLegacyRuntime.content.rizos[0].name === "CLASSIC BLUE",
                rewardRuntimeUnavailable: !RizoWorld.available("reward.embers")
              };
            }"""
        )
        record(
            "World addresses, bindings, tower profiles, availability, and read-only views are truthful",
            not integrity["unresolved"] and not integrity["broken"] and integrity["towerTruthful"]
            and integrity["mutationBlocked"] and integrity["rewardRuntimeUnavailable"],
            str(integrity),
        )

        page.evaluate(
            """() => {
              const state = RizoRuntimeQA.defaultState();
              state.introSeen = true;
              state.pet.stage = "kid";
              state.pet.variant = "classic";
              state.pet.hiddenVariant = "classic";
              state.pet.energy = 100;
              state.pet.hunger = 100;
              state.pet.mood = 100;
              state.pet.health = 100;
              state.pet.resting = false;
              state.pet.sleeping = false;
              state.player.tutorialDismissed = true;
              state.wallet.embers = 321;
              state.collection.classic = 1;
              RizoRuntimeQA.loadForQA(state);
              RizoRuntimeQA.saveForQA();
              RizoRuntimeQA.setViewForQA("home");
            }"""
        )
        record("mobile home surface remains active", page.locator("#viewHome.active").count() == 1)
        page.reload(wait_until="domcontentloaded", timeout=120000)
        page.wait_for_function("window.RizoWorld && window.RizoRuntimeQA", timeout=120000)
        saved = page.evaluate("RizoRuntimeQA.snapshot()")
        record("legacy save/reload remains intact", saved["wallet"]["embers"] == 321 and saved["pet"]["stage"] == "kid")

        page.evaluate('RizoRuntimeQA.setViewForQA("arcade")')
        record("arcade surface remains active", page.locator("#viewArcade.active").count() == 1)
        for game_id, selector in [("game.power_tape", ".power-dx"), ("game.spark_stash", ".spark-dx")]:
            page.evaluate("gameId => RizoWorld.launch(gameId)", game_id)
            page.wait_for_selector(selector, state="visible", timeout=10000)
            record(f"{game_id} launches through RizoWorld", page.evaluate("RizoRuntimeQA.miniSnapshot().active"))
            page.evaluate("RizoRuntimeQA.finishMiniGame(true)")

        page.evaluate('RizoWorld.launch("game.defense")')
        page.wait_for_selector(".defense-origin-reveal, .defense-world-lobby", state="visible", timeout=10000)
        if page.locator(".defense-origin-reveal").count():
            page.click("[data-defense-intro-continue]")
        page.wait_for_selector(".defense-world-lobby", state="visible", timeout=10000)
        page.click('[data-enter-defense-world="grove"]')
        page.wait_for_selector(".defense-shell", state="visible", timeout=10000)
        record("Defense launches through its unchanged legacy flow", page.locator(".defense-shell").count() == 1)
        record("QA integration smoke has no runtime errors", not errors, "; ".join(errors[:5]))
        context.close()

        fallback = browser.new_context(viewport={"width": 390, "height": 844})
        fallback_page = fallback.new_page()
        fallback_page.route("**/src/rizo-world/bootstrap.js", lambda route: route.abort())
        fallback_page.goto(f"{origin}/index.html?qa=1", wait_until="domcontentloaded", timeout=120000)
        fallback_page.wait_for_function("window.RizoRuntimeQA && window.RizoLegacyRuntime", timeout=120000)
        fallback_page.evaluate("""() => { const s=RizoRuntimeQA.defaultState(); s.introSeen=true; s.pet.stage='kid'; s.player.tutorialDismissed=true; RizoRuntimeQA.loadForQA(s); RizoRuntimeQA.setViewForQA('arcade'); }""")
        fallback_page.click('[data-minigame="power"]')
        fallback_page.wait_for_selector(".power-dx", state="visible", timeout=10000)
        record("legacy app remains playable when World bootstrap fails", fallback_page.evaluate("!window.RizoWorld && RizoRuntimeQA.miniSnapshot().mode === 'power'"))
        fallback.close()

        offline = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="allow")
        offline_page = offline.new_page()
        offline_page.goto(f"{origin}/index.html?qa=1", wait_until="domcontentloaded", timeout=120000)
        offline_page.wait_for_function("window.RizoWorld && window.RizoLegacyRuntime", timeout=120000)
        offline_page.evaluate("navigator.serviceWorker.ready")
        offline_page.reload(wait_until="domcontentloaded", timeout=120000)
        offline_page.wait_for_function("navigator.serviceWorker.controller && window.RizoWorld", timeout=120000)
        offline.set_offline(True)
        offline_page.reload(wait_until="domcontentloaded", timeout=120000)
        offline_page.wait_for_function("window.RizoWorld && window.RizoLegacyRuntime", timeout=120000)
        record("installed offline reload boots World and legacy runtime", offline_page.evaluate("RizoWorld.available('game.defense') && !!RizoLegacyRuntime.content.rizos.length"))
        offline.close()

        browser.close()
finally:
    server.shutdown()
    server.server_close()

failed = [result for result in results if not result[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} Rizo World organizer {ENGINE} checks passed")
raise SystemExit(1 if failed else 0)
