import json
import os
import subprocess
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "_tools", "cache")
OUT = os.path.join(ROOT, "media", "partners")
SVG_GRID = os.path.join(CACHE, "svg-grid.png")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CELL_W, CELL_H, COLS = 520, 220, 4
MAX_H = 110
MAX_W = 420
DARK = (38, 50, 56)

os.makedirs(OUT, exist_ok=True)
manifest = json.load(open(os.path.join(ROOT, "_tools", "partners-manifest.json"), encoding="utf-8"))
svg_items = [m for m in manifest if m["type"] == "svg"]


def build_grid():
    rows = (len(svg_items) + COLS - 1) // COLS
    cells = []
    for m in svg_items:
        url = "http://127.0.0.1:8765/" + m["source"].replace(os.sep, "/")
        cells.append(f'<div class="cell"><img src="{url}" alt=""></div>')
    html = (
        '<!doctype html><meta charset="utf-8"><style>'
        "html,body{margin:0;padding:0;background:transparent;overflow:hidden}"
        f".cell{{width:{CELL_W}px;height:{CELL_H}px;display:flex;align-items:center;justify-content:center;float:left}}"
        f".cell img{{max-width:{CELL_W-30}px;max-height:{CELL_H-20}px;object-fit:contain}}"
        "</style>" + "".join(cells)
    )
    path = os.path.join(CACHE, "svg-grid.html")
    open(path, "w", encoding="utf-8").write(html)
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         f"--window-size={CELL_W*COLS},{CELL_H*rows}",
         "--default-background-color=00000000",
         f"--screenshot={SVG_GRID}", f"--user-data-dir={os.path.join(os.environ.get('TEMP','.'),'chrome-svg-grid')}",
         "http://127.0.0.1:8765/_tools/cache/svg-grid.html"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return rows


def trim(im):
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def whiten_alpha(im):
    """Make near-white pixels transparent for opaque images."""
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    minimum = ImageChops.darker(ImageChops.darker(r, g), b)
    alpha = minimum.point(lambda v: max(0, min(255, int((255 - v) * 1.6))))
    alpha = ImageChops.lighter(alpha, a) if a.getextrema()[0] < 255 else alpha
    im.putalpha(alpha)
    return im


def key_background(im, tol=60):
    """Remove a solid dark background (e.g. navy tile) from the edges."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    br = sum(c[0] for c in corners) // 4
    bg = sum(c[1] for c in corners) // 4
    bb = sum(c[2] for c in corners) // 4
    data = im.getdata()
    out = []
    for r, g, b, a in data:
        dist = ((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2) ** 0.5
        alpha = 0 if dist < tol else 255
        out.append((r, g, b, alpha))
    im.putdata(out)
    return im


def mean_luma(im):
    im = im.convert("RGBA")
    total = weight = 0
    for r, g, b, a in im.getdata():
        if a < 16:
            continue
        total += (0.2126 * r + 0.7152 * g + 0.0722 * b) * a
        weight += a
    return total / weight if weight else 255


def darken_light(im, threshold=195, force=False):
    """Recolor near-white marks to the rail ink colour, preserving alpha."""
    im = im.convert("RGBA")
    data = []
    for r, g, b, a in im.getdata():
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if force or lum > threshold:
            if a > 0:
                # Keep antialiasing by scaling the dark ink with alpha.
                data.append((DARK[0], DARK[1], DARK[2], a))
                continue
        data.append((r, g, b, a))
    im.putdata(data)
    return im


def resize(im):
    w, h = im.size
    scale = min(MAX_H / h, MAX_W / w, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    return im


def save(im, slug):
    im = trim(im)
    im = resize(im)
    path = os.path.join(OUT, slug + ".png")
    im.save(path, "PNG", optimize=True)
    return path


def main():
    build_grid()
    grid = Image.open(SVG_GRID).convert("RGBA")
    by_slug = {m["slug"]: m for m in manifest}
    for i, m in enumerate(svg_items):
        col, row = i % COLS, i // COLS
        cell = grid.crop((col * CELL_W, row * CELL_H, (col + 1) * CELL_W, (row + 1) * CELL_H))
        cell = trim(cell)
        cell = darken_light(cell, force=mean_luma(cell) > 225)
        save(cell, m["slug"])
        print("svg", m["slug"], cell.size)

    special = {"explora": "key", "ritz-carlton": "darken"}
    for m in manifest:
        if m["type"] != "raster":
            continue
        im = Image.open(os.path.join(ROOT, m["source"])).convert("RGBA")
        if m["slug"] == "explora":
            im = key_background(im, tol=70)
            im = darken_light(im, force=True)
        else:
            if im.getchannel("A").getextrema()[0] == 255:
                im = whiten_alpha(im)
            lum = mean_luma(im)
            if lum > 190:
                im = darken_light(im)
        save(im, m["slug"])
        print("raster", m["slug"], im.size)


if __name__ == "__main__":
    main()
