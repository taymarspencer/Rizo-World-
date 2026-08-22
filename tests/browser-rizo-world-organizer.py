from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
results = []


def record(name, passed, detail=""):
    results.append((name, bool(passed), detail))
    print(("PASS" if passed else "FAIL"), name, detail)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


handler = partial(QuietHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
url = f"http://127.0.0.1:{server.server_port}/index.html?qa=1"

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="C:/Users/admin/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        errors = []

        def capture_console(message):
            if message.type == "error" and not message.location.get("url", "").endswith("/favicon.ico"):
                errors.append(f"console error {message.text} {message.location}")

        page.on("pageerror", lambda error: errors.append(f"pageerror {error}"))
        page.on(
            "response",
            lambda response: errors.append(f"http {response.status} {response.url}")
            if response.status >= 400
            else None,
        )
        page.on("console", capture_console)

        page.goto(url, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_function("window.RizoWorld && window.RizoRuntimeQA", timeout=120000)

        manifest = page.evaluate(
            """() => Object.fromEntries(
              RizoWorld.core.registry.categories().map(category => [category, RizoWorld.query(category).count()])
            )"""
        )
        record(
            "World boots with the authoritative manifest",
            manifest["games"] == 11
            and manifest["rizos"] == 14
            and manifest["items"] == 61
            and manifest["towers"] == 14
            and manifest["rewards"] == 26,
            str(manifest),
        )
        record(
            "stable IDs resolve live legacy definitions",
            page.evaluate(
                """() => RizoWorld.resolve("rizo.classic") === RizoLegacyRuntime.content.rizos[0]
                  && RizoWorld.resolve("system.defense_core") === RizoDefenseCore"""
            ),
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
        record(
            "mobile home surface remains active",
            page.locator('#viewHome.active').count() == 1
            and page.viewport_size == {"width": 390, "height": 844},
        )

        page.reload(wait_until="domcontentloaded", timeout=120000)
        page.wait_for_function("window.RizoWorld && window.RizoRuntimeQA", timeout=120000)
        saved = page.evaluate("RizoRuntimeQA.snapshot()")
        record(
            "legacy save/load remains intact",
            saved["wallet"]["embers"] == 321 and saved["pet"]["stage"] == "kid",
            str({"embers": saved["wallet"]["embers"], "stage": saved["pet"]["stage"]}),
        )
        broken_bindings = page.evaluate(
            """() => RizoWorld.core.registry.categories().flatMap(category =>
              RizoWorld.query(category).value()
                .filter(definition => definition.source === "legacy" && !definition.optional)
                .filter(definition => !RizoWorld.available(category, definition.id))
                .map(definition => definition.id)
            )"""
        )
        record("all required legacy bindings resolve", not broken_bindings, str(broken_bindings))

        page.evaluate('RizoRuntimeQA.setViewForQA("arcade")')
        record("arcade surface remains active", page.locator('#viewArcade.active').count() == 1)

        page.evaluate('RizoWorld.launch("game.power_tape")')
        page.wait_for_selector(".power-dx", state="visible", timeout=10000)
        record("Power Tape launches through RizoWorld", page.locator(".power-dx").count() == 1)
        page.evaluate("RizoRuntimeQA.finishMiniGame(true)")

        page.evaluate('RizoWorld.launch("game.spark_stash")')
        page.wait_for_selector(".spark-dx", state="visible", timeout=10000)
        record("Spark Stash launches through RizoWorld", page.locator(".spark-dx").count() == 1)
        page.evaluate("RizoRuntimeQA.finishMiniGame(true)")

        page.evaluate('RizoWorld.launch("game.defense")')
        page.wait_for_selector(".defense-origin-reveal, .defense-world-lobby", state="visible", timeout=10000)
        if page.locator(".defense-origin-reveal").count():
            page.click("[data-defense-intro-continue]")
        page.wait_for_selector(".defense-world-lobby", state="visible", timeout=10000)
        page.click('[data-enter-defense-world="grove"]')
        page.wait_for_selector(".defense-shell", state="visible", timeout=10000)
        record("Defense launches through its unchanged legacy flow", page.locator(".defense-shell").count() == 1)
        record("organizer browser smoke has no runtime errors", not errors, "; ".join(errors[:5]))

        context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

failed = [result for result in results if not result[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} Rizo World organizer browser checks passed")
raise SystemExit(1 if failed else 0)
