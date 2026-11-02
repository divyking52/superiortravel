"""Discovers authentic brand-logo assets on official websites.

Writes _tools/cache/brand-logo-candidates.json with scored candidates per brand. No images are
written into the site; run the downloader after reviewing the contact sheet.
Usage: python _tools/fetch-brand-logos.py [slug ...]
"""
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_tools" / "cache" / "brand-logo-candidates.json"
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

BRANDS = {
    # Luxury hotels & hospitality
    "ritz-carlton": ("The Ritz-Carlton", "ritzcarlton.com", "The Ritz-Carlton Hotel Company"),
    "st-regis": ("St. Regis Hotels & Resorts", "stregis.com", "St. Regis Hotels & Resorts"),
    "rosewood": ("Rosewood Hotels & Resorts", "rosewoodhotels.com", "Rosewood Hotels & Resorts"),
    "mandarin-oriental": ("Mandarin Oriental", "mandarinoriental.com", "Mandarin Oriental Hotel Group"),
    "peninsula": ("The Peninsula Hotels", "peninsula.com", "The Peninsula Hotels"),
    "aman": ("Aman", "aman.com", "Aman Resorts"),
    "one-and-only": ("One&Only Resorts", "oneandonlyresorts.com", "One&Only Resorts"),
    "raffles": ("Raffles Hotels & Resorts", "www.raffles.com", "Raffles Hotels & Resorts"),
    "belmond": ("Belmond", "belmond.com", "Belmond"),
    "six-senses": ("Six Senses", "sixsenses.com", "Six Senses Hotels Resorts Spas"),
    "waldorf-astoria": ("Waldorf Astoria Hotels & Resorts", "waldorfastoria.com", "Waldorf Astoria Hotels & Resorts"),
    "park-hyatt": ("Park Hyatt", "parkhyatt.com", "Park Hyatt"),
    "luxury-collection": ("The Luxury Collection", "luxurycollection.com", "The Luxury Collection"),
    "edition": ("EDITION Hotels", "editionhotels.com", "EDITION Hotels"),
    "fairmont": ("Fairmont Hotels & Resorts", "fairmont.com", "Fairmont Hotels & Resorts"),
    "jumeirah": ("Jumeirah", "jumeirah.com", "Jumeirah"),
    "shangri-la": ("Shangri-La", "shangri-la.com", "Shangri-La Hotels and Resorts"),
    "kempinski": ("Kempinski", "kempinski.com", "Kempinski"),
    "regent": ("Regent Hotels & Resorts", "regenthotels.com", "Regent Hotels & Resorts"),
    "capella": ("Capella Hotels and Resorts", "capellahotels.com", "Capella Hotel Group"),
    "auberge": ("Auberge Collection", "aubergeresorts.com", "Auberge Resorts"),
    "four-seasons": ("Four Seasons Hotels & Resorts", "fourseasons.com", "Four Seasons Hotels and Resorts"),
    "dorchester": ("Dorchester Collection", "dorchestercollection.com", "Dorchester Collection"),
    "rocco-forte": ("Rocco Forte Hotels", "roccofortehotels.com", "Rocco Forte Hotels"),
    "maybourne": ("Maybourne", "maybourne.com", "Maybourne"),
    "lhw": ("The Leading Hotels of the World", "lhw.com", "The Leading Hotels of the World"),
    "slh": ("Small Luxury Hotels of the World", "slh.com", "Small Luxury Hotels of the World"),
    "relais-chateaux": ("Relais & Châteaux", "relaischateaux.com", "Relais & Châteaux"),
    "preferred": ("Preferred Hotels & Resorts", "preferredhotels.com", "Preferred Hotels & Resorts"),
    # Luxury ocean cruises
    "regent-seven-seas": ("Regent Seven Seas Cruises", "rssc.com", "Regent Seven Seas Cruises"),
    "silversea": ("Silversea Cruises", "silversea.com", "Silversea Cruises"),
    "seabourn": ("Seabourn", "seabourn.com", "Seabourn Cruise Line"),
    "explora": ("Explora Journeys", "explorajourneys.com", "Explora Journeys"),
    "ritz-yacht": ("The Ritz-Carlton Yacht Collection", "ritzcarltonyachtcollection.com", "The Ritz-Carlton Yacht Collection"),
    "four-seasons-yachts": ("Four Seasons Yachts", "fourseasonsyachts.com", "Four Seasons Yachts"),
    "crystal": ("Crystal", "crystalcruises.com", "Crystal Cruises"),
    "oceania": ("Oceania Cruises", "oceaniacruises.com", "Oceania Cruises"),
    "ponant": ("PONANT", "ponant.com", "Ponant"),
    "scenic": ("Scenic", "scenicluxurycruises.com", "Scenic Luxury Cruises & Tours"),
    "seadream": ("SeaDream Yacht Club", "seadream.com", "SeaDream Yacht Club"),
    "windstar": ("Windstar Cruises", "windstarcruises.com", "Windstar Cruises"),
    "paul-gauguin": ("Paul Gauguin Cruises", "pgcruises.com", "Paul Gauguin Cruises"),
    "poseidon": ("Poseidon Expeditions", "poseidonexpeditions.com", "Poseidon Expeditions"),
    "cunard": ("Cunard", "cunard.com", "Cunard Line"),
    # Luxury river cruises
    "uniworld": ("Uniworld Boutique River Cruises", "uniworld.com", "Uniworld"),
    "tauck": ("Tauck", "tauck.com", "Tauck"),
    "riverside": ("Riverside Luxury Cruises", "riverside-cruises.com", "Riverside Luxury Cruises"),
    "emerald": ("Emerald Cruises", "emeraldcruises.com", "Emerald Cruises"),
    "avalon": ("Avalon Waterways", "avalonwaterways.com", "Avalon Waterways"),
    # Luxury rail
    "venice-simplon": ("Venice Simplon-Orient-Express", "belmond.com", "Venice Simplon-Orient-Express"),
    "royal-scotsman": ("Royal Scotsman", "rovalscotsman.com", "Royal Scotsman"),
    "britannic-explorer": ("Britannic Explorer", "britannicexplorer.com", "Britannic Explorer"),
    "eastern-oriental": ("Eastern & Oriental Express", "belmond.com", "Eastern and Oriental Express"),
    "british-pullman": ("British Pullman", "belmond.com", "British Pullman"),
    "la-dolce-vita": ("La Dolce Vita Orient Express", "ladolcevitaorientexpress.com", "La Dolce Vita Orient Express"),
    "rocky-mountaineer": ("Rocky Mountaineer", "rockymountaineer.com", "Rocky Mountaineer"),
    "golden-eagle": ("Golden Eagle Luxury Trains", "goldeneagleluxurytrains.com", "Golden Eagle Luxury Trains"),
    "rovos": ("Rovos Rail", "rovos.com", "Rovos Rail"),
    "maharajas": ("Maharajas' Express", "maharajas-express.in", "Maharajas' Express"),
    "blue-train": ("The Blue Train", "bluetrain.co.za", "The Blue Train"),
}

