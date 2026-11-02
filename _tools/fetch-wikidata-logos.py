"""Fetch brand logo images recorded in Wikidata (property P154) for remaining partners."""
import json
import os
import subprocess
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "_tools", "cache")
OUT = os.path.join(CACHE, "wikidata-logos")
UA = "SuperiorTravelSiteBuild/1.0 (partner logo research)"

TITLES = {
    "ritz-carlton": "The Ritz-Carlton Hotel Company",
    "one-and-only": "One&Only Resorts",
    "six-senses": "Six Senses Hotels Resorts Spas",
    "park-hyatt": "Park Hyatt",
    "luxury-collection": "The Luxury Collection",
    "edition": "EDITION Hotels",
    "jumeirah": "Jumeirah",
    "regent": "Regent Hotels & Resorts",
    "capella": "Capella Hotel Group",
    "maybourne": "Maybourne",
    "poseidon": "Poseidon Expeditions",
    "royal-scotsman": "Royal Scotsman",
    "britannic-explorer": "Britannic Explorer",
    "eastern-oriental": "Eastern and Oriental Express",
    "british-pullman": "British Pullman",
    "la-dolce-vita": "La Dolce Vita Orient Express",
    "golden-eagle": "Golden Eagle Luxury Trains",
    "rovos": "Rovos Rail",
    "blue-train": "The Blue Train",
    "preferred": "Preferred Hotels & Resorts",
    "explora": "Explora Journeys",
    "slh": "Small Luxury Hotels of the World",
    "peninsula": "The Peninsula Hotels",
    "four-seasons": "Four Seasons Hotels and Resorts",
    "cunard": "Cunard Line",
    "oceania": "Oceania Cruises",
    "rocky-mountaineer": "Rocky Mountaineer",
    "uniworld": "Uniworld",
    "avalon": "Avalon Waterways",
    "rssc": "Regent Seven Seas Cruises",
    "scenic": "Scenic Luxury Cruises & Tours",
    "silversea": "Silversea Cruises",
    "seabourn": "Seabourn Cruise Line",
    "tauck": "Tauck",
    "emerald": "Emerald Cruises",
    "venice-simplon": "Venice Simplon-Orient-Express",
    "maharajas": "Maharajas' Express",
    "lhw": "The Leading Hotels of the World",
    "relais-chateaux": "Relais & Châteaux",
    "aman": "Aman Resorts",
    "raffles": "Raffles Hotels & Resorts",
    "waldorf-astoria": "Waldorf Astoria Hotels & Resorts",
    "fairmont": "Fairmont Hotels and Resorts",
    "shangri-la": "Shangri-La Hotels and Resorts",
    "kempinski": "Kempinski",
    "dorchester": "Dorchester Collection",
    "rocco-forte": "Rocco Forte Hotels",
    "st-regis": "St. Regis Hotels & Resorts",
    "mandarin-oriental": "Mandarin Oriental Hotel Group",
    "rosewood": "Rosewood Hotels & Resorts",
    "belmond": "Belmond",
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
    for slug, title in TITLES.items():
        d = os.path.join(OUT, slug)
        os.makedirs(d, exist_ok=True)
        try:
            data = api("en.wikipedia.org", {"action": "query", "prop": "pageprops", "titles": title, "redirects": "1"})
            page = next(iter((data.get("query", {}).get("pages") or {}).values()), {})
            qid = page.get("pageprops", {}).get("wikibase_item")
            logos = []
            if qid:
                ent = json.loads(curl(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json") or "{}")
                claims = ent.get("entities", {}).get(qid, {}).get("claims", {})
                for c in claims.get("P154", []):
                    val = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                    if isinstance(val, str):
                        logos.append(val)
            cands = []
            if logos:
                info = api("commons.wikimedia.org", {
                    "action": "query", "prop": "imageinfo", "iiprop": "url|mime|size",
                    "titles": "|".join(f"File:{n}" for n in logos),
                })
                for pg in (info.get("query", {}).get("pages") or {}).values():
                    ii = (pg.get("imageinfo") or [{}])[0]
                    if ii.get("url") and ii.get("mime") in ("image/svg+xml", "image/png", "image/jpeg"):
                        cands.append({"title": pg["title"], "url": ii["url"], "mime": ii["mime"], "w": ii.get("width"), "h": ii.get("height")})
            for i, c in enumerate(cands):
                ext = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg"}[c["mime"]]
                data = curl(c["url"], binary=True)
                if not data:
                    continue
                path = os.path.join(d, f"{i}.{ext}")
                with open(path, "wb") as f:
                    f.write(data)
                c["file"] = os.path.relpath(path, ROOT).replace("\\", "/")
            result[slug] = {"qid": qid, "candidates": cands}
            print(slug, qid, len(cands))
        except Exception as e:
            result[slug] = {"error": str(e), "candidates": []}
            print(slug, "ERROR", e)
        time.sleep(0.15)
    with open(os.path.join(CACHE, "wikidata-logo-candidates.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)


if __name__ == "__main__":
    main()
