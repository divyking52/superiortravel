"""Find brand logo files on Wikipedia and Wikimedia Commons for partner-logo sourcing.

Writes candidates to _tools/cache/wiki-logo-candidates.json and downloads them to
_tools/cache/wiki-logos/<brand>/<n>.<ext>. Read-only network access; no site files change.
"""
import json
import os
import re
import subprocess
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "_tools", "cache")
OUT = os.path.join(CACHE, "wiki-logos")
UA = "SuperiorTravelSiteBuild/1.0 (partner logo research; contact: web@superiortravel.com)"

BRANDS = {
    "ritz-carlton": ("The Ritz-Carlton Hotel Company", "The Ritz-Carlton"),
    "st-regis": ("St. Regis Hotels & Resorts", "St. Regis Hotels & Resorts"),
    "rosewood": ("Rosewood Hotels & Resorts", "Rosewood Hotels & Resorts"),
    "mandarin-oriental": ("Mandarin Oriental Hotel Group", "Mandarin Oriental"),
    "peninsula": ("The Peninsula Hotels", "The Peninsula Hotels"),
    "aman": ("Aman Resorts", "Aman"),
    "one-and-only": ("One&Only Resorts", "One&Only Resorts"),
    "raffles": ("Raffles Hotels & Resorts", "Raffles Hotels & Resorts"),
    "belmond": ("Belmond", "Belmond"),
    "six-senses": ("Six Senses Hotels Resorts Spas", "Six Senses"),
    "waldorf-astoria": ("Waldorf Astoria Hotels & Resorts", "Waldorf Astoria"),
    "park-hyatt": ("Park Hyatt", "Park Hyatt"),
    "luxury-collection": ("The Luxury Collection", "Luxury Collection"),
    "edition": ("EDITION Hotels", "EDITION Hotels"),
    "fairmont": ("Fairmont Hotels & Resorts", "Fairmont Hotels"),
    "jumeirah": ("Jumeirah", "Jumeirah"),
    "shangri-la": ("Shangri-La Hotels and Resorts", "Shangri-La Hotels"),
    "kempinski": ("Kempinski", "Kempinski"),
    "regent": ("Regent Hotels & Resorts", "Regent Hotels"),
    "capella": ("Capella Hotel Group", "Capella Hotels"),
    "auberge": ("Auberge Resorts", "Auberge Resorts"),
    "four-seasons": ("Four Seasons Hotels and Resorts", "Four Seasons Hotels"),
    "dorchester": ("Dorchester Collection", "Dorchester Collection"),
    "rocco-forte": ("Rocco Forte Hotels", "Rocco Forte Hotels"),
    "maybourne": ("Maybourne", "Maybourne Hotel Group"),
    "lhw": ("The Leading Hotels of the World", "Leading Hotels of the World"),
    "slh": ("Small Luxury Hotels of the World", "Small Luxury Hotels"),
    "relais-chateaux": ("Relais & Châteaux", "Relais & Chateaux"),
    "preferred": ("Preferred Hotels & Resorts", "Preferred Hotels"),
    "regent-seven-seas": ("Regent Seven Seas Cruises", "Regent Seven Seas"),
    "silversea": ("Silversea Cruises", "Silversea Cruises"),
    "seabourn": ("Seabourn Cruise Line", "Seabourn"),
    "explora": ("Explora Journeys", "Explora Journeys"),
    "ritz-yacht": ("The Ritz-Carlton Yacht Collection", "Ritz-Carlton Yacht Collection"),
    "four-seasons-yachts": ("Four Seasons Yachts", "Four Seasons Yachts"),
    "crystal": ("Crystal Cruises", "Crystal Cruises"),
    "oceania": ("Oceania Cruises", "Oceania Cruises"),
    "ponant": ("Ponant", "Ponant"),
    "scenic": ("Scenic Luxury Cruises & Tours", "Scenic Luxury Cruises"),
    "seadream": ("SeaDream Yacht Club", "SeaDream"),
    "windstar": ("Windstar Cruises", "Windstar Cruises"),
    "paul-gauguin": ("Paul Gauguin Cruises", "Paul Gauguin Cruises"),
    "poseidon": ("Poseidon Expeditions", "Poseidon Expeditions"),
    "cunard": ("Cunard Line", "Cunard"),
    "uniworld": ("Uniworld", "Uniworld"),
    "tauck": ("Tauck", "Tauck"),
    "riverside": ("Riverside Luxury Cruises", "Riverside Luxury Cruises"),
    "emerald": ("Emerald Cruises", "Emerald Cruises"),
    "avalon": ("Avalon Waterways", "Avalon Waterways"),
    "venice-simplon": ("Venice Simplon-Orient-Express", "Venice Simplon-Orient-Express"),
    "royal-scotsman": ("Royal Scotsman", "Royal Scotsman"),
    "britannic-explorer": ("Britannic Explorer", "Britannic Explorer"),
    "eastern-oriental": ("Eastern and Oriental Express", "Eastern and Oriental Express"),
    "british-pullman": ("British Pullman", "British Pullman"),
    "la-dolce-vita": ("La Dolce Vita Orient Express", "La Dolce Vita Orient Express"),
    "rocky-mountaineer": ("Rocky Mountaineer", "Rocky Mountaineer"),
    "golden-eagle": ("Golden Eagle Luxury Trains", "Golden Eagle Luxury Trains"),
    "rovos": ("Rovos Rail", "Rovos Rail"),
    "maharajas": ("Maharajas' Express", "Maharajas' Express"),
    "blue-train": ("The Blue Train", "The Blue Train"),
}

