import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = "_tools/cache"

groups = {
    "hotels": [
        ("ritz-carlton", "file-logos/ritz-carlton/0.svg"),
        ("st-regis", "wiki-logos/st-regis/0.svg"),
        ("rosewood", "manual3/rosewood.svg"),
        ("mandarin-oriental", "wiki-logos/mandarin-oriental/0.svg"),
        ("peninsula", "wiki-logos/peninsula/0.svg"),
        ("aman", "wiki-logos/aman/0.svg"),
        ("one-and-only", "manual2/oneandonly.png"),
        ("raffles", "wiki-logos/raffles/0.svg"),
        ("belmond", "manual3/belmond.svg"),
        ("six-senses", "manual2/sixsenses.png"),
        ("waldorf-astoria", "wiki-logos/waldorf-astoria/0.svg"),
        ("park-hyatt", "manual2/brandbar/30.svg"),
        ("luxury-collection", "manual2/luxcoll.svg"),
        ("edition", "curl-logos/edition/f5.png"),
        ("fairmont", "wiki-logos/fairmont/0.svg"),
        ("jumeirah", "manual/jumeirah.svg"),
        ("shangri-la", "wiki-logos/shangri-la/1.svg"),
        ("kempinski", "wiki-logos/kempinski/0.svg"),
        ("regent-official", "manual2/regent.png"),
        ("regent-wiki", "manual2/regent-wiki.png"),
        ("capella", "manual/capella.svg"),
        ("auberge", "manual3/auberge.svg"),
        ("four-seasons", "wiki-logos/four-seasons/1.svg"),
        ("dorchester", "wiki-logos/dorchester/0.png"),
        ("rocco-forte", "wiki-logos/rocco-forte/1.svg"),
        ("maybourne", "manual/maybourne.png"),
        ("lhw", "wiki-logos/lhw/0.svg"),
        ("slh-logo1", "manual3/slh/logo-1-380x44.svg"),
        ("slh-logo4", "manual3/slh/logo-4-68x24.svg"),
        ("slh-logo5", "manual3/slh/logo-5-58x22.svg"),
        ("slh-header", "manual3/slh/slh-header.svg"),
        ("relais-chateaux", "wiki-logos/relais-chateaux/0.png"),
        ("preferred", "curl-logos/preferred/s2.svg"),
    ],
    "ocean-river": [
        ("regent-seven-seas", "wiki-logos/regent-seven-seas/0.png"),
        ("silversea", "curl-logos/silversea/f3.png"),
        ("seabourn", "curl-logos/seabourn/f2.svg"),
        ("explora", "file-logos/explora/0.jpg"),
        ("ritz-yacht", "wiki-logos/ritz-yacht/1.png"),
        ("four-seasons-yachts", "manual3/four-seasons-yachts.svg"),
        ("crystal", "wiki-logos/crystal/0.png"),
        ("oceania", "wiki-logos/oceania/0.svg"),
        ("ponant", "manual3/ponant.svg"),
        ("scenic", "manual3/scenic.svg"),
        ("seadream", "wiki-logos/seadream/0.jpg"),
        ("windstar", "wiki-logos/windstar/1.png"),
        ("paul-gauguin", "wiki-logos/paul-gauguin/0.jpg"),
        ("poseidon", "curl-logos/poseidon/f4.png"),
        ("cunard", "wiki-logos/cunard/3.svg"),
        ("uniworld", "wiki-logos/uniworld/1.jpg"),
        ("tauck", "wiki-logos/tauck/1.png"),
        ("riverside", "manual3/riverside.svg"),
        ("emerald", "wiki-logos/emerald/0.png"),
        ("avalon", "manual/avalon-preview.png"),
    ],
    "rail": [
        ("belmond", "manual3/belmond.svg"),
        ("venice-simplon", "wiki-logos/venice-simplon/1.png"),
        ("la-dolce-vita", "wikidata-logos/la-dolce-vita/0.png"),
        ("rocky-mountaineer", "wiki-logos/rocky-mountaineer/3.svg"),
        ("golden-eagle", "manual3/golden-eagle.webp"),
        ("maharajas", "wiki-logos/maharajas/1.png"),
        ("blue-train", "manual2/blue-train.png"),
    ],
}

for name, items in groups.items():
    figs = "".join(
        f'<figure><div class="light"><img src="../../{C}/{path}" alt="{label}"></div>'
        f'<div class="dark"><img src="../../{C}/{path}" alt="{label}"></div>'
        f"<figcaption>{label}</figcaption></figure>"
        for label, path in items
    )
    html = (
        '<!doctype html><meta charset="utf-8"><style>'
        "body{font:13px/1.2 Arial,sans-serif;margin:0;padding:12px;background:#ddd}"
        "figure{display:inline-block;width:190px;margin:6px;vertical-align:top;background:#fff;border:1px solid #bbb}"
        "figure div{height:70px;display:flex;align-items:center;justify-content:center;padding:6px}"
        "figure .light{background:#fff}figure .dark{background:#2c2c2c}"
        "figure img{max-width:170px;max-height:58px;object-fit:contain}"
        "figcaption{background:#163E52;color:#fff;padding:4px 6px;font-size:12px}"
        "</style>"
        f"<h2>{name}</h2>{figs}"
    )
    out = os.path.join(ROOT, "_tools", "cache", f"finalists-{name}.html")
    open(out, "w", encoding="utf-8").write(html)
    print(out)
