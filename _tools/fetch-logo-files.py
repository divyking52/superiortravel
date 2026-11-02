"""Search the MediaWiki file namespace for brand logos when the article has none."""
import json
import os
import re
import subprocess
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "_tools", "cache")
OUT = os.path.join(CACHE, "file-logos")
UA = "SuperiorTravelSiteBuild/1.0 (partner logo research)"

BRANDS = {
    "ritz-carlton": ["Ritz-Carlton", "Ritz Carlton"],
    "one-and-only": ["One&Only", "One and Only Resorts"],
    "six-senses": ["Six Senses"],
    "park-hyatt": ["Park Hyatt"],
    "luxury-collection": ["Luxury Collection"],
    "jumeirah": ["Jumeirah"],
    "regent": ["Regent Hotels"],
    "capella": ["Capella Hotels", "Capella Hotel"],
    "maybourne": ["Maybourne"],
    "avalon": ["Avalon Waterways"],
    "golden-eagle": ["Golden Eagle Luxury Trains", "Golden Eagle train"],
    "rovos": ["Rovos Rail"],
    "blue-train": ["Blue Train South Africa", "Blue Train"],
    "explora": ["Explora Journeys"],
    "royal-scotsman": ["Royal Scotsman"],
    "britannic-explorer": ["Britannic Explorer"],
    "eastern-oriental": ["Eastern and Oriental Express", "Eastern Oriental Express"],
    "british-pullman": ["British Pullman"],
    "scenic": ["Scenic Luxury Cruises"],
    "sunborn": ["Sunborn"],
}


def curl(url, binary=False):
    p = subprocess.run(
        ["curl", "-sS", "-L", "--compressed", "--max-time", "30", "-A", UA,
         "-H", "Accept: application/json", url],
        capture_output=True,
    )
    if p.returncode != 0 or not p.stdout:
        return None
    return p.stdout if binary else p.stdout.decode("utf-8", "replace")


def api(host, params):
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode(dict(params, format="json"))
    txt = curl(url)
    return json.loads(txt) if txt else {}


def main():
    os.makedirs(OUT, exist_ok=True)
    result = {}
    for slug, terms in BRANDS.items():
        d = os.path.join(OUT, slug)
        os.makedirs(d, exist_ok=True)
        titles = []
        for term in terms:
            for host in ("en.wikipedia.org", "commons.wikimedia.org"):
                try:
                    data = api(host, {"action": "query", "list": "search", "srnamespace": "6", "srlimit": "10", "srsearch": f"{term} logo"})
                    for r in data.get("query", {}).get("search", []):
                        t = r["title"]
                        if re.search(r"\.(svg|png|jpe?g)$", t, re.I) and t not in titles:
                            titles.append(t)
                except Exception:
                    pass
                time.sleep(0.15)
        cands = []
        for host in ("en.wikipedia.org", "commons.wikimedia.org"):
            if not titles:
                break
            try:
                info = api(host, {"action": "query", "prop": "imageinfo", "iiprop": "url|mime|size", "titles": "|".join(titles[:40])})
                for pg in (info.get("query", {}).get("pages") or {}).values():
                    ii = (pg.get("imageinfo") or [{}])[0]
                    if ii.get("url") and ii.get("mime") in ("image/svg+xml", "image/png", "image/jpeg", "image/webp"):
                        cands.append({"title": pg["title"], "url": ii["url"], "mime": ii["mime"], "w": ii.get("width"), "h": ii.get("height")})
            except Exception as e:
                print(slug, "imageinfo", e)
        seen, uniq = set(), []
        for c in cands:
            if c["title"] in seen:
                continue
            seen.add(c["title"])
            uniq.append(c)
        for i, c in enumerate(uniq[:10]):
            ext = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[c["mime"]]
            data = curl(c["url"], binary=True)
            if not data:
                continue
            path = os.path.join(d, f"{i}.{ext}")
            with open(path, "wb") as f:
                f.write(data)
            c["file"] = os.path.relpath(path, ROOT).replace("\\", "/")
        result[slug] = {"queries": terms, "candidates": uniq}
        print(slug, len(uniq), "|", " ; ".join(c["title"][5:] for c in uniq[:5]))
    with open(os.path.join(CACHE, "file-logo-candidates.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)


if __name__ == "__main__":
    main()
