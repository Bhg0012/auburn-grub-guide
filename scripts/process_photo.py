#!/usr/bin/env python3
"""Resize and compress photos for the guide.

Usage:
  python3 scripts/process_photo.py <place-id> <image> [<image> ...]

Writes images/places/<place-id>/1.jpg, 2.jpg, ... (in the order given),
replacing anything already there, and prints the paths to paste into
data/places.json.
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

MAX_SIDE = 1400
QUALITY = 80


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    place_id, sources = sys.argv[1], sys.argv[2:]
    root = Path(__file__).resolve().parent.parent
    out_dir = root / "images" / "places" / place_id
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.jpg"):
        old.unlink()

    paths = []
    for i, src in enumerate(sources, start=1):
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        dest = out_dir / f"{i}.jpg"
        im.save(dest, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        rel = dest.relative_to(root).as_posix()
        paths.append(rel)
        print(f"{rel}  {im.width}x{im.height}  {dest.stat().st_size // 1024} KB")

    print()
    print('"photos": [' + ", ".join(f'"{p}"' for p in paths) + "]")


if __name__ == "__main__":
    main()
