// Static QA checks over the built site. Usage: node _tools/check-site.mjs
// Exits non-zero when blocking problems are found; informational findings are listed separately.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE_ORIGIN, listDataFiles, loadPageData, read, readJson } from './lib.mjs';

const problems = [];
const notes = [];
const routes = new Map();
for (const f of listDataFiles()) {
  const w = loadPageData(f);
  routes.set(w.__ROUTE_PATH__, { dataFile: f, win: w });
}
const htmlFor = (r) => (r === '/' ? 'index.htm' : `${r.slice(1)}.html`);
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const resolvesInternally = (href) => {
  const clean = href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
  if (routes.has(clean)) return true;
  return exists(clean.slice(1)) && fs.statSync(path.join(ROOT, clean.slice(1))).isFile();
};

const sitemap = read('sitemap.xml');
const sitemapLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
const searchIndex = readJson('assets/search-index.json');
const searchUrls = new Set(searchIndex.entries.map((e) => e.u));
const canonicals = new Map();
const missingLinks = new Map();
const noH1 = [];
const multiH1 = [];
const imgNoAlt = new Map();

for (const [route, { win }] of routes) {
  const file = htmlFor(route);
  if (!exists(file)) {
    problems.push(`${route}: missing HTML file ${file}`);
    continue;
  }
  const html = read(file);
  const head = html.slice(0, html.indexOf('<body'));
  const canon = (head.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const expected = `${SITE_ORIGIN}${route === '/' ? '' : route}`;
  if (!canon) problems.push(`${route}: no canonical`);
  else if (canon.replace(/\/$/, '') !== expected) problems.push(`${route}: canonical ${canon} (expected ${expected})`);
  if (canon) canonicals.set(canon, [...(canonicals.get(canon) || []), route]);
  if (!/<title>[^<]{5,}<\/title>/.test(head)) problems.push(`${route}: missing <title>`);
  if (!/<meta name="description" content="[^"]{20,}"/.test(head)) notes.push(`${route}: short or missing meta description`);
  if (!head.includes('/assets/st-site.css?v=')) problems.push(`${route}: enhancement stylesheet not linked`);
  if (!html.includes('/assets/st-site.js?v=')) problems.push(`${route}: enhancement script not included`);
  if (/googletagmanager\.com\/gtag\/js\?id=G-8YXTHV7967/.test(head) === false) problems.push(`${route}: Google Analytics tag missing`);
  if (!sitemapLocs.has(expected) && !sitemapLocs.has(`${expected}/`)) problems.push(`${route}: not in sitemap.xml`);
  if (!searchUrls.has(route)) notes.push(`${route}: not in search index`);
  if (html.includes('/_drafts/')) problems.push(`${route}: links to a private draft`);
  const dataRef = (html.match(/<script defer src="(\/data\/[^"?]+)\?v=/) || [])[1];
  if (!dataRef || !exists(dataRef.slice(1))) problems.push(`${route}: page-data script missing (${dataRef})`);

  const body = html.slice(html.indexOf('<body')).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const h1s = (body.match(/<h1[\s>]/g) || []).length;
  if (h1s === 0) noH1.push(route);
  if (h1s > 1) multiH1.push(`${route} (${h1s})`);
  for (const m of body.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) imgNoAlt.set(route, (imgNoAlt.get(route) || 0) + 1);

  const hrefs = [...body.matchAll(/\bhref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const irHrefs = [];
  (function walk(n, k) {
    if (typeof n === 'string') { if (k === 'href' || k === 'url') irHrefs.push(n); return; }
    if (Array.isArray(n)) return n.forEach((v) => walk(v, k));
    if (n && typeof n === 'object') for (const [kk, v] of Object.entries(n)) walk(v, kk);
  })(win.__ENRICHED_IR__, '');
  for (const href of [...hrefs, ...irHrefs]) {
    let target = href;
    if (/^https?:\/\/(www\.)?superiortravel\.com/i.test(target)) target = new URL(target).pathname;
    if (!target.startsWith('/') || target.startsWith('//')) continue;
    if (/^\/(assets|media|data|logos|attachments|photos|storebox-media|favicon|apple-touch)/.test(target)) {
      if (!exists(target.split('?')[0].slice(1))) missingLinks.set(target.split('?')[0], [...(missingLinks.get(target.split('?')[0]) || []), route]);
      continue;
    }
    if (!resolvesInternally(target)) missingLinks.set(target, [...(missingLinks.get(target) || []), route]);
  }
}

for (const [canon, rs] of canonicals) if (rs.length > 1) problems.push(`Duplicate canonical ${canon}: ${rs.join(', ')}`);
for (const loc of sitemapLocs) {
  const r = new URL(loc).pathname.replace(/\/$/, '') || '/';
  if (!routes.has(r)) problems.push(`sitemap.xml lists ${loc} but no page exists`);
}
for (const u of searchUrls) if (!routes.has(u)) problems.push(`search index links to missing page ${u}`);
if (/_drafts/.test(sitemap) || [...searchUrls].some((u) => u.startsWith('/_drafts'))) problems.push('Draft pages leaked into sitemap or search index');
if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(sitemap)) problems.push('sitemap.xml contains unescaped &');

const media = [...missingLinks.entries()].filter(([k]) => /^\/(media|assets|logos|attachments|photos)/.test(k));
const pagesMissing = [...missingLinks.entries()].filter(([k]) => !/^\/(media|assets|logos|attachments|photos)/.test(k));
for (const [href, rs] of pagesMissing) problems.push(`Broken internal link ${href} (on ${[...new Set(rs)].slice(0, 3).join(', ')}${new Set(rs).size > 3 ? '…' : ''})`);
if (media.length) notes.push(`${media.length} referenced media files are not in the local copy (served from production by the preview server): ${media.slice(0, 5).map(([k]) => k).join(', ')}${media.length > 5 ? '…' : ''}`);
if (noH1.length) notes.push(`Pages without an <h1> in server HTML (${noH1.length}): ${noH1.slice(0, 12).join(', ')}${noH1.length > 12 ? '…' : ''}`);
if (multiH1.length) notes.push(`Pages with more than one <h1>: ${multiH1.join(', ')}`);
if (imgNoAlt.size) notes.push(`Images without alt attribute: ${[...imgNoAlt.entries()].map(([r, n]) => `${r} (${n})`).join(', ')}`);

console.log(`Checked ${routes.size} pages.`);
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nNo blocking problems.');
console.log(notes.length ? `\nNOTES (${notes.length}):\n- ${notes.join('\n- ')}` : '');
process.exitCode = problems.length ? 1 : 0;
