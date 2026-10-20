"""Draw the ParametriCAD mark into the PNG icons the web manifest declares.

The mark is the cube from ``public/favicon.svg``. It is redrawn with Pillow
because the manifest needs rasters of fixed sizes and this project has no SVG
rasteriser to depend on; 4x supersampling keeps the edges clean. The outputs are
committed, so CI and contributors never need to run this. Run it only when the
mark changes, from the repository root:

    py -3 frontend/scripts/generate-pwa-icons.py

It needs Pillow (``pip install pillow``).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

BACKGROUND = "#0e1116"
STROKE = "#3d8bfd"

GRID = 32.0  # the favicon's viewBox, in units
STROKE_UNITS = 2.0
CORNER_UNITS = 7.0  # the favicon's rounded-square radius
SUPERSAMPLE = 4

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"

HEXAGON = [(16, 5), (26, 10.5), (26, 21.5), (16, 27), (6, 21.5), (6, 10.5), (16, 5)]
SPINES = [[(6, 10.5), (16, 16), (26, 10.5)], [(16, 16), (16, 27)]]


def render(size: int, *, rounded: bool, mark_scale: float) -> Image.Image:
    """Draw the mark on a ``size`` square.

    ``rounded`` keeps the favicon's rounded tile on a transparent canvas; without
    it the background runs edge to edge, which is what a maskable or Apple icon
    needs because the platform applies its own mask. ``mark_scale`` is the size
    of the mark relative to the favicon's.
    """
    big = size * SUPERSAMPLE
    unit = big / GRID * mark_scale
    transparent = (0, 0, 0, 0)
    image = Image.new("RGBA", (big, big), transparent if rounded else BACKGROUND)
    draw = ImageDraw.Draw(image)
    if rounded:
        draw.rounded_rectangle(
            (0, 0, big - 1, big - 1), radius=CORNER_UNITS / GRID * big, fill=BACKGROUND
        )

    def point(x: float, y: float) -> tuple[float, float]:
        return (big / 2 + (x - GRID / 2) * unit, big / 2 + (y - GRID / 2) * unit)

    width = round(STROKE_UNITS * unit)
    radius = width / 2
    for path in (HEXAGON, *SPINES):
        points = [point(x, y) for x, y in path]
        draw.line(points, fill=STROKE, width=width, joint="curve")
        for px, py in points:  # Pillow draws square line ends; round them
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=STROKE)

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    icons = {
        # Plain icons keep the favicon's tile and proportions.
        "icon-192.png": render(192, rounded=True, mark_scale=1.0),
        "icon-512.png": render(512, rounded=True, mark_scale=1.0),
        # Android masks a maskable icon to a circle or squircle and keeps only its
        # central 80 %; 0.85 puts the whole mark inside that safe zone.
        "icon-maskable-512.png": render(512, rounded=False, mark_scale=0.85).convert("RGB"),
        # iOS rounds the corners itself, so the tile must reach the edges.
        "apple-touch-icon.png": render(180, rounded=False, mark_scale=1.0).convert("RGB"),
    }
    for name, image in icons.items():
        image.save(OUT_DIR / name, optimize=True)
        print(f"wrote {name} ({image.width}x{image.height}, {image.mode})")


if __name__ == "__main__":
    main()
