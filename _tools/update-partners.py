import json

ROOT = r"C:\Downloaded Web Sites\superiortravel.com"
manifest = json.load(open(ROOT + r"\_tools\partners-manifest.json", encoding="utf-8"))
partners = json.load(open(ROOT + r"\content\partners.json", encoding="utf-8"))
existing = {p["name"]: p for p in partners["featured"]}
by_slug = {m["slug"]: m for m in manifest}


def entry(m):
    return {
        "name": m["name"],
        "logo": f"/media/partners/{m['slug']}.png",
        "alt": f"{m['name']} logo",
        "website": m["website"],
    }


def old(name, slug):
    src = existing[name]
    return {
        "name": name,
        "logo": f"/media/partners/{slug}.png",
        "alt": src["alt"],
        "website": src.get("website", ""),
    }


featured = []
featured += [entry(by_slug[s]) for s in [
    "ritz-carlton", "st-regis", "rosewood", "mandarin-oriental", "peninsula", "aman",
    "one-and-only", "raffles", "belmond", "six-senses", "waldorf-astoria", "park-hyatt",
    "luxury-collection", "edition", "fairmont", "jumeirah", "shangri-la", "kempinski",
    "regent", "capella", "auberge", "four-seasons", "dorchester", "rocco-forte",
    "maybourne", "lhw", "slh", "relais-chateaux", "preferred",
]]
featured += [entry(by_slug[s]) for s in [
    "regent-seven-seas", "silversea", "seabourn", "explora", "ritz-yacht", "four-seasons-yachts",
    "crystal", "oceania", "ponant", "scenic", "seadream", "windstar", "paul-gauguin",
    "poseidon", "cunard",
]]
featured += [
    old("Royal Caribbean", "royal-caribbean"),
    old("Virgin Voyages", "virgin-voyages"),
    old("Norwegian Cruise Line", "norwegian-cruise-line"),
]
featured += [entry(by_slug[s]) for s in ["uniworld"]]
featured += [old("AmaWaterways", "amawaterways")]
featured += [entry(by_slug[s]) for s in ["tauck", "riverside", "emerald"]]
featured += [old("Viking", "viking")]
featured += [entry(by_slug[s]) for s in ["avalon"]]
featured += [entry(by_slug[s]) for s in [
    "venice-simplon", "la-dolce-vita", "rocky-mountaineer", "golden-eagle", "maharajas", "blue-train",
]]
featured += [
    old("Sandals Resorts", "sandals"),
    old("Beaches Resorts", "beaches"),
    old("Disney Destinations", "disney-destinations"),
]

partners["$comment"] = [
    "featured drives the homepage partner rail and the /partners logo wall; directory drives the partner directory.",
    "Logo files under /media/partners were normalised from official brand sites, official press/media assets, or Wikimedia brand-logo files; see _tools/partners-manifest.json for per-brand provenance.",
    "Carnival Cruise Line was removed at the client's request. Belmond appears once (hotels + rail). The Scenic logo represents Scenic Eclipse and Scenic River. AmaWaterways and Viking are retained existing partners.",
    "Five requested rail brands are not present because no standalone official brand mark could be verified: Royal Scotsman, Britannic Explorer, Eastern & Oriental Express, British Pullman, Rovos Rail. They travel under the Belmond brand, whose logo is included once. Do not substitute text placeholders.",
    "Each entry: name, logo (root-relative path or URL), alt text, website. To add or replace a logo, drop a PNG/SVG in media/partners, update logo and alt, and add the official website URL. Admin edits flow into the next content build without code changes.",
]
partners["featured"] = featured

with open(ROOT + r"\content\partners.json", "w", encoding="utf-8") as f:
    json.dump(partners, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("featured", len(featured), "unique", len({p["name"] for p in featured}))
print("no website", [p["name"] for p in featured if not p["website"]])
print("logo missing", [p["logo"] for p in featured if not p["logo"].startswith("http") and not __import__("os").path.exists(ROOT + p["logo"].replace("/", "\\"))])