IMG_EXT = re.compile(r"\.(svg|png|webp|jpe?g)(?=$|[?#])", re.I)


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
        return r.geturl(), r.read().decode("utf-8", "ignore")


def absolute(base, url):
    if not url:
        return ""
    return urllib.parse.urljoin(base, url.replace("&amp;", "&"))


def score_candidate(url, label, tokens, kind):
    hay = (url + " " + label).lower()
    score = 0
    if "logo" in hay:
        score += 60
    if any(t in hay for t in tokens):
        score += 20
    if kind == "svg":
        score += 25
    if kind == "jsonld":
        score += 30
    if re.search(r"favicon|icon-?32|16x16|sprite", hay):
        score -= 70
    if re.search(r"\.svg($|\?)", url, re.I):
        score += 18
    return score


def discover(brand):
    name, domain, wiki = brand
    result = {"name": name, "domain": domain, "wiki": wiki, "candidates": [], "error": ""}
    tokens = [t for t in re.split(r"[^a-z0-9]+", name.lower()) if len(t) > 2 and t not in {"the", "and", "hotels", "resorts"}]
    try:
        base, html = fetch("https://" + domain)
    except Exception as exc:
        result["error"] = str(exc)
        return result
    result["base"] = base
    seen = set()

    def add(raw, label, kind, extra=0):
        url = absolute(base, raw)
        if not url or url in seen:
            return
        if url.startswith("data:"):
            return
        if not IMG_EXT.search(url) and kind != "inline-svg":
            return
        seen.add(url)
        result["candidates"].append({
            "url": url,
            "label": label[:160],
            "kind": kind,
            "score": score_candidate(url, label, tokens, kind) + extra,
        })

    # JSON-LD logo
    for m in re.finditer(r'"logo"\s*:\s*(?:\{[^{}]*?"url"\s*:\s*)?"([^"]+)"', html):
        add(m.group(1), "json-ld logo", "jsonld", 10)
    # og:logo / meta logo
    for m in re.finditer(r'<meta[^>]+(?:property|name)=["\'](?:og:logo|logo)["\'][^>]+content=["\']([^"\']+)', html, re.I):
        add(m.group(1), "meta logo", "meta", 15)
    # img tags
    for m in re.finditer(r"<img\b[^>]*>", html, re.I):
        tag = m.group(0)
        src = re.search(r'\bsrc=["\']([^"\']+)', tag, re.I)
        if not src:
            continue
        alt = re.search(r'\balt=["\']([^"\']*)', tag, re.I)
        cls = re.search(r'\bclass=["\']([^"\']*)', tag, re.I)
        label = " ".join(x for x in [alt.group(1) if alt else "", cls.group(1) if cls else ""] if x)
        hay = (src.group(1) + " " + label).lower()
        if "logo" in hay or any(t in hay for t in tokens):
            add(src.group(1), label, "img")
    # picture/source
    for m in re.finditer(r'<source\b[^>]*srcset=["\']([^"\']+)', html, re.I):
        if "logo" in m.group(1).lower():
            add(m.group(1).split(",")[0].strip().split(" ")[0], "source logo", "img", -5)
    # inline svg: keep the outerHTML of svg whose class/title/aria mentions logo or brand
    for m in re.finditer(r"<svg\b[^>]*>.*?</svg>", html, re.I | re.S):
        tag = m.group(0)
        head = tag[: tag.find(">") + 1]
        hay = head.lower()
        if ("logo" in hay or any(t in hay for t in tokens)) and len(tag) < 60000:
            result["candidates"].append({"url": "", "label": "inline svg", "kind": "inline-svg", "score": 55, "svg": tag})
    # union of duplicates
    merged = {}
    for c in result["candidates"]:
        key = c.get("url") or "inline-svg-" + str(len(merged))
        if key in merged:
            merged[key]["score"] = max(merged[key]["score"], c["score"])
        else:
            merged[key] = c
    result["candidates"] = sorted(merged.values(), key=lambda c: -c["score"])[:12]
    return result


def main():
    slugs = sys.argv[1:] or list(BRANDS)
    existing = json.loads(OUT.read_text("utf-8")) if OUT.exists() else {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(discover, BRANDS[s]): s for s in slugs if s in BRANDS}
        for fut in as_completed(futures):
            slug = futures[fut]
            try:
                existing[slug] = fut.result()
            except Exception as exc:
                existing[slug] = {"name": BRANDS[slug][0], "domain": BRANDS[slug][1], "candidates": [], "error": str(exc)}
            item = existing[slug]
            print(f"{slug:22} {len(item['candidates']):2} candidates {item['error'][:60]}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(existing, indent=2), "utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
