// Collects every image used by standalone/superior-travel.html into "all assets/", sorted by where it is used.
//   node _tools/export-assets.mjs
// Embedded images (logo, advisor photos, inline data URIs) are decoded; linked images are downloaded once
// (re-runs skip files that already exist). A manifest.csv lists each file, its source and the pages using it.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'all assets');
const html = fs.readFileSync(path.join(ROOT, 'standalone', 'superior-travel.html'), 'utf8');

const packed = html.match(/<script type="application\/octet-stream" id="payload">([\s\S]*?)<\/script>/)[1].trim();
const data = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
const shell = html.replace(/<script type="application\/octet-stream" id="payload">[\s\S]*?<\/script>/, '');

const IMG_EXT = /\.(jpe?g|png|webp|gif|svg|avif|ico|bmp)(?=$|[?#])/i;
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Every image reference in a chunk of HTML/CSS: src/srcset/poster attributes and CSS url(...).
function refsIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/\b(?:src|data-src|poster)\s*=\s*(["'])(.*?)\1/gi)) out.add(m[2]);
  for (const m of text.matchAll(/\b(?:srcset|data-srcset)\s*=\s*(["'])(.*?)\1/gi)) m[2].split(',').forEach((c) => out.add(c.trim().split(/\s+/)[0]));
  for (const m of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) out.add(m[2]);
  return [...out]
    .map((u) => decode(u.trim()))
    .filter((u) => u && !u.startsWith('#') && !/^data:(font|application)/i.test(u) && (u.startsWith('data:image') || u.startsWith('st-agent-img:') || IMG_EXT.test(u) || /^https?:/i.test(u)));
}

// usage: ref -> Set(route)
const usage = new Map();
const use = (ref, route) => {
  if (!usage.has(ref)) usage.set(ref, new Set());
  usage.get(ref).add(route);
};
for (const p of data.pages) {
  for (const r of refsIn(p.h)) use(r, p.r);
  for (const id of p.s) for (const r of refsIn(data.styles[id] || '')) use(r, p.r);
}
for (const r of refsIn(data.cta.h)) use(r, '(shared call-to-action)');
for (const id of data.cta.s) for (const r of refsIn(data.styles[id] || '')) use(r, '(shared call-to-action)');
for (const r of refsIn(shell)) use(r, '(header, footer and site styles)');

// Linked refs that are not images (e.g. iframes, scripts) are dropped after the content-type check below.
function folderFor(ref, routes) {
  const list = [...routes];
  if (ref.startsWith('st-agent-img:') || /\/media\/agents\//.test(ref)) return 'team';
  if (list.every((r) => r.startsWith('('))) return 'brand';
  const sections = new Set(list.filter((r) => !r.startsWith('(')).map((r) => r.split('/')[1] || 'home'));
  if (sections.size > 2 || list.some((r) => r.startsWith('('))) return 'shared';
  const s = [...sections][0];
  if (s === 'blogs' || s === 'travel-journal') return 'blog';
  if (s === 'team') return 'team';
  if (s === 'home') return 'home';
  return path.join('pages', s);
}

const EXT_BY_TYPE = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico' };
const taken = new Set();
function uniqueName(folder, base, ext) {
  base = base.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'image';
  let name = `${base}${ext}`;
  for (let n = 2; taken.has(path.join(folder, name).toLowerCase()); n++) name = `${base}-${n}${ext}`;
  taken.add(path.join(folder, name).toLowerCase());
  return name;
}
function fromDataUri(uri) {
  const m = uri.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
  if (!m) return null;
  return { type: m[1], body: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) };
}
async function fetchImage(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      return { type, body: Buffer.from(await res.arrayBuffer()) };
    } catch (err) {
      if (attempt === 2) return { error: err.message };
    }
  }
}

const rows = [];
const failed = [];
const seenHash = new Map();
const refs = [...usage.keys()].sort();
let i = 0;
async function worker() {
  while (i < refs.length) {
    const ref = refs[i++];
    const routes = usage.get(ref);
    const folder = folderFor(ref, routes);
    let src = ref, got, base;
    if (ref.startsWith('st-agent-img:')) {
      const slug = ref.slice('st-agent-img:'.length);
      src = `(embedded advisor photo: ${slug})`;
      got = fromDataUri(data.img[slug] || '');
      base = slug;
    } else if (ref.startsWith('data:')) {
      got = fromDataUri(ref);
      base = folder === 'brand' ? 'superior-travel-logo' : `embedded-${crypto.createHash('sha1').update(ref).digest('hex').slice(0, 8)}`;
      src = '(embedded data URI)';
    } else {
      const url = ref.startsWith('//') ? `https:${ref}` : ref;
      if (!/^https?:/i.test(url)) { failed.push([ref, 'not a web address']); continue; }
      got = await fetchImage(url);
      base = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image');
    }
    if (!got || got.error) { failed.push([ref, got?.error || 'could not decode']); continue; }
    const ext = (IMG_EXT.exec(base)?.[0] || '').toLowerCase().replace('.jpeg', '.jpg') || EXT_BY_TYPE[got.type] || '';
    if (!got.type.startsWith('image/') && !IMG_EXT.test(base)) continue;
    const hash = crypto.createHash('sha1').update(got.body).digest('hex');
    if (seenHash.has(hash)) {
      seenHash.get(hash).pages.push(...routes);
      seenHash.get(hash).sources.push(src);
      continue;
    }
    const name = uniqueName(folder, base, ext || '.img');
    const file = path.join(OUT, folder, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, got.body);
    const row = { file: path.join(folder, name).replace(/\\/g, '/'), sources: [src], bytes: got.body.length, pages: [...routes] };
    seenHash.set(hash, row);
    rows.push(row);
  }
}
fs.mkdirSync(OUT, { recursive: true });
await Promise.all(Array.from({ length: 8 }, worker));

rows.sort((a, b) => a.file.localeCompare(b.file));
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
fs.writeFileSync(
  path.join(OUT, 'manifest.csv'),
  ['file,size_kb,source,used_on'].concat(rows.map((r) => [r.file, (r.bytes / 1024).toFixed(1), [...new Set(r.sources)].join(' | '), [...new Set(r.pages)].sort().join(' | ')].map(csv).join(','))).join('\r\n') + '\r\n',
);
const byFolder = {};
for (const r of rows) {
  const top = r.file.split('/').slice(0, r.file.startsWith('pages/') ? 2 : 1).join('/');
  byFolder[top] = (byFolder[top] || 0) + 1;
}
const total = rows.reduce((n, r) => n + r.bytes, 0);
console.log(`${rows.length} images (${(total / 1048576).toFixed(1)} MB) saved to "all assets/" from ${refs.length} references.`);
console.log(Object.entries(byFolder).sort().map(([k, v]) => `  ${k}: ${v}`).join('\n'));
if (failed.length) {
  console.log(`Could not save ${failed.length}:`);
  for (const [ref, why] of failed) console.log(`  ${ref.slice(0, 140)} — ${why}`);
}
