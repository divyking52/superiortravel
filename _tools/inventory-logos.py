import os
import glob
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "_tools", "cache")
ROOTS = ["wiki-logos", "curl-logos", "file-logos", "manual", "manual2", "targeted", "wikidata-logos"]

out = {}
for r in ROOTS:
    base = os.path.join(CACHE, r)
    for p in glob.glob(os.path.join(base, "**", "*"), recursive=True):
        if not os.path.isfile(p):
            continue
        ext = os.path.splitext(p)[1].lower()
        if ext not in (".svg", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"):
            continue
        rel = os.path.relpath(p, CACHE).replace(os.sep, "/")
        parts = rel.split("/")
        brand = parts[0] if parts[0] in ("manual", "manual2") else parts[1]
        info = {"path": p, "ext": ext, "bytes": os.path.getsize(p)}
        try:
            if ext == ".svg":
                head = open(p, encoding="utf-8", errors="ignore").read(3000)
                m = re.search(r"viewBox=[\"']([^\"']+)", head)
                info["viewBox"] = m.group(1) if m else None
                info["kind"] = "svg"
            else:
                im = Image.open(p)
                info.update(w=im.width, h=im.height, mode=im.mode, kind="raster")
        except Exception as exc:
            info["kind"] = "ERR:" + str(exc)[:50]
        out.setdefault(brand, []).append(info)

for brand in sorted(out):
    print("##", brand)
    for i in out[brand]:
        print("  ", i["path"], i["kind"], i.get("w", ""), i.get("h", ""), i.get("viewBox", ""), i["bytes"])
