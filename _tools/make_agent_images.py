"""Creates optimized agent portrait images from the photos used on the Storebox team page.

Outputs media/agents/<slug>-<width>.webp (4:5 crop, centered slightly above middle so faces
stay in frame). Reads the avatar URL for each agent from data/team.js.
Usage: python _tools/make_agent_images.py
"""
import io
import json
import re
import subprocess
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "media" / "agents"
WIDTHS = (160, 320, 480)
RATIO = 5 / 4  # height / width

agents = json.loads(
    subprocess.check_output(
        ["node", "-e", (
            "import('./_tools/lib.mjs').then(({loadPageData})=>{"
            "const p=Object.values(loadPageData('data/team.js').__ENRICHED_IR__.pages)[0];"
            "const out=[];for(const s of p.sections)for(const it of s.items||[]){"
            "out.push({slug:(it.link?.href||'').split('/').pop(),src:it.avatarMedia?.src})}"
            "console.log(JSON.stringify(out))})"
        )],
        cwd=ROOT,
    )
)


def load(src: str) -> Image.Image:
    local = ROOT / re.sub(r"^https?://[^/]+/", "", src)
    if local.exists():
        return Image.open(local)
    with urllib.request.urlopen(src, timeout=30) as res:
        return Image.open(io.BytesIO(res.read()))


OUT.mkdir(parents=True, exist_ok=True)
for agent in agents:
    img = ImageOps.exif_transpose(load(agent["src"])).convert("RGB")
    w, h = img.size
    if w / h > 1.5:
        # Wide "owner card" sources have a dark frame around the centered portrait.
        inset_x, inset_y = int(w * 0.33), int(h * 0.03)
        img = img.crop((inset_x, inset_y, w - inset_x, h - inset_y))
        w, h = img.size
    target_h = int(w * RATIO)
    if target_h <= h:
        top = int((h - target_h) * 0.35)
        img = img.crop((0, top, w, top + target_h))
    else:
        target_w = int(h / RATIO)
        left = (w - target_w) // 2
        img = img.crop((left, 0, left + target_w, h))
    for width in WIDTHS:
        out = OUT / f"{agent['slug']}-{width}.webp"
        img.resize((width, int(width * RATIO)), Image.LANCZOS).save(out, "WEBP", quality=78, method=6)
    sizes = ", ".join(f"{(OUT / f'{agent['slug']}-{x}.webp').stat().st_size // 1024}KB@{x}" for x in WIDTHS)
    print(f"{agent['slug']}: source {w}x{h} -> {sizes}")
