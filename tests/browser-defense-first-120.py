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


def watch_errors(page, errors):
    page.on("pageerror", lambda error: errors.append(f"pageerror {error}"))
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
        browser = playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        errors = []
        watch_errors(page, errors)

        page.goto(f"{origin}/index.html?qa=1&first120=1", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_function("window.RizoWorld && window.RizoRuntimeQA", timeout=120000)
        page.evaluate(
            """() => {
              localStorage.removeItem('rizo-defense-first-120-v1');
              const state = RizoRuntimeQA.defaultState();
              state.introSeen = true;
              state.pet.stage = 'kid';
              state.pet.variant = 'classic';
              state.pet.hiddenVariant = 'classic';
              state.pet.energy = 100;
              state.pet.hunger = 100;
              state.pet.mood = 100;
              state.pet.health = 100;
              state.player.tutorialDismissed = true;
              state.player.defenseSchool = { dismissed: false, completed: [], replay: false };
              state.collection.classic = 1;
              RizoRuntimeQA.loadForQA(state);
              RizoRuntimeQA.setViewForQA('arcade');
            }"""
        )

        page.evaluate('RizoWorld.launch("game.defense")')
        page.wait_for_selector(".defense-origin-reveal, .defense-world-lobby", state="visible", timeout=10000)
        if page.locator(".defense-origin-reveal").count():
            page.click("[data-defense-intro-continue]")
        page.wait_for_selector(".defense-world-lobby", state="visible", timeout=10000)
        page.click('[data-enter-defense-world="grove"]')
        page.wait_for_selector(".defense-shell", state="visible", timeout=10000)

        # The authored map intro remains the first orientation beat. The guide waits
        # behind it instead of stacking another modal on top.
        page.wait_for_selector("#defenseMapIntro", state="visible", timeout=5000)
        coach_intro = page.locator(".rizo-first-120-coach").inner_text()
        record("first-run coach respects the map intro", "READ THE ROAD" in coach_intro, coach_intro)
        page.click("[data-defense-skip-map-intro]")

        page.wait_for_function(
            "document.querySelector('.defense-shell')?.dataset.rizoFirstStep === 'place'",
            timeout=5000,
        )
        visible_roster = page.evaluate(
            """() => [...document.querySelectorAll('[data-defense-roster-id]')]
              .filter(node => getComputedStyle(node).display !== 'none').length"""
        )
        choice = page.locator("[data-defense-roster-id].rizo-first-choice")
        selected_label = choice.get_attribute("aria-label") or ""
        record(
            "new player gets one obvious free first choice",
            visible_roster == 1 and choice.count() == 1 and "FREE DEPLOY" in selected_label,
            f"visible={visible_roster} choice={selected_label}",
        )
        record(
            "guide makes player choose instead of playing for them",
            choice.get_attribute("aria-pressed") == "false" and "TAP YOUR RIZO" in page.locator(".rizo-first-120-coach").inner_text(),
            page.locator(".rizo-first-120-coach").inner_text(),
        )

        choice.click()
        page.wait_for_function(
            "document.querySelector('[data-defense-roster-id][aria-pressed=\"true\"]')",
            timeout=5000,
        )
        page.wait_for_selector(".rizo-first-pocket-target", state="visible", timeout=5000)
        target_count = page.locator(".rizo-first-pocket-target").count()
        record("placement exposes authored safe-spot targets", target_count >= 2, str(target_count))
        record("placement instruction advances after Rizo selection", "PICK A SPOT" in page.locator(".rizo-first-120-coach").inner_text())

        page.locator(".rizo-first-pocket-target").first.click()
        page.wait_for_selector("[data-defense-tower]", state="visible", timeout=5000)
        page.wait_for_function(
            "document.querySelector('.defense-shell')?.dataset.rizoFirstStep === 'start'",
            timeout=5000,
        )
        record(
            "first placement immediately points to Wave 1",
            page.locator("#defenseWaveButton").is_enabled()
            and "START WAVE 1" in page.locator(".rizo-first-120-coach").inner_text(),
            page.locator(".rizo-first-120-coach").inner_text(),
        )
        restored_roster = page.evaluate(
            """() => [...document.querySelectorAll('[data-defense-roster-id]')]
              .filter(node => getComputedStyle(node).display !== 'none').length"""
        )
        record("full roster returns after the first placement", restored_roster > 1, str(restored_roster))

        page.click("#defenseWaveButton")
        page.wait_for_function("Number(document.querySelector('#defenseWave')?.textContent || 0) === 1", timeout=5000)
        page.wait_for_function(
            "Number((document.querySelector('#miniScore')?.textContent.match(/\\d+/) || ['0'])[0]) >= 1",
            timeout=20000,
        )
        record(
            "first pop gets explicit payoff feedback",
            page.locator(".defense-shell").get_attribute("data-rizo-first-pop") == "1",
            page.locator("#miniScore").inner_text(),
        )

        # Exercise the real Wave 1 rather than shortcutting the progression gate.
        page.wait_for_function("Number(document.querySelector('#defenseClearedWave')?.textContent || 0) >= 1", timeout=40000)
        page.wait_for_selector("#defenseTowerPanel:not([hidden]) [data-defense-upgrade]", state="visible", timeout=5000)
        upgrade_text = page.locator("#defenseTowerPanel [data-defense-upgrade]").inner_text()
        record(
            "Wave 1 clear opens the first meaningful upgrade",
            "LEVEL UP" in upgrade_text and page.locator("#defenseTowerPanel [data-defense-upgrade]").is_enabled(),
            upgrade_text,
        )
        record(
            "coach explains the core defend-earn-upgrade loop",
            "UPGRADE YOUR RIZO" in page.locator(".rizo-first-120-coach").inner_text(),
            page.locator(".rizo-first-120-coach").inner_text(),
        )

        page.locator("#defenseTowerPanel [data-defense-upgrade]").click()
        page.wait_for_function("localStorage.getItem('rizo-defense-first-120-v1') === 'done'", timeout=5000)
        page.wait_for_function(
            "document.querySelector('#defenseTowerPanel .defense-panel-copy b')?.textContent.includes('LV 2')",
            timeout=5000,
        )
        record("successful first upgrade retires the one-time guide", True)

        page.wait_for_timeout(1700)
        record("first-run coach gets out of the way after learning", page.locator(".rizo-first-120-coach").count() == 0)
        record("first-120 flow has no runtime errors", not errors, "; ".join(errors[:8]))

        context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

failed = [result for result in results if not result[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} Defense first-120 checks passed")
raise SystemExit(1 if failed else 0)
