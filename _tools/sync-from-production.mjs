// Re-syncs every page listed in the production sitemap (HTML + page-data file) so the local copy
// matches production byte-for-byte (absolute canonicals, root-relative URLs), replacing the
// re-serialized output of the original website-copy tool. Usage: node _tools/sync-from-production.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE_ORIGIN, write } from './lib.mjs';

const get = async (url) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) return res.text();
    if (attempt === 3) throw new Error(`${res?.status ?? 'network error'} ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
};

const sitemap = await get(`${SITE_ORIGIN}/sitemap.xml`);
write('_tools/prod-sitemap.xml', sitemap);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const localFileFor = (pathname) => (pathname === '/' || pathname === '' ? 'index.htm' : `${pathname.replace(/\/$/, '').slice(1)}.html`);

const missingAssets = new Set();
let i = 0;
const queue = [...urls];
async function worker() {
  while (queue.length) {
    const url = queue.shift();
    const { pathname } = new URL(url);
    const html = await get(url);
    const m = html.match(/<script defer(?:="")? src="(\/data\/[^"]+)"/);
    if (!m) throw new Error(`No page-data script in ${url}`);
    const dataUrl = new URL(m[1], SITE_ORIGIN);
    write(path.join('data', path.basename(dataUrl.pathname)), await get(dataUrl.href));
    write(localFileFor(pathname), html);
    for (const a of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)/g)) {
      if (!fs.existsSync(path.join(ROOT, a[1]))) missingAssets.add(a[1]);
    }
    if (++i % 20 === 0) console.log(`${i}/${urls.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

for (const f of ['robots.txt', 'llms.txt']) write(f, await get(`${SITE_ORIGIN}/${f}`));
for (const a of missingAssets) {
  const res = await fetch(`${SITE_ORIGIN}${a}`);
  fs.mkdirSync(path.dirname(path.join(ROOT, a)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, a), Buffer.from(await res.arrayBuffer()));
  console.log(`asset ${a}`);
}
console.log(`Synced ${i} pages.`);
