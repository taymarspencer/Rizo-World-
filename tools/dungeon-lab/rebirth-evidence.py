#!/usr/bin/env python3
"""Compose native-size review sheets from actual browser captures.

No figure or screenshot is resized. Install Pillow, then run after the
capture scripts listed in docs/verification/cast-rebirth/README.md.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--evidence", type=Path, default=ROOT / "docs/verification/cast-rebirth")
args = parser.parse_args()
OUT = args.evidence
BG, FG, MUTED = "#171512", "#eee2c7", "#c0b49c"
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)


def read(stem):
    for suffix in [".webp", ".png"]:
        p = OUT / (stem + suffix)
        if p.exists():
            return Image.open(p).convert("RGB")
    raise FileNotFoundError(stem)


def save(sheet, name):
    target = OUT / (name + ".webp")
    temporary = target.with_suffix(".webp.tmp")
    sheet.save(temporary, "WEBP", lossless=True, quality=100, method=4)
    temporary.replace(target)
    print(name + ".webp")


def strips(name, title, rows):
    images = [(label, read(stem)) for label, stem in rows]
    w = max(im.width for _, im in images) + 32
    h = 52 + sum(im.height + 38 for _, im in images)
    sheet = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(sheet)
    d.text((16, 12), title, fill=FG, font=FONT)
    y = 44
    for label, im in images:
        d.text((16, y), label, fill=MUTED, font=SMALL)
        sheet.paste(im, (16, y + 20))
        y += im.height + 38
    save(sheet, name)


def pairs(name, title, scenes, width, folder=""):
    images = [(label, read(f"before/{folder}{scene}-{width}"), read(f"after/{folder}{scene}-{width}"))
              for scene, label in scenes]
    assert all(a.size == b.size for _, a, b in images), "Comparable viewports must match"
    w = width * 2 + 40
    h = 52 + sum(a.height + 48 for _, a, _ in images)
    sheet = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(sheet)
    d.text((12, 12), title, fill=FG, font=FONT)
    y = 44
    for label, a, b in images:
        d.text((12, y), label, fill=FG, font=FONT)
        d.text((12, y + 22), "BEFORE", fill=MUTED, font=SMALL)
        d.text((width + 28, y + 22), "AFTER", fill=MUTED, font=SMALL)
        sheet.paste(a, (12, y + 40))
        sheet.paste(b, (width + 28, y + 40))
        y += a.height + 48
    save(sheet, name)


strips("cast-comparison", "Before / after — native 390px gameplay scale", [
    ("BEFORE", "before/lab/lineup-390-warm"),
    ("AFTER", "after/lab/lineup-390-warm")])
strips("cast-lineup", "The new cast — native 390px gameplay scale; names hidden", [
    ("Colour", "after/lab/lineup-390-warm"),
    ("Silhouettes", "after/lab/lineup-390-silhouette")])
pairs("friendly-320", "Nell and Orr — 320 × 568; native phone screenshots", [
    ("nell-dialogue", "Meeting Nell"), ("orr-dialogue", "Orr speaks"), ("nell-latch", "Nell beside Latch")], 320)
pairs("crew-390", "The human ensemble — 390 × 844; native phone screenshots", [
    ("van-quiet", "The four in the van"), ("intake-crew", "Tall, Small and Cap on the floor")], 390)
pairs("collectors-430", "Collector roles — 430 × 932; native phone screenshots", [
    ("queue-collector", "Marshal"), ("row-collector", "Gatherer"),
    ("hall-runner", "Runner"), ("factory-sentry", "Sentry")], 430)
pairs("actions-320", "Working and fighting — 320 × 568; native phone screenshots", [
    ("nell-lift", "Nell lifts (north framing corrected)"), ("nell-fit", "Nell fits the wrap"),
    ("porter-open", "Porter's open seam"), ("porter-settled", "The same lantern after defeat")], 320)
pairs("comics-390", "The same collectors in comics — 390 × 844", [
    ("window-comic", "Window marshal"), ("chute-comic", "Chase runner")], 390, "comics/")
pairs("you-390", "YOU across the opening — 390 × 844", [
    ("walk", "Pavement and dialogue"), ("window", "Inside the store")], 390, "opening/")
