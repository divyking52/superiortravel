"""Discover logo asset URLs on brand sites that block Python's urllib.

Uses curl (which reaches these hosts reliably) and scans HTML for logo-ish
<img>/<source>, inline <svg>, JSON-LD and og:image assets. Writes
_tools/cache/curl-logo-candidates.json and downloads candidates to
_tools/cache/curl-logos/<brand>/.
"""
import json
import os
import re
import subprocess
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "_tools", "cache")
OUT = os.path.join(CACHE, "curl-logos")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

SITES = {
    "ritz-carlton": ["https://www.ritzcarlton.com/"],
    "one-and-only": ["https://www.oneandonlyresorts.com/"],
    "six-senses": ["https://www.sixsenses.com/"],
    "belmond": ["https://www.belmond.com/"],
    "park-hyatt": ["https://www.hyatt.com/brands/park-hyatt"],
    "luxury-collection": ["https://www.luxurycollection.com/", "https://the-luxury-collection.marriott.com/"],
    "edition": ["https://www.editionhotels.com/"],
    "jumeirah": ["https://www.jumeirah.com/en"],
    "regent": ["https://www.regenthotels.com/"],
    "capella": ["https://capellahotels.com/"],
    "maybourne": ["https://www.maybourne.com/en"],
    "poseidon": ["https://poseidonexpeditions.com/"],
    "venice-simplon": [
        "https://www.belmond.com/trains/europe/italy/venice-simplon-orient-express/",
        "https://www.belmond.com/trains/europe/italy/venice-simplon-orient-express",
    ],
    "royal-scotsman": ["https://www.belmond.com/trains/europe/scotland/royal-scotsman/", "https://www.belmond.com/royal-scotsman/"],
    "britannic-explorer": ["https://www.britannicexplorer.com/", "https://www.belmond.com/trains/europe/england/britannic-explorer/"],
    "eastern-oriental": ["https://www.belmond.com/trains/asia/eastern-and-oriental-express/", "https://www.belmond.com/eastern-and-oriental-express/"],
    "british-pullman": ["https://www.belmond.com/trains/europe/england/british-pullman/", "https://www.belmond.com/british-pullman/"],
    "la-dolce-vita": ["https://www.ladolcevitaorientexpress.com/", "https://www.belmond.com/trains/europe/italy/la-dolce-vita-orient-express/"],
    "golden-eagle": ["https://www.goldeneagleluxurytrains.com/"],
    "rovos": ["https://www.rovos.com/"],
    "blue-train": ["https://www.bluetrain.co.za/"],
    "preferred": ["https://www.preferredhotels.com/"],
    "explora": ["https://www.explorajourneys.com/"],
    "slh": ["https://www.slh.com/"],
    "peninsula": ["https://www.peninsula.com/"],
    "four-seasons": ["https://www.fourseasons.com/"],
    "cunard": ["https://www.cunard.com/"],
    "oceania": ["https://www.oceaniacruises.com/"],
    "rocky-mountaineer": ["https://www.rockymountaineer.com/"],
    "uniworld": ["https://www.uniworld.com/"],
    "avalon": ["https://www.avalonwaterways.com/"],
    "scenic": ["https://www.scenicluxurycruises.com/"],
    "silversea": ["https://www.silversea.com/"],
    "seabourn": ["https://www.seabourn.com/"],
    "rssc": ["https://www.rssc.com/"],
}

TOKEN = re.compile(r"logo|wordmark|brand", re.I)
SVG_RE = re.compile(r"<svg\b[^>]*>.*?</svg>", re.I | re.S)
ATTR_RE = re.compile(r'\b(?:src|href|content|data-src|data-lazy-src|srcset)="([^"]+)"', re.I)


def curl(url, binary=False):
    p = subprocess.run(
        ["curl", "-sS", "-L", "--compressed", "--max-time", "25", "-A", UA,
         "-H", "Accept-Language: en-US,en;q=0.9", url],
        capture_output=True,
    )
    if p.returncode != 0 or not p.stdout:
        return None
    return p.stdout if binary else p.stdout.decode("utf-8", "replace")


def candidates_from(html, base):
    out = []
    for m in SVG_RE.finditer(html):
        svg = m.group(0)
        if "viewBox" in svg or "viewbox" in svg:
            out.append({"url": "", "kind": "inline-svg", "svg": svg})
    for m in ATTR_RE.finditer(html):
        raw = m.group(1).strip()
        if not TOKEN.search(raw):
            continue
        for part in raw.split(","):
            url = part.strip().split(" ")[0]
            if not url or url.startswith("data:"):
                continue
            full = urllib.parse.urljoin(base, url)
            if full.lower().split("?")[0].endswith((".svg", ".png", ".jpg", ".jpeg", ".webp")):
                out.append({"url": full, "kind": "file"})
    # JSON-LD / og:image logo entries keyed without a logo-ish filename.
    for m in re.finditer(r'"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")', html):
        u = m.group(1) or m.group(2)
        if u:
            out.append({"url": urllib.parse.urljoin(base, u), "kind": "jsonld"})
    seen, uniq = set(), []
    for c in out:
        key = c.get("url") or (c.get("svg") or "")[:200]
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    return uniq


def main():
    os.makedirs(OUT, exist_ok=True)
    result = {}
    for slug, pages in SITES.items():
        d = os.path.join(OUT, slug)
        os.makedirs(d, exist_ok=True)
        cands = []
        for page in pages:
            html = curl(page)
            if not html:
                continue
            cands += candidates_from(html, page)
            time.sleep(0.3)
        seen, uniq = set(), []
        for c in cands:
            key = c.get("url") or (c.get("svg") or "")[:200]
            if key in seen:
                continue
            seen.add(key)
            uniq.append(c)
        result[slug] = {"pages": pages, "candidates": uniq}
        n = 0
        for c in uniq:
            if n >= 8:
                break
            if c.get("svg"):
                path = os.path.join(d, f"s{n}.svg")
                with open(path, "w", encoding="utf-8") as f:
                    f.write(c["svg"])
                c["file"] = os.path.relpath(path, ROOT).replace("\\", "/")
            else:
                ext = c["url"].split("?")[0].rsplit(".", 1)[-1].lower()
                if ext not in ("svg", "png", "jpg", "jpeg", "webp"):
                    continue
                data = curl(c["url"], binary=True)
                if not data:
                    continue
                path = os.path.join(d, f"f{n}.{ext}")
                with open(path, "wb") as f:
                    f.write(data)
                c["file"] = os.path.relpath(path, ROOT).replace("\\", "/")
            n += 1
        print(slug, len(uniq), "candidates", n, "downloaded")
    with open(os.path.join(CACHE, "curl-logo-candidates.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print("wrote", os.path.join(CACHE, "curl-logo-candidates.json"))


if __name__ == "__main__":
    main()
