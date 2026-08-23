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
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
            device_scale_factor=3,
        )
        page = context.new_page()
        errors = []
        watch_errors(page, errors)

        page.goto(f"{origin}/index.html?qa=1", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_function("window.RizoWorld && window.RizoRuntimeQA", timeout=120000)
        page.wait_for_function(
            "document.getElementById('rizo-defense-combat-feedback-v1')?.sheet",
            timeout=10000,
        )
        record(
            "combat feedback stylesheet loads through launch config",
            page.locator("#rizo-defense-combat-feedback-v1").count() == 1,
        )

        page.evaluate(
            """() => {
              localStorage.setItem('rizo-defense-first-120-v1', 'done');
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
              state.player.defenseSchool = { dismissed: true, completed: ['route', 'placement'], replay: false };
              state.collection.classic = 1;
              RizoRuntimeQA.loadForQA(state);
              RizoRuntimeQA.setViewForQA('arcade');
            }"""
        )

        page.evaluate('RizoWorld.launch("game.defense")')
        page.wait_for_selector(".defense-origin-reveal, .defense-world-lobby", state="visible", timeout=10000)
        if page.locator(".defense-origin-reveal").count():
            page.tap("[data-defense-intro-continue]")
        page.wait_for_selector(".defense-world-lobby", state="visible", timeout=10000)
        page.tap('[data-enter-defense-world="grove"]')
        page.wait_for_selector(".defense-shell", state="visible", timeout=10000)
        if page.locator("#defenseMapIntro:visible").count():
            page.tap("[data-defense-skip-map-intro]")

        # Use the same strong legal Pine Bend pocket proven by the Phase 1 gate.
        choice = page.locator("[data-defense-roster-id]:not([disabled])").first
        choice.tap()
        world = page.locator("#defenseWorld")
        box = world.bounding_box()
        assert box, "Defense world has no geometry"
        page.touchscreen.tap(box["x"] + box["width"] * .75, box["y"] + box["height"] * .36)
        page.wait_for_selector("[data-defense-tower]", state="visible", timeout=5000)

        page.evaluate(
            """() => {
              window.__rizoCombatSeen = {
                firing: false,
                firingAnimation: '',
                impact: false,
                impactAnimation: '',
                popped: false,
                popAnimation: ''
              };
              const world = document.querySelector('#defenseWorld');
              const inspect = node => {
                if (!(node instanceof Element)) return;
                const descendants = node.querySelectorAll ? [...node.querySelectorAll('*')] : [];
                for (const item of [node, ...descendants]) {
                  if (item.matches?.('.defense-tower.firing')) {
                    const actor = item.querySelector('.defense-rizo,.mini-pet');
                    window.__rizoCombatSeen.firing = true;
                    if (actor) window.__rizoCombatSeen.firingAnimation = getComputedStyle(actor).animationName;
                  }
                  if (item.matches?.('.defense-impact')) {
                    window.__rizoCombatSeen.impact = true;
                    window.__rizoCombatSeen.impactAnimation = getComputedStyle(item).animationName;
                  }
                  if (item.matches?.('.defense-enemy.popped')) {
                    window.__rizoCombatSeen.popped = true;
                    window.__rizoCombatSeen.popAnimation = getComputedStyle(item).animationName;
                  }
                }
              };
              new MutationObserver(records => {
                for (const record of records) {
                  inspect(record.target);
                  for (const added of record.addedNodes) inspect(added);
                }
              }).observe(world, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
            }"""
        )

        page.tap("#defenseWaveButton")
        page.wait_for_function("Number(document.querySelector('#defenseWave')?.textContent || 0) === 1", timeout=5000)
        page.wait_for_function("window.__rizoCombatSeen.firing", timeout=20000)
        page.wait_for_function("window.__rizoCombatSeen.impact", timeout=20000)
        page.wait_for_function("window.__rizoCombatSeen.popped", timeout=30000)

        seen = page.evaluate("window.__rizoCombatSeen")
        record(
            "real tower fire uses the sharper recoil animation",
            seen["firing"] and "rizo-combat-recoil" in seen["firingAnimation"],
            seen["firingAnimation"],
        )
        record(
            "real hits use the short impact punctuation",
            seen["impact"] and "rizo-combat-impact" in seen["impactAnimation"],
            seen["impactAnimation"],
        )
        record(
            "real pops use a distinct squash-burst animation",
            seen["popped"] and "rizo-combat-pop" in seen["popAnimation"],
            seen["popAnimation"],
        )

        snapshot = page.evaluate("RizoRuntimeQA.defenseSnapshotForQA()")
        record(
            "combat pass does not add gameplay entities or bypass visual budgets",
            snapshot["visibleProjectileCount"] <= snapshot["visualBudget"]["maxVisibleProjectiles"]
            and snapshot["maxEffectNodesObserved"] <= snapshot["visualBudget"]["maxImpactEffects"],
            str({
                "visibleProjectiles": snapshot["visibleProjectileCount"],
                "maxProjectiles": snapshot["visualBudget"]["maxVisibleProjectiles"],
                "maxEffectsObserved": snapshot["maxEffectNodesObserved"],
                "maxEffects": snapshot["visualBudget"]["maxImpactEffects"],
            }),
        )

        low = page.evaluate("RizoRuntimeQA.defenseSetLowPerformanceForQA(true)")
        record(
            "existing low-performance tier still owns the fallback",
            low["renderTier"] == 2 and page.locator("#defenseWorld.fx-potato").count() == 1,
            str(low),
        )
        tower = page.locator("[data-defense-tower]").first
        page.evaluate("node => node.classList.add('firing')", tower)
        low_animation = page.evaluate(
            "node => getComputedStyle(node.querySelector('.defense-rizo,.mini-pet')).animationName",
            tower,
        )
        record(
            "custom recoil stays off in potato mode",
            "rizo-combat-recoil" not in low_animation,
            low_animation,
        )

        record("combat readability pass has no runtime errors", not errors, "; ".join(errors[:8]))

        context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

failed = [result for result in results if not result[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} Defense combat feedback checks passed")
raise SystemExit(1 if failed else 0)