LOGO_RE = re.compile(r"logo|wordmark|brand|identity", re.I)
GOOD_MIME = {"image/svg+xml", "image/png", "image/jpeg", "image/webp"}


def get(url):
    # curl honours the system proxy reliably here; urllib intermittently times out.
    last = None
    for attempt in range(3):
        p = subprocess.run(
            ["curl", "-sS", "-L", "--max-time", "30", "-A", UA, "-H", "Accept: */*", url],
            capture_output=True,
        )
        if p.returncode == 0 and p.stdout:
            return p.stdout
        last = p.stderr.decode("utf-8", "replace").strip()
        time.sleep(0.6)
    raise RuntimeError(f"curl failed for {url}: {last}")


def api(host, params):
    params = dict(params, format="json")
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)
    return json.loads(get(url))


def imageinfo(host, titles):
    out = {}
    for i in range(0, len(titles), 40):
        batch = titles[i : i + 40]
        data = api(host, {
            "action": "query",
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "titles": "|".join(batch),
            "imlimit": "max",
        })
        for page in (data.get("query", {}).get("pages") or {}).values():
            ii = (page.get("imageinfo") or [{}])[0]
            if ii.get("url"):
                out[page["title"]] = ii
    return out


def wiki_images(host, title):
    try:
        data = api(host, {"action": "query", "prop": "images", "titles": title, "imlimit": "max"})
        pages = (data.get("query", {}).get("pages") or {}).values()
        names = []
        for p in pages:
            for im in p.get("images") or []:
                n = im.get("title", "")
                if LOGO_RE.search(n):
                    names.append(n)
        return names
    except Exception as e:
        return [], str(e)


def commons_search(term):
    try:
        data = api("commons.wikimedia.org", {
            "action": "query", "list": "search", "srnamespace": "6", "srlimit": "10",
            "srsearch": f"{term} logo filetype:drawing",
        })
        return [r["title"] for r in data.get("query", {}).get("search", [])]
    except Exception:
        return []


def main():
    os.makedirs(OUT, exist_ok=True)
    result = {}
    for slug, (wiki, search_term) in BRANDS.items():
        d = os.path.join(OUT, slug)
        os.makedirs(d, exist_ok=True)
        try:
            names = wiki_images("en.wikipedia.org", wiki)
        except Exception as e:
            print(slug, "wiki error", e)
            names = []
        if not names:
            # Commons search as fallback.
            names = commons_search(search_term)
        try:
            info = imageinfo("en.wikipedia.org", names) if names else {}
        except Exception as e:
            print(slug, "imageinfo error", e)
            info = {}
        cands = []
        for i, (title, ii) in enumerate(info.items()):
            if ii.get("mime") not in GOOD_MIME:
                continue
            # Commons descriptions sometimes put the brand wordmark in a photo; keep size sane.
            w, h = ii.get("width") or 0, ii.get("height") or 0
            if w < 40 or h < 20 or w > 4000 or h > 2000:
                continue
            cands.append({"title": title, "url": ii["url"], "mime": ii["mime"], "w": w, "h": h})
        result[slug] = {"wiki": wiki, "candidates": cands}
        for i, c in enumerate(cands[:6]):
            ext = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[c["mime"]]
            path = os.path.join(d, f"{i}.{ext}")
            try:
                with open(path, "wb") as f:
                    f.write(get(c["url"]))
                c["file"] = os.path.relpath(path, ROOT).replace("\\", "/")
            except Exception as e:
                c["error"] = str(e)
        print(slug, len(cands), "candidates")
        time.sleep(0.2)
    with open(os.path.join(CACHE, "wiki-logo-candidates.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print("wrote", os.path.join(CACHE, "wiki-logo-candidates.json"))


if __name__ == "__main__":
    main()
