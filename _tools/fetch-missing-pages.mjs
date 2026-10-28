// Downloads production pages that are listed in the live sitemap but were not captured by the
// original website copy (blog posts, /contact-us, /search-trips, /books), with their page-data files.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE_ORIGIN, read, write } from './lib.mjs';

const sitemap = read('_tools/prod-sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const localFileFor = (pathname) => (pathname === '/' || pathname === '' ? 'index.htm' : `${pathname.slice(1)}.html`);

for (const url of urls) {
  const { pathname } = new URL(url);
  const file = localFileFor(pathname);
  if (fs.existsSync(path.join(ROOT, file))) continue;

  const res = await fetch(url);
  if (!res.ok) {
    console.log(`SKIP ${res.status} ${url}`);
    continue;
  }
  let html = await res.text();
  const dataSrc = html.match(/<script defer="" src="([^"]*\/data\/[^"]+)"|<script defer src="([^"]*\/data\/[^"]+)"/);
  const src = dataSrc && (dataSrc[1] || dataSrc[2]);
  if (src) {
    const dataUrl = new URL(src, SITE_ORIGIN);
    const dataRes = await fetch(dataUrl);
    if (dataRes.ok) write(path.join('data', path.basename(dataUrl.pathname)), await dataRes.text());
    else console.log(`  data ${dataRes.status} ${dataUrl}`);
  }
  write(file, html);
  console.log(`saved ${file}${src ? ` + ${src}` : ''}`);
}
