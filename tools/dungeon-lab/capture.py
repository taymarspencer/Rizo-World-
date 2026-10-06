#!/usr/bin/env python3
"""Capture the Character Lab's review sheets as PNGs (development only).

    python3 tools/dungeon-lab/capture.py [--out docs/dungeon/character-lab] [--only lineup-390,...] [--format webp|png]

Every shot is a lab URL, so any image can be reopened live: serve the repo
(python3 tools/dungeon-lab/serve.py) and paste the hash after
/tools/dungeon-lab/. Pages render at 2 device pixels per CSS pixel, the
Dungeon canvas's own cap on phones, so "actual size" shots are what a phone
draws, pixel for pixel.
"""
import argparse
import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

# name → lab hash. a=0 freezes motion at t=1200 so every capture is repeatable.
SHOTS = {
    "lineup-390": "v=lineup&p=390&z=1&a=0",
    "lineup-320": "v=lineup&p=320&z=1&a=0",
    "lineup-inspect-x3": "v=lineup&p=390&z=3&a=0",
    "phones": "v=phones&b=below&a=0",
    "portraits": "v=portraits&a=0",
    "portraits-values": "v=portraits&m=values&a=0",
    "inspect-latch": "v=inspect&c=latch&w=both&p=390&z=3&b=below&a=0",
    **{f"sheet-{c}": f"v=sheet&c={c}&p=390&z=1&b={b}&a=0" for c, b in [
        ("rizo", "below"), ("latch", "below"), ("nell", "hearth"), ("orr", "hearth"), ("porter", "below"),
        ("hood-tall", "outside"), ("hood-small", "outside"), ("hood-cap", "outside"), ("keeper", "outside"),
        ("you-seated", "outside"), ("van-crew", "outside"), ("draftling", "below"), ("needle", "below")]},
    **{f"sheet-{c}-x3": f"v=sheet&c={c}&p=390&z=3&b=neutral&a=0" for c in ["latch", "nell", "orr", "porter"]},
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "docs/dungeon/character-lab"))
    parser.add_argument("--only", default="")
    parser.add_argument("--format", choices=["webp", "png"], default="webp", help="webp is lossless (needs Pillow); png needs nothing")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    only = {name for name in args.only.split(",") if name}
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/tools/dungeon-lab/"
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 900}, device_scale_factor=2)
        page.goto(base + "#v=portraits&a=0")
        page.wait_for_function("document.documentElement.dataset.labRizo", timeout=30000)
        page.add_style_tag(content=".lab-controls{position:static!important}")  # a sticky bar would cover element shots
        for name, frag in SHOTS.items():
            if only and name not in only:
                continue
            page.evaluate("h => { location.hash = h; }", frag)
            page.wait_for_timeout(1600 if "rizo" in name or "lineup" in name or name == "phones" else 500)
            main = page.locator(".lab-main")
            png = out / f"{name}.png"
            main.screenshot(path=str(png))
            if args.format == "webp":
                from PIL import Image  # lossless: every pixel as captured, about half the size of the PNG
                Image.open(png).convert("RGB").save(out / f"{name}.webp", "WEBP", lossless=True, quality=100, method=4)
                png.unlink()
            print(f"{name}.{args.format}  #{frag}")
        browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
