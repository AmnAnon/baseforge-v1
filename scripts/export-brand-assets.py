#!/usr/bin/env python3
"""Export BaseForge SVG brand assets to PNG/ICO for favicons and PWA."""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MARK = ROOT / "public" / "brand" / "logo-mark.svg"
LOGO = ROOT / "public" / "brand" / "logo.svg"
PUBLIC = ROOT / "public"
APP = ROOT / "src" / "app"


def rsvg(svg: Path, out: Path, size: int) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), str(svg), "-o", str(out)],
        check=True,
    )


def rsvg_logo(svg: Path, out: Path, width: int) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["rsvg-convert", "-w", str(width), str(svg), "-o", str(out)],
        check=True,
    )


def make_ico(sources: list[tuple[Path, int]], out: Path) -> None:
    images: list[Image.Image] = []
    for path, size in sources:
        img = Image.open(path).convert("RGBA")
        if img.size != (size, size):
            img = img.resize((size, size), Image.Resampling.LANCZOS)
        images.append(img)
    out.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(
        out,
        format="ICO",
        sizes=[(s, s) for _, s in sources],
        append_images=images[1:],
    )


def main() -> None:
    sizes = {
        16: PUBLIC / "brand" / "icon-16.png",
        32: PUBLIC / "brand" / "icon-32.png",
        48: PUBLIC / "brand" / "icon-48.png",
        180: PUBLIC / "apple-touch-icon.png",
        192: PUBLIC / "brand" / "icon-192.png",
        512: PUBLIC / "icon.png",
    }

    for px, path in sizes.items():
        rsvg(MARK, path, px)
        print(f"  {path.relative_to(ROOT)} ({px}px)")

    rsvg_logo(LOGO, PUBLIC / "logo.png", 560)
    print(f"  {PUBLIC.relative_to(ROOT)}/logo.png")

    # Next.js app directory icons
    rsvg(MARK, APP / "icon.png", 512)
    rsvg(MARK, APP / "apple-icon.png", 180)
    make_ico(
        [
            (sizes[16], 16),
            (sizes[32], 32),
            (sizes[48], 48),
        ],
        APP / "favicon.ico",
    )
    make_ico(
        [
            (sizes[16], 16),
            (sizes[32], 32),
            (sizes[48], 48),
        ],
        PUBLIC / "favicon.ico",
    )
    print(f"  {APP.relative_to(ROOT)}/favicon.ico")
    print(f"  {PUBLIC.relative_to(ROOT)}/favicon.ico")
    print("Done.")


if __name__ == "__main__":
    main()